import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { Check, Eye, EyeOff, LockKeyhole, Mail, UserRound } from 'lucide-react'
import { AuthLayout } from '@/layouts/AuthLayout'
import { Button } from '@/components/ui/Button'
import { Input } from '@/components/ui/Input'
import { Alert } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { authApi } from '@/services/api'
import { getErrorMessage } from '@/services/http'
import { cn, homeForRole } from '@/lib/utils'
import { registerSchema, type RegisterValues } from '@/lib/validation'

export function RegisterPage() {
  const { register: createAccount } = useAuth()
  const toast = useToast()
  const navigate = useNavigate()
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
        if (active && status.setup_required) {
          navigate('/setup', { replace: true })
        }
      })
      .catch(() => {
        // The registration form will surface any API error on submit.
      })
    return () => {
      active = false
    }
  }, [navigate])

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
      const user = await createAccount(
        values.full_name.trim(),
        values.email.trim(),
        values.password,
      )
      toast.success('Account created', 'Your faculty workspace is ready.')
      navigate(homeForRole(user.role), { replace: true })
    } catch (caught) {
      setError(getErrorMessage(caught, 'Unable to create your account.'))
    }
  })

  return (
    <AuthLayout
      title="Create your teacher account"
      subtitle="Teacher accounts can manage their assigned classes. An administrator assigns classes after signup."
    >
      <form onSubmit={onSubmit} className="space-y-4" noValidate>
        {error ? (
          <Alert tone="danger" title="Registration failed">
            {error}
          </Alert>
        ) : null}
        <Input
          label="Full name"
          autoComplete="name"
          placeholder="Priya Raman"
          leading={<UserRound className="h-4 w-4" />}
          error={errors.full_name?.message}
          {...register('full_name')}
        />
        <Input
          label="Work email"
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
          Create account
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-ink-500 dark:text-ink-400">
        Already have an account?{' '}
        <Link
          to="/faculty/login"
          className="font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
        >
          Teacher sign in
        </Link>
      </p>
      <p className="mt-2 text-center text-xs text-ink-400 dark:text-ink-500">
        Student?{' '}
        <Link
          to="/student/register"
          className="font-medium hover:text-ink-700 dark:hover:text-ink-300"
        >
          Create a student account
        </Link>
      </p>
    </AuthLayout>
  )
}

