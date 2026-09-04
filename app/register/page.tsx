'use client'
// app/register/page.tsx
//
// Member sign-up. Registration is open to all students.
// Two paths share this screen:
//   - Email/password (default), always available.
//   - OAuth (Google), rendered on top when NEXT_PUBLIC_AUTH_ENABLE_OAUTH is
//     enabled (default) — a fallback so users are never locked out.
//
// NDC students can apply for Club Membership from their dashboard profile.
// Field-level errors validate on blur + submit;
// server errors (duplicate email, etc.) surface in a top banner.

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, CheckCircle, Eye, EyeOff, Loader2, UserPlus } from 'lucide-react'
import Input from '@/components/ui/Input'
import OAuthButton from '@/components/auth/OAuthButton'
import { isOAuthEnabled } from '@/lib/authConfig'

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldName = 'full_name' | 'email' | 'password' | 'confirm_password' | 'phone' | 'institution' | 'education_level'
type FieldErrors = Partial<Record<FieldName, string>>

/** Validated fields — the ones that gate submission. */
const REQUIRED_FIELDS: FieldName[] = ['full_name', 'email', 'password', 'confirm_password', 'phone', 'institution', 'education_level']

const EDUCATION_LEVELS = [
  'Class 1', 'Class 2', 'Class 3', 'Class 4', 'Class 5',
  'Class 6', 'Class 7', 'Class 8', 'Class 9', 'Class 10',
  'SSC', 'HSC', 'University', 'Other'
]

/** One labelled input with linked label, helper/error text and a11y wiring. */
function FieldRow({
  name, label, required, autoComplete, inputMode, placeholder, type = 'text',
  error, value, onChange, onBlur, disabled, rightSlot, hint,
}: {
  name: string
  label: string
  required?: boolean
  autoComplete?: string
  inputMode?: 'text' | 'numeric' | 'tel' | 'email' | 'search'
  placeholder?: string
  type?: string
  error?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void
  onBlur: (e: React.FocusEvent<HTMLInputElement>) => void
  disabled?: boolean
  rightSlot?: React.ReactNode
  hint?: string
}) {
  const describedBy = error ? `field-${name}-error` : hint ? `field-${name}-hint` : undefined
  return (
    <div>
      <label
        htmlFor={`field-${name}`}
        className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
        style={{ color: 'var(--muted)' }}
      >
        {label} {required && <span style={{ color: 'var(--blue)' }}>*</span>}
      </label>
      <div className="relative">
        <Input
          id={`field-${name}`}
          name={name}
          type={type}
          value={value}
          onChange={onChange}
          onBlur={onBlur}
          placeholder={placeholder}
          autoComplete={autoComplete}
          inputMode={inputMode}
          required={required}
          disabled={disabled}
          aria-invalid={error ? true : undefined}
          aria-describedby={describedBy}
          style={error ? { borderColor: 'var(--danger)' } : undefined}
          className={rightSlot ? 'pr-10' : ''}
        />
        {rightSlot}
      </div>
      {error ? (
        <p id={`field-${name}-error`} role="alert" className="text-xs mt-1.5" style={{ color: 'var(--danger-soft)' }}>
          {error}
        </p>
      ) : hint ? (
        <p id={`field-${name}-hint`} className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>{hint}</p>
      ) : null}
    </div>
  )
}

/** Select dropdown with linked label, helper/error text and a11y wiring. */
function SelectRow({
  name, label, required, placeholder, options,
  error, value, onChange, onBlur, disabled, hint,
}: {
  name: string
  label: string
  required?: boolean
  placeholder?: string
  options: string[]
  error?: string
  value: string
  onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void
  onBlur: (e: React.FocusEvent<HTMLSelectElement>) => void
  disabled?: boolean
  hint?: string
}) {
  const describedBy = error ? `field-${name}-error` : hint ? `field-${name}-hint` : undefined
  return (
    <div>
      <label
        htmlFor={`field-${name}`}
        className="block text-xs font-medium mb-1.5 uppercase tracking-wider"
        style={{ color: 'var(--muted)' }}
      >
        {label} {required && <span style={{ color: 'var(--blue)' }}>*</span>}
      </label>
      <select
        id={`field-${name}`}
        name={name}
        value={value}
        onChange={onChange}
        onBlur={onBlur}
        required={required}
        disabled={disabled}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy}
        className="w-full px-3 py-2.5 rounded-lg text-sm transition-all border"
        style={{
          background: 'var(--bg2)',
          borderColor: error ? 'var(--danger)' : 'var(--border)',
          color: value ? 'var(--text)' : 'var(--muted)',
        }}
      >
        <option value="" disabled>{placeholder || 'Select...'}</option>
        {options.map(opt => (
          <option key={opt} value={opt}>{opt}</option>
        ))}
      </select>
      {error ? (
        <p id={`field-${name}-error`} role="alert" className="text-xs mt-1.5" style={{ color: 'var(--danger-soft)' }}>
          {error}
        </p>
      ) : hint ? (
        <p id={`field-${name}-hint`} className="text-xs mt-1.5" style={{ color: 'var(--muted)' }}>{hint}</p>
      ) : null}
    </div>
  )
}

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState<Record<FieldName, string>>({
    full_name: '', email: '', password: '', confirm_password: '', phone: '', institution: '', education_level: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)

  const handle = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const name = e.target.name as FieldName
    setForm({ ...form, [name]: e.target.value })
    if (fieldErrors[name]) {
      const next = { ...fieldErrors }
      delete next[name]
      setFieldErrors(next)
    }
  }

  /** Validate a single field — used on blur so users get feedback as they
   *  fill the form, not just on submit. */
  const validateField = (name: FieldName): string | undefined => {
    const trimmed = form[name].trim()
    switch (name) {
      case 'full_name':
        return trimmed ? undefined : 'Please enter your full name.'
      case 'email':
        if (!trimmed) return 'Please enter your email address.'
        return EMAIL_RE.test(trimmed) ? undefined : 'Enter a valid email address.'
      case 'password': {
        const pwd = form[name]
        if (!pwd) return 'Please choose a password.'
        return pwd.length >= 6 ? undefined : 'Password must be at least 6 characters.'
      }
      case 'confirm_password': {
        const pwd = form.password
        const confirm = form[name]
        if (!confirm) return 'Please confirm your password.'
        return pwd === confirm ? undefined : 'Passwords do not match.'
      }
      case 'phone':
        return trimmed ? undefined : 'Please enter your phone number.'
      case 'institution':
        return trimmed ? undefined : 'Please enter your institution.'
      case 'education_level':
        return trimmed ? undefined : 'Please select your education level.'
      default:
        return undefined
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLSelectElement>) => {
    const name = e.target.name as FieldName
    const msg = validateField(name)
    const next = { ...fieldErrors }
    if (msg) next[name] = msg
    else delete next[name]
    setFieldErrors(next)
  }

  const submit = async () => {
    if (loading) return
    const errors: FieldErrors = {}
    REQUIRED_FIELDS.forEach(n => {
      const msg = validateField(n)
      if (msg) errors[n] = msg
    })
    setFieldErrors(errors)

    const firstInvalid = REQUIRED_FIELDS.find(n => errors[n])
    if (firstInvalid) {
      setServerError('')
      document.getElementById(`field-${firstInvalid}`)?.focus()
      return
    }

    setLoading(true)
    setServerError('')
    try {
      const { confirm_password, ...payload } = form
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const data = await res.json()
      if (!res.ok) { setServerError(data.error); setLoading(false); return }
      setSuccess(true)
    } catch (e: any) {
      setServerError(e.message || 'Something went wrong. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (success) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="fixed inset-0 grid-bg opacity-30 pointer-events-none" />
      <div className="relative text-center max-w-md w-full mx-4">
        <div className="absolute -inset-1 rounded-2xl opacity-20 blur-xl"
          style={{ background: 'radial-gradient(circle, var(--success) 0%, transparent 70%)' }} />
        <div className="relative rounded-2xl p-10 border"
          style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
          <div className="mb-4 flex justify-center" style={{ color: 'var(--success)' }}><CheckCircle size={56} /></div>
          <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'inherit', color: 'var(--success)' }}>
            Registration Successful!
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            Your account has been created. You can now log in to your dashboard.
            NDC students can apply for Club Membership from their profile.
          </p>
          <button onClick={() => router.push('/login')} type="button"
            className="btn-primary px-6 py-2.5 rounded-lg font-semibold text-sm text-black transition-all cursor-pointer"
            style={{ fontFamily: 'inherit' }}>
            Go to Login
          </button>
        </div>
      </div>
    </div>
  )

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

  return (
    <div className="min-h-screen flex items-center justify-center py-12" style={{ background: 'var(--bg)' }}>
      <div className="fixed inset-0 grid-bg opacity-30 pointer-events-none" />

      <div className="relative w-full max-w-md mx-4">
        <div className="absolute -inset-1 rounded-2xl opacity-25 blur-xl"
          style={{ background: 'radial-gradient(circle, var(--blue) 0%, transparent 70%)' }} />

        <div className="relative rounded-2xl p-8 border"
          style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
              style={{ background: 'rgba(var(--blue-rgb), 0.1)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
              <UserPlus size={22} style={{ color: 'var(--blue)' }} />
            </div>
            <h1 className="text-xl font-bold mb-1" style={{ fontFamily: 'inherit', color: 'var(--blue)' }}>
              Create your account
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Registration is open to all students</p>
          </div>

          {serverError && (
            <div role="alert" className="px-4 py-3 rounded-lg mb-5 text-sm border"
              style={{ background: 'rgba(255,50,50,0.08)', borderColor: 'rgba(var(--danger-rgb), 0.3)', color: 'var(--danger-soft)' }}>
              {serverError}
            </div>
          )}

          {isOAuthEnabled() && (
            <div className="mb-6 space-y-3">
              <OAuthButton label="Sign up with" />
              <div className="flex items-center gap-3 text-xs" style={{ color: 'var(--muted)' }}>
                <div className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
                or sign up with email
                <div className="flex-1" style={{ borderTop: '1px solid var(--border)' }} />
              </div>
            </div>
          )}

          <form noValidate onSubmit={e => { e.preventDefault(); submit() }} className="space-y-8">
            <section aria-labelledby="section-basic">
              <div className="section-label" id="section-basic">Basic Information</div>
              <div className="space-y-4">
                <FieldRow
                  name="full_name" label="Full Name" required autoComplete="name"
                  placeholder="Your full name" value={form.full_name}
                  onChange={handle} onBlur={handleBlur} disabled={loading}
                  error={fieldErrors.full_name}
                />
                <FieldRow
                  name="institution" label="Institution" required autoComplete="organization"
                  placeholder="e.g., Notre Dame College, BUET, Viqarunnisa, etc." value={form.institution}
                  onChange={handle} onBlur={handleBlur} disabled={loading}
                  error={fieldErrors.institution}
                />
                <SelectRow
                  name="education_level" label="Education Level / Class" required
                  placeholder="Select your level" options={EDUCATION_LEVELS}
                  value={form.education_level}
                  onChange={handle} onBlur={handleBlur} disabled={loading}
                  error={fieldErrors.education_level}
                />
              </div>
            </section>

            <section aria-labelledby="section-contact">
              <div className="section-label" id="section-contact">Contact Information</div>
              <div className="space-y-4">
                <FieldRow
                  name="email" label="Email Address" required type="email" autoComplete="email"
                  placeholder="email@example.com" value={form.email}
                  onChange={handle} onBlur={handleBlur} disabled={loading}
                  error={fieldErrors.email}
                />
                <FieldRow
                  name="phone" label="Phone Number" required type="tel" inputMode="tel" autoComplete="tel"
                  placeholder="01XXXXXXXXX" value={form.phone}
                  onChange={handle} onBlur={handleBlur} disabled={loading}
                  error={fieldErrors.phone}
                />
              </div>
            </section>

            <section aria-labelledby="section-security">
              <div className="section-label" id="section-security">Security</div>
              <div className="space-y-4">
                <FieldRow
                  name="password" label="Password" required type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password" placeholder="Min. 6 characters" value={form.password}
                  onChange={handle} onBlur={handleBlur} disabled={loading}
                  error={fieldErrors.password} rightSlot={passwordToggle}
                />
                <FieldRow
                  name="confirm_password" label="Confirm Password" required type={showConfirmPassword ? 'text' : 'password'}
                  autoComplete="new-password" placeholder="Re-enter password" value={form.confirm_password}
                  onChange={handle} onBlur={handleBlur} disabled={loading}
                  error={fieldErrors.confirm_password} rightSlot={confirmPasswordToggle}
                />
              </div>
            </section>

            <div className="pt-2 px-4 py-3 rounded-lg text-xs border" style={{ background: 'rgba(var(--blue-rgb), 0.05)', borderColor: 'rgba(var(--blue-rgb), 0.2)', color: 'var(--muted)' }}>
              <strong style={{ color: 'var(--blue)' }}>Note:</strong> Registration is open to all students.
              NDC students can apply for Club Membership from their dashboard profile.
            </div>

            <button
              type="submit"
              disabled={loading}
              className="btn-primary w-full py-3 rounded-lg font-semibold text-sm mt-2 text-black flex items-center justify-center gap-2"
              style={{ opacity: loading ? 0.6 : 1, cursor: loading ? 'not-allowed' : 'pointer', fontFamily: 'inherit', letterSpacing: '0.05em' }}
            >
              {loading ? (
                <><Loader2 size={16} className="animate-spin" /> Creating account…</>
              ) : (
                <><span>Create account</span><ArrowRight size={16} /></>
              )}
            </button>

            <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
              Already have an account?{' '}
              <Link href="/login" className="font-medium transition-colors hover:underline" style={{ color: 'var(--blue)' }}>
                Log in
              </Link>
            </p>
          </form>
        </div>
      </div>
    </div>
  )
}
