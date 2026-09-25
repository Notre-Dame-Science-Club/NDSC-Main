'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowRight, Calendar, CheckCircle, Clock, Loader2, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { isNDCStudent } from '@/types/database'

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
  scheduled_start_at?: string | null
  scheduled_end_at?: string | null
  eligibility?: string
  external_only?: boolean
  theme_bg_color?: string | null
  theme_accent_color?: string | null
  theme_header_logo_url?: string | null
  created_at: string
  timer_minutes?: number
  // Purely informational link to a parent Activity (not a precise leaf-level
  // link like activity_reg_categories.linked_olympiad_id or form_nodes
  // behavior.linked_olympiad_id). When set, this olympiad card routes to the
  // parent activity's main registration page (/activities/[slug]/register)
  // without deep-linking to a specific segment — the user picks their segment
  // there. This field is for "billboard" olympiad entries that say "this round
  // is part of Activity X" without the granular v1/v2 linking infrastructure.
  parent_activity_session_id?: string | null
}

type Card = {
  olympiad: Olympiad
  status: 'open' | 'scheduled' | 'closed' | 'inactive'
  reason: string
}

// A round that's really a segment of an Activity event (linked via
// activity_reg_categories/form_nodes) — see /api/activity-online-categories-public.
// These never get their own standalone Register button: registering for
// one of these through /register/olympiad/<id> would create a second,
// disconnected registration on top of whatever the person already has (or
// will fill out) for the parent Activity. Instead they route straight into
// that Activity's own registration flow.
//
// IMPORTANT: category_id is LEAF-accurate (not top-level), pointing to the
// specific segment within the activity's registration tree. For v1 leaves
// this is an activity_reg_categories.id, for v2 it's a form_nodes.id.
type ActivityCard = {
  category_id: string
  name: string
  description?: string
  session_id: string
  session_slug?: string
  session_title?: string
  cover_image_url?: string | null
  is_v2: boolean
}

const STORAGE_KEY = 'ndsc_olympiad_reg_id'

function fmtDate(d?: string | null) {
  return d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''
}
function fmtDateTime(d?: string | null) {
  return d ? new Date(d).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : ''
}

export default function OlympiadListPage() {
  const [olympiads, setOlympiads] = useState<Olympiad[]>([])
  const [activityCards, setActivityCards] = useState<ActivityCard[]>([])
  const [loading, setLoading] = useState(true)
  const [resuming, setResuming] = useState(true)
  const [resumeTarget, setResumeTarget] = useState<string | null>(null)
  // Map of activity session IDs to their slug/title for parent activity linking
  const [activitySessions, setActivitySessions] = useState<Record<string, { slug: string; title: string }>>({})
  // The logged-in visitor's own member record (just the one field we need),
  // used to tell NDC-only olympiad cards apart from ones an external-college
  // visitor genuinely can't take. `undefined` = still checking, `null` =
  // not logged in (or no member row) — in both of those cases we don't
  // block: their college gets collected/reviewed on the actual
  // registration form, which is where real enforcement belongs. We only
  // ever show "closed" here when we positively know, from their account,
  // that they're not a Notre Dame College student.
  const [member, setMember] = useState<{ institution?: string | null } | null | undefined>(undefined)

  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled) return
      const uid = data.user?.id
      if (!uid) { setMember(null); return }
      const { data: m } = await supabase.from('members').select('institution').eq('id', uid).maybeSingle()
      if (!cancelled) setMember(m || null)
    }).catch(() => { if (!cancelled) setMember(null) })
    return () => { cancelled = true }
  }, [])

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
        if (Array.isArray(rows)) {
          setOlympiads(rows as Olympiad[])
          // Collect unique parent activity session IDs to fetch their details
          const parentIds = [...new Set(rows.filter(o => o.parent_activity_session_id).map(o => o.parent_activity_session_id))]
          if (parentIds.length > 0) {
            fetch('/api/admin/activity-sessions')
              .then(r => r.json())
              .then((sessions: any[]) => {
                if (Array.isArray(sessions)) {
                  const map: Record<string, { slug: string; title: string }> = {}
                  sessions.forEach(s => {
                    map[s.id] = { slug: s.slug, title: s.title }
                  })
                  setActivitySessions(map)
                }
              })
              .catch(() => {})
          }
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))

    // Rounds that belong to an Activity event — shown alongside the
    // standalone olympiads, but they link into the Activity's own
    // registration flow instead of a separate form.
    fetch('/api/activity-online-categories-public')
      .then(r => r.json())
      .then((rows: any[]) => {
        if (Array.isArray(rows)) setActivityCards(rows as ActivityCard[])
      })
      .catch(() => {})
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
    if (o.external_only === false && member && !isNDCStudent(member)) {
      return { status: 'closed', reason: 'Open to Notre Dame College students only' }
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
          <h1 className="text-3xl font-bold mb-3" style={{ fontFamily: 'inherit', color: accent }}>
            NDSC Olympiads
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            Take part in NDSC science olympiads, test your knowledge, and win prizes.
          </p>
        </div>

        {cards.length === 0 && activityCards.length === 0 && (
          <p className="text-center py-12" style={{ color: 'var(--border-soft)' }}>
            No olympiads open right now. Check back soon.
          </p>
        )}

        <div className="space-y-4">
          {activityCards.map(c => (
            <ActivityOlympiadCard key={c.category_id} card={c} />
          ))}
          {cards.map(c => (
            <OlympiadCard key={c.olympiad.id} card={c} activitySessions={activitySessions} />
          ))}
        </div>

        <p className="text-center text-xs mt-10" style={{ color: 'var(--border-soft)' }}>
          Some rounds are a segment of an Activity event — those register through that event's own form so your info is only entered once.
        </p>
      </div>
    </div>
  )
}

function ActivityOlympiadCard({ card }: { card: ActivityCard }) {
  const accent = 'var(--cat-teal)'
  const cardStyle: React.CSSProperties = {
    background: 'var(--surface-deep)',
    border: '1px solid var(--border)',
    borderRadius: 16,
    borderLeft: `3px solid ${accent}`,
  }
  return (
    <div className="flex gap-5 p-5" style={cardStyle}>
      {card.cover_image_url && (
        <img src={card.cover_image_url} alt="" className="w-24 h-24 rounded-xl object-cover flex-shrink-0" />
      )}
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <h2 className="font-bold text-lg" style={{ color: 'var(--white-soft)' }}>{card.name}</h2>
          <span className="text-[10px] font-bold tracking-wider px-2 py-0.5 rounded-full inline-flex items-center gap-1"
            style={{ background: 'rgba(var(--cat-teal-rgb), 0.12)', color: accent }}>
            Part of {card.session_title}
          </span>
        </div>
        {card.description && <p className="text-sm" style={{ color: 'var(--muted)' }}>{card.description}</p>}
        <p className="text-xs mt-1" style={{ color: 'var(--border-soft)' }}>
          Register through the {card.session_title} event — your info carries over, no separate form.
        </p>
      </div>
      {card.session_slug ? (
        <Link
          href={`/register/activity/${card.session_id}`}
          className="self-center px-5 py-2.5 rounded-xl text-sm font-bold flex-shrink-0 inline-flex items-center gap-1.5"
          style={{ background: accent, color: '#000' }}>
          Register via Activity <ArrowRight size={14} />
        </Link>
      ) : null}
    </div>
  )
}

function OlympiadCard({ card, activitySessions }: { card: Card; activitySessions: Record<string, { slug: string; title: string }> }) {
  const { olympiad: o, status, reason } = card
  const isOpen = status === 'open'
  const isScheduled = status === 'scheduled'
  const isGreyed = !isOpen
  const parentActivity = o.parent_activity_session_id ? activitySessions[o.parent_activity_session_id] : null

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
          {o.scheduled_start_at && <span className="inline-flex items-center gap-1"><Calendar size={11} /> {fmtDate(o.scheduled_start_at)}</span>}
          {o.registration_deadline && isOpen && (
            <span>· Register by {fmtDate(o.registration_deadline)}</span>
          )}
        </div>
        {reason && <p className="text-xs mt-1" style={{ color: isOpen ? 'var(--muted)' : 'var(--danger-soft)' }}>{reason}</p>}
        {o.eligibility && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{o.eligibility}</p>}
        {parentActivity && (
          <p className="text-xs mt-2 inline-flex items-center gap-1" style={{ color: 'var(--cat-teal)' }}>
            <ArrowRight size={11} /> Register through {parentActivity.title}
          </p>
        )}
      </div>
      {isOpen ? (
        parentActivity ? (
          <Link
            href={`/activities/${parentActivity.slug}/register`}
            className="self-center px-5 py-2.5 rounded-xl text-sm font-bold flex-shrink-0 inline-flex items-center gap-1.5"
            style={ctaStyle}>
            Register for {parentActivity.title} <ArrowRight size={14} />
          </Link>
        ) : (
          <Link
            href={`/register/olympiad/${o.id}`}
            className="self-center px-5 py-2.5 rounded-xl text-sm font-bold flex-shrink-0 inline-flex items-center gap-1.5"
            style={ctaStyle}>
            Register <ArrowRight size={14} />
          </Link>
        )
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
