'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

const STORAGE_KEY = 'ndsc_activity_reg_id'
// Per-session key so each event has its own registration stored
function sessionKey(sessionId: string) { return `ndsc_reg_${sessionId}` }

interface Props {
  slug: string
  sessionId: string
}

export default function ActivityRegisterButton({ slug, sessionId }: Props) {
  const [hasReg, setHasReg] = useState(false)
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    // Check per-session key first, then legacy global key
    const regId = localStorage.getItem(sessionKey(sessionId)) || localStorage.getItem(STORAGE_KEY)
    setHasReg(!!regId)
    setChecked(true)
  }, [sessionId])

  if (!checked) return null // avoid hydration mismatch

  if (hasReg) {
    return (
      <Link href={`/activities/${slug}/dashboard`}
        className="btn-outline px-6 py-3 rounded-xl font-bold text-sm flex-shrink-0"
        style={{ fontFamily: 'inherit' }}>
        My Dashboard →
      </Link>
    )
  }

  return (
    <Link href={`/register/activity/${sessionId}`}
      className="btn-primary px-6 py-3 rounded-xl font-bold text-sm flex-shrink-0"
      style={{ fontFamily: 'inherit' }}>
      Register Now →
    </Link>
  )
}
