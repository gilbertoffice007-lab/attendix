import { api, downloadFile } from './http'
import type {
  AttendanceSummary,
  AuditLog,
  ClassFaculty,
  ClassReportRow,
  ClassRoom,
  CurrentUser,
  CustomList,
  CustomListDetail,
  Dashboard,
  EntrySummary,
  FacultyWithAssignments,
  HistoryPage,
  Page,
  SessionDetail,
  SessionListItem,
  Settings,
  SetupStatus,
  Student,
  StudentRegistrationOptions,
  StudentImportResult,
  StudentList,
  StudentReport,
  Subject,
  SubjectReportRow,
  User,
  StatusOption,
} from '@/types'

export const authApi = {
  login: (payload: { email: string; password: string; portal?: 'student' | 'faculty' }) =>
    api.post<CurrentUser>('/auth/login', payload).then((response) => response.data),
  register: (payload: { full_name: string; email: string; password: string }) =>
    api.post<CurrentUser>('/auth/register', payload).then((response) => response.data),
  registerStudent: (payload: {
    full_name: string
    email: string
    password: string
    class_id: number
    roll_number: string
  }) =>
    api.post<CurrentUser>('/auth/register/student', payload).then((response) => response.data),
  setupStatus: () =>
    api.get<SetupStatus>('/auth/setup-status').then((response) => response.data),
  studentRegistrationOptions: () =>
    api
      .get<StudentRegistrationOptions>('/auth/student-registration')
      .then((response) => response.data),
  setup: (payload: { full_name: string; email: string; password: string }) =>
    api.post<CurrentUser>('/auth/setup', payload).then((response) => response.data),
  me: () => api.get<CurrentUser>('/auth/me').then((response) => response.data),
  logout: () => api.post('/auth/logout').then((response) => response.data),
  changePassword: (payload: { current_password: string; new_password: string }) =>
    api.post('/auth/change-password', payload).then((response) => response.data),
}

export const classesApi = {
  list: () => api.get<ClassRoom[]>('/classes').then((response) => response.data),
  get: (id: number) => api.get<ClassRoom>(`/classes/${id}`).then((response) => response.data),
  create: (payload: {
    name: string
    department: string
    semester: number
    academic_year: string
  }) => api.post<ClassRoom>('/classes', payload).then((response) => response.data),
  update: (
    id: number,
    payload: Partial<{
      name: string
      department: string
      semester: number
      academic_year: string
    }>,
  ) => api.patch<ClassRoom>(`/classes/${id}`, payload).then((response) => response.data),
  students: (id: number, params?: { search?: string; include_inactive?: boolean }) =>
    api
      .get<Student[]>(`/classes/${id}/students`, { params })
      .then((response) => response.data),
  subjects: (id: number) =>
    api.get<Subject[]>(`/classes/${id}/subjects`).then((response) => response.data),
  faculty: (id: number) =>
    api.get<ClassFaculty[]>(`/classes/${id}/faculty`).then((response) => response.data),
}

export const subjectsApi = {
  list: (classId?: number) =>
    api
      .get<Subject[]>('/subjects', { params: { class_id: classId } })
      .then((response) => response.data),
  create: (payload: {
    name: string
    subject_code: string
    class_id: number
    faculty_id?: number | null
  }) => api.post<Subject>('/subjects', payload).then((response) => response.data),
  update: (
    id: number,
    payload: Partial<{ name: string; subject_code: string; faculty_id: number | null }>,
  ) => api.patch<Subject>(`/subjects/${id}`, payload).then((response) => response.data),
  remove: (id: number) => api.delete(`/subjects/${id}`).then((response) => response.data),
}

export const studentsApi = {
  list: (params: {
    class_id?: number
    search?: string
    is_active?: boolean
    page?: number
    page_size?: number
  }) => api.get<Page<Student>>('/students', { params }).then((response) => response.data),
  me: () => api.get<Student>('/students/me').then((response) => response.data),
  create: (payload: {
    roll_number: string
    full_name: string
    class_id: number
    is_active?: boolean
  }) => api.post<Student>('/students', payload).then((response) => response.data),
  update: (
    id: number,
    payload: Partial<{
      roll_number: string
      full_name: string
      class_id: number
      is_active: boolean
    }>,
  ) => api.patch<Student>(`/students/${id}`, payload).then((response) => response.data),
  createAccount: (
    id: number,
    payload: { email: string; password: string; full_name?: string },
  ) => api.post(`/students/${id}/account`, payload).then((response) => response.data),
  importCsv: (classId: number, file: File) => {
    const body = new FormData()
    body.append('class_id', String(classId))
    body.append('file', file)
    return api
      .post<StudentImportResult>('/students/import', body)
      .then((response) => response.data)
  },
}

type SessionQuery = {
  class_id?: number
  subject_id?: number
  date_from?: string
  date_to?: string
  finalized?: boolean
  page?: number
  page_size?: number
}

export const attendanceApi = {
  listSessions: (params: SessionQuery) =>
    api
      .get<Page<SessionListItem>>('/attendance/sessions', { params })
      .then((response) => response.data),
  getSession: (id: number) =>
    api.get<SessionDetail>(`/attendance/sessions/${id}`).then((response) => response.data),
  createSession: (payload: {
    class_id: number
    subject_id: number
    session_date: string
    session_number: number
    notes?: string | null
  }) =>
    api
      .post<SessionDetail>('/attendance/sessions', payload)
      .then((response) => response.data),
  saveRecords: (
    id: number,
    records: { student_id: number; status: string; remarks?: string | null }[],
  ) =>
    api
      .put<SessionDetail>(`/attendance/sessions/${id}/records`, { records })
      .then((response) => response.data),
  finalize: (id: number, isFinalized: boolean) =>
    api
      .patch<SessionDetail>(`/attendance/sessions/${id}/finalize`, {
        is_finalized: isFinalized,
      })
      .then((response) => response.data),
  summary: (params: {
    class_id: number
    subject_id?: number
    date_from?: string
    date_to?: string
  }) =>
    api
      .get<AttendanceSummary>('/attendance/reports/summary', { params })
      .then((response) => response.data),
  studentReport: (studentId: number) =>
    api
      .get<StudentReport>(`/attendance/reports/student/${studentId}`)
      .then((response) => response.data),
  myReport: () =>
    api
      .get<StudentReport>('/attendance/reports/student/me')
      .then((response) => response.data),
  history: (params: {
    class_id?: number
    subject_id?: number
    student_id?: number
    status?: string
    search?: string
    date_from?: string
    date_to?: string
    finalized_only?: boolean
    page?: number
    page_size?: number
  }) => api.get<HistoryPage>('/attendance/reports/history', { params }).then((r) => r.data),
  subjectReport: (params: { class_id?: number; date_from?: string; date_to?: string }) =>
    api
      .get<SubjectReportRow[]>('/attendance/reports/subject', { params })
      .then((response) => response.data),
  classReport: (params: { date_from?: string; date_to?: string }) =>
    api
      .get<ClassReportRow[]>('/attendance/reports/class', { params })
      .then((response) => response.data),
  exportSession: (id: number, format: 'csv' | 'xlsx') =>
    downloadFile(`/attendance/sessions/${id}/export`, { format }, `attendance-session-${id}.${format}`),
  exportReport: (
    params: Record<string, string | number | boolean | undefined>,
    format: 'csv' | 'xlsx',
    fallback: string,
  ) => downloadFile('/attendance/reports/export', { ...params, format }, fallback),
}

type CustomListQuery = {
  search?: string
  class_id?: number
  archived?: boolean
  page?: number
  page_size?: number
}

export interface CustomListPayload {
  title: string
  class_id: number
  description?: string | null
  status_options: StatusOption[]
  due_date?: string | null
  visible_to_students: boolean
  student_ids?: number[]
}

export const customListsApi = {
  list: (params: CustomListQuery) =>
    api
      .get<Page<CustomList>>('/custom-lists', { params })
      .then((response) => response.data),
  myLists: (params: { search?: string; page?: number; page_size?: number }) =>
    api
      .get<Page<StudentList>>('/custom-lists/me', { params })
      .then((response) => response.data),
  get: (id: number) =>
    api.get<CustomListDetail>(`/custom-lists/${id}`).then((response) => response.data),
  create: (payload: CustomListPayload) =>
    api.post<CustomListDetail>('/custom-lists', payload).then((response) => response.data),
  update: (
    id: number,
    payload: Partial<{
      title: string
      description: string | null
      status_options: StatusOption[]
      due_date: string | null
      visible_to_students: boolean
    }>,
  ) =>
    api.patch<CustomListDetail>(`/custom-lists/${id}`, payload).then((response) => response.data),
  archive: (id: number, isArchived: boolean) =>
    api
      .patch<CustomListDetail>(`/custom-lists/${id}/archive`, { is_archived: isArchived })
      .then((response) => response.data),
  summary: (id: number) =>
    api.get<EntrySummary>(`/custom-lists/${id}/summary`).then((response) => response.data),
  updateEntry: (
    id: number,
    entryId: number,
    payload: { status: string; remarks?: string | null },
  ) =>
    api
      .patch(`/custom-lists/${id}/entries/${entryId}`, payload)
      .then((response) => response.data),
  bulkUpdate: (
    id: number,
    payload: { entry_ids?: number[]; apply_to_all?: boolean; status: string; remarks?: string | null },
  ) =>
    api
      .patch<EntrySummary>(`/custom-lists/${id}/entries/bulk`, payload)
      .then((response) => response.data),
  addEntries: (id: number, studentIds: number[]) =>
    api
      .post<{ added: number; skipped: number; list: CustomListDetail }>(
        `/custom-lists/${id}/entries`,
        { student_ids: studentIds },
      )
      .then((response) => response.data),
  exportList: (id: number, format: 'csv' | 'xlsx') =>
    downloadFile(`/custom-lists/${id}/export`, { format }, `custom-list-${id}.${format}`),
}

export const dashboardApi = {
  get: (params: { class_id?: number; subject_id?: number; date?: string }) =>
    api.get<Dashboard>('/dashboard', { params }).then((response) => response.data),
}

export const settingsApi = {
  get: () => api.get<Settings>('/settings').then((response) => response.data),
  update: (payload: {
    attendance_threshold: number
    od_counts_as_attended: boolean
    leave_counts_as_attended: boolean
  }) => api.patch<Settings>('/settings', payload).then((response) => response.data),
}

export const usersApi = {
  list: (params: {
    role?: string
    search?: string
    is_active?: boolean
    page?: number
    page_size?: number
  }) => api.get<Page<User>>('/users', { params }).then((response) => response.data),
  create: (payload: {
    full_name: string
    email: string
    password: string
    role: string
    student_id?: number | null
  }) => api.post<User>('/users', payload).then((response) => response.data),
  update: (
    id: number,
    payload: Partial<{
      full_name: string
      email: string
      role: string
      is_active: boolean
      student_id: number | null
    }>,
  ) => api.patch<User>(`/users/${id}`, payload).then((response) => response.data),
  resetPassword: (id: number, newPassword: string) =>
    api.post(`/users/${id}/reset-password`, { new_password: newPassword }).then((r) => r.data),
}

export const adminApi = {
  faculty: () =>
    api.get<FacultyWithAssignments[]>('/admin/faculty').then((response) => response.data),
  setFacultyClasses: (facultyId: number, classIds: number[]) =>
    api
      .put<FacultyWithAssignments>(`/admin/faculty/${facultyId}/classes`, {
        class_ids: classIds,
      })
      .then((response) => response.data),
}

export const auditApi = {
  list: (params: {
    entity_type?: string
    entity_id?: number
    action?: string
    search?: string
    page?: number
    page_size?: number
  }) => api.get<Page<AuditLog>>('/audit-logs', { params }).then((response) => response.data),
}
