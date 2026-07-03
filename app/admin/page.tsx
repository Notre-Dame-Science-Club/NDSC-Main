import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { authCookies } from '@/lib/config/site'

const DASHBOARD_CARDS = [
  { label: 'Members', icon: '👥', href: '/admin/members', desc: 'Manage member registrations' },
  { label: 'Activities', icon: '📅', href: '/admin/activities', desc: 'Events, workshops, seminars' },
  { label: 'Publications', icon: '📚', href: '/admin/publications', desc: 'Upload & manage PDFs' },
  { label: 'Executives', icon: '👥', href: '/admin/executives', desc: 'Manage full club' },
  { label: 'Olympiads', icon: '🏆', href: '/admin/olympiads', desc: 'Manage olympiad registrations' },
  { label: 'Announcements', icon: '📢', href: '/admin/announcements', desc: 'Send email & SMS blasts' },
  { label: 'Fix Upload URLs', icon: '🔧', href: '/admin/fix-urls', desc: 'Fix broken image/file URLs in database' },
  { label: 'AI ChatBot', icon: '֎AI', href: 'https://ndsc-ai-bot.foysalmahmud1627.workers.dev/logs', desc: 'NDSC AI LightHouse' },
]

export default async function AdminDashboard() {
  const cookieStore = await cookies()
  const session = cookieStore.get(authCookies.admin)
  if (!session) redirect('/admin/login')

  let adminEmail = 'Admin'
  try {
    adminEmail = JSON.parse(session.value).email || 'Admin'
  } catch {}

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-2xl font-bold mb-1" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }}>
          Dashboard
        </h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Welcome back, {adminEmail}</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {DASHBOARD_CARDS.map(card => (
          <a
            key={card.href}
            href={card.href}
            className="block rounded-xl p-5 border transition-all hover:border-[color:var(--blue)] hover:scale-[1.02]"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
          >
            <div className="text-3xl mb-3">{card.icon}</div>
            <h3 className="font-bold text-sm mb-1" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--white)' }}>
              {card.label}
            </h3>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{card.desc}</p>
          </a>
        ))}
      </div>
    </div>
  )
}
