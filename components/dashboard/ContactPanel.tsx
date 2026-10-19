'use client'
import { useEffect, useState } from 'react'
import { CheckCircle, Loader2, Send } from 'lucide-react'
import { segmentAuthHeaders } from '@/lib/clientAuthHeaders'
import {
  MESSAGE_CATEGORIES, NOTICE_LIMITS, categoryLabel, statusLabel,
  type MessageCategory, type MessageStatus,
} from '@/lib/notices'

type SentMessage = {
  id: string
  category: MessageCategory
  subject: string | null
  message: string
  status: MessageStatus
  admin_reply: string | null
  created_at: string
  resolved_at: string | null
}

const STATUS_STYLE: Record<MessageStatus, { color: string; rgb: string }> = {
  open: { color: 'var(--warning)', rgb: 'var(--warning-rgb)' },
  in_progress: { color: 'var(--blue)', rgb: 'var(--blue-rgb)' },
  resolved: { color: 'var(--success)', rgb: 'var(--success-rgb)' },
}

const input = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'
const inputStyle = { background: 'rgba(255,255,255,0.04)', borderColor: 'var(--border)', color: 'var(--white)' }
const card = { background: 'var(--bg2)', border: '1px solid var(--border)' }

/**
 * The dashboard's message box: tell NDSC about a professional obligation, report a problem,
 * or just say something. Admins see these in /admin/messages and resolve them; the member can
 * follow the status (and read our reply) in "Your messages" below the form.
 */
export default function ContactPanel() {
  const [category, setCategory] = useState<MessageCategory>('other')
  const [subject, setSubject] = useState('')
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [sent, setSent] = useState(false)
  const [history, setHistory] = useState<SentMessage[]>([])
  const [historyLoading, setHistoryLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/member-messages', { headers: await segmentAuthHeaders() })
        if (res.ok && !cancelled) {
          const data = await res.json()
          setHistory(Array.isArray(data.messages) ? data.messages : [])
        }
      } catch { /* history is a convenience; the form still works without it */ }
      if (!cancelled) setHistoryLoading(false)
    })()
    return () => { cancelled = true }
  }, [])

  const send = async () => {
    if (!message.trim()) { setError('Please write your message.'); return }
    setSending(true)
    setError('')
    setSent(false)
    try {
      const res = await fetch('/api/member-messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await segmentAuthHeaders()) },
        body: JSON.stringify({ category, subject: subject.trim(), message: message.trim() }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not send your message. Please try again.')
      setHistory(prev => [data.message, ...prev])
      setSubject('')
      setMessage('')
      setSent(true)
    } catch (e: any) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setSending(false)
    }
  }

  const when = (iso: string) =>
    new Date(iso).toLocaleString('en-BD', { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })

  const hint = MESSAGE_CATEGORIES.find(c => c.value === category)?.hint

  return (
    <div className="space-y-4">
      <div className="rounded-xl p-6" style={card}>
        <h3 className="font-semibold text-sm mb-1 flex items-center gap-2" style={{ color: 'var(--muted)', fontFamily: 'inherit' }}>
          <Send size={15} /> Message NDSC
        </h3>
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          Let us know about a professional obligation, report a problem, or tell us anything else. Our team reads every message.
        </p>

        <fieldset className="mb-3">
          <legend className="text-xs mb-2" style={{ color: 'var(--muted)' }}>What is it about?</legend>
          <div className="flex gap-2 flex-wrap">
            {MESSAGE_CATEGORIES.map(c => {
              const active = category === c.value
              return (
                <label
                  key={c.value}
                  className="px-3.5 py-2 rounded-lg text-xs font-semibold border cursor-pointer select-none"
                  style={{
                    borderColor: active ? 'var(--blue)' : 'var(--border)',
                    color: active ? 'var(--blue)' : 'var(--muted)',
                    background: active ? 'rgba(var(--blue-rgb), 0.1)' : 'transparent',
                  }}
                >
                  <input
                    type="radio"
                    name="message-category"
                    value={c.value}
                    checked={active}
                    onChange={() => setCategory(c.value)}
                    className="sr-only"
                  />
                  {c.label}
                </label>
              )
            })}
          </div>
          {hint && <p className="text-[11px] mt-2" style={{ color: 'var(--muted)' }}>{hint}</p>}
        </fieldset>

        <div className="space-y-2">
          <input
            value={subject}
            onChange={e => setSubject(e.target.value)}
            maxLength={NOTICE_LIMITS.subject}
            placeholder="Subject (optional)"
            aria-label="Subject"
            className={input}
            style={inputStyle}
          />
          <textarea
            rows={5}
            value={message}
            onChange={e => { setMessage(e.target.value); if (error) setError('') }}
            maxLength={NOTICE_LIMITS.message}
            placeholder="Write your message…"
            aria-label="Message"
            className={input + ' resize-y'}
            style={inputStyle}
          />
          <p className="text-[11px] text-right" style={{ color: 'var(--muted)' }}>{message.length}/{NOTICE_LIMITS.message}</p>
        </div>

        {error && <p role="alert" className="text-xs mt-1" style={{ color: 'var(--danger-soft)' }}>{error}</p>}
        {sent && !error && (
          <p role="status" className="text-xs mt-1 flex items-center gap-1.5" style={{ color: 'var(--success)' }}>
            <CheckCircle size={13} /> Sent. We will look into it and reply here.
          </p>
        )}

        <button
          onClick={send}
          disabled={sending || !message.trim()}
          className="mt-3 w-full sm:w-auto px-6 py-2.5 rounded-lg text-sm font-bold text-black disabled:opacity-50 flex items-center justify-center gap-2"
          style={{ background: 'var(--blue)' }}
        >
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {sending ? 'Sending…' : 'Send message'}
        </button>
      </div>

      <div className="rounded-xl p-6" style={card}>
        <h3 className="font-semibold text-sm mb-4" style={{ color: 'var(--muted)', fontFamily: 'inherit' }}>Your messages</h3>
        {historyLoading ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
        ) : history.length === 0 ? (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>You have not sent any messages yet.</p>
        ) : (
          <div className="space-y-3">
            {history.map(m => {
              const st = STATUS_STYLE[m.status] || STATUS_STYLE.open
              return (
                <div key={m.id} className="rounded-lg p-4" style={{ background: 'var(--bg)', border: '1px solid var(--border)' }}>
                  <div className="flex items-center justify-between gap-2 flex-wrap mb-1.5">
                    <span className="text-xs font-semibold" style={{ color: 'var(--white)' }}>{categoryLabel(m.category)}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                      style={{ background: `rgba(${st.rgb}, 0.12)`, color: st.color, border: `1px solid rgba(${st.rgb}, 0.35)` }}>
                      {statusLabel(m.status)}
                    </span>
                  </div>
                  {m.subject && <p className="text-sm font-medium mb-1 break-words" style={{ color: 'var(--white)' }}>{m.subject}</p>}
                  <p className="text-sm whitespace-pre-line break-words" style={{ color: 'var(--muted)' }}>{m.message}</p>
                  <p className="text-[11px] mt-2" style={{ color: 'var(--muted)' }}>{when(m.created_at)}</p>
                  {m.admin_reply && (
                    <div className="mt-3 rounded-lg p-3" style={{ background: 'rgba(var(--blue-rgb), 0.07)', border: '1px solid rgba(var(--blue-rgb), 0.25)' }}>
                      <p className="text-[11px] font-bold mb-1" style={{ color: 'var(--blue)' }}>Reply from NDSC</p>
                      <p className="text-sm whitespace-pre-line break-words" style={{ color: 'var(--white)' }}>{m.admin_reply}</p>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
