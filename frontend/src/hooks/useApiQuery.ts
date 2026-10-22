import { useCallback, useEffect, useRef, useState, type DependencyList } from 'react'
import { getErrorMessage } from '@/services/http'

export function useApiQuery<T>(
  fetcher: () => Promise<T>,
  deps: DependencyList,
  options: { enabled?: boolean } = {},
) {
  const { enabled = true } = options
  const fetcherRef = useRef(fetcher)
  fetcherRef.current = fetcher
  const requestId = useRef(0)
  const [data, setData] = useState<T | null>(null)
  const [loading, setLoading] = useState(enabled)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (silent = false) => {
    const id = ++requestId.current
    if (!silent) setLoading(true)
    setError(null)
    try {
      const result = await fetcherRef.current()
      if (id === requestId.current) setData(result)
      return result
    } catch (caught) {
      if (id === requestId.current) setError(getErrorMessage(caught))
      return null
    } finally {
      if (id === requestId.current) setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!enabled) {
      setLoading(false)
      return
    }
    void refresh()
    return () => {
      requestId.current += 1
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, ...deps])

  return { data, setData, loading, error, refresh }
}
