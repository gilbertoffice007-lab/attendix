import { lazy, Suspense, useEffect, type ComponentType } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { RequireAuth, RequireRole } from '@/components/layout/RouteGuards'
import { LoadingScreen } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { AppLayout } from '@/layouts/AppLayout'
import { homeForRole } from '@/lib/utils'

function lazyPage<T extends Record<string, ComponentType<never>>>(
  loader: () => Promise<T>,
  exportName: keyof T,
) {
  return lazy(async () => {
    const module = await loader()
    return { default: module[exportName] as unknown as ComponentType }
  })
}

const LoginPage = lazyPage(() => import('@/pages/auth/LoginPage'), 'LoginPage')
const RegisterPage = lazyPage(() => import('@/pages/auth/RegisterPage'), 'RegisterPage')
const StudentLoginPage = lazyPage(
  () => import('@/pages/auth/PortalLoginPages'),
  'StudentLoginPage',
)
const FacultyLoginPage = lazyPage(
  () => import('@/pages/auth/PortalLoginPages'),
  'FacultyLoginPage',
)
const StudentRegisterPage = lazyPage(
  () => import('@/pages/auth/StudentRegisterPage'),
  'StudentRegisterPage',
)
const SetupPage = lazyPage(() => import('@/pages/auth/SetupPage'), 'SetupPage')
const NotFoundPage = lazyPage(() => import('@/pages/NotFoundPage'), 'NotFoundPage')

const DashboardPage = lazyPage(() => import('@/pages/staff/DashboardPage'), 'DashboardPage')
const StudentsPage = lazyPage(() => import('@/pages/staff/StudentsPage'), 'StudentsPage')
const AttendanceListPage = lazyPage(
  () => import('@/pages/staff/AttendanceListPage'),
  'AttendanceListPage',
)
const NewAttendancePage = lazyPage(
  () => import('@/pages/staff/NewAttendancePage'),
  'NewAttendancePage',
)
const AttendanceSessionPage = lazyPage(
  () => import('@/pages/staff/AttendanceSessionPage'),
  'AttendanceSessionPage',
)
const CustomListsPage = lazyPage(
  () => import('@/pages/staff/CustomListsPage'),
  'CustomListsPage',
)
const CustomListCreatePage = lazyPage(
  () => import('@/pages/staff/CustomListCreatePage'),
  'CustomListCreatePage',
)
const CustomListDetailPage = lazyPage(
  () => import('@/pages/staff/CustomListDetailPage'),
  'CustomListDetailPage',
)
const ReportsPage = lazyPage(() => import('@/pages/staff/ReportsPage'), 'ReportsPage')
const SettingsPage = lazyPage(() => import('@/pages/staff/SettingsPage'), 'SettingsPage')

const ClassesPage = lazyPage(() => import('@/pages/admin/ClassesPage'), 'ClassesPage')
const AssignmentsPage = lazyPage(
  () => import('@/pages/admin/AssignmentsPage'),
  'AssignmentsPage',
)
const UsersPage = lazyPage(() => import('@/pages/admin/UsersPage'), 'UsersPage')
const AuditPage = lazyPage(() => import('@/pages/admin/AuditPage'), 'AuditPage')

const StudentDashboardPage = lazyPage(
  () => import('@/pages/student/DashboardPage'),
  'StudentDashboardPage',
)
const StudentAttendancePage = lazyPage(
  () => import('@/pages/student/AttendancePage'),
  'StudentAttendancePage',
)
const StudentListsPage = lazyPage(
  () => import('@/pages/student/ListsPage'),
  'StudentListsPage',
)
const StudentProfilePage = lazyPage(
  () => import('@/pages/student/ProfilePage'),
  'StudentProfilePage',
)

function RootRedirect() {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingScreen />
      </div>
    )
  }
  return <Navigate to={user ? homeForRole(user.role) : '/login'} replace />
}

function ScrollToTop() {
  const { pathname } = useLocation()
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior })
  }, [pathname])
  return null
}

export default function App() {
  return (
    <>
      <ScrollToTop />
      <Suspense
        fallback={
          <div className="flex min-h-dvh items-center justify-center">
            <LoadingScreen />
          </div>
        }
      >
        <Routes>
          <Route path="/" element={<RootRedirect />} />
          <Route
            path="/login"
            element={
              <PublicOnlyRoute>
                <LoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/setup"
            element={
              <PublicOnlyRoute>
                <SetupPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/faculty/login"
            element={
              <PublicOnlyRoute>
                <FacultyLoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/faculty/register"
            element={
              <PublicOnlyRoute>
                <RegisterPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/student/login"
            element={
              <PublicOnlyRoute>
                <StudentLoginPage />
              </PublicOnlyRoute>
            }
          />
          <Route
            path="/student/register"
            element={
              <PublicOnlyRoute>
                <StudentRegisterPage />
              </PublicOnlyRoute>
            }
          />

          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              <Route path="/admin" element={<RequireRole allow={['admin']} />}>
                <Route index element={<DashboardPage />} />
                <Route path="students" element={<StudentsPage />} />
                <Route path="attendance" element={<AttendanceListPage />} />
                <Route path="attendance/new" element={<NewAttendancePage />} />
                <Route path="attendance/:sessionId" element={<AttendanceSessionPage />} />
                <Route path="custom-lists" element={<CustomListsPage />} />
                <Route path="custom-lists/new" element={<CustomListCreatePage />} />
                <Route path="custom-lists/:listId" element={<CustomListDetailPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="settings" element={<SettingsPage />} />
                <Route path="classes" element={<ClassesPage />} />
                <Route path="faculty" element={<AssignmentsPage />} />
                <Route path="users" element={<UsersPage />} />
                <Route path="audit" element={<AuditPage />} />
              </Route>

              <Route path="/faculty" element={<RequireRole allow={['faculty', 'admin']} />}>
                <Route index element={<DashboardPage />} />
                <Route path="students" element={<StudentsPage />} />
                <Route path="attendance" element={<AttendanceListPage />} />
                <Route path="attendance/new" element={<NewAttendancePage />} />
                <Route path="attendance/:sessionId" element={<AttendanceSessionPage />} />
                <Route path="custom-lists" element={<CustomListsPage />} />
                <Route path="custom-lists/new" element={<CustomListCreatePage />} />
                <Route path="custom-lists/:listId" element={<CustomListDetailPage />} />
                <Route path="reports" element={<ReportsPage />} />
                <Route path="settings" element={<SettingsPage />} />
              </Route>

              <Route path="/student" element={<RequireRole allow={['student']} />}>
                <Route index element={<StudentDashboardPage />} />
                <Route path="attendance" element={<StudentAttendancePage />} />
                <Route path="lists" element={<StudentListsPage />} />
                <Route path="profile" element={<StudentProfilePage />} />
              </Route>
            </Route>
          </Route>

          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </Suspense>
    </>
  )
}

function PublicOnlyRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingScreen label="Restoring your session…" />
      </div>
    )
  }
  if (user) return <Navigate to={homeForRole(user.role)} replace />
  return <>{children}</>
}
