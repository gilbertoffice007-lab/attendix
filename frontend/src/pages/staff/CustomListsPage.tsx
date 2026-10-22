import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Archive,
  ArchiveRestore,
  ArrowUpRight,
  CalendarClock,
  ClipboardList,
  Eye,
  EyeOff,
  Plus,
  Search,
  UsersRound,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button, buttonStyles } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/Feedback'
import { ConfirmDialog } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useDebounce } from '@/hooks/useDebounce'
import { classesApi, customListsApi } from '@/services/api'
import { getErrorMessage } from '@/services/http'
import { cn, formatDate, fromNow, listColorClasses } from '@/lib/utils'
import type { CustomList } from '@/types'

export function CustomListsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const base = user ? `/${user.role}` : '/faculty'
  const [search, setSearch] = useState('')
  const [classId, setClassId] = useState<number | ''>('')
  const [archived, setArchived] = useState(false)
  const [page, setPage] = useState(1)
  const [target, setTarget] = useState<CustomList | null>(null)
  const [working, setWorking] = useState(false)
  const debouncedSearch = useDebounce(search)

  const { data: classes } = useApiQuery(classesApi.list, [])
  const { data, loading, error, refresh } = useApiQuery(
    () =>
      customListsApi.list({
        search: debouncedSearch || undefined,
        class_id: classId || undefined,
        archived,
        page,
        page_size: 12,
      }),
    [debouncedSearch, classId, archived, page],
  )

  useEffect(() => {
    setPage(1)
  }, [archived, classId, debouncedSearch])

  const toggleArchive = async () => {
    if (!target) return
    setWorking(true)
    try {
      await customListsApi.archive(target.id, !target.is_archived)
      toast.success(target.is_archived ? 'List restored' : 'List archived', target.title)
      setTarget(null)
      await refresh(true)
    } catch (caught) {
      toast.error('Could not update list', getErrorMessage(caught))
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Custom student lists"
        description="Track fee payments, document submissions, eligibility or anything your class needs."
        actions={
          <Link to={`${base}/custom-lists/new`} className={buttonStyles('primary', 'md')}>
            <Plus className="h-4 w-4" /> New list
          </Link>
        }
      />

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="inline-flex rounded-xl border border-ink-200 bg-white p-1 shadow-sm dark:border-ink-700 dark:bg-ink-900">
          <button
            type="button"
            onClick={() => setArchived(false)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              !archived
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-white',
            )}
          >
            Active lists
          </button>
          <button
            type="button"
            onClick={() => setArchived(true)}
            className={cn(
              'rounded-lg px-3 py-1.5 text-xs font-semibold transition',
              archived
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-white',
            )}
          >
            Archived
          </button>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative sm:w-64">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search lists…"
              aria-label="Search custom lists"
              className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-sm shadow-sm placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-white"
            />
          </div>
          <select
            value={classId}
            onChange={(event) => setClassId(event.target.value ? Number(event.target.value) : '')}
            aria-label="Filter lists by class"
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
          >
            <option value="">All classes</option>
            {classes?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · Sem {item.semester}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && !data ? (
        <Card>
          <TableSkeleton rows={6} cols={3} />
        </Card>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={() => void refresh()} />
        </Card>
      ) : !data || data.items.length === 0 ? (
        <Card>
          <EmptyState
            icon={ClipboardList}
            title={archived ? 'No archived lists' : 'No custom lists yet'}
            description={
              archived
                ? 'Lists you archive will appear here and can be restored at any time.'
                : search || classId
                  ? 'No lists match these filters. Try clearing them.'
                  : 'Create a list to track payments, documents, eligibility or anything else.'
            }
            action={
              !archived ? (
                <Link to={`${base}/custom-lists/new`} className={buttonStyles('primary', 'md')}>
                  <Plus className="h-4 w-4" /> Create your first list
                </Link>
              ) : undefined
            }
          />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {data.items.map((list) => (
              <div
                key={list.id}
                className="group flex flex-col rounded-2xl border border-ink-200/80 bg-white p-5 shadow-card transition hover:shadow-card-hover dark:border-ink-800 dark:bg-ink-900"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                    <ClipboardList className="h-5 w-5" />
                  </div>
                  <div className="flex items-center gap-1.5">
                    {list.visible_to_students ? (
                      <Badge tone="info">
                        <Eye className="h-3 w-3" /> Visible
                      </Badge>
                    ) : (
                      <Badge tone="neutral">
                        <EyeOff className="h-3 w-3" /> Staff only
                      </Badge>
                    )}
                    <Badge tone={list.is_archived ? 'neutral' : 'success'} dot>
                      {list.is_archived ? 'Archived' : 'Active'}
                    </Badge>
                  </div>
                </div>

                <Link to={`${base}/custom-lists/${list.id}`} className="mt-3.5 block">
                  <h2 className="line-clamp-1 text-[15px] font-semibold text-ink-900 transition group-hover:text-brand-700 dark:text-white dark:group-hover:text-brand-300">
                    {list.title}
                  </h2>
                  <p className="mt-1 line-clamp-2 min-h-[32px] text-xs leading-4 text-ink-500 dark:text-ink-400">
                    {list.description || 'No description added.'}
                  </p>
                </Link>

                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500 dark:text-ink-400">
                  <span className="inline-flex items-center gap-1">
                    <UsersRound className="h-3 w-3" /> {list.entry_count} students
                  </span>
                  <span className="truncate">{list.class_name.split(' · ')[0]}</span>
                  {list.due_date ? (
                    <span className="inline-flex items-center gap-1">
                      <CalendarClock className="h-3 w-3" /> Due {formatDate(list.due_date, 'dd MMM')}
                    </span>
                  ) : null}
                </div>

                <div className="mt-3 flex flex-wrap gap-1.5">
                  {list.status_options.map((option) => (
                    <span
                      key={option.key}
                      className={cn(
                        'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium',
                        listColorClasses[option.color].soft,
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', listColorClasses[option.color].dot)} />
                      {option.label}
                    </span>
                  ))}
                </div>

                <div className="mt-4 flex items-center justify-between border-t border-ink-100 pt-3 dark:border-ink-800">
                  <span className="text-[10px] text-ink-400">
                    Updated {fromNow(list.updated_at)}
                  </span>
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setTarget(list)}
                      aria-label={list.is_archived ? 'Restore list' : 'Archive list'}
                      title={list.is_archived ? 'Restore list' : 'Archive list'}
                    >
                      {list.is_archived ? (
                        <ArchiveRestore className="h-3.5 w-3.5" />
                      ) : (
                        <Archive className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Link
                      to={`${base}/custom-lists/${list.id}`}
                      className={buttonStyles('secondary', 'sm')}
                    >
                      Open <ArrowUpRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            ))}
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

      <ConfirmDialog
        open={Boolean(target)}
        onClose={() => setTarget(null)}
        onConfirm={toggleArchive}
        loading={working}
        tone={target?.is_archived ? 'success' : 'danger'}
        title={target?.is_archived ? 'Restore this list?' : 'Archive this list?'}
        confirmLabel={target?.is_archived ? 'Restore list' : 'Archive list'}
        description={
          target?.is_archived
            ? `“${target?.title}” will return to active lists. Entries and history are preserved.`
            : `“${target?.title}” will be locked and hidden from the active list. You can restore it at any time.`
        }
      />
    </div>
  )
}
