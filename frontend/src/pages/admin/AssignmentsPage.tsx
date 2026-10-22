import { useEffect, useMemo, useState } from 'react'
import { Check, GraduationCap, Save, Search, UsersRound } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Card, CardContent, CardHeader } from '@/components/ui/Card'
import { EmptyState, ErrorState, Skeleton } from '@/components/ui/Feedback'
import { PageHeader } from '@/components/ui/PageHeader'
import { useToast } from '@/contexts/ToastContext'
import { useApiQuery } from '@/hooks/useApiQuery'
import { adminApi, classesApi } from '@/services/api'
import { getErrorMessage } from '@/services/http'
import { cn } from '@/lib/utils'

export function AssignmentsPage() {
  const toast = useToast()
  const [search, setSearch] = useState('')
  const [assignments, setAssignments] = useState<Record<number, number[]>>({})
  const [savingId, setSavingId] = useState<number | null>(null)

  const { data: faculty, loading, error, refresh } = useApiQuery(adminApi.faculty, [])
  const { data: classes } = useApiQuery(classesApi.list, [])

  useEffect(() => {
    if (!faculty) return
    const next: Record<number, number[]> = {}
    for (const member of faculty) next[member.id] = [...member.class_ids]
    setAssignments(next)
  }, [faculty])

  const filteredFaculty = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return faculty ?? []
    return (faculty ?? []).filter(
      (member) =>
        member.full_name.toLowerCase().includes(term) ||
        member.email.toLowerCase().includes(term),
    )
  }, [faculty, search])

  const toggleClass = (facultyId: number, classId: number) => {
    setAssignments((current) => {
      const existing = current[facultyId] ?? []
      return {
        ...current,
        [facultyId]: existing.includes(classId)
          ? existing.filter((id) => id !== classId)
          : [...existing, classId],
      }
    })
  }

  const isDirty = (facultyId: number) => {
    const member = faculty?.find((item) => item.id === facultyId)
    if (!member) return false
    const current = [...(assignments[facultyId] ?? [])].sort((a, b) => a - b)
    const original = [...member.class_ids].sort((a, b) => a - b)
    return current.join(',') !== original.join(',')
  }

  const save = async (facultyId: number) => {
    setSavingId(facultyId)
    try {
      await adminApi.setFacultyClasses(facultyId, assignments[facultyId] ?? [])
      const member = faculty?.find((item) => item.id === facultyId)
      toast.success('Assignments saved', member?.full_name)
      await refresh(true)
    } catch (caught) {
      toast.error('Could not save assignments', getErrorMessage(caught))
    } finally {
      setSavingId(null)
    }
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Faculty assignments"
        description="Faculty can only see and mark attendance for the classes assigned here."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-ink-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search faculty…"
            aria-label="Search faculty"
            className="h-10 w-full rounded-xl border border-ink-200 bg-white pl-9 pr-3 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-2 focus:ring-brand-500/20 dark:border-ink-700 dark:bg-ink-900 dark:text-white"
          />
        </div>
        <Badge tone="neutral">
          {classes?.length ?? 0} classes · {faculty?.length ?? 0} faculty
        </Badge>
      </div>

      {loading && !faculty ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {[0, 1].map((item) => (
            <Skeleton key={item} className="h-56 w-full rounded-2xl" />
          ))}
        </div>
      ) : error ? (
        <Card>
          <ErrorState message={error} onRetry={() => void refresh()} />
        </Card>
      ) : filteredFaculty.length === 0 ? (
        <Card>
          <EmptyState
            icon={GraduationCap}
            title={search ? 'No faculty match your search' : 'No faculty accounts yet'}
            description={
              search
                ? 'Try a different name or email.'
                : 'Create faculty accounts from the Users page, then assign classes here.'
            }
          />
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {filteredFaculty.map((member) => {
            const selected = assignments[member.id] ?? []
            return (
              <Card key={member.id}>
                <CardHeader
                  title={
                    <span className="flex items-center gap-2">
                      {member.full_name}
                      {!member.is_active ? (
                        <Badge tone="neutral">Inactive</Badge>
                      ) : null}
                    </span>
                  }
                  description={member.email}
                  action={
                    <Button
                      size="sm"
                      onClick={() => void save(member.id)}
                      disabled={!isDirty(member.id)}
                      loading={savingId === member.id}
                    >
                      <Save className="h-3.5 w-3.5" /> Save
                    </Button>
                  }
                />
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar name={member.full_name} size="sm" />
                    <span className="text-xs text-ink-500 dark:text-ink-400">
                      {selected.length} of {classes?.length ?? 0} classes assigned
                    </span>
                    <div className="ml-auto flex gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setAssignments((current) => ({
                            ...current,
                            [member.id]: (classes ?? []).map((item) => item.id),
                          }))
                        }
                        className="text-[10px] font-semibold text-brand-600 hover:text-brand-700 dark:text-brand-400"
                      >
                        All
                      </button>
                      <span className="text-ink-300">·</span>
                      <button
                        type="button"
                        onClick={() =>
                          setAssignments((current) => ({ ...current, [member.id]: [] }))
                        }
                        className="text-[10px] font-semibold text-ink-500 hover:text-ink-700 dark:text-ink-400"
                      >
                        None
                      </button>
                    </div>
                  </div>
                  {!classes || classes.length === 0 ? (
                    <p className="rounded-lg border border-dashed border-ink-200 px-3 py-4 text-center text-xs text-ink-400 dark:border-ink-700">
                      Create classes before assigning them.
                    </p>
                  ) : (
                    <div className="grid gap-1.5 sm:grid-cols-2">
                      {classes.map((classRoom) => {
                        const checked = selected.includes(classRoom.id)
                        return (
                          <label
                            key={classRoom.id}
                            className={cn(
                              'flex cursor-pointer items-center gap-2 rounded-lg border px-2.5 py-2 text-xs transition',
                              checked
                                ? 'border-brand-200 bg-brand-50/60 text-brand-800 dark:border-brand-500/30 dark:bg-brand-500/10 dark:text-brand-200'
                                : 'border-ink-200 text-ink-600 hover:border-ink-300 hover:bg-ink-50 dark:border-ink-700 dark:text-ink-300 dark:hover:bg-ink-800/50',
                            )}
                          >
                            <span
                              className={cn(
                                'flex h-3.5 w-3.5 shrink-0 items-center justify-center rounded border',
                                checked
                                  ? 'border-brand-600 bg-brand-600 text-white'
                                  : 'border-ink-300 dark:border-ink-600',
                              )}
                            >
                              {checked ? <Check className="h-2.5 w-2.5" strokeWidth={3} /> : null}
                            </span>
                            <input
                              type="checkbox"
                              className="sr-only"
                              checked={checked}
                              onChange={() => toggleClass(member.id, classRoom.id)}
                            />
                            <span className="min-w-0">
                              <span className="block truncate font-medium">{classRoom.name}</span>
                              <span className="block text-[10px] text-ink-400">
                                Sem {classRoom.semester} · {classRoom.student_count} students
                              </span>
                            </span>
                          </label>
                        )
                      })}
                    </div>
                  )}
                  {selected.length === 0 ? (
                    <p className="flex items-center gap-1.5 text-[11px] text-amber-600 dark:text-amber-400">
                      <UsersRound className="h-3.5 w-3.5" />
                      This faculty member currently has no class access.
                    </p>
                  ) : null}
                </CardContent>
              </Card>
            )
          })}
        </div>
      )}
    </div>
  )
}
