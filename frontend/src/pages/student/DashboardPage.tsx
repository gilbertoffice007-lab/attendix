import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CalendarCheck2,
  CheckCircle2,
  ClipboardList,
  Clock,
  TrendingUp,
} from 'lucide-react'
import { AttendanceBadge, ListStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatCard } from '@/components/ui/StatCard'
import { useAuth } from '@/contexts/AuthContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { attendanceApi, customListsApi } from '@/services/api'
import {
  cn,
  formatDate,
  formatPercent,
  greeting,
  percentageTone,
} from '@/lib/utils'

export function StudentDashboardPage() {
  const { user } = useAuth()
  const report = useApiQuery(attendanceApi.myReport, [])
  const lists = useApiQuery(() => customListsApi.myLists({ page: 1, page_size: 3 }), [])

  const data = report.data
  const firstName = user?.full_name.split(' ')[0] ?? 'there'
  const pending = data?.history.filter((row) => row.is_finalized === false).length ?? 0

  return (
    <div className="space-y-6">
      <PageHeader
        eyebrow={greeting()}
        title={`${firstName}, here is your attendance`}
        description="A live snapshot of your attendance, subject progress and shared class lists."
      />

      {report.loading && !data ? (
        <div className="space-y-5">
          <Skeleton className="h-52 w-full rounded-2xl" />
          <div className="grid gap-4 sm:grid-cols-3">
            {[0, 1, 2].map((item) => (
              <Skeleton key={item} className="h-28 rounded-2xl" />
            ))}
          </div>
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      ) : report.error ? (
        <Card>
          <ErrorState message={report.error} onRetry={() => void report.refresh()} />
        </Card>
      ) : data ? (
        <>
          <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-950 via-brand-900 to-brand-800 p-6 text-white shadow-xl shadow-brand-950/20 sm:p-8">
            <div
              className="absolute -right-20 -top-24 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl"
              aria-hidden
            />
            <div
              className="absolute -bottom-24 left-1/3 h-52 w-52 rounded-full bg-violet-500/10 blur-3xl"
              aria-hidden
            />
            <div className="relative flex flex-col gap-8 lg:flex-row lg:items-center lg:justify-between">
              <div className="min-w-0">
                <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] text-brand-100">
                  <CalendarCheck2 className="h-3 w-3" /> {data.class_name}
                </span>
                <p className="mt-4 text-[13px] text-brand-100/70">Overall attendance</p>
                <div className="mt-1 flex flex-wrap items-baseline gap-3">
                  <p className="text-5xl font-semibold tracking-tight">
                    {formatPercent(data.percentage)}
                  </p>
                  <span
                    className={cn(
                      'rounded-full px-2.5 py-1 text-[11px] font-semibold',
                      data.below_threshold
                        ? 'bg-rose-400/15 text-rose-200'
                        : 'bg-emerald-400/15 text-emerald-200',
                    )}
                  >
                    {data.below_threshold
                      ? `Below ${data.threshold}% requirement`
                      : `Above ${data.threshold}% requirement`}
                  </span>
                </div>
                <p className="mt-3 max-w-md text-[13px] leading-6 text-brand-100/70">
                  {data.attended} attended out of {data.eligible} eligible finalized sessions.
                  {pending > 0
                    ? ` ${pending} session${pending === 1 ? '' : 's'} still awaiting finalization.`
                    : ' Every session is up to date.'}
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link to="/student/attendance">
                    <Button variant="subtle" className="bg-white text-brand-900 hover:bg-brand-50">
                      View my attendance <ArrowRight className="h-4 w-4" />
                    </Button>
                  </Link>
                  <Link to="/student/lists">
                    <Button
                      variant="ghost"
                      className="text-brand-100 hover:bg-white/10 hover:text-white"
                    >
                      <ClipboardList className="h-4 w-4" /> Shared lists
                    </Button>
                  </Link>
                </div>
              </div>

              <div className="relative mx-auto flex h-36 w-36 shrink-0 items-center justify-center lg:mx-0">
                <div
                  className="absolute inset-0 rounded-full"
                  style={{
                    background: `conic-gradient(#5eead4 ${Math.min(100, data.percentage)}%, rgba(255,255,255,0.12) 0)`,
                  }}
                  aria-hidden
                />
                <div className="absolute inset-2 rounded-full bg-brand-950" aria-hidden />
                <div className="relative text-center">
                  <p className="text-2xl font-semibold">{data.attended}</p>
                  <p className="text-[10px] uppercase tracking-wide text-brand-200/70">
                    sessions attended
                  </p>
                </div>
              </div>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Eligible sessions"
              value={data.eligible}
              hint="Finalized attendance sessions"
              icon={CalendarCheck2}
              tone="brand"
            />
            <StatCard
              label="Attended"
              value={data.attended}
              hint={`Present, OD and approved leave combined`}
              icon={CheckCircle2}
              tone="green"
            />
            <StatCard
              label="Absences"
              value={data.absences}
              hint={
                data.below_threshold
                  ? 'Attendance recovery needed'
                  : 'Keep it below the threshold'
              }
              icon={data.below_threshold ? AlertTriangle : TrendingUp}
              tone={data.below_threshold ? 'rose' : 'violet'}
            />
          </div>

          {data.below_threshold ? (
            <div className="flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-200">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />
              <div>
                <p className="font-semibold">Attendance needs attention</p>
                <p className="mt-0.5 text-[12px] leading-5 opacity-90">
                  You are {formatPercent(Math.max(0, data.threshold - data.percentage))} below the{' '}
                  {data.threshold}% requirement. Speak to your faculty about upcoming sessions and
                  approved leave.
                </p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
            <Card>
              <CardHeader
                title="Subject progress"
                description="Finalized sessions only, using the current attendance policy."
                action={<BookOpen className="h-4 w-4 text-ink-400" />}
              />
              {data.subjects.length === 0 ? (
                <EmptyState
                  icon={BookOpen}
                  title="No subjects yet"
                  description="Subjects appear once your class timetable is configured."
                />
              ) : (
                <CardContent className="space-y-4">
                  {[...data.subjects]
                    .sort((a, b) => a.percentage - b.percentage)
                    .map((subject) => (
                      <div key={subject.subject_id}>
                        <div className="mb-1.5 flex items-baseline justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-ink-800 dark:text-ink-100">
                              {subject.subject_name}
                            </p>
                            <p className="text-[10px] text-ink-400">{subject.subject_code}</p>
                          </div>
                          <p
                            className={cn(
                              'shrink-0 text-sm font-semibold',
                              percentageTone(subject.percentage, data.threshold),
                            )}
                          >
                            {formatPercent(subject.percentage)}
                          </p>
                        </div>
                        <ProgressBar value={subject.percentage} threshold={data.threshold} showThreshold />
                        <p className="mt-1 text-[10px] text-ink-400">
                          {subject.attended} of {subject.eligible} sessions attended
                        </p>
                      </div>
                    ))}
                </CardContent>
              )}
            </Card>

            <div className="space-y-5">
              <Card>
                <CardHeader
                  title="Recent sessions"
                  description="Your latest marked classes"
                  action={
                    <Link
                      to="/student/attendance"
                      className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                    >
                      View all
                    </Link>
                  }
                />
                {data.history.length === 0 ? (
                  <EmptyState
                    icon={Clock}
                    title="Nothing marked yet"
                    description="Your attendance will appear here after your first class."
                  />
                ) : (
                  <div className="divide-y divide-ink-100 dark:divide-ink-800">
                    {data.history.slice(0, 5).map((row) => (
                      <div
                        key={`${row.session_id}-${row.session_date}`}
                        className="flex items-center gap-3 px-5 py-3"
                      >
                        <div className="flex h-9 w-9 shrink-0 flex-col items-center justify-center rounded-lg bg-ink-50 dark:bg-ink-800/60">
                          <span className="text-[8px] font-semibold uppercase text-ink-400">
                            {formatDate(row.session_date, 'MMM')}
                          </span>
                          <span className="text-xs font-semibold text-ink-700 dark:text-ink-200">
                            {formatDate(row.session_date, 'dd')}
                          </span>
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[12px] font-semibold text-ink-800 dark:text-ink-100">
                            {row.subject_name}
                          </p>
                          <p className="text-[10px] text-ink-400">
                            Session {row.session_number}
                            {row.is_finalized === false ? ' · Pending finalization' : ''}
                          </p>
                        </div>
                        <AttendanceBadge status={row.status} />
                      </div>
                    ))}
                  </div>
                )}
              </Card>

              <Card>
                <CardHeader
                  title="Shared lists"
                  description="Lists your faculty shared with you"
                  action={
                    <Link
                      to="/student/lists"
                      className="text-[11px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                    >
                      Open
                    </Link>
                  }
                />
                {lists.loading && !lists.data ? (
                  <CardContent className="space-y-3">
                    <Skeleton className="h-12 w-full" />
                    <Skeleton className="h-12 w-full" />
                  </CardContent>
                ) : !lists.data || lists.data.items.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title="No shared lists"
                    description="When faculty share a list with you, it will show up here."
                  />
                ) : (
                  <div className="divide-y divide-ink-100 dark:divide-ink-800">
                    {lists.data.items.map((list) => (
                      <Link
                        key={list.id}
                        to="/student/lists"
                        className="block px-5 py-3 transition hover:bg-ink-50/70 dark:hover:bg-ink-800/30"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-[12px] font-semibold text-ink-800 dark:text-ink-100">
                              {list.title}
                            </p>
                            <p className="text-[10px] text-ink-400">
                              {list.due_date
                                ? `Due ${formatDate(list.due_date, 'dd MMM')}`
                                : `Updated ${formatDate(list.updated_at, 'dd MMM')}`}
                            </p>
                          </div>
                          <ListStatusBadge status={list.my_status} options={list.status_options} />
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </Card>
            </div>
          </div>
        </>
      ) : null}
    </div>
  )
}
