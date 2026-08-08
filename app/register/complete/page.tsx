'use client'
// app/register/complete/page.tsx
//
// Final step of the OAuth sign-up flow. A provider (Google) authenticates
// the person and supplies email + name, but NDSC membership also requires
// an 8-digit college roll, batch, etc. — so first-time OAuth users land
// here to fill those in, then get a `members` row created.
//
// Guards:
//   - No session        → /login
//   - Already a member  → /dashboard

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Upload, CheckCircle, UserPlus } from 'lucide-react'

const MAX_SLIP_MB = 10
const ALLOWED_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
const ROLL_RE = /^\d{8}$/

export default function CompleteRegistrationPage() {
  const router = useRouter()
  const [checking, setChecking] = useState(true)

  const [form, setForm] = useState({
    full_name: '',
    college_roll: '',
    batch: '',
    phone: '',
    ndsc_id: '',
  })

  const [slipFile, setSlipFile] = useState<File | null>(null)
  const [slipError, setSlipError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  // Resolve the session and decide: dashboard vs. form.
  useEffect(() => {
    let cancelled = false
    const load = async () => {
      const { data: { user }, error: userError } = await supabase.auth.getUser()
      if (userError || !user) {
        router.replace('/login')
        return
      }
      const { data: member } = await supabase
        .from('members')
        .select('id')
        .eq('id', user.id)
        .maybeSingle()
      if (cancelled) return
      if (member) {
        // Already a member — nothing to complete.
        router.replace('/dashboard')
        return
      }
      // Pre-fill the name from the provider's user_metadata.
      const providedName =
        user.user_metadata?.full_name || user.user_metadata?.name || user.user_metadata?.given_name || ''
      setForm(f => ({ ...f, full_name: providedName }))
      setChecking(false)
    }
    load()
    return () => { cancelled = true }
  }, [router])

  const handle = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

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

  const uploadSlip = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
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

  const submit = async () => {
    if (!form.full_name.trim()) return setError('Full name is required.')
    if (!ROLL_RE.test(form.college_roll)) {
      return setError('Notre Dame College roll numbers are exactly 8 digits.')
    }
    setLoading(true)
    setError('')
    setUploadProgress(0)
    try {
      const payment_slip_url = slipFile ? await uploadSlip(slipFile) : undefined
      const { data: { session } } = await supabase.auth.getSession()
      if (!session) throw new Error('Your session has expired. Please sign in again.')
      const res = await fetch('/api/auth/oauth/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${session.access_token}` },
        body: JSON.stringify({ ...form, payment_slip_url }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error); setLoading(false); return }
      setSuccess(true)
    } catch (e: any) {
      setError(e.message || 'Something went wrong. Please try again.')
      setLoading(false)
    }
  }

  const fullName = form.full_name
  const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--white)' }

  if (checking) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="fixed inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="text-center">
          <div className="inline-block w-8 h-8 rounded-full border-2 border-t-transparent animate-spin mb-3"
            style={{ borderColor: 'var(--blue)', borderTopColor: 'transparent' }} />
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Checking your account…</p>
        </div>
      </div>
    )
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="fixed inset-0 grid-bg opacity-30 pointer-events-none" />
        <div className="relative text-center max-w-md w-full mx-4">
          <div className="absolute -inset-1 rounded-2xl opacity-20 blur-xl"
            style={{ background: 'radial-gradient(circle, var(--success) 0%, transparent 70%)' }} />
          <div className="relative rounded-2xl p-10 border" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
            <div className="mb-4 flex justify-center" style={{ color: 'var(--success)' }}><CheckCircle size={56} /></div>
            <h2 className="text-xl font-bold mb-2" style={{ fontFamily: 'inherit', color: 'var(--success)' }}>
              All set!
            </h2>
            <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
              Your membership has been saved. You can upload your membership slip from the dashboard —
              an admin will review it and approve your account.
            </p>
            <button onClick={() => router.push('/dashboard')}
              className="px-6 py-2.5 rounded-lg font-semibold text-sm text-black transition-all"
              style={{ background: 'var(--blue)', fontFamily: 'inherit' }}>
              Go to Dashboard
            </button>
          </div>
        </div>
      </div>
    )
  }

  const fields = [
    { name: 'college_roll', label: 'College Roll Number (8 digits)', placeholder: 'e.g. 24010123', type: 'text', required: true },
    { name: 'batch', label: 'Batch', placeholder: 'e.g. 2024', type: 'text' },
    { name: 'phone', label: 'Phone Number', placeholder: '01XXXXXXXXX', type: 'text' },
    { name: 'ndsc_id', label: 'NDSC ID (if known)', placeholder: 'NDSC-XXXX', type: 'text' },
  ]

  return (
    <div className="min-h-screen flex items-center justify-center py-12" style={{ background: 'var(--bg)' }}>
      <div className="fixed inset-0 grid-bg opacity-30 pointer-events-none" />

      <div className="relative w-full max-w-md mx-4">
        <div className="absolute -inset-1 rounded-2xl opacity-25 blur-xl"
          style={{ background: 'radial-gradient(circle, var(--blue) 0%, transparent 70%)' }} />

        <div className="relative rounded-2xl p-8 border" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>

          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-14 h-14 rounded-full mb-4"
              style={{ background: 'rgba(var(--blue-rgb), 0.1)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
              <UserPlus size={22} style={{ color: 'var(--blue)' }} />
            </div>
            <h1 className="text-xl font-bold mb-1" style={{ fontFamily: 'inherit', color: 'var(--blue)' }}>
              Complete Your Membership
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              Your Google account is verified. Just a few more details to join NDSC.
            </p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-lg mb-5 text-sm border"
              style={{ background: 'rgba(255,50,50,0.08)', borderColor: 'rgba(var(--danger-rgb), 0.3)', color: 'var(--danger-soft)' }}>
              {error}
            </div>
          )}

          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Full Name <span style={{ color: 'var(--blue)' }}>*</span>
              </label>
              <input
                name="full_name" type="text" value={form.full_name} onChange={handle}
                placeholder="Your full name"
                className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
                style={inputStyle}
                onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                onBlur={e => e.target.style.borderColor = 'var(--border)'}
              />
            </div>

            {fields.map(f => (
              <div key={f.name}>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                  {f.label} {f.required && <span style={{ color: 'var(--blue)' }}>*</span>}
                </label>
                <input
                  name={f.name} type={f.type} value={(form as any)[f.name]} onChange={handle}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            ))}

            <div>
              <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={{ color: 'var(--muted)' }}>
                Membership Slip <span style={{ color: 'var(--muted)' }}>(optional)</span>
              </label>
              <label className="flex flex-col items-center justify-center w-full h-28 rounded-lg border-2 border-dashed cursor-pointer"
                style={{ borderColor: slipFile ? 'var(--blue)' : 'var(--border)', background: 'rgba(255,255,255,0.02)' }}>
                <input type="file" accept="image/jpeg,image/png,image/webp,image/heic,image/heif" className="hidden"
                  disabled={loading} onChange={e => handleSlipSelect(e.target.files?.[0] || null)} />
                {slipFile ? (
                  <div className="text-center">
                    <CheckCircle size={22} style={{ color: 'var(--blue)' }} className="mx-auto mb-1" />
                    <p className="text-xs font-medium" style={{ color: 'var(--blue)' }}>{slipFile.name}</p>
                    <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>Tap to change</p>
                  </div>
                ) : (
                  <div className="text-center">
                    <Upload size={20} className="mx-auto mb-1.5" style={{ color: 'var(--muted)' }} />
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>Upload slip photo — max {MAX_SLIP_MB}MB</p>
                  </div>
                )}
              </label>
              {slipError && <p className="text-xs mt-1.5" style={{ color: 'var(--danger-soft)' }}>{slipError}</p>}
              {loading && slipFile && (
                <div className="mt-2">
                  <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'var(--border)' }}>
                    <div className="h-full rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%`, background: 'var(--blue)' }} />
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={submit} disabled={loading}
              className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all mt-2 text-black"
              style={{
                background: loading ? 'rgba(var(--blue-rgb), 0.4)' : 'var(--blue)',
                fontFamily: 'inherit',
                letterSpacing: '0.05em',
                opacity: loading ? 0.7 : 1,
              }}>
              {loading ? 'Please wait...' : 'Finish Registration'}
            </button>

            <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
              Already a member?{' '}
              <Link href="/dashboard" className="font-medium transition-colors hover:underline" style={{ color: 'var(--blue)' }}>
                Go to Dashboard
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}