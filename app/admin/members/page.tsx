'use client'
import { useEffect, useState } from 'react'
import { Eye, Check, X, Award } from 'lucide-react'

type Achievement = { id: string; title: string; description?: string; image_url?: string; status: 'pending' | 'approved'; created_at: string }
type Member = {
  id: string; full_name: string; email: string; phone?: string; batch?: string
  college_roll?: string; ndsc_id?: string; department?: string; is_verified: boolean
  payment_slip_url?: string; achievements?: Achievement[]; created_at: string
}

const DEPARTMENTS = ['Administration', 'Project', 'Publication', 'ICT', 'LWS', 'Quiz', 'R&D']

const s = { background: '#050d1a', borderColor: '#0f2a4a' }
const h = { fontFamily: "'Orbitron', sans-serif", color: '#00d4ff' }

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewingSlip, setViewingSlip] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified'>('all')

  const load = async () => {
    try {
      const res = await fetch('/api/admin/members')
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not load members.'); return }
      setMembers(data.members || [])
    } catch {
      setError('Network error while loading members.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const toggleVerified = async (m: Member) => {
    setError('')
    try {
      const res = await fetch('/api/admin/members', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, is_verified: !m.is_verified }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not update member.'); return }
      load()
    } catch { setError('Network error.') }
  }

  const setDepartment = async (m: Member, department: string) => {
    setError('')
    try {
      const res = await fetch('/api/admin/members', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, department }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Could not update department.'); return }
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, department } : x))
    } catch { setError('Network error.') }
  }

  const moderateAchievement = async (m: Member, achievementId: string, status: 'approved' | 'rejected') => {
    setError('')
    const updated = status === 'rejected'
      ? (m.achievements || []).filter(a => a.id !== achievementId)
      : (m.achievements || []).map(a => a.id === achievementId ? { ...a, status: 'approved' as const } : a)
    try {
      const res = await fetch('/api/admin/members', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, achievements: updated }),
      })
      if (!res.ok) { const d = await res.json(); setError(d.error || 'Could not update achievement.'); return }
      setMembers(prev => prev.map(x => x.id === m.id ? { ...x, achievements: updated } : x))
    } catch { setError('Network error.') }
  }

  const filtered = members.filter(m =>
    filter === 'all' ? true : filter === 'pending' ? !m.is_verified : m.is_verified
  )

  const pendingAchievementsCount = members.reduce(
    (sum, m) => sum + (m.achievements || []).filter(a => a.status === 'pending').length, 0
  )

  if (loading) return <p style={{ color: '#6a8faf' }}>Loading...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={h}>Members</h1>
        <div className="flex gap-2">
          {(['all', 'pending', 'verified'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize"
              style={{
                borderColor: filter === f ? '#00d4ff' : '#0f2a4a',
                color: filter === f ? '#00d4ff' : '#6a8faf',
                background: filter === f ? 'rgba(0,212,255,0.1)' : 'transparent',
              }}>{f}</button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(255,80,80,0.1)', color: '#ff7070', border: '1px solid rgba(255,80,80,0.3)' }}>
          {error}
        </div>
      )}

      {pendingAchievementsCount > 0 && (
        <div className="mb-4 p-3 rounded-lg text-sm flex items-center gap-2" style={{ background: 'rgba(255,179,71,0.1)', color: '#ffb347', border: '1px solid rgba(255,179,71,0.3)' }}>
          <Award size={15} /> {pendingAchievementsCount} achievement{pendingAchievementsCount > 1 ? 's' : ''} awaiting your review below.
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={s}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid #0f2a4a', background: 'rgba(0,212,255,0.05)' }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: '#6a8faf' }}>Name</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: '#6a8faf' }}>College Roll</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: '#6a8faf' }}>Email</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: '#6a8faf' }}>Department</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: '#6a8faf' }}>Slip</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: '#6a8faf' }}>Status</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: '#6a8faf' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(member => (
              <tr key={member.id} style={{ borderBottom: '1px solid #0a1f35' }}>
                <td className="px-4 py-3" style={{ color: '#e8f4ff' }}>{member.full_name}</td>
                <td className="px-4 py-3" style={{ color: '#6a8faf' }}>{member.college_roll || '—'}</td>
                <td className="px-4 py-3" style={{ color: '#6a8faf' }}>{member.email}</td>
                <td className="px-4 py-3">
                  <select value={member.department || ''} onChange={e => setDepartment(member, e.target.value)}
                    className="px-2 py-1 rounded text-xs border outline-none"
                    style={{ background: '#0a1628', borderColor: '#0f2a4a', color: '#e8f4ff' }}>
                    <option value="">—</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {member.payment_slip_url ? (
                    <button onClick={() => setViewingSlip(member.payment_slip_url!)}
                      className="flex items-center gap-1 text-xs underline" style={{ color: '#00d4ff' }}>
                      <Eye size={13} /> View
                    </button>
                  ) : <span className="text-xs" style={{ color: '#3d5a78' }}>—</span>}
                </td>
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
                  <button onClick={() => toggleVerified(member)}
                    className="px-3 py-1 rounded text-xs font-medium transition-all"
                    style={{
                      background: member.is_verified ? 'rgba(255,80,80,0.1)' : 'rgba(0,212,255,0.1)',
                      color: member.is_verified ? '#ff5050' : '#00d4ff',
                      border: `1px solid ${member.is_verified ? 'rgba(255,80,80,0.3)' : 'rgba(0,212,255,0.3)'}`,
                    }}>
                    {member.is_verified ? 'Revoke' : 'Approve'}
                  </button>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: '#6a8faf' }}>No members found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Achievement moderation queue */}
      {members.some(m => (m.achievements || []).length > 0) && (
        <div className="mt-8">
          <h2 className="text-lg font-bold mb-4" style={h}>Achievements</h2>
          <div className="space-y-3">
            {members.flatMap(m => (m.achievements || []).map(a => ({ member: m, achievement: a })))
              .sort((a, b) => (a.achievement.status === 'pending' ? -1 : 1) - (b.achievement.status === 'pending' ? -1 : 1))
              .map(({ member, achievement }) => (
                <div key={achievement.id} className="rounded-xl border p-4 flex items-start gap-4" style={s}>
                  {achievement.image_url && (
                    <img src={achievement.image_url} alt="" className="w-16 h-16 rounded-lg object-cover flex-shrink-0" />
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-bold" style={{ color: '#e8f4ff' }}>{achievement.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#6a8faf' }}>by {member.full_name}</p>
                    {achievement.description && <p className="text-xs mt-1" style={{ color: '#6a8faf' }}>{achievement.description}</p>}
                  </div>
                  {achievement.status === 'pending' ? (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => moderateAchievement(member, achievement.id, 'approved')}
                        className="p-1.5 rounded-lg" style={{ background: 'rgba(0,255,128,0.15)', color: '#00ff80' }}><Check size={15} /></button>
                      <button onClick={() => moderateAchievement(member, achievement.id, 'rejected')}
                        className="p-1.5 rounded-lg" style={{ background: 'rgba(255,80,80,0.1)', color: '#ff7070' }}><X size={15} /></button>
                    </div>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(0,255,128,0.1)', color: '#00ff80' }}>Approved</span>
                  )}
                </div>
              ))}
          </div>
        </div>
      )}

      {viewingSlip && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(2,8,16,0.92)' }}
          onClick={() => setViewingSlip(null)}>
          <img src={viewingSlip} alt="Membership slip" className="max-w-full max-h-[85vh] rounded-xl" onClick={e => e.stopPropagation()} />
        </div>
      )}
    </div>
  )
}
