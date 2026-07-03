'use client'
import { useEffect, useState } from 'react'
import { Send, Users, UserCheck, UserX } from 'lucide-react'

type Announcement = {
  id: string
  title: string
  body: string
  target: 'all' | 'members' | 'non_members'
  created_at: string
}

const s = { background: 'var(--bg2)', borderColor: 'var(--border)' }
const h = { fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }
const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'
const inputStyle = { background: 'var(--bg3)', borderColor: 'var(--border)', color: 'var(--white)' }

const TARGET_LABEL: Record<Announcement['target'], string> = {
  all: 'Everyone',
  members: 'Members only',
  non_members: 'Olympiad registrants (non-members)',
}
const TARGET_ICON: Record<Announcement['target'], any> = {
  all: Users,
  members: UserCheck,
  non_members: UserX,
}

export default function AdminAnnouncementsPage() {
  const [history, setHistory] = useState<Announcement[]>([])
  const [loading, setLoading] = useState(true)
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [target, setTarget] = useState<Announcement['target']>('all')
  const [sending, setSending] = useState(false)
  const [result, setResult] = useState<{ ok: boolean; text: string } | null>(null)

  const load = async () => {
    const res = await fetch('/api/admin/announcements')
    const data = res.ok ? await res.json() : []
    setHistory(Array.isArray(data) ? data : [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const send = async () => {
    if (!message.trim()) { setResult({ ok: false, text: 'Please write a message first.' }); return }
    setSending(true)
    setResult(null)
    try {
      const res = await fetch('/api/admin/send-announcement', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: title.trim() || undefined, message, target }),
      })
      const data = await res.json()
      if (!res.ok) {
        setResult({ ok: false, text: data.error || 'Could not send the announcement.' })
      } else {
        setResult({ ok: true, text: `Sent to ${data.sentCount} of ${data.totalRecipients} recipient(s).` })
        setTitle('')
        setMessage('')
        load()
      }
    } catch {
      setResult({ ok: false, text: 'Network error. Please try again.' })
    } finally {
      setSending(false)
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold mb-6" style={h}>Announcements</h1>

      {/* Compose box — this is the single source of truth for sending
          announcements; the Olympiad admin page links here instead of
          duplicating this form. */}
      <div className="rounded-xl border p-6 mb-6" style={s}>
        <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--blue)', fontFamily: "'Orbitron', sans-serif" }}>
          📢 Compose Announcement
        </h2>

        <div className="mb-3">
          <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Title (optional)</label>
          <input className={inputClass} style={inputStyle} value={title}
            onChange={e => setTitle(e.target.value)} placeholder="e.g. New Workshop Announced" />
        </div>

        <div className="mb-3">
          <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Message</label>
          <textarea rows={4} className={inputClass + ' resize-none'} style={inputStyle}
            value={message} onChange={e => setMessage(e.target.value)}
            placeholder="Write your announcement message..." />
        </div>

        <div className="mb-4">
          <label className="block text-xs mb-2" style={{ color: 'var(--muted)' }}>Send to</label>
          <div className="flex gap-2 flex-wrap">
            {(['all', 'members', 'non_members'] as const).map(t => {
              const Icon = TARGET_ICON[t]
              return (
                <button key={t} onClick={() => setTarget(t)}
                  className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border"
                  style={{
                    borderColor: target === t ? 'var(--blue)' : 'var(--border)',
                    color: target === t ? 'var(--blue)' : 'var(--muted)',
                    background: target === t ? 'rgba(var(--blue-rgb), 0.1)' : 'transparent',
                  }}>
                  <Icon size={14} /> {TARGET_LABEL[t]}
                </button>
              )
            })}
          </div>
        </div>

        {result && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{
            background: result.ok ? 'rgba(var(--success-rgb), 0.1)' : 'rgba(var(--danger-rgb), 0.1)',
            border: `1px solid ${result.ok ? 'rgba(var(--success-rgb), 0.3)' : 'rgba(var(--danger-rgb), 0.3)'}`,
            color: result.ok ? 'var(--success)' : 'var(--danger-soft)',
          }}>
            {result.text}
          </div>
        )}

        <button onClick={send} disabled={sending}
          className="flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-black disabled:opacity-50"
          style={{ background: 'var(--blue)', color: '#000', fontFamily: "'Orbitron', sans-serif" }}>
          <Send size={15} /> {sending ? 'SENDING...' : 'SEND ANNOUNCEMENT'}
        </button>
      </div>

      {/* History */}
      <div className="rounded-xl border" style={s}>
        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-bold text-sm" style={{ color: 'var(--blue)', fontFamily: "'Orbitron', sans-serif" }}>
            Past Announcements
          </h2>
        </div>
        {loading ? (
          <p className="p-6 text-sm" style={{ color: 'var(--muted)' }}>Loading...</p>
        ) : history.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: 'var(--muted)' }}>No announcements sent yet.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--surface-alt)' }}>
            {history.map(a => {
              const knownTargets: Announcement['target'][] = ['all', 'members', 'non_members']
              const safeTarget: Announcement['target'] = knownTargets.includes(a.target) ? a.target : 'all'
              const Icon = TARGET_ICON[safeTarget] || Users
              return (
                <div key={a.id} className="p-4">
                  <div className="flex items-center justify-between mb-1 flex-wrap gap-2">
                    <p className="font-bold text-sm" style={{ color: 'var(--white)' }}>{a.title}</p>
                    <span className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full"
                      style={{ background: 'rgba(var(--blue-rgb), 0.08)', color: 'var(--muted)' }}>
                      <Icon size={12} /> {TARGET_LABEL[safeTarget]}
                    </span>
                  </div>
                  <p className="text-sm" style={{ color: 'var(--muted)' }}>{a.body}</p>
                  <p className="text-xs mt-2" style={{ color: 'var(--border-soft)' }}>
                    {new Date(a.created_at).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                  </p>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
