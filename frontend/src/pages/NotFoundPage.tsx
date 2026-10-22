import { Link, useNavigate } from 'react-router-dom'
import { ArrowLeft, Compass, Home } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Button } from '@/components/ui/Button'
import { useAuth } from '@/contexts/AuthContext'
import { homeForRole } from '@/lib/utils'

export function NotFoundPage() {
  const { user } = useAuth()
  const navigate = useNavigate()
  const home = user ? homeForRole(user.role) : '/login'

  return (
    <div className="relative flex min-h-dvh flex-col bg-white dark:bg-ink-950">
      <div className="app-grid-bg pointer-events-none absolute inset-0 opacity-40" aria-hidden />
      <div
        className="pointer-events-none absolute left-1/2 top-1/4 h-80 w-80 -translate-x-1/2 rounded-full bg-brand-500/10 blur-3xl"
        aria-hidden
      />
      <header className="relative z-10 flex h-16 items-center px-5 sm:px-8">
        <Logo />
      </header>
      <main className="relative z-10 flex flex-1 items-center justify-center px-5 py-16">
        <div className="w-full max-w-md text-center">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl border border-ink-200 bg-white text-brand-600 shadow-card dark:border-ink-800 dark:bg-ink-900 dark:text-brand-400">
            <Compass className="h-7 w-7" />
          </div>
          <p className="mt-6 text-6xl font-semibold tracking-tight text-ink-900 dark:text-white">
            404
          </p>
          <h1 className="mt-2 text-lg font-semibold text-ink-900 dark:text-white">
            This page took an unscheduled leave
          </h1>
          <p className="mt-2 text-sm leading-6 text-ink-500 dark:text-ink-400">
            The page you are looking for does not exist, was moved, or you may not have access to
            it.
          </p>
          <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
            <Button onClick={() => navigate(-1)} variant="secondary">
              <ArrowLeft className="h-4 w-4" /> Go back
            </Button>
            <Link to={home}>
              <Button className="w-full">
                <Home className="h-4 w-4" /> Back to {user ? 'dashboard' : 'sign in'}
              </Button>
            </Link>
          </div>
          <p className="mt-8 text-[11px] text-ink-400">
            Need help? Contact your campus administrator.
          </p>
        </div>
      </main>
    </div>
  )
}
