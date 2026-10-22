import type { ComponentType, ReactNode } from 'react'
import { cn } from '@/lib/utils'
import { Skeleton } from './Feedback'

export function StatCard({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'brand',
  loading,
  footer,
  className,
}: {
  label: string
  value: ReactNode
  hint?: ReactNode
  icon: ComponentType<{ className?: string }>
  tone?: 'brand' | 'green' | 'amber' | 'rose' | 'violet' | 'ink'
  loading?: boolean
  footer?: ReactNode
  className?: string
}) {
  const tones = {
    brand: 'bg-brand-50 text-brand-600 ring-brand-600/10 dark:bg-brand-500/10 dark:text-brand-300',
    green:
      'bg-emerald-50 text-emerald-600 ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-300',
    amber:
      'bg-amber-50 text-amber-600 ring-amber-600/10 dark:bg-amber-500/10 dark:text-amber-300',
    rose: 'bg-rose-50 text-rose-600 ring-rose-600/10 dark:bg-rose-500/10 dark:text-rose-300',
    violet:
      'bg-violet-50 text-violet-600 ring-violet-600/10 dark:bg-violet-500/10 dark:text-violet-300',
    ink: 'bg-ink-100 text-ink-600 ring-ink-600/10 dark:bg-ink-800 dark:text-ink-300',
  }
  return (
    <div
      className={cn(
        'group rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card transition-shadow hover:shadow-card-hover dark:border-ink-800 dark:bg-ink-900',
        className,
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-xs font-medium text-ink-500 dark:text-ink-400">{label}</p>
          {loading ? (
            <Skeleton className="mt-2 h-7 w-20" />
          ) : (
            <p className="mt-1.5 text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">
              {value}
            </p>
          )}
          {hint ? (
            <div className="mt-1 text-xs text-ink-500 dark:text-ink-400">{hint}</div>
          ) : null}
        </div>
        <div className={cn('rounded-xl p-2.5 ring-1 ring-inset', tones[tone])}>
          <Icon className="h-5 w-5" />
        </div>
      </div>
      {footer ? <div className="mt-4">{footer}</div> : null}
    </div>
  )
}
