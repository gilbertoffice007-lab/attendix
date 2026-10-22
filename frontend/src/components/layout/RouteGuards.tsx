import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { LoadingScreen } from '@/components/ui/Feedback'
import { useAuth } from '@/contexts/AuthContext'
import { homeForRole } from '@/lib/utils'
import type { Role } from '@/types'

export function RequireAuth() {
  const { user, loading } = useAuth()
  const location = useLocation()
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingScreen />
      </div>
    )
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  return <Outlet />
}

export function RequireRole({ allow }: { allow: Role[] }) {
  const { user, loading } = useAuth()
  if (loading) {
    return (
      <div className="flex min-h-dvh items-center justify-center">
        <LoadingScreen />
      </div>
    )
  }
  if (!user) return <Navigate to="/login" replace />
  if (!allow.includes(user.role)) {
    return <Navigate to={homeForRole(user.role)} replace />
  }
  return <Outlet />
}

export function PublicOnly({ children }: { children: React.ReactNode }) {
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
