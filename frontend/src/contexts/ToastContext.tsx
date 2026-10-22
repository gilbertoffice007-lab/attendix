import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { AlertTriangle, CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/utils'

type ToastTone = 'success' | 'error' | 'info' | 'warning'

interface ToastInput {
  title: string
  description?: string
  tone?: ToastTone
  duration?: number
}

interface ToastItem extends Required<Omit<ToastInput, 'duration'>> {
  id: number
  duration: number
}

interface ToastContextValue {
  toast: (input: ToastInput) => void
  success: (title: string, description?: string) => void
  error: (title: string, description?: string) => void
  info: (title: string, description?: string) => void
  warning: (title: string, description?: string) => void
  dismiss: (id: number) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

const toneStyles: Record<ToastTone, { icon: typeof Info; iconClass: string; bar: string }> = {
  success: {
    icon: CheckCircle2,
    iconClass: 'text-emerald-500',
    bar: 'bg-emerald-500',
  },
  error: { icon: XCircle, iconClass: 'text-rose-500', bar: 'bg-rose-500' },
  warning: { icon: AlertTriangle, iconClass: 'text-amber-500', bar: 'bg-amber-500' },
  info: { icon: Info, iconClass: 'text-brand-500', bar: 'bg-brand-500' },
}

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([])
  const counter = useRef(0)
  const timers = useRef<Map<number, number>>(new Map())

  const dismiss = useCallback((id: number) => {
    const timer = timers.current.get(id)
    if (timer) window.clearTimeout(timer)
    timers.current.delete(id)
    setToasts((items) => items.filter((item) => item.id !== id))
  }, [])

  const toast = useCallback(
    ({ title, description = '', tone = 'info', duration = 4500 }: ToastInput) => {
      const id = ++counter.current
      setToasts((items) => [...items.slice(-3), { id, title, description, tone, duration }])
      const timer = window.setTimeout(() => dismiss(id), duration)
      timers.current.set(id, timer)
    },
    [dismiss],
  )

  const value = useMemo<ToastContextValue>(
    () => ({
      toast,
      dismiss,
      success: (title, description) => toast({ title, description, tone: 'success' }),
      error: (title, description) => toast({ title, description, tone: 'error', duration: 5500 }),
      info: (title, description) => toast({ title, description, tone: 'info' }),
      warning: (title, description) => toast({ title, description, tone: 'warning' }),
    }),
    [toast, dismiss],
  )

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 p-4 sm:items-end"
      >
        {toasts.map((item) => {
          const style = toneStyles[item.tone]
          const Icon = style.icon
          return (
            <div
              key={item.id}
              role={item.tone === 'error' ? 'alert' : 'status'}
              className="pointer-events-auto w-full max-w-sm animate-slide-up overflow-hidden rounded-xl border border-ink-200/80 bg-white shadow-card-hover dark:border-ink-700 dark:bg-ink-900"
            >
              <div className="flex gap-3 p-4">
                <Icon className={cn('mt-0.5 h-5 w-5 shrink-0', style.iconClass)} aria-hidden />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink-900 dark:text-white">{item.title}</p>
                  {item.description ? (
                    <p className="mt-0.5 text-sm leading-5 text-ink-500 dark:text-ink-400">
                      {item.description}
                    </p>
                  ) : null}
                </div>
                <button
                  type="button"
                  onClick={() => dismiss(item.id)}
                  className="-m-1 rounded-md p-1 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
                  aria-label="Dismiss notification"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="h-0.5 bg-ink-100 dark:bg-ink-800">
                <div
                  className={cn('h-full origin-left animate-[shrink_linear_forwards]', style.bar)}
                  style={{
                    animation: `toast-progress ${item.duration}ms linear forwards`,
                  }}
                />
              </div>
            </div>
          )
        })}
      </div>
      <style>{`@keyframes toast-progress { from { transform: scaleX(1); } to { transform: scaleX(0); } }`}</style>
    </ToastContext.Provider>
  )
}

export function useToast() {
  const context = useContext(ToastContext)
  if (!context) throw new Error('useToast must be used inside ToastProvider')
  return context
}
