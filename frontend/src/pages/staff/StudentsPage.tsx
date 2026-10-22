import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Controller, useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Archive,
  ArchiveRestore,
  Download,
  FileUp,
  KeyRound,
  Pencil,
  Plus,
  Search,
  UploadCloud,
  UserRound,
  Users,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/Feedback'
import { Input, Select, Switch } from '@/components/ui/Input'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useDebounce } from '@/hooks/useDebounce'
import { classesApi, studentsApi } from '@/services/api'
import { getErrorMessage } from '@/services/http'
import { cn, formatDate } from '@/lib/utils'
import { studentSchema, type StudentValues } from '@/lib/validation'
import type { ClassRoom, Student, StudentImportResult } from '@/types'

function downloadTemplate() {
  const content = 'roll_number,full_name\nCS101,Ananya Krishnan\nCS102,Rahul Verma\n'
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = 'student-import-template.csv'
  anchor.click()
  URL.revokeObjectURL(url)
}

function StudentForm({
  editing,
  classes,
  onDone,
}: {
  editing: Student | null
  classes: ClassRoom[]
  onDone: () => void
}) {
  const toast = useToast()
  const {
    register,
    handleSubmit,
    control,
    formState: { errors, isSubmitting },
  } = useForm<StudentValues>({
    resolver: zodResolver(studentSchema),
    defaultValues: {
      roll_number: editing?.roll_number ?? '',
      full_name: editing?.full_name ?? '',
      class_id: editing?.class_id ?? (classes[0]?.id ?? 0),
      is_active: editing?.is_active ?? true,
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (editing) {
        await studentsApi.update(editing.id, {
          roll_number: values.roll_number.trim(),
          full_name: values.full_name.trim(),
          class_id: values.class_id,
          is_active: values.is_active,
        })
        toast.success('Student updated')
      } else {
        await studentsApi.create({
          roll_number: values.roll_number.trim(),
          full_name: values.full_name.trim(),
          class_id: values.class_id,
          is_active: values.is_active,
        })
        toast.success('Student added', `${values.full_name.trim()} is now on the roster.`)
      }
      onDone()
    } catch (caught) {
      toast.error('Could not save student', getErrorMessage(caught))
    }
  })

  return (
    <form id="student-form" onSubmit={onSubmit} className="space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Roll number"
          required
          placeholder="CS101"
          error={errors.roll_number?.message}
          {...register('roll_number')}
        />
        <Input
          label="Full name"
          required
          placeholder="Ananya Krishnan"
          error={errors.full_name?.message}
          {...register('full_name')}
        />
      </div>
      <Select
        label="Class"
        required
        error={errors.class_id?.message}
        {...register('class_id')}
        options={classes.map((item) => ({
          value: item.id,
          label: `${item.name} Â· ${item.department} Â· Sem ${item.semester}`,
        }))}
        placeholder={classes.length ? undefined : 'No classes available'}
      />
      <div className="rounded-xl border border-ink-200 p-3.5 dark:border-ink-700">
        <Controller
          control={control}
          name="is_active"
          render={({ field }) => (
            <Switch
              checked={field.value}
              onChange={field.onChange}
              label="Active student"
              description="Inactive students stay on historical registers but are excluded from new sessions."
            />
          )}
        />
      </div>
      <button type="submit" className="hidden" aria-hidden />
    </form>
  )
}

function AccountForm({ student, onDone }: { student: Student; onDone: () => void }) {
  const toast = useToast()
  const [fullName, setFullName] = useState(student.full_name)
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.')
      return
    }
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError('Password needs 8+ characters with at least one letter and one number.')
      return
    }
    setSubmitting(true)
    try {
      await studentsApi.createAccount(student.id, {
        email: email.trim(),
        password,
        full_name: fullName.trim() || undefined,
      })
      toast.success('Student account created', `${email.trim()} can now sign in.`)
      onDone()
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form id="account-form" onSubmit={submit} className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60">
        <Avatar name={student.full_name} />
        <div>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">{student.full_name}</p>
          <p className="text-xs text-ink-500 dark:text-ink-400">
            {student.roll_number} Â· {student.class_name}
          </p>
        </div>
      </div>
      <Input
        label="Display name"
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
        maxLength={160}
      />
      <Input
        label="Login email"
        type="email"
        required
        placeholder="student@example.com"
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <Input
        label="Temporary password"
        type="password"
        required
        placeholder="At least 8 characters"
        hint="At least one letter and one number. Share it securely."
        value={password}
        onChange={(event) => setPassword(event.target.value)}
      />
      <button type="submit" className="hidden" aria-hidden />
    </form>
  )
}

function ImportForm({ classes, onDone }: { classes: ClassRoom[]; onDone: () => void }) {
  const toast = useToast()
  const [classId, setClassId] = useState<string>(classes[0] ? String(classes[0].id) : '')
  const [file, setFile] = useState<File | null>(null)
  const [result, setResult] = useState<StudentImportResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (!classId) {
      setError('Choose a class first.')
      return
    }
    if (!file) {
      setError('Choose a CSV file to import.')
      return
    }
    setSubmitting(true)
    try {
      const outcome = await studentsApi.importCsv(Number(classId), file)
      setResult(outcome)
      toast.success(`${outcome.created} students imported`, `${outcome.skipped} rows skipped.`)
      onDone()
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form id="import-form" onSubmit={submit} className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      <Select
        label="Import into class"
        value={classId}
        onChange={(event) => setClassId(event.target.value)}
        options={classes.map((item) => ({
          value: item.id,
          label: `${item.name} Â· Sem ${item.semester}`,
        }))}
        placeholder="Choose a class"
      />
      <div>
        <span className="mb-1.5 block text-sm font-medium text-ink-700 dark:text-ink-300">
          CSV file
        </span>
        <label
          className={cn(
            'flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border border-dashed px-4 py-8 text-center transition',
            file
              ? 'border-brand-300 bg-brand-50/50 dark:border-brand-500/40 dark:bg-brand-500/5'
              : 'border-ink-300 bg-ink-50/50 hover:border-brand-300 dark:border-ink-700 dark:bg-ink-800/30',
          )}
        >
          <UploadCloud className="h-7 w-7 text-ink-400" />
          <span className="text-sm font-medium text-ink-700 dark:text-ink-200">
            {file ? file.name : 'Click to choose a CSV file'}
          </span>
          <span className="text-xs text-ink-500 dark:text-ink-400">
            Required columns: roll_number, full_name
          </span>
          <input
            type="file"
            accept=".csv,text/csv"
            className="sr-only"
            onChange={(event) => setFile(event.target.files?.[0] ?? null)}
          />
        </label>
        <button
          type="button"
          onClick={downloadTemplate}
          className="mt-2 inline-flex items-center gap-1.5 text-xs font-medium text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          <Download className="h-3.5 w-3.5" /> Download CSV template
        </button>
      </div>
      {result ? (
        <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-3.5 text-xs dark:border-ink-700 dark:bg-ink-800/50">
          <div className="flex gap-4 font-semibold text-ink-700 dark:text-ink-200">
            <span className="text-emerald-600 dark:text-emerald-400">{result.created} created</span>
            <span>{result.skipped} skipped</span>
            <span>{result.errors.length} errors</span>
          </div>
          {result.errors.length > 0 ? (
            <ul className="mt-2 max-h-28 space-y-1 overflow-y-auto text-ink-500 dark:text-ink-400">
              {result.errors.map((item, index) => (
                <li key={`${item.row}-${index}`}>
                  Row {item.row}: {item.message}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
      <button type="submit" className="hidden" aria-hidden />
    </form>
  )
}

export function StudentsPage() {
  const { user } = useAuth()
  const toast = useToast()
  const isAdmin = user?.role === 'admin'
  const [searchParams] = useSearchParams()
  const [classFilter, setClassFilter] = useState<number | ''>(() => {
    const value = Number(searchParams.get('class'))
    return Number.isInteger(value) && value > 0 ? value : ''
  })
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const [studentModal, setStudentModal] = useState<{ open: boolean; editing: Student | null }>({
    open: false,
    editing: null,
  })
  const [importOpen, setImportOpen] = useState(false)
  const [accountFor, setAccountFor] = useState<Student | null>(null)
  const [toggleTarget, setToggleTarget] = useState<Student | null>(null)
  const [toggling, setToggling] = useState(false)
  const debouncedSearch = useDebounce(search)

  useEffect(() => {
    const value = Number(searchParams.get('class'))
    setClassFilter(Number.isInteger(value) && value > 0 ? value : '')
    setPage(1)
  }, [searchParams])

  const { data: classes } = useApiQuery(classesApi.list, [])
  const { data, loading, error, refresh } = useApiQuery(
    () =>
      studentsApi.list({
        class_id: classFilter || undefined,
        search: debouncedSearch || undefined,
        is_active:
          activeFilter === 'all' ? undefined : activeFilter === 'active',
        page,
        page_size: 20,
      }),
    [classFilter, debouncedSearch, activeFilter, page],
  )

  const classOptions = useMemo(
    () =>
      classes?.map((item) => ({
        value: item.id,
        label: `${item.name} Â· Sem ${item.semester}`,
      })) ?? [],
    [classes],
  )

  const confirmToggle = async () => {
    if (!toggleTarget) return
    setToggling(true)
    try {
      await studentsApi.update(toggleTarget.id, { is_active: !toggleTarget.is_active })
      toast.success(
        toggleTarget.is_active ? 'Student deactivated' : 'Student reactivated',
        toggleTarget.full_name,
      )
      setToggleTarget(null)
      await refresh(true)
    } catch (caught) {
      toast.error('Could not update student', getErrorMessage(caught))
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Students"
        description="Keep every roster accurate. Inactive students remain on past registers but drop out of new sessions."
        actions={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(true)}>
              <FileUp className="h-4 w-4" /> Import CSV
            </Button>
            <Button onClick={() => setStudentModal({ open: true, editing: null })}>
              <Plus className="h-4 w-4" /> Add student
            </Button>
          </>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 lg:flex-row lg:items-center dark:border-ink-800">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Search name or roll numberâ€¦"
              aria-label="Search students"
              className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-sm shadow-sm placeholder:text-ink-400 focus:border-brand-500 focus:ring-2 focus:ring-brand-500/20 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-white"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={classFilter}
              onChange={(event) => {
                setClassFilter(event.target.value ? Number(event.target.value) : '')
                setPage(1)
              }}
              aria-label="Filter by class"
              className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
            >
              <option value="">All classes</option>
              {classOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <select
              value={activeFilter}
              onChange={(event) => {
                setActiveFilter(event.target.value as typeof activeFilter)
                setPage(1)
              }}
              aria-label="Filter by status"
              className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {loading && !data ? (
          <TableSkeleton rows={8} cols={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void refresh()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={Users}
            title="No students found"
            description={
              search || classFilter || activeFilter !== 'all'
                ? 'Try clearing the filters or searching for a different name.'
                : 'Add your first student or import a CSV roster to get started.'
            }
            action={
              <Button onClick={() => setStudentModal({ open: true, editing: null })}>
                <Plus className="h-4 w-4" /> Add student
              </Button>
            }
          />
        ) : (
          <>
            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-400 dark:border-ink-800">
                    <th className="px-5 py-3 font-semibold">Student</th>
                    <th className="px-5 py-3 font-semibold">Class</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Portal access</th>
                    <th className="px-5 py-3 font-semibold">Added</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {data.items.map((student) => (
                    <tr
                      key={student.id}
                      className="transition-colors hover:bg-ink-50/60 dark:hover:bg-ink-800/30"
                    >
                      <td className="px-5 py-3">
                        <div className="flex items-center gap-3">
                          <Avatar name={student.full_name} size="sm" />
                          <div className="min-w-0">
                            <p className="truncate text-[13px] font-semibold text-ink-900 dark:text-white">
                              {student.full_name}
                            </p>
                            <p className="text-[11px] text-ink-500 dark:text-ink-400">
                              {student.roll_number}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-3">
                        <p className="text-[13px] text-ink-700 dark:text-ink-300">
                          {student.class_name}
                        </p>
                        <p className="text-[11px] text-ink-500 dark:text-ink-400">
                          Sem {student.semester} Â· {student.academic_year}
                        </p>
                      </td>
                      <td className="px-5 py-3">
                        <Badge tone={student.is_active ? 'success' : 'neutral'} dot>
                          {student.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </td>
                      <td className="px-5 py-3">
                        {student.has_account ? (
                          <span className="text-[12px] text-ink-600 dark:text-ink-300">
                            {student.account_email}
                          </span>
                        ) : (
                          <span className="text-[12px] text-ink-400">No account</span>
                        )}
                      </td>
                      <td className="px-5 py-3 text-[12px] text-ink-500 dark:text-ink-400">
                        {formatDate(student.created_at, 'dd MMM yyyy')}
                      </td>
                      <td className="px-5 py-3">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setStudentModal({ open: true, editing: student })}
                            className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
                            aria-label={`Edit ${student.full_name}`}
                          >
                            <Pencil className="h-4 w-4" />
                          </button>
                          {isAdmin && !student.has_account ? (
                            <button
                              type="button"
                              onClick={() => setAccountFor(student)}
                              className="rounded-lg p-2 text-ink-400 transition hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10"
                              aria-label={`Create account for ${student.full_name}`}
                            >
                              <KeyRound className="h-4 w-4" />
                            </button>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => setToggleTarget(student)}
                            className="rounded-lg p-2 text-ink-400 transition hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800 dark:hover:text-ink-200"
                            aria-label={
                              student.is_active
                                ? `Deactivate ${student.full_name}`
                                : `Reactivate ${student.full_name}`
                            }
                          >
                            {student.is_active ? (
                              <Archive className="h-4 w-4" />
                            ) : (
                              <ArchiveRestore className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <ul className="divide-y divide-ink-100 md:hidden dark:divide-ink-800">
              {data.items.map((student) => (
                <li key={student.id} className="p-4">
                  <div className="flex items-start gap-3">
                    <Avatar name={student.full_name} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">
                            {student.full_name}
                          </p>
                          <p className="text-xs text-ink-500 dark:text-ink-400">
                            {student.roll_number} Â· {student.class_name}
                          </p>
                        </div>
                        <Badge tone={student.is_active ? 'success' : 'neutral'} dot>
                          {student.is_active ? 'Active' : 'Inactive'}
                        </Badge>
                      </div>
                      <div className="mt-3 flex items-center gap-1">
                        <Button
                          variant="secondary"
                          size="sm"
                          onClick={() => setStudentModal({ open: true, editing: student })}
                        >
                          <Pencil className="h-3.5 w-3.5" /> Edit
                        </Button>
                        {isAdmin && !student.has_account ? (
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => setAccountFor(student)}
                          >
                            <KeyRound className="h-3.5 w-3.5" /> Account
                          </Button>
                        ) : null}
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => setToggleTarget(student)}
                        >
                          {student.is_active ? 'Deactivate' : 'Reactivate'}
                        </Button>
                      </div>
                    </div>
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

      <Modal
        open={studentModal.open}
        onClose={() => setStudentModal({ open: false, editing: null })}
        title={studentModal.editing ? 'Edit student' : 'Add a student'}
        description={
          studentModal.editing
            ? 'Update roster details. Historical records keep their original data.'
            : 'Students are enrolled into one class at a time.'
        }
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setStudentModal({ open: false, editing: null })}
            >
              Cancel
            </Button>
            <Button type="submit" form="student-form">
              {studentModal.editing ? 'Save changes' : 'Add student'}
            </Button>
          </>
        }
      >
        <StudentForm
          key={studentModal.editing?.id ?? 'new'}
          editing={studentModal.editing}
          classes={classes ?? []}
          onDone={() => {
            setStudentModal({ open: false, editing: null })
            void refresh(true)
          }}
        />
      </Modal>

      <Modal
        open={importOpen}
        onClose={() => setImportOpen(false)}
        title="Import students from CSV"
        description="Rows with an existing roll number in the same class are skipped automatically."
        footer={
          <>
            <Button variant="secondary" onClick={() => setImportOpen(false)}>
              Close
            </Button>
            <Button type="submit" form="import-form">
              <UploadCloud className="h-4 w-4" /> Import students
            </Button>
          </>
        }
      >
        <ImportForm
          classes={classes ?? []}
          onDone={() => void refresh(true)}
        />
      </Modal>

      <Modal
        open={Boolean(accountFor)}
        onClose={() => setAccountFor(null)}
        title="Create student account"
        description="Students sign in with this email and can only view their own attendance."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAccountFor(null)}>
              Cancel
            </Button>
            <Button type="submit" form="account-form">
              <UserRound className="h-4 w-4" /> Create account
            </Button>
          </>
        }
      >
        {accountFor ? (
          <AccountForm
            student={accountFor}
            onDone={() => {
              setAccountFor(null)
              void refresh(true)
            }}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        onConfirm={confirmToggle}
        loading={toggling}
        tone={toggleTarget?.is_active ? 'danger' : 'success'}
        confirmLabel={toggleTarget?.is_active ? 'Deactivate student' : 'Reactivate student'}
        title={toggleTarget?.is_active ? 'Deactivate this student?' : 'Reactivate this student?'}
        description={
          toggleTarget?.is_active
            ? `${toggleTarget?.full_name} will be excluded from new attendance sessions. Past records and custom lists are preserved.`
            : `${toggleTarget?.full_name} will return to active rosters and can be included in new sessions.`
        }
      />
    </div>
  )
}

