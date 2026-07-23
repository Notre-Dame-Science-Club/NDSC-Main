'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Calendar, CheckCircle, Clock, Loader2, X } from 'lucide-react'

// Public olympiad listing page. This page is now a thin directory of every
// olympiad in the system — it's deliberately an INDEPENDENT sector from the
// Activity registrations, even though olympiads and activities share the
// same form-graph system under the hood (both render through /register/...
// + FormRunner, both are authored in /admin/form-builder).
//
// What this page does:
//   1. Fetches every olympiad row (not just "standalone" ones; we list all
//      and let each card say whether it's open, closed, scheduled, or
//      inactive).
//   2. For each one, fetches its form graph to know if a graph exists yet
//      (without a graph the new runner can't be mounted). Cards without a
//      graph still appear but their Register button is disabled with an
//      explanation.
//   3. Sorts open cards first, then scheduled / closed / inactive at the
//      bottom so the page always leads with what's actionable.
//
// The Register button navigates to /register/olympiad/<id>, which is the
// public FormRunner page (shared with activities). Anti-cheat (timer +
// no-copy) is handled inside the runner when the graph has
// settings.anti_cheat = 'timer_no_copy', so this page doesn't need to know
// anything about that.

type Olympiad = {
  id: string
  name: string
  description?: string
  cover_image_url?: string
  is_active: boolean
  mode?: string
  exam_type?: 'photo_only' | 'live_only' | 'mixed'
  registration_deadline?: string | null
  exam_date?: string | null
  scheduled_start_at?: string | null
  scheduled_end_at?: string | null
  eligibility?: string
  external_only?: boolean
  theme_bg_color?: string | null
  theme_accent_color?: string | null
  theme_header_logo_url?: string | null
  created_at: string
  timer_minutes?: number
}

type Card = {
  olympiad: Olympiad
  status: 'open' | 'scheduled' | 'closed' | 'inactive'
  reason: string
}

const PROFILE_KEY = 'ndsc_olympiad_profile'
const STORAGE_KEY = 'ndsc_olympiad_reg_id'

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}
function fmtDateTime(d?: string | null) {
  return d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
}

export default function OlympiadListPage() {
  const [olympiads, setOlympiads] = useState<Olympiad[]>([])
  const [loading, setLoading] = useState(true)
  const [resuming, setResuming] = useState(true)
  const [resumeTarget, setResumeTarget] = useState<string | null>(null)

  useEffect(() => {
    // Resume a previous in-progress registration if there is one. We don't
    // have the olympiad id from the saved localStorage key alone, so we
    // route through /olympiad?reg=<id> which the runner / page can resolve.
    try {
      const params = new URLSearchParams(window.location.search)
      const regFromUrl = params.get('reg')
      if (regFromUrl) setResumeTarget(regFromUrl)
      else {
        const saved = localStorage.getItem(STORAGE_KEY)
        if (saved) setResumeTarget(saved)
      }
    } catch { /* ignore */ } finally {
      setResuming(false)
    }

    // Fetch every olympiad (active or not) so the page can show all of
    // them with a status. We don't try to hide inactive olympiads — better
    // to show them greyed-out so the visitor can still see what happened.
    fetch('/api/olympiad?listing=1')
      .then(r => r.json())
      .then((rows: any[]) => {
        if (Array.isArray(rows)) setOlympiads(rows as Olympiad[])
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  // If we're on the page just to resume a saved registration, bounce to
  // the /register/olympiad/... runner with the reg id so it can load the
  // existing registration and jump the user back into the right phase.
  useEffect(() => {
    if (resuming || !resumeTarget) return
    // We need the olympiad id to build the runner URL. The simplest way
    // is to GET /api/olympiad-register?id=<reg> and read olympiad.id from
    // the response. If anything fails, fall through to showing the list.
    fetch(`/api/olympiad-register?id=${encodeURIComponent(resumeTarget)}`)
      .then(r => r.ok ? r.json() : null)
      .then(j => {
        if (j?.olympiad?.id) {
          try { localStorage.setItem(STORAGE_KEY, resumeTarget) } catch { /* ignore */ }
          window.location.href = `/register/olympiad/${j.olympiad.id}?reg=${resumeTarget}`
        }
      })
      .catch(() => { /* stay on the list */ })
  }, [resuming, resumeTarget])

  function getProfile(): { college?: string; hsc_session?: string } {
    try { return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') } catch { return {} }
  }

  function getCard(o: Olympiad): { status: Card['status']; reason: string } {
    if (!o.is_active) return { status: 'inactive', reason: 'Not currently active' }
    const now = Date.now()
    if (o.scheduled_start_at && now < new Date(o.scheduled_start_at).getTime()) {
      return { status: 'scheduled', reason: `Opens ${fmtDateTime(o.scheduled_start_at)}` }
    }
    if (o.registration_deadline && now > new Date(o.registration_deadline).getTime()) {
      return { status: 'closed', reason: `Registration closed ${fmtDate(o.registration_deadline)}` }
    }
    if (o.scheduled_end_at && now > new Date(o.scheduled_end_at).getTime()) {
      return { status: 'closed', reason: 'Exam window has ended' }
    }
    if (!o.scheduled_end_at && o.exam_date) {
      const end = new Date(o.exam_date); end.setHours(23, 59, 59, 999)
      if (now > end.getTime()) return { status: 'closed', reason: `Exam was on ${fmtDate(o.exam_date)}` }
    }
    if (o.external_only === false) {
      const p = getProfile()
      if (p.college && p.college.trim().toLowerCase() !== 'notre dame college') {
        return { status: 'closed', reason: 'Open to Notre Dame College students only' }
      }
    }
    return { status: 'open', reason: '' }
  }

  const cards: Card[] = olympiads.map(o => {
    const c = getCard(o)
    return { olympiad: o, status: c.status, reason: c.reason }
  })
  const order: Record<Card['status'], number> = { open: 0, scheduled: 1, closed: 2, inactive: 3 }
  cards.sort((a, b) => order[a.status] - order[b.status])

  const accent = 'var(--blue)'
  const bg = 'var(--bg1, var(--surface-deep))'

  if (loading || resuming) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: bg }}>
        <div className="flex items-center gap-2" style={{ color: 'var(--muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Loading olympiads…
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen py-16 px-4" style={{ background: bg }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-3" style={{ fontFamily: 'Orbitron, monospace', color: accent }}>
            NDSC Olympiads
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Take part in NDSC science olympiads, test your knowledge, and win prizes.
          </p>
        </div>

        {cards.length === 0 && (
          <p className="text-center py-12" style={{ color: 'var(--border-soft)' }}>
            No olympiads open right now. Check back soon.
          </p>
        )}

        <div className="space-y-4">
          {cards.map(c => (
            <OlympiadCard key={c.olympiad.id} card={c} />
          ))}
        </div>

        <p className="text-center text-xs mt-10" style={{ color: 'var(--border-soft)' }}>
          Olympiads and activities are independent — each olympiad has its own form, set up in the form builder.
        </p>
      </div>
    </div>
  )
}

function OlympiadCard({ card }: { card: Card }) {
  const { olympiad: o, status, reason } = card
  const isOpen = status === 'open'
  const isScheduled = status === 'scheduled'
  const isGreyed = !isOpen

  const accent = o.theme_accent_color || 'var(--blue)'
  const cardStyle: React.CSSProperties = {
    background: 'var(--surface-deep)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    borderLeft: o.theme_accent_color ? `3px solid ${o.theme_accent_color}` : '1px solid var(--border)',
    opacity: isGreyed ? 0.7 : 1,
    filter: status === 'inactive' ? 'grayscale(0.5)' : undefined,
  }
  const ctaStyle: React.CSSProperties = isOpen
    ? { background: accent, color: '#fff' }
    : { background: 'var(--surface-alt)', color: 'var(--border-soft)', border: '1px solid var(--border)' }

  // Status badge
  let badge: { text: string; color: string; bg: string; icon?: any } | null = null
  if (status === 'open') badge = { text: 'Open', color: 'var(--cat-teal)', bg: 'rgba(var(--cat-teal-rgb), 0.12)', icon: CheckCircle }
  else if (status === 'scheduled') badge = { text: 'Scheduled', color: 'var(--blue)', bg: 'rgba(var(--blue-rgb), 0.12)', icon: Clock }
  else if (status === 'closed') badge = { text: 'Closed', color: 'var(--danger-soft)', bg: 'rgba(var(--danger-rgb), 0.12)', icon: X }
  else if (status === 'inactive') badge = { text: 'Inactive', color: 'var(--muted)', bg: 'rgba(255,255,255,0.04)' }

  return (
    <div className="flex gap-5 p-5" style={cardStyle}>
      {(o.theme_header_logo_url || o.cover_image_url) && (
        <img src={o.theme_header_logo_url || o.cover_image_url} alt="" className="w-24 h-24 rounded-xl object-cover flex-shrink-0" />
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h2 className="font-bold text-lg" style={{ color: 'var(--white-soft)' }}>{o.name}</h2>
          {badge && (
            <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1"
              style={{ background: badge.bg, color: badge.color }}>
              {badge.icon && <badge.icon size={10} />}
              {badge.text}
            </span>
          )}
        </div>
        {o.description && <p className="text-sm" style={{ color: 'var(--muted)' }}>{o.description}</p>}
        <div className="flex items-center gap-3 text-xs mt-2 flex-wrap" style={{ color: 'var(--border-soft)' }}>
          {o.exam_type && o.exam_type !== 'live_only' && <span>Online questions</span>}
          {o.exam_type === 'live_only' && <span>Written exam</span>}
          {o.timer_minutes && <span>· {o.timer_minutes} min</span>}
          {o.exam_date && <span className="inline-flex items-center gap-1"><Calendar size={11} /> {fmtDate(o.exam_date)}</span>}
          {o.registration_deadline && isOpen && (
            <span>· Register by {fmtDate(o.registration_deadline)}</span>
          )}
        </div>
        {reason && <p className="text-xs mt-1" style={{ color: isOpen ? 'var(--muted)' : 'var(--danger-soft)' }}>{reason}</p>}
        {o.eligibility && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{o.eligibility}</p>}
      </div>
      {isOpen ? (
        <Link
          href={`/register/olympiad/${o.id}`}
          className="self-center px-5 py-2.5 rounded-xl text-sm font-bold flex-shrink-0 inline-flex items-center gap-1.5"
          style={ctaStyle}>
          Register <ArrowRight size={14} />
        </Link>
      ) : (
        <button disabled
          className="self-center px-5 py-2.5 rounded-xl text-sm font-bold flex-shrink-0 cursor-not-allowed"
          style={ctaStyle}>
          {isScheduled ? 'Not yet' : 'Unavailable'}
        </button>
      )}
    </div>
  )
}
