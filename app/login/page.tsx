'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff, Loader2, LogIn } from 'lucide-react'
import Input from '@/components/ui/Input'
import OAuthButton from '@/components/auth/OAuthButton'
import { isOAuthEnabled } from '@/lib/authConfig'

export default function LoginPage() {
  const router = useRouter()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const submit = async () => {
    if (!email || !password) return setError('Email and password are required.')
    setLoading(true)
    setError('')

    try {
      // The local-stack client shim in lib/supabase.ts handles
      // supabase.auth.signInWithPassword (it posts to /api/auth/login,
      // stashes the resulting bearer in localStorage, and returns the
      // session). Using the shim path here means the prod and local
      // branches share one code path; we don't need to know which
      // mode we're in.
      const { data, error: signInError } = await supabase.auth.signInWithPassword({ email, password })

      if (signInError || !data?.session) {
        setLoading(false)
        return setError(signInError?.message || 'Login failed.')
      }

      router.push('/dashboard')
      router.refresh()
    } catch {
      setLoading(false)
      setError('Network error. Please try again.')
    }
  }

  const passwordToggle = (
    <button
      type="button"
      onClick={() => setShowPassword(s => !s)}
      aria-label={showPassword ? 'Hide password' : 'Show password'}
      aria-pressed={showPassword}
      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md cursor-pointer transition-colors hover:text-white"
      style={{ color: 'var(--muted)' }}
    >
      {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  )

  return (
    <div className="min-h-screen flex items-center justify-center py-12" style={{ background: 'var(--bg)' }}>
      <div className="fixed inset-0 grid-bg opacity-30 pointer-events-none" />
      <div className="fixed inset-0 pointer-events-none"
        style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(var(--blue-rgb), 0.06) 0%, transparent 55%)' }} />

      <div className="relative w-full max-w-md mx-4">
        <div className="absolute -inset-1 rounded-2xl opacity-25 blur-xl"
          style={{ background: 'radial-gradient(circle, var(--blue) 0%, transparent 70%)' }} />

        <div className="relative rounded-2xl p-8 border"
          style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4 relative overflow-hidden"
              style={{ background: 'rgba(var(--blue-rgb), 0.1)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
              <Image src="/images/cropped-logo.png" alt="NDSC" width={34} height={34} className="object-contain" priority />
            </div>
            <h1 className="text-2xl font-black mb-1.5" style={{ fontFamily: 'var(--font-heading)', color: 'var(--white)' }}>
              Welcome back
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Sign in to your NDSC website account</p>
          </div>

          {error && (
            <div role="alert" className="px-4 py-3 rounded-lg mb-5 text-sm border"
              style={{ background: 'rgba(255,50,50,0.08)', borderColor: 'rgba(var(--danger-rgb), 0.3)', color: 'var(--danger-soft)' }}>
              {error}
            </div>
          )}

          {isOAuthEnabled() && (
            <div className="mb-6 space-y-3">
              <OAuthButton />
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
                <div className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
                or continue with email
                <div className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
              </div>
            </div>
          )}

          <form noValidate onSubmit={e => { e.preventDefault(); submit() }} className="space-y-4">
            <div>
              <label htmlFor="field-email" className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                style={{ color: 'var(--muted)' }}>Email</label>
              <Input
                id="field-email" name="email" type="email" autoComplete="email"
                value={email} onChange={e => setEmail(e.target.value)}
                placeholder="email@example.com" disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="field-password" className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                style={{ color: 'var(--muted)' }}>Password</label>
              <div className="relative">
                <Input
                  id="field-password" name="password" type={showPassword ? 'text' : 'password'} autoComplete="current-password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="••••••••" disabled={loading} className="pr-10"
                />
                {passwordToggle}
              </div>
            </div>

            <button
              type="submit" disabled={loading}
              className="btn-primary w-full py-2.5 rounded-lg font-semibold text-sm mt-2 flex items-center justify-center gap-2"
              style={{
                opacity: loading ? 0.6 : 1,
                cursor: loading ? 'not-allowed' : 'pointer',
                fontFamily: 'inherit',
                letterSpacing: '0.05em',
              }}>
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Signing in…</>
              ) : (
                <><LogIn size={15} /> Login</>
              )}
            </button>

            <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
              Don&apos;t have an account?{' '}
              <Link href="/register" className="font-medium transition-colors hover:underline" style={{ color: 'var(--blue)' }}>
                Register
              </Link>
            </p>

            {/* This page is a general website login, not a membership gate — anyone
                who registers can sign in here. Actual NDSC club membership is a
                separate, admin-approved step taken afterwards from the dashboard,
                so we say so plainly instead of calling this a "Member Login" and
                implying the opposite. */}
            <div className="px-4 py-3 rounded-lg text-xs border flex items-start gap-2"
              style={{ background: 'rgba(var(--blue-rgb), 0.05)', borderColor: 'rgba(var(--blue-rgb), 0.2)', color: 'var(--muted)' }}>
              <span>
                <strong style={{ color: 'var(--blue)' }}>Note:</strong> This signs you in to your NDSC website account.
                NDC students can apply for official{' '}
                <Link href="/membership" className="underline" style={{ color: 'var(--blue)' }}>Club Membership</Link>
                {' '}from their dashboard afterwards.
              </span>
            </div>

            <div className="pt-2 text-center" style={{ borderTop: '1px solid var(--border)' }}>
              <Link href="/admin/login" className="text-xs hover:text-white transition-colors"
                style={{ color: 'var(--muted)' }}>
                Admin Login →
              </Link>
            </div>
          </form>
        </div>
      </div>
    </div>
  )
}
