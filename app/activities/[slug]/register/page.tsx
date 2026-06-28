'use client'
import { useEffect, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ArrowLeft, Upload, CheckCircle, Users, Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const uid = () => Math.random().toString(36).slice(2, 9)

type Category = {
  id: string; parent_id: string | null; name: string; description: string | null
  custom_fields: any[]; requires_team: boolean; team_size_min: number | null; team_size_max: number | null
  team_member_fields: any[]; requires_payment: boolean; payment_amount: number | null; payment_label: string | null
  is_online_submission: boolean; linked_olympiad_id: string | null
  schedule_date: string | null; schedule_time: string | null; schedule_room: string | null
}

type Phase = 'identity' | 'picker' | 'form' | 'submitting' | 'done'

const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--white)' }
const inputCls = 'w-full px-3 py-2.5 rounded-lg text-sm outline-none'

export default function ActivityRegisterPage() {
  const params = useParams()
  const router = useRouter()
  const slug = params.slug as string

  const [phase, setPhase] = useState<Phase>('identity')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [path, setPath] = useState<Category[]>([]) // breadcrumb of chosen categories down to the leaf

  // Identity
  const [identityChecked, setIdentityChecked] = useState(false)
  const [lookupQuery, setLookupQuery] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [knownInfo, setKnownInfo] = useState<any>(null)
  const [memberId, setMemberId] = useState<string | null>(null)

  // Form
  const [form, setForm] = useState({ full_name: '', phone: '', email: '', college: 'Notre Dame College', college_roll: '', hsc_session: '' })
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    fetch(`/api/activity-reg-categories-public?slug=${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setSessionInfo(d.session)
        setCategories(d.categories || [])
      })
      .catch(() => setError('Could not load this activity.'))
      .finally(() => setLoading(false))

    // If already a logged-in member, skip the identity-lookup prompt entirely.
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: member } = await supabase.from('members').select('*').eq('id', user.id).single()
      if (member) {
        setMemberId(member.id)
        setKnownInfo({
          full_name: member.full_name, phone: member.phone, email: member.email,
          college: 'Notre Dame College', college_roll: member.college_roll, hsc_session: member.batch || '',
        })
        setForm(f => ({ ...f,
          full_name: member.full_name || '', phone: member.phone || '', email: member.email || '',
          college_roll: member.college_roll || '', hsc_session: member.batch || '',
        }))
        setIdentityChecked(true)
        setPhase('picker')
      }
    })
  }, [slug])

  const isLeaf = (cat: Category) => !categories.some(c => c.parent_id === cat.id)

  const lookupIdentity = async () => {
    if (!lookupQuery.trim()) { setIdentityChecked(true); setPhase('picker'); return }
    setLookupLoading(true)
    try {
      const res = await fetch('/api/identity-lookup', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: lookupQuery.trim() }),
      })
      const data = await res.json()
      if (data.found) {
        setKnownInfo(data.info)
        setForm(f => ({ ...f, ...data.info }))
      }
    } catch { /* non-critical, just proceed without prefill */ }
    setLookupLoading(false)
    setIdentityChecked(true)
    setPhase('picker')
  }

  const pickCategory = (cat: Category) => {
    setPath(prev => [...prev, cat])
    if (isLeaf(cat)) {
      // Reset team members sized to this leaf's minimum, so the form starts
      // with the right number of slots instead of zero.
      const min = cat.team_size_min || 0
      setTeamMembers(Array.from({ length: min }, () => ({ id: uid(), full_name: '', email: '', college_roll: '', password: '', custom_answers: {} })))
      setPhase('form')
    }
  }

  const goBack = () => {
    if (phase === 'form') { setPath(prev => prev.slice(0, -1)); setPhase('picker'); return }
    setPath(prev => prev.slice(0, -1))
  }

  const currentLevelOptions = categories.filter(c => c.parent_id === (path[path.length - 1]?.id || null))
  const currentLeaf = path[path.length - 1]

  const uploadFieldFile = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fd = new FormData()
      fd.append('file', file)
      const xhr = new XMLHttpRequest()
      xhr.addEventListener('load', () => {
        try {
          const data = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300 && data.url) resolve(data.url)
          else reject(new Error(data.error || 'Upload failed'))
        } catch { reject(new Error('Upload failed.')) }
      })
      xhr.addEventListener('error', () => reject(new Error('Network error during upload.')))
      xhr.open('POST', '/api/activity-upload')
      xhr.send(fd)
    })
  }

  const handleCustomFileField = async (key: string, file: File | null) => {
    if (!file) return
    try {
      const url = await uploadFieldFile(file)
      setCustomAnswers(prev => ({ ...prev, [key]: url }))
    } catch (e: any) {
      setError(e.message || 'Upload failed.')
    }
  }

  const handleTeamFileField = async (memberIdx: number, key: string, file: File | null) => {
    if (!file) return
    try {
      const url = await uploadFieldFile(file)
      setTeamMembers(prev => prev.map((m, i) => i === memberIdx ? { ...m, custom_answers: { ...m.custom_answers, [key]: url } } : m))
    } catch (e: any) {
      setError(e.message || 'Upload failed.')
    }
  }

  const submit = async () => {
    if (!currentLeaf) return
    setError('')
    if (!form.full_name.trim()) return setError('Name is required.')
    if (!form.phone.trim()) return setError('Phone number is required.')
    if (!form.email.trim()) return setError('Email is required.')
    if (!form.college_roll.trim()) return setError('College roll is required.')

    setSubmitting(true)
    setPhase('submitting')
    try {
      const res = await fetch('/api/activity-register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: currentLeaf.id,
          ...form,
          custom_answers: customAnswers,
          team_members: currentLeaf.requires_team ? teamMembers : undefined,
          member_id: memberId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed.')

      // Online-submission leaf: hand off straight into the Olympiad flow —
      // Activity and Olympiad registration are the same system underneath.
      if (currentLeaf.is_online_submission && currentLeaf.linked_olympiad_id) {
        router.push(`/olympiad?id=${currentLeaf.linked_olympiad_id}`)
        return
      }

      // Payment required: hand off to the payment init flow.
      if (currentLeaf.requires_payment) {
        const payRes = await fetch('/api/payment/init', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ registration_id: data.registration.id }),
        })
        const payData = await payRes.json()
        if (payRes.ok && payData.gatewayUrl) {
          window.location.href = payData.gatewayUrl
          return
        }
        // Payment init failed — still show success, registration is saved
        // as 'pending' and can be paid later from the dashboard.
      }

      localStorage.setItem('ndsc_activity_reg_id', data.registration.id)
      router.push(`/activities/${slug}/dashboard?reg=${data.registration.id}`)
    } catch (e: any) {
      setError(e.message || 'Something went wrong.')
      setPhase('form')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}><p style={{ color: 'var(--muted)' }}>Loading...</p></div>
  if (error && !sessionInfo) return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}>
      <p style={{ color: '#ff7070' }}>{error}</p>
    </div>
  )

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: 'var(--bg)', paddingTop: '88px' }}>
      <div className="max-w-lg mx-auto">
        <Link href={`/activities/${slug}`} className="inline-flex items-center gap-2 text-sm mb-6" style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={14} /> Back to activity
        </Link>

        <h1 className="text-2xl font-black mb-2" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--white)' }}>
          {sessionInfo?.title}
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
          {path.length > 0 ? path.map(p => p.name).join(' → ') : 'Choose your category to begin'}
        </p>

        {error && (
          <div className="mb-5 p-3 rounded-lg text-sm" style={{ background: 'rgba(255,80,80,0.1)', color: '#ff7070', border: '1px solid rgba(255,80,80,0.3)' }}>
            {error}
          </div>
        )}

        {/* IDENTITY STEP */}
        {phase === 'identity' && !identityChecked && (
          <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
            <p className="text-sm mb-3" style={{ color: 'var(--white)' }}>
              Registered with NDSC before? Enter your college roll or email and we'll skip the basic info.
            </p>
            <input value={lookupQuery} onChange={e => setLookupQuery(e.target.value)}
              placeholder="College roll or email (optional)" className={inputCls} style={inputStyle} />
            <button onClick={lookupIdentity} disabled={lookupLoading}
              className="w-full mt-3 py-2.5 rounded-lg text-sm font-bold text-black disabled:opacity-60"
              style={{ background: 'var(--blue)' }}>
              {lookupLoading ? 'Checking...' : 'Continue'}
            </button>
          </div>
        )}

        {/* CATEGORY PICKER */}
        {phase === 'picker' && (
          <div className="space-y-3">
            {path.length > 0 && (
              <button onClick={goBack} className="flex items-center gap-1.5 text-sm mb-2" style={{ color: 'var(--blue)' }}>
                <ArrowLeft size={13} /> Back
              </button>
            )}
            {currentLevelOptions.length === 0 ? (
              <p className="text-sm" style={{ color: 'var(--muted)' }}>No options available here yet.</p>
            ) : currentLevelOptions.map(cat => (
              <button key={cat.id} onClick={() => pickCategory(cat)}
                className="w-full flex items-center justify-between gap-3 p-4 rounded-xl border text-left transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
                <div>
                  <p className="font-semibold text-sm" style={{ color: 'var(--white)' }}>{cat.name}</p>
                  {cat.description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{cat.description}</p>}
                  {isLeaf(cat) && (
                    <div className="flex gap-2 mt-1.5">
                      {cat.requires_team && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>Team event</span>}
                      {cat.requires_payment && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(255,179,71,0.1)', color: '#ffb347' }}>{cat.payment_label || 'Fee'}: ৳{cat.payment_amount}</span>}
                    </div>
                  )}
                </div>
                <ChevronRight size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}

        {/* LEAF REGISTRATION FORM */}
        {phase === 'form' && currentLeaf && (
          <div className="space-y-4">
            <button onClick={goBack} className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--blue)' }}>
              <ArrowLeft size={13} /> Change category
            </button>

            {currentLeaf.schedule_date && (
              <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(52,211,153,0.08)', color: '#34d399' }}>
                📅 {new Date(currentLeaf.schedule_date).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })}
                {currentLeaf.schedule_time && ` — ${currentLeaf.schedule_time}`}
                {currentLeaf.schedule_room && ` — ${currentLeaf.schedule_room}`}
              </div>
            )}

            {knownInfo && (
              <p className="text-xs px-1" style={{ color: 'var(--muted)' }}>
                ✓ We've pre-filled your info from a previous registration — update anything that's changed.
              </p>
            )}

            <div className="grid grid-cols-2 gap-3">
              <input placeholder="Full name *" value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} style={inputStyle} />
              <input placeholder="Phone *" value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <input placeholder="Email *" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} style={inputStyle} />
            <div className="grid grid-cols-2 gap-3">
              <input placeholder="College *" value={form.college} onChange={e => setForm(f => ({ ...f, college: e.target.value }))} className={inputCls} style={inputStyle} />
              <input placeholder="College roll *" value={form.college_roll} onChange={e => setForm(f => ({ ...f, college_roll: e.target.value }))} className={inputCls} style={inputStyle} />
            </div>
            <input placeholder="HSC session (optional)" value={form.hsc_session} onChange={e => setForm(f => ({ ...f, hsc_session: e.target.value }))} className={inputCls} style={inputStyle} />

            {currentLeaf.custom_fields?.length > 0 && (
              <div className="space-y-3 pt-2">
                {currentLeaf.custom_fields.map((field: any) => (
                  <div key={field.key}>
                    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--white)' }}>
                      {field.label} {field.required && <span style={{ color: 'var(--blue)' }}>*</span>}
                    </label>
                    {field.description && <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>{field.description}</p>}
                    {field.type === 'textarea' ? (
                      <textarea rows={3} value={customAnswers[field.key] || ''} onChange={e => setCustomAnswers(p => ({ ...p, [field.key]: e.target.value }))} className={inputCls + ' resize-none'} style={inputStyle} />
                    ) : field.type === 'photo' ? (
                      <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer text-sm" style={{ ...inputStyle, color: 'var(--blue)' }}>
                        <Upload size={14} /> {customAnswers[field.key] ? 'Photo uploaded ✓' : 'Upload photo'}
                        <input type="file" accept="image/*" className="hidden" onChange={e => handleCustomFileField(field.key, e.target.files?.[0] || null)} />
                      </label>
                    ) : (
                      <input type={field.type === 'number' ? 'number' : 'text'} value={customAnswers[field.key] || ''} onChange={e => setCustomAnswers(p => ({ ...p, [field.key]: e.target.value }))} className={inputCls} style={inputStyle} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {currentLeaf.requires_team && (
              <div className="pt-2">
                <p className="text-sm font-bold flex items-center gap-2 mb-3" style={{ color: '#a78bfa' }}>
                  <Users size={15} /> Team Members ({teamMembers.length})
                </p>
                <div className="space-y-3">
                  {teamMembers.map((m, idx) => (
                    <div key={m.id} className="p-3 rounded-lg space-y-2" style={{ background: 'rgba(167,139,250,0.05)', border: '1px solid rgba(167,139,250,0.2)' }}>
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-semibold" style={{ color: '#a78bfa' }}>Member {idx + 1}</p>
                        {teamMembers.length > (currentLeaf.team_size_min || 0) && (
                          <button onClick={() => setTeamMembers(prev => prev.filter((_, i) => i !== idx))}><X size={13} style={{ color: '#ff7070' }} /></button>
                        )}
                      </div>
                      <input placeholder="Full name" value={m.full_name} onChange={e => setTeamMembers(prev => prev.map((x, i) => i === idx ? { ...x, full_name: e.target.value } : x))} className={inputCls} style={inputStyle} />
                      <input placeholder="Email" value={m.email} onChange={e => setTeamMembers(prev => prev.map((x, i) => i === idx ? { ...x, email: e.target.value } : x))} className={inputCls} style={inputStyle} />
                      <input placeholder="College roll" value={m.college_roll} onChange={e => setTeamMembers(prev => prev.map((x, i) => i === idx ? { ...x, college_roll: e.target.value } : x))} className={inputCls} style={inputStyle} />
                      <input type="password" placeholder="Set a password for them (min 6 chars)" value={m.password} onChange={e => setTeamMembers(prev => prev.map((x, i) => i === idx ? { ...x, password: e.target.value } : x))} className={inputCls} style={inputStyle} />
                      {(currentLeaf.team_member_fields || []).map((field: any) => (
                        <div key={field.key}>
                          {field.type === 'photo' ? (
                            <label className="flex items-center gap-2 px-3 py-2 rounded-lg border cursor-pointer text-xs" style={{ ...inputStyle, color: 'var(--blue)' }}>
                              <Upload size={12} /> {m.custom_answers?.[field.key] ? `${field.label} ✓` : field.label}
                              <input type="file" accept="image/*" className="hidden" onChange={e => handleTeamFileField(idx, field.key, e.target.files?.[0] || null)} />
                            </label>
                          ) : (
                            <input placeholder={field.label} value={m.custom_answers?.[field.key] || ''}
                              onChange={e => setTeamMembers(prev => prev.map((x, i) => i === idx ? { ...x, custom_answers: { ...x.custom_answers, [field.key]: e.target.value } } : x))}
                              className={inputCls} style={inputStyle} />
                          )}
                        </div>
                      ))}
                    </div>
                  ))}
                </div>
                {teamMembers.length < (currentLeaf.team_size_max || 99) && (
                  <button onClick={() => setTeamMembers(prev => [...prev, { id: uid(), full_name: '', email: '', college_roll: '', password: '', custom_answers: {} }])}
                    className="mt-2 flex items-center gap-1 text-xs px-3 py-1.5 rounded" style={{ background: 'rgba(167,139,250,0.1)', color: '#a78bfa' }}>
                    <Plus size={12} /> Add team member
                  </button>
                )}
                <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                  Each member will get an email with their login info and the password you set for them.
                </p>
              </div>
            )}

            {currentLeaf.requires_payment && (
              <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(255,179,71,0.08)', color: '#ffb347' }}>
                💳 {currentLeaf.payment_label || 'Registration fee'}: ৳{currentLeaf.payment_amount} — you'll be redirected to pay after submitting.
              </div>
            )}

            <button onClick={submit} disabled={submitting}
              className="w-full py-3 rounded-xl font-bold text-sm text-black disabled:opacity-60"
              style={{ background: 'var(--blue)', fontFamily: "'Orbitron', sans-serif" }}>
              {submitting ? 'Submitting...' : 'Submit Registration'}
            </button>
          </div>
        )}

        {phase === 'submitting' && (
          <div className="text-center py-12">
            <p style={{ color: 'var(--muted)' }}>Submitting your registration...</p>
          </div>
        )}
      </div>
    </div>
  )
}
