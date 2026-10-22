import { Link } from 'react-router-dom'
import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Logo({
  compact = false,
  className,
  light = false,
}: {
  compact?: boolean
  className?: string
  light?: boolean
}) {
  return (
    <Link
      to="/"
      className={cn('inline-flex items-center gap-2.5', className)}
      aria-label="Attendix home"
    >
      <span
        className={cn(
          'relative flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white shadow-sm shadow-brand-600/30',
        )}
      >
        <Check className="h-5 w-5" strokeWidth={3} />
        <span className="absolute -right-0.5 -top-0.5 h-2 w-2 rounded-full bg-emerald-400 ring-2 ring-white dark:ring-ink-950" />
      </span>
      {!compact ? (
        <span className="flex flex-col leading-none">
          <span
            className={cn(
              'text-[17px] font-semibold tracking-tight',
              light ? 'text-white' : 'text-ink-900 dark:text-white',
            )}
          >
            Attendix
          </span>
          <span
            className={cn(
              'mt-1 text-[10px] font-medium uppercase tracking-[0.18em]',
              light ? 'text-brand-200' : 'text-ink-400 dark:text-ink-500',
            )}
          >
            Cloud attendance
          </span>
        </span>
      ) : null}
    </Link>
  )
}
