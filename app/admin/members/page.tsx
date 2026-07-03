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

const s = { background: 'var(--bg2)', borderColor: 'var(--border)' }
const h = { fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }

export default function AdminMembersPage() {
  const [members, setMembers] = useState<Member[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [viewingSlip, setViewingSlip] = useState<string | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'verified'>('all')
  const [emailingMember, setEmailingMember] = useState<Member | null>(null)
  const [emailSubject, setEmailSubject] = useState('')
  const [emailBody, setEmailBody] = useState('')
  const [emailSending, setEmailSending] = useState(false)
  const [emailResult, setEmailResult] = useState<{ ok: boolean; text: string } | null>(null)
  const [addingAchievementFor, setAddingAchievementFor] = useState<Member | null>(null)
  const [achTitle, setAchTitle] = useState('')
  const [achDesc, setAchDesc] = useState('')
  const [achSaving, setAchSaving] = useState(false)
  const [achError, setAchError] = useState('')

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

  const cancelMembership = async (m: Member) => {
    if (!confirm(`Permanently cancel ${m.full_name}'s membership? This deletes their account entirely and cannot be undone.`)) return
    setError('')
    try {
      const res = await fetch('/api/admin/members', {
        method: 'DELETE', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not cancel this membership.'); return }
      setMembers(prev => prev.filter(x => x.id !== m.id))
    } catch { setError('Network error.') }
  }

  const sendMemberEmail = async () => {
    if (!emailingMember || !emailSubject.trim() || !emailBody.trim()) {
      setEmailResult({ ok: false, text: 'Subject and message are required.' }); return
    }
    setEmailSending(true)
    setEmailResult(null)
    try {
      const res = await fetch('/api/admin/email-member', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: emailingMember.id, subject: emailSubject, message: emailBody }),
      })
      const data = await res.json()
      if (!res.ok) { setEmailResult({ ok: false, text: data.error || 'Could not send the email.' }); return }
      setEmailResult({ ok: true, text: 'Email sent!' })
      setEmailSubject(''); setEmailBody('')
    } catch {
      setEmailResult({ ok: false, text: 'Network error.' })
    } finally {
      setEmailSending(false)
    }
  }

  const addAchievementForMember = async () => {
    if (!addingAchievementFor || !achTitle.trim()) { setAchError('Title is required.'); return }
    setAchSaving(true)
    setAchError('')
    try {
      const res = await fetch('/api/admin/members', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ member_id: addingAchievementFor.id, title: achTitle, description: achDesc }),
      })
      const data = await res.json()
      if (!res.ok) { setAchError(data.error || 'Could not add achievement.'); return }
      setMembers(prev => prev.map(x => x.id === addingAchievementFor.id ? { ...x, achievements: data.achievements } : x))
      setAddingAchievementFor(null); setAchTitle(''); setAchDesc('')
    } catch {
      setAchError('Network error.')
    } finally {
      setAchSaving(false)
    }
  }

  const filtered = members.filter(m =>
    filter === 'all' ? true : filter === 'pending' ? !m.is_verified : m.is_verified
  )

  const pendingAchievementsCount = members.reduce(
    (sum, m) => sum + (m.achievements || []).filter(a => a.status === 'pending').length, 0
  )

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading...</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
        <h1 className="text-2xl font-bold" style={h}>Members</h1>
        <div className="flex gap-2">
          {(['all', 'pending', 'verified'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold border capitalize"
              style={{
                borderColor: filter === f ? 'var(--blue)' : 'var(--border)',
                color: filter === f ? 'var(--blue)' : 'var(--muted)',
                background: filter === f ? 'rgba(var(--blue-rgb), 0.1)' : 'transparent',
              }}>{f}</button>
          ))}
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)', border: '1px solid rgba(var(--danger-rgb), 0.3)' }}>
          {error}
        </div>
      )}

      {pendingAchievementsCount > 0 && (
        <div className="mb-4 p-3 rounded-lg text-sm flex items-center gap-2" style={{ background: 'rgba(var(--warning-rgb), 0.1)', color: 'var(--warning)', border: '1px solid rgba(var(--warning-rgb), 0.3)' }}>
          <Award size={15} /> {pendingAchievementsCount} achievement{pendingAchievementsCount > 1 ? 's' : ''} awaiting your review below.
        </div>
      )}

      <div className="rounded-xl border overflow-hidden" style={s}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(var(--blue-rgb), 0.05)' }}>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Name</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>College Roll</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Email</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Department</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Slip</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Status</th>
              <th className="text-left px-4 py-3 font-medium" style={{ color: 'var(--muted)' }}>Action</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map(member => (
              <tr key={member.id} style={{ borderBottom: '1px solid var(--surface-alt)' }}>
                <td className="px-4 py-3" style={{ color: 'var(--white)' }}>{member.full_name}</td>
                <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{member.college_roll || '—'}</td>
                <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{member.email}</td>
                <td className="px-4 py-3">
                  <select value={member.department || ''} onChange={e => setDepartment(member, e.target.value)}
                    className="px-2 py-1 rounded text-xs border outline-none"
                    style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }}>
                    <option value="">—</option>
                    {DEPARTMENTS.map(d => <option key={d} value={d}>{d}</option>)}
                  </select>
                </td>
                <td className="px-4 py-3">
                  {member.payment_slip_url ? (
                    <button onClick={() => setViewingSlip(member.payment_slip_url!)}
                      className="flex items-center gap-1 text-xs underline" style={{ color: 'var(--blue)' }}>
                      <Eye size={13} /> View
                    </button>
                  ) : <span className="text-xs" style={{ color: 'var(--border-soft)' }}>—</span>}
                </td>
                <td className="px-4 py-3">
                  <span className="px-2 py-1 rounded-full text-xs font-medium"
                    style={{
                      background: member.is_verified ? 'rgba(var(--success-rgb), 0.1)' : 'rgba(255,165,0,0.1)',
                      color: member.is_verified ? 'var(--success)' : 'var(--warning)',
                      border: `1px solid ${member.is_verified ? 'rgba(var(--success-rgb), 0.3)' : 'rgba(255,165,0,0.3)'}`,
                    }}>
                    {member.is_verified ? 'Verified' : 'Pending'}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1.5">
                    <button onClick={() => toggleVerified(member)}
                      className="px-3 py-1 rounded text-xs font-medium transition-all"
                      style={{
                        background: member.is_verified ? 'rgba(var(--danger-rgb), 0.1)' : 'rgba(var(--blue-rgb), 0.1)',
                        color: member.is_verified ? 'var(--danger)' : 'var(--blue)',
                        border: `1px solid ${member.is_verified ? 'rgba(var(--danger-rgb), 0.3)' : 'rgba(var(--blue-rgb), 0.3)'}`,
                      }}>
                      {member.is_verified ? 'Revoke' : 'Approve'}
                    </button>
                    <button onClick={() => { setEmailingMember(member); setEmailResult(null) }}
                      className="px-3 py-1 rounded text-xs font-medium" style={{ background: 'rgba(var(--info-rgb), 0.1)', color: 'var(--info)', border: '1px solid rgba(var(--info-rgb), 0.3)' }}>
                      Email
                    </button>
                    <button onClick={() => { setAddingAchievementFor(member); setAchError('') }}
                      className="px-3 py-1 rounded text-xs font-medium" style={{ background: 'rgba(var(--warning-rgb), 0.1)', color: 'var(--warning)', border: '1px solid rgba(var(--warning-rgb), 0.3)' }}>
                      + Achievement
                    </button>
                    <button onClick={() => cancelMembership(member)}
                      className="px-3 py-1 rounded text-xs font-medium" style={{ background: 'rgba(var(--danger-rgb), 0.05)', color: 'var(--danger)', border: '1px solid rgba(var(--danger-rgb), 0.2)' }}>
                      Cancel
                    </button>
                  </div>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td colSpan={7} className="px-4 py-8 text-center" style={{ color: 'var(--muted)' }}>No members found.</td></tr>
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
                    <p className="text-sm font-bold" style={{ color: 'var(--white)' }}>{achievement.title}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>by {member.full_name}</p>
                    {achievement.description && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{achievement.description}</p>}
                  </div>
                  {achievement.status === 'pending' ? (
                    <div className="flex gap-2 flex-shrink-0">
                      <button onClick={() => moderateAchievement(member, achievement.id, 'approved')}
                        className="p-1.5 rounded-lg" style={{ background: 'rgba(var(--success-rgb), 0.15)', color: 'var(--success)' }}><Check size={15} /></button>
                      <button onClick={() => moderateAchievement(member, achievement.id, 'rejected')}
                        className="p-1.5 rounded-lg" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)' }}><X size={15} /></button>
                    </div>
                  ) : (
                    <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{ background: 'rgba(var(--success-rgb), 0.1)', color: 'var(--success)' }}>Approved</span>
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

      {emailingMember && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(2,8,16,0.85)' }}>
          <div className="w-full max-w-md rounded-2xl border p-6" style={s}>
            <h2 className="font-bold text-sm mb-1" style={h}>Email {emailingMember.full_name}</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>{emailingMember.email}</p>
            <input value={emailSubject} onChange={e => setEmailSubject(e.target.value)} placeholder="Subject"
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none mb-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }} />
            <textarea rows={5} value={emailBody} onChange={e => setEmailBody(e.target.value)} placeholder="Message"
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none mb-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }} />
            {emailResult && (
              <p className="text-xs mb-3" style={{ color: emailResult.ok ? 'var(--success)' : 'var(--danger-soft)' }}>{emailResult.text}</p>
            )}
            <div className="flex gap-2">
              <button onClick={sendMemberEmail} disabled={emailSending}
                className="flex-1 py-2 rounded-lg text-sm font-bold disabled:opacity-50" style={{ background: 'var(--blue)', color: '#000' }}>
                {emailSending ? 'Sending...' : 'Send Email'}
              </button>
              <button onClick={() => setEmailingMember(null)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--muted)' }}>Close</button>
            </div>
          </div>
        </div>
      )}

      {addingAchievementFor && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(2,8,16,0.85)' }}>
          <div className="w-full max-w-md rounded-2xl border p-6" style={s}>
            <h2 className="font-bold text-sm mb-1" style={h}>Add Achievement — {addingAchievementFor.full_name}</h2>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Added achievements are pre-approved and show on the member's profile immediately.</p>
            <input value={achTitle} onChange={e => setAchTitle(e.target.value)} placeholder="Title"
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none mb-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }} />
            <textarea rows={3} value={achDesc} onChange={e => setAchDesc(e.target.value)} placeholder="Description (optional)"
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none mb-3" style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }} />
            {achError && <p className="text-xs mb-3" style={{ color: 'var(--danger-soft)' }}>{achError}</p>}
            <div className="flex gap-2">
              <button onClick={addAchievementForMember} disabled={achSaving}
                className="flex-1 py-2 rounded-lg text-sm font-bold disabled:opacity-50" style={{ background: 'var(--blue)', color: '#000' }}>
                {achSaving ? 'Saving...' : 'Add Achievement'}
              </button>
              <button onClick={() => setAddingAchievementFor(null)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--muted)' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
