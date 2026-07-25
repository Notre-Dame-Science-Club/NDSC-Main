'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

export type MyActivityRegistration = {
  id: string
  activity_session_id: string
  session?: { id: string; slug?: string } | null
}

// Registration status for the current visitor, checked against the
// server instead of the localStorage/cookie "device markers" the public
// register flow writes on completion (ndsc_reg_<id>, ndsc_seg_<id>,
// ndsc_form_done_activity_<id>).
//
// Those markers only ever meant "this browser submitted a form once" —
// they say nothing about the member's real account. They go stale the
// moment someone switches devices, clears storage, uses a different
// browser, or (now that login no longer requires a membership slip)
// registers anonymously and logs into an existing account afterwards.
// That mismatch is exactly what caused activities pages to invite an
// already-registered member to "Register Now" again, only for the
// device marker (correctly!) to reject the duplicate a step later.
//
// If a member is logged in, this hook is the source of truth: it asks
// the server (the same /api/member-activity-registrations the dashboard
// already uses) what the member is actually registered for. If nobody
// is logged in, `isMember` is false and callers should fall back to the
// device-marker check — that's still the only signal available for an
// anonymous registrant.
export function useMyActivityRegistrations() {
  const [memberId, setMemberId] = useState<string | null>(null)
  const [registrations, setRegistrations] = useState<MyActivityRegistration[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (cancelled) return
        if (!user) { setLoading(false); return }
        setMemberId(user.id)
        const res = await fetch(`/api/member-activity-registrations?member_id=${user.id}`)
        if (!res.ok) { setLoading(false); return }
        const data = await res.json()
        if (!cancelled) setRegistrations(data.registrations || [])
      } catch {
        // Network or auth hiccup — loading just ends with isMember=false
        // (memberId stays null), so callers fall back to device markers.
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [])

  const isRegisteredForSession = (sessionId: string) =>
    registrations.some(r => r.activity_session_id === sessionId || r.session?.id === sessionId)

  const getRegistrationForSession = (sessionId: string) =>
    registrations.find(r => r.activity_session_id === sessionId || r.session?.id === sessionId) || null

  return {
    isMember: !!memberId,
    memberId,
    registrations,
    loading,
    isRegisteredForSession,
    getRegistrationForSession,
  }
}
