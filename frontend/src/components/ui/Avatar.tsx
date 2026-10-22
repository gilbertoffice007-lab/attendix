import { cn, initials } from '@/lib/utils'

export function Avatar({
  name,
  size = 'md',
  className,
}: {
  name: string
  size?: 'sm' | 'md' | 'lg' | 'xl'
  className?: string
}) {
  const sizes = {
    sm: 'h-7 w-7 text-[10px]',
    md: 'h-9 w-9 text-xs',
    lg: 'h-11 w-11 text-sm',
    xl: 'h-16 w-16 text-lg',
  }
  const palette = [
    'bg-brand-100 text-brand-700 dark:bg-brand-500/20 dark:text-brand-300',
    'bg-violet-100 text-violet-700 dark:bg-violet-500/20 dark:text-violet-300',
    'bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300',
    'bg-amber-100 text-amber-700 dark:bg-amber-500/20 dark:text-amber-300',
    'bg-sky-100 text-sky-700 dark:bg-sky-500/20 dark:text-sky-300',
    'bg-rose-100 text-rose-700 dark:bg-rose-500/20 dark:text-rose-300',
  ]
  const index =
    Array.from(name).reduce((total, character) => total + character.charCodeAt(0), 0) %
    palette.length
  return (
    <span
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold uppercase',
        sizes[size],
        palette[index],
        className,
      )}
      aria-hidden
    >
      {initials(name)}
    </span>
  )
}
