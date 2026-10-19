'use client'
import { useCallback, useEffect, useState } from 'react'
import { CheckCircle, Trash2 } from 'lucide-react'
import { isNDCName } from '@/lib/college'
import { MESSAGE_STATUSES, NOTICE_LIMITS, categoryLabel, type MessageStatus } from '@/lib/notices'

type Sender = {
  id: string
  full_name: string | null
  email: string | null
  phone: string | null
  institution: string | null
  batch: string | null
  college_roll: string | null
  is_verified: boolean | null
}
type Message = {
  id: string
  user_id: string | null
  sender_name: string | null
  sender_email: string | null
  category: string
  subject: string | null
  message: string
  status: MessageStatus
  admin_reply: string | null
  resolved_by: string | null
  resolved_at: string | null
  created_at: string
  sender: Sender | null
}
type Filter = MessageStatus | 'all'

const s = { background: 'var(--bg2)', borderColor: 'var(--border)' }
const STATUS_COLOR: Record<MessageStatus, string> = { open: 'var(--warning)', in_progress: 'var(--blue)', resolved: 'var(--success)' }
const FILTERS: { value: Filter; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
  { value: 'all', label: 'All' },
]

const when = (iso: string) =>
  new Date(iso).toLocaleString('en-US', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

function MessageCard({ m, onChanged }: { m: Message; onChanged: () => void }) {
  const [reply, setReply] = useState(m.admin_reply || '')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const u = m.sender
  const name = u?.full_name || m.sender_name || 'Unknown sender'
  const email = u?.email || m.sender_email
  const ndc = isNDCName(u?.institution)

  const update = async (patch: { status?: MessageStatus }) => {
    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/admin/messages', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: m.id, admin_reply: reply, ...patch }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not update the message.')
      onChanged()
    } catch (e: any) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!confirm('Delete this message permanently?')) return
    await fetch('/api/admin/messages', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: m.id }) })
    onChanged()
  }

  const detail = (k: string, v: string | null | undefined, highlight = false) =>
    v ? (
      <span className="text-xs" style={{ color: 'var(--muted)' }}>
        {k}: <span style={{ color: highlight ? 'var(--blue)' : 'var(--white)', fontWeight: highlight ? 700 : 500 }}>{v}</span>
      </span>
    ) : null

  return (
    <div className="p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-2">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>
            {categoryLabel(m.category)}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ color: STATUS_COLOR[m.status], borderColor: STATUS_COLOR[m.status] }}>
            {MESSAGE_STATUSES.find(x => x.value === m.status)?.label}
          </span>
        </div>
        <span className="text-xs" style={{ color: 'var(--muted)' }}>{when(m.created_at)}</span>
      </div>

      <div className="flex flex-wrap gap-x-4 gap-y-1 mb-3">
        <span className="text-sm font-bold" style={{ color: 'var(--white)' }}>{name}</span>
        {email && <a href={`mailto:${email}`} className="text-xs hover:underline" style={{ color: 'var(--blue)' }}>{email}</a>}
        {detail('Phone', u?.phone)}
        {detail('College', u?.institution)}
        {detail('Batch', u?.batch)}
        {detail('Roll', u?.college_roll, ndc)}
        {u && !u.college_roll && ndc && <span className="text-xs" style={{ color: 'var(--warning)' }}>No roll on file</span>}
        {!u && <span className="text-xs" style={{ color: 'var(--muted)' }}>(account no longer exists)</span>}
      </div>

      {m.subject && <p className="text-sm font-semibold mb-1 break-words" style={{ color: 'var(--white)' }}>{m.subject}</p>}
      <p className="text-sm whitespace-pre-line break-words" style={{ color: 'var(--muted)' }}>{m.message}</p>

      <div className="mt-4">
        <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }} htmlFor={`reply-${m.id}`}>
          Reply to the member (shown on their dashboard — optional)
        </label>
        <textarea
          id={`reply-${m.id}`} rows={2} value={reply} maxLength={NOTICE_LIMITS.reply}
          onChange={e => setReply(e.target.value)}
          className="w-full px-3 py-2 rounded-lg text-sm outline-none border resize-y"
          style={{ background: 'var(--bg3)', borderColor: 'var(--border)', color: 'var(--white)' }}
        />
      </div>

      {error && <p role="alert" className="text-xs mt-2" style={{ color: 'var(--danger-soft)' }}>{error}</p>}

      <div className="flex items-center gap-2 mt-3 flex-wrap">
        {m.status !== 'resolved' ? (
          <button onClick={() => update({ status: 'resolved' })} disabled={busy}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-black disabled:opacity-50"
            style={{ background: 'var(--success)', color: '#000', fontFamily: 'inherit' }}>
            <CheckCircle size={14} /> RESOLVE
          </button>
        ) : (
          <button onClick={() => update({ status: 'open' })} disabled={busy}
            className="px-4 py-2 rounded-lg text-xs font-semibold border disabled:opacity-50" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
            Reopen
          </button>
        )}
        {m.status === 'open' && (
          <button onClick={() => update({ status: 'in_progress' })} disabled={busy}
            className="px-4 py-2 rounded-lg text-xs font-semibold border disabled:opacity-50" style={{ borderColor: 'var(--border)', color: 'var(--blue)' }}>
            Mark in progress
          </button>
        )}
        {reply.trim() !== (m.admin_reply || '') && (
          <button onClick={() => update({})} disabled={busy}
            className="px-4 py-2 rounded-lg text-xs font-semibold border disabled:opacity-50" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
            Save reply only
          </button>
        )}
        <button onClick={remove} className="ml-auto p-2 rounded-lg" style={{ color: 'var(--danger-soft)' }} aria-label="Delete message"><Trash2 size={14} /></button>
      </div>
      {m.status === 'resolved' && m.resolved_at && (
        <p className="text-[11px] mt-2" style={{ color: 'var(--muted)' }}>Resolved {when(m.resolved_at)}{m.resolved_by ? ` by ${m.resolved_by}` : ''}</p>
      )}
    </div>
  )
}

export default function AdminMessagesPage() {
  const [filter, setFilter] = useState<Filter>('open')
  const [messages, setMessages] = useState<Message[]>([])
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/admin/messages?status=${filter}`)
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Could not load messages. Has migration 41 been run?')
      setMessages(data.messages || [])
      setCounts(data.counts || {})
      setError('')
    } catch (e: any) {
      setError(e.message || 'Could not load messages.')
    }
    setLoading(false)
  }, [filter])

  useEffect(() => { setLoading(true); load() }, [load])

  return (
    <div>
      <h1 className="text-2xl font-bold mb-2" style={{ fontFamily: 'inherit', color: 'var(--blue)' }}>Messages</h1>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
        Sent from the “Contact Us” tab of the member dashboard. Resolve a message when it is dealt with; any reply you write appears on the member&apos;s dashboard.
      </p>

      <div className="flex gap-2 flex-wrap mb-4" role="tablist">
        {FILTERS.map(f => {
          const active = filter === f.value
          return (
            <button key={f.value} role="tab" aria-selected={active} onClick={() => setFilter(f.value)}
              className="px-4 py-2 rounded-lg text-xs font-semibold border"
              style={{
                borderColor: active ? 'var(--blue)' : 'var(--border)',
                color: active ? 'var(--blue)' : 'var(--muted)',
                background: active ? 'rgba(var(--blue-rgb), 0.1)' : 'transparent',
              }}>
              {f.label}{counts[f.value] !== undefined ? ` (${counts[f.value]})` : ''}
            </button>
          )
        })}
      </div>

      <div className="rounded-xl border" style={s}>
        {loading ? (
          <p className="p-6 text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
        ) : error ? (
          <p className="p-6 text-sm" style={{ color: 'var(--danger-soft)' }}>{error}</p>
        ) : messages.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: 'var(--muted)' }}>{filter === 'open' ? 'Nothing waiting — inbox is clear.' : 'No messages here.'}</p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--surface-alt)' }}>
            {messages.map(m => <MessageCard key={m.id + m.status + (m.admin_reply || '')} m={m} onChanged={load} />)}
          </div>
        )}
      </div>
    </div>
  )
}
