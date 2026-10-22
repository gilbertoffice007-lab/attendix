import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  BookOpen,
  CalendarDays,
  ChevronRight,
  Clock3,
  Info,
  UsersRound,
} from 'lucide-react'
import { Alert } from '@/components/ui/Feedback'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Input, Select, Textarea } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { attendanceApi, classesApi, subjectsApi } from '@/services/api'
import { getErrorMessage } from '@/services/http'
import { formatDate, todayInputValue } from '@/lib/utils'
import { sessionSchema, type SessionValues } from '@/lib/validation'

export function NewAttendancePage() {
  const { user } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const base = user ? `/${user.role}` : '/faculty'
  const [error, setError] = useState<string | null>(null)

  const initialClass = Number(params.get('class_id')) || 0
  const initialSubject = Number(params.get('subject_id')) || 0

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm<SessionValues>({
    resolver: zodResolver(sessionSchema),
    defaultValues: {
      class_id: initialClass,
      subject_id: initialSubject,
      session_date: todayInputValue(),
      session_number: 1,
      notes: '',
    },
  })

  const selectedClassId = Number(watch('class_id')) || 0
  const selectedSubjectId = Number(watch('subject_id')) || 0
  const { data: classes } = useApiQuery(classesApi.list, [])
  const { data: subjects, loading: subjectsLoading } = useApiQuery(
    () => subjectsApi.list(selectedClassId),
    [selectedClassId],
    { enabled: selectedClassId > 0 },
  )

  useEffect(() => {
    const current = Number(getValues('subject_id'))
    if (!current || !subjects) return
    if (!subjects.some((subject) => subject.id === current)) {
      setValue('subject_id', 0)
    }
  }, [subjects, getValues, setValue])

  const selectedClass = useMemo(
    () => classes?.find((item) => item.id === selectedClassId),
    [classes, selectedClassId],
  )
  const selectedSubject = useMemo(
    () => subjects?.find((item) => item.id === selectedSubjectId),
    [subjects, selectedSubjectId],
  )

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      const session = await attendanceApi.createSession({
        class_id: values.class_id,
        subject_id: values.subject_id,
        session_date: values.session_date,
        session_number: values.session_number,
        notes: values.notes?.trim() || null,
      })
      toast.success('Session created', 'Mark the roster and finalize when ready.')
      navigate(`${base}/attendance/${session.id}`, { replace: true })
    } catch (caught) {
      setError(getErrorMessage(caught, 'Could not create this attendance session.'))
    }
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="New attendance session"
        description="Pick the class and subject, then mark the roster on the next screen."
        backTo={`${base}/attendance`}
        backLabel="Attendance"
      />

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardHeader
            title="Session details"
            description="Dates in the future are not allowed. Each class, subject, date and session number is unique."
          />
          <CardContent>
            <form onSubmit={onSubmit} className="space-y-5" noValidate>
              {error ? (
                <Alert tone="danger" title="Could not create session">
                  {error}
                </Alert>
              ) : null}
              <div className="grid gap-4 sm:grid-cols-2">
                <Select
                  label="Class"
                  required
                  error={errors.class_id?.message}
                  {...register('class_id', {
                    onChange: () => setValue('subject_id', 0),
                  })}
                  placeholder="Choose a class"
                  options={classes?.map((item) => ({
                    value: item.id,
                    label: `${item.name} · ${item.department} · Sem ${item.semester}`,
                  }))}
                />
                <Select
                  label="Subject"
                  required
                  disabled={!selectedClassId || subjectsLoading}
                  error={errors.subject_id?.message}
                  {...register('subject_id')}
                  placeholder={
                    !selectedClassId
                      ? 'Choose a class first'
                      : subjectsLoading
                        ? 'Loading subjects…'
                        : subjects?.length
                          ? 'Choose a subject'
                          : 'No subjects in this class'
                  }
                  options={subjects?.map((item) => ({
                    value: item.id,
                    label: `${item.subject_code} · ${item.name}`,
                  }))}
                />
              </div>
              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Session date"
                  type="date"
                  required
                  max={todayInputValue()}
                  error={errors.session_date?.message}
                  {...register('session_date')}
                />
                <Select
                  label="Session number"
                  required
                  error={errors.session_number?.message}
                  {...register('session_number')}
                  options={Array.from({ length: 10 }, (_, index) => ({
                    value: index + 1,
                    label: `Session ${index + 1}`,
                  }))}
                />
              </div>
              <Textarea
                label="Notes"
                placeholder="Optional context for this session, e.g. revision class or lab batch."
                hint="Visible to staff on the register."
                error={errors.notes?.message}
                {...register('notes')}
              />
              <div className="flex flex-col-reverse gap-2 border-t border-ink-100 pt-4 sm:flex-row sm:justify-end dark:border-ink-800">
                <Button
                  type="button"
                  variant="secondary"
                  onClick={() => navigate(`${base}/attendance`)}
                >
                  Cancel
                </Button>
                <Button type="submit" loading={isSubmitting}>
                  Create session <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>

        <div className="space-y-5">
          <Card>
            <CardHeader title="What happens next" />
            <CardContent className="space-y-4">
              {[
                {
                  icon: UsersRound,
                  title: 'Mark the roster',
                  text: 'Every active student is listed automatically. Use present, absent, on-duty or leave.',
                },
                {
                  icon: Clock3,
                  title: 'Save as draft',
                  text: 'Drafts remain editable and stay out of attendance percentages until finalized.',
                },
                {
                  icon: CalendarDays,
                  title: 'Finalize to report',
                  text: 'Finalized registers feed trends, low-attendance alerts and exports.',
                },
              ].map((step, index) => (
                <div key={step.title} className="flex gap-3">
                  <div className="relative flex flex-col items-center">
                    <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-50 text-brand-600 dark:bg-brand-500/10 dark:text-brand-300">
                      <step.icon className="h-4 w-4" />
                    </div>
                    {index < 2 ? (
                      <span className="mt-1 h-full w-px flex-1 bg-ink-200 dark:bg-ink-700" />
                    ) : null}
                  </div>
                  <div className="pb-1">
                    <p className="text-[13px] font-semibold text-ink-900 dark:text-white">
                      {step.title}
                    </p>
                    <p className="mt-0.5 text-xs leading-5 text-ink-500 dark:text-ink-400">
                      {step.text}
                    </p>
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Selected context" />
            <CardContent className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <BookOpen className="mt-0.5 h-4 w-4 text-ink-400" />
                <div>
                  <p className="text-xs text-ink-500 dark:text-ink-400">Class</p>
                  <p className="font-medium text-ink-800 dark:text-ink-100">
                    {selectedClass
                      ? `${selectedClass.name} · Sem ${selectedClass.semester}`
                      : 'Not selected'}
                  </p>
                  <p className="text-[11px] text-ink-500 dark:text-ink-400">
                    {selectedClass?.department ?? 'Choose a class to continue'}
                  </p>
                </div>
              </div>
              <div className="h-px bg-ink-100 dark:bg-ink-800" />
              <div className="flex items-start gap-2.5">
                <UsersRound className="mt-0.5 h-4 w-4 text-ink-400" />
                <div>
                  <p className="text-xs text-ink-500 dark:text-ink-400">Active students</p>
                  <p className="font-medium text-ink-800 dark:text-ink-100">
                    {selectedClass ? selectedClass.student_count : '—'}
                  </p>
                </div>
              </div>
              <div className="h-px bg-ink-100 dark:bg-ink-800" />
              <div className="flex items-start gap-2.5">
                <CalendarDays className="mt-0.5 h-4 w-4 text-ink-400" />
                <div>
                  <p className="text-xs text-ink-500 dark:text-ink-400">Date</p>
                  <p className="font-medium text-ink-800 dark:text-ink-100">
                    {formatDate(watch('session_date'), 'EEEE, dd MMM yyyy')}
                  </p>
                </div>
              </div>
              {selectedSubject ? (
                <>
                  <div className="h-px bg-ink-100 dark:bg-ink-800" />
                  <div className="flex items-start gap-2.5">
                    <Info className="mt-0.5 h-4 w-4 text-ink-400" />
                    <div>
                      <p className="text-xs text-ink-500 dark:text-ink-400">Subject faculty</p>
                      <p className="font-medium text-ink-800 dark:text-ink-100">
                        {selectedSubject.faculty_name ?? 'Unassigned'}
                      </p>
                    </div>
                  </div>
                </>
              ) : null}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
