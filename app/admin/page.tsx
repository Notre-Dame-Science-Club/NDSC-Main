import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function AdminDashboard() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')

  if (!session) redirect('/admin/login')

  let adminEmail = 'Admin'
  try {
    const sessionData = JSON.parse(session.value)
    adminEmail = sessionData.email || 'Admin'
  } catch {}

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1"
          style={{ fontFamily: "'Orbitron', sans-serif", color: '#00d4ff' }}>
          Dashboard
        </h1>
        <p className="text-sm" style={{ color: '#6a8faf' }}>
          Welcome back, {adminEmail}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[
          { label: 'Members', icon: '👥', href: '/admin/members', desc: 'Manage member registrations' },
          { label: 'Activities', icon: '📅', href: '/admin/activities', desc: 'Events, workshops, seminars' },
          { label: 'Publications', icon: '📚', href: '/admin/publications', desc: 'Upload & manage PDFs' },
          { label: 'Executives', icon: '👥', href: '/admin/executives', desc: 'Manage full club' },
          { label: 'Olympiads', icon: '🏆', href: '/admin/olympiads', desc: 'Manage olympiad registrations' },
          { label: 'Announcements', icon: '📢', href: '/admin/announcements', desc: 'Send email & SMS blasts' },
        ].map(card => (
          <a key={card.href} href={card.href}
            className="block rounded-xl p-5 border transition-all hover:border-[#00d4ff] hover:scale-[1.02]"
            style={{ background: '#050d1a', borderColor: '#0f2a4a' }}>
            <div className="text-3xl mb-3">{card.icon}</div>
            <h3 className="font-bold text-sm mb-1"
              style={{ fontFamily: "'Orbitron', sans-serif", color: '#e8f4ff' }}>
              {card.label}
            </h3>
            <p className="text-xs" style={{ color: '#6a8faf' }}>{card.desc}</p>
          </a>
        ))}
      </div>
    </div>
  )
}
