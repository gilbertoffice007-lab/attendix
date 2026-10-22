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
import { cn } from '@/lib/utils'
import { loginSchema, type LoginValues } from '@/lib/validation'

type Portal = 'student' | 'faculty'

const portalCopy = {
  student: {
    title: 'Student sign in',
    subtitle: 'Check your attendance, subject progress and shared class lists.',
    registerPath: '/student/register',
    otherPath: '/faculty/login',
    otherLabel: 'Teacher sign in',
    registerLabel: 'Create a student account',
    switchLabel: 'Student',
    icon: GraduationCap,
  },
  faculty: {
    title: 'Teacher sign in',
    subtitle: 'Open your classes, mark registers and review attendance reports.',
    registerPath: '/faculty/register',
    otherPath: '/student/login',
    otherLabel: 'Student sign in',
    registerLabel: 'Create a teacher account',
    switchLabel: 'Teacher',
    icon: BookOpen,
  },
} as const

function PortalLoginPage({ portal }: { portal: Portal }) {
  const copy = portalCopy[portal]
  const { login } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [setupRequired, setSetupRequired] = useState(false)
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
        if (active) setSetupRequired(status.setup_required)
      })
      .catch(() => {
        if (active) setSetupRequired(false)
      })
    return () => {
      active = false
    }
  }, [])

  const onSubmit = handleSubmit(async (values) => {
    setError(null)
    try {
      const user = await login(values.email.trim(), values.password, portal)
      toast.success(`Welcome back, ${user.full_name.split(' ')[0]}`)
      navigate(user.role === 'student' ? '/student' : '/faculty', { replace: true })
    } catch (caught) {
      setError(getErrorMessage(caught, 'Unable to sign in. Check your credentials.'))
    }
  })

  const Icon = copy.icon

  return (
    <AuthLayout title={copy.title} subtitle={copy.subtitle}>
      <div className="mb-5 grid grid-cols-2 gap-1 rounded-xl bg-ink-100 p-1 dark:bg-ink-900">
        <Link
          to="/student/login"
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition',
            portal === 'student'
              ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-800 dark:text-white'
              : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100',
          )}
        >
          <GraduationCap className="h-4 w-4" /> Student
        </Link>
        <Link
          to="/faculty/login"
          className={cn(
            'flex items-center justify-center gap-2 rounded-lg px-3 py-2 text-xs font-semibold transition',
            portal === 'faculty'
              ? 'bg-white text-ink-900 shadow-sm dark:bg-ink-800 dark:text-white'
              : 'text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-ink-100',
          )}
        >
          <BookOpen className="h-4 w-4" /> Teacher
        </Link>
      </div>

      {setupRequired ? (
        <div className="mb-5 rounded-xl border border-brand-200 bg-brand-50 p-4 dark:border-brand-500/30 dark:bg-brand-500/10">
          <p className="flex items-center gap-2 text-sm font-semibold text-brand-800 dark:text-brand-200">
            <ShieldCheck className="h-4 w-4" />
            Administrator setup is not complete
          </p>
          <p className="mt-1 text-xs leading-5 text-brand-700/80 dark:text-brand-200/70">
            Create the first administrator before teachers or students can use the workspace.
          </p>
          <Link
            to="/setup"
            className="mt-3 inline-flex text-xs font-semibold text-brand-700 underline-offset-2 hover:underline dark:text-brand-300"
          >
            Complete setup
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
          Sign in as {copy.switchLabel.toLowerCase()} <ArrowRight className="h-4 w-4" />
        </Button>
      </form>

      <div className="mt-6 space-y-2 text-center text-sm text-ink-500 dark:text-ink-400">
        <p>
          New here?{' '}
          <Link
            to={copy.registerPath}
            className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
          >
            {copy.registerLabel}
          </Link>
        </p>
        <p className="text-xs">
          <Link to={copy.otherPath} className="font-medium hover:text-ink-800 dark:hover:text-ink-200">
            {copy.otherLabel}
          </Link>
          <span className="mx-2 text-ink-300 dark:text-ink-700">|</span>
          <Link to="/login" className="font-medium hover:text-ink-800 dark:hover:text-ink-200">
            Administrator sign in
          </Link>
        </p>
        <p className="flex items-center justify-center gap-1.5 pt-2 text-[11px] text-ink-400 dark:text-ink-500">
          <Icon className="h-3.5 w-3.5" /> Secure {copy.switchLabel.toLowerCase()} portal
        </p>
      </div>
    </AuthLayout>
  )
}

export function StudentLoginPage() {
  return <PortalLoginPage portal="student" />
}

export function FacultyLoginPage() {
  return <PortalLoginPage portal="faculty" />
}
