import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import Link from 'next/link'

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')

  // Get current path - login page should not be protected
  // We check by seeing if session exists, login page handles itself
  // Layout applies to all /admin/* EXCEPT /admin/login which has its own handling

  const navLinks = [
    { href: '/admin', label: 'Dashboard', icon: '🏠' },
    { href: '/admin/members', label: 'Members', icon: '👥' },
    { href: '/admin/activities', label: 'Activities', icon: '📅' },
    { href: '/admin/publications', label: 'Publications', icon: '📚' },
    { href: '/admin/executives', label: 'Executives', icon: '👥' },
    { href: '/admin/announcements', label: 'Announcements', icon: '📢' },
    { href: '/admin/olympiads', label: 'Olympiads', icon: '🏆' },
  ]

  // If no session, just render children (login page will show)
  if (!session) {
    return <>{children}</>
  }

  return (
    <div className="min-h-screen flex" style={{ background: '#030a12' }}>
      {/* Sidebar */}
      <aside className="w-60 min-h-screen fixed top-0 left-0 flex flex-col"
        style={{ background: '#050d1a', borderRight: '1px solid #0f2a4a' }}>

        {/* Brand */}
        <div className="p-5 pb-4" style={{ borderBottom: '1px solid #0f2a4a' }}>
          <h2 className="font-bold text-base" style={{ fontFamily: "'Orbitron', sans-serif", color: '#00d4ff' }}>
            NDSC Admin
          </h2>
          <p className="text-xs mt-0.5" style={{ color: '#6a8faf' }}>Management Panel</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 p-3 space-y-1">
          {navLinks.map(link => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors hover:text-white"
              style={{ color: '#6a8faf' }}
            >
              <span>{link.icon}</span>
              <span>{link.label}</span>
            </Link>
          ))}
        </nav>

        {/* Bottom */}
        <div className="p-4" style={{ borderTop: '1px solid #0f2a4a' }}>
          <a href="/api/admin/logout"
            className="flex items-center gap-2 text-xs transition-colors hover:text-red-400"
            style={{ color: '#6a8faf' }}>
            <span>⏻</span> Logout
          </a>
        </div>
      </aside>

      {/* Main content */}
      <main className="ml-60 flex-1 p-8 min-h-screen" style={{ color: '#e8f4ff' }}>
        {children}
      </main>
    </div>
  )
}
