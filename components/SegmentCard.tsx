'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CalendarDays, MapPin, Users, CreditCard, Link2, ChevronRight, CheckCircle2, Loader2 } from 'lucide-react'
import { normalizeUploadUrl } from '@/lib/uploadUrl'
import { ActivityIcon } from '@/lib/activityIcons'

// One segment card on the public event page. Shows the segment name, optional
// icon / background image, description, schedule meta, badges for team/payment/
// online, and a Register button at the bottom-right (per requirement 5).
//
// Tracks per-segment enrollment state via localStorage so the button shows
// "Open dashboard" if the user has already registered in this segment, and
// "Register for this one" if they're already enrolled in a *different* segment
// of the same event (multi-enrollment is allowed).
type Segment = {
  id: string
  name: string
  description: string | null
  icon: string | null
  bg_image_url: string | null
  is_segment?: boolean
  schedule_date: string | null
  schedule_time: string | null
  schedule_room: string | null
  requires_team: boolean
  requires_payment: boolean
  payment_amount: number | null
  payment_label: string | null
  is_online_submission: boolean
}

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'

export default function SegmentCard({
  segment, slug, sessionId,
}: {
  segment: Segment
  slug: string
  sessionId: string
}) {
  const [enrolledSegmentId, setEnrolledSegmentId] = useState<string | null | undefined>(undefined)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // Per-session key (e.g. ndsc_seg_<sessionId>) is a JSON-encoded object:
    // { [segmentId]: registrationId }. The legacy flat key
    // ndsc_reg_<sessionId> is also read so cards still work for events
    // registered before this redesign.
    try {
      const raw = localStorage.getItem(`ndsc_seg_${sessionId}`)
      if (raw) {
        const parsed = JSON.parse(raw)
        if (parsed && typeof parsed === 'object') {
          const found = Object.entries(parsed).find(([, v]) => v) as [string, string] | undefined
          setEnrolledSegmentId(found ? found[0] : null)
          setChecked(true)
          return
        }
      }
    } catch { /* ignore */ }
    // Legacy flat key fallback — for events registered before the per-segment
    // tracking was introduced. Treat as enrolled in *this* card if any
    // registration exists for the session.
    if (localStorage.getItem(`ndsc_reg_${sessionId}`) || localStorage.getItem('ndsc_activity_reg_id')) {
      setEnrolledSegmentId('__legacy__')
    } else {
      setEnrolledSegmentId(null)
    }
    setChecked(true)
  }, [sessionId])

  const isEnrolledInThis = checked && (enrolledSegmentId === segment.id || (enrolledSegmentId === '__legacy__' && segment.id === '__legacy__'))
  const isEnrolledInAnother = checked && enrolledSegmentId != null && enrolledSegmentId !== segment.id && enrolledSegmentId !== '__legacy__'

  const bg = segment.bg_image_url ? normalizeUploadUrl(segment.bg_image_url) : null

  // CTA copy
  const ctaLabel = isEnrolledInThis
    ? 'Open dashboard'
    : isEnrolledInAnother
    ? 'Register for this segment'
    : 'Register Now'
  const ctaHref = isEnrolledInThis
    ? `/activities/${slug}/dashboard`
    : `/activities/${slug}/register?segment=${segment.id}`

  return (
    <div className="relative rounded-2xl border overflow-hidden" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
      {bg && (
        <div className="absolute inset-0 pointer-events-none" style={{ backgroundImage: `url(${bg})`, backgroundSize: 'cover', backgroundPosition: 'center', opacity: 0.18 }} />
      )}
      <div className="relative p-5 min-h-[160px] flex flex-col">
        {/* Top row: icon + name + badges */}
        <div className="flex items-start gap-3 mb-2">
          {segment.icon ? (
            <div className="shrink-0 p-2 rounded-lg" style={{ background: 'rgba(var(--blue-rgb), 0.1)' }}>
              {isLikelyEmoji(segment.icon)
                ? <span className="text-2xl leading-none">{segment.icon}</span>
                : <ActivityIcon icon={segment.icon} size={22} />}
            </div>
          ) : null}
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-bold" style={{ color: 'var(--white)' }}>{segment.name}</h3>
            {segment.description && (
              <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--muted)' }}>{segment.description}</p>
            )}
          </div>
        </div>

        {/* Schedule meta */}
        {(segment.schedule_date || segment.schedule_time || segment.schedule_room) && (
          <div className="flex flex-wrap gap-3 text-xs mt-2" style={{ color: 'var(--muted)' }}>
            {segment.schedule_date && (
              <span className="inline-flex items-center gap-1">
                <CalendarDays size={12} />
                {new Date(segment.schedule_date).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })}
              </span>
            )}
            {segment.schedule_time && <span>{segment.schedule_time}</span>}
            {segment.schedule_room && <span className="inline-flex items-center gap-1"><MapPin size={12} /> {segment.schedule_room}</span>}
          </div>
        )}

        {/* Badges */}
        <div className="flex flex-wrap gap-1.5 mt-3">
          {segment.requires_team && (
            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: 'rgba(var(--accent2-rgb), 0.12)', color: 'var(--accent2)' }}>Team</span>
          )}
          {segment.requires_payment && (
            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: 'rgba(var(--warning-rgb), 0.12)', color: 'var(--warning)' }}>৳{segment.payment_amount}</span>
          )}
          {segment.is_online_submission && (
            <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full" style={{ background: 'rgba(var(--blue-rgb), 0.12)', color: 'var(--blue)' }}>Online round</span>
          )}
        </div>

        {/* Spacer pushes the CTA to the bottom */}
        <div className="flex-1" />

        {/* CTA — bottom-right per requirement 5 */}
        <div className="flex justify-end mt-4">
          <Link
            href={ctaHref}
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:-translate-y-0.5"
            style={
              isEnrolledInThis
                ? { background: 'rgba(var(--blue-rgb), 0.15)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.4)', fontFamily: "'Orbitron', sans-serif" }
                : isEnrolledInAnother
                ? { background: 'rgba(var(--cat-teal-rgb), 0.12)', color: 'var(--cat-teal)', border: '1px solid rgba(var(--cat-teal-rgb), 0.4)', fontFamily: "'Orbitron', sans-serif" }
                : { background: 'var(--blue)', color: '#000', fontFamily: "'Orbitron', sans-serif" }
            }
          >
            {isEnrolledInThis && <CheckCircle2 size={14} />}
            {ctaLabel} {!isEnrolledInThis && <ChevronRight size={14} />}
          </Link>
        </div>
      </div>
    </div>
  )
}

function isLikelyEmoji(s: string) {
  // Heuristic: contains a non-ASCII character (likely emoji) or starts with
  // a multi-byte codepoint. Lucide icon names are pure ASCII lowercase.
  return /[^\x00-\x7F]/.test(s) || s.length <= 2
}
