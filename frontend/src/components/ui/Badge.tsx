import type { ReactNode } from 'react'
import { cn, listColorClasses, attendanceMeta } from '@/lib/utils'
import type { AttendanceStatus, StatusOption } from '@/types'

type Tone = 'brand' | 'neutral' | 'success' | 'warning' | 'danger' | 'info'

const tones: Record<Tone, string> = {
  brand:
    'bg-brand-50 text-brand-700 ring-brand-600/20 dark:bg-brand-500/10 dark:text-brand-300 dark:ring-brand-400/20',
  neutral:
    'bg-ink-100 text-ink-600 ring-ink-500/20 dark:bg-ink-800 dark:text-ink-300 dark:ring-ink-500/20',
  success:
    'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
  warning:
    'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
  danger:
    'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20',
  info: 'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
}

export function Badge({
  children,
  tone = 'neutral',
  className,
  dot,
}: {
  children: ReactNode
  tone?: Tone
  className?: string
  dot?: boolean
}) {
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        tones[tone],
        className,
      )}
    >
      {dot ? <span className="h-1.5 w-1.5 rounded-full bg-current opacity-70" /> : null}
      {children}
    </span>
  )
}

export function AttendanceBadge({
  status,
  className,
}: {
  status: AttendanceStatus
  className?: string
}) {
  const meta = attendanceMeta[status]
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        meta.badge,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', meta.dot)} />
      {meta.label}
    </span>
  )
}

export function ListStatusBadge({
  status,
  options,
  className,
}: {
  status: string
  options: StatusOption[]
  className?: string
}) {
  const option = options.find((item) => item.key === status)
  const palette = listColorClasses[option?.color ?? 'slate']
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold ring-1 ring-inset',
        palette.badge,
        className,
      )}
    >
      <span className={cn('h-1.5 w-1.5 rounded-full', palette.dot)} />
      {option?.label ?? status}
    </span>
  )
}
