import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  AlertTriangle,
  ArrowRight,
  CalendarCheck2,
  CalendarPlus,
  ClipboardList,
  FileBarChart,
  RefreshCw,
  TrendingUp,
  Users2,
  UsersRound,
} from 'lucide-react'
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button, buttonStyles } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { Select } from '@/components/ui/Input'
import { StatCard } from '@/components/ui/StatCard'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { classesApi, dashboardApi, subjectsApi } from '@/services/api'
import {
  cn,
  formatDate,
  formatPercent,
  greeting,
  percentageTone,
  todayInputValue,
} from '@/lib/utils'

export function DashboardPage() {
  const { user } = useAuth()
  const toast = useToast()
  const base = user ? `/${user.role}` : '/faculty'
  const [classId, setClassId] = useState<number | ''>('')
  const [subjectId, setSubjectId] = useState<number | ''>('')
  const [date, setDate] = useState('')

  const { data: classes } = useApiQuery(classesApi.list, [])
  const { data: subjects } = useApiQuery(
    () => subjectsApi.list(classId || undefined),
    [classId],
  )
  const { data, loading, error, refresh } = useApiQuery(
    () =>
      dashboardApi.get({
        class_id: classId || undefined,
        subject_id: subjectId || undefined,
        date: date || undefined,
      }),
    [classId, subjectId, date],
  )

  useEffect(() => {
    setSubjectId('')
  }, [classId])

  const isAdmin = user?.role === 'admin'

  const takeAttendance = () => {
    const query = new URLSearchParams()
    if (classId) query.set('class_id', String(classId))
    if (subjectId) query.set('subject_id', String(subjectId))
    return `${base}/attendance/new${query.toString() ? `?${query.toString()}` : ''}`
  }

  const refreshAll = async () => {
    const result = await refresh(true)
    if (result) toast.info('Dashboard updated')
  }

  return (
    <div className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-brand-950 px-5 py-6 shadow-card sm:px-7 sm:py-7">
        <div className="app-grid-bg absolute inset-0 opacity-30" aria-hidden />
        <div
          className="absolute -right-16 -top-24 h-64 w-64 rounded-full bg-brand-500/25 blur-3xl"
          aria-hidden
        />
        <div className="relative flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-brand-300">
              {formatDate(new Date(), 'EEEE, dd MMMM yyyy')}
            </p>
            <h1 className="mt-2 text-2xl font-semibold tracking-tight text-white sm:text-[28px]">
              {greeting()}, {user?.full_name.split(' ')[0]}
            </h1>
            <p className="mt-1.5 max-w-xl text-sm leading-6 text-brand-100/75">
              {data?.scope_label ??
                (isAdmin
                  ? 'A live view of attendance across every class.'
                  : 'Your classes, sessions and students at a glance.')}
              {isAdmin && data
                ? ` · ${data.total_classes} classes · ${data.faculty_count ?? 0} faculty`
                : ''}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              to={takeAttendance()}
              className={cn(
                buttonStyles('primary', 'md'),
                'bg-white text-brand-800 hover:bg-brand-50 active:bg-brand-100',
              )}
            >
              <CalendarPlus className="h-4 w-4" /> Take attendance
            </Link>
            <Link
              to={`${base}/custom-lists/new`}
              className={cn(
                buttonStyles('ghost', 'md'),
                'border border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white',
              )}
            >
              <ClipboardList className="h-4 w-4" /> New list
            </Link>
            <Link
              to={`${base}/reports`}
              className={cn(
                buttonStyles('ghost', 'md'),
                'border border-white/15 bg-white/5 text-white hover:bg-white/10 hover:text-white',
              )}
            >
              <FileBarChart className="h-4 w-4" /> Reports
            </Link>
          </div>
        </div>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <PageHeader
          title="Overview"
          description="Finalized sessions power every attendance percentage. Drafts stay out of the maths."
          className="sm:items-start"
        />
        <div className="flex flex-wrap items-end gap-2">
          <Select
            aria-label="Filter by class"
            value={classId}
            onChange={(event) =>
              setClassId(event.target.value ? Number(event.target.value) : '')
            }
            placeholder="All classes"
            options={classes?.map((item) => ({
              value: item.id,
              label: `${item.name} · Sem ${item.semester}`,
            }))}
            className="min-w-[170px]"
          />
          <Select
            aria-label="Filter by subject"
            value={subjectId}
            onChange={(event) =>
              setSubjectId(event.target.value ? Number(event.target.value) : '')
            }
            placeholder="All subjects"
            options={subjects?.map((item) => ({
              value: item.id,
              label: `${item.subject_code} · ${item.name}`,
            }))}
            className="min-w-[170px]"
          />
          <input
            type="date"
            aria-label="Filter by date"
            value={date}
            max={todayInputValue()}
            onChange={(event) => setDate(event.target.value)}
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
          />
          <Button variant="secondary" size="icon" onClick={() => void refreshAll()} aria-label="Refresh dashboard">
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {error ? (
        <Card>
          <ErrorState message={error} onRetry={() => void refresh()} />
        </Card>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Total students"
              value={data?.total_students ?? '—'}
              hint={`${data?.total_classes ?? 0} classes in scope`}
              icon={UsersRound}
              tone="brand"
              loading={loading && !data}
            />
            <StatCard
              label="Average attendance"
              value={formatPercent(data?.average_percentage ?? 0)}
              hint={`Across ${data?.finalized_session_count ?? 0} finalized sessions`}
              icon={TrendingUp}
              tone="green"
              loading={loading && !data}
              footer={
                <ProgressBar
                  value={data?.average_percentage ?? 0}
                  threshold={data?.threshold}
                  showThreshold
                />
              }
            />
            <StatCard
              label="Sessions recorded"
              value={data?.session_count ?? '—'}
              hint={`${data?.today_sessions.length ?? 0} on the selected day`}
              icon={CalendarCheck2}
              tone="violet"
              loading={loading && !data}
            />
            <StatCard
              label="Below threshold"
              value={data?.low_attendance_count ?? '—'}
              hint={`Under ${data?.threshold ?? 75}% attendance`}
              icon={AlertTriangle}
              tone={(data?.low_attendance_count ?? 0) > 0 ? 'rose' : 'green'}
              loading={loading && !data}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Attendance trend"
                description="Finalized session averages in the current scope"
                action={
                  data ? (
                    <Badge tone="neutral">
                      {data.trend.length} {data.trend.length === 1 ? 'point' : 'points'}
                    </Badge>
                  ) : null
                }
              />
              <CardContent className="pt-5">
                {loading && !data ? (
                  <Skeleton className="h-[260px] w-full rounded-xl" />
                ) : data && data.trend.length > 0 ? (
                  <div className="h-[260px] w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={data.trend} margin={{ top: 5, right: 8, bottom: 0, left: -18 }}>
                        <defs>
                          <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="0%" stopColor="#3563f6" stopOpacity={0.25} />
                            <stop offset="100%" stopColor="#3563f6" stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid
                          strokeDasharray="4 4"
                          vertical={false}
                          className="stroke-ink-200 dark:stroke-ink-800"
                        />
                        <XAxis
                          dataKey="label"
                          tick={{ fontSize: 11, fill: '#919bad' }}
                          tickLine={false}
                          axisLine={false}
                          interval="preserveStartEnd"
                        />
                        <YAxis
                          domain={[0, 100]}
                          tick={{ fontSize: 11, fill: '#919bad' }}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(value) => `${value}%`}
                        />
                        <Tooltip
                          cursor={{ stroke: '#3563f6', strokeWidth: 1, strokeDasharray: '4 4' }}
                          contentStyle={{
                            borderRadius: 12,
                            border: '1px solid rgb(226 232 240)',
                            boxShadow: '0 12px 30px -12px rgb(15 23 42 / 0.25)',
                            fontSize: 12,
                          }}
                          formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Attendance']}
                        />
                        <Area
                          type="monotone"
                          dataKey="percentage"
                          stroke="#3563f6"
                          strokeWidth={2.5}
                          fill="url(#trendFill)"
                          dot={{ r: 2.5, fill: '#3563f6', strokeWidth: 0 }}
                          activeDot={{ r: 5, strokeWidth: 2, stroke: '#fff' }}
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                ) : (
                  <EmptyState
                    icon={TrendingUp}
                    title="No finalized sessions yet"
                    description="Mark a register and finalize it to start building the attendance trend."
                    action={
                      <Link to={takeAttendance()} className={buttonStyles('primary', 'sm')}>
                        <CalendarPlus className="h-3.5 w-3.5" /> Take attendance
                      </Link>
                    }
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Sessions on the day"
                description={date ? formatDate(date, 'dd MMM yyyy') : 'Today'}
                action={
                  <Link
                    to={`${base}/attendance`}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                  >
                    View all
                  </Link>
                }
              />
              <CardContent className="p-0">
                {loading && !data ? (
                  <div className="space-y-3 p-5">
                    {[0, 1, 2].map((item) => (
                      <Skeleton key={item} className="h-14 w-full rounded-xl" />
                    ))}
                  </div>
                ) : data && data.today_sessions.length > 0 ? (
                  <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                    {data.today_sessions.slice(0, 5).map((session) => (
                      <li key={session.id}>
                        <Link
                          to={`${base}/attendance/${session.id}`}
                          className="flex items-center gap-3 px-5 py-3.5 transition hover:bg-ink-50 dark:hover:bg-ink-800/50"
                        >
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                            <CalendarCheck2 className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-ink-800 dark:text-ink-100">
                              {session.subject_name}
                            </p>
                            <p className="truncate text-[11px] text-ink-500 dark:text-ink-400">
                              {session.class_name} · S{session.session_number}
                            </p>
                          </div>
                          <div className="text-right">
                            <Badge tone={session.is_finalized ? 'success' : 'warning'} dot>
                              {session.is_finalized ? 'Final' : 'Draft'}
                            </Badge>
                            <p className="mt-1 text-[10px] tabular-nums text-ink-500 dark:text-ink-400">
                              {session.present}/{session.total} present
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={CalendarCheck2}
                    title="Nothing scheduled"
                    description={
                      date
                        ? 'No sessions recorded on this date.'
                        : 'No attendance has been recorded today.'
                    }
                    action={
                      <Link to={takeAttendance()} className={buttonStyles('secondary', 'sm')}>
                        Start a session
                      </Link>
                    }
                    className="py-10"
                  />
                )}
              </CardContent>
              {data ? (
                <div className="grid grid-cols-2 divide-x divide-ink-100 border-t border-ink-100 dark:divide-ink-800 dark:border-ink-800">
                  <div className="px-5 py-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                      Present
                    </p>
                    <p className="mt-0.5 text-lg font-semibold text-emerald-600 dark:text-emerald-400">
                      {data.present_today}
                    </p>
                  </div>
                  <div className="px-5 py-3.5">
                    <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                      Absent
                    </p>
                    <p className="mt-0.5 text-lg font-semibold text-rose-600 dark:text-rose-400">
                      {data.absent_today}
                    </p>
                  </div>
                </div>
              ) : null}
            </Card>
          </div>

          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Low attendance"
                description={`Students below the ${data?.threshold ?? 75}% threshold`}
                action={
                  <Link
                    to={`${base}/reports`}
                    className="inline-flex items-center gap-1 text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                  >
                    Full report <ArrowRight className="h-3 w-3" />
                  </Link>
                }
              />
              <CardContent className="p-0">
                {loading && !data ? (
                  <div className="space-y-3 p-5">
                    {[0, 1, 2].map((item) => (
                      <Skeleton key={item} className="h-12 w-full rounded-xl" />
                    ))}
                  </div>
                ) : data && data.low_attendance.length > 0 ? (
                  <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                    {data.low_attendance.slice(0, 5).map((student) => (
                      <li
                        key={student.student_id}
                        className="flex items-center gap-3 px-5 py-3"
                      >
                        <Avatar name={student.full_name} size="sm" />
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-[13px] font-semibold text-ink-800 dark:text-ink-100">
                            {student.full_name}
                          </p>
                          <p className="truncate text-[11px] text-ink-500 dark:text-ink-400">
                            {student.roll_number} · {student.class_name}
                          </p>
                        </div>
                        <div className="w-28 shrink-0 text-right">
                          <p
                            className={cn(
                              'text-[13px] font-semibold tabular-nums',
                              percentageTone(student.percentage, data.threshold),
                            )}
                          >
                            {formatPercent(student.percentage)}
                          </p>
                          <ProgressBar
                            value={student.percentage}
                            threshold={data.threshold}
                            className="mt-1.5 h-1.5"
                          />
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={Users2}
                    title="Everyone is above threshold"
                    description={
                      data?.finalized_session_count
                        ? 'No student is below the configured attendance threshold.'
                        : 'Finalize a few sessions to surface attendance risks.'
                    }
                    className="py-10"
                  />
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Recent custom lists"
                description="Fee, submission and eligibility trackers"
                action={
                  <Link
                    to={`${base}/custom-lists`}
                    className="text-xs font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                  >
                    Open
                  </Link>
                }
              />
              <CardContent className="p-0">
                {data && data.recent_lists.length > 0 ? (
                  <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                    {data.recent_lists.map((list) => (
                      <li key={list.id}>
                        <Link
                          to={`${base}/custom-lists/${list.id}`}
                          className="flex items-start gap-3 px-5 py-3.5 transition hover:bg-ink-50 dark:hover:bg-ink-800/50"
                        >
                          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600 dark:bg-violet-500/10 dark:text-violet-300">
                            <ClipboardList className="h-4 w-4" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-[13px] font-semibold text-ink-800 dark:text-ink-100">
                              {list.title}
                            </p>
                            <p className="truncate text-[11px] text-ink-500 dark:text-ink-400">
                              {list.entry_count} students · {list.creator_name}
                            </p>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyState
                    icon={ClipboardList}
                    title="No lists yet"
                    description="Create a custom list to track almost anything."
                    action={
                      <Link to={`${base}/custom-lists/new`} className={buttonStyles('secondary', 'sm')}>
                        Create list
                      </Link>
                    }
                    className="py-10"
                  />
                )}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  )
}
