'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import { Microscope } from 'lucide-react'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!email || !password) return setError('Email and password are required.')
    setLoading(true)
    setError('')

    try {
      // API route call করো - supabaseAdmin দিয়ে is_verified check হবে
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await res.json()

      if (!res.ok) {
        setLoading(false)
        return setError(data.error || 'Login failed.')
      }

      // Session টা client-side Supabase এ set করো
      if (data.session) {
        await supabase.auth.setSession({
          access_token: data.session.access_token,
          refresh_token: data.session.refresh_token,
        })
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setLoading(false)
      setError('Network error. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="fixed inset-0 grid-bg opacity-30 pointer-events-none" />

      <div className="relative w-full max-w-sm mx-4">
        <div className="absolute -inset-1 rounded-2xl opacity-30 blur-xl"
          style={{ background: 'radial-gradient(circle, var(--blue) 0%, transparent 70%)' }} />

        <div className="relative rounded-2xl p-8 border"
          style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
              style={{ background: 'rgba(var(--blue-rgb), 0.1)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
              <Microscope size={22} style={{ color: 'var(--blue)' }} />
            </div>
            <h1 className="text-xl font-bold mb-1"
              style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }}>
              Member Login
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Sign in to your NDSC account</p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-lg mb-5 text-sm border"
              style={{ background: 'rgba(255,50,50,0.08)', borderColor: 'rgba(var(--danger-rgb), 0.3)', color: 'var(--danger-soft)' }}>
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                style={{ color: 'var(--muted)' }}>Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="email@example.com"
                onKeyDown={e => e.key === 'Enter' && submit()}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--white)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--blue)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                style={{ color: 'var(--muted)' }}>Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && submit()}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--white)' }}
                onFocus={e => (e.target.style.borderColor = 'var(--blue)')}
                onBlur={e => (e.target.style.borderColor = 'var(--border)')}
              />
            </div>

            <button
              onClick={submit} disabled={loading}
              className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all mt-2 text-black"
              style={{
                background: 'var(--blue)',
                opacity: loading ? 0.6 : 1,
                fontFamily: "'Orbitron', sans-serif",
                letterSpacing: '0.05em',
              }}>
              {loading ? 'Signing in...' : 'Login'}
            </button>

            <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-medium hover:underline" style={{ color: 'var(--blue)' }}>
                Register
              </Link>
            </p>

            <div className="pt-2 text-center" style={{ borderTop: '1px solid var(--border)' }}>
              <Link href="/admin/login" className="text-xs hover:text-white transition-colors"
                style={{ color: 'var(--muted)' }}>
                Admin Login →
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
