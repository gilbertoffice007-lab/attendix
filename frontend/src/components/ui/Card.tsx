import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/utils'

export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-2xl border border-ink-200/80 bg-white shadow-card dark:border-ink-800 dark:bg-ink-900',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({
  title,
  description,
  action,
  className,
  children,
}: {
  title?: ReactNode
  description?: ReactNode
  action?: ReactNode
  className?: string
  children?: ReactNode
}) {
  return (
    <div
      className={cn(
        'flex flex-col gap-3 border-b border-ink-100 px-5 py-4 sm:flex-row sm:items-center sm:justify-between dark:border-ink-800',
        className,
      )}
    >
      {children ?? (
        <div className="min-w-0">
          {title ? (
            <h2 className="text-sm font-semibold text-ink-900 dark:text-white">{title}</h2>
          ) : null}
          {description ? (
            <p className="mt-0.5 text-xs text-ink-500 dark:text-ink-400">{description}</p>
          ) : null}
        </div>
      )}
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  )
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'border-t border-ink-100 px-5 py-3.5 dark:border-ink-800',
        className,
      )}
      {...props}
    />
  )
}
