import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { authApi } from '@/services/api'
import { forgetCsrfToken } from '@/services/http'
import type { CurrentUser } from '@/types'
import { useToast } from './ToastContext'

interface AuthContextValue {
  user: CurrentUser | null
  loading: boolean
  login: (
    email: string,
    password: string,
    portal?: 'student' | 'faculty',
  ) => Promise<CurrentUser>
  register: (fullName: string, email: string, password: string) => Promise<CurrentUser>
  registerStudent: (payload: {
    full_name: string
    email: string
    password: string
    class_id: number
    roll_number: string
  }) => Promise<CurrentUser>
  setup: (fullName: string, email: string, password: string) => Promise<CurrentUser>
  logout: () => Promise<void>
  refresh: () => Promise<void>
  changePassword: (currentPassword: string, newPassword: string) => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<CurrentUser | null>(null)
  const [loading, setLoading] = useState(true)
  const toast = useToast()

  useEffect(() => {
    let active = true
    authApi
      .me()
      .then((current) => {
        if (active) setUser(current)
      })
      .catch(() => {
        if (active) setUser(null)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    const handleExpired = () => {
      setUser((current) => {
        if (current) {
          toast.warning('Session expired', 'Please sign in again to continue.')
        }
        return null
      })
    }
    window.addEventListener('auth:expired', handleExpired)
    return () => window.removeEventListener('auth:expired', handleExpired)
  }, [toast])

  const login = useCallback(
    async (email: string, password: string, portal?: 'student' | 'faculty') => {
      const current = await authApi.login({ email, password, portal })
      setUser(current)
      return current
    },
    [],
  )

  const register = useCallback(
    async (fullName: string, email: string, password: string) => {
      const current = await authApi.register({
        full_name: fullName,
        email,
        password,
      })
      setUser(current)
      return current
    },
    [],
  )

  const registerStudent = useCallback(
    async (payload: {
      full_name: string
      email: string
      password: string
      class_id: number
      roll_number: string
    }) => {
      const current = await authApi.registerStudent(payload)
      setUser(current)
      return current
    },
    [],
  )

  const setup = useCallback(
    async (fullName: string, email: string, password: string) => {
      const current = await authApi.setup({
        full_name: fullName,
        email,
        password,
      })
      setUser(current)
      return current
    },
    [],
  )

  const logout = useCallback(async () => {
    try {
      await authApi.logout()
    } catch {
      // The local session is cleared even if the network call fails.
    } finally {
      forgetCsrfToken()
      setUser(null)
    }
  }, [])

  const refresh = useCallback(async () => {
    try {
      const current = await authApi.me()
      setUser(current)
    } catch {
      setUser(null)
    }
  }, [])

  const changePassword = useCallback(async (currentPassword: string, newPassword: string) => {
    await authApi.changePassword({
      current_password: currentPassword,
      new_password: newPassword,
    })
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      login,
      register,
      registerStudent,
      setup,
      logout,
      refresh,
      changePassword,
    }),
    [
      user,
      loading,
      login,
      register,
      registerStudent,
      setup,
      logout,
      refresh,
      changePassword,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
