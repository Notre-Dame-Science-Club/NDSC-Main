'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import type { ReactNode } from 'react'
import { Eye, EyeOff, Loader2, KeyRound, ArrowLeft, CheckCircle } from 'lucide-react'
import Input from '@/components/ui/Input'

// Landing page for the link in the password-reset email (sent by /api/auth/request-reset).
// The one-time token is NOT used when this page loads (email scanners that prefetch links would
// burn it); it is only submitted, together with the new password, when the person clicks the
// button. Requested via the "Forgot password?" page.

export default function ResetPasswordPage() {
  const [tokenHash, setTokenHash] = useState<string | null>(null)
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [show, setShow] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  useEffect(() => {
    const t = new URLSearchParams(window.location.search).get('token_hash') || ''
    setTokenHash(t)
    // Keep the token out of the address bar / history / referrers once it has been read.
    if (t) window.history.replaceState(null, '', window.location.pathname)
  }, [])

  const submit = async () => {
    setError('')
    if (password.length < 8) return setError('Password must be at least 8 characters.')
    if (password !== confirm) return setError('Passwords do not match.')
    setLoading(true)
    try {
      const res = await fetch('/api/auth/reset-with-token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token_hash: tokenHash, new_password: password }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.error || 'Could not reset the password. Please try again.'); return }
      setDone(true)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const shell = (children: ReactNode) => (
    <div className="min-h-screen flex items-center justify-center py-12" style={{ background: 'var(--bg)' }}>
      <div className="fixed inset-0 grid-bg opacity-30 pointer-events-none" />
      <div className="relative w-full max-w-md mx-4">
        <div className="relative rounded-2xl p-8 border" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
          {children}
        </div>
      </div>
    </div>
  )

  if (tokenHash === null) {
    return shell(<div className="flex justify-center"><Loader2 size={24} className="animate-spin" style={{ color: 'var(--muted)' }} /></div>)
  }

  if (done) {
    return shell(
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{ background: 'rgba(var(--blue-rgb), 0.1)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
          <CheckCircle size={28} style={{ color: 'var(--blue)' }} />
        </div>
        <h1 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--white)' }}>Password updated</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>You can now log in with your new password.</p>
        <Link href="/login" className="btn-primary inline-flex w-full py-2.5 rounded-lg font-semibold text-sm items-center justify-center">Go to Login</Link>
      </div>
    )
  }

  if (!tokenHash) {
    return shell(
      <div className="text-center">
        <h1 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--white)' }}>Link not valid</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>This reset link is missing or incomplete. Please request a new one.</p>
        <Link href="/forgot-password" className="btn-primary inline-flex w-full py-2.5 rounded-lg font-semibold text-sm items-center justify-center">Request a new link</Link>
      </div>
    )
  }

  return shell(
    <>
      <div className="text-center mb-8">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
          style={{ background: 'rgba(var(--blue-rgb), 0.1)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
          <KeyRound size={28} style={{ color: 'var(--blue)' }} />
        </div>
        <h1 className="text-2xl font-black mb-1.5" style={{ fontFamily: 'var(--font-heading)', color: 'var(--white)' }}>Choose a new password</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>At least 8 characters</p>
      </div>

      {error && (
        <div role="alert" className="px-4 py-3 rounded-lg mb-5 text-sm border"
          style={{ background: 'rgba(255,50,50,0.08)', borderColor: 'rgba(var(--danger-rgb), 0.3)', color: 'var(--danger-soft)' }}>
          {error}{' '}
          {/invalid|expired/i.test(error) && <Link href="/forgot-password" className="underline">Request a new link</Link>}
        </div>
      )}

      <form noValidate onSubmit={e => { e.preventDefault(); submit() }} className="space-y-4">
        <div>
          <label htmlFor="field-password" className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>New password</label>
          <div className="relative">
            <Input id="field-password" name="password" type={show ? 'text' : 'password'} autoComplete="new-password"
              value={password} onChange={e => setPassword(e.target.value)} disabled={loading} style={{ paddingRight: '2.5rem' }} />
            <button type="button" onClick={() => setShow(s => !s)} aria-label={show ? 'Hide password' : 'Show password'} aria-pressed={show}
              className="absolute right-2 top-1/2 -translate-y-1/2" style={{ color: 'var(--muted)' }}>
              {show ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>
        </div>
        <div>
          <label htmlFor="field-confirm" className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>Confirm password</label>
          <Input id="field-confirm" name="confirm" type={show ? 'text' : 'password'} autoComplete="new-password"
            value={confirm} onChange={e => setConfirm(e.target.value)} disabled={loading} />
        </div>
        <button type="submit" disabled={loading}
          className="btn-primary w-full py-2.5 rounded-lg font-semibold text-sm mt-2 flex items-center justify-center gap-2"
          style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', letterSpacing: '0.05em' }}>
          {loading ? (<><Loader2 size={16} className="animate-spin" /> Updating…</>) : (<>Update password</>)}
        </button>
      </form>

      <div className="pt-4 mt-4 text-center" style={{ borderTop: '1px solid var(--border)' }}>
        <Link href="/login" className="text-sm flex items-center justify-center gap-2 hover:text-white transition-colors" style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={16} /> Back to Login
        </Link>
      </div>
    </>
  )
}
