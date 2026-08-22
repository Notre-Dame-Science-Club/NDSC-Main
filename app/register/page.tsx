'use client'
// app/register/page.tsx
//
// Member sign-up. Two paths share this screen:
//   - Email/password (default), always available.
//   - OAuth (Google), rendered on top when NEXT_PUBLIC_AUTH_ENABLE_OAUTH is
//     enabled (default) — a fallback so users are never locked out.
//
// On success the member is asked to upload a payment slip; an admin reviews
// it and approves the account. Field-level errors validate on blur + submit;
// server errors (duplicate email, etc.) surface in a top banner.

import { useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowRight, CheckCircle, Eye, EyeOff, Loader2, Upload, UserPlus } from 'lucide-react'
import Input from '@/components/ui/Input'
import OAuthButton from '@/components/auth/OAuthButton'
import { isOAuthEnabled } from '@/lib/authConfig'

const MAX_SLIP_MB = 10
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const ROLL_RE = /^\d{8}$/
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

type FieldName = 'full_name' | 'email' | 'password' | 'phone' | 'ndsc_id' | 'college_roll' | 'batch'
type FieldErrors = Partial<Record<FieldName, string>>

/** Validated fields — the ones that gate submission. */
const REQUIRED_FIELDS: FieldName[] = ['full_name', 'email', 'password', 'college_roll']

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

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState<Record<FieldName, string>>({
    full_name: '', email: '', password: '', phone: '', ndsc_id: '', college_roll: '', batch: '',
  })
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({})
  const [serverError, setServerError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipError, setSlipError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handle = (e: React.ChangeEvent<HTMLInputElement>) => {
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
      case 'college_roll':
        return ROLL_RE.test(trimmed) ? undefined : 'Notre Dame College roll numbers are exactly 8 digits.'
      default:
        return undefined
    }
  }

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const name = e.target.name as FieldName
    const msg = validateField(name)
    const next = { ...fieldErrors }
    if (msg) next[name] = msg
    else delete next[name]
    setFieldErrors(next)
  }

  const handleSlipSelect = (f: File | null) => {
    setSlipError('')
    if (!f) { setSlipFile(null); return }
    if (f.size > MAX_SLIP_MB * 1024 * 1024) {
      setSlipFile(null)
      setSlipError(`File too large. Maximum size is ${MAX_SLIP_MB}MB.`)
      return
    }
    if (f.type && !ALLOWED_TYPES.includes(f.type)) {
      setSlipFile(null)
      setSlipError('Invalid file type. Please upload a JPG, PNG, or WEBP image.')
      return
    }
    setSlipFile(f)
  }

  const uploadSlip = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'membership-slips')
      const xhr = new XMLHttpRequest()
      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) setUploadProgress(Math.round((e.loaded / e.total) * 100))
      })
      xhr.addEventListener('load', () => {
        try {
          const data = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300 && data.url) resolve(data.url)
          else reject(new Error(data.error || 'Upload failed'))
        } catch { reject(new Error('Upload failed. Please try again.')) }
      })
      xhr.addEventListener('error', () => reject(new Error('Network error during upload.')))
      xhr.open('POST', '/api/member-upload')
      xhr.send(fd)
    })
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
    setUploadProgress(0)
    try {
      const payment_slip_url = slipFile ? await uploadSlip(slipFile) : undefined
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...form, payment_slip_url }),
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
            Your account has been created. Once you&apos;ve submitted your membership slip — either
            now or later from your dashboard — an admin will review it and approve your account.
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
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Join Notre Dame Science Club</p>
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
            <section aria-labelledby="section-account">
              <div className="section-label" id="section-account">Account</div>
              <div className="space-y-4">
                <FieldRow
                  name="full_name" label="Full Name" required autoComplete="name"
                  placeholder="Your full name" value={form.full_name}
                  onChange={handle} onBlur={handleBlur} disabled={loading}
                  error={fieldErrors.full_name}
                />
                <FieldRow
                  name="email" label="Email Address" required type="email" autoComplete="email"
                  placeholder="email@example.com" value={form.email}
                  onChange={handle} onBlur={handleBlur} disabled={loading}
                  error={fieldErrors.email}
                />
                <FieldRow
                  name="password" label="Password" required type={showPassword ? 'text' : 'password'}
                  autoComplete="new-password" placeholder="Min. 6 characters" value={form.password}
                  onChange={handle} onBlur={handleBlur} disabled={loading}
                  error={fieldErrors.password} rightSlot={passwordToggle}
                />
              </div>
            </section>

            <section aria-labelledby="section-membership">
              <div className="section-label" id="section-membership">Membership</div>
              <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
                Your details as a Notre Dame College student.
              </p>
              <div className="space-y-4">
                <FieldRow
                  name="college_roll" label="College Roll Number" required inputMode="numeric"
                  placeholder="8 digits, e.g. 24010123" value={form.college_roll}
                  onChange={handle} onBlur={handleBlur} disabled={loading}
                  error={fieldErrors.college_roll}
                />
                <FieldRow
                  name="batch" label="Batch" inputMode="numeric"
                  placeholder="e.g. 2024" value={form.batch}
                  onChange={handle} onBlur={handleBlur} disabled={loading}
                />
                <FieldRow
                  name="ndsc_id" label="NDSC ID" autoComplete="off"
                  placeholder="NDSC-XXXX (if known)" value={form.ndsc_id}
                  onChange={handle} onBlur={handleBlur} disabled={loading}
                />
                <FieldRow
                  name="phone" label="Phone Number" type="tel" inputMode="tel" autoComplete="tel"
                  placeholder="01XXXXXXXXX" value={form.phone}
                  onChange={handle} onBlur={handleBlur} disabled={loading}
                />
              </div>
            </section>

            <section aria-labelledby="section-slip">
              <div className="flex items-center gap-2 mb-1.5">
                <div className="section-label" id="section-slip" style={{ marginBottom: 0 }}>Membership Slip</div>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>optional</span>
              </div>
              <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                Already paid the 200 taka fee and submitted your form at the control room? Upload a photo of
                the slip here. Not there yet, or joining from another school? Skip it — you can add it anytime
                from your dashboard.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                onDragOver={e => e.preventDefault()}
                onDrop={e => { e.preventDefault(); handleSlipSelect(e.dataTransfer.files?.[0] || null) }}
                aria-label="Upload membership slip photo"
                className="flex flex-col items-center justify-center w-full rounded-xl border-2 border-dashed cursor-pointer transition-colors hover:bg-white/5"
                style={{
                  borderColor: slipFile ? 'var(--blue)' : 'var(--border)',
                  background: 'rgba(255,255,255,0.02)',
                  minHeight: '7rem',
                  padding: '1.25rem',
                }}
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                  className="hidden"
                  disabled={loading}
                  onChange={e => handleSlipSelect(e.target.files?.[0] || null)}
                />
                {slipFile ? (
                  <div className="text-center pointer-events-none">
                    <CheckCircle size={22} style={{ color: 'var(--blue)' }} className="mx-auto mb-1" />
                    <p className="text-xs font-medium" style={{ color: 'var(--blue)' }}>{slipFile.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Tap to change</p>
                  </div>
                ) : (
                  <div className="text-center pointer-events-none">
                    <Upload size={20} className="mx-auto mb-1.5" style={{ color: 'var(--muted)' }} />
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>Upload slip photo — max {MAX_SLIP_MB}MB</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)', opacity: 0.7 }}>or drag &amp; drop here</p>
                  </div>
                )}
              </button>
              {slipError && <p role="alert" className="text-xs mt-1.5" style={{ color: 'var(--danger-soft)' }}>{slipError}</p>}
              {loading && slipFile && (
                <div className="mt-2" role="progressbar" aria-valuenow={uploadProgress} aria-valuemin={0} aria-valuemax={100}
                  aria-label="Uploading slip">
                  <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'var(--border)' }}>
                    <div className="h-full rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%`, background: 'var(--blue)' }} />
                  </div>
                </div>
              )}
            </section>

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
