'use client'
import { useEffect, useState } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, MapPin, Clock, Edit2, Save, Users } from 'lucide-react'

const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--white)' }
const inputCls = 'w-full px-3 py-2.5 rounded-lg text-sm outline-none'
const STORAGE_KEY = 'ndsc_activity_reg_id'

export default function ActivityDashboardPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [registration, setRegistration] = useState<any>(null)
  const [category, setCategory] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [viewAsTeamMemberId, setViewAsTeamMemberId] = useState<string | null>(null)

  // Team member login form
  const [showTeamLogin, setShowTeamLogin] = useState(false)
  const [teamEmail, setTeamEmail] = useState('')
  const [teamPassword, setTeamPassword] = useState('')
  const [teamLoginError, setTeamLoginError] = useState('')
  const [teamLoginLoading, setTeamLoginLoading] = useState(false)

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  const loadRegistration = async (id: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/activity-register?id=${id}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Registration not found.'); setLoading(false); return }
      setRegistration(data.registration)
      setCategory(data.category)
      setSession(data.session)
      setEditForm({
        full_name: data.registration.full_name, phone: data.registration.phone,
        email: data.registration.email, college: data.registration.college,
        college_roll: data.registration.college_roll, hsc_session: data.registration.hsc_session || '',
      })
      localStorage.setItem(STORAGE_KEY, id)
    } catch {
      setError('Network error while loading your dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const regId = searchParams.get('reg') || localStorage.getItem(STORAGE_KEY)
    if (regId) {
      loadRegistration(regId)
    } else {
      setLoading(false)
    }
  }, [])

  const paymentRedirectStatus = searchParams.get('payment')

  const teamLogin = async () => {
    setTeamLoginError('')
    if (!teamEmail.trim() || !teamPassword) { setTeamLoginError('Email and password are required.'); return }
    setTeamLoginLoading(true)
    try {
      const res = await fetch('/api/activity-team-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: teamEmail.trim(), password: teamPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setTeamLoginError(data.error || 'Login failed.'); setTeamLoginLoading(false); return }
      setViewAsTeamMemberId(data.team_member_id)
      await loadRegistration(data.registration_id)
    } catch {
      setTeamLoginError('Network error. Please try again.')
    } finally {
      setTeamLoginLoading(false)
    }
  }

  const isEditWindowOpen = () => {
    if (!registration?.edit_locked_at) return true
    return new Date(registration.edit_locked_at).getTime() > Date.now()
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/activity-register', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: registration.id, ...editForm }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not save changes.'); setSaving(false); return }
      setRegistration((prev: any) => ({ ...prev, ...editForm }))
      setEditing(false)
    } catch {
      setError('Network error while saving.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}><p style={{ color: 'var(--muted)' }}>Loading...</p></div>

  if (!registration) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)', paddingTop: '88px' }}>
        <div className="max-w-sm w-full">
          <Link href={`/activities/${slug}`} className="inline-flex items-center gap-2 text-sm mb-6" style={{ color: 'var(--muted)' }}>
            <ArrowLeft size={14} /> Back to activity
          </Link>

          {error && <p className="text-sm mb-4" style={{ color: '#ff7070' }}>{error}</p>}

          {!showTeamLogin ? (
            <div className="rounded-2xl p-6 border text-center" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
              <p className="text-sm mb-4" style={{ color: 'var(--white)' }}>
                We couldn't find your registration on this device.
              </p>
              <button onClick={() => setShowTeamLogin(true)} className="text-sm underline" style={{ color: 'var(--blue)' }}>
                Are you a team member? Log in here →
              </button>
            </div>
          ) : (
            <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
              <p className="text-sm font-semibold mb-3" style={{ color: 'var(--white)' }}>Team Member Login</p>
              <div className="space-y-2">
                <input placeholder="Email" value={teamEmail} onChange={e => setTeamEmail(e.target.value)} className={inputCls} style={inputStyle} />
                <input type="password" placeholder="Password" value={teamPassword} onChange={e => setTeamPassword(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
              {teamLoginError && <p className="text-xs mt-2" style={{ color: '#ff7070' }}>{teamLoginError}</p>}
              <button onClick={teamLogin} disabled={teamLoginLoading}
                className="w-full mt-3 py-2.5 rounded-lg text-sm font-bold text-black disabled:opacity-60" style={{ background: 'var(--blue)' }}>
                {teamLoginLoading ? 'Logging in...' : 'Log In'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const viewingMember = viewAsTeamMemberId
    ? (registration.team_members || []).find((m: any) => m.id === viewAsTeamMemberId)
    : null
  const displayName = viewingMember?.full_name || registration.full_name
  const editWindowOpen = isEditWindowOpen()

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: 'var(--bg)', paddingTop: '88px' }}>
      <div className="max-w-lg mx-auto">
        <Link href={`/activities/${slug}`} className="inline-flex items-center gap-2 text-sm mb-6" style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={14} /> Back to activity
        </Link>

        <h1 className="text-2xl font-black mb-1" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--white)' }}>
          {session?.title}
        </h1>
        <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>{category?.name}</p>
        {viewingMember && (
          <p className="text-xs mb-6 px-2.5 py-1 rounded-full inline-block" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
            Viewing as team member: {viewingMember.full_name}
          </p>
        )}

        {error && <p className="text-sm mb-4" style={{ color: '#ff7070' }}>{error}</p>}

        {paymentRedirectStatus && (
          <div className="rounded-xl p-4 mb-5 text-sm" style={{
            background: paymentRedirectStatus === 'success' ? 'rgba(0,255,128,0.08)' : 'rgba(255,80,80,0.08)',
            color: paymentRedirectStatus === 'success' ? '#00ff80' : '#ff7070',
          }}>
            {paymentRedirectStatus === 'success' && '✅ Payment received! It may take a moment to fully confirm below.'}
            {paymentRedirectStatus === 'failed' && '❌ Payment failed. You can try again from your dashboard.'}
            {paymentRedirectStatus === 'cancelled' && '⚠️ Payment was cancelled.'}
          </div>
        )}

        {/* Schedule reminder */}
        {category?.schedule_date && (
          <div className="rounded-xl p-4 mb-5 space-y-1.5" style={{ background: 'rgba(52,211,153,0.08)', border: '1px solid rgba(52,211,153,0.25)' }}>
            <p className="text-sm font-bold flex items-center gap-2" style={{ color: '#34d399' }}>
              <Calendar size={14} /> Your Schedule
            </p>
            <p className="text-sm" style={{ color: 'var(--white)' }}>
              {new Date(category.schedule_date).toLocaleDateString('en-BD', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            {category.schedule_time && <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><Clock size={12} /> {category.schedule_time}</p>}
            {category.schedule_room && <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><MapPin size={12} /> {category.schedule_room}</p>}
          </div>
        )}

        {/* Payment status */}
        {registration.payment_status !== 'not_required' && (
          <div className="rounded-xl p-4 mb-5" style={{
            background: registration.payment_status === 'paid' ? 'rgba(0,255,128,0.08)' : 'rgba(255,179,71,0.08)',
            border: `1px solid ${registration.payment_status === 'paid' ? 'rgba(0,255,128,0.25)' : 'rgba(255,179,71,0.25)'}`,
          }}>
            <p className="text-sm font-bold" style={{ color: registration.payment_status === 'paid' ? '#00ff80' : '#ffb347' }}>
              💳 Payment: {registration.payment_status === 'paid' ? 'Completed ✓' : registration.payment_status === 'pending' ? 'Pending' : 'Failed'}
            </p>
            {registration.payment_amount && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>৳{registration.payment_amount}</p>}
          </div>
        )}

        {/* Info card (only the leader can edit; team members see a simplified view) */}
        {!viewingMember && (
          <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold" style={{ color: 'var(--white)' }}>Your Information</p>
              {editWindowOpen && !editing && (
                <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs" style={{ color: 'var(--blue)' }}>
                  <Edit2 size={12} /> Edit
                </button>
              )}
            </div>

            {!editWindowOpen && (
              <p className="text-xs mb-3" style={{ color: '#ffb347' }}>The edit window for this registration has closed.</p>
            )}

            {editing ? (
              <div className="space-y-2">
                {(['full_name', 'phone', 'email', 'college', 'college_roll', 'hsc_session'] as const).map(key => (
                  <input key={key} value={editForm[key] || ''} onChange={e => setEditForm((p: any) => ({ ...p, [key]: e.target.value }))}
                    placeholder={key.replace('_', ' ')} className={inputCls} style={inputStyle} />
                ))}
                <div className="flex gap-2 pt-1">
                  <button onClick={saveEdit} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-60" style={{ background: 'var(--blue)' }}>
                    <Save size={13} className="inline mr-1" /> {saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--muted)' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-sm">
                <p style={{ color: 'var(--muted)' }}>Name: <span style={{ color: 'var(--white)' }}>{registration.full_name}</span></p>
                <p style={{ color: 'var(--muted)' }}>Phone: <span style={{ color: 'var(--white)' }}>{registration.phone}</span></p>
                <p style={{ color: 'var(--muted)' }}>Email: <span style={{ color: 'var(--white)' }}>{registration.email}</span></p>
                <p style={{ color: 'var(--muted)' }}>College: <span style={{ color: 'var(--white)' }}>{registration.college}</span></p>
                <p style={{ color: 'var(--muted)' }}>Roll: <span style={{ color: 'var(--white)' }}>{registration.college_roll}</span></p>
              </div>
            )}
          </div>
        )}

        {/* Team members list */}
        {(registration.team_members || []).length > 0 && (
          <div className="rounded-xl p-5 mb-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <p className="text-sm font-bold flex items-center gap-2 mb-3" style={{ color: '#a78bfa' }}>
              <Users size={14} /> Team Members
            </p>
            <div className="space-y-2">
              {registration.team_members.map((m: any) => (
                <div key={m.id} className="text-sm" style={{ color: 'var(--muted)' }}>
                  {m.full_name} {m.id === viewAsTeamMemberId && <span style={{ color: '#a78bfa' }}>(you)</span>}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
