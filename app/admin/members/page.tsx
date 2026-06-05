import { cookies } from 'next/headers'
import { redirect } from 'next/navigation'
import { supabaseAdmin } from '@/lib/supabase'
export const dynamic = 'force-dynamic'

export default async function AdminMembersPage() {
  const cookieStore = await cookies()
  const session = cookieStore.get('admin_session')
  if (!session) redirect('/admin/login')

  const { data: members } = await supabaseAdmin
    .from('members')
    .select('*')
    .order('created_at', { ascending: false })

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6"
        style={{ fontFamily: "'Orbitron', sans-serif", color: '#00d4ff' }}>
        Members
      </h1>

      <div className="rounded-xl border overflow-hidden"
        style={{ background: '#050d1a', borderColor: '#0f2a4a' }}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #0f2a4a', background: 'rgba(0,212,255,0.05)' }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: '#6a8faf' }}>Name</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: '#6a8faf' }}>Email</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: '#6a8faf' }}>Batch</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: '#6a8faf' }}>Status</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: '#6a8faf' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {members?.map(member => (
              <tr key={member.id} style={{ borderBottom: '1px solid #0a1f35' }}>
                <td className="px-4 py-3" style={{ color: '#e8f4ff' }}>{member.full_name}</td>
                <td className="px-4 py-3" style={{ color: '#6a8faf' }}>{member.email}</td>
                <td className="px-4 py-3" style={{ color: '#6a8faf' }}>{member.batch || '—'}</td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: member.is_verified ? 'rgba(0,255,128,0.1)' : 'rgba(255,165,0,0.1)',
                      color: member.is_verified ? '#00ff80' : '#ffa500',
                      border: `1px solid ${member.is_verified ? 'rgba(0,255,128,0.3)' : 'rgba(255,165,0,0.3)'}`,
                    }}>
                    {member.is_verified ? 'Verified' : 'Pending'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <form action="/api/admin/verify-member" method="POST">
                    <input type="hidden" name="id" value={member.id} />
                    <input type="hidden" name="verified" value={(!member.is_verified).toString()} />
                    <button type="submit"
                      className="px-3 py-1 rounded text-xs font-medium transition-all"
                      style={{
                        background: member.is_verified ? 'rgba(255,80,80,0.1)' : 'rgba(0,212,255,0.1)',
                        color: member.is_verified ? '#ff5050' : '#00d4ff',
                        border: `1px solid ${member.is_verified ? 'rgba(255,80,80,0.3)' : 'rgba(0,212,255,0.3)'}`,
                      }}>
                      {member.is_verified ? 'Revoke' : 'Approve'}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {(!members || members.length === 0) && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center" style={{ color: '#6a8faf' }}>
                  No members yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
