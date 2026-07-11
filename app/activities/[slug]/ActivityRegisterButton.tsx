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
        className="px-6 py-3 rounded-xl font-bold text-sm flex-shrink-0 transition-all hover:-translate-y-0.5"
        style={{ background: 'rgba(var(--blue-rgb), 0.15)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.4)', fontFamily: "'Orbitron', sans-serif" }}>
        My Dashboard →
      </Link>
    )
  }

  return (
    <Link href={`/activities/${slug}/register`}
      className="px-6 py-3 rounded-xl font-bold text-sm text-black flex-shrink-0 transition-all hover:-translate-y-0.5"
      style={{ background: 'var(--blue)', fontFamily: "'Orbitron', sans-serif" }}>
      Register Now →
    </Link>
  )
}
