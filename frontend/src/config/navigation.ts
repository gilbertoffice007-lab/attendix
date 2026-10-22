import {
  BarChart3,
  BookUser,
  Building2,
  CalendarCheck,
  ClipboardList,
  GraduationCap,
  LayoutDashboard,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  type LucideIcon,
} from 'lucide-react'
import type { Role } from '@/types'

export interface NavItem {
  label: string
  to: string
  icon: LucideIcon
  end?: boolean
  primary?: boolean
}

export interface NavSection {
  label?: string
  items: NavItem[]
}

export function staffBase(role: Role) {
  return role === 'admin' ? '/admin' : '/faculty'
}

export function navigationFor(role: Role): NavSection[] {
  if (role === 'student') {
    return [
      {
        items: [
          { label: 'Overview', to: '/student', icon: LayoutDashboard, end: true, primary: true },
          {
            label: 'My attendance',
            to: '/student/attendance',
            icon: CalendarCheck,
            primary: true,
          },
          { label: 'My lists', to: '/student/lists', icon: ClipboardList, primary: true },
          { label: 'Profile', to: '/student/profile', icon: BookUser, primary: true },
        ],
      },
    ]
  }

  const base = staffBase(role)
  const sections: NavSection[] = [
    {
      items: [
        {
          label: 'Dashboard',
          to: base,
          icon: LayoutDashboard,
          end: true,
          primary: true,
        },
        { label: 'Students', to: `${base}/students`, icon: Users, primary: true },
        {
          label: 'Attendance',
          to: `${base}/attendance`,
          icon: CalendarCheck,
          primary: true,
        },
        {
          label: 'Custom lists',
          to: `${base}/custom-lists`,
          icon: ClipboardList,
          primary: true,
        },
      ],
    },
    {
      label: 'Insights',
      items: [
        { label: 'Reports', to: `${base}/reports`, icon: BarChart3 },
        { label: 'Settings', to: `${base}/settings`, icon: Settings },
      ],
    },
  ]

  if (role === 'admin') {
    sections.push({
      label: 'Administration',
      items: [
        { label: 'Classes', to: `${base}/classes`, icon: Building2 },
        { label: 'Faculty', to: `${base}/faculty`, icon: GraduationCap },
        { label: 'Users', to: `${base}/users`, icon: UserCog },
        { label: 'Audit log', to: `${base}/audit`, icon: ScrollText },
      ],
    })
  }

  return sections
}

export function pageTitleFor(pathname: string, role: Role) {
  const all = navigationFor(role)
    .flatMap((section) => section.items)
    .sort((a, b) => b.to.length - a.to.length)
  const match = all.find((item) =>
    item.end ? pathname === item.to : pathname.startsWith(item.to),
  )
  if (match) return match.label
  if (pathname.includes('/attendance/new')) return 'New session'
  if (pathname.includes('/attendance/')) return 'Attendance register'
  if (pathname.includes('/custom-lists/new')) return 'New list'
  if (pathname.includes('/custom-lists/')) return 'List detail'
  return 'Attendix'
}

export const roleIcon: Record<Role, LucideIcon> = {
  admin: ShieldCheck,
  faculty: GraduationCap,
  student: BookUser,
}
