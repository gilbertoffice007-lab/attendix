import { useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CalendarCheck2,
  CheckCircle2,
  Clock,
  Search,
  TrendingDown,
  XCircle,
} from 'lucide-react'
import { AttendanceBadge } from '@/components/ui/Badge'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatCard } from '@/components/ui/StatCard'
import { useApiQuery } from '@/hooks/useApiQuery'
import { attendanceApi } from '@/services/api'
import {
  attendanceMeta,
  cn,
  formatDate,
  formatPercent,
  percentageTone,
} from '@/lib/utils'
import type { AttendanceStatus } from '@/types'

const statusFilters: { value: AttendanceStatus | ''; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'present', label: 'Present' },
  { value: 'absent', label: 'Absent' },
  { value: 'od', label: 'On duty' },
  { value: 'leave', label: 'Leave' },
]

export function StudentAttendancePage() {
  const { data, loading, error, refresh } = useApiQuery(attendanceApi.myReport, [])
  const [subjectId, setSubjectId] = useState('')
  const [status, setStatus] = useState<AttendanceStatus | ''>('')
  const [search, setSearch] = useState('')
  const [includePending, setIncludePending] = useState(true)
  const [page, setPage] = useState(1)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const pageSize = 12

  const filtered = useMemo(() => {
    if (!data) return []
    const term = search.trim().toLowerCase()
    return data.history.filter((row) => {
      if (subjectId && String(row.subject_id) !== subjectId) return false
      if (status && row.status !== status) return false
      if (!includePending && row.is_finalized === false) return false
      if (
        term &&
        !row.subject_name.toLowerCase().includes(term) &&
        !(row.remarks ?? '').toLowerCase().includes(term)
      ) {
        return false
      }
      return true
    })
  }, [data, subjectId, status, search, includePending])

  useEffect(() => {
    setPage(1)
  }, [subjectId, status, search, includePending])

  const paged = filtered.slice((page - 1) * pageSize, page * pageSize)
  const selected = data?.history.find((row) => row.session_id === selectedId)
  const pendingCount = data?.history.filter((row) => row.is_finalized === false).length ?? 0

  const counts = useMemo(() => {
    const base: Record<AttendanceStatus, number> = { present: 0, absent: 0, od: 0, leave: 0 }
    for (const row of data?.history ?? []) base[row.status] += 1
    return base
  }, [data])

  return (
    <div className="space-y-5">
      <PageHeader
        title="My attendance"
        description="Every finalized session, subject-wise progress and the policy behind the numbers."
      />

      {loading && !data ? (
        <div className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-4">
            {[0, 1, 2, 3].map((item) => (
              <Skeleton key={item} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-96 w-full rounded-2xl" />
        </div>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={() => void refresh()} />
        </Card>
      ) : data ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Overall attendance"
              value={formatPercent(data.percentage)}
              hint={`${data.attended} of ${data.eligible} sessions`}
              icon={CalendarCheck2}
              tone={data.below_threshold ? 'rose' : 'green'}
              footer={<ProgressBar value={data.percentage} threshold={data.threshold} showThreshold />}
            />
            <StatCard
              label="Present"
              value={counts.present}
              hint="Includes all finalized and pending marks"
              icon={CheckCircle2}
              tone="green"
            />
            <StatCard
              label="On duty / leave"
              value={counts.od + counts.leave}
              hint={`${counts.od} OD · ${counts.leave} leave`}
              icon={Clock}
              tone="violet"
            />
            <StatCard
              label="Absences"
              value={data.absences}
              hint={`Requirement: ${data.threshold}%`}
              icon={data.below_threshold ? TrendingDown : XCircle}
              tone={data.below_threshold ? 'rose' : 'amber'}
            />
          </div>

          {data.below_threshold ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <p className="text-[12px] leading-5">
                Your attendance is below the {data.threshold}% requirement. Only finalized
                sessions count toward this total, so pending classes may still change your
                percentage.
              </p>
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[1fr_1.6fr]">
            <Card>
              <CardHeader
                title="Subject breakdown"
                description={`${data.subjects.length} subjects in ${data.class_name}`}
              />
              <CardContent className="space-y-4">
                {data.subjects.length === 0 ? (
                  <p className="py-6 text-center text-xs text-ink-400">
                    No subjects are configured for your class yet.
                  </p>
                ) : (
                  [...data.subjects]
                    .sort((a, b) => a.percentage - b.percentage)
                    .map((subject) => (
                      <button
                        key={subject.subject_id}
                        type="button"
                        onClick={() =>
                          setSubjectId((current) =>
                            current === String(subject.subject_id)
                              ? ''
                              : String(subject.subject_id),
                          )
                        }
                        className={cn(
                          'w-full rounded-xl border px-3 py-2.5 text-left transition',
                          subjectId === String(subject.subject_id)
                            ? 'border-brand-300 bg-brand-50/60 dark:border-brand-500/40 dark:bg-brand-500/10'
                            : 'border-transparent hover:border-ink-200 hover:bg-ink-50 dark:hover:border-ink-700 dark:hover:bg-ink-800/40',
                        )}
                      >
                        <div className="mb-1.5 flex items-baseline justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-semibold text-ink-800 dark:text-ink-100">
                              {subject.subject_name}
                            </p>
                            <p className="text-[10px] text-ink-400">
                              {subject.attended}/{subject.eligible} · {subject.subject_code}
                            </p>
                          </div>
                          <span
                            className={cn(
                              'shrink-0 text-xs font-semibold',
                              percentageTone(subject.percentage, data.threshold),
                            )}
                          >
                            {formatPercent(subject.percentage)}
                          </span>
                        </div>
                        <ProgressBar
                          value={subject.percentage}
                          threshold={data.threshold}
                          showThreshold
                          className="h-1.5"
                        />
                      </button>
                    ))
                )}
                <p className="rounded-lg bg-ink-50 px-3 py-2.5 text-[10px] leading-4 text-ink-500 dark:bg-ink-800/50 dark:text-ink-400">
                  Present always counts. On duty and approved leave are counted based on the
                  current campus policy set by your administrator.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Session history"
                description={`${filtered.length} matching session${filtered.length === 1 ? '' : 's'}${pendingCount ? ` · ${pendingCount} pending finalization` : ''}`}
              />
              <div className="space-y-3 border-b border-ink-100 p-4 dark:border-ink-800">
                <div className="relative">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                  <input
                    value={search}
                    onChange={(event) => setSearch(event.target.value)}
                    placeholder="Search subject or remarks…"
                    aria-label="Search attendance history"
                    className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                  />
                </div>
                <div className="flex flex-wrap items-center gap-1.5">
                  {statusFilters.map((item) => (
                    <button
                      key={item.value || 'all'}
                      type="button"
                      onClick={() => setStatus(item.value)}
                      className={cn(
                        'rounded-lg px-2.5 py-1 text-[11px] font-semibold transition',
                        status === item.value
                          ? 'bg-brand-600 text-white'
                          : 'bg-ink-100 text-ink-600 hover:bg-ink-200 dark:bg-ink-800 dark:text-ink-300 dark:hover:bg-ink-700',
                      )}
                    >
                      {item.label}
                    </button>
                  ))}
                  <label className="ml-auto flex cursor-pointer items-center gap-1.5 text-[10px] font-medium text-ink-500 dark:text-ink-400">
                    <input
                      type="checkbox"
                      checked={includePending}
                      onChange={(event) => setIncludePending(event.target.checked)}
                      className="h-3.5 w-3.5 rounded border-ink-300 text-brand-600 focus:ring-brand-500 dark:border-ink-600 dark:bg-ink-900"
                    />
                    Include pending
                  </label>
                </div>
                <select
                  value={subjectId}
                  onChange={(event) => setSubjectId(event.target.value)}
                  aria-label="Filter by subject"
                  className="h-9 w-full rounded-lg border border-ink-200 bg-white px-3 text-xs text-ink-700 focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
                >
                  <option value="">All subjects</option>
                  {data.subjects.map((subject) => (
                    <option key={subject.subject_id} value={subject.subject_id}>
                      {subject.subject_name}
                    </option>
                  ))}
                </select>
              </div>

              {filtered.length === 0 ? (
                <EmptyState
                  icon={CalendarCheck2}
                  title="No sessions match"
                  description="Try clearing the filters or searching for a different subject."
                />
              ) : (
                <>
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[560px] text-left text-sm">
                      <thead>
                        <tr className="border-b border-ink-100 text-[10px] uppercase tracking-wide text-ink-400 dark:border-ink-800">
                          <th className="px-5 py-2.5 font-semibold">Date</th>
                          <th className="px-5 py-2.5 font-semibold">Subject</th>
                          <th className="px-5 py-2.5 font-semibold">Status</th>
                          <th className="px-5 py-2.5 font-semibold">Remarks</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                        {paged.map((row) => (
                          <tr
                            key={`${row.session_id}-${row.session_date}`}
                            className="cursor-pointer hover:bg-ink-50/60 dark:hover:bg-ink-800/30"
                            onClick={() => setSelectedId(row.session_id)}
                          >
                            <td className="whitespace-nowrap px-5 py-3">
                              <p className="text-[12px] font-medium text-ink-700 dark:text-ink-200">
                                {formatDate(row.session_date, 'dd MMM yyyy')}
                              </p>
                              <p className="text-[10px] text-ink-400">
                                Session {row.session_number}
                                {row.is_finalized === false ? ' · Pending' : ''}
                              </p>
                            </td>
                            <td className="px-5 py-3">
                              <p className="text-[12px] font-medium text-ink-700 dark:text-ink-200">
                                {row.subject_name}
                              </p>
                              <p className="text-[10px] text-ink-400">{row.class_name}</p>
                            </td>
                            <td className="px-5 py-3">
                              <AttendanceBadge status={row.status} />
                            </td>
                            <td className="max-w-[180px] px-5 py-3">
                              <p className="truncate text-[11px] text-ink-500 dark:text-ink-400">
                                {row.remarks || '—'}
                              </p>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <Pagination
                    page={page}
                    pageSize={pageSize}
                    total={filtered.length}
                    onPageChange={setPage}
                    className="border-t border-ink-100 dark:border-ink-800"
                  />
                </>
              )}
            </Card>
          </div>
        </>
      ) : null}

      <Modal
        open={Boolean(selected)}
        onClose={() => setSelectedId(null)}
        title="Session detail"
        description={selected ? `${selected.subject_name} · ${selected.class_name}` : undefined}
        size="sm"
        footer={
          <button
            type="button"
            onClick={() => setSelectedId(null)}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-brand-600 px-4 text-sm font-semibold text-white transition hover:bg-brand-700"
          >
            Close
          </button>
        }
      >
        {selected ? (
          <div className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-ink-50 p-3.5 dark:bg-ink-800/50">
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-wide text-ink-400">
                  {formatDate(selected.session_date, 'EEEE, dd MMMM yyyy')}
                </p>
                <p className="mt-1 text-sm font-semibold text-ink-900 dark:text-white">
                  Session {selected.session_number}
                </p>
              </div>
              <AttendanceBadge status={selected.status} />
            </div>
            <dl className="space-y-2.5 text-sm">
              <div className="flex items-start justify-between gap-4">
                <dt className="text-ink-500 dark:text-ink-400">Subject</dt>
                <dd className="text-right font-medium text-ink-800 dark:text-ink-100">
                  {selected.subject_name}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-ink-500 dark:text-ink-400">Status</dt>
                <dd className="text-right font-medium text-ink-800 dark:text-ink-100">
                  {attendanceMeta[selected.status].label}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-ink-500 dark:text-ink-400">Finalization</dt>
                <dd className="text-right font-medium text-ink-800 dark:text-ink-100">
                  {selected.is_finalized === false ? 'Pending' : 'Finalized'}
                </dd>
              </div>
              <div className="flex items-start justify-between gap-4">
                <dt className="text-ink-500 dark:text-ink-400">Remarks</dt>
                <dd className="max-w-[60%] text-right font-medium text-ink-800 dark:text-ink-100">
                  {selected.remarks || 'No remarks'}
                </dd>
              </div>
            </dl>
            {selected.is_finalized === false ? (
              <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-[11px] leading-4 text-amber-800 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
                This session has not been finalized, so it is not counted in your attendance
                percentage yet.
              </p>
            ) : null}
          </div>
        ) : null}
      </Modal>
    </div>
  )
}
