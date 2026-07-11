import { cookies } from 'next/headers'
import Link from 'next/link'
import { authCookies } from '@/lib/config/site'
import {
  LayoutDashboard, Users, CalendarDays, BookOpen, UserCog,
  Megaphone, Trophy, Film, Settings, Power, ClipboardList, Palette,
} from 'lucide-react'

const NAV_LINKS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/members', label: 'Members', icon: Users },
  { href: '/admin/activities', label: 'Activities', icon: CalendarDays },
  { href: '/admin/publications', label: 'Publications', icon: BookOpen },
  { href: '/admin/executives', label: 'Executives', icon: UserCog },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/admin/olympiads', label: 'Olympiads', icon: Trophy },
  { href: '/admin/surveys', label: 'Surveys', icon: ClipboardList },
  { href: '/admin/science-media', label: 'Science Media', icon: Film },
  { href: '/admin/homepage-settings', label: 'Homepage Settings', icon: Settings },
  { href: '/admin/appearance', label: 'Appearance', icon: Palette },
]

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies()
  const session = cookieStore.get(authCookies.admin)

  // This layout wraps every /admin/* route, including /admin/login. Without
  // a session we skip the sidebar chrome entirely and just render the page
  // (the login page handles its own layout).
  if (!session) return <>{children}</>

  return (
    <div className="min-h-screen flex" style={{ background: 'var(--bg3)' }}>
      <aside
        className="w-60 min-h-screen fixed top-0 left-0 flex flex-col"
        style={{ background: 'var(--bg2)', borderRight: '1px solid var(--border)' }}
      >
        <div className="p-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-bold text-base" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }}>
            NDSC Admin
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Management Panel</p>
        </div>

        <nav className="flex-1 p-3 space-y-1">
          {NAV_LINKS.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors hover:text-white"
              style={{ color: 'var(--muted)' }}
            >
              <link.icon size={17} />
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        <div className="p-4" style={{ borderTop: '1px solid var(--border)' }}>
          <a
            href="/api/admin/logout"
            className="flex items-center gap-2 text-xs transition-colors hover:text-red-400"
            style={{ color: 'var(--muted)' }}
          >
            <Power size={15} /> Logout
          </a>
        </div>
      </aside>

      <main className="ml-60 flex-1 p-8 min-h-screen" style={{ color: 'var(--white)' }}>
        {children}
      </main>
    </div>
  )
}
