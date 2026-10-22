import { useEffect, useMemo, useState } from 'react'
import {
  BarChart3,
  BookOpen,
  Building2,
  Download,
  FileSpreadsheet,
  Rows3,
  Search,
  UsersRound,
} from 'lucide-react'
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { Badge, AttendanceBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton, TableSkeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { StatCard } from '@/components/ui/StatCard'
import { useToast } from '@/contexts/ToastContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useDebounce } from '@/hooks/useDebounce'
import { attendanceApi, classesApi, subjectsApi } from '@/services/api'
import { getErrorMessage } from '@/services/http'
import {
  cn,
  formatDate,
  formatPercent,
  percentageTone,
  todayInputValue,
} from '@/lib/utils'

type Tab = 'students' | 'subjects' | 'classes' | 'history'

const tabs: { key: Tab; label: string; icon: typeof UsersRound }[] = [
  { key: 'students', label: 'Student-wise', icon: UsersRound },
  { key: 'subjects', label: 'Subject-wise', icon: BookOpen },
  { key: 'classes', label: 'Class-wise', icon: Building2 },
  { key: 'history', label: 'History', icon: Rows3 },
]

function AverageChart({ data }: { data: { label: string; value: number }[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-[220px] items-center justify-center text-sm text-ink-400">
        No finalized attendance in this range.
      </div>
    )
  }
  return (
    <div className="h-[220px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={data} margin={{ top: 8, right: 8, bottom: 0, left: -18 }}>
          <CartesianGrid
            strokeDasharray="4 4"
            vertical={false}
            className="stroke-ink-200 dark:stroke-ink-800"
          />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#919bad' }}
            tickLine={false}
            axisLine={false}
            interval={0}
            tickFormatter={(value: string) =>
              value.length > 14 ? `${value.slice(0, 13)}…` : value
            }
          />
          <YAxis
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: '#919bad' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(value) => `${value}%`}
          />
          <Tooltip
            cursor={{ fill: 'rgb(53 99 246 / 0.06)' }}
            contentStyle={{
              borderRadius: 12,
              border: '1px solid rgb(226 232 240)',
              boxShadow: '0 12px 30px -12px rgb(15 23 42 / 0.25)',
              fontSize: 12,
            }}
            formatter={(value) => [`${Number(value).toFixed(1)}%`, 'Average']}
          />
          <Bar dataKey="value" fill="#3563f6" radius={[5, 5, 0, 0]} maxBarSize={44} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

export function ReportsPage() {
  const toast = useToast()
  const [tab, setTab] = useState<Tab>('students')
  const [classId, setClassId] = useState<number | ''>('')
  const [subjectId, setSubjectId] = useState<number | ''>('')
  const [dateFrom, setDateFrom] = useState('')
  const [dateTo, setDateTo] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [exporting, setExporting] = useState<string | null>(null)
  const debouncedSearch = useDebounce(search)

  const { data: classes } = useApiQuery(classesApi.list, [])
  const { data: subjects } = useApiQuery(
    () => subjectsApi.list(classId || undefined),
    [classId],
  )

  useEffect(() => {
    setSubjectId('')
  }, [classId])

  useEffect(() => {
    if (tab === 'students' && !classId && classes && classes.length > 0) {
      setClassId(classes[0].id)
    }
  }, [tab, classId, classes])

  useEffect(() => {
    setPage(1)
  }, [classId, subjectId, dateFrom, dateTo, statusFilter, debouncedSearch, tab])

  const summaryQuery = useApiQuery(
    () =>
      attendanceApi.summary({
        class_id: Number(classId),
        subject_id: subjectId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
    [classId, subjectId, dateFrom, dateTo],
    { enabled: tab === 'students' && Boolean(classId) },
  )

  const subjectQuery = useApiQuery(
    () =>
      attendanceApi.subjectReport({
        class_id: classId || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
    [classId, dateFrom, dateTo, tab],
    { enabled: tab === 'subjects' },
  )

  const classQuery = useApiQuery(
    () =>
      attendanceApi.classReport({
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
      }),
    [dateFrom, dateTo, tab],
    { enabled: tab === 'classes' },
  )

  const historyQuery = useApiQuery(
    () =>
      attendanceApi.history({
        class_id: classId || undefined,
        subject_id: subjectId || undefined,
        status: statusFilter || undefined,
        search: debouncedSearch || undefined,
        date_from: dateFrom || undefined,
        date_to: dateTo || undefined,
        page,
        page_size: 25,
      }),
    [classId, subjectId, statusFilter, debouncedSearch, dateFrom, dateTo, page, tab],
    { enabled: tab === 'history' },
  )

  const ranges = { date_from: dateFrom || undefined, date_to: dateTo || undefined }

  const exportReport = async (format: 'csv' | 'xlsx') => {
    setExporting(format)
    try {
      if (tab === 'students') {
        if (!classId) {
          toast.warning('Choose a class first')
          return
        }
        await attendanceApi.exportReport(
          {
            report: 'students',
            class_id: classId,
            subject_id: subjectId || undefined,
            ...ranges,
          },
          format,
          `student-attendance-report.${format}`,
        )
      } else if (tab === 'subjects') {
        await attendanceApi.exportReport(
          { report: 'subject', class_id: classId || undefined, ...ranges },
          format,
          `subject-attendance-report.${format}`,
        )
      } else if (tab === 'classes') {
        await attendanceApi.exportReport(
          { report: 'class', ...ranges },
          format,
          `class-attendance-report.${format}`,
        )
      } else {
        await attendanceApi.exportReport(
          {
            report: 'history',
            class_id: classId || undefined,
            subject_id: subjectId || undefined,
            status: statusFilter || undefined,
            search: debouncedSearch || undefined,
            ...ranges,
          },
          format,
          `attendance-history.${format}`,
        )
      }
    } catch (caught) {
      toast.error('Export failed', getErrorMessage(caught))
    } finally {
      setExporting(null)
    }
  }

  const exportStudent = async (studentId: number, name: string) => {
    setExporting(`student-${studentId}`)
    try {
      await attendanceApi.exportReport(
        { report: 'student', student_id: studentId, ...ranges },
        'csv',
        `${name.replace(/\s+/g, '-').toLowerCase()}-attendance.csv`,
      )
    } catch (caught) {
      toast.error('Export failed', getErrorMessage(caught))
    } finally {
      setExporting(null)
    }
  }

  const subjectChart = useMemo(
    () =>
      (subjectQuery.data ?? []).map((row) => ({
        label: row.subject_code || row.subject_name,
        value: row.average_percentage,
      })),
    [subjectQuery.data],
  )
  const classChart = useMemo(
    () =>
      (classQuery.data ?? []).map((row) => ({
        label: row.class_name,
        value: row.average_percentage,
      })),
    [classQuery.data],
  )

  const activeLoading =
    tab === 'students'
      ? summaryQuery.loading
      : tab === 'subjects'
        ? subjectQuery.loading
        : tab === 'classes'
          ? classQuery.loading
          : historyQuery.loading
  const activeError =
    tab === 'students'
      ? summaryQuery.error
      : tab === 'subjects'
        ? subjectQuery.error
        : tab === 'classes'
          ? classQuery.error
          : historyQuery.error
  const retryActive =
    tab === 'students'
      ? () => void summaryQuery.refresh()
      : tab === 'subjects'
        ? () => void subjectQuery.refresh()
        : tab === 'classes'
          ? () => void classQuery.refresh()
          : () => void historyQuery.refresh()

  const summary = summaryQuery.data
  const subjectRows = subjectQuery.data ?? []
  const classRows = classQuery.data ?? []
  const history = historyQuery.data

  return (
    <div className="space-y-5">
      <PageHeader
        title="Reports"
        description="Student-wise, subject-wise and class-wise attendance based only on finalized sessions."
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void exportReport('csv')}
              loading={exporting === 'csv'}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button
              variant="secondary"
              onClick={() => void exportReport('xlsx')}
              loading={exporting === 'xlsx'}
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
          </>
        }
      />

      <div className="scrollbar-none flex gap-1 overflow-x-auto rounded-xl border border-ink-200 bg-white p-1 shadow-sm dark:border-ink-700 dark:bg-ink-900">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={cn(
              'inline-flex shrink-0 items-center gap-2 rounded-lg px-3.5 py-2 text-xs font-semibold transition',
              tab === item.key
                ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                : 'text-ink-500 hover:bg-ink-50 hover:text-ink-800 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-white',
            )}
            aria-pressed={tab === item.key}
          >
            <item.icon className="h-4 w-4" /> {item.label}
          </button>
        ))}
      </div>

      <Card>
        <div className="grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          <select
            value={classId}
            onChange={(event) => setClassId(event.target.value ? Number(event.target.value) : '')}
            aria-label="Class filter"
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
          >
            <option value="">{tab === 'students' ? 'Choose a class' : 'All classes'}</option>
            {classes?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name} · Sem {item.semester}
              </option>
            ))}
          </select>
          <select
            value={subjectId}
            onChange={(event) => setSubjectId(event.target.value ? Number(event.target.value) : '')}
            aria-label="Subject filter"
            disabled={tab === 'classes'}
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none disabled:opacity-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
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
            max={dateTo || todayInputValue()}
            onChange={(event) => setDateFrom(event.target.value)}
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
          />
          <input
            type="date"
            aria-label="To date"
            value={dateTo}
            min={dateFrom || undefined}
            max={todayInputValue()}
            onChange={(event) => setDateTo(event.target.value)}
            className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
          />
          {tab === 'history' ? (
            <div className="flex gap-2">
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
                aria-label="Status filter"
                className="h-10 min-w-0 flex-1 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
              >
                <option value="">All statuses</option>
                <option value="present">Present</option>
                <option value="absent">Absent</option>
                <option value="od">On duty</option>
                <option value="leave">Leave</option>
              </select>
              <div className="relative min-w-0 flex-[2]">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Student…"
                  aria-label="Search history by student"
                  className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-2 text-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                />
              </div>
            </div>
          ) : (
            <div className="flex items-center text-xs text-ink-500 dark:text-ink-400">
              {dateFrom || dateTo ? (
                <button
                  type="button"
                  onClick={() => {
                    setDateFrom('')
                    setDateTo('')
                  }}
                  className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                >
                  Clear date range
                </button>
              ) : (
                <span>All dates included</span>
              )}
            </div>
          )}
        </div>
      </Card>

      {activeError ? (
        <Card>
          <ErrorState message={activeError} onRetry={retryActive} />
        </Card>
      ) : tab === 'students' ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <StatCard
              label="Students"
              value={summary?.total_students ?? '—'}
              hint={summary?.class_name ?? 'Choose a class'}
              icon={UsersRound}
              loading={activeLoading && !summary}
            />
            <StatCard
              label="Class average"
              value={formatPercent(summary?.average_percentage ?? 0)}
              hint={`Threshold ${summary?.threshold ?? 75}%`}
              icon={BarChart3}
              tone="green"
              loading={activeLoading && !summary}
            />
            <StatCard
              label="Below threshold"
              value={summary?.low_attendance_count ?? '—'}
              hint="Students needing support"
              icon={UsersRound}
              tone={(summary?.low_attendance_count ?? 0) > 0 ? 'rose' : 'green'}
              loading={activeLoading && !summary}
            />
            <StatCard
              label="Finalized sessions"
              value={summary?.finalized_sessions ?? '—'}
              hint={summary?.subject_name ?? 'All subjects'}
              icon={BookOpen}
              tone="violet"
              loading={activeLoading && !summary}
            />
          </div>

          <Card>
            <CardHeader
              title="Student attendance"
              description={
                summary
                  ? `${summary.class_name}${summary.subject_name ? ` · ${summary.subject_name}` : ''}`
                  : 'Select a class to load student attendance'
              }
            />
            {activeLoading && !summary ? (
              <TableSkeleton rows={8} cols={6} />
            ) : !summary ? (
              <EmptyState
                title="No class selected"
                description="Choose a class to see student-wise attendance."
                icon={UsersRound}
              />
            ) : summary.students.length === 0 ? (
              <EmptyState
                title="No students in this class"
                description="Add students to the roster before reviewing attendance."
                icon={UsersRound}
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-400 dark:border-ink-800">
                      <th className="px-5 py-3 font-semibold">Student</th>
                      <th className="px-5 py-3 font-semibold">Eligible</th>
                      <th className="px-5 py-3 font-semibold">Attended</th>
                      <th className="px-5 py-3 font-semibold">Absences</th>
                      <th className="px-5 py-3 font-semibold">Percentage</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 text-right font-semibold">Export</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                    {summary.students.map((student) => (
                      <tr
                        key={student.student_id}
                        className="transition-colors hover:bg-ink-50/60 dark:hover:bg-ink-800/30"
                      >
                        <td className="px-5 py-3">
                          <p className="text-[13px] font-semibold text-ink-900 dark:text-white">
                            {student.full_name}
                          </p>
                          <p className="text-[11px] text-ink-500 dark:text-ink-400">
                            {student.roll_number}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-[12px] tabular-nums text-ink-600 dark:text-ink-300">
                          {student.eligible}
                        </td>
                        <td className="px-5 py-3 text-[12px] tabular-nums text-ink-600 dark:text-ink-300">
                          {student.attended}
                        </td>
                        <td className="px-5 py-3 text-[12px] tabular-nums text-ink-600 dark:text-ink-300">
                          {student.absences}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <span
                              className={cn(
                                'w-12 text-[12px] font-semibold tabular-nums',
                                percentageTone(student.percentage, summary.threshold),
                              )}
                            >
                              {formatPercent(student.percentage)}
                            </span>
                            <ProgressBar
                              value={student.percentage}
                              threshold={summary.threshold}
                              showThreshold
                              className="h-1.5 w-24"
                            />
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={student.below_threshold ? 'danger' : 'success'} dot>
                            {student.below_threshold ? 'Low' : 'On track'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => void exportStudent(student.student_id, student.full_name)}
                            loading={exporting === `student-${student.student_id}`}
                            aria-label={`Export ${student.full_name} attendance`}
                          >
                            <Download className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : tab === 'subjects' ? (
        <>
          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Average by subject"
                description="Finalized session attendance averaged across students"
              />
              <CardContent>
                {subjectQuery.loading && !subjectQuery.data ? (
                  <Skeleton className="h-[220px] w-full rounded-xl" />
                ) : (
                  <AverageChart data={subjectChart} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Subject summary" />
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-ink-500 dark:text-ink-400">Subjects in scope</p>
                  <p className="text-2xl font-semibold text-ink-900 dark:text-white">
                    {subjectRows.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-500 dark:text-ink-400">Finalized sessions</p>
                  <p className="text-2xl font-semibold text-ink-900 dark:text-white">
                    {subjectRows.reduce((sum, row) => sum + row.finalized_sessions, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-500 dark:text-ink-400">Class average</p>
                  <p className="text-2xl font-semibold text-ink-900 dark:text-white">
                    {formatPercent(
                      subjectRows.length
                        ? subjectRows.reduce((sum, row) => sum + row.average_percentage, 0) /
                            subjectRows.length
                        : 0,
                    )}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader title="Subject-wise details" />
            {subjectQuery.loading && !subjectQuery.data ? (
              <TableSkeleton rows={7} cols={6} />
            ) : subjectRows.length === 0 ? (
              <EmptyState title="No subject data" description="Finalize sessions to build subject reports." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-400 dark:border-ink-800">
                      <th className="px-5 py-3 font-semibold">Subject</th>
                      <th className="px-5 py-3 font-semibold">Class</th>
                      <th className="px-5 py-3 font-semibold">Sessions</th>
                      <th className="px-5 py-3 font-semibold">Present</th>
                      <th className="px-5 py-3 font-semibold">Absent</th>
                      <th className="px-5 py-3 font-semibold">Average</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                    {subjectRows.map((row) => (
                      <tr key={`${row.class_id}-${row.subject_id}`} className="hover:bg-ink-50/60 dark:hover:bg-ink-800/30">
                        <td className="px-5 py-3">
                          <p className="text-[13px] font-semibold text-ink-900 dark:text-white">
                            {row.subject_name}
                          </p>
                          <p className="text-[11px] text-ink-500 dark:text-ink-400">
                            {row.subject_code}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-[12px] text-ink-600 dark:text-ink-300">
                          {row.class_name}
                        </td>
                        <td className="px-5 py-3 text-[12px] tabular-nums text-ink-600 dark:text-ink-300">
                          {row.finalized_sessions}
                        </td>
                        <td className="px-5 py-3 text-[12px] tabular-nums text-emerald-600 dark:text-emerald-400">
                          {row.present}
                        </td>
                        <td className="px-5 py-3 text-[12px] tabular-nums text-rose-600 dark:text-rose-400">
                          {row.absent}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold tabular-nums text-ink-800 dark:text-ink-100">
                              {formatPercent(row.average_percentage)}
                            </span>
                            <ProgressBar value={row.average_percentage} className="h-1.5 w-20" />
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : tab === 'classes' ? (
        <>
          <div className="grid gap-5 xl:grid-cols-3">
            <Card className="xl:col-span-2">
              <CardHeader
                title="Average by class"
                description="All finalized attendance for each class"
              />
              <CardContent>
                {classQuery.loading && !classQuery.data ? (
                  <Skeleton className="h-[220px] w-full rounded-xl" />
                ) : (
                  <AverageChart data={classChart} />
                )}
              </CardContent>
            </Card>
            <Card>
              <CardHeader title="Class summary" />
              <CardContent className="space-y-4">
                <div>
                  <p className="text-xs text-ink-500 dark:text-ink-400">Classes</p>
                  <p className="text-2xl font-semibold text-ink-900 dark:text-white">
                    {classRows.length}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-500 dark:text-ink-400">Students</p>
                  <p className="text-2xl font-semibold text-ink-900 dark:text-white">
                    {classRows.reduce((sum, row) => sum + row.student_count, 0)}
                  </p>
                </div>
                <div>
                  <p className="text-xs text-ink-500 dark:text-ink-400">Below threshold</p>
                  <p className="text-2xl font-semibold text-rose-600 dark:text-rose-400">
                    {classRows.reduce((sum, row) => sum + row.below_threshold_count, 0)}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader title="Class-wise details" />
            {classQuery.loading && !classQuery.data ? (
              <TableSkeleton rows={5} cols={6} />
            ) : classRows.length === 0 ? (
              <EmptyState title="No class data" description="Finalize sessions to build class reports." />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-400 dark:border-ink-800">
                      <th className="px-5 py-3 font-semibold">Class</th>
                      <th className="px-5 py-3 font-semibold">Students</th>
                      <th className="px-5 py-3 font-semibold">Sessions</th>
                      <th className="px-5 py-3 font-semibold">Average</th>
                      <th className="px-5 py-3 font-semibold">Below threshold</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                    {classRows.map((row) => (
                      <tr key={row.class_id} className="hover:bg-ink-50/60 dark:hover:bg-ink-800/30">
                        <td className="px-5 py-3">
                          <p className="text-[13px] font-semibold text-ink-900 dark:text-white">
                            {row.class_name}
                          </p>
                          <p className="text-[11px] text-ink-500 dark:text-ink-400">
                            {row.department} · Sem {row.semester} · {row.academic_year}
                          </p>
                        </td>
                        <td className="px-5 py-3 text-[12px] tabular-nums text-ink-600 dark:text-ink-300">
                          {row.student_count}
                        </td>
                        <td className="px-5 py-3 text-[12px] tabular-nums text-ink-600 dark:text-ink-300">
                          {row.finalized_sessions}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-2">
                            <span className="text-[12px] font-semibold tabular-nums text-ink-800 dark:text-ink-100">
                              {formatPercent(row.average_percentage)}
                            </span>
                            <ProgressBar value={row.average_percentage} className="h-1.5 w-20" />
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={row.below_threshold_count > 0 ? 'danger' : 'success'}>
                            {row.below_threshold_count}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </>
      ) : (
        <Card>
          <CardHeader
            title="Attendance history"
            description="Every saved student status, including drafts unless filtered."
            action={
              history ? (
                <Badge tone="neutral">{history.total} records</Badge>
              ) : null
            }
          />
          {historyQuery.loading && !history ? (
            <TableSkeleton rows={9} cols={6} />
          ) : !history || history.items.length === 0 ? (
            <EmptyState
              title="No attendance records"
              description={
                statusFilter || search || classId
                  ? 'No records match these filters.'
                  : 'Mark attendance to start building the history log.'
              }
              icon={Rows3}
            />
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-sm">
                  <thead>
                    <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-400 dark:border-ink-800">
                      <th className="px-5 py-3 font-semibold">Date</th>
                      <th className="px-5 py-3 font-semibold">Student</th>
                      <th className="px-5 py-3 font-semibold">Class & subject</th>
                      <th className="px-5 py-3 font-semibold">Status</th>
                      <th className="px-5 py-3 font-semibold">Remarks</th>
                      <th className="px-5 py-3 font-semibold">Register</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                    {history.items.map((row) => (
                      <tr
                        key={`${row.session_id}-${row.student_id}`}
                        className="hover:bg-ink-50/60 dark:hover:bg-ink-800/30"
                      >
                        <td className="px-5 py-3">
                          <p className="text-[12px] font-medium text-ink-800 dark:text-ink-100">
                            {formatDate(row.session_date, 'dd MMM yyyy')}
                          </p>
                          <p className="text-[10px] text-ink-400">Session {row.session_number}</p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-[12px] font-semibold text-ink-800 dark:text-ink-100">
                            {row.student_name}
                          </p>
                          <p className="text-[10px] text-ink-400">{row.roll_number}</p>
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-[12px] text-ink-700 dark:text-ink-200">
                            {row.subject_name}
                          </p>
                          <p className="text-[10px] text-ink-400">{row.class_name}</p>
                        </td>
                        <td className="px-5 py-3">
                          <AttendanceBadge status={row.status} />
                        </td>
                        <td className="px-5 py-3 text-[11px] text-ink-500 dark:text-ink-400">
                          {row.remarks || '—'}
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={row.is_finalized ? 'success' : 'warning'} dot>
                            {row.is_finalized ? 'Finalized' : 'Draft'}
                          </Badge>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Pagination
                page={history.page}
                pageSize={history.page_size}
                total={history.total}
                onPageChange={setPage}
                className="border-t border-ink-100 dark:border-ink-800"
              />
            </>
          )}
        </Card>
      )}

      <p className="flex items-center gap-1.5 text-[11px] text-ink-400">
        <BarChart3 className="h-3.5 w-3.5" />
        Percentages only include finalized sessions. OD and leave counting follow the workspace
        attendance policy.
      </p>
    </div>
  )
}
