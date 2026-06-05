'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({
    full_name: '', email: '', password: '',
    phone: '', ndsc_id: '', college_role: '', batch: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState(false)

  const handle = (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [e.target.name]: e.target.value })

  const submit = async () => {
    if (!form.full_name || !form.email || !form.password) {
      return setError('Name, email and password are required.')
    }
    if (form.password.length < 6) {
      return setError('Password must be at least 6 characters.')
    }
    setLoading(true)
    setError('')
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        college_role: form.college_role ? Number(form.college_role) : null
      })
    })
    const data = await res.json()
    setLoading(false)
    if (!res.ok) return setError(data.error)
    setSuccess(true)
  }

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid var(--border)',
    color: 'var(--white)',
  }

  const labelStyle = {
    color: 'var(--muted)',
  }

  if (success) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
      <div className="fixed inset-0 grid-bg opacity-30 pointer-events-none" />
      <div className="relative text-center max-w-md w-full mx-4">
        <div className="absolute -inset-1 rounded-2xl opacity-20 blur-xl"
          style={{ background: 'radial-gradient(circle, #00ff88 0%, transparent 70%)' }} />
        <div className="relative rounded-2xl p-10 border"
          style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
          <div className="text-6xl mb-4">✅</div>
          <h2 className="text-xl font-bold mb-2" style={{ fontFamily: "'Orbitron', sans-serif", color: '#00ff88' }}>
            Registration Successful!
          </h2>
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            Your account has been created and is pending admin approval.
          </p>
          <button onClick={() => router.push('/login')}
            className="px-6 py-2.5 rounded-lg font-semibold text-sm text-black transition-all"
            style={{ background: 'var(--blue)', fontFamily: "'Orbitron', sans-serif" }}>
            Go to Login
          </button>
        </div>
      </div>
    </div>
  )

  const fields = [
    { name: 'full_name', label: 'Full Name', placeholder: 'Your full name', type: 'text', required: true },
    { name: 'email', label: 'Email Address', placeholder: 'email@example.com', type: 'email', required: true },
    { name: 'password', label: 'Password', placeholder: 'Min. 6 characters', type: 'password', required: true },
    { name: 'phone', label: 'Phone Number', placeholder: '01XXXXXXXXX', type: 'text' },
    { name: 'ndsc_id', label: 'NDSC ID', placeholder: 'NDSC-XXXX', type: 'text' },
    { name: 'college_role', label: 'College Roll Number', placeholder: 'e.g. 101', type: 'number' },
    { name: 'batch', label: 'Batch', placeholder: 'e.g. 2024', type: 'text' },
  ]

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
              style={{ background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)' }}>
              <span className="text-2xl">🚀</span>
            </div>
            <h1 className="text-xl font-bold mb-1" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }}>
              Create Account
            </h1>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Join NDSC as a member</p>
          </div>

          {error && (
            <div className="px-4 py-3 rounded-lg mb-5 text-sm border"
              style={{ background: 'rgba(255,50,50,0.08)', borderColor: 'rgba(255,80,80,0.3)', color: '#ff7070' }}>
              {error}
            </div>
          )}

          <div className="space-y-4">
            {fields.map(f => (
              <div key={f.name}>
                <label className="block text-xs font-medium mb-1.5 uppercase tracking-wider" style={labelStyle}>
                  {f.label} {f.required && <span style={{ color: 'var(--blue)' }}>*</span>}
                </label>
                <input
                  name={f.name} type={f.type}
                  value={(form as any)[f.name]}
                  onChange={handle}
                  placeholder={f.placeholder}
                  className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all"
                  style={inputStyle}
                  onFocus={e => e.target.style.borderColor = 'var(--blue)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border)'}
                />
              </div>
            ))}

            <button
              onClick={submit} disabled={loading}
              className="w-full py-2.5 rounded-lg font-semibold text-sm transition-all mt-2 text-black"
              style={{
                background: loading ? 'rgba(0,212,255,0.4)' : 'var(--blue)',
                fontFamily: "'Orbitron', sans-serif",
                letterSpacing: '0.05em',
                opacity: loading ? 0.7 : 1,
              }}>
              {loading ? 'Please wait...' : 'Register'}
            </button>

            <p className="text-center text-sm" style={{ color: 'var(--muted)' }}>
              Already have an account?{' '}
              <Link href="/login" className="font-medium transition-colors hover:underline" style={{ color: 'var(--blue)' }}>
                Login
              </Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
