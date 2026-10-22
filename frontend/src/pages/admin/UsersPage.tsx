import { useEffect, useMemo, useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import {
  KeyRound,
  Pencil,
  Plus,
  Search,
  ShieldCheck,
  UserCog,
  UserRound,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card } from '@/components/ui/Card'
import { EmptyState, ErrorState, TableSkeleton } from '@/components/ui/Feedback'
import { Input, Select, Switch } from '@/components/ui/Input'
import { ConfirmDialog, Modal } from '@/components/ui/Modal'
import { PageHeader } from '@/components/ui/PageHeader'
import { Pagination } from '@/components/ui/Pagination'
import { useAuth } from '@/contexts/AuthContext'
import { useToast } from '@/contexts/ToastContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { useDebounce } from '@/hooks/useDebounce'
import { studentsApi, usersApi } from '@/services/api'
import { getErrorMessage } from '@/services/http'
import { cn, formatDate, roleLabels } from '@/lib/utils'
import { userSchema, type UserValues } from '@/lib/validation'
import type { Role, Student, User } from '@/types'

const roleTones: Record<Role, 'brand' | 'info' | 'neutral'> = {
  admin: 'brand',
  faculty: 'info',
  student: 'neutral',
}

function CreateUserForm({
  students,
  onDone,
}: {
  students: Student[]
  onDone: () => void
}) {
  const toast = useToast()
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<UserValues>({
    resolver: zodResolver(userSchema),
    defaultValues: {
      full_name: '',
      email: '',
      password: '',
      role: 'faculty',
      student_id: 0,
    },
  })
  const role = watch('role')

  const onSubmit = handleSubmit(async (values) => {
    try {
      await usersApi.create({
        full_name: values.full_name.trim(),
        email: values.email.trim(),
        password: values.password,
        role: values.role,
        student_id: values.role === 'student' ? Number(values.student_id) : null,
      })
      toast.success('User created', `${values.email.trim()} can now sign in.`)
      onDone()
    } catch (caught) {
      toast.error('Could not create user', getErrorMessage(caught))
    }
  })

  return (
    <form id="create-user-form" onSubmit={onSubmit} className="space-y-4" noValidate>
      <Input
        label="Full name"
        required
        placeholder="Priya Raman"
        error={errors.full_name?.message}
        {...register('full_name')}
      />
      <Input
        label="Email"
        type="email"
        required
        placeholder="name@example.com"
        error={errors.email?.message}
        {...register('email')}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Input
          label="Temporary password"
          type="password"
          required
          placeholder="8+ characters"
          error={errors.password?.message}
          {...register('password')}
        />
        <Select
          label="Role"
          required
          error={errors.role?.message}
          options={[
            { value: 'faculty', label: 'Faculty' },
            { value: 'admin', label: 'Administrator' },
            { value: 'student', label: 'Student' },
          ]}
          {...register('role')}
        />
      </div>
      {role === 'student' ? (
        <Select
          label="Link student record"
          required
          error={errors.student_id?.message}
          placeholder="Choose a student"
          options={students
            .filter((student) => !student.has_account)
            .map((student) => ({
              value: student.id,
              label: `${student.roll_number} Â· ${student.full_name}`,
            }))}
          {...register('student_id')}
        />
      ) : null}
      <p className="text-[11px] text-ink-400">
        Password must contain at least 8 characters, including a letter and a number.
      </p>
      <button type="submit" className="hidden" aria-hidden />
    </form>
  )
}

function EditUserForm({
  user,
  students,
  currentUserId,
  onDone,
}: {
  user: User
  students: Student[]
  currentUserId: number
  onDone: () => void
}) {
  const toast = useToast()
  const [fullName, setFullName] = useState(user.full_name)
  const [email, setEmail] = useState(user.email)
  const [role, setRole] = useState<Role>(user.role)
  const [studentId, setStudentId] = useState<number | ''>(user.student_id ?? '')
  const [isActive, setIsActive] = useState(user.is_active)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const isSelf = user.id === currentUserId

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (fullName.trim().length < 2) {
      setError('Full name is required.')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Enter a valid email address.')
      return
    }
    if (role === 'student' && !studentId) {
      setError('Select the student record to link this account to.')
      return
    }
    setSaving(true)
    try {
      await usersApi.update(user.id, {
        full_name: fullName.trim(),
        email: email.trim(),
        role,
        is_active: isActive,
        student_id: role === 'student' ? Number(studentId) : null,
      })
      toast.success('User updated')
      onDone()
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form id="edit-user-form" onSubmit={submit} className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      <Input
        label="Full name"
        required
        value={fullName}
        onChange={(event) => setFullName(event.target.value)}
      />
      <Input
        label="Email"
        type="email"
        required
        value={email}
        onChange={(event) => setEmail(event.target.value)}
      />
      <div className="grid gap-4 sm:grid-cols-2">
        <Select
          label="Role"
          value={role}
          onChange={(event) => setRole(event.target.value as Role)}
          disabled={isSelf}
          options={[
            { value: 'faculty', label: 'Faculty' },
            { value: 'admin', label: 'Administrator' },
            { value: 'student', label: 'Student' },
          ]}
        />
        <div className="flex items-center rounded-xl border border-ink-200 px-3.5 py-2 dark:border-ink-700">
          <Switch
            checked={isActive}
            onChange={setIsActive}
            label="Active account"
            disabled={isSelf}
          />
        </div>
      </div>
      {role === 'student' ? (
        <Select
          label="Linked student record"
          value={studentId}
          onChange={(event) =>
            setStudentId(event.target.value ? Number(event.target.value) : '')
          }
          placeholder="Choose a student"
          options={students.map((student) => ({
            value: student.id,
            label: `${student.roll_number} Â· ${student.full_name}${
              student.has_account && student.id !== user.student_id ? ' (linked)' : ''
            }`,
            disabled: student.has_account && student.id !== user.student_id,
          }))}
        />
      ) : null}
      {isSelf ? (
        <p className="text-[11px] text-ink-400">
          You cannot change your own role or deactivate your own account.
        </p>
      ) : null}
      <button type="submit" className="hidden" aria-hidden />
      {saving ? <p className="text-xs text-brand-600">Savingâ€¦</p> : null}
    </form>
  )
}

function ResetPasswordForm({ user, onDone }: { user: User; onDone: () => void }) {
  const toast = useToast()
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)

  const submit = async (event: React.FormEvent) => {
    event.preventDefault()
    setError(null)
    if (password.length < 8 || !/[A-Za-z]/.test(password) || !/\d/.test(password)) {
      setError('Use at least 8 characters with one letter and one number.')
      return
    }
    setSaving(true)
    try {
      await usersApi.resetPassword(user.id, password)
      toast.success('Password reset', `Share the new password with ${user.full_name} securely.`)
      onDone()
    } catch (caught) {
      setError(getErrorMessage(caught))
    } finally {
      setSaving(false)
    }
  }

  return (
    <form id="reset-password-form" onSubmit={submit} className="space-y-4">
      {error ? (
        <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-700 dark:border-rose-500/20 dark:bg-rose-500/10 dark:text-rose-300">
          {error}
        </div>
      ) : null}
      <div className="flex items-center gap-3 rounded-xl bg-ink-50 p-3 dark:bg-ink-800/60">
        <Avatar name={user.full_name} />
        <div>
          <p className="text-sm font-semibold text-ink-900 dark:text-white">{user.full_name}</p>
          <p className="text-xs text-ink-500 dark:text-ink-400">{user.email}</p>
        </div>
      </div>
      <Input
        label="New temporary password"
        type="password"
        required
        value={password}
        onChange={(event) => setPassword(event.target.value)}
        placeholder="8+ characters"
      />
      <button type="submit" className="hidden" aria-hidden />
      {saving ? <p className="text-xs text-brand-600">Resettingâ€¦</p> : null}
    </form>
  )
}

export function UsersPage() {
  const { user: currentUser } = useAuth()
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [roleFilter, setRoleFilter] = useState('')
  const [activeFilter, setActiveFilter] = useState<'all' | 'active' | 'inactive'>('all')
  const [page, setPage] = useState(1)
  const [createOpen, setCreateOpen] = useState(false)
  const [editUser, setEditUser] = useState<User | null>(null)
  const [resetUser, setResetUser] = useState<User | null>(null)
  const [toggleTarget, setToggleTarget] = useState<User | null>(null)
  const [toggling, setToggling] = useState(false)
  const debouncedSearch = useDebounce(search)

  const { data, loading, error, refresh } = useApiQuery(
    () =>
      usersApi.list({
        role: roleFilter || undefined,
        search: debouncedSearch || undefined,
        is_active: activeFilter === 'all' ? undefined : activeFilter === 'active',
        page,
        page_size: 20,
      }),
    [roleFilter, debouncedSearch, activeFilter, page],
  )
  const { data: studentPage } = useApiQuery(
    () => studentsApi.list({ page: 1, page_size: 200 }),
    [],
  )
  const students = useMemo(() => studentPage?.items ?? [], [studentPage])

  useEffect(() => {
    setPage(1)
  }, [roleFilter, debouncedSearch, activeFilter])

  const confirmToggle = async () => {
    if (!toggleTarget) return
    setToggling(true)
    try {
      await usersApi.update(toggleTarget.id, { is_active: !toggleTarget.is_active })
      toast.success(toggleTarget.is_active ? 'User deactivated' : 'User reactivated')
      setToggleTarget(null)
      await refresh(true)
    } catch (caught) {
      toast.error('Could not update user', getErrorMessage(caught))
    } finally {
      setToggling(false)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description="Manage faculty, administrator and student portal accounts."
        actions={
          <Button onClick={() => setCreateOpen(true)}>
            <Plus className="h-4 w-4" /> Add user
          </Button>
        }
      />

      <Card>
        <div className="flex flex-col gap-3 border-b border-ink-100 p-4 lg:flex-row lg:items-center dark:border-ink-800">
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search name or emailâ€¦"
              aria-label="Search users"
              className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
            />
          </div>
          <div className="flex flex-wrap gap-2">
            <select
              value={roleFilter}
              onChange={(event) => setRoleFilter(event.target.value)}
              aria-label="Filter by role"
              className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
            >
              <option value="">All roles</option>
              <option value="admin">Administrator</option>
              <option value="faculty">Faculty</option>
              <option value="student">Student</option>
            </select>
            <select
              value={activeFilter}
              onChange={(event) => setActiveFilter(event.target.value as typeof activeFilter)}
              aria-label="Filter by account status"
              className="h-10 rounded-xl border border-ink-200 bg-white px-3 text-sm text-ink-700 shadow-sm focus:border-brand-500 focus:outline-none dark:border-ink-700 dark:bg-ink-900 dark:text-ink-200"
            >
              <option value="all">All statuses</option>
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>
        </div>

        {loading && !data ? (
          <TableSkeleton rows={7} cols={5} />
        ) : error ? (
          <ErrorState message={error} onRetry={() => void refresh()} />
        ) : !data || data.items.length === 0 ? (
          <EmptyState
            icon={UserCog}
            title="No users found"
            description="Try a different search or role filter."
            action={
              <Button onClick={() => setCreateOpen(true)}>
                <Plus className="h-4 w-4" /> Add user
              </Button>
            }
          />
        ) : (
          <>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead>
                  <tr className="border-b border-ink-100 text-[11px] uppercase tracking-wide text-ink-400 dark:border-ink-800">
                    <th className="px-5 py-3 font-semibold">User</th>
                    <th className="px-5 py-3 font-semibold">Role</th>
                    <th className="px-5 py-3 font-semibold">Status</th>
                    <th className="px-5 py-3 font-semibold">Linked student</th>
                    <th className="px-5 py-3 font-semibold">Created</th>
                    <th className="px-5 py-3 text-right font-semibold">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-ink-100 dark:divide-ink-800">
                  {data.items.map((item) => {
                    const student = students.find((row) => row.id === item.student_id)
                    const isSelf = item.id === currentUser?.id
                    return (
                      <tr key={item.id} className="hover:bg-ink-50/60 dark:hover:bg-ink-800/30">
                        <td className="px-5 py-3">
                          <div className="flex items-center gap-3">
                            <Avatar name={item.full_name} size="sm" />
                            <div className="min-w-0">
                              <p className="flex items-center gap-2 truncate text-[13px] font-semibold text-ink-900 dark:text-white">
                                {item.full_name}
                                {isSelf ? (
                                  <Badge tone="brand" className="text-[9px]">
                                    You
                                  </Badge>
                                ) : null}
                              </p>
                              <p className="truncate text-[11px] text-ink-500 dark:text-ink-400">
                                {item.email}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={roleTones[item.role]}>{roleLabels[item.role]}</Badge>
                        </td>
                        <td className="px-5 py-3">
                          <Badge tone={item.is_active ? 'success' : 'neutral'} dot>
                            {item.is_active ? 'Active' : 'Inactive'}
                          </Badge>
                        </td>
                        <td className="px-5 py-3 text-[11px] text-ink-500 dark:text-ink-400">
                          {student ? `${student.roll_number} Â· ${student.full_name}` : 'â€”'}
                        </td>
                        <td className="px-5 py-3 text-[11px] text-ink-500 dark:text-ink-400">
                          {formatDate(item.created_at, 'dd MMM yyyy')}
                        </td>
                        <td className="px-5 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => setEditUser(item)}
                              className="rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800"
                              aria-label={`Edit ${item.full_name}`}
                            >
                              <Pencil className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setResetUser(item)}
                              className="rounded-lg p-2 text-ink-400 hover:bg-brand-50 hover:text-brand-600 dark:hover:bg-brand-500/10"
                              aria-label={`Reset password for ${item.full_name}`}
                            >
                              <KeyRound className="h-4 w-4" />
                            </button>
                            <button
                              type="button"
                              disabled={isSelf}
                              onClick={() => setToggleTarget(item)}
                              className={cn(
                                'rounded-lg p-2 text-ink-400 hover:bg-ink-100 hover:text-ink-700 dark:hover:bg-ink-800',
                                isSelf && 'cursor-not-allowed opacity-30',
                              )}
                              aria-label={
                                item.is_active
                                  ? `Deactivate ${item.full_name}`
                                  : `Reactivate ${item.full_name}`
                              }
                            >
                              <UserRound className="h-4 w-4" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <Pagination
              page={data.page}
              pageSize={data.page_size}
              total={data.total}
              onPageChange={setPage}
              className="border-t border-ink-100 dark:border-ink-800"
            />
          </>
        )}
      </Card>

      <div className="flex items-start gap-2.5 rounded-xl border border-ink-200 px-4 py-3 text-[11px] leading-5 text-ink-500 dark:border-ink-800 dark:text-ink-400">
        <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-brand-500" />
        At least one active administrator must always exist. Role changes and password resets are
        recorded in the audit log.
      </div>

      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Add a user"
        description="Create a staff account or link a student to portal access."
        footer={
          <>
            <Button variant="secondary" onClick={() => setCreateOpen(false)}>
              Cancel
            </Button>
            <Button type="submit" form="create-user-form">
              Create user
            </Button>
          </>
        }
      >
        <CreateUserForm
          students={students}
          onDone={() => {
            setCreateOpen(false)
            void refresh(true)
          }}
        />
      </Modal>

      <Modal
        open={Boolean(editUser)}
        onClose={() => setEditUser(null)}
        title="Edit user"
        description="Update account details. Use reset password to change credentials."
        footer={
          <>
            <Button variant="secondary" onClick={() => setEditUser(null)}>
              Cancel
            </Button>
            <Button type="submit" form="edit-user-form">
              Save changes
            </Button>
          </>
        }
      >
        {editUser ? (
          <EditUserForm
            key={editUser.id}
            user={editUser}
            students={students}
            currentUserId={currentUser?.id ?? 0}
            onDone={() => {
              setEditUser(null)
              void refresh(true)
            }}
          />
        ) : null}
      </Modal>

      <Modal
        open={Boolean(resetUser)}
        onClose={() => setResetUser(null)}
        title="Reset password"
        description="The user can sign in with the new password immediately."
        footer={
          <>
            <Button variant="secondary" onClick={() => setResetUser(null)}>
              Cancel
            </Button>
            <Button type="submit" form="reset-password-form">
              <KeyRound className="h-4 w-4" /> Reset password
            </Button>
          </>
        }
      >
        {resetUser ? (
          <ResetPasswordForm
            user={resetUser}
            onDone={() => setResetUser(null)}
          />
        ) : null}
      </Modal>

      <ConfirmDialog
        open={Boolean(toggleTarget)}
        onClose={() => setToggleTarget(null)}
        onConfirm={confirmToggle}
        loading={toggling}
        tone={toggleTarget?.is_active ? 'danger' : 'success'}
        confirmLabel={toggleTarget?.is_active ? 'Deactivate user' : 'Reactivate user'}
        title={toggleTarget?.is_active ? 'Deactivate this account?' : 'Reactivate this account?'}
        description={
          toggleTarget?.is_active
            ? `${toggleTarget?.full_name} will be signed out and blocked from signing in.`
            : `${toggleTarget?.full_name} will be able to sign in again.`
        }
      />
    </div>
  )
}

