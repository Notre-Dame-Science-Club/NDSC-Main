import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'

export default async function AdminAnnouncementsPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')
  if (!session) redirect('/admin/login')

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6"
        style={{ fontFamily: "'Orbitron', sans-serif", color: '#00d4ff' }}>
        Announcements
      </h1>
      <div className="rounded-xl border p-6"
        style={{ background: '#050d1a', borderColor: '#0f2a4a' }}>
        <p style={{ color: '#6a8faf' }}>Announcements management — coming soon.</p>
      </div>
    </div>
  )
}
