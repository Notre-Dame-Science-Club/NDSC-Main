'use client'
// components/auth/OAuthButton.tsx
//
// "Continue with <Provider>" button for /login and /register. Only rendered
// by the caller when OAuth is enabled (NEXT_PUBLIC_AUTH_ENABLE_OAUTH defaults
// to enabled; set it to 'false' to disable).
//
// Kicks off supabase.auth.signInWithOAuth with a safe callback URL; the
// provider redirects the browser to /auth/callback, which finishes the flow.
//
// The local dev stack (SUPABASE_ENV=local) has no GoTrue, so its auth shim
// in lib/supabase.ts does not implement signInWithOAuth — the handler
// detects that and shows a friendly error instead of crashing.

import { useState } from 'react'
import { supabase } from '@/lib/supabase'
import {
  getAuthCallbackUrl,
  getOAuthProvider,
  getOAuthProviderForSupabase,
  getOAuthProviderLabel,
} from '@/lib/authConfig'

export default function OAuthButton({ label = 'Continue with' }: { label?: string }) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const provider = getOAuthProvider()

  const start = async () => {
    if (loading) return
    setLoading(true)
    setError('')
    try {
      const auth = supabase.auth as unknown as {
        signInWithOAuth?: (opts: {
          provider: ReturnType<typeof getOAuthProviderForSupabase>
          options?: { redirectTo: string }
        }) => Promise<{ error: { message: string } | null }>
      }
      if (typeof auth.signInWithOAuth !== 'function') {
        throw new Error('OAuth sign-in is not available in this environment.')
      }
      const { error: oauthError } = await auth.signInWithOAuth({
        provider: getOAuthProviderForSupabase(),
        options: { redirectTo: getAuthCallbackUrl() },
      })
      if (oauthError) throw oauthError
      // On success the browser is being redirected to the provider — nothing
      // else to do. Don't flip loading back off; the page navigates away.
    } catch (e: any) {
      setError(e?.message || 'Could not start sign-in. Please try again.')
      setLoading(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={start}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2.5 py-2.5 rounded-lg font-semibold text-sm transition-all border"
        style={{
          background: 'rgba(255,255,255,0.04)',
          borderColor: 'var(--border)',
          color: 'var(--white)',
          opacity: loading ? 0.6 : 1,
          cursor: loading ? 'not-allowed' : 'pointer',
          fontFamily: 'inherit',
          letterSpacing: '0.04em',
        }}>
        <span className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-black flex-shrink-0"
          style={{ background: 'var(--blue)', color: '#000' }}>
          {provider.charAt(0).toUpperCase()}
        </span>
        {loading ? 'Redirecting…' : `${label} ${getOAuthProviderLabel()}`}
      </button>
      {error && (
        <p className="text-xs mt-2 text-center" style={{ color: 'var(--danger-soft)' }}>{error}</p>
      )}
    </div>
  )
}
