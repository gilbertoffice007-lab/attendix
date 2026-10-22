import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from './Button'
import { cn } from '@/lib/utils'

export function Pagination({
  page,
  pageSize,
  total,
  onPageChange,
  className,
}: {
  page: number
  pageSize: number
  total: number
  onPageChange: (page: number) => void
  className?: string
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  if (total === 0) return null
  const from = (page - 1) * pageSize + 1
  const to = Math.min(page * pageSize, total)
  return (
    <div
      className={cn(
        'flex flex-col-reverse items-center justify-between gap-3 px-4 py-3 sm:flex-row',
        className,
      )}
    >
      <p className="text-xs text-ink-500 dark:text-ink-400">
        Showing <span className="font-semibold text-ink-700 dark:text-ink-200">{from}</span>–
        <span className="font-semibold text-ink-700 dark:text-ink-200">{to}</span> of{' '}
        <span className="font-semibold text-ink-700 dark:text-ink-200">{total}</span>
      </p>
      <div className="flex items-center gap-1.5">
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
          <span className="hidden sm:inline">Previous</span>
        </Button>
        <span className="px-2 text-xs font-medium text-ink-500 dark:text-ink-400">
          {page} / {pages}
        </span>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  )
}
