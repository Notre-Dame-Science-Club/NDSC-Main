'use client'
import { useEffect, useState } from 'react'
import { AlertTriangle, CheckCircle, ExternalLink, IdCard, Info, MessageCircle, X } from 'lucide-react'
import { segmentAuthHeaders } from '@/lib/clientAuthHeaders'
import { needsCollegeRoll } from '@/lib/college'
import { defaultLinkLabel, isWhatsAppLink, safeHttpUrl, type NoticeTone } from '@/lib/notices'
import CollegeRollField from './CollegeRollField'

type Notice = {
  id: string
  title: string
  body: string | null
  link_url: string | null
  link_label: string | null
  tone: NoticeTone
  dismissible: boolean
}

const TONE: Record<NoticeTone, { icon: typeof Info; color: string; rgb: string }> = {
  info: { icon: Info, color: 'var(--blue)', rgb: 'var(--blue-rgb)' },
  important: { icon: AlertTriangle, color: 'var(--warning)', rgb: 'var(--warning-rgb)' },
  success: { icon: CheckCircle, color: 'var(--success)', rgb: 'var(--success-rgb)' },
}

/**
 * What the member should see the moment they open their dashboard, above the tabs:
 *
 *  1. If they are a Notre Dame College student with no college roll yet → a prompt to add it
 *     (the roll is the one thing that identifies an NDC student uniquely). It cannot be
 *     dismissed; it disappears when the roll is saved.
 *  2. Notices an admin aimed at their college / batch (e.g. "Batch 28: join your WhatsApp
 *     group" with a link). Matching happens on the server; dismissals are stored on the
 *     account so a closed notice stays closed on every device.
 */
export default function DashboardNotices({
  member,
  onMemberChange,
}: {
  member: any
  /** Merge saved profile fields (here: college_roll) back into the dashboard's member state. */
  onMemberChange: (patch: Record<string, unknown>) => void
}) {
  const [notices, setNotices] = useState<Notice[]>([])
  const memberId: string | undefined = member?.id

  useEffect(() => {
    if (!memberId) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/member-notices', { headers: await segmentAuthHeaders() })
        if (!res.ok || cancelled) return
        const data = await res.json()
        if (!cancelled) setNotices(Array.isArray(data.notices) ? data.notices : [])
      } catch { /* a failed notice check must never get in the way of the dashboard */ }
    })()
    return () => { cancelled = true }
  }, [memberId])

  const dismiss = async (id: string) => {
    setNotices(prev => prev.filter(n => n.id !== id))   // optimistic: close it immediately
    try {
      await fetch('/api/member-notices', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(await segmentAuthHeaders()) },
        body: JSON.stringify({ notice_id: id }),
      })
    } catch { /* worst case it shows again next visit */ }
  }

  const askForRoll = needsCollegeRoll(member)
  if (!askForRoll && notices.length === 0) return null

  return (
    <div className="space-y-3 mb-5" role="region" aria-label="Notices">
      {askForRoll && (
        <div
          className="rounded-xl p-4 border"
          style={{ background: 'rgba(var(--warning-rgb), 0.08)', borderColor: 'rgba(var(--warning-rgb), 0.4)' }}
        >
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: 'rgba(var(--warning-rgb), 0.15)', color: 'var(--warning)' }}>
              <IdCard size={17} />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold" style={{ color: 'var(--warning)' }}>Add your college roll</p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Your roll number is how NDSC identifies you — every Notre Dame College roll is unique. It only takes a few seconds.
              </p>
            </div>
          </div>
          <div className="mt-3">
            <CollegeRollField
              institution={member?.institution}
              saveLabel="Save roll"
              onSaved={roll => onMemberChange({ college_roll: roll })}
            />
          </div>
        </div>
      )}

      {notices.map(n => {
        const tone = TONE[n.tone] || TONE.info
        const link = safeHttpUrl(n.link_url)   // re-checked here: never put an unvetted URL in an href
        const Icon = link && isWhatsAppLink(link) ? MessageCircle : tone.icon
        return (
          <div
            key={n.id}
            className="rounded-xl p-4 border"
            style={{ background: `rgba(${tone.rgb}, 0.07)`, borderColor: `rgba(${tone.rgb}, 0.35)` }}
          >
            <div className="flex items-start gap-3">
              <div className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: `rgba(${tone.rgb}, 0.15)`, color: tone.color }}>
                <Icon size={17} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold break-words" style={{ color: 'var(--white)' }}>{n.title}</p>
                {n.body && (
                  <p className="text-xs mt-1 whitespace-pre-line break-words" style={{ color: 'var(--muted)' }}>{n.body}</p>
                )}
                {link && (
                  <a
                    href={link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 mt-3 px-4 py-2 rounded-lg text-xs font-bold text-black"
                    style={{ background: tone.color }}
                  >
                    {n.link_label || defaultLinkLabel(link)} <ExternalLink size={12} />
                  </a>
                )}
              </div>
              {n.dismissible && (
                <button
                  onClick={() => dismiss(n.id)}
                  className="flex-shrink-0 opacity-60 hover:opacity-100"
                  style={{ color: 'var(--muted)' }}
                  aria-label={`Dismiss: ${n.title}`}
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
