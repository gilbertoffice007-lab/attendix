import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom'
import {
  ChevronDown,
  LogOut,
  Menu as MenuIcon,
  Moon,
  MoreHorizontal,
  Settings,
  Sun,
  UserRound,
  X,
} from 'lucide-react'
import { Logo } from '@/components/brand/Logo'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { navigationFor, pageTitleFor, roleIcon } from '@/config/navigation'
import { useAuth } from '@/contexts/AuthContext'
import { useTheme } from '@/contexts/ThemeContext'
import { cn, roleLabels } from '@/lib/utils'
import type { Role } from '@/types'

function SidebarNav({ role, onNavigate }: { role: Role; onNavigate?: () => void }) {
  const sections = navigationFor(role)
  return (
    <nav className="flex-1 space-y-6 overflow-y-auto px-3 py-4" aria-label="Main navigation">
      {sections.map((section, index) => (
        <div key={section.label ?? index}>
          {section.label ? (
            <p className="px-3 pb-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-400 dark:text-ink-500">
              {section.label}
            </p>
          ) : null}
          <div className="space-y-0.5">
            {section.items.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                onClick={onNavigate}
                className={({ isActive }) =>
                  cn(
                    'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] font-medium transition-colors',
                    isActive
                      ? 'bg-brand-50 text-brand-700 dark:bg-brand-500/10 dark:text-brand-300'
                      : 'text-ink-600 hover:bg-ink-100/70 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800/70 dark:hover:text-white',
                  )
                }
              >
                {({ isActive }) => (
                  <>
                    <item.icon
                      className={cn(
                        'h-[18px] w-[18px] shrink-0',
                        isActive ? 'text-brand-600 dark:text-brand-400' : 'text-ink-400',
                      )}
                    />
                    <span className="truncate">{item.label}</span>
                    {isActive ? (
                      <span className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-brand-600 dark:bg-brand-400" />
                    ) : null}
                  </>
                )}
              </NavLink>
            ))}
          </div>
        </div>
      ))}
    </nav>
  )
}

function SidebarContent({ onNavigate }: { onNavigate?: () => void }) {
  const { user, logout } = useAuth()
  if (!user) return null
  const RoleIcon = roleIcon[user.role]
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-16 shrink-0 items-center border-b border-ink-100 px-5 dark:border-ink-800">
        <Logo />
      </div>
      <div className="px-5 pt-4">
        <div className="flex items-center gap-2 rounded-xl border border-ink-100 bg-ink-50/70 px-3 py-2 dark:border-ink-800 dark:bg-ink-800/40">
          <RoleIcon className="h-3.5 w-3.5 text-brand-600 dark:text-brand-400" />
          <span className="text-xs font-semibold text-ink-700 dark:text-ink-200">
            {roleLabels[user.role]}
          </span>
          <Badge tone="success" className="ml-auto py-0 text-[9px]">
            Active
          </Badge>
        </div>
      </div>
      <SidebarNav role={user.role} onNavigate={onNavigate} />
      <div className="border-t border-ink-100 p-3 dark:border-ink-800">
        <div className="flex items-center gap-2.5 rounded-xl p-2">
          <Avatar name={user.full_name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-ink-900 dark:text-white">
              {user.full_name}
            </p>
            <p className="truncate text-[11px] text-ink-500 dark:text-ink-400">{user.email}</p>
          </div>
          <button
            type="button"
            onClick={() => void logout()}
            className="rounded-lg p-1.5 text-ink-400 transition hover:bg-rose-50 hover:text-rose-600 dark:hover:bg-rose-500/10"
            title="Sign out"
            aria-label="Sign out"
          >
            <LogOut className="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>
  )
}

function UserMenu() {
  const { user, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  useEffect(() => {
    if (!open) return
    const handleClick = (event: MouseEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setOpen(false)
    }
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClick)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClick)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  if (!user) return null
  const profilePath = user.role === 'student' ? '/student/profile' : `/${user.role}/settings`

  return (
    <div className="relative" ref={menuRef}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        className="flex items-center gap-2 rounded-xl p-1 pr-1.5 transition hover:bg-ink-100 dark:hover:bg-ink-800"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar name={user.full_name} />
        <span className="hidden text-left md:block">
          <span className="block max-w-[140px] truncate text-[12px] font-semibold text-ink-800 dark:text-ink-100">
            {user.full_name}
          </span>
          <span className="block text-[10px] text-ink-500 dark:text-ink-400">
            {roleLabels[user.role]}
          </span>
        </span>
        <ChevronDown className="hidden h-3.5 w-3.5 text-ink-400 md:block" />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-40 mt-2 w-60 overflow-hidden rounded-xl border border-ink-200 bg-white shadow-card-hover animate-slide-up dark:border-ink-700 dark:bg-ink-900"
        >
          <div className="border-b border-ink-100 px-4 py-3 dark:border-ink-800">
            <p className="truncate text-sm font-semibold text-ink-900 dark:text-white">
              {user.full_name}
            </p>
            <p className="truncate text-xs text-ink-500 dark:text-ink-400">{user.email}</p>
          </div>
          <div className="p-1.5">
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                navigate(profilePath)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-ink-600 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              <UserRound className="h-4 w-4 text-ink-400" /> Profile & settings
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={() => {
                setOpen(false)
                navigate(profilePath)
              }}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-ink-600 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              <Settings className="h-4 w-4 text-ink-400" /> Preferences
            </button>
            <button
              type="button"
              role="menuitem"
              onClick={toggleTheme}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-medium text-ink-600 transition hover:bg-ink-100 dark:text-ink-300 dark:hover:bg-ink-800"
            >
              {theme === 'dark' ? (
                <Sun className="h-4 w-4 text-ink-400" />
              ) : (
                <Moon className="h-4 w-4 text-ink-400" />
              )}
              {theme === 'dark' ? 'Light mode' : 'Dark mode'}
            </button>
          </div>
          <div className="border-t border-ink-100 p-1.5 dark:border-ink-800">
            <button
              type="button"
              role="menuitem"
              onClick={() => void logout()}
              className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold text-rose-600 transition hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-500/10"
            >
              <LogOut className="h-4 w-4" /> Sign out
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Topbar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const title = user ? pageTitleFor(location.pathname, user.role) : 'Attendix'
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-ink-200/70 bg-white/85 px-4 backdrop-blur-md sm:px-6 lg:px-8 dark:border-ink-800 dark:bg-ink-950/85">
      <button
        type="button"
        onClick={onOpenMenu}
        className="rounded-lg p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 lg:hidden dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-white"
        aria-label="Open navigation menu"
      >
        <MenuIcon className="h-5 w-5" />
      </button>
      <p className="min-w-0 flex-1 truncate text-sm font-semibold text-ink-900 lg:text-[15px] dark:text-white">
        {title}
      </p>
      <button
        type="button"
        onClick={toggleTheme}
        className="rounded-lg p-2 text-ink-500 transition hover:bg-ink-100 hover:text-ink-900 dark:text-ink-400 dark:hover:bg-ink-800 dark:hover:text-white"
        aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}
      >
        {theme === 'dark' ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
      </button>
      <UserMenu />
    </header>
  )
}

function BottomNav({ onMore }: { onMore: () => void }) {
  const { user } = useAuth()
  const location = useLocation()
  if (!user) return null
  const items = navigationFor(user.role)
    .flatMap((section) => section.items)
    .filter((item) => item.primary)
    .slice(0, 4)
  return (
    <nav
      className="fixed inset-x-0 bottom-0 z-30 border-t border-ink-200/80 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden dark:border-ink-800 dark:bg-ink-950/95"
      aria-label="Quick navigation"
    >
      <div className="flex h-16 items-stretch">
        {items.map((item) => {
          const active = item.end
            ? location.pathname === item.to
            : location.pathname.startsWith(item.to)
          return (
            <Link
              key={item.to}
              to={item.to}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold transition',
                active
                  ? 'text-brand-600 dark:text-brand-400'
                  : 'text-ink-400 hover:text-ink-700 dark:hover:text-ink-200',
              )}
            >
              <item.icon className={cn('h-5 w-5', active && 'text-brand-600 dark:text-brand-400')} />
              <span className="max-w-full truncate px-1">{item.label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={onMore}
          className="flex flex-1 flex-col items-center justify-center gap-1 text-[10px] font-semibold text-ink-400 transition hover:text-ink-700 dark:hover:text-ink-200"
        >
          <MoreHorizontal className="h-5 w-5" />
          More
        </button>
      </div>
    </nav>
  )
}

export function AppLayout() {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const location = useLocation()

  useEffect(() => {
    setDrawerOpen(false)
  }, [location.pathname])

  useEffect(() => {
    if (!drawerOpen) return
    const original = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setDrawerOpen(false)
    }
    document.addEventListener('keydown', handleKey)
    return () => {
      document.body.style.overflow = original
      document.removeEventListener('keydown', handleKey)
    }
  }, [drawerOpen])

  return (
    <div className="min-h-dvh">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-50 focus:rounded-lg focus:bg-brand-600 focus:px-4 focus:py-2 focus:text-white"
      >
        Skip to content
      </a>
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] border-r border-ink-200/80 bg-white lg:block dark:border-ink-800 dark:bg-ink-950">
        <SidebarContent />
      </aside>

      {drawerOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 animate-fade-in bg-ink-950/50 backdrop-blur-[2px]"
            onClick={() => setDrawerOpen(false)}
            aria-hidden
          />
          <div
            className="relative flex h-full w-[290px] max-w-[85vw] flex-col border-r border-ink-200 bg-white shadow-2xl animate-slide-up dark:border-ink-800 dark:bg-ink-950"
            role="dialog"
            aria-modal="true"
            aria-label="Navigation"
          >
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="absolute right-3 top-4 z-10 rounded-lg p-2 text-ink-400 hover:bg-ink-100 dark:hover:bg-ink-800"
              aria-label="Close navigation"
            >
              <X className="h-4 w-4" />
            </button>
            <SidebarContent onNavigate={() => setDrawerOpen(false)} />
          </div>
        </div>
      ) : null}

      <div className="lg:pl-[264px]">
        <Topbar onOpenMenu={() => setDrawerOpen(true)} />
        <main
          id="main-content"
          className="mx-auto w-full max-w-[1500px] px-4 pb-24 pt-6 sm:px-6 lg:px-8 lg:pb-10"
        >
          <Outlet />
        </main>
      </div>
      <BottomNav onMore={() => setDrawerOpen(true)} />
    </div>
  )
}
