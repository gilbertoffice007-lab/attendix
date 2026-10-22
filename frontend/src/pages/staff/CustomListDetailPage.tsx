import { useEffect, useMemo, useState } from 'react'
import { useParams } from 'react-router-dom'
import {
  Archive,
  ArchiveRestore,
  CalendarClock,
  Check,
  ChevronDown,
  Download,
  Eye,
  EyeOff,
  FileSpreadsheet,
  Plus,
  Save,
  Search,
  Settings2,
  Undo2,
  UserPlus,
  UsersRound,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge, ListStatusBadge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Alert, EmptyState, ErrorState, Skeleton, TableSkeleton } from '@/components/ui/Feedback'
import { Input, Switch, Textarea } from '@/components/ui/Input'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { ProgressBar } from '@/components/ui/ProgressBar'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { classesApi, customListsApi } from '@/services/api'
import { getErrorMessage } from '@/services/http'
import {
  cn,
  formatDate,
  formatDateTime,
  formatPercent,
  listColorClasses,
  slugify,
  statusColorChoices,
} from '@/lib/utils'
import type { CustomListDetail, StatusColor, StatusOption } from '@/types'

interface DraftEntry {
  status: string
  remarks: string
}

function buildDrafts(list: CustomListDetail) {
  const drafts: Record<number, DraftEntry> = {}
  for (const entry of list.entries) {
    drafts[entry.id] = { status: entry.status, remarks: entry.remarks ?? '' }
  }
  return drafts
}

function nextOptionKey(options: StatusOption[]) {
  const keys = new Set(options.map((option) => option.key))
  let index = options.length + 1
  while (keys.has(`status_${index}`)) index += 1
  return `status_${index}`
}

function EditListForm({
  list,
  onDone,
}: {
  list: CustomListDetail
  onDone: (updated: CustomListDetail) => void
}) {
  const toast = useToast()
  const [title, setTitle] = useState(list.title)
  const [description, setDescription] = useState(list.description ?? '')
  const [dueDate, setDueDate] = useState(list.due_date ?? '')
  const [visible, setVisible] = useState(list.visible_to_students)
  const [options, setOptions] = useState<StatusOption[]>(
    list.status_options.map((option) => ({ ...option })),
  )
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (title.trim().length < 2) {
      setError('Give the list a title with at least 2 characters.')
      return
    }
    const cleaned = options.map((option) => ({ ...option, label: option.label.trim() }))
    if (cleaned.some((option) => !option.label)) {
      setError('Every status needs a label.')
      return
    }
    if (new Set(cleaned.map((option) => option.label.toLowerCase())).size !== cleaned.length) {
      setError('Status labels must be unique.')
      return
    }
    setSaving(true)
    try {
      const updated = await customListsApi.update(list.id, {
        title: title.trim(),
        description: description.trim() || null,
        due_date: dueDate || null,
        visible_to_students: visible,
        status_options: cleaned,
      })
      toast.success('List settings updated')
      onDone(updated)
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form id="edit-list-form" onSubmit={submit} className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      <Input
        label="Title"
        required
        value={title}
        onChange={(event) => setTitle(event.target.value)}
        maxLength={180}
      />
      <Textarea
        label="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        maxLength={2000}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Due date"
          type="date"
          value={dueDate}
          onChange={(event) => setDueDate(event.target.value)}
        />
        <div className="flex items-center rounded-xl border border-ink-200 px-3.5 py-2 dark:border-ink-700">
          <Switch
            checked={visible}
            onChange={setVisible}
            label="Visible to students"
            description="Show in the student portal"
          />
        </div>
      </div>
      <div>
        <div className="mb-2 flex items-center justify-between">
          <p className="text-sm font-medium text-ink-700 dark:text-ink-300">Status options</p>
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => {
              if (options.length >= 20) return
              setOptions((current) => [
                ...current,
                { key: nextOptionKey(current), label: '', color: 'slate' },
              ])
            }}
            disabled={options.length >= 20}
          >
            <Plus className="h-3.5 w-3.5" /> Add
          </Button>
        </div>
        <div className="space-y-2">
          {options.map((option, index) => (
            <div
              key={option.key}
              className="flex items-center gap-2 rounded-lg border border-ink-200 p-2 dark:border-ink-700"
            >
              <input
                value={option.label}
                onChange={(event) =>
                  setOptions((current) =>
                    current.map((item, position) =>
                      position === index ? { ...item, label: event.target.value } : item,
                    ),
                  )
                }
                aria-label={`Status ${index + 1} label`}
                maxLength={80}
                className="h-8 min-w-0 flex-1 rounded-md border border-ink-200 bg-white px-2 text-sm text-ink-800 focus:border-brand-400 focus:outline-none dark:border-ink-700 dark:bg-ink-800 dark:text-white"
              />
              <div className="flex items-center gap-1">
                {statusColorChoices.map((color) => (
                  <button
                    key={color}
                    type="button"
                    onClick={() =>
                      setOptions((current) =>
                        current.map((item, position) =>
                          position === index
                            ? { ...item, color: color as StatusColor }
                            : item,
                        ),
                      )
                    }
                    className={cn(
                      'h-3.5 w-3.5 rounded-full ring-offset-1 transition',
                      listColorClasses[color].dot,
                      option.color === color
                        ? 'ring-2 ring-ink-400 dark:ring-ink-300'
                        : 'hover:scale-110',
                    )}
                    aria-label={`Set ${option.label || 'status'} colour to ${color}`}
                  />
                ))}
              </div>
            </div>
          ))}
        </div>
        <p className="mt-1.5 text-[11px] text-ink-400">
          Existing statuses cannot be removed while entries still use them.
        </p>
      </div>
      <button type="submit" className="hidden" aria-hidden />
      {saving ? (
        <p className="text-xs font-medium text-brand-600 dark:text-brand-400">Saving…</p>
      ) : null}
    </form>
  )
}

function AddStudentsForm({
  list,
  onDone,
}: {
  list: CustomListDetail
  onDone: (updated: CustomListDetail) => void
}) {
  const toast = useToast()
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [search, setSearch] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const { data: students, loading } = useApiQuery(
    () => classesApi.students(list.class_id),
    [list.class_id],
  )
  const existing = useMemo(() => new Set(list.entries.map((entry) => entry.student_id)), [list.entries])
  const available = useMemo(
    () =>
      (students ?? []).filter(
        (student) =>
          student.is_active &&
          !existing.has(student.id) &&
          (!search.trim() ||
            student.full_name.toLowerCase().includes(search.trim().toLowerCase()) ||
            student.roll_number.toLowerCase().includes(search.trim().toLowerCase())),
      ),
    [students, existing, search],
  )

  const toggle = (id: number) => {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    if (selected.size === 0) return
    setSaving(true)
    setError(null)
    try {
      const result = await customListsApi.addEntries(list.id, Array.from(selected))
      toast.success(`${result.added} students added`, `${result.skipped} already on the list.`)
      onDone(result.list)
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form id="add-students-form" onSubmit={submit} className="space-y-3">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search active students…"
          aria-label="Search students to add"
          className="h-9 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
        />
      </div>
      <div className="max-h-72 overflow-y-auto rounded-xl border border-ink-200 dark:border-ink-700">
        {loading ? (
          <div className="space-y-2 p-3">
            {[0, 1, 2].map((item) => (
              <div key={item} className="skeleton h-10 w-full rounded-lg" />
            ))}
          </div>
        ) : available.length === 0 ? (
          <p className="px-4 py-10 text-center text-sm text-ink-500 dark:text-ink-400">
            Every eligible student is already on this list.
          </p>
        ) : (
          <ul className="divide-y divide-ink-100 dark:divide-ink-800">
            {available.map((student) => {
              const checked = selected.has(student.id)
              return (
                <li key={student.id}>
                  <label className="flex cursor-pointer items-center gap-3 px-3 py-2.5 hover:bg-ink-50 dark:hover:bg-ink-800/40">
                    <span
                      className={cn(
                        'flex h-4 w-4 shrink-0 items-center justify-center rounded border',
                        checked
                          ? 'border-brand-600 bg-brand-600 text-white'
                          : 'border-ink-300 dark:border-ink-600',
                      )}
                    >
                      {checked ? <Check className="h-3 w-3" strokeWidth={3} /> : null}
                    </span>
                    <input
                      type="checkbox"
                      className="sr-only"
                      checked={checked}
                      onChange={() => toggle(student.id)}
                    />
                    <Avatar name={student.full_name} size="sm" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium text-ink-800 dark:text-ink-100">
                        {student.full_name}
                      </span>
                      <span className="block text-[11px] text-ink-400">
                        {student.roll_number}
                      </span>
                    </span>
                  </label>
                </li>
              )
            })}
          </ul>
        )}
      </div>
      <p className="text-xs text-ink-500 dark:text-ink-400">
        {selected.size} selected · new entries start on{' '}
        <span className="font-semibold">{list.status_options[0]?.label}</span>
      </p>
      <button type="submit" className="hidden" aria-hidden />
      {saving ? <p className="text-xs text-brand-600">Adding students…</p> : null}
    </form>
  )
}

export function CustomListDetailPage() {
  const { listId } = useParams()
  const id = Number(listId)
  const { user } = useAuth()
  const toast = useToast()
  const base = user ? `/${user.role}` : '/faculty'
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [drafts, setDrafts] = useState<Record<number, DraftEntry>>({})
  const [initial, setInitial] = useState<Record<number, DraftEntry>>({})
  const [bulkStatus, setBulkStatus] = useState('')
  const [saving, setSaving] = useState(false)
  const [working, setWorking] = useState(false)
  const [exporting, setExporting] = useState<string | null>(null)
  const [editOpen, setEditOpen] = useState(false)
  const [addOpen, setAddOpen] = useState(false)
  const [archiveConfirm, setArchiveConfirm] = useState(false)
  const [bulkAll, setBulkAll] = useState(false)
  const [bulkAllStatus, setBulkAllStatus] = useState('')

  const { data, setData, loading, error, refresh } = useApiQuery(
    () => customListsApi.get(id),
    [id],
    { enabled: Number.isFinite(id) && id > 0 },
  )

  useEffect(() => {
    if (!data) return
    const next = buildDrafts(data)
    setDrafts(next)
    setInitial(next)
    setBulkStatus(data.status_options[0]?.key ?? '')
    setSelected(new Set())
  }, [data?.id])

  const applyList = (updated: CustomListDetail) => {
    const next = buildDrafts(updated)
    setDrafts(next)
    setInitial(next)
    setData(updated)
    setSelected(new Set())
  }

  const dirty = useMemo(
    () =>
      Object.entries(drafts).some(([entryId, draft]) => {
        const before = initial[Number(entryId)]
        return (
          !before ||
          draft.status !== before.status ||
          draft.remarks.trim() !== before.remarks.trim()
        )
      }),
    [drafts, initial],
  )

  const counts = useMemo(() => {
    const total = data?.entries.length ?? 0
    const result: Record<string, number> = {}
    for (const option of data?.status_options ?? []) result[option.key] = 0
    for (const entry of data?.entries ?? []) {
      result[entry.status] = (result[entry.status] ?? 0) + 1
    }
    return { total, result }
  }, [data])

  const filteredEntries = useMemo(() => {
    const term = search.trim().toLowerCase()
    return (data?.entries ?? []).filter((entry) => {
      if (statusFilter && entry.status !== statusFilter) return false
      if (!term) return true
      return (
        entry.student_name.toLowerCase().includes(term) ||
        entry.roll_number.toLowerCase().includes(term)
      )
    })
  }, [data?.entries, search, statusFilter])

  const allFilteredSelected =
    filteredEntries.length > 0 && filteredEntries.every((entry) => selected.has(entry.id))

  const toggleAll = () => {
    setSelected((current) => {
      const next = new Set(current)
      if (allFilteredSelected) filteredEntries.forEach((entry) => next.delete(entry.id))
      else filteredEntries.forEach((entry) => next.add(entry.id))
      return next
    })
  }

  const updateDraft = (entryId: number, patch: Partial<DraftEntry>) => {
    setDrafts((current) => ({
      ...current,
      [entryId]: { ...current[entryId], ...patch },
    }))
  }

  const discard = () => {
    setDrafts(initial)
    toast.info('Unsaved changes discarded')
  }

  const saveChanges = async () => {
    if (!data) return
    const changed = data.entries.filter((entry) => {
      const draft = drafts[entry.id]
      const before = initial[entry.id]
      return (
        draft &&
        before &&
        (draft.status !== before.status ||
          draft.remarks.trim() !== before.remarks.trim())
      )
    })
    if (changed.length === 0) return
    setSaving(true)
    try {
      for (const entry of changed) {
        const draft = drafts[entry.id]
        await customListsApi.updateEntry(data.id, entry.id, {
          status: draft.status,
          remarks: draft.remarks.trim() || null,
        })
      }
      const updated = await customListsApi.get(data.id)
      applyList(updated)
      toast.success('List updated', `${changed.length} entr${changed.length === 1 ? 'y' : 'ies'} saved.`)
    } catch (caught) {
      toast.error('Could not save changes', getErrorMessage(caught))
      await refresh(true)
    } finally {
      setSaving(false)
    }
  }

  const applySelected = async () => {
    if (!data || selected.size === 0 || !bulkStatus) return
    setWorking(true)
    try {
      await customListsApi.bulkUpdate(data.id, {
        entry_ids: Array.from(selected),
        status: bulkStatus,
      })
      const updated = await customListsApi.get(data.id)
      applyList(updated)
      toast.success('Statuses updated', `${selected.size} entries updated.`)
    } catch (caught) {
      toast.error('Could not update statuses', getErrorMessage(caught))
    } finally {
      setWorking(false)
    }
  }

  const applyAll = async () => {
    if (!data || !bulkAllStatus) return
    setWorking(true)
    try {
      await customListsApi.bulkUpdate(data.id, {
        apply_to_all: true,
        status: bulkAllStatus,
      })
      const updated = await customListsApi.get(data.id)
      applyList(updated)
      setBulkAll(false)
      toast.success('All entries updated')
    } catch (caught) {
      toast.error('Could not update entries', getErrorMessage(caught))
    } finally {
      setWorking(false)
    }
  }

  const toggleArchive = async () => {
    if (!data) return
    setWorking(true)
    try {
      const updated = await customListsApi.archive(data.id, !data.is_archived)
      applyList(updated)
      setArchiveConfirm(false)
      toast.success(updated.is_archived ? 'List archived' : 'List restored')
    } catch (caught) {
      toast.error('Could not update list', getErrorMessage(caught))
    } finally {
      setWorking(false)
    }
  }

  const exportList = async (format: 'csv' | 'xlsx') => {
    if (!data) return
    setExporting(format)
    try {
      await customListsApi.exportList(data.id, format)
    } catch (caught) {
      toast.error('Export failed', getErrorMessage(caught))
    } finally {
      setExporting(null)
    }
  }

  if (loading && !data) {
    return (
      <div className="space-y-5">
        <Skeleton className="h-6 w-48" />
        <Skeleton className="h-24 w-full rounded-2xl" />
        <Card>
          <TableSkeleton rows={7} cols={5} />
        </Card>
      </div>
    )
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <PageHeader
          title="List detail"
          backTo={`${base}/custom-lists`}
          backLabel="Custom lists"
        />
        <Card>
          <ErrorState
            message={error ?? 'This list could not be found.'}
            onRetry={() => void refresh()}
          />
        </Card>
      </div>
    )
  }

  const archived = data.is_archived
  const disabled = archived || working
  const bulkOptions = data.status_options.map((option) => ({
    value: option.key,
    label: option.label,
  }))

  return (
    <div className="space-y-5">
      <PageHeader
        title={data.title}
        eyebrow={`${data.class_name} · Created by ${data.creator_name}`}
        backTo={`${base}/custom-lists`}
        backLabel="Custom lists"
        description={
          <span className="flex flex-wrap items-center gap-2">
            <Badge tone={archived ? 'neutral' : 'success'} dot>
              {archived ? 'Archived' : 'Active'}
            </Badge>
            <Badge tone={data.visible_to_students ? 'info' : 'neutral'}>
              {data.visible_to_students ? (
                <>
                  <Eye className="h-3 w-3" /> Visible to students
                </>
              ) : (
                <>
                  <EyeOff className="h-3 w-3" /> Staff only
                </>
              )}
            </Badge>
            {data.due_date ? (
              <span className="inline-flex items-center gap-1 text-xs text-ink-500 dark:text-ink-400">
                <CalendarClock className="h-3.5 w-3.5" /> Due {formatDate(data.due_date)}
              </span>
            ) : null}
          </span>
        }
        actions={
          <>
            <Button
              variant="secondary"
              size="md"
              onClick={() => void exportList('csv')}
              loading={exporting === 'csv'}
            >
              <Download className="h-4 w-4" /> CSV
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => void exportList('xlsx')}
              loading={exporting === 'xlsx'}
            >
              <FileSpreadsheet className="h-4 w-4" /> Excel
            </Button>
            <Button
              variant="secondary"
              size="md"
              onClick={() => setEditOpen(true)}
              disabled={archived}
              title={archived ? 'Restore the list to edit its settings' : undefined}
            >
              <Settings2 className="h-4 w-4" /> Edit
            </Button>
            <Button
              variant={archived ? 'success' : 'secondary'}
              size="md"
              onClick={() => setArchiveConfirm(true)}
            >
              {archived ? (
                <>
                  <ArchiveRestore className="h-4 w-4" /> Restore
                </>
              ) : (
                <>
                  <Archive className="h-4 w-4" /> Archive
                </>
              )}
            </Button>
          </>
        }
      />

      {archived ? (
        <Alert tone="warning" title="This list is archived">
          It is read-only and hidden from active lists. Restore it to change statuses, add students
          or update settings.
        </Alert>
      ) : null}

      {data.description ? (
        <p className="max-w-4xl text-sm leading-6 text-ink-600 dark:text-ink-300">
          {data.description}
        </p>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-800 dark:bg-ink-900">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
            On this list
          </p>
          <p className="mt-1 text-2xl font-semibold text-ink-900 dark:text-white">
            {counts.total}
          </p>
          <p className="mt-1 text-[11px] text-ink-500 dark:text-ink-400">
            students tracked
          </p>
        </div>
        {data.status_options.map((option) => {
          const value = counts.result[option.key] ?? 0
          const percent = counts.total ? (value / counts.total) * 100 : 0
          const palette = listColorClasses[option.color]
          return (
            <div
              key={option.key}
              className="rounded-2xl border border-ink-200/80 bg-white p-4 shadow-card dark:border-ink-800 dark:bg-ink-900"
            >
              <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                <span className={cn('h-1.5 w-1.5 rounded-full', palette.dot)} />
                {option.label}
              </p>
              <div className="mt-1 flex items-baseline gap-2">
                <p className="text-2xl font-semibold text-ink-900 dark:text-white">{value}</p>
                <span className="text-[11px] text-ink-500 dark:text-ink-400">
                  {formatPercent(percent)}
                </span>
              </div>
              <ProgressBar
                value={percent}
                barClassName={palette.solid}
                className="mt-2 h-1.5"
              />
            </div>
          )
        })}
      </div>

      <Card>
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 dark:border-ink-800">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-ink-900 dark:text-white">Roster</h2>
              <p className="text-xs text-ink-500 dark:text-ink-400">
                {data.entries.length} students · last updated {formatDateTime(data.updated_at)}
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {!archived ? (
                <Button variant="secondary" size="sm" onClick={() => setAddOpen(true)}>
                  <UserPlus className="h-3.5 w-3.5" /> Add students
                </Button>
              ) : null}
            </div>
          </div>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center">
            <div className="relative flex-1 lg:max-w-xs">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search students…"
                aria-label="Search list entries"
                className="h-9 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
              />
            </div>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              aria-label="Filter by status"
              className="h-9 rounded-xl border border-ink-200 bg-white px-3 text-xs text-ink-700 focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
            >
              <option value="">All statuses</option>
              {data.status_options.map((option) => (
                <option key={option.key} value={option.key}>
                  {option.label}
                </option>
              ))}
            </select>
            {!archived ? (
              <>
                <div className="hidden h-6 w-px bg-ink-200 lg:block dark:bg-ink-700" />
                <span className="text-[11px] font-medium text-ink-500 dark:text-ink-400">
                  {selected.size} selected
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={bulkStatus}
                    onChange={(event) => setBulkStatus(event.target.value)}
                    aria-label="Bulk status"
                    className="h-9 rounded-xl border border-ink-200 bg-white px-3 text-xs text-ink-700 focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
                  >
                    {bulkOptions.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => void applySelected()}
                    disabled={selected.size === 0 || working}
                    loading={working && selected.size > 0}
                  >
                    Apply to selected
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setBulkAllStatus(bulkStatus)
                      setBulkAll(true)
                    }}
                    disabled={working || data.entries.length === 0}
                  >
                    Apply to all
                  </Button>
                </div>
              </>
            ) : null}
          </div>
        </div>

        {data.entries.length === 0 ? (
          <EmptyState
            icon={UsersRound}
            title="No students on this list yet"
            description="Add students from the class roster to start tracking their status."
            action={
              !archived ? (
                <Button onClick={() => setAddOpen(true)}>
                  <UserPlus className="h-4 w-4" /> Add students
                </Button>
              ) : undefined
            }
          />
        ) : filteredEntries.length === 0 ? (
          <div className="px-4 py-12 text-center">
            <p className="text-sm font-medium text-ink-700 dark:text-ink-200">
              No entries match these filters
            </p>
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => {
                setSearch('')
                setStatusFilter('')
              }}
            >
              Clear filters
            </Button>
          </div>
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-400 dark:border-ink-800">
                    {!archived ? (
                      <th className="w-10 px-4 py-3">
                        <input
                          type="checkbox"
                          checked={allFilteredSelected}
                          onChange={toggleAll}
                          aria-label="Select all visible entries"
                          className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500 dark:border-ink-600 dark:bg-ink-900"
                        />
                      </th>
                    ) : (
                      <th className="w-10 px-4 py-3" />
                    )}
                    <th className="px-4 py-3 font-semibold">Student</th>
                    <th className="px-4 py-3 font-semibold">Status</th>
                    <th className="px-4 py-3 font-semibold">Remarks</th>
                    <th className="px-4 py-3 font-semibold">Last updated</th>
                    <th className="px-4 py-3 font-semibold">By</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {filteredEntries.map((entry) => {
                    const draft = drafts[entry.id] ?? { status: entry.status, remarks: '' }
                    const option = data.status_options.find((item) => item.key === draft.status)
                    const palette = listColorClasses[option?.color ?? 'slate']
                    return (
                      <tr
                        key={entry.id}
                        className={cn(
                          'transition-colors hover:bg-ink-50/60 dark:hover:bg-ink-800/30',
                          selected.has(entry.id) && 'bg-brand-50/40 dark:bg-brand-500/[0.04]',
                        )}
                      >
                        <td className="px-4 py-3">
                          {!archived ? (
                            <input
                              type="checkbox"
                              checked={selected.has(entry.id)}
                              onChange={() =>
                                setSelected((current) => {
                                  const next = new Set(current)
                                  if (next.has(entry.id)) next.delete(entry.id)
                                  else next.add(entry.id)
                                  return next
                                })
                              }
                              aria-label={`Select ${entry.student_name}`}
                              className="h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500 dark:border-ink-600 dark:bg-ink-900"
                            />
                          ) : null}
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2.5">
                            <Avatar name={entry.student_name} size="sm" />
                            <div className="min-w-0">
                              <p className="truncate text-[13px] font-semibold text-ink-900 dark:text-white">
                                {entry.student_name}
                              </p>
                              <p className="text-[11px] text-ink-500 dark:text-ink-400">
                                {entry.roll_number}
                                {!entry.student_active ? ' · Inactive' : ''}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-3">
                          {archived ? (
                            <ListStatusBadge status={entry.status} options={data.status_options} />
                          ) : (
                            <div className="relative inline-block">
                              <select
                                value={draft.status}
                                onChange={(event) =>
                                  updateDraft(entry.id, { status: event.target.value })
                                }
                                aria-label={`Status for ${entry.student_name}`}
                                className={cn(
                                  'h-8 appearance-none rounded-full py-0 pl-3 pr-7 text-[11px] font-semibold ring-1 ring-inset focus:outline-none focus:ring-2',
                                  palette.badge,
                                )}
                              >
                                {data.status_options.map((item) => (
                                  <option key={item.key} value={item.key}>
                                    {item.label}
                                  </option>
                                ))}
                              </select>
                              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 opacity-60" />
                            </div>
                          )}
                        </td>
                        <td className="px-4 py-3">
                          {archived ? (
                            <span className="text-xs text-ink-500 dark:text-ink-400">
                              {entry.remarks || '—'}
                            </span>
                          ) : (
                            <input
                              value={draft.remarks}
                              onChange={(event) =>
                                updateDraft(entry.id, { remarks: event.target.value })
                              }
                              maxLength={500}
                              placeholder="Optional note"
                              aria-label={`Remarks for ${entry.student_name}`}
                              className="h-8 w-full min-w-[160px] rounded-lg border border-transparent bg-transparent px-2 text-xs text-ink-700 placeholder:text-ink-400 hover:border-ink-200 focus:border-brand-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:text-ink-200 dark:hover:border-ink-700 dark:focus:bg-ink-900"
                            />
                          )}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-ink-500 dark:text-ink-400">
                          {formatDateTime(entry.updated_at)}
                        </td>
                        <td className="px-4 py-3 text-[11px] text-ink-500 dark:text-ink-400">
                          {entry.updated_by_name ?? '—'}
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-ink-100 md:hidden dark:divide-ink-800">
              {filteredEntries.map((entry) => {
                const draft = drafts[entry.id] ?? { status: entry.status, remarks: '' }
                return (
                  <li
                    key={entry.id}
                    className={cn(
                      'p-4',
                      selected.has(entry.id) && 'bg-brand-50/40 dark:bg-brand-500/[0.04]',
                    )}
                  >
                    <div className="flex items-start gap-3">
                      {!archived ? (
                        <input
                          type="checkbox"
                          checked={selected.has(entry.id)}
                          onChange={() =>
                            setSelected((current) => {
                              const next = new Set(current)
                              if (next.has(entry.id)) next.delete(entry.id)
                              else next.add(entry.id)
                              return next
                            })
                          }
                          aria-label={`Select ${entry.student_name}`}
                          className="mt-1 h-4 w-4 rounded border-ink-300 text-brand-600 focus:ring-brand-500 dark:border-ink-600 dark:bg-ink-900"
                        />
                      ) : null}
                      <Avatar name={entry.student_name} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">
                          {entry.student_name}
                        </p>
                        <p className="text-[11px] text-ink-500 dark:text-ink-400">
                          {entry.roll_number}
                          {!entry.student_active ? ' · Inactive' : ''}
                        </p>
                        <div className="mt-2 flex flex-wrap items-center gap-2">
                          {archived ? (
                            <ListStatusBadge status={entry.status} options={data.status_options} />
                          ) : (
                            <select
                              value={draft.status}
                              onChange={(event) =>
                                updateDraft(entry.id, { status: event.target.value })
                              }
                              aria-label={`Status for ${entry.student_name}`}
                              className="h-8 rounded-lg border border-ink-200 bg-white px-2 text-xs font-medium text-ink-700 focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
                            >
                              {data.status_options.map((item) => (
                                <option key={item.key} value={item.key}>
                                  {item.label}
                                </option>
                              ))}
                            </select>
                          )}
                          <span className="text-[10px] text-ink-400">
                            {formatDateTime(entry.updated_at)}
                          </span>
                        </div>
                        {!archived ? (
                          <input
                            value={draft.remarks}
                            onChange={(event) =>
                              updateDraft(entry.id, { remarks: event.target.value })
                            }
                            maxLength={500}
                            placeholder="Optional remarks"
                            aria-label={`Remarks for ${entry.student_name}`}
                            className="mt-2 h-8 w-full rounded-lg border border-ink-200 bg-white px-2.5 text-xs text-ink-700 placeholder:text-ink-400 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
                          />
                        ) : entry.remarks ? (
                          <p className="mt-1.5 text-xs text-ink-500 dark:text-ink-400">
                            {entry.remarks}
                          </p>
                        ) : null}
                      </div>
                    </div>
                  </li>
                )
              })}
            </ul>
          </>
        )}

        <CardContent className="border-t border-ink-100 py-3 text-[11px] text-ink-500 dark:border-ink-800 dark:text-ink-400">
          New entries start on “{data.status_options[0]?.label}”. Statuses and remarks are tracked
          individually with edit history.
        </CardContent>
      </Card>

      {dirty && !archived ? (
        <div className="sticky bottom-20 z-20 lg:bottom-4">
          <div className="flex flex-col gap-3 rounded-xl border border-brand-200 bg-white/95 p-3 shadow-card-hover backdrop-blur sm:flex-row sm:items-center dark:border-brand-500/30 dark:bg-ink-900/95">
            <p className="flex-1 text-xs font-medium text-ink-600 dark:text-ink-300">
              You have unsaved status or remark changes.
            </p>
            <div className="flex items-center gap-2">
              <Button variant="ghost" size="sm" onClick={discard} disabled={saving}>
                <Undo2 className="h-3.5 w-3.5" /> Discard
              </Button>
              <Button size="sm" onClick={() => void saveChanges()} loading={saving}>
                <Save className="h-3.5 w-3.5" /> Save changes
              </Button>
            </div>
          </div>
        </div>
      ) : null}

      <Modal
        open={editOpen}
        onClose={() => setEditOpen(false)}
        title="Edit list settings"
        size="lg"
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-list-form">
              Save settings
            </Button>
          </>
        }
      >
        {editOpen ? (
          <EditListForm
            list={data}
            onDone={(updated) => {
              applyList(updated)
              setEditOpen(false)
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        title="Add students to this list"
        description="Only active students in this class who are not already on the list are shown."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAddOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="add-students-form">
              <UserPlus className="h-4 w-4" /> Add students
            </Button>
          </>
        }
      >
        {addOpen ? (
          <AddStudentsForm
            list={data}
            onDone={(updated) => {
              applyList(updated)
              setAddOpen(false)
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={archiveConfirm}
        onClose={() => setArchiveConfirm(false)}
        onConfirm={toggleArchive}
        loading={working}
        tone={archived ? 'success' : 'danger'}
        title={archived ? 'Restore this list?' : 'Archive this list?'}
        confirmLabel={archived ? 'Restore list' : 'Archive list'}
        description={
          archived
            ? 'The list will return to active lists and become editable again.'
            : 'The list becomes read-only and disappears from active lists. You can restore it at any time; history is preserved.'
        }
      />

      <ConfirmDialog
        open={bulkAll}
        onClose={() => setBulkAll(false)}
        onConfirm={applyAll}
        loading={working}
        title="Apply status to every entry?"
        confirmLabel="Apply to all"
        description={
          <>
            This will set all {data.entries.length} entries to{' '}
            <span className="font-semibold">
              {data.status_options.find((option) => option.key === bulkAllStatus)?.label ??
                bulkAllStatus}
            </span>
            . Existing per-entry remarks are kept.
          </>
        }
      />
    </div>
  )
}
