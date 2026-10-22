import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  Check,
  Eye,
  EyeOff,
  GraduationCap,
  Hash,
  LockKeyhole,
  Mail,
  UserRound,
} from 'lucide-react'
import { AuthLayout } from '@/layouts/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input, Select } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { authApi } from '@/services/api'
import { getErrorMessage } from '@/services/http'
import { cn } from '@/lib/utils'
import {
  studentRegisterSchema,
  type StudentRegisterValues,
} from '@/lib/validation'
import type { StudentRegistrationOptions } from '@/types'

export function StudentRegisterPage() {
  const { registerStudent } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [options, setOptions] = useState<StudentRegistrationOptions | null>(null)
  const [optionsError, setOptionsError] = useState<string | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<StudentRegisterValues>({
    resolver: zodResolver(studentRegisterSchema),
    defaultValues: {
      full_name: '',
      email: '',
      class_id: 0,
      roll_number: '',
      password: '',
      confirm_password: '',
    },
  })
  const password = watch('password')

  useEffect(() => {
    let active = true
    authApi
      .studentRegistrationOptions()
      .then((data) => {
        if (active) setOptions(data)
      })
      .catch((caught) => {
        if (active) setOptionsError(getErrorMessage(caught, 'Unable to load classes.'))
      })
    return () => {
      active = false
    }
  }, [])

  const checks = [
    { label: '8 or more characters', valid: password.length >= 8 },
    { label: 'A letter and a number', valid: /[A-Za-z]/.test(password) && /\d/.test(password) },
    {
      label: 'Passwords match',
      valid: Boolean(password) && password === watch('confirm_password'),
    },
  ]

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      const user = await registerStudent({
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        class_id: Number(values.class_id),
        roll_number: values.roll_number.trim(),
        password: values.password,
      })
      toast.success('Student account created', `Welcome, ${user.full_name.split(' ')[0]}.`)
      navigate('/student', { replace: true })
    } catch (caught) {
      setError(getErrorMessage(caught, 'Unable to create your student account.'))
    }
  })

  const classOptions =
    options?.classes.map((class_) => ({
      value: class_.id,
      label: `${class_.name} - ${class_.department}, Sem ${class_.semester} (${class_.academic_year})`,
    })) ?? []

  return (
    <AuthLayout
      title="Create your student account"
      subtitle="Use the same name and registration number your teacher added to your class."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? (
          <Alert tone="danger" title="Registration failed">
            {error}
          </Alert>
        ) : null}
        {optionsError ? (
          <Alert tone="danger" title="Could not load classes">
            {optionsError}
          </Alert>
        ) : null}
        {options && !options.enabled ? (
          <Alert tone="warning" title="Student registration is closed">
            Ask your teacher or administrator to create your account.
          </Alert>
        ) : null}
        {options?.enabled && options.classes.length === 0 ? (
          <Alert tone="warning" title="No classes available">
            Ask your teacher or administrator to create your class first.
          </Alert>
        ) : null}

        <Input
          label="Full name"
          autoComplete="name"
          placeholder="As added by your teacher"
          leading={<UserRound className="h-4 w-4" />}
          error={errors.full_name?.message}
          {...register('full_name')}
        />
        <Select
          label="Class"
          error={errors.class_id?.message}
          options={classOptions}
          placeholder={options ? 'Select your class' : 'Loading classes...'}
          disabled={!options?.enabled || classOptions.length === 0}
          {...register('class_id')}
        />
        <Input
          label="Registration / roll number"
          autoComplete="off"
          placeholder="e.g. CS23-014"
          leading={<Hash className="h-4 w-4" />}
          error={errors.roll_number?.message}
          {...register('roll_number')}
        />
        <Input
          label="Email address"
          type="email"
          autoComplete="email"
          placeholder="you@example.com"
          leading={<Mail className="h-4 w-4" />}
          error={errors.email?.message}
          {...register('email')}
        />
        <Input
          label="Password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Create a strong password"
          leading={<LockKeyhole className="h-4 w-4" />}
          error={errors.password?.message}
          trailing={
            <button
              type="button"
              onClick={() => setShowPassword((value) => !value)}
              className="rounded-md p-1.5 text-ink-400 transition hover:text-ink-700 dark:hover:text-ink-200"
              aria-label={showPassword ? 'Hide password' : 'Show password'}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          }
          {...register('password')}
        />
        <div className="grid grid-cols-1 gap-1.5 rounded-xl bg-ink-50 px-3.5 py-3 text-[11px] dark:bg-ink-900/70 sm:grid-cols-3">
          {checks.map((check) => (
            <span
              key={check.label}
              className={cn(
                'flex items-center gap-1.5 transition-colors',
                check.valid
                  ? 'font-medium text-emerald-600 dark:text-emerald-400'
                  : 'text-ink-400 dark:text-ink-500',
              )}
            >
              <span
                className={cn(
                  'flex h-3.5 w-3.5 items-center justify-center rounded-full border',
                  check.valid
                    ? 'border-emerald-500 bg-emerald-500 text-white'
                    : 'border-ink-300 dark:border-ink-600',
                )}
              >
                {check.valid ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
              </span>
              {check.label}
            </span>
          ))}
        </div>
        <Input
          label="Confirm password"
          type={showPassword ? 'text' : 'password'}
          autoComplete="new-password"
          placeholder="Repeat your password"
          leading={<LockKeyhole className="h-4 w-4" />}
          error={errors.confirm_password?.message}
          {...register('confirm_password')}
        />
        <Button
          type="submit"
          size="lg"
          className="w-full"
          loading={isSubmitting}
          disabled={!options?.enabled}
        >
          Create student account <GraduationCap className="h-4 w-4" />
        </Button>
      </form>

      <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-400">
        Already registered?{' '}
        <Link
          to="/student/login"
          className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          Student sign in
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-ink-400 dark:text-ink-500">
        Teacher?{' '}
        <Link to="/faculty/register" className="font-medium hover:text-ink-700 dark:hover:text-ink-300">
          Create a teacher account
        </Link>
      </p>
    </AuthLayout>
  )
}
