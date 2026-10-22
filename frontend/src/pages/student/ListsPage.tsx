import { useEffect, useState } from 'react'
import {
  CalendarClock,
  ClipboardList,
  MessageSquareText,
  Search,
  Sparkles,
  UserRound,
} from 'lucide-react'
import { ListStatusBadge } from '@/components/ui/Badge'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useDebounce } from '@/hooks/useDebounce'
import { customListsApi } from '@/services/api'
import { cn, formatDate, formatDateTime, listColorClasses } from '@/lib/utils'
import type { StudentList } from '@/types'

function dueState(dueDate: string | null) {
  if (!dueDate) return { label: 'No due date', tone: 'text-ink-400', urgent: false }
  const due = new Date(`${dueDate}T23:59:59`)
  const now = new Date()
  const days = Math.ceil((due.getTime() - now.getTime()) / 86_400_000)
  if (days < 0) return { label: 'Overdue', tone: 'text-rose-600 dark:text-rose-400', urgent: true }
  if (days === 0) return { label: 'Due today', tone: 'text-amber-600 dark:text-amber-400', urgent: true }
  if (days <= 3)
    return {
      label: `Due in ${days} day${days === 1 ? '' : 's'}`,
      tone: 'text-amber-600 dark:text-amber-400',
      urgent: true,
    }
  return { label: formatDate(dueDate, 'dd MMM yyyy'), tone: 'text-ink-500 dark:text-ink-400', urgent: false }
}

export function StudentListsPage() {
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [selected, setSelected] = useState<StudentList | null>(null)
  const debouncedSearch = useDebounce(search)

  const { data, loading, error, refresh } = useApiQuery(
    () => customListsApi.myLists({ search: debouncedSearch || undefined, page, page_size: 9 }),
    [debouncedSearch, page],
  )

  useEffect(() => {
    setPage(1)
  }, [debouncedSearch])

  return (
    <div className="space-y-5">
      <PageHeader
        title="My lists"
        description="Track the statuses your faculty recorded for you on shared class lists."
      />

      <div className="relative sm:max-w-sm">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search lists…"
          aria-label="Search my lists"
          className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
        />
      </div>

      {loading && !data ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3].map((item) => (
            <Skeleton key={item} className="h-52 rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={() => void refresh()} />
        </Card>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={search ? 'No lists match your search' : 'No shared lists yet'}
            description={
              search
                ? 'Try a different keyword or clear the search.'
                : 'When faculty share a list with you, it will appear here with your status.'
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((list) => {
              const due = dueState(list.due_date)
              return (
                <button
                  key={list.id}
                  type="button"
                  onClick={() => setSelected(list)}
                  className="group flex h-full flex-col rounded-2xl border border-ink-200/80 bg-white p-5 text-left shadow-card transition hover:-translate-y-0.5 hover:shadow-card-hover dark:border-ink-800 dark:bg-ink-900"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                      <ClipboardList className="h-5 w-5" />
                    </div>
                    <ListStatusBadge status={list.my_status} options={list.status_options} />
                  </div>
                  <h3 className="mt-3 line-clamp-2 text-sm font-semibold text-ink-900 dark:text-white">
                    {list.title}
                  </h3>
                  <p className="mt-1 text-[11px] text-ink-500 dark:text-ink-400">
                    {list.class_name}
                  </p>
                  {list.description ? (
                    <p className="mt-2 line-clamp-2 text-[11px] leading-5 text-ink-500 dark:text-ink-400">
                      {list.description}
                    </p>
                  ) : null}
                  <div className="mt-auto space-y-2 pt-4">
                    {list.my_remarks ? (
                      <div className="flex items-start gap-1.5 rounded-lg bg-ink-50 px-2.5 py-2 text-[10px] leading-4 text-ink-600 dark:bg-ink-800/60 dark:text-ink-300">
                        <MessageSquareText className="mt-0.5 h-3 w-3 shrink-0 text-ink-400" />
                        <span className="line-clamp-2">{list.my_remarks}</span>
                      </div>
                    ) : null}
                    <div className="flex items-center justify-between gap-2 border-t border-ink-100 pt-2.5 text-[10px] dark:border-ink-800">
                      <span className={cn('font-semibold', due.tone)}>{due.label}</span>
                      <span className="text-ink-400">
                        Updated {formatDate(list.updated_at, 'dd MMM')}
                      </span>
                    </div>
                  </div>
                </button>
              )
            })}
          </div>
          <Card>
            <Pagination
              page={data.page}
              pageSize={data.page_size}
              total={data.total}
              onPageChange={setPage}
            />
          </Card>
        </>
      )}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelected(null)}
        title={selected?.title ?? 'List detail'}
        description={selected ? selected.class_name : undefined}
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
            <div className="flex flex-wrap items-center gap-2">
              <ListStatusBadge status={selected.my_status} options={selected.status_options} />
              {selected.due_date ? (
                <span
                  className={cn(
                    'inline-flex items-center gap-1 text-[11px] font-medium',
                    dueState(selected.due_date).tone,
                  )}
                >
                  <CalendarClock className="h-3.5 w-3.5" />
                  {dueState(selected.due_date).label}
                </span>
              ) : null}
            </div>

            {selected.description ? (
              <div>
                <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  Description
                </h3>
                <p className="whitespace-pre-wrap text-[13px] leading-6 text-ink-600 dark:text-ink-300">
                  {selected.description}
                </p>
              </div>
            ) : null}

            <div className="rounded-xl border border-ink-200 p-3.5 dark:border-ink-700">
              <h3 className="mb-2 flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                <Sparkles className="h-3.5 w-3.5" /> Status options
              </h3>
              <div className="flex flex-wrap gap-1.5">
                {selected.status_options.map((option) => {
                  const palette = listColorClasses[option.color]
                  return (
                    <span
                      key={option.key}
                      className={cn(
                        'inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset',
                        palette.badge,
                        option.key === selected.my_status && 'ring-2',
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', palette.dot)} />
                      {option.label}
                      {option.key === selected.my_status ? ' · yours' : ''}
                    </span>
                  )
                })}
              </div>
            </div>

            <div>
              <h3 className="mb-1 text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                Faculty remarks
              </h3>
              {selected.my_remarks ? (
                <p className="rounded-xl bg-ink-50 px-3.5 py-3 text-[13px] leading-6 text-ink-600 dark:bg-ink-800/60 dark:text-ink-300">
                  {selected.my_remarks}
                </p>
              ) : (
                <p className="rounded-xl border border-dashed border-ink-200 px-3.5 py-3 text-[11px] text-ink-400 dark:border-ink-700">
                  No remarks were added for you on this list.
                </p>
              )}
            </div>

            <div className="flex flex-col gap-2 border-t border-ink-100 pt-4 text-[11px] text-ink-500 dark:border-ink-800 dark:text-ink-400">
              <div className="flex items-center gap-2">
                <UserRound className="h-3.5 w-3.5 text-ink-400" />
                Shared by {selected.creator_name}
              </div>
              <div className="flex items-center gap-2">
                <CalendarClock className="h-3.5 w-3.5 text-ink-400" />
                Last updated {formatDateTime(selected.updated_at)}
              </div>
            </div>
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
