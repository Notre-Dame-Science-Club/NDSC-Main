'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import {
  LayoutDashboard, Users, CalendarDays, BookOpen, UserCog,
  Megaphone, Trophy, Film, Settings, Power, ClipboardList, Palette, Workflow, Menu, X,
} from 'lucide-react'

const NAV_LINKS = [
  { href: '/admin', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/admin/members', label: 'Members', icon: Users },
  { href: '/admin/activities', label: 'Activities', icon: CalendarDays },
  { href: '/admin/publications', label: 'Publications', icon: BookOpen },
  { href: '/admin/executives', label: 'Executives', icon: UserCog },
  { href: '/admin/announcements', label: 'Announcements', icon: Megaphone },
  { href: '/admin/olympiads', label: 'Olympiads', icon: Trophy },
  { href: '/admin/form-builder', label: 'Form Builder', icon: Workflow },
  { href: '/admin/surveys', label: 'Surveys', icon: ClipboardList },
  { href: '/admin/science-media', label: 'Science Media', icon: Film },
  { href: '/admin/homepage-settings', label: 'Homepage Settings', icon: Settings },
  { href: '/admin/appearance', label: 'Appearance', icon: Palette },
]

// Responsive admin shell. On lg+ screens the fixed 240px sidebar sits on the
// left with the content offset by ml-60, exactly as before. Below lg the
// sidebar becomes a slide-in drawer opened from a sticky top bar, so the
// form-builder and every other admin page get the full viewport width on
// mobile instead of being squeezed into the sliver left over by a fixed rail.
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false)
  const pathname = usePathname()

  // Close the drawer whenever the route changes.
  useEffect(() => { setMobileOpen(false) }, [pathname])

  // Lock body scroll while the drawer is open.
  useEffect(() => {
    document.body.style.overflow = mobileOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [mobileOpen])

  return (
    <div className="min-h-screen lg:flex" style={{ background: 'var(--bg3)' }}>
      {/* Top bar — mobile only */}
      <div className="lg:hidden sticky top-0 z-40 flex items-center justify-between px-4"
        style={{ background: 'var(--bg2)', borderBottom: '1px solid var(--border)', height: 56 }}>
        <div className="min-w-0">
          <h2 className="font-bold text-sm leading-tight truncate" style={{ fontFamily: 'inherit', color: 'var(--blue)' }}>NDSC Admin</h2>
          <p className="text-[10px] leading-tight truncate" style={{ color: 'var(--muted)' }}>Management Panel</p>
        </div>
        <button
          onClick={() => setMobileOpen(true)}
          className="flex items-center justify-center w-10 h-10 rounded-lg border shrink-0"
          style={{ borderColor: 'var(--border)', color: 'var(--blue)' }}
          aria-label="Open admin menu">
          <Menu size={20} />
        </button>
      </div>

      {/* Sidebar — desktop only */}
      <aside
        className="hidden lg:flex w-60 min-h-screen fixed top-0 left-0 flex-col"
        style={{ background: 'var(--bg2)', borderRight: '1px solid var(--border)' }}
      >
        <div className="p-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
          <h2 className="font-bold text-base" style={{ fontFamily: 'inherit', color: 'var(--blue)' }}>
            NDSC Admin
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Management Panel</p>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_LINKS.map(link => {
            const active = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href + '/'))
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors hover:text-white"
                style={{ color: active ? 'var(--blue)' : 'var(--muted)', background: active ? 'rgba(var(--blue-rgb), 0.08)' : 'transparent' }}
              >
                <link.icon size={17} />
                <span>{link.label}</span>
              </Link>
            )
          })}
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

      {/* Backdrop — mobile only */}
      <div
        className={`lg:hidden fixed inset-0 z-50 transition-opacity ${mobileOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        style={{ background: 'rgba(0,0,0,0.55)' }}
        onClick={() => setMobileOpen(false)}
        aria-hidden="true"
      />

      {/* Drawer — mobile only */}
      <aside
        className={`lg:hidden fixed top-0 left-0 bottom-0 z-50 w-[82vw] max-w-[320px] flex flex-col transition-transform duration-300 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}`}
        style={{ background: 'var(--bg2)', borderRight: '1px solid var(--border)', boxShadow: '18px 0 50px rgba(0,0,0,0.5)' }}
        role="dialog"
        aria-modal="true"
        aria-label="Admin navigation"
      >
        <div className="flex items-center justify-between px-5 py-4 shrink-0" style={{ borderBottom: '1px solid var(--border)' }}>
          <div>
            <h2 className="font-bold text-base" style={{ fontFamily: 'inherit', color: 'var(--blue)' }}>NDSC Admin</h2>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Management Panel</p>
          </div>
          <button
            onClick={() => setMobileOpen(false)}
            className="flex items-center justify-center w-9 h-9 rounded-lg border shrink-0"
            style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}
            aria-label="Close admin menu">
            <X size={18} />
          </button>
        </div>

        <nav className="flex-1 p-3 space-y-1 overflow-y-auto">
          {NAV_LINKS.map(link => {
            const active = pathname === link.href || (link.href !== '/admin' && pathname.startsWith(link.href + '/'))
            return (
              <Link
                key={link.href}
                href={link.href}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors hover:text-white"
                style={{ color: active ? 'var(--blue)' : 'var(--muted)', background: active ? 'rgba(var(--blue-rgb), 0.08)' : 'transparent' }}
              >
                <link.icon size={17} />
                <span>{link.label}</span>
              </Link>
            )
          })}
        </nav>

        <div className="p-4 shrink-0" style={{ borderTop: '1px solid var(--border)' }}>
          <a
            href="/api/admin/logout"
            className="flex items-center gap-2 text-xs transition-colors hover:text-red-400"
            style={{ color: 'var(--muted)' }}
          >
            <Power size={15} /> Logout
          </a>
        </div>
      </aside>

      <main className="flex-1 lg:ml-60 p-4 sm:p-6 lg:p-8 min-h-screen" style={{ color: 'var(--white)' }}>
        {children}
      </main>
    </div>
  )
}
