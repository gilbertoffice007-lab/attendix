import type { ComponentType, ReactNode } from 'react'
import { AlertCircle, Inbox, Loader2, RefreshCw } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from './Button'

export function Spinner({ className }: { className?: string }) {
  return <Loader2 className={cn('h-5 w-5 animate-spin text-brand-600', className)} aria-hidden />
}

export function LoadingScreen({ label = 'Loading your workspace…' }: { label?: string }) {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="relative flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-600 shadow-lg shadow-brand-600/25">
        <span className="absolute inset-0 animate-ping rounded-2xl bg-brand-500/30" />
        <Loader2 className="relative h-6 w-6 animate-spin text-white" aria-hidden />
      </div>
      <p className="text-sm font-medium text-ink-500 dark:text-ink-400">{label}</p>
    </div>
  )
}

export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('skeleton h-4 w-full', className)} />
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-3 p-4" aria-hidden>
      {Array.from({ length: rows }).map((_, row) => (
        <div key={row} className="flex items-center gap-4">
          {Array.from({ length: cols }).map((__, col) => (
            <Skeleton
              key={col}
              className={cn('h-4', col === 0 ? 'w-1/4' : col === cols - 1 ? 'w-16' : 'flex-1')}
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function EmptyState({
  icon: Icon = Inbox,
  title,
  description,
  action,
  className,
}: {
  icon?: ComponentType<{ className?: string }>
  title: string
  description?: ReactNode
  action?: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-14 text-center',
        className,
      )}
    >
      <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-ink-100 text-ink-400 dark:bg-ink-800 dark:text-ink-500">
        <Icon className="h-6 w-6" />
      </div>
      <h3 className="text-sm font-semibold text-ink-900 dark:text-white">{title}</h3>
      {description ? (
        <p className="mt-1 max-w-sm text-sm leading-6 text-ink-500 dark:text-ink-400">
          {description}
        </p>
      ) : null}
      {action ? <div className="mt-5">{action}</div> : null}
    </div>
  )
}

export function ErrorState({
  message,
  onRetry,
  className,
}: {
  message?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center px-6 py-12 text-center',
        className,
      )}
    >
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-2xl bg-rose-50 text-rose-500 dark:bg-rose-500/10">
        <AlertCircle className="h-5 w-5" />
      </div>
      <h3 className="text-sm font-semibold text-ink-900 dark:text-white">
        Could not load this content
      </h3>
      <p className="mt-1 max-w-md text-sm text-ink-500 dark:text-ink-400">
        {message || 'Please try again in a moment.'}
      </p>
      {onRetry ? (
        <Button variant="secondary" size="sm" className="mt-5" onClick={onRetry}>
          <RefreshCw className="h-3.5 w-3.5" /> Try again
        </Button>
      ) : null}
    </div>
  )
}

export function Alert({
  tone = 'info',
  title,
  children,
  action,
  className,
}: {
  tone?: 'info' | 'success' | 'warning' | 'danger'
  title?: string
  children: ReactNode
  action?: ReactNode
  className?: string
}) {
  const tones = {
    info: 'border-brand-200 bg-brand-50 text-brand-800 dark:border-brand-500/20 dark:bg-brand-500/10 dark:text-brand-200',
    success:
      'border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-200',
    warning:
      'border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200',
    danger:
      'border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-200',
  }
  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded-xl border px-4 py-3 text-sm sm:flex-row sm:items-center sm:justify-between',
        tones[tone],
        className,
      )}
      role={tone === 'danger' ? 'alert' : 'status'}
    >
      <div>
        {title ? <p className="font-semibold">{title}</p> : null}
        <div className={cn(title && 'mt-0.5', 'text-[13px] leading-5 opacity-90')}>{children}</div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}
