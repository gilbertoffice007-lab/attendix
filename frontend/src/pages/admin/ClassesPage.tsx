import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  BookOpen,
  Building2,
  Check,
  Pencil,
  Plus,
  Trash2,
  UsersRound,
} from 'lucide-react'
import { Badge } from '@/components/ui/Badge'
import { Button, buttonStyles } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Input, Select } from '@/components/ui/Input'
import { Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/contexts/ToastContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { adminApi, classesApi, subjectsApi } from '@/services/api'
import { getErrorMessage } from '@/services/http'
import { classSchema, type ClassValues } from '@/lib/validation'
import type { ClassRoom, Subject } from '@/types'

function ClassForm({
  editing,
  onDone,
}: {
  editing: ClassRoom | null
  onDone: () => void
}) {
  const toast = useToast()
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<ClassValues>({
    resolver: zodResolver(classSchema),
    defaultValues: {
      name: editing?.name ?? '',
      department: editing?.department ?? '',
      semester: editing?.semester ?? 1,
      academic_year: editing?.academic_year ?? '2026-2027',
    },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      if (editing) {
        await classesApi.update(editing.id, {
          name: values.name.trim(),
          department: values.department.trim(),
          semester: values.semester,
          academic_year: values.academic_year.trim(),
        })
        toast.success('Class updated')
      } else {
        await classesApi.create({
          name: values.name.trim(),
          department: values.department.trim(),
          semester: values.semester,
          academic_year: values.academic_year.trim(),
        })
        toast.success('Class created')
      }
      onDone()
    } catch (caught) {
      toast.error('Could not save class', getErrorMessage(caught))
    }
  })

  return (
    <form id="class-form" onSubmit={onSubmit} className="space-y-4" noValidate>
      <Input
        label="Class name"
        required
        placeholder="III CSE"
        error={errors.name?.message}
        {...register('name')}
      />
      <Input
        label="Department"
        required
        placeholder="Computer Science and Engineering"
        error={errors.department?.message}
        {...register('department')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Semester"
          required
          error={errors.semester?.message}
          options={Array.from({ length: 12 }, (_, index) => ({
            value: index + 1,
            label: `Semester ${index + 1}`,
          }))}
          {...register('semester')}
        />
        <Input
          label="Academic year"
          required
          placeholder="2026-2027"
          error={errors.academic_year?.message}
          {...register('academic_year')}
        />
      </div>
      <button type="submit" className="hidden" aria-hidden />
    </form>
  )
}

function SubjectsManager({ classRoom }: { classRoom: ClassRoom }) {
  const toast = useToast()
  const [name, setName] = useState('')
  const [code, setCode] = useState('')
  const [facultyId, setFacultyId] = useState<number | ''>('')
  const [editing, setEditing] = useState<Subject | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<Subject | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const { data: subjects, loading, refresh } = useApiQuery(
    () => classesApi.subjects(classRoom.id),
    [classRoom.id],
  )
  const { data: faculty } = useApiQuery(adminApi.faculty, [])

  const resetForm = () => {
    setName('')
    setCode('')
    setFacultyId('')
    setEditing(null)
    setFormError(null)
  }

  const startEdit = (subject: Subject) => {
    setEditing(subject)
    setName(subject.name)
    setCode(subject.subject_code)
    setFacultyId(subject.faculty_id ?? '')
    setFormError(null)
  }

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setFormError(null)
    if (!name.trim() || !code.trim()) {
      setFormError('Subject name and code are required.')
      return
    }
    setSaving(true)
    try {
      if (editing) {
        await subjectsApi.update(editing.id, {
          name: name.trim(),
          subject_code: code.trim(),
          faculty_id: facultyId ? Number(facultyId) : null,
        })
        toast.success('Subject updated')
      } else {
        await subjectsApi.create({
          name: name.trim(),
          subject_code: code.trim(),
          class_id: classRoom.id,
          faculty_id: facultyId ? Number(facultyId) : null,
        })
        toast.success('Subject added')
      }
      resetForm()
      await refresh(true)
    } catch (caught) {
      setFormError(getErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  const removeSubject = async () => {
    if (!deleteTarget) return
    setSaving(true)
    try {
      await subjectsApi.remove(deleteTarget.id)
      toast.success('Subject deleted')
      setDeleteTarget(null)
      await refresh(true)
    } catch (caught) {
      toast.error('Could not delete subject', getErrorMessage(caught))
      setDeleteTarget(null)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="rounded-xl border border-ink-200 p-3.5 dark:border-ink-700">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-ink-400">
          {editing ? `Editing ${editing.subject_code}` : 'Add a subject'}
        </p>
        {formError ? (
          <div className="mb-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
            {formError}
          </div>
        ) : null}
        <div className="grid gap-2.5 sm:grid-cols-[1.4fr_1fr_1.2fr_auto]">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Subject name"
            aria-label="Subject name"
            className="h-9 rounded-lg border border-ink-200 bg-white px-2.5 text-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-white"
          />
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Code"
            aria-label="Subject code"
            className="h-9 rounded-lg border border-ink-200 bg-white px-2.5 text-sm uppercase focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-white"
          />
          <select
            value={facultyId}
            onChange={(event) =>
              setFacultyId(event.target.value ? Number(event.target.value) : '')
            }
            aria-label="Faculty member"
            className="h-9 rounded-lg border border-ink-200 bg-white px-2 text-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
          >
            <option value="">No faculty</option>
            {faculty?.map((item) => (
              <option key={item.id} value={item.id}>
                {item.full_name}
              </option>
            ))}
          </select>
          <div className="flex gap-1.5">
            {editing ? (
              <Button type="button" variant="ghost" size="sm" onClick={resetForm}>
                Cancel
              </Button>
            ) : null}
            <Button type="submit" size="sm" loading={saving}>
              {editing ? <Check className="h-3.5 w-3.5" /> : <Plus className="h-3.5 w-3.5" />}
              {editing ? 'Save' : 'Add'}
            </Button>
          </div>
        </div>
      </form>

      {loading && !subjects ? (
        <div className="space-y-2">
          {[0, 1, 2].map((item) => (
            <div key={item} className="skeleton h-12 w-full rounded-lg" />
          ))}
        </div>
      ) : !subjects || subjects.length === 0 ? (
        <p className="rounded-xl border border-dashed border-ink-200 px-4 py-8 text-center text-sm text-ink-500 dark:border-ink-700 dark:text-ink-400">
          No subjects yet. Add the first subject for this class.
        </p>
      ) : (
        <ul className="divide-y divide-ink-100 rounded-xl border border-ink-200 dark:divide-ink-800 dark:border-ink-700">
          {subjects.map((subject) => (
            <li key={subject.id} className="flex items-center gap-3 px-3.5 py-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                <BookOpen className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[13px] font-semibold text-ink-800 dark:text-ink-100">
                  {subject.name}
                </p>
                <p className="text-[11px] text-ink-500 dark:text-ink-400">
                  {subject.subject_code} · {subject.faculty_name ?? 'Unassigned'} ·{' '}
                  {subject.session_count} sessions
                </p>
              </div>
              {deleteTarget?.id === subject.id ? (
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-medium text-rose-600">Delete?</span>
                  <Button
                    variant="danger"
                    size="sm"
                    onClick={() => void removeSubject()}
                    loading={saving}
                  >
                    Yes
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDeleteTarget(null)}
                  >
                    No
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    onClick={() => startEdit(subject)}
                    className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
                    aria-label={`Edit ${subject.name}`}
                  >
                    <Pencil className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(subject)}
                    className="rounded-lg p-2 text-ink-400 hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
                    aria-label={`Delete ${subject.name}`}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ClassesPage() {
  const [classModal, setClassModal] = useState<{ open: boolean; editing: ClassRoom | null }>({
    open: false,
    editing: null,
  })
  const [manageFor, setManageFor] = useState<ClassRoom | null>(null)
  const { data: classes, loading, error, refresh } = useApiQuery(classesApi.list, [])

  return (
    <div className="space-y-5">
      <PageHeader
        title="Classes"
        description="Define the classes, subjects and academic structure used across attendance."
        actions={
          <Button onClick={() => setClassModal({ open: true, editing: null })}>
            <Plus className="h-4 w-4" /> Add class
          </Button>
        }
      />

      {loading && !classes ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2].map((item) => (
            <Skeleton key={item} className="h-44 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={() => void refresh()} />
        </Card>
      ) : !classes || classes.length === 0 ? (
        <Card>
          <EmptyState
            icon={Building2}
            title="No classes yet"
            description="Create a class, add its subjects and enroll students to start attendance."
            action={
              <Button onClick={() => setClassModal({ open: true, editing: null })}>
                <Plus className="h-4 w-4" /> Add class
              </Button>
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {classes.map((classRoom) => (
            <Card key={classRoom.id} className="flex flex-col">
              <CardHeader
                title={
                  <span className="flex items-center gap-2">
                    {classRoom.name}
                    <Badge tone="neutral">Sem {classRoom.semester}</Badge>
                  </span>
                }
                description={classRoom.department}
                action={
                  <button
                    type="button"
                    onClick={() => setClassModal({ open: true, editing: classRoom })}
                    className="rounded-lg p-1.5 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
                    aria-label={`Edit ${classRoom.name}`}
                  >
                    <Pencil className="h-4 w-4" />
                  </button>
                }
              />
              <CardContent className="flex-1 space-y-4">
                <p className="text-xs text-ink-500 dark:text-ink-400">
                  Academic year {classRoom.academic_year}
                </p>
                <div className="grid grid-cols-2 gap-2">
                  <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/50">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                      <UsersRound className="h-3 w-3" /> Students
                    </p>
                    <p className="mt-1 text-xl font-semibold text-ink-900 dark:text-white">
                      {classRoom.student_count}
                    </p>
                  </div>
                  <div className="rounded-xl bg-ink-50 p-3 dark:bg-ink-800/50">
                    <p className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                      <BookOpen className="h-3 w-3" /> Subjects
                    </p>
                    <p className="mt-1 text-xl font-semibold text-ink-900 dark:text-white">
                      {classRoom.subject_count}
                    </p>
                  </div>
                </div>
              </CardContent>
              <div className="flex items-center gap-2 border-t border-ink-100 px-5 py-3 dark:border-ink-800">
                <Button
                  variant="secondary"
                  size="sm"
                  className="flex-1"
                  onClick={() => setManageFor(classRoom)}
                >
                  <BookOpen className="h-3.5 w-3.5" /> Subjects
                </Button>
                <Link
                  to={`/admin/students?class=${classRoom.id}`}
                  className={buttonStyles('ghost', 'sm')}
                >
                  Students
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal
        open={classModal.open}
        onClose={() => setClassModal({ open: false, editing: null })}
        title={classModal.editing ? 'Edit class' : 'Add a class'}
        description="Class names can be reused across departments and semesters."
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => setClassModal({ open: false, editing: null })}
            >
              Cancel
            </Button>
            <Button type="submit" form="class-form">
              {classModal.editing ? 'Save changes' : 'Create class'}
            </Button>
          </>
        }
      >
        <ClassForm
          key={classModal.editing?.id ?? 'new'}
          editing={classModal.editing}
          onDone={() => {
            setClassModal({ open: false, editing: null })
            void refresh(true)
          }}
        />
      </Modal>

      <Modal
        open={Boolean(manageFor)}
        onClose={() => setManageFor(null)}
        title={manageFor ? `${manageFor.name} subjects` : 'Subjects'}
        description="Add or update subjects and assign the faculty who teach them."
        size="lg"
        footer={
          <Button
            variant="secondary"
            onClick={() => {
              setManageFor(null)
              void refresh(true)
            }}
          >
            Done
          </Button>
        }
      >
        {manageFor ? <SubjectsManager classRoom={manageFor} /> : null}
      </Modal>
    </div>
  )
}
