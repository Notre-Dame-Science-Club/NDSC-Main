'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function AdminLoginPage() {
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
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      })
      const data = await res.json()
      setLoading(false)

      if (!res.ok) return setError(data.error || 'Login failed.')

      // Hard redirect to admin dashboard
      window.location.href = '/admin'
    } catch {
      setLoading(false)
      setError('Network error. Please try again.')
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#030a12' }}>
      <div className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 50% 50%, rgba(0,212,255,0.03) 0%, transparent 70%)' }} />

      <div className="relative w-full max-w-sm mx-4">
        <div className="absolute -inset-1 rounded-2xl opacity-20 blur-xl"
          style={{ background: 'radial-gradient(circle, #00d4ff 0%, transparent 70%)' }} />

        <div className="relative rounded-2xl p-8 border"
          style={{ background: '#050d1a', borderColor: '#0f2a4a' }}>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
              style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)' }}>
              <span className="text-2xl">🔐</span>
            </div>
            <h1 className="text-xl font-bold mb-1"
              style={{ fontFamily: "'Orbitron', sans-serif", color: '#00d4ff' }}>
              Admin Login
            </h1>
            <p className="text-xs" style={{ color: '#6a8faf' }}>NDSC Admin Panel — Authorized Access Only</p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-lg mb-5 text-sm border"
              style={{ background: 'rgba(255,50,50,0.08)', borderColor: 'rgba(255,80,80,0.3)', color: '#ff7070' }}>
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                style={{ color: '#6a8faf' }}>Admin Email</label>
              <input
                type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="admin@ndscbd.net"
                onKeyDown={e => e.key === 'Enter' && submit()}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #0f2a4a', color: '#e8f4ff' }}
                onFocus={e => e.target.style.borderColor = '#00d4ff'}
                onBlur={e => e.target.style.borderColor = '#0f2a4a'}
              />
            </div>

            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                style={{ color: '#6a8faf' }}>Password</label>
              <input
                type="password" value={password} onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                onKeyDown={e => e.key === 'Enter' && submit()}
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none"
                style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid #0f2a4a', color: '#e8f4ff' }}
                onFocus={e => e.target.style.borderColor = '#00d4ff'}
                onBlur={e => e.target.style.borderColor = '#0f2a4a'}
              />
            </div>

            <button
              onClick={submit} disabled={loading}
              className="w-full py-2.5 rounded-lg font-semibold text-sm text-black mt-2"
              style={{
                background: loading ? 'rgba(0,212,255,0.5)' : '#00d4ff',
                fontFamily: "'Orbitron', sans-serif",
                letterSpacing: '0.05em',
                cursor: loading ? 'not-allowed' : 'pointer',
              }}>
              {loading ? 'Verifying...' : 'Login'}
            </button>

            <div className="text-center pt-1">
              <Link href="/login" className="text-xs hover:text-white transition-colors"
                style={{ color: '#6a8faf' }}>
                ← Member Login
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
