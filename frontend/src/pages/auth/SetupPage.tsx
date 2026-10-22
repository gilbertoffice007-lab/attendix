import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Eye, EyeOff, LockKeyhole, Mail, ShieldCheck, UserRound } from 'lucide-react'
import { AuthLayout } from '@/layouts/AuthLayout'
import { Button, buttonStyles } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert, LoadingScreen } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { authApi } from '@/services/api'
import { getErrorMessage } from '@/services/http'
import { cn, homeForRole } from '@/lib/utils'
import { registerSchema, type RegisterValues } from '@/lib/validation'

type SetupState = 'loading' | 'required' | 'complete' | 'error'

export function SetupPage() {
  const { setup } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
  const [state, setState] = useState<SetupState>('loading')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<RegisterValues>({
    resolver: zodResolver(registerSchema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      confirm_password: '',
    },
  })
  const password = watch('password')

  useEffect(() => {
    let active = true
    authApi
      .setupStatus()
      .then((status) => {
        if (active) setState(status.setup_required ? 'required' : 'complete')
      })
      .catch(() => {
        if (active) {
          setState('error')
          setError('Unable to check setup status. Check the API connection and refresh.')
        }
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
      const user = await setup(
        values.full_name.trim(),
        values.email.trim(),
        values.password,
      )
      toast.success('Administrator created', 'You can now add classes, faculty and students.')
      navigate(homeForRole(user.role), { replace: true })
    } catch (caught) {
      setError(getErrorMessage(caught, 'Unable to create the administrator account.'))
    }
  })

  if (state === 'loading') {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingScreen label="Checking setup status..." />
      </div>
    )
  }

  if (state === 'complete') {
    return (
      <AuthLayout
        title="Setup is complete"
        subtitle="An administrator account already exists. Sign in to manage the workspace."
      >
        <div className="rounded-xl border border-ink-200 bg-ink-50/60 p-4 dark:border-ink-800 dark:bg-ink-900/60">
          <p className="flex items-center gap-2 text-sm font-medium text-ink-700 dark:text-ink-200">
            <ShieldCheck className="h-4 w-4 text-brand-600 dark:text-brand-400" />
            This system is already configured.
          </p>
          <p className="mt-2 text-xs leading-5 text-ink-500 dark:text-ink-400">
            Ask an administrator to create your account from the Users page.
          </p>
        </div>
        <Link to="/login" className={buttonStyles('primary', 'lg', 'mt-5 w-full')}>
          Go to sign in
        </Link>
      </AuthLayout>
    )
  }

  return (
    <AuthLayout
      title="Create the administrator account"
      subtitle="This one-time setup creates the first administrator. After that, add faculty and students from the Users page."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? (
          <Alert tone="danger" title="Setup failed">
            {error}
          </Alert>
        ) : null}
        <Input
          label="Full name"
          autoComplete="name"
          placeholder="Campus Administrator"
          leading={<UserRound className="h-4 w-4" />}
          error={errors.full_name?.message}
          {...register('full_name')}
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
        <Button type="submit" size="lg" className="w-full" loading={isSubmitting}>
          Create administrator account
        </Button>
      </form>
    </AuthLayout>
  )
}
