import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  BadgeCheck,
  Eye,
  EyeOff,
  KeyRound,
  LockKeyhole,
  Moon,
  Palette,
  Save,
  ShieldCheck,
  SlidersHorizontal,
  Sun,
  UserRound,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { Alert, Skeleton } from '@/components/ui/Feedback'
import { Input, Switch } from '@/components/ui/Input'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { useToast } from '@/contexts/ToastContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { settingsApi } from '@/services/api'
import { getErrorMessage } from '@/services/http'
import { formatDateTime, roleLabels } from '@/lib/utils'
import {
  changePasswordSchema,
  type ChangePasswordValues,
} from '@/lib/validation'

export function SettingsPage() {
  const { user, changePassword } = useAuth()
  const toast = useToast()
  const { theme, setTheme } = useTheme()
  const { data, loading, refresh } = useApiQuery(settingsApi.get, [])
  const [threshold, setThreshold] = useState(75)
  const [odCounts, setOdCounts] = useState(true)
  const [leaveCounts, setLeaveCounts] = useState(false)
  const [savingPolicy, setSavingPolicy] = useState(false)
  const [policyError, setPolicyError] = useState<string | null>(null)
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

  useEffect(() => {
    if (!data) return
    setThreshold(data.attendance_threshold)
    setOdCounts(data.od_counts_as_attended)
    setLeaveCounts(data.leave_counts_as_attended)
  }, [data?.updated_at])

  const savePolicy = async () => {
    setPolicyError(null)
    if (threshold < 0 || threshold > 100) {
      setPolicyError('Threshold must be between 0 and 100.')
      return
    }
    setSavingPolicy(true)
    try {
      await settingsApi.update({
        attendance_threshold: threshold,
        od_counts_as_attended: odCounts,
        leave_counts_as_attended: leaveCounts,
      })
      toast.success('Attendance policy saved', 'Reports will use these settings immediately.')
      await refresh(true)
    } catch (caught) {
      setPolicyError(getErrorMessage(caught))
    } finally {
      setSavingPolicy(false)
    }
  }

  const onChangePassword = handleSubmit(async (values) => {
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
        title="Settings"
        description="Tune the attendance policy and manage your account security."
      />

      <div className="grid gap-5 xl:grid-cols-[1.4fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader
              title="Attendance policy"
              description="These settings apply across all reports for everyone."
              action={<SlidersHorizontal className="h-4 w-4 text-ink-400" />}
            />
            {loading && !data ? (
              <CardContent className="space-y-4">
                <Skeleton className="h-10 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </CardContent>
            ) : (
              <CardContent className="space-y-5">
                {policyError ? (
                  <Alert tone="danger" title="Could not save settings">
                    {policyError}
                  </Alert>
                ) : null}
                <div>
                  <label
                    htmlFor="threshold"
                    className="flex items-baseline justify-between text-sm font-medium text-ink-700 dark:text-ink-300"
                  >
                    <span>Minimum attendance threshold</span>
                    <span className="text-lg font-semibold text-brand-600 dark:text-brand-400">
                      {threshold}%
                    </span>
                  </label>
                  <input
                    id="threshold"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={threshold}
                    onChange={(event) => setThreshold(Number(event.target.value))}
                    className="mt-3 h-2 w-full cursor-pointer appearance-none rounded-full bg-ink-200 accent-brand-600 dark:bg-ink-700"
                  />
                  <div className="mt-1.5 flex justify-between text-[10px] text-ink-400">
                    <span>0%</span>
                    <span>75% typical</span>
                    <span>100%</span>
                  </div>
                  <p className="mt-2 text-xs leading-5 text-ink-500 dark:text-ink-400">
                    Students below this percentage are flagged in dashboards and reports. This is
                    your workspace policy, not an official university rule.
                  </p>
                </div>

                <div className="space-y-3 rounded-xl border border-ink-200 p-4 dark:border-ink-700">
                  <Switch
                    checked={odCounts}
                    onChange={setOdCounts}
                    label="Count on-duty (OD) as attended"
                    description="Students on approved duty are treated as present in percentage calculations."
                  />
                  <div className="h-px bg-ink-100 dark:bg-ink-800" />
                  <Switch
                    checked={leaveCounts}
                    onChange={setLeaveCounts}
                    label="Count leave as attended"
                    description="Off by default. Enable only if approved leave should protect attendance."
                  />
                </div>

                <div className="rounded-xl bg-ink-50 p-4 text-xs leading-5 text-ink-600 dark:bg-ink-800/50 dark:text-ink-300">
                  <p className="font-semibold text-ink-800 dark:text-ink-100">How it is calculated</p>
                  <p className="mt-1">
                    Attendance % = (present + {odCounts ? 'OD' : '0'} +{' '}
                    {leaveCounts ? 'leave' : '0'}) ÷ finalized sessions attended classes × 100.
                    Only finalized sessions count, and absent students reduce the percentage.
                  </p>
                  {data ? (
                    <p className="mt-2 text-[10px] text-ink-400">
                      Last updated {formatDateTime(data.updated_at)}
                    </p>
                  ) : null}
                </div>

                <div className="flex justify-end">
                  <Button onClick={() => void savePolicy()} loading={savingPolicy}>
                    <Save className="h-4 w-4" /> Save policy
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>

          <Card>
            <CardHeader
              title="Change password"
              description="Use at least 8 characters with a letter and a number."
              action={<KeyRound className="h-4 w-4 text-ink-400" />}
            />
            <CardContent>
              <form onSubmit={onChangePassword} className="space-y-4" noValidate>
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
                        {showPasswords ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
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
            <CardHeader title="Your account" />
            <CardContent>
              {user ? (
                <>
                  <div className="flex items-center gap-3">
                    <Avatar name={user.full_name} size="lg" />
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">
                        {user.full_name}
                      </p>
                      <p className="truncate text-xs text-ink-500 dark:text-ink-400">
                        {user.email}
                      </p>
                    </div>
                  </div>
                  <dl className="mt-5 space-y-3 text-sm">
                    <div className="flex items-center justify-between">
                      <dt className="text-xs text-ink-500 dark:text-ink-400">Role</dt>
                      <dd>
                        <Badge tone="brand">
                          <BadgeCheck className="h-3 w-3" /> {roleLabels[user.role]}
                        </Badge>
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-xs text-ink-500 dark:text-ink-400">Member since</dt>
                      <dd className="text-xs font-medium text-ink-700 dark:text-ink-200">
                        {formatDateTime(user.created_at)}
                      </dd>
                    </div>
                    <div className="flex items-center justify-between">
                      <dt className="text-xs text-ink-500 dark:text-ink-400">Security</dt>
                      <dd className="inline-flex items-center gap-1 text-xs font-medium text-emerald-600 dark:text-emerald-400">
                        <ShieldCheck className="h-3.5 w-3.5" /> HttpOnly session
                      </dd>
                    </div>
                  </dl>
                </>
              ) : (
                <Skeleton className="h-24 w-full" />
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader title="Appearance" description="Your preference is saved on this device." />
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
                    className={`rounded-md p-1.5 ${theme === 'light' ? 'bg-ink-100 text-ink-900 dark:bg-ink-700 dark:text-white' : 'text-ink-400'}`}
                    aria-label="Use light theme"
                    aria-pressed={theme === 'light'}
                  >
                    <Sun className="h-4 w-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setTheme('dark')}
                    className={`rounded-md p-1.5 ${theme === 'dark' ? 'bg-ink-100 text-ink-900 dark:bg-ink-700 dark:text-white' : 'text-ink-400'}`}
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
            <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-ink-400" />
            Administrators can reset your password from the Users page if you lose access.
          </div>
        </div>
      </div>
    </div>
  )
}
