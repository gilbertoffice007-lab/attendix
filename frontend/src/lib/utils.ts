import { format, formatDistanceToNowStrict, parseISO, isValid } from 'date-fns'
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'
import type { AttendanceStatus, Role, StatusColor } from '@/types'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

function toDate(value: string | Date | null | undefined): Date | null {
  if (!value) return null
  const parsed = typeof value === 'string' ? parseISO(value) : value
  return isValid(parsed) ? parsed : null
}

export function formatDate(value: string | Date | null | undefined, pattern = 'dd MMM yyyy') {
  const date = toDate(value)
  return date ? format(date, pattern) : '—'
}

export function formatDateTime(value: string | Date | null | undefined) {
  return formatDate(value, 'dd MMM yyyy, h:mm a')
}

export function formatTime(value: string | Date | null | undefined) {
  return formatDate(value, 'h:mm a')
}

export function fromNow(value: string | Date | null | undefined) {
  const date = toDate(value)
  return date ? formatDistanceToNowStrict(date, { addSuffix: true }) : '—'
}

export function todayInputValue() {
  return format(new Date(), 'yyyy-MM-dd')
}

export function formatNumber(value: number | null | undefined) {
  return new Intl.NumberFormat('en-IN').format(value ?? 0)
}

export function formatPercent(value: number | null | undefined, digits = 1) {
  if (value == null || Number.isNaN(value)) return '—'
  const rounded = Number(value.toFixed(digits))
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(digits)}%`
}

export function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')
}

export function titleCase(value: string) {
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase())
}

export const roleLabels: Record<Role, string> = {
  admin: 'Administrator',
  faculty: 'Faculty',
  student: 'Student',
}

export function homeForRole(role: Role) {
  return `/${role}`
}

export function greeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

export const attendanceMeta: Record<
  AttendanceStatus,
  { label: string; short: string; dot: string; badge: string; button: string }
> = {
  present: {
    label: 'Present',
    short: 'P',
    dot: 'bg-emerald-500',
    badge:
      'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
    button:
      'data-[active=true]:bg-emerald-600 data-[active=true]:text-white data-[active=true]:ring-emerald-600',
  },
  absent: {
    label: 'Absent',
    short: 'A',
    dot: 'bg-rose-500',
    badge:
      'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20',
    button:
      'data-[active=true]:bg-rose-600 data-[active=true]:text-white data-[active=true]:ring-rose-600',
  },
  od: {
    label: 'On duty',
    short: 'OD',
    dot: 'bg-sky-500',
    badge:
      'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
    button:
      'data-[active=true]:bg-sky-600 data-[active=true]:text-white data-[active=true]:ring-sky-600',
  },
  leave: {
    label: 'Leave',
    short: 'L',
    dot: 'bg-amber-500',
    badge:
      'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
    button:
      'data-[active=true]:bg-amber-500 data-[active=true]:text-white data-[active=true]:ring-amber-500',
  },
}

export const listColorClasses: Record<
  StatusColor,
  { badge: string; dot: string; solid: string; soft: string }
> = {
  green: {
    badge:
      'bg-emerald-50 text-emerald-700 ring-emerald-600/20 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/20',
    dot: 'bg-emerald-500',
    solid: 'bg-emerald-600',
    soft: 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  },
  red: {
    badge:
      'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20',
    dot: 'bg-rose-500',
    solid: 'bg-rose-600',
    soft: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
  amber: {
    badge:
      'bg-amber-50 text-amber-700 ring-amber-600/20 dark:bg-amber-500/10 dark:text-amber-300 dark:ring-amber-400/20',
    dot: 'bg-amber-500',
    solid: 'bg-amber-500',
    soft: 'bg-amber-500/10 text-amber-700 dark:text-amber-300',
  },
  blue: {
    badge:
      'bg-sky-50 text-sky-700 ring-sky-600/20 dark:bg-sky-500/10 dark:text-sky-300 dark:ring-sky-400/20',
    dot: 'bg-sky-500',
    solid: 'bg-sky-600',
    soft: 'bg-sky-500/10 text-sky-700 dark:text-sky-300',
  },
  slate: {
    badge:
      'bg-ink-100 text-ink-700 ring-ink-600/20 dark:bg-ink-800 dark:text-ink-300 dark:ring-ink-500/20',
    dot: 'bg-ink-400',
    solid: 'bg-ink-600',
    soft: 'bg-ink-500/10 text-ink-700 dark:text-ink-300',
  },
  violet: {
    badge:
      'bg-violet-50 text-violet-700 ring-violet-600/20 dark:bg-violet-500/10 dark:text-violet-300 dark:ring-violet-400/20',
    dot: 'bg-violet-500',
    solid: 'bg-violet-600',
    soft: 'bg-violet-500/10 text-violet-700 dark:text-violet-300',
  },
  teal: {
    badge:
      'bg-teal-50 text-teal-700 ring-teal-600/20 dark:bg-teal-500/10 dark:text-teal-300 dark:ring-teal-400/20',
    dot: 'bg-teal-500',
    solid: 'bg-teal-600',
    soft: 'bg-teal-500/10 text-teal-700 dark:text-teal-300',
  },
  rose: {
    badge:
      'bg-rose-50 text-rose-700 ring-rose-600/20 dark:bg-rose-500/10 dark:text-rose-300 dark:ring-rose-400/20',
    dot: 'bg-rose-500',
    solid: 'bg-rose-600',
    soft: 'bg-rose-500/10 text-rose-700 dark:text-rose-300',
  },
}

export const statusColorChoices: StatusColor[] = [
  'green',
  'red',
  'amber',
  'blue',
  'violet',
  'teal',
  'rose',
  'slate',
]

export function percentageTone(value: number, threshold = 75) {
  if (value >= threshold) return 'text-emerald-600 dark:text-emerald-400'
  if (value >= threshold - 15) return 'text-amber-600 dark:text-amber-400'
  return 'text-rose-600 dark:text-rose-400'
}

export function percentageBar(value: number) {
  if (value >= 75) return 'bg-emerald-500'
  if (value >= 60) return 'bg-amber-500'
  return 'bg-rose-500'
}

export function slugify(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
}
