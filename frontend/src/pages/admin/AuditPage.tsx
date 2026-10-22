import { useEffect, useMemo, useState } from 'react'
import {
  CalendarClock,
  ClipboardList,
  FileClock,
  GraduationCap,
  History,
  Search,
  Settings2,
  ShieldCheck,
  UserCog,
  Users,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { useDebounce } from '@/hooks/useDebounce'
import { useApiQuery } from '@/hooks/useApiQuery'
import { auditApi } from '@/services/api'
import { cn, formatDateTime, fromNow, titleCase } from '@/lib/utils'
import type { AuditLog } from '@/types'

const entityMeta: Record<
  string,
  { label: string; icon: typeof Users; tone: string }
> = {
  attendance_session: {
    label: 'Attendance session',
    icon: CalendarClock,
    tone: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  },
  attendance_record: {
    label: 'Attendance record',
    icon: ClipboardList,
    tone: 'bg-sky-50 text-sky-600 dark:bg-sky-500/10 dark:text-sky-300',
  },
  student: {
    label: 'Student',
    icon: Users,
    tone: 'bg-emerald-50 text-emerald-600 dark:bg-emerald-500/10 dark:text-emerald-300',
  },
  class: {
    label: 'Class',
    icon: GraduationCap,
    tone: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  },
  subject: {
    label: 'Subject',
    icon: GraduationCap,
    tone: 'bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300',
  },
  user: {
    label: 'User',
    icon: UserCog,
    tone: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
  },
  faculty_assignment: {
    label: 'Faculty assignment',
    icon: ShieldCheck,
    tone: 'bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300',
  },
  custom_list: {
    label: 'Custom list',
    icon: FileClock,
    tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  },
  custom_list_entry: {
    label: 'List entry',
    icon: FileClock,
    tone: 'bg-amber-50 text-amber-600 dark:bg-amber-500/10 dark:text-amber-300',
  },
  settings: {
    label: 'Settings',
    icon: Settings2,
    tone: 'bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300',
  },
}

const actionTones: Record<
  string,
  'success' | 'info' | 'warning' | 'danger' | 'neutral' | 'brand'
> = {
  created: 'success',
  updated: 'info',
  deleted: 'danger',
  archived: 'warning',
  unarchived: 'success',
  finalized: 'success',
  unlocked: 'warning',
  corrected: 'info',
  marked: 'info',
  attendance_saved: 'info',
  bulk_status_updated: 'info',
  entries_added: 'success',
  student_account_created: 'success',
  students_imported: 'success',
  password_reset: 'warning',
  password_changed: 'warning',
  registered: 'brand',
}

const entityOptions = Object.entries(entityMeta).map(([value, meta]) => ({
  value,
  label: meta.label,
}))

const actionOptions = Object.keys(actionTones).map((value) => ({
  value,
  label: titleCase(value),
}))

function ValueBlock({ title, value }: { title: string; value: Record<string, unknown> | null }) {
  return (
    <div>
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
        {title}
      </h3>
      {value && Object.keys(value).length > 0 ? (
        <pre className="max-h-52 overflow-auto rounded-xl bg-ink-50 p-3 text-[11px] leading-5 text-ink-700 dark:bg-ink-950 dark:text-ink-300">
          {JSON.stringify(value, null, 2)}
        </pre>
      ) : (
        <p className="rounded-xl border border-dashed border-ink-200 px-3 py-4 text-center text-[11px] text-ink-400 dark:border-ink-700">
          No recorded values
        </p>
      )}
    </div>
  )
}

export function AuditPage() {
  const [search, setSearch] = useState('')
  const [entityFilter, setEntityFilter] = useState('')
  const [actionFilter, setActionFilter] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<AuditLog | null>(null)
  const debouncedSearch = useDebounce(search)

  const { data, loading, error, refresh } = useApiQuery(
    () =>
      auditApi.list({
        entity_type: entityFilter || undefined,
        action: actionFilter || undefined,
        search: debouncedSearch || undefined,
        page,
        page_size: 25,
      }),
    [entityFilter, actionFilter, debouncedSearch, page],
  )

  useEffect(() => {
    setPage(1)
  }, [entityFilter, actionFilter, debouncedSearch])

  const hasFilters = Boolean(search || entityFilter || actionFilter)
  const totalChanges = useMemo(
    () =>
      data?.items.reduce(
        (count, item) =>
          count + (item.previous_value ? 1 : 0) + (item.new_value ? 1 : 0),
        0,
      ) ?? 0,
    [data],
  )

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        description="An immutable trail of administrative actions across the workspace."
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 xl:flex-row xl:items-center dark:border-ink-800">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search actor, entity or action…"
              aria-label="Search audit log"
              className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={entityFilter}
              onChange={(event) => setEntityFilter(event.target.value)}
              aria-label="Filter by entity"
              className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
            >
              <option value="">All entities</option>
              {entityOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={actionFilter}
              onChange={(event) => setActionFilter(event.target.value)}
              aria-label="Filter by action"
              className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
            >
              <option value="">All actions</option>
              {actionOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            {hasFilters ? (
              <button
                type="button"
                onClick={() => {
                  setSearch('')
                  setEntityFilter('')
                  setActionFilter('')
                }}
                className="h-10 rounded-xl px-3 text-xs font-semibold text-ink-500 transition hover:bg-ink-100 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800"
              >
                Clear filters
              </button>
            ) : null}
          </div>
        </div>

        {loading && !data ? (
          <TableSkeleton rows={8} cols={4} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void refresh()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={History}
            title="No activity found"
            description={
              hasFilters
                ? 'No audit entries match these filters. Try widening your search.'
                : 'Administrative actions will appear here as they happen.'
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[820px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-400 dark:border-ink-800">
                    <th className="px-5 py-3 font-semibold">Actor</th>
                    <th className="px-5 py-3 font-semibold">Action</th>
                    <th className="px-5 py-3 font-semibold">Entity</th>
                    <th className="px-5 py-3 font-semibold">When</th>
                    <th className="px-5 py-3 text-right font-semibold">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {data.items.map((entry) => {
                    const meta = entityMeta[entry.entity_type] ?? {
                      label: titleCase(entry.entity_type),
                      icon: FileClock,
                      tone: 'bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300',
                    }
                    const Icon = meta.icon
                    return (
                      <tr
                        key={entry.id}
                        className="cursor-pointer hover:bg-ink-50/60 dark:hover:bg-ink-800/30"
                        onClick={() => setSelected(entry)}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={entry.actor_name ?? 'System'} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-ink-900 dark:text-white">
                                {entry.actor_name ?? 'System'}
                              </p>
                              <p className="text-[10px] text-ink-400">
                                {entry.actor_user_id ? `User #${entry.actor_user_id}` : 'Automated'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={actionTones[entry.action] ?? 'neutral'}>
                            {titleCase(entry.action)}
                          </Badge>
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span
                              className={cn(
                                'flex h-7 w-7 items-center justify-center rounded-lg',
                                meta.tone,
                              )}
                            >
                              <Icon className="h-3.5 w-3.5" />
                            </span>
                            <div className="min-w-0">
                              <p className="truncate text-[12px] font-medium text-ink-700 dark:text-ink-200">
                                {meta.label}
                              </p>
                              <p className="text-[10px] text-ink-400">#{entry.entity_id}</p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-[12px] text-ink-600 dark:text-ink-300">
                            {fromNow(entry.created_at)}
                          </p>
                          <p className="text-[10px] text-ink-400">
                            {formatDateTime(entry.created_at)}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation()
                              setSelected(entry)
                            }}
                            className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                          >
                            View changes
                          </button>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <div className="flex flex-col border-t border-ink-100 sm:flex-row sm:items-center sm:justify-between dark:border-ink-800">
              <p className="px-5 pt-3 text-[11px] text-ink-400 sm:pt-0">
                {totalChanges} recorded change{totalChanges === 1 ? '' : 's'} across this page
              </p>
              <Pagination
                page={data.page}
                pageSize={data.page_size}
                total={data.total}
                onPageChange={setPage}
                className="flex-1"
              />
            </div>
          </>
        )}
      </Card>

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title="Audit entry"
        description={
          selected
            ? `${titleCase(selected.action)} · ${entityMeta[selected.entity_type]?.label ?? titleCase(selected.entity_type)} #${selected.entity_id}`
            : undefined
        }
        size="lg"
        footer={
          <button
            type="button"
            onClick={() => setSelected(null)}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Close
          </button>
        }
      >
        {selected ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-3 rounded-xl bg-ink-50 p-3 dark:bg-ink-800/50">
              <Avatar name={selected.actor_name ?? 'System'} />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-ink-900 dark:text-white">
                  {selected.actor_name ?? 'System'}
                </p>
                <p className="text-[11px] text-ink-500 dark:text-ink-400">
                  {formatDateTime(selected.created_at)} · Entry #{selected.id}
                </p>
              </div>
              <Badge tone={actionTones[selected.action] ?? 'neutral'} className="ml-auto">
                {titleCase(selected.action)}
              </Badge>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <ValueBlock title="Previous value" value={selected.previous_value} />
              <ValueBlock title="New value" value={selected.new_value} />
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
