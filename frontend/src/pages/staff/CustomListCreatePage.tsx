import { useEffect, useMemo, useState } from 'react'
import { Controller, useForm } from 'react-hook-form'
import { useNavigate } from 'react-router-dom'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Check,
  GripVertical,
  ListChecks,
  Plus,
  Search,
  Trash2,
  UsersRound,
} from 'lucide-react'
import { Alert } from '@/components/ui/Feedback'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Input, Select, Switch, Textarea } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { classesApi, customListsApi } from '@/services/api'
import { getErrorMessage } from '@/services/http'
import { cn, listColorClasses, slugify, statusColorChoices } from '@/lib/utils'
import { customListSchema, type CustomListValues } from '@/lib/validation'
import type { StatusColor, StatusOption } from '@/types'

interface Preset {
  key: string
  label: string
  options: StatusOption[]
}

const presets: Preset[] = [
  {
    key: 'payment',
    label: 'Fee payment',
    options: [
      { key: 'paid', label: 'Paid', color: 'green' },
      { key: 'pending', label: 'Not paid', color: 'red' },
    ],
  },
  {
    key: 'submission',
    label: 'Document submission',
    options: [
      { key: 'submitted', label: 'Submitted', color: 'green' },
      { key: 'pending', label: 'Pending', color: 'amber' },
    ],
  },
  {
    key: 'eligibility',
    label: 'Exam eligibility',
    options: [
      { key: 'eligible', label: 'Eligible', color: 'green' },
      { key: 'not_eligible', label: 'Not eligible', color: 'red' },
    ],
  },
  {
    key: 'completion',
    label: 'Task completion',
    options: [
      { key: 'completed', label: 'Completed', color: 'green' },
      { key: 'in_progress', label: 'In progress', color: 'blue' },
      { key: 'not_started', label: 'Not started', color: 'slate' },
    ],
  },
  {
    key: 'custom',
    label: 'Custom statuses',
    options: [
      { key: 'status_1', label: 'Option one', color: 'green' },
      { key: 'status_2', label: 'Option two', color: 'slate' },
    ],
  },
]

function nextKey(options: StatusOption[]) {
  const keys = new Set(options.map((option) => option.key))
  let index = options.length + 1
  while (keys.has(`status_${index}`)) index += 1
  return `status_${index}`
}

export function CustomListCreatePage() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const base = user ? `/${user.role}` : '/faculty'
  const [options, setOptions] = useState<StatusOption[]>(presets[0].options)
  const [presetKey, setPresetKey] = useState(presets[0].key)
  const [selectedStudents, setSelectedStudents] = useState<Set<number>>(new Set())
  const [studentSearch, setStudentSearch] = useState('')
  const [error, setError] = useState<string | null>(null)

  const {
    register,
    handleSubmit,
    control,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CustomListValues>({
    resolver: zodResolver(customListSchema),
    defaultValues: {
      title: '',
      class_id: 0,
      description: '',
      due_date: '',
      visible_to_students: true,
    },
  })

  const classId = Number(watch('class_id')) || 0
  const { data: classes } = useApiQuery(classesApi.list, [])
  const { data: students, loading: studentsLoading } = useApiQuery(
    () => classesApi.students(classId),
    [classId],
    { enabled: classId > 0 },
  )

  useEffect(() => {
    setSelectedStudents(new Set())
    setStudentSearch('')
  }, [classId])

  const filteredStudents = useMemo(() => {
    const term = studentSearch.trim().toLowerCase()
    if (!term) return students ?? []
    return (students ?? []).filter(
      (student) =>
        student.full_name.toLowerCase().includes(term) ||
        student.roll_number.toLowerCase().includes(term),
    )
  }, [students, studentSearch])

  const applyPreset = (key: string) => {
    setPresetKey(key)
    const preset = presets.find((item) => item.key === key)
    if (preset) setOptions(preset.options.map((option) => ({ ...option })))
  }

  const updateOption = (index: number, patch: Partial<StatusOption>) => {
    setOptions((current) =>
      current.map((option, itemIndex) =>
        itemIndex === index ? { ...option, ...patch } : option,
      ),
    )
  }

  const addOption = () => {
    if (options.length >= 20) return
    setOptions((current) => [
      ...current,
      { key: nextKey(current), label: '', color: 'slate' },
    ])
    setPresetKey('custom')
  }

  const removeOption = (index: number) => {
    if (options.length <= 2) return
    setOptions((current) => current.filter((_, itemIndex) => itemIndex !== index))
    setPresetKey('custom')
  }

  const toggleStudent = (studentId: number) => {
    setSelectedStudents((current) => {
      const next = new Set(current)
      if (next.has(studentId)) next.delete(studentId)
      else next.add(studentId)
      return next
    })
  }

  const allVisibleSelected = filteredStudents.length > 0 && filteredStudents.every((student) => selectedStudents.has(student.id))

  const toggleAll = () => {
    if (allVisibleSelected) {
      setSelectedStudents((current) => {
        const next = new Set(current)
        filteredStudents.forEach((student) => next.delete(student.id))
        return next
      })
    } else {
      setSelectedStudents((current) => {
        const next = new Set(current)
        filteredStudents.forEach((student) => next.add(student.id))
        return next
      })
    }
  }

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    const cleaned = options.map((option) => ({
      ...option,
      label: option.label.trim(),
      key: option.key || slugify(option.label),
    }))
    if (cleaned.some((option) => !option.label)) {
      setError('Every status needs a label.')
      return
    }
    if (new Set(cleaned.map((option) => option.label.toLowerCase())).size !== cleaned.length) {
      setError('Status labels must be unique.')
      return
    }
    try {
      const list = await customListsApi.create({
        title: values.title.trim(),
        class_id: values.class_id,
        description: values.description?.trim() || null,
        status_options: cleaned,
        due_date: values.due_date || null,
        visible_to_students: values.visible_to_students,
        student_ids: Array.from(selectedStudents),
      })
      toast.success('List created', `${selectedStudents.size} students added.`)
      navigate(`${base}/custom-lists/${list.id}`, { replace: true })
    } catch (caught) {
      setError(getErrorMessage(caught, 'Could not create this list.'))
    }
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="Create custom list"
        description="Define the statuses you need, choose the students and start tracking."
        backTo={`${base}/custom-lists`}
        backLabel="Custom lists"
      />

      <form onSubmit={onSubmit} className="space-y-5" noValidate>
        {error ? (
          <Alert tone="danger" title="Could not create list">
            {error}
          </Alert>
        ) : null}

        <div className="grid gap-5 xl:grid-cols-[1.15fr_1fr]">
          <div className="space-y-5">
            <Card>
              <CardHeader
                title="List details"
                description="Give everyone enough context to understand what is being tracked."
              />
              <CardContent className="space-y-4">
                <Input
                  label="Title"
                  required
                  placeholder="Semester fee payment"
                  error={errors.title?.message}
                  {...register('title')}
                />
                <div className="grid gap-4 sm:grid-cols-2">
                  <Select
                    label="Class"
                    required
                    error={errors.class_id?.message}
                    placeholder="Choose a class"
                    options={classes?.map((item) => ({
                      value: item.id,
                      label: `${item.name} · Sem ${item.semester}`,
                    }))}
                    {...register('class_id')}
                  />
                  <Input
                    label="Due date"
                    type="date"
                    error={errors.due_date?.message}
                    {...register('due_date')}
                  />
                </div>
                <Textarea
                  label="Description"
                  placeholder="What should students know about this list?"
                  error={errors.description?.message}
                  {...register('description')}
                />
                <div className="rounded-xl border border-ink-200 p-3.5 dark:border-ink-700">
                  <Controller
                    control={control}
                    name="visible_to_students"
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onChange={field.onChange}
                        label="Visible to students"
                        description="Students can see this list and their own status in the student portal."
                      />
                    )}
                  />
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Statuses"
                description="Start from a preset or build your own. At least two statuses are required."
                action={
                  <Button type="button" variant="secondary" size="sm" onClick={addOption}>
                    <Plus className="h-3.5 w-3.5" /> Add status
                  </Button>
                }
              />
              <CardContent className="space-y-4">
                <Select
                  label="Preset"
                  value={presetKey}
                  onChange={(event) => applyPreset(event.target.value)}
                  options={presets.map((preset) => ({
                    value: preset.key,
                    label: preset.label,
                  }))}
                />
                <div className="space-y-2">
                  {options.map((option, index) => (
                    <div
                      key={`${option.key}-${index}`}
                      className="flex items-center gap-2 rounded-xl border border-ink-200 bg-white p-2.5 dark:border-ink-700 dark:bg-ink-900"
                    >
                      <GripVertical className="h-4 w-4 shrink-0 text-ink-300" />
                      <input
                        value={option.label}
                        onChange={(event) => {
                          updateOption(index, { label: event.target.value })
                          setPresetKey('custom')
                        }}
                        placeholder="Status label"
                        aria-label={`Status ${index + 1} label`}
                        className="h-8 min-w-0 flex-1 rounded-lg border border-ink-200 bg-white px-2.5 text-sm text-ink-800 focus:border-brand-400 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-800 dark:text-white"
                      />
                      <div className="flex items-center gap-1">
                        {statusColorChoices.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => {
                              updateOption(index, { color: color as StatusColor })
                              setPresetKey('custom')
                            }}
                            className={cn(
                              'h-4 w-4 rounded-full ring-offset-1 transition dark:ring-offset-ink-900',
                              listColorClasses[color].dot,
                              option.color === color
                                ? 'ring-2 ring-ink-400 dark:ring-ink-300'
                                : 'hover:scale-110',
                            )}
                            aria-label={`Use ${color} for ${option.label || 'status'}`}
                            aria-pressed={option.color === color}
                          />
                        ))}
                      </div>
                      <button
                        type="button"
                        onClick={() => removeOption(index)}
                        disabled={options.length <= 2}
                        className="rounded-lg p-1.5 text-ink-400 transition hover:bg-rose-50 hover:text-rose-600 disabled:opacity-30 dark:hover:bg-rose-500/10"
                        aria-label={`Remove status ${index + 1}`}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
                <p className="text-[11px] text-ink-400">
                  New students start on the first status. Statuses stay attached to existing
                  entries, so removing one later may be blocked.
                </p>
              </CardContent>
            </Card>
          </div>

          <Card className="flex flex-col">
            <CardHeader
              title="Students"
              description={
                classId
                  ? `${selectedStudents.size} of ${students?.length ?? 0} selected`
                  : 'Choose a class to load its roster'
              }
              action={
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={toggleAll}
                  disabled={!filteredStudents.length}
                >
                  {allVisibleSelected ? 'Clear all' : 'Select all'}
                </Button>
              }
            />
            <div className="border-b border-ink-100 p-4 dark:border-ink-800">
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
                <input
                  value={studentSearch}
                  onChange={(event) => setStudentSearch(event.target.value)}
                  placeholder="Search students…"
                  aria-label="Search class students"
                  className="h-9 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-sm placeholder:text-ink-400 focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
                />
              </div>
            </div>
            <div className="max-h-[440px] flex-1 overflow-y-auto">
              {!classId ? (
                <div className="flex h-full flex-col items-center justify-center px-6 py-14 text-center">
                  <ListChecks className="h-7 w-7 text-ink-300" />
                  <p className="mt-2 text-sm font-medium text-ink-600 dark:text-ink-300">
                    Select a class first
                  </p>
                  <p className="mt-1 text-xs text-ink-400">
                    The active roster will appear here for selection.
                  </p>
                </div>
              ) : studentsLoading ? (
                <div className="space-y-2 p-3">
                  {[0, 1, 2, 3].map((item) => (
                    <div key={item} className="skeleton h-11 w-full rounded-lg" />
                  ))}
                </div>
              ) : filteredStudents.length === 0 ? (
                <div className="flex flex-col items-center justify-center px-6 py-14 text-center">
                  <UsersRound className="h-7 w-7 text-ink-300" />
                  <p className="mt-2 text-sm font-medium text-ink-600 dark:text-ink-300">
                    No active students found
                  </p>
                  <p className="mt-1 text-xs text-ink-400">
                    Add students to this class before creating its list.
                  </p>
                </div>
              ) : (
                <ul className="divide-y divide-ink-100 dark:divide-ink-800">
                  {filteredStudents.map((student) => {
                    const checked = selectedStudents.has(student.id)
                    return (
                      <li key={student.id}>
                        <label className="flex cursor-pointer items-center gap-3 px-4 py-2.5 transition hover:bg-ink-50 dark:hover:bg-ink-800/40">
                          <span
                            className={cn(
                              'flex h-4 w-4 shrink-0 items-center justify-center rounded border transition',
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
                            onChange={() => toggleStudent(student.id)}
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
            <div className="border-t border-ink-100 p-3 dark:border-ink-800">
              <p className="text-[11px] text-ink-400">
                Students not selected now can be added from the list page later.
              </p>
            </div>
          </Card>
        </div>

        <div className="flex flex-col-reverse gap-2 rounded-xl border border-ink-200 bg-white p-3 shadow-card sm:flex-row sm:items-center sm:justify-end dark:border-ink-800 dark:bg-ink-900">
          <Button
            type="button"
            variant="ghost"
            onClick={() => navigate(`${base}/custom-lists`)}
          >
            Cancel
          </Button>
          <Button type="submit" loading={isSubmitting}>
            Create list
          </Button>
        </div>
      </form>
    </div>
  )
}
