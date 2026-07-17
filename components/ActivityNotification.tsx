'use client'
import { useEffect, useState } from 'react'
import { usePathname } from 'next/navigation'
import Link from 'next/link'
import { X, CalendarDays, ArrowRight } from 'lucide-react'

type ActiveActivity = {
  id: string
  title: string
  slug: string
  description?: string
  cover_image_url?: string
  session_date?: string
  event_dates: string[]
  location?: string
  registration_enabled?: boolean
  registration_note?: string
  reg_status?: string
  reg_deadline?: string
  type_name?: string | null
}

const DISMISSED_KEY = 'ndsc-activity-notif-dismissed'

function readIdSet(key: string): Set<string> {
  try {
    const raw = localStorage.getItem(key)
    return new Set(raw ? JSON.parse(raw) : [])
  } catch {
    return new Set()
  }
}
function addToIdSet(key: string, id: string) {
  try {
    const set = readIdSet(key)
    set.add(id)
    localStorage.setItem(key, JSON.stringify(Array.from(set)))
  } catch { /* localStorage unavailable — non-critical, just means it may re-prompt */ }
}

function formatWhen(a: ActiveActivity): string {
  const dates = a.event_dates && a.event_dates.length > 0 ? a.event_dates : (a.session_date ? [a.session_date] : [])
  if (dates.length === 0) return ''
  const fmt = (d: string) => new Date(d).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })
  if (dates.length === 1) return fmt(dates[0])
  const sorted = [...dates].sort()
  return `${fmt(sorted[0])} – ${fmt(sorted[sorted.length - 1])}`
}

/**
 * Mounted once in the root layout, next to SurveyNotification. Both sit in
 * the bottom-right corner — this one stacked above the survey card (higher
 * `bottom` offset) so if both are active on the same visit they don't
 * overlap; this is a separate, lower-stakes "here's something new" prompt
 * rather than a form that needs a response, so it doesn't need to take
 * priority over the survey one.
 */
export default function ActivityNotification() {
  const pathname = usePathname()
  const [activity, setActivity] = useState<ActiveActivity | null>(null)
  const [visible, setVisible] = useState(false)

  const onAdminRoute = pathname?.startsWith('/admin')

  useEffect(() => {
    if (onAdminRoute) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/activity-notify-active')
        if (!res.ok || cancelled) return
        const activities: ActiveActivity[] = await res.json()

        const dismissed = readIdSet(DISMISSED_KEY)
        const next = activities.find(a => !dismissed.has(a.id))
        if (next && !cancelled) {
          setActivity(next)
          // Slightly later than the survey popup's 900ms so if both fire on
          // the same visit they don't slide in at the exact same instant.
          setTimeout(() => setVisible(true), 1300)
        }
      } catch { /* silent — a failed notification check shouldn't disrupt browsing */ }
    })()
    return () => { cancelled = true }
  }, [onAdminRoute])

  const dismiss = () => {
    if (activity) addToIdSet(DISMISSED_KEY, activity.id)
    setVisible(false)
    setTimeout(() => setActivity(null), 300)
  }

  if (!activity) return null

  const when = formatWhen(activity)

  return (
    <div
      className="fixed z-[65] left-4 right-4 bottom-52 sm:left-auto sm:right-6 sm:bottom-52 sm:w-96 transition-all duration-300 ease-out"
      style={{
        transform: visible ? 'translateY(0)' : 'translateY(24px)',
        opacity: visible ? 1 : 0,
        pointerEvents: visible ? 'auto' : 'none',
      }}
    >
      <div
        className="rounded-2xl border overflow-hidden shadow-2xl backdrop-blur-xl"
        style={{ background: 'rgba(10, 22, 40, 0.92)', borderColor: 'var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.45), 0 0 0 1px rgba(0,212,255,0.08)' }}
      >
        {activity.cover_image_url && (
          <div className="relative">
            <img src={activity.cover_image_url} alt={activity.title} className="w-full h-28 object-cover" />
            <button onClick={dismiss} aria-label="Dismiss"
              className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center"
              style={{ background: 'rgba(2,8,16,0.65)', color: 'var(--white)' }}>
              <X size={13} />
            </button>
          </div>
        )}
        <div className="p-4">
          <div className="flex items-start gap-3">
            <div className="flex-1 min-w-0">
              {activity.type_name && (
                <p className="text-[10px] font-bold uppercase tracking-wide mb-0.5" style={{ color: 'var(--blue)' }}>{activity.type_name}</p>
              )}
              <p className="font-bold text-sm" style={{ color: 'var(--white)', fontFamily: "'Orbitron', sans-serif" }}>
                {activity.title}
              </p>
              {activity.description && (
                <p className="text-xs mt-1 line-clamp-2" style={{ color: 'var(--muted)' }}>{activity.description}</p>
              )}
            </div>
            {!activity.cover_image_url && (
              <button onClick={dismiss} className="flex-shrink-0 opacity-60 hover:opacity-100" style={{ color: 'var(--muted)' }} aria-label="Dismiss">
                <X size={15} />
              </button>
            )}
          </div>

          {(when || activity.registration_enabled) && (
            <div className="flex items-center gap-2 mt-2.5 flex-wrap">
              {when && (
                <span className="px-2 py-1 rounded-full text-[10px] font-bold inline-flex items-center gap-1"
                  style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.25)' }}>
                  <CalendarDays size={10} /> {when}
                </span>
              )}
              {activity.registration_enabled && (
                <span className="px-2 py-1 rounded-full text-[10px] font-bold"
                  style={{ background: 'rgba(46, 204, 113, 0.12)', color: '#2ecc71', border: '1px solid rgba(46, 204, 113, 0.3)' }}>
                  Registration open
                </span>
              )}
            </div>
          )}

          <Link href={`/activities/${activity.slug}`} onClick={dismiss}
            className="mt-3 w-full py-2 rounded-lg text-xs font-bold flex items-center justify-center gap-1.5"
            style={{ background: 'var(--blue)', color: '#000', fontFamily: "'Orbitron', sans-serif" }}>
            {activity.registration_enabled ? 'VIEW & REGISTER' : 'VIEW EVENT'} <ArrowRight size={13} />
          </Link>
        </div>
      </div>
    </div>
  )
}
