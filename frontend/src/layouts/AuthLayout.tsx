import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, CalendarCheck2, ShieldCheck, Sparkles } from 'lucide-react'
import { Logo } from '@/components/brand/Logo'

export function AuthLayout({
  children,
  title,
  subtitle,
}: {
  children: ReactNode
  title: string
  subtitle: string
}) {
  return (
    <div className="min-h-dvh bg-white dark:bg-ink-950 lg:grid lg:grid-cols-[1.05fr_1fr]">
      <aside className="relative hidden overflow-hidden bg-brand-950 p-10 lg:flex lg:flex-col lg:justify-between xl:p-14">
        <div className="app-grid-bg absolute inset-0 opacity-40" aria-hidden />
        <div
          className="absolute -left-24 top-16 h-80 w-80 rounded-full bg-brand-600/30 blur-3xl"
          aria-hidden
        />
        <div
          className="absolute -bottom-32 right-0 h-96 w-96 rounded-full bg-violet-600/20 blur-3xl"
          aria-hidden
        />
        <div className="relative">
          <Logo light />
        </div>

        <div className="relative max-w-lg">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-brand-100">
            <Sparkles className="h-3.5 w-3.5" /> Built for modern campuses
          </span>
          <h1 className="mt-6 text-4xl font-semibold leading-[1.1] tracking-tight text-white xl:text-5xl">
            Attendance that takes seconds, not sessions.
          </h1>
          <p className="mt-5 max-w-md text-[15px] leading-7 text-brand-100/80">
            Mark registers, spot low attendance early, and keep every class list in one
            calm, secure workspace.
          </p>

          <div className="mt-10 space-y-3">
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-emerald-400/15 text-emerald-300">
                <CalendarCheck2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Live attendance registers</p>
                <p className="text-xs text-brand-100/70">
                  Present, absent, OD and leave recorded in one pass
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] p-4 backdrop-blur-sm">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-400/15 text-brand-200">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-sm font-semibold text-white">Role-aware by design</p>
                <p className="text-xs text-brand-100/70">
                  Faculty, administrators and students see only their own data
                </p>
              </div>
            </div>
          </div>
        </div>

        <p className="relative text-xs text-brand-200/50">
          © {new Date().getFullYear()} Attendix · Secure academic records
        </p>
      </aside>

      <main className="flex min-h-dvh flex-col px-5 py-6 sm:px-8 lg:px-12">
        <div className="flex items-center justify-between lg:hidden">
          <Logo />
          <Link
            to="/login"
            className="inline-flex items-center gap-1 text-xs font-medium text-ink-500 hover:text-ink-800 dark:text-ink-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-3.5 w-3.5" /> Sign in
          </Link>
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-md">
            <div className="mb-8">
              <h2 className="text-2xl font-semibold tracking-tight text-ink-900 dark:text-white">
                {title}
              </h2>
              <p className="mt-2 text-sm leading-6 text-ink-500 dark:text-ink-400">{subtitle}</p>
            </div>
            {children}
          </div>
        </div>
        <p className="text-center text-[11px] text-ink-400 lg:hidden">
          © {new Date().getFullYear()} Attendix
        </p>
      </main>
    </div>
  )
}
