import { useEffect, useMemo, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import {
  CheckCheck,
  Download,
  FileSpreadsheet,
  Lock,
  LockOpen,
  Save,
  Search,
  Undo2,
  UsersRound,
} from 'lucide-react'
import { StatusSelector } from '@/components/attendance/StatusSelector'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button, buttonStyles } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { ErrorState, Skeleton, TableSkeleton } from '@/components/ui/Feedback'
import { ConfirmDialog } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { attendanceApi } from '@/services/api'
import { getErrorMessage } from '@/services/http'
import {
  attendanceMeta,
  cn,
  formatDate,
  formatDateTime,
  formatPercent,
} from '@/lib/utils'
import type { AttendanceStatus, SessionDetail } from '@/types'

interface DraftEntry {
  status: AttendanceStatus | null
  remarks: string
}

function buildDrafts(session: SessionDetail) {
  const drafts: Record<number, DraftEntry> = {}
  for (const entry of session.entries) {
    drafts[entry.student_id] = {
      status: entry.status,
      remarks: entry.remarks ?? '',
    }
  }
  return drafts
}

const statusOrder: AttendanceStatus[] = ['present', 'absent', 'od', 'leave']

export function AttendanceSessionPage() {
  const { sessionId } = useParams()
  const id = Number(sessionId)
  const { user } = useAuth()
  const toast = useToast()
  const base = user ? `/${user.role}` : '/faculty'
  const isAdmin = user?.role === 'admin'
  const [search, setSearch] = useState('')
  const [drafts, setDrafts] = useState<Record<number, DraftEntry>>({})
  const [initial, setInitial] = useState<Record<number, DraftEntry>>({})
  const [saving, setSaving] = useState(false)
  const [finalizing, setFinalizing] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [confirmFinalize, setConfirmFinalize] = useState(false)
  const [confirmUnlock, setConfirmUnlock] = useState(false)

  const { data, setData, loading, error, refresh } = useApiQuery(
    () => attendanceApi.getSession(id),
    [id],
    { enabled: Number.isFinite(id) && id > 0 },
  )

  useEffect(() => {
    if (!data) return
    const next = buildDrafts(data)
    setDrafts(next)
    setInitial(next)
  }, [data?.id])

  const applySession = (updated: SessionDetail) => {
    const next = buildDrafts(updated)
    setDrafts(next)
    setInitial(next)
    setData(updated)
  }

  const dirty = useMemo(() => {
    return Object.entries(drafts).some(([studentId, draft]) => {
      const before = initial[Number(studentId)]
      if (!before) return true
      return (
        draft.status !== before.status || draft.remarks.trim() !== before.remarks.trim()
      )
    })
  }, [drafts, initial])

  useEffect(() => {
    if (!dirty) return
    const handler = (event: BeforeUnloadEvent) => {
      event.preventDefault()
      event.returnValue = ''
    }
    window.addEventListener('beforeunload', handler)
    return () => window.removeEventListener('beforeunload', handler)
  }, [dirty])

  const counts = useMemo(() => {
    const summary = { present: 0, absent: 0, od: 0, leave: 0, unmarked: 0, total: 0 }
    for (const entry of data?.entries ?? []) {
      summary.total += 1
      const status = drafts[entry.student_id]?.status
      if (status) summary[status] += 1
      else summary.unmarked += 1
    }
    return summary
  }, [data?.entries, drafts])

  const missingActive = useMemo(
    () =>
      (data?.entries ?? []).filter(
        (entry) => entry.is_active && !drafts[entry.student_id]?.status,
      ).length,
    [data?.entries, drafts],
  )

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return data?.entries ?? []
    return (data?.entries ?? []).filter(
      (entry) =>
        entry.student_name.toLowerCase().includes(term) ||
        entry.roll_number.toLowerCase().includes(term),
    )
  }, [data?.entries, search])

  const setStatus = (studentId: number, status: AttendanceStatus) => {
    setDrafts((current) => ({
      ...current,
      [studentId]: { ...current[studentId], status },
    }))
  }

  const setRemarks = (studentId: number, remarks: string) => {
    setDrafts((current) => ({
      ...current,
      [studentId]: { ...current[studentId], remarks },
    }))
  }

  const markAllPresent = () => {
    if (!data) return
    const next = { ...drafts }
    for (const entry of data.entries) {
      if (entry.is_active) {
        next[entry.student_id] = { ...next[entry.student_id], status: 'present' }
      }
    }
    setDrafts(next)
    toast.info('All active students marked present', 'Review the roster, then save.')
  }

  const discardChanges = () => {
    setDrafts(initial)
    toast.info('Unsaved changes discarded')
  }

  const persist = async (): Promise<boolean> => {
    if (!data) return false
    const payload = data.entries
      .filter((entry) => {
        const draft = drafts[entry.student_id]
        const before = initial[entry.student_id]
        if (!draft || !draft.status) return false
        return (
          !before ||
          draft.status !== before.status ||
          draft.remarks.trim() !== before.remarks.trim()
        )
      })
      .map((entry) => ({
        student_id: entry.student_id,
        status: drafts[entry.student_id].status as AttendanceStatus,
        remarks: drafts[entry.student_id].remarks.trim() || null,
      }))
    if (payload.length === 0) return true
    setSaving(true)
    try {
      const updated = await attendanceApi.saveRecords(data.id, payload)
      applySession(updated)
      toast.success('Attendance saved', `${payload.length} student record${payload.length === 1 ? '' : 's'} updated.`)
      return true
    } catch (caught) {
      toast.error('Could not save attendance', getErrorMessage(caught))
      return false
    } finally {
      setSaving(false)
    }
  }

  const handleSave = async () => {
    await persist()
  }

  const handleFinalize = async () => {
    if (!data) return
    setFinalizing(true)
    try {
      if (dirty) {
        const saved = await persist()
        if (!saved) return
      }
      const updated = await attendanceApi.finalize(data.id, true)
      applySession(updated)
      setConfirmFinalize(false)
      toast.success('Session finalized', 'This register now contributes to attendance reports.')
    } catch (caught) {
      toast.error('Could not finalize session', getErrorMessage(caught))
    } finally {
      setFinalizing(false)
    }
  }

  const handleUnlock = async () => {
    if (!data) return
    setFinalizing(true)
    try {
      const updated = await attendanceApi.finalize(data.id, false)
      applySession(updated)
      setConfirmUnlock(false)
      toast.success('Session unlocked', 'You can edit this register again.')
    } catch (caught) {
      toast.error('Could not unlock session', getErrorMessage(caught))
    } finally {
      setFinalizing(false)
    }
  }

  const exportSession = async (format: 'csv' | 'xlsx') => {
    if (!data) return
    setExporting(format)
    try {
      await attendanceApi.exportSession(data.id, format)
    } catch (caught) {
      toast.error('Export failed', getErrorMessage(caught))
    } finally {
      setExporting(null)
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-6 w-40" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Card>
          <TableSkeleton rows={8} cols={4} />
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="Attendance register"
          backTo={`${base}/attendance`}
          backLabel="Attendance"
        />
        <Card>
          <ErrorState
            message={error ?? 'This session could not be found.'}
            onRetry={() => void refresh()}
          />
        </Card>
        <Link to={`${base}/attendance`} className={buttonStyles('secondary', 'md')}>
          Back to attendance
        </Link>
      </div>
    )
  }

  const finalized = data.is_finalized
  const presentPercentage = counts.total ? (counts.present / counts.total) * 100 : 0

  return (
    <div className="space-y-5">
      <PageHeader
        title={data.subject_name}
        eyebrow={`${data.subject_code} Â· ${data.class_name}`}
        description={
          <span className="inline-flex flex-wrap items-center gap-x-3 gap-y-1">
            <span>{formatDate(data.session_date, 'EEEE, dd MMMM yyyy')}</span>
            <span className="text-ink-300 dark:text-ink-600">Â·</span>
            <span>Session {data.session_number}</span>
            <span className="text-ink-300 dark:text-ink-600">Â·</span>
            <span>Recorded by {data.created_by_name}</span>
          </span>
        }
        backTo={`${base}/attendance`}
        backLabel="Attendance"
        actions={
          <>
            <Button
              variant="secondary"
              onClick={() => void exportSession('csv')}
              loading={exporting === 'csv'}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button
              variant="secondary"
              onClick={() => void exportSession('xlsx')}
              loading={exporting === 'xlsx'}
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            {finalized ? (
              isAdmin ? (
                <Button variant="secondary" onClick={() => setConfirmUnlock(true)}>
                  <LockOpen className="h-4 w-4" /> Unlock
                </Button>
              ) : null
            ) : (
              <Button
                onClick={() => setConfirmFinalize(true)}
                disabled={missingActive > 0 || dirty || saving}
                title={
                  missingActive > 0
                    ? `Mark ${missingActive} more active student${missingActive === 1 ? '' : 's'}`
                    : dirty
                      ? 'Save your changes before finalizing'
                      : 'Finalize this register'
                }
              >
                <Lock className="h-4 w-4" /> Finalize
              </Button>
            )}
          </>
        }
      />

      {finalized ? (
        <div className="flex items-start gap-3 rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 dark:border-emerald-500/20 dark:bg-emerald-500/10">
          <Lock className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
          <div className="text-sm">
            <p className="font-semibold text-emerald-800 dark:text-emerald-200">
              This register is finalized and locked
            </p>
            <p className="mt-0.5 text-[13px] leading-5 text-emerald-700/80 dark:text-emerald-300/80">
              Finalized on {formatDateTime(data.finalized_at)} by {data.finalized_by_name ?? 'staff'}.
              {isAdmin
                ? ' Unlock it to make corrections; unlocking is recorded in the audit log.'
                : ' Ask an administrator to unlock it if a correction is needed.'}
            </p>
          </div>
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {[
          { key: 'present', label: 'Present', value: counts.present, tone: 'text-emerald-600 dark:text-emerald-400' },
          { key: 'absent', label: 'Absent', value: counts.absent, tone: 'text-rose-600 dark:text-rose-400' },
          { key: 'od', label: 'On duty', value: counts.od, tone: 'text-sky-600 dark:text-sky-400' },
          { key: 'leave', label: 'Leave', value: counts.leave, tone: 'text-amber-600 dark:text-amber-400' },
          { key: 'unmarked', label: 'Unmarked', value: counts.unmarked, tone: 'text-ink-500 dark:text-ink-400' },
        ].map((item) => (
          <div
            key={item.key}
            className="rounded-xl border border-ink-200/80 bg-white px-4 py-3 shadow-soft dark:border-ink-800 dark:bg-ink-900"
          >
            <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
              <span
                className={cn(
                  'h-1.5 w-1.5 rounded-full',
                  item.key === 'unmarked'
                    ? 'bg-ink-300 dark:bg-ink-600'
                    : attendanceMeta[item.key as AttendanceStatus].dot,
                )}
              />
              {item.label}
            </p>
            <p className={cn('mt-1 text-xl font-semibold tabular-nums', item.tone)}>
              {item.value}
            </p>
          </div>
        ))}
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 sm:flex-row sm:items-center sm:justify-between dark:border-ink-800">
          <div className="relative flex-1 sm:max-w-xs">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search studentâ€¦"
              aria-label="Search roster"
              className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-sm shadow-sm placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-white"
            />
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs text-ink-500 dark:text-ink-400">
              <span className="font-semibold text-ink-700 dark:text-ink-200">
                {formatPercent(presentPercentage)}
              </span>{' '}
              present Â· {counts.total} on roster
            </span>
            {!finalized ? (
              <Button variant="secondary" size="sm" onClick={markAllPresent}>
                <CheckCheck className="h-3.5 w-3.5" /> Mark all present
              </Button>
            ) : null}
          </div>
        </div>

        {filteredEntries.length === 0 ? (
          <div className="flex flex-col items-center gap-2 px-4 py-12 text-center">
            <UsersRound className="h-6 w-6 text-ink-300" />
            <p className="text-sm font-medium text-ink-700 dark:text-ink-200">
              No students match â€œ{search}â€
            </p>
            <Button variant="ghost" size="sm" onClick={() => setSearch('')}>
              Clear search
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-400 dark:border-ink-800">
                    <th className="px-5 py-3 font-semibold">Student</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Remarks</th>
                    <th className="px-5 py-3 font-semibold">Last updated</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {filteredEntries.map((entry) => {
                    const draft = drafts[entry.student_id] ?? { status: null, remarks: '' }
                    return (
                      <tr
                        key={entry.student_id}
                        className={cn(
                          'transition-colors',
                          draft.status === 'absent'
                            ? 'bg-rose-50/40 dark:bg-rose-500/[0.04]'
                            : 'hover:bg-ink-50/60 dark:hover:bg-ink-800/30',
                        )}
                      >
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={entry.student_name} size="sm" />
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 text-[13px] font-semibold text-ink-900 dark:text-white">
                                {entry.student_name}
                                {!entry.is_active ? (
                                  <Badge tone="neutral" className="text-[9px]">
                                    Inactive
                                  </Badge>
                                ) : null}
                              </p>
                              <p className="text-[11px] text-ink-500 dark:text-ink-400">
                                {entry.roll_number}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <StatusSelector
                            value={draft.status}
                            onChange={(status) => setStatus(entry.student_id, status)}
                            disabled={finalized}
                          />
                        </td>
                        <td className="px-5 py-3">
                          <input
                            value={draft.remarks}
                            onChange={(event) => setRemarks(entry.student_id, event.target.value)}
                            disabled={finalized}
                            maxLength={500}
                            placeholder="Optional note"
                            aria-label={`Remarks for ${entry.student_name}`}
                            className="h-8 w-full min-w-[140px] rounded-lg border border-transparent bg-transparent px-2 text-xs text-ink-700 placeholder:text-ink-400 hover:border-ink-200 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:cursor-not-allowed dark:text-ink-200 dark:hover:border-ink-700 dark:focus:bg-ink-900"
                          />
                        </td>
                        <td className="px-5 py-3">
                          <p className="text-[11px] text-ink-500 dark:text-ink-400">
                            {entry.updated_at ? formatDateTime(entry.updated_at) : 'Not saved'}
                          </p>
                          {entry.updated_by_name ? (
                            <p className="text-[10px] text-ink-400">
                              by {entry.updated_by_name}
                            </p>
                          ) : null}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-ink-100 md:hidden dark:divide-ink-800">
              {filteredEntries.map((entry) => {
                const draft = drafts[entry.student_id] ?? { status: null, remarks: '' }
                return (
                  <li
                    key={entry.student_id}
                    className={cn(
                      'p-4',
                      draft.status === 'absent' && 'bg-rose-50/40 dark:bg-rose-500/[0.04]',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <Avatar name={entry.student_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">
                          {entry.student_name}
                        </p>
                        <p className="text-[11px] text-ink-500 dark:text-ink-400">
                          {entry.roll_number}
                          {!entry.is_active ? ' Â· Inactive' : ''}
                        </p>
                        <div className="mt-2.5 flex flex-wrap items-center gap-2">
                          <StatusSelector
                            value={draft.status}
                            onChange={(status) => setStatus(entry.student_id, status)}
                            disabled={finalized}
                            compact={false}
                          />
                        </div>
                        <input
                          value={draft.remarks}
                          onChange={(event) => setRemarks(entry.student_id, event.target.value)}
                          disabled={finalized}
                          maxLength={500}
                          placeholder="Optional remarks"
                          aria-label={`Remarks for ${entry.student_name}`}
                          className="mt-2 h-8 w-full rounded-lg border border-ink-200 bg-white px-2.5 text-xs text-ink-700 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 disabled:bg-ink-50 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:disabled:bg-ink-800"
                        />
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        <CardContent className="flex flex-col gap-2 border-t border-ink-100 py-3 text-[11px] text-ink-500 sm:flex-row sm:items-center sm:justify-between dark:border-ink-800 dark:text-ink-400">
          <span>
            {missingActive > 0 && !finalized
              ? `${missingActive} active student${missingActive === 1 ? '' : 's'} still unmarked before finalizing.`
              : 'All active students are marked.'}
          </span>
          {data.notes ? <span className="truncate">Note: {data.notes}</span> : null}
        </CardContent>
      </Card>

      {dirty && !finalized ? (
        <div className="sticky bottom-20 z-20 lg:bottom-4">
          <div className="flex flex-col gap-3 rounded-xl border border-brand-200 bg-white/95 p-3 shadow-card-hover backdrop-blur sm:flex-row sm:items-center dark:border-brand-500/30 dark:bg-ink-900/95">
            <p className="flex-1 text-xs font-medium text-ink-600 dark:text-ink-300">
              You have unsaved attendance changes.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={discardChanges} disabled={saving}>
                <Undo2 className="h-3.5 w-3.5" /> Discard
              </Button>
              <Button size="sm" onClick={() => void handleSave()} loading={saving}>
                <Save className="h-3.5 w-3.5" /> Save changes
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={confirmFinalize}
        onClose={() => setConfirmFinalize(false)}
        onConfirm={handleFinalize}
        loading={finalizing}
        title="Finalize this register?"
        confirmLabel="Finalize register"
        description={
          <>
            Finalizing locks this register, includes it in attendance percentages and trends, and
            records the action in the audit log.
            {isAdmin
              ? ' You can unlock it later if a correction is needed.'
              : ' Only an administrator can unlock it afterwards.'}
          </>
        }
      />

      <ConfirmDialog
        open={confirmUnlock}
        onClose={() => setConfirmUnlock(false)}
        onConfirm={handleUnlock}
        loading={finalizing}
        tone="danger"
        title="Unlock this register?"
        confirmLabel="Unlock register"
        description="Unlocking removes this session from attendance reports until it is finalized again. The unlock is recorded in the audit log."
      />
    </div>
  )
}

