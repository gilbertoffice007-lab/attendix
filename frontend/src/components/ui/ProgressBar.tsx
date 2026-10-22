import { cn, percentageBar } from '@/lib/utils'

export function ProgressBar({
  value,
  threshold,
  className,
  barClassName,
  showThreshold = false,
}: {
  value: number
  threshold?: number
  className?: string
  barClassName?: string
  showThreshold?: boolean
}) {
  const clamped = Math.max(0, Math.min(100, value))
  return (
    <div className={cn('relative h-2 w-full overflow-hidden rounded-full bg-ink-100 dark:bg-ink-800', className)}>
      <div
        className={cn('h-full rounded-full transition-all duration-500', barClassName ?? percentageBar(value))}
        style={{ width: `${clamped}%` }}
        role="progressbar"
        aria-valuenow={Math.round(clamped)}
        aria-valuemin={0}
        aria-valuemax={100}
      />
      {showThreshold && threshold != null ? (
        <span
          className="absolute top-0 h-full w-px bg-ink-900/40 dark:bg-white/50"
          style={{ left: `${Math.min(100, Math.max(0, threshold))}%` }}
          title={`Threshold ${threshold}%`}
        />
      ) : null}
    </div>
  )
}
