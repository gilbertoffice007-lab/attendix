import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  CalendarCheck2,
  CalendarPlus,
  Clock,
  Download,
  Eye,
  Filter,
  History,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button, buttonStyles } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { attendanceApi, classesApi, subjectsApi } from '@/services/api'
import { getErrorMessage } from '@/services/http'
import { attendanceMeta, cn, formatDate } from '@/lib/utils'

const countDots = [
  { key: 'present', label: 'Present' },
  { key: 'absent', label: 'Absent' },
  { key: 'od', label: 'On duty' },
  { key: 'leave', label: 'Leave' },
  { key: 'unmarked', label: 'Unmarked' },
] as const

export function AttendanceListPage() {
  const { user } = useAuth()
  const toast = useToast()
  const base = user ? `/${user.role}` : '/faculty'
  const [classId, setClassId] = useState<number | ''>('')
  const [subjectId, setSubjectId] = useState<number | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'finalized' | 'draft'>('all')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState<string | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const { data: classes } = useApiQuery(classesApi.list, [])
  const { data: subjects } = useApiQuery(
    () => subjectsApi.list(classId || undefined),
    [classId],
  )
  const { data, loading, error, refresh } = useApiQuery(
    () =>
      attendanceApi.listSessions({
        class_id: classId || undefined,
        subject_id: subjectId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        finalized: statusFilter === 'all' ? undefined : statusFilter === 'finalized',
        page,
        page_size: 20,
      }),
    [classId, subjectId, dateFrom, dateTo, statusFilter, page],
  )

  useEffect(() => {
    setSubjectId('')
  }, [classId])

  const newSessionQuery = new URLSearchParams()
  if (classId) newSessionQuery.set('class_id', String(classId))
  if (subjectId) newSessionQuery.set('subject_id', String(subjectId))

  const exportSession = async (id: number, format: 'csv' | 'xlsx') => {
    const key = `${id}-${format}`
    setExporting(key)
    try {
      await attendanceApi.exportSession(id, format)
    } catch (caught) {
      toast.error('Export failed', getErrorMessage(caught))
    } finally {
      setExporting(null)
    }
  }

  const filtersActive = Boolean(classId || subjectId || dateFrom || dateTo || statusFilter !== 'all')

  return (
    <div className="space-y-5">
      <PageHeader
        title="Attendance"
        description="Every register in one ledger. Finalize sessions to include them in student reports."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => setShowFilters((value) => !value)}
              className="sm:hidden"
            >
              <Filter className="h-4 w-4" /> Filters
            </Button>
            <Link
              to={`${base}/attendance/new${newSessionQuery.toString() ? `?${newSessionQuery.toString()}` : ''}`}
              className={buttonStyles('primary', 'md')}
            >
              <CalendarPlus className="h-4 w-4" /> New session
            </Link>
          </>
        }
      />

      <Card className={cn(!showFilters && 'hidden sm:block')}>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-6">
          <select
            value={classId}
            onChange={(event) => {
              setClassId(event.target.value ? Number(event.target.value) : '')
              setPage(1)
            }}
            aria-label="Filter by class"
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
          >
            <option value="">All classes</option>
            {classes?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · Sem {item.semester}
              </option>
            ))}
          </select>
          <select
            value={subjectId}
            onChange={(event) => {
              setSubjectId(event.target.value ? Number(event.target.value) : '')
              setPage(1)
            }}
            aria-label="Filter by subject"
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
          >
            <option value="">All subjects</option>
            {subjects?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.subject_code} · {item.name}
              </option>
            ))}
          </select>
          <input
            type="date"
            aria-label="From date"
            value={dateFrom}
            onChange={(event) => {
              setDateFrom(event.target.value)
              setPage(1)
            }}
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
          />
          <input
            type="date"
            aria-label="To date"
            value={dateTo}
            onChange={(event) => {
              setDateTo(event.target.value)
              setPage(1)
            }}
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
          />
          <select
            value={statusFilter}
            onChange={(event) => {
              setStatusFilter(event.target.value as typeof statusFilter)
              setPage(1)
            }}
            aria-label="Filter by register status"
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
          >
            <option value="all">All statuses</option>
            <option value="finalized">Finalized</option>
            <option value="draft">Drafts</option>
          </select>
          <Button
            variant="ghost"
            onClick={() => {
              setClassId('')
              setSubjectId('')
              setDateFrom('')
              setDateTo('')
              setStatusFilter('all')
              setPage(1)
            }}
            disabled={!filtersActive}
          >
            Reset filters
          </Button>
        </div>
      </Card>

      <Card>
        {loading && !data ? (
          <TableSkeleton rows={8} cols={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void refresh()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={History}
            title="No attendance sessions"
            description={
              filtersActive
                ? 'No registers match these filters. Try a wider date range or another class.'
                : 'Create a session, mark the roster and finalize it to start reporting.'
            }
            action={
              <Link to={`${base}/attendance/new`} className={buttonStyles('primary', 'md')}>
                <CalendarPlus className="h-4 w-4" /> Take attendance
              </Link>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-400 dark:border-ink-800">
                    <th className="px-5 py-3 font-semibold">Date</th>
                    <th className="px-5 py-3 font-semibold">Class & subject</th>
                    <th className="px-5 py-3 font-semibold">Register</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Recorded by</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {data.items.map((session) => (
                    <tr
                      key={session.id}
                      className="transition-colors hover:bg-ink-50/60 dark:hover:bg-ink-800/30"
                    >
                      <td className="px-5 py-3.5">
                        <div className="flex items-center gap-3">
                          <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-ink-100 text-ink-600 dark:bg-ink-800 dark:text-ink-300">
                            <span className="text-[9px] font-semibold uppercase leading-none">
                              {formatDate(session.session_date, 'MMM')}
                            </span>
                            <span className="text-sm font-semibold leading-tight">
                              {formatDate(session.session_date, 'dd')}
                            </span>
                          </div>
                          <div>
                            <p className="text-[12px] font-medium text-ink-700 dark:text-ink-200">
                              {formatDate(session.session_date, 'EEE, dd MMM yyyy')}
                            </p>
                            <p className="flex items-center gap-1 text-[11px] text-ink-500 dark:text-ink-400">
                              <Clock className="h-3 w-3" /> Session {session.session_number}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-[13px] font-semibold text-ink-900 dark:text-white">
                          {session.subject_name}
                        </p>
                        <p className="text-[11px] text-ink-500 dark:text-ink-400">
                          {session.subject_code} · {session.class_name}
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                          {countDots.map((dot) => (
                            <span
                              key={dot.key}
                              className="inline-flex items-center gap-1 text-[10px] font-medium text-ink-500 dark:text-ink-400"
                              title={dot.label}
                            >
                              <span
                                className={cn(
                                  'h-1.5 w-1.5 rounded-full',
                                  dot.key === 'unmarked'
                                    ? 'bg-ink-300 dark:bg-ink-600'
                                    : attendanceMeta[dot.key].dot,
                                )}
                              />
                              {session.counts[dot.key]}
                            </span>
                          ))}
                        </div>
                        <p className="mt-1 text-[10px] text-ink-400">
                          {session.counts.total} students
                        </p>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge tone={session.is_finalized ? 'success' : 'warning'} dot>
                          {session.is_finalized ? 'Finalized' : 'Draft'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3.5 text-[12px] text-ink-500 dark:text-ink-400">
                        {session.created_by_name}
                      </td>
                      <td className="px-5 py-3.5">
                        <div className="flex items-center justify-end gap-1">
                          <Link
                            to={`${base}/attendance/${session.id}`}
                            className={buttonStyles('secondary', 'sm')}
                          >
                            <Eye className="h-3.5 w-3.5" /> Open
                          </Link>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void exportSession(session.id, 'csv')}
                            loading={exporting === `${session.id}-csv`}
                            title="Download CSV"
                          >
                            <Download className="h-3.5 w-3.5" /> CSV
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void exportSession(session.id, 'xlsx')}
                            loading={exporting === `${session.id}-xlsx`}
                            title="Download Excel"
                          >
                            XLSX
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-ink-100 lg:hidden dark:divide-ink-800">
              {data.items.map((session) => (
                <li key={session.id} className="p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 flex-col items-center justify-center rounded-xl bg-ink-100 dark:bg-ink-800">
                        <span className="text-[9px] font-semibold uppercase text-ink-500">
                          {formatDate(session.session_date, 'MMM')}
                        </span>
                        <span className="text-sm font-semibold text-ink-800 dark:text-ink-100">
                          {formatDate(session.session_date, 'dd')}
                        </span>
                      </div>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">
                          {session.subject_name}
                        </p>
                        <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                          {session.class_name} · Session {session.session_number}
                        </p>
                      </div>
                    </div>
                    <Badge tone={session.is_finalized ? 'success' : 'warning'} dot>
                      {session.is_finalized ? 'Final' : 'Draft'}
                    </Badge>
                  </div>
                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-ink-500 dark:text-ink-400">
                    <span className="text-emerald-600 dark:text-emerald-400">
                      {session.counts.present} present
                    </span>
                    <span className="text-rose-600 dark:text-rose-400">
                      {session.counts.absent} absent
                    </span>
                    <span>{session.counts.od} OD</span>
                    <span>{session.counts.leave} leave</span>
                    <span className="text-ink-400">{session.counts.unmarked} unmarked</span>
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <Link
                      to={`${base}/attendance/${session.id}`}
                      className={buttonStyles('secondary', 'sm', 'flex-1')}
                    >
                      <Eye className="h-3.5 w-3.5" /> Open register
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void exportSession(session.id, 'csv')}
                      loading={exporting === `${session.id}-csv`}
                    >
                      <Download className="h-3.5 w-3.5" /> CSV
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => void exportSession(session.id, 'xlsx')}
                      loading={exporting === `${session.id}-xlsx`}
                    >
                      XLSX
                    </Button>
                  </div>
                </li>
              ))}
            </ul>

            <Pagination
              page={data.page}
              pageSize={data.page_size}
              total={data.total}
              onPageChange={setPage}
              className="border-t border-ink-100 dark:border-ink-800"
            />
          </>
        )}
      </Card>

      {!data || data.items.length === 0 ? (
        <div className="flex items-center gap-2 rounded-xl border border-dashed border-ink-200 px-4 py-3 text-xs text-ink-500 dark:border-ink-800 dark:text-ink-400">
          <CalendarCheck2 className="h-4 w-4 text-ink-400" />
          Only finalized sessions feed attendance percentages. Drafts remain editable.
        </div>
      ) : null}
    </div>
  )
}
