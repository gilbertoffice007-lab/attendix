import { attendanceMeta, cn } from '@/lib/utils'
import type { AttendanceStatus } from '@/types'

const order: AttendanceStatus[] = ['present', 'absent', 'od', 'leave']

export function StatusSelector({
  value,
  onChange,
  disabled,
  className,
  compact = true,
}: {
  value: AttendanceStatus | null
  onChange: (status: AttendanceStatus) => void
  disabled?: boolean
  className?: string
  compact?: boolean
}) {
  return (
    <div
      role="group"
      aria-label="Attendance status"
      className={cn(
        'inline-flex items-center gap-0.5 rounded-lg bg-ink-100/80 p-0.5 dark:bg-ink-800',
        disabled && 'opacity-60',
        className,
      )}
    >
      {order.map((status) => {
        const meta = attendanceMeta[status]
        const active = value === status
        return (
          <button
            key={status}
            type="button"
            data-active={active}
            disabled={disabled}
            onClick={() => onChange(status)}
            aria-pressed={active}
            aria-label={meta.label}
            title={meta.label}
            className={cn(
              'rounded-md px-2 py-1 text-[11px] font-semibold text-ink-500 ring-1 ring-transparent transition hover:bg-white hover:text-ink-800 disabled:cursor-not-allowed dark:text-ink-400 dark:hover:bg-ink-700 dark:hover:text-white',
              compact ? 'min-w-[28px]' : 'px-2.5 py-1.5',
              meta.button,
              active && 'shadow-sm',
            )}
          >
            {compact ? meta.short : meta.label}
          </button>
        )
      })}
    </div>
  )
}
