export type Role = 'admin' | 'faculty' | 'student'
export type AttendanceStatus = 'present' | 'absent' | 'od' | 'leave'
export type StatusColor =
  | 'blue'
  | 'green'
  | 'red'
  | 'amber'
  | 'slate'
  | 'violet'
  | 'teal'
  | 'rose'

export interface Page<T> {
  items: T[]
  total: number
  page: number
  page_size: number
}

export interface StudentProfile {
  id: number
  roll_number: string
  full_name: string
  class_id: number
  class_name: string
  department: string
  semester: number
  academic_year: string
  is_active: boolean
}

export interface CurrentUser {
  id: number
  full_name: string
  email: string
  role: Role
  is_active: boolean
  created_at: string
  student: StudentProfile | null
}

export interface SetupStatus {
  setup_required: boolean
  registration_enabled: boolean
}

export interface PublicClass {
  id: number
  name: string
  department: string
  semester: number
  academic_year: string
}

export interface StudentRegistrationOptions {
  enabled: boolean
  classes: PublicClass[]
}

export interface User {
  id: number
  full_name: string
  email: string
  role: Role
  is_active: boolean
  student_id: number | null
  created_at: string
  updated_at: string
}

export interface FacultyWithAssignments extends User {
  class_ids: number[]
  class_labels: string[]
}

export interface ClassRoom {
  id: number
  name: string
  department: string
  semester: number
  academic_year: string
  student_count: number
  subject_count: number
  created_at: string
}

export interface ClassFaculty {
  id: number
  full_name: string
  email: string
  is_active: boolean
}

export interface Subject {
  id: number
  name: string
  subject_code: string
  class_id: number
  class_name: string
  faculty_id: number | null
  faculty_name: string | null
  session_count: number
}

export interface Student {
  id: number
  roll_number: string
  full_name: string
  class_id: number
  class_name: string
  department: string
  semester: number
  academic_year: string
  is_active: boolean
  has_account: boolean
  account_email: string | null
  created_at: string
}

export interface StudentImportResult {
  created: number
  skipped: number
  errors: { row: number; message: string }[]
}

export interface SessionCounts {
  total: number
  present: number
  absent: number
  od: number
  leave: number
  unmarked: number
}

export interface SessionEntry {
  student_id: number
  roll_number: string
  student_name: string
  is_active: boolean
  record_id: number | null
  status: AttendanceStatus | null
  remarks: string | null
  updated_at: string | null
  updated_by_name: string | null
}

export interface SessionListItem {
  id: number
  class_id: number
  class_name: string
  subject_id: number
  subject_name: string
  subject_code: string
  session_date: string
  session_number: number
  is_finalized: boolean
  counts: SessionCounts
  created_by_name: string
  created_at: string
}

export interface SessionDetail extends SessionListItem {
  notes: string | null
  finalized_at: string | null
  finalized_by_name: string | null
  entries: SessionEntry[]
}

export interface StudentSummaryRow {
  student_id: number
  roll_number: string
  full_name: string
  class_id: number
  class_name: string
  present: number
  absent: number
  od: number
  leave: number
  attended: number
  eligible: number
  absences: number
  percentage: number
  below_threshold: boolean
}

export interface AttendanceSummary {
  class_id: number
  class_name: string
  subject_id: number | null
  subject_name: string | null
  date_from: string | null
  date_to: string | null
  threshold: number
  od_counts_as_attended: boolean
  leave_counts_as_attended: boolean
  total_students: number
  finalized_sessions: number
  average_percentage: number
  low_attendance_count: number
  students: StudentSummaryRow[]
}

export interface StudentSubjectRow {
  subject_id: number
  subject_name: string
  subject_code: string
  attended: number
  eligible: number
  percentage: number
}

export interface StudentHistoryRow {
  session_id: number
  session_date: string
  session_number: number
  subject_id: number
  subject_name: string
  class_name: string
  status: AttendanceStatus
  remarks: string | null
  is_finalized?: boolean
}

export interface StudentReport {
  student_id: number
  roll_number: string
  full_name: string
  class_id: number
  class_name: string
  threshold: number
  attended: number
  eligible: number
  absences: number
  present: number
  od: number
  leave: number
  percentage: number
  below_threshold: boolean
  subjects: StudentSubjectRow[]
  history: StudentHistoryRow[]
}

export interface HistoryRow {
  session_id: number
  session_date: string
  session_number: number
  subject_id: number
  subject_name: string
  class_id: number
  class_name: string
  student_id: number
  roll_number: string
  student_name: string
  status: AttendanceStatus
  remarks: string | null
  is_finalized: boolean
}

export interface HistoryPage {
  items: HistoryRow[]
  total: number
  page: number
  page_size: number
}

export interface SubjectReportRow {
  subject_id: number
  subject_name: string
  subject_code: string
  class_id: number
  class_name: string
  finalized_sessions: number
  present: number
  absent: number
  od: number
  leave: number
  average_percentage: number
}

export interface ClassReportRow {
  class_id: number
  class_name: string
  department: string
  semester: number
  academic_year: string
  student_count: number
  finalized_sessions: number
  average_percentage: number
  below_threshold_count: number
}

export interface StatusOption {
  key: string
  label: string
  color: StatusColor
}

export interface CustomList {
  id: number
  title: string
  description: string | null
  class_id: number
  class_name: string
  department: string
  semester: number
  created_by: number
  creator_name: string
  status_options: StatusOption[]
  due_date: string | null
  is_archived: boolean
  visible_to_students: boolean
  entry_count: number
  created_at: string
  updated_at: string
}

export interface CustomListEntry {
  id: number
  student_id: number
  roll_number: string
  student_name: string
  student_active: boolean
  status: string
  remarks: string | null
  updated_at: string
  updated_by_name: string | null
}

export interface CustomListDetail extends CustomList {
  entries: CustomListEntry[]
}

export interface EntrySummary {
  total: number
  counts: Record<string, number>
  percentages: Record<string, number>
}

export interface StudentList {
  id: number
  title: string
  description: string | null
  class_name: string
  due_date: string | null
  status_options: StatusOption[]
  my_status: string
  my_remarks: string | null
  updated_at: string
  creator_name: string
}

export interface DashboardSession {
  id: number
  class_id: number
  class_name: string
  subject_name: string
  session_date: string
  session_number: number
  present: number
  absent: number
  od: number
  leave: number
  unmarked: number
  total: number
  is_finalized: boolean
}

export interface DashboardList {
  id: number
  title: string
  class_name: string
  entry_count: number
  created_at: string
  creator_name: string
}

export interface TrendPoint {
  label: string
  date: string
  session_id: number
  percentage: number
  present: number
  total: number
}

export interface LowAttendanceStudent {
  student_id: number
  roll_number: string
  full_name: string
  class_name: string
  percentage: number
  absent: number
  eligible: number
}

export interface Dashboard {
  role: string
  scope_label: string
  total_students: number
  total_classes: number
  total_subjects: number
  session_count: number
  finalized_session_count: number
  today_sessions: DashboardSession[]
  present_today: number
  absent_today: number
  average_percentage: number
  threshold: number
  low_attendance_count: number
  low_attendance: LowAttendanceStudent[]
  recent_lists: DashboardList[]
  trend: TrendPoint[]
  faculty_count: number | null
  user_count: number | null
  od_counts_as_attended: boolean
  leave_counts_as_attended: boolean
}

export interface Settings {
  attendance_threshold: number
  od_counts_as_attended: boolean
  leave_counts_as_attended: boolean
  updated_at: string
}

export interface AuditLog {
  id: number
  actor_user_id: number | null
  actor_name: string | null
  entity_type: string
  entity_id: number
  action: string
  previous_value: Record<string, unknown> | null
  new_value: Record<string, unknown> | null
  created_at: string
}
