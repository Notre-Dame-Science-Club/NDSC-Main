'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import Image from 'next/image'
import { Eye, EyeOff, Loader2, KeyRound, ArrowLeft, CheckCircle } from 'lucide-react'
import Input from '@/components/ui/Input'

type Step = 'verify' | 'reset' | 'success'

export default function ForgotPasswordPage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>('verify')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resetToken, setResetToken] = useState('')

  const handleVerify = async () => {
    if (!email || !phone) {
      setError('Email and phone number are required.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/verify-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, phone }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Verification failed.')
        setLoading(false)
        return
      }

      setResetToken(data.reset_token)
      setStep('reset')
      setError('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = async () => {
    if (!newPassword || !confirmPassword) {
      setError('Both password fields are required.')
      return
    }

    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters.')
      return
    }

    if (newPassword !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset_token: resetToken, new_password: newPassword }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || 'Password reset failed.')
        setLoading(false)
        return
      }

      setStep('success')
      setError('')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
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

  const confirmPasswordToggle = (
    <button
      type="button"
      onClick={() => setShowConfirmPassword(s => !s)}
      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
      aria-pressed={showConfirmPassword}
      className="absolute right-2 top-1/2 -translate-y-1/2 p-1.5 rounded-md cursor-pointer transition-colors hover:text-white"
      style={{ color: 'var(--muted)' }}
    >
      {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
    </button>
  )

  // Success view
  if (step === 'success') {
    return (
      <div className="min-h-screen flex items-center justify-center py-12" style={{ background: 'var(--bg)' }}>
        <div className="fixed inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="fixed inset-0 pointer-events-none"
          style={{ backgroundImage: 'radial-gradient(circle at 50% 0%, rgba(var(--success-rgb), 0.06) 0%, transparent 55%)' }} />

        <div className="relative w-full max-w-md mx-4">
          <div className="absolute -inset-1 rounded-2xl opacity-25 blur-xl"
            style={{ background: 'radial-gradient(circle, var(--success) 0%, transparent 70%)' }} />

          <div className="relative rounded-2xl p-8 border text-center"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>

            <div className="inline-flex items-center justify-center w-16 h-16 rounded-full mb-4"
              style={{ background: 'rgba(var(--success-rgb), 0.1)', border: '1px solid rgba(var(--success-rgb), 0.3)' }}>
              <CheckCircle size={32} style={{ color: 'var(--success)' }} />
            </div>

            <h1 className="text-2xl font-black mb-2" style={{ fontFamily: 'var(--font-heading)', color: 'var(--success)' }}>
              Password Reset!
            </h1>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
              Your password has been successfully reset. You can now log in with your new password.
            </p>

            <button
              onClick={() => router.push('/login')}
              className="btn-primary w-full py-2.5 rounded-lg font-semibold text-sm flex items-center justify-center gap-2"
              style={{ fontFamily: 'inherit', letterSpacing: '0.05em' }}
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    )
  }

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
              {step === 'verify' ? (
                <Image src="/images/cropped-logo.png" alt="NDSC" width={34} height={34} className="object-contain" priority />
              ) : (
                <KeyRound size={28} style={{ color: 'var(--blue)' }} />
              )}
            </div>
            <h1 className="text-2xl font-black mb-1.5" style={{ fontFamily: 'var(--font-heading)', color: 'var(--white)' }}>
              {step === 'verify' ? 'Forgot Password?' : 'Reset Password'}
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {step === 'verify'
                ? 'Enter your email and phone number to verify your identity'
                : 'Enter your new password'
              }
            </p>
          </div>

          {error && (
            <div role="alert" className="px-4 py-3 rounded-lg mb-5 text-sm border"
              style={{ background: 'rgba(255,50,50,0.08)', borderColor: 'rgba(var(--danger-rgb), 0.3)', color: 'var(--danger-soft)' }}>
              {error}
            </div>
          )}

          {step === 'verify' ? (
            <form noValidate onSubmit={e => { e.preventDefault(); handleVerify() }} className="space-y-4">
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
                <label htmlFor="field-phone" className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                  style={{ color: 'var(--muted)' }}>Phone Number</label>
                <Input
                  id="field-phone" name="phone" type="tel" autoComplete="tel"
                  value={phone} onChange={e => setPhone(e.target.value)}
                  placeholder="01XXXXXXXXX" disabled={loading}
                />
                <p className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
                  Enter the phone number you used during registration
                </p>
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
                  <><Loader2 size={16} className="animate-spin" /> Verifying…</>
                ) : (
                  <>Verify & Continue</>
                )}
              </button>

              <div className="pt-4 text-center" style={{ borderTop: '1px solid var(--border)' }}>
                <Link href="/login" className="text-sm flex items-center justify-center gap-2 hover:text-white transition-colors"
                  style={{ color: 'var(--muted)' }}>
                  <ArrowLeft size={16} /> Back to Login
                </Link>
              </div>
            </form>
          ) : (
            <form noValidate onSubmit={e => { e.preventDefault(); handleReset() }} className="space-y-4">
              <div>
                <label htmlFor="field-new-password" className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                  style={{ color: 'var(--muted)' }}>New Password</label>
                <div className="relative">
                  <Input
                    id="field-new-password" name="new_password" type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min. 6 characters" disabled={loading} className="pr-10"
                  />
                  {passwordToggle}
                </div>
              </div>

              <div>
                <label htmlFor="field-confirm-password" className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
                  style={{ color: 'var(--muted)' }}>Confirm New Password</label>
                <div className="relative">
                  <Input
                    id="field-confirm-password" name="confirm_password" type={showConfirmPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password" disabled={loading} className="pr-10"
                  />
                  {confirmPasswordToggle}
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
                  <><Loader2 size={16} className="animate-spin" /> Resetting…</>
                ) : (
                  <><KeyRound size={15} /> Reset Password</>
                )}
              </button>

              <div className="pt-4 text-center" style={{ borderTop: '1px solid var(--border)' }}>
                <button
                  type="button"
                  onClick={() => { setStep('verify'); setError(''); setResetToken('') }}
                  className="text-sm flex items-center justify-center gap-2 hover:text-white transition-colors mx-auto"
                  style={{ color: 'var(--muted)' }}
                >
                  <ArrowLeft size={16} /> Back
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
