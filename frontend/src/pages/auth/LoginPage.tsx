import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  ArrowRight,
  BookOpen,
  Eye,
  EyeOff,
  GraduationCap,
  LockKeyhole,
  Mail,
  ShieldCheck,
} from 'lucide-react'
import { AuthLayout } from '@/layouts/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { authApi } from '@/services/api'
import { getErrorMessage } from '@/services/http'
import { homeForRole } from '@/lib/utils'
import { loginSchema, type LoginValues } from '@/lib/validation'
import type { SetupStatus } from '@/types'

export function LoginPage() {
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [accountStatus, setAccountStatus] = useState<SetupStatus | null>(null)
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  useEffect(() => {
    let active = true
    authApi
      .setupStatus()
      .then((status) => {
        if (active) setAccountStatus(status)
      })
      .catch(() => {
        if (active) setAccountStatus(null)
      })
    return () => {
      active = false
    }
  }, [])

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      const user = await login(values.email.trim(), values.password)
      toast.success(`Welcome back, ${user.full_name.split(' ')[0]}`)
      navigate(homeForRole(user.role), { replace: true })
    } catch (caught) {
      setError(getErrorMessage(caught, 'Unable to sign in. Check your credentials.'))
    }
  })

  return (
    <AuthLayout
      title="Welcome back"
      subtitle="Sign in to mark attendance, review registers and keep your classes on track."
    >
      {accountStatus?.setup_required ? (
        <div className="mb-5 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-800 dark:text-brand-200">
            <ShieldCheck className="h-4 w-4" />
            No administrator account yet
          </p>
          <p className="mt-1 text-xs leading-5 text-brand-700/80 dark:text-brand-200/70">
            Create the first administrator to start using this workspace.
          </p>
          <Link
            to="/setup"
            className="mt-3 inline-flex text-xs font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
          >
            Create administrator account
          </Link>
        </div>
      ) : null}
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? (
          <Alert tone="danger" title="Could not sign in">
            {error}
          </Alert>
        ) : null}
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
          autoComplete="current-password"
          placeholder="Enter your password"
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
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Sign in <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="mt-7 grid grid-cols-2 gap-2">
        <Link
          to="/student/login"
          className="flex items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-xs font-semibold text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:border-brand-500/50 dark:hover:text-brand-300"
        >
          <GraduationCap className="h-4 w-4" /> Student sign in
        </Link>
        <Link
          to="/faculty/login"
          className="flex items-center justify-center gap-2 rounded-xl border border-ink-200 bg-white px-3 py-2.5 text-xs font-semibold text-ink-700 shadow-sm transition hover:border-brand-300 hover:text-brand-700 dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200 dark:hover:border-brand-500/50 dark:hover:text-brand-300"
        >
          <BookOpen className="h-4 w-4" /> Teacher sign in
        </Link>
      </div>

      <div className="mt-4 space-y-1.5 text-center text-xs text-ink-500 dark:text-ink-400">
        {accountStatus?.setup_required ? (
          <p>
            First time here?{' '}
            <Link
              to="/setup"
              className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Create administrator account
            </Link>
          </p>
        ) : accountStatus?.registration_enabled ? (
          <p className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1">
            <Link
              to="/faculty/register"
              className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Teacher sign up
            </Link>
            <span className="text-ink-300 dark:text-ink-700">|</span>
            <Link
              to="/student/register"
              className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
            >
              Student sign up
            </Link>
          </p>
        ) : accountStatus ? (
          <p>Need an account? Ask an administrator to add you.</p>
        ) : null}
        <p className="text-[11px] text-ink-400 dark:text-ink-500">
          This page also signs in administrators and staff.
        </p>
      </div>
    </AuthLayout>
  )
}

