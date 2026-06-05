'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function AuthButton({ mobile = false }: { mobile?: boolean }) {
  const [loggedIn, setLoggedIn] = useState(false)
  const [ready, setReady] = useState(false)
  const router = useRouter()

  useEffect(() => {
    // Dynamic import — build time এ execute হবে না
    import('@/lib/supabase').then(({ supabase }) => {
      supabase.auth.getSession().then(({ data }) => {
        setLoggedIn(!!data.session)
        setReady(true)
      })
      supabase.auth.onAuthStateChange((_e, session) => {
        setLoggedIn(!!session)
        setReady(true)
      })
    })
  }, [])

  const handleLogout = async () => {
    const { supabase } = await import('@/lib/supabase')
    await supabase.auth.signOut()
    setLoggedIn(false)
    router.push('/')
  }

  if (!ready) return null

  if (mobile) {
    return loggedIn ? (
      <>
        <Link href="/dashboard"
          className="mt-5 py-4 text-center font-black tracking-widest rounded-xl border text-sm"
          style={{ borderColor: 'var(--blue)', color: 'var(--blue)', fontFamily: "'Orbitron',sans-serif" }}>
          MY DASHBOARD
        </Link>
        <button onClick={handleLogout} className="py-3 text-sm text-center"
          style={{ color: 'var(--muted)' }}>
          Sign Out
        </button>
      </>
    ) : (
      <Link href="/login"
        className="mt-5 py-4 text-center font-black tracking-widest rounded-xl border text-sm"
        style={{ borderColor: 'var(--blue)', color: 'var(--blue)', fontFamily: "'Orbitron',sans-serif" }}>
        MEMBER LOGIN
      </Link>
    )
  }

  return loggedIn ? (
    <Link href="/dashboard"
      className="px-4 py-2 text-xs font-black tracking-widest rounded-lg border transition-all duration-200 hover:bg-[var(--blue)] hover:text-black hover:border-[var(--blue)]"
      style={{ borderColor: 'var(--blue)', color: 'var(--blue)', fontFamily: "'Orbitron',sans-serif" }}>
      Dashboard
    </Link>
  ) : (
    <Link href="/login"
      className="px-4 py-2 text-xs font-black tracking-widest rounded-lg border transition-all duration-200 hover:bg-[var(--blue)] hover:text-black hover:border-[var(--blue)]"
      style={{ borderColor: 'var(--blue)', color: 'var(--blue)', fontFamily: "'Orbitron',sans-serif" }}>
      Login
    </Link>
  )
}
