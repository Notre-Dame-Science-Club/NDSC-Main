'use client'
// app/auth/callback/page.tsx
//
// OAuth callback page. After a successful provider sign-in, Supabase
// redirects the browser here with `?code=...` (PKCE flow).
//
// Member sessions in this app live in localStorage, not cookies (see the
// long comment in lib/supabase.ts), so the code MUST be exchanged in the
// browser — that's the only place the session can be stored where the rest
// of the app looks for it. `detectSessionInUrl` is off, so we drive the
// exchange explicitly.
//
// After the exchange we route based on whether the user already has a
// `members` row:
//   - Existing member  → /dashboard
//   - New member       → /register/complete (collects college roll, etc.)

import { useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

export default function AuthCallbackPage() {
  const router = useRouter()
  const [message, setMessage] = useState('Completing sign-in…')
  const [error, setError] = useState('')
  const handled = useRef(false)

  useEffect(() => {
    if (handled.current) return
    handled.current = true

    const finish = async () => {
      const params = new URLSearchParams(window.location.search)

      // The provider can bounce us back with an explicit error (user denied
      // consent, or the provider isn't enabled in this Supabase project).
      const oauthError = params.get('error')
      if (oauthError) {
        setError(decodeURIComponent(params.get('error_description') || oauthError))
        setTimeout(() => router.replace('/login'), 2500)
        return
      }

      try {
        const code = params.get('code')
        if (code) {
          const auth = supabase.auth as unknown as {
            exchangeCodeForSession?: (code: string) => Promise<{ error: { message: string } | null }>
          }
          if (typeof auth.exchangeCodeForSession !== 'function') {
            throw new Error('OAuth sign-in is not available in this environment.')
          }
          const { error: exchangeError } = await auth.exchangeCodeForSession(code)
          if (exchangeError) throw exchangeError
        } else if (window.location.hash.startsWith('#access_token=')) {
          // Implicit-grant fallback — the session arrived in the URL hash.
          await supabase.auth.getSession()
        } else {
          throw new Error('Missing sign-in code. Please try again.')
        }

        const { data: { user }, error: userError } = await supabase.auth.getUser()
        if (userError || !user) throw new Error('Could not verify your session. Please try again.')

        setMessage('Checking your account…')

        // Already a member? Straight to the dashboard. New to the site?
        // The /register/complete page collects the remaining NDSC fields
        // (college roll, batch, …). Reading `members` here mirrors what the
        // dashboard already does with the same client + RLS.
        const { data: member } = await supabase
          .from('members')
          .select('id')
          .eq('id', user.id)
          .maybeSingle()

        router.replace(member ? '/dashboard' : '/register/complete')
      } catch (e: any) {
        setError(e?.message || 'Sign-in failed. Please try again.')
        setTimeout(() => router.replace('/login'), 2500)
      }
    }
    finish()
  }, [router])

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="fixed inset-0 grid-bg opacity-30 pointer-events-none" />

      <div className="relative w-full max-w-sm mx-4">
        <div className="rounded-2xl p-8 border"
          style={{
            background: 'var(--bg2)',
            borderColor: error ? 'rgba(var(--danger-rgb), 0.4)' : 'var(--border)',
          }}>
          {error ? (
            <div className="text-center">
              <p className="text-sm" style={{ color: 'var(--danger-soft)' }}>{error}</p>
              <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>Redirecting to login…</p>
            </div>
          ) : (
            <div className="text-center">
              <div className="inline-block w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mb-4"
                style={{ borderColor: 'var(--blue)', borderTopColor: 'transparent' }} />
              <p className="text-sm" style={{ color: 'var(--muted)' }}>{message}</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
