'use client'
import Link from 'next/link'
import { useEffect, useState } from 'react'
import { CheckCircle2 } from 'lucide-react'
import { useMyActivityRegistrations } from '@/hooks/useMyActivityRegistrations'

// Decides what the registration CTA actually shows. Previously this was
// a static server-rendered "Register Now" link that had no idea whether
// the visitor was already registered — the only "already registered"
// check in the whole flow lived one click later, on the register page
// itself (a localStorage/cookie device marker), so a member could be
// told "Registration is open" here and "You've already registered from
// this device" a second later. Same information, two different places,
// never checked against each other.
//
// This component is the fix: for a logged-in member, ask the server
// (via useMyActivityRegistrations) whether they're already registered
// for this session and show "You're already registered" + a dashboard
// link instead of inviting a duplicate signup. For an anonymous visitor
// (no member session), there's no server truth to check, so we fall
// back to the same device marker the register page itself writes —
// consistent with what that page will decide a moment later.
export default function RegistrationCTA({
  sessionId,
  slug,
  registrationNote,
}: {
  sessionId: string
  slug: string
  registrationNote?: string | null
}) {
  const { isMember, loading, getRegistrationForSession } = useMyActivityRegistrations()
  const [deviceRegId, setDeviceRegId] = useState<string | null>(null)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    try {
      const fromLocal = localStorage.getItem(`ndsc_reg_${sessionId}`) || localStorage.getItem('ndsc_activity_reg_id')
      const cookieMatch = document.cookie.match(new RegExp(`(?:^|; )ndsc_form_done_activity_${sessionId}=([^;]*)`))
      setDeviceRegId(fromLocal || (cookieMatch ? decodeURIComponent(cookieMatch[1]) : null))
    } catch { /* ignore — storage may be unavailable */ }
    setChecked(true)
  }, [sessionId])

  // Avoid a flash of "Register Now" before we know the real status.
  if (loading || !checked) return null

  const serverReg = isMember ? getRegistrationForSession(sessionId) : null
  const alreadyRegistered = isMember ? !!serverReg : !!deviceRegId
  // The id that actually loads data on /activities/[slug]/dashboard — that
  // page reads it from ?reg=<id> (or its own localStorage key as a
  // fallback), it has no idea about member accounts at all. Previously
  // this linked to the dashboard with no id whatsoever whenever the
  // status came from server truth, which is exactly the case where the
  // device marker is often missing (different device, cleared storage) —
  // so the very information that told us "you ARE registered" wasn't
  // being passed along, and the page showed its "we couldn't find your
  // registration on this device" / team-login screen instead. That
  // screen looks a lot like being logged out, even though it has nothing
  // to do with the member session.
  const dashboardRegId = serverReg?.id || deviceRegId

  if (alreadyRegistered) {
    return (
      <div className="rounded-2xl border p-6 mb-8 flex items-center justify-between gap-4 flex-wrap"
        style={{ background: 'rgba(var(--cat-teal-rgb), 0.06)', borderColor: 'rgba(var(--cat-teal-rgb), 0.4)' }}>
        <div className="flex items-center gap-2">
          <CheckCircle2 size={18} style={{ color: 'var(--cat-teal)' }} />
          <p className="font-bold text-base" style={{ color: 'var(--white)' }}>You're already registered for this event</p>
        </div>
        <Link href={dashboardRegId ? `/activities/${slug}/dashboard?reg=${dashboardRegId}` : `/activities/${slug}/dashboard`}
          className="px-6 py-3 rounded-xl font-bold text-sm flex-shrink-0 transition-all hover:-translate-y-0.5"
          style={{ background: 'var(--cat-teal)', color: '#000', fontFamily: 'inherit' }}>
          Open My Dashboard →
        </Link>
      </div>
    )
  }

  return (
    <div className="rounded-2xl border p-6 mb-8 flex items-center justify-between gap-4 flex-wrap"
      style={{ background: 'rgba(var(--blue-rgb), 0.06)', borderColor: 'rgba(var(--blue-rgb), 0.3)' }}>
      <div>
        <p className="font-bold text-base mb-1" style={{ color: 'var(--white)' }}>Registration is open</p>
        {registrationNote && (
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{registrationNote}</p>
        )}
      </div>
      <Link href={`/register/activity/${sessionId}`}
        className="px-6 py-3 rounded-xl font-bold text-sm text-black flex-shrink-0 transition-all hover:-translate-y-0.5"
        style={{ background: 'var(--blue)', fontFamily: 'inherit' }}>
        Register Now →
      </Link>
    </div>
  )
}
