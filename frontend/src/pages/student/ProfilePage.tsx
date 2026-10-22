import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  BadgeCheck,
  BookUser,
  CalendarDays,
  Eye,
  EyeOff,
  GraduationCap,
  KeyRound,
  LockKeyhole,
  Mail,
  Moon,
  Palette,
  ShieldCheck,
  Sun,
  UserRound,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { ErrorState, Skeleton } from '@/components/ui/Feedback'
import { Input } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useToast } from '@/contexts/ToastContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { studentsApi } from '@/services/api'
import { getErrorMessage } from '@/services/http'
import { formatDate, roleLabels } from '@/lib/utils'
import { changePasswordSchema, type ChangePasswordValues } from '@/lib/validation'

export function StudentProfilePage() {
  const { user, changePassword } = useAuth()
  const { theme, setTheme } = useTheme()
  const toast = useToast()
  const { data, loading, error, refresh } = useApiQuery(studentsApi.me, [])
  const [showPasswords, setShowPasswords] = useState(false)

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordValues>({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: { current_password: '', new_password: '', confirm_password: '' },
  })

  const onSubmit = handleSubmit(async (values) => {
    try {
      await changePassword(values.current_password, values.new_password)
      toast.success('Password updated', 'Use your new password the next time you sign in.')
      reset()
    } catch (caught) {
      toast.error('Could not update password', getErrorMessage(caught))
    }
  })

  return (
    <div className="space-y-5">
      <PageHeader
        title="My profile"
        description="Your student record, account security and appearance preferences."
      />

      {loading && !data ? (
        <Skeleton className="h-64 w-full rounded-2xl" />
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={() => void refresh()} />
        </Card>
      ) : data && user ? (
        <div className="grid gap-5 xl:grid-cols-[1.35fr_1fr]">
          <div className="space-y-5">
            <Card className="overflow-hidden">
              <div className="relative h-24 bg-gradient-to-br from-brand-700 via-brand-800 to-brand-950">
                <div
                  className="absolute inset-0 opacity-40"
                  style={{
                    backgroundImage:
                      'radial-gradient(circle at 20% 20%, rgba(255,255,255,0.18), transparent 45%), radial-gradient(circle at 80% 0%, rgba(94,234,212,0.25), transparent 40%)',
                  }}
                  aria-hidden
                />
              </div>
              <CardContent className="relative pt-0">
                <div className="-mt-9 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div className="flex items-end gap-3">
                    <Avatar
                      name={user.full_name}
                      size="xl"
                      className="ring-4 ring-white dark:ring-ink-900"
                    />
                    <div className="pb-1">
                      <h2 className="text-lg font-semibold text-ink-900 dark:text-white">
                        {user.full_name}
                      </h2>
                      <p className="text-xs text-ink-500 dark:text-ink-400">{data.roll_number}</p>
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5 pb-1">
                    <Badge tone="brand">
                      <BadgeCheck className="h-3 w-3" /> {roleLabels[user.role]}
                    </Badge>
                    <Badge tone={data.is_active ? 'success' : 'neutral'} dot>
                      {data.is_active ? 'Active' : 'Inactive'}
                    </Badge>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 sm:grid-cols-2">
                  <div className="flex items-start gap-3 rounded-xl border border-ink-100 p-3.5 dark:border-ink-800">
                    <Mail className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                        Email
                      </p>
                      <p className="truncate text-[12px] font-medium text-ink-800 dark:text-ink-100">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-ink-100 p-3.5 dark:border-ink-800">
                    <GraduationCap className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                        Class
                      </p>
                      <p className="truncate text-[12px] font-medium text-ink-800 dark:text-ink-100">
                        {data.class_name}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-ink-100 p-3.5 dark:border-ink-800">
                    <BookUser className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                        Department
                      </p>
                      <p className="truncate text-[12px] font-medium text-ink-800 dark:text-ink-100">
                        {data.department}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3 rounded-xl border border-ink-100 p-3.5 dark:border-ink-800">
                    <CalendarDays className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
                    <div className="min-w-0">
                      <p className="text-[10px] font-semibold uppercase tracking-wide text-ink-400">
                        Semester · Year
                      </p>
                      <p className="truncate text-[12px] font-medium text-ink-800 dark:text-ink-100">
                        Semester {data.semester} · {data.academic_year}
                      </p>
                    </div>
                  </div>
                </div>

                <p className="mt-4 flex items-start gap-2 text-[11px] leading-5 text-ink-400">
                  <UserRound className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                  Student record details are maintained by your administrator. Contact the office
                  if anything above is incorrect.
                </p>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Change password"
                description="Use at least 8 characters with a letter and a number."
                action={<KeyRound className="h-4 w-4 text-ink-400" />}
              />
              <CardContent>
                <form onSubmit={onSubmit} className="space-y-4" noValidate>
                  <Input
                    label="Current password"
                    type={showPasswords ? 'text' : 'password'}
                    autoComplete="current-password"
                    error={errors.current_password?.message}
                    leading={<LockKeyhole className="h-4 w-4" />}
                    {...register('current_password')}
                  />
                  <div className="grid gap-4 sm:grid-cols-2">
                    <Input
                      label="New password"
                      type={showPasswords ? 'text' : 'password'}
                      autoComplete="new-password"
                      error={errors.new_password?.message}
                      {...register('new_password')}
                    />
                    <Input
                      label="Confirm new password"
                      type={showPasswords ? 'text' : 'password'}
                      autoComplete="new-password"
                      error={errors.confirm_password?.message}
                      trailing={
                        <button
                          type="button"
                          onClick={() => setShowPasswords((value) => !value)}
                          className="rounded-md p-1.5 text-ink-400 hover:text-ink-700 dark:hover:text-ink-200"
                          aria-label={showPasswords ? 'Hide passwords' : 'Show passwords'}
                        >
                          {showPasswords ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      }
                      {...register('confirm_password')}
                    />
                  </div>
                  <div className="flex justify-end">
                    <Button type="submit" variant="secondary" loading={isSubmitting}>
                      Update password
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>

          <div className="space-y-5">
            <Card>
              <CardHeader title="Account" />
              <CardContent>
                <dl className="space-y-3 text-sm">
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-ink-500 dark:text-ink-400">Portal role</dt>
                    <dd>
                      <Badge tone="neutral">{roleLabels[user.role]}</Badge>
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-ink-500 dark:text-ink-400">Roll number</dt>
                    <dd className="text-xs font-semibold text-ink-700 dark:text-ink-200">
                      {data.roll_number}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-ink-500 dark:text-ink-400">Member since</dt>
                    <dd className="text-xs font-medium text-ink-700 dark:text-ink-200">
                      {formatDate(data.created_at, 'dd MMM yyyy')}
                    </dd>
                  </div>
                  <div className="flex items-center justify-between">
                    <dt className="text-xs text-ink-500 dark:text-ink-400">Session</dt>
                    <dd className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                      <ShieldCheck className="h-3.5 w-3.5" /> HttpOnly cookie
                    </dd>
                  </div>
                </dl>
              </CardContent>
            </Card>

            <Card>
              <CardHeader
                title="Appearance"
                description="Your preference is saved on this device."
              />
              <CardContent>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-ink-100 text-ink-500 dark:bg-ink-800 dark:text-ink-300">
                      <Palette className="h-4 w-4" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-ink-800 dark:text-ink-100">Theme</p>
                      <p className="text-[11px] text-ink-500 dark:text-ink-400">
                        {theme === 'dark' ? 'Dark appearance' : 'Light appearance'}
                      </p>
                    </div>
                  </div>
                  <div className="inline-flex rounded-lg border border-ink-200 p-0.5 dark:border-ink-700">
                    <button
                      type="button"
                      onClick={() => setTheme('light')}
                      className={`rounded-md p-1.5 ${
                        theme === 'light'
                          ? 'bg-ink-100 text-ink-900 dark:bg-ink-700 dark:text-white'
                          : 'text-ink-400'
                      }`}
                      aria-label="Use light theme"
                      aria-pressed={theme === 'light'}
                    >
                      <Sun className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => setTheme('dark')}
                      className={`rounded-md p-1.5 ${
                        theme === 'dark'
                          ? 'bg-ink-100 text-ink-900 dark:bg-ink-700 dark:text-white'
                          : 'text-ink-400'
                      }`}
                      aria-label="Use dark theme"
                      aria-pressed={theme === 'dark'}
                    >
                      <Moon className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </CardContent>
            </Card>

            <div className="flex items-start gap-2.5 rounded-xl border border-ink-200 px-4 py-3 text-[11px] leading-5 text-ink-500 dark:border-ink-800 dark:text-ink-400">
              <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
              Passwords are hashed with Argon2. Administrators can reset your password if you lose
              access.
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
