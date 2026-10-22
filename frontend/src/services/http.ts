import axios, { AxiosError } from 'axios'

const baseURL = (import.meta.env.VITE_API_BASE_URL as string | undefined) || '/api/v1'

export const api = axios.create({
  baseURL,
  withCredentials: true,
  timeout: 30000,
  headers: { Accept: 'application/json' },
})

const CSRF_STORAGE_KEY = 'attendance_csrf_token'

let csrfToken = (() => {
  try {
    return window.localStorage.getItem(CSRF_STORAGE_KEY)
  } catch {
    return null
  }
})()

export function rememberCsrfToken(token: string | null | undefined) {
  if (!token) return
  csrfToken = token
  try {
    window.localStorage.setItem(CSRF_STORAGE_KEY, token)
  } catch {
    // Storage can be unavailable in private browsing; the in-memory copy still works.
  }
}

export function forgetCsrfToken() {
  csrfToken = null
  try {
    window.localStorage.removeItem(CSRF_STORAGE_KEY)
  } catch {
    // Ignore unavailable storage.
  }
}

function readCookie(name: string) {
  return document.cookie
    .split('; ')
    .find((row) => row.startsWith(`${name}=`))
    ?.split('=')[1]
}

api.interceptors.request.use((config) => {
  const method = (config.method || 'get').toLowerCase()
  if (!['get', 'head', 'options'].includes(method)) {
    const token = csrfToken || readCookie('attendance_csrf_token')
    if (token) config.headers.set('x-csrf-token', decodeURIComponent(token))
  }
  return config
})

api.interceptors.response.use(
  (response) => {
    const token = response.headers['x-csrf-token']
    if (typeof token === 'string' && token) rememberCsrfToken(token)
    return response
  },
  (error: AxiosError) => {
    if (error.response?.status === 401) {
      const url = error.config?.url || ''
      const isAuthAttempt = /auth\/(login|register|me)/.test(url)
      if (!isAuthAttempt) {
        forgetCsrfToken()
        window.dispatchEvent(new CustomEvent('auth:expired'))
      }
    }
    return Promise.reject(error)
  },
)

type ValidationDetail = { loc?: (string | number)[]; msg?: string }

export function getErrorMessage(error: unknown, fallback = 'Something went wrong. Please try again.') {
  if (axios.isAxiosError(error)) {
    if (!error.response) {
      return error.code === 'ECONNABORTED'
        ? 'The request timed out. Please try again.'
        : 'Unable to reach the server. Check your connection and try again.'
    }
    const detail = error.response.data?.detail
    if (typeof detail === 'string') return detail
    if (Array.isArray(detail)) {
      return detail
        .map((item: ValidationDetail) => {
          const field = item.loc?.filter((part) => part !== 'body').join('.')
          return field ? `${field}: ${item.msg}` : item.msg
        })
        .filter(Boolean)
        .join(' ')
    }
    if (detail && typeof detail === 'object' && 'msg' in detail) {
      return String((detail as { msg: unknown }).msg)
    }
    if (typeof error.response.data?.message === 'string') return error.response.data.message
  }
  if (error instanceof Error && error.message) return error.message
  return fallback
}

function filenameFromDisposition(disposition: string | undefined, fallback: string) {
  if (!disposition) return fallback
  const utf8 = disposition.match(/filename\*=UTF-8''([^;]+)/i)
  if (utf8) {
    try {
      return decodeURIComponent(utf8[1])
    } catch {
      return utf8[1]
    }
  }
  const plain = disposition.match(/filename="?([^";]+)"?/i)
  return plain ? plain[1] : fallback
}

export async function downloadFile(
  path: string,
  params: Record<string, unknown> | undefined,
  fallbackName: string,
) {
  const response = await api.get(path, { params, responseType: 'blob' })
  const filename = filenameFromDisposition(
    response.headers['content-disposition'] as string | undefined,
    fallbackName,
  )
  const blob = new Blob([response.data as BlobPart])
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  document.body.appendChild(anchor)
  anchor.click()
  anchor.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return filename
}

export const API_BASE_URL = baseURL
