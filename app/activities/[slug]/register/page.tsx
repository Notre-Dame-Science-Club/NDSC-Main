'use client'
import { useEffect, useState, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ChevronRight, ArrowLeft, Upload, Users, Plus, X } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const uid = () => Math.random().toString(36).slice(2, 9)

// Per-session storage key so each event remembers its own registration
function sessionRegKey(sessionId: string) { return `ndsc_reg_${sessionId}` }
const PRIMARY_INFO_KEY = 'ndsc_primary_info'

type Category = {
  id: string; parent_id: string | null; name: string; description: string | null
  custom_fields: any[]; requires_team: boolean; team_size_min: number | null; team_size_max: number | null
  team_member_fields: any[]; requires_payment: boolean; payment_amount: number | null; payment_label: string | null
  is_online_submission: boolean; linked_olympiad_id: string | null
  schedule_date: string | null; schedule_time: string | null; schedule_room: string | null
  project_name_enabled: boolean; project_name_label: string | null
}

type Phase = 'identity' | 'picker' | 'form' | 'submitting' | 'done'

const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--white)' }
const inputCls = 'w-full px-3 py-2.5 rounded-lg text-sm outline-none'

const BLANK_FORM = { full_name: '', phone: '', email: '', college: 'Notre Dame College', college_roll: '', hsc_session: '', division: '' }

// Resolves formConfig.bg_theme ('default' | '#hexcolor') into an actual accent color.
function resolveAccent(theme: string | undefined | null) {
  if (theme && theme !== 'default' && /^#[0-9a-fA-F]{3,8}$/.test(theme)) return theme
  return 'var(--blue)'
}

// Shared label style for EVERY field on this form — primary, custom, and
// config extra fields all use the exact same title styling so nothing looks
// "more important" than anything else (the inconsistency reported earlier).
const fieldLabelCls = 'block text-sm font-medium mb-1'
const fieldDescCls = 'text-xs mb-1.5'

function ActivityRegisterPageInner() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const startCategoryId = searchParams.get('start')
  const slug = params.slug as string

  const [phase, setPhase] = useState<Phase>('identity')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [sessionInfo, setSessionInfo] = useState<any>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [path, setPath] = useState<Category[]>([])

  // Identity / pre-fill
  const [identityChecked, setIdentityChecked] = useState(false)
  const [lookupQuery, setLookupQuery] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [knownInfo, setKnownInfo] = useState<any>(null)
  const [memberId, setMemberId] = useState<string | null>(null)
  const [deepLinkIsLeaf, setDeepLinkIsLeaf] = useState(false)

  // Form fields
  const [form, setForm] = useState(BLANK_FORM)
  const [projectName, setProjectName] = useState('')
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({})
  const [teamMembers, setTeamMembers] = useState<any[]>([])
  const [submitting, setSubmitting] = useState(false)

  // Form config from admin (title overrides, extra fields, contact)
  const [formConfig, setFormConfig] = useState<any>(null)
  const [showFullDesc, setShowFullDesc] = useState(false)

  useEffect(() => {
    fetch(`/api/activity-reg-categories-public?slug=${slug}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) { setError(d.error); return }
        setSessionInfo(d.session)
        setCategories(d.categories || [])

        // Deep-link from the Olympiad page (?start=<categoryId>) — jump the
        // picker straight to that primary field's children instead of the
        // top-level list, since the person already chose it by clicking
        // that specific Olympiad card.
        if (startCategoryId) {
          const list: Category[] = d.categories || []
          const byId = new Map(list.map((c: Category) => [c.id, c]))
          const target = byId.get(startCategoryId)
          if (target) {
            const chain: Category[] = []
            let node: Category | undefined = target
            while (node) { chain.unshift(node); node = node.parent_id ? byId.get(node.parent_id) : undefined }
            setPath(chain)
            const targetIsLeaf = !list.some(c => c.parent_id === target.id)
            if (targetIsLeaf) {
              const min = target.team_size_min || 0
              setTeamMembers(Array.from({ length: min }, () => ({ id: uid(), full_name: '', email: '', college_roll: '', password: '', custom_answers: {} })))
              setDeepLinkIsLeaf(true)
            }
          }
        }

        // Load per-session form config
        if (d.session?.id) {
          fetch(`/api/form-config?form_key=activity_register:${d.session.id}`)
            .then(r => r.json())
            .then(async fc => {
              if (!fc.config) return
              // If admin chose to pull contacts from the EC page, resolve
              // those EC ids into actual contact-person objects here so the
              // rest of the page can treat it the same as manual contacts.
              if (fc.config.use_ec_page && fc.config.ec_ids?.length > 0) {
                try {
                  const ecRes = await fetch('/api/executives')
                  const ecList = await ecRes.json()
                  const resolved = (Array.isArray(ecList) ? ecList : [])
                    .filter((ec: any) => fc.config.ec_ids.includes(ec.id))
                    .map((ec: any) => ({
                      name: ec.full_name, post: ec.position, phone: '',
                      email: ec.email || '', whatsapp: ec.whatsapp || '', facebook: ec.facebook_url || '',
                    }))
                  fc.config.contact_persons = resolved
                } catch { /* fall back to whatever manual contacts exist */ }
              }
              setFormConfig(fc.config)
            })
            .catch(() => {})
        }
      })
      .catch(() => setError('Could not load this activity.'))
      .finally(() => setLoading(false))

    // 1. If member is logged in → pre-fill from member data, skip identity step
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) return
      const { data: member } = await supabase.from('members').select('*').eq('id', user.id).single()
      if (member) {
        setMemberId(member.id)
        const info = {
          full_name: member.full_name || '', phone: member.phone || '', email: member.email || '',
          college: 'Notre Dame College', college_roll: member.college_roll || '',
          hsc_session: member.batch || '', division: member.division || '',
        }
        setKnownInfo(info)
        setForm(f => ({ ...f, ...info }))
        setIdentityChecked(true)
        setPhase('picker')
      }
    })

    // 2. Check localStorage for previously saved primary info (non-member returning user)
    const saved = localStorage.getItem(PRIMARY_INFO_KEY)
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        setKnownInfo(parsed)
        setForm(f => ({ ...f, ...parsed }))
      } catch { /* ignore */ }
    }
  }, [slug])

  const isLeaf = (cat: Category) => !categories.some(c => c.parent_id === cat.id)

  // After identity is confirmed, go straight to the form if we arrived via
  // a leaf-level Olympiad deep-link, otherwise go to the picker as normal.
  const proceedAfterIdentity = () => setPhase(deepLinkIsLeaf ? 'form' : 'picker')

  const lookupIdentity = async () => {
    if (!lookupQuery.trim()) { setIdentityChecked(true); proceedAfterIdentity(); return }
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
    } catch { /* non-critical */ }
    setLookupLoading(false)
    setIdentityChecked(true)
    proceedAfterIdentity()
  }

  const pickCategory = (cat: Category) => {
    setPath(prev => [...prev, cat])
    if (isLeaf(cat)) {
      const min = cat.team_size_min || 0
      setTeamMembers(Array.from({ length: min }, () => ({
        id: uid(), full_name: '', email: '', college_roll: '', password: '', custom_answers: {}
      })))
      setPhase('form')
    }
  }

  const goBack = () => {
    if (phase === 'form') { setPath(prev => prev.slice(0, -1)); setPhase('picker'); return }
    setPath(prev => prev.slice(0, -1))
  }

  const currentLevelOptions = categories.filter(c => c.parent_id === (path[path.length - 1]?.id || null))
  const currentLeaf = path[path.length - 1] as Category | undefined

  const uploadFieldFile = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
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

  const handleCustomFileField = async (key: string, file: File | null, maxSizeMb?: number) => {
    if (!file) return
    if (maxSizeMb && file.size > maxSizeMb * 1024 * 1024) {
      setError(`File too large — max ${maxSizeMb}MB allowed for this field.`)
      return
    }
    try { setCustomAnswers(prev => ({ ...prev, [key]: 'uploading...' }))
      const url = await uploadFieldFile(file)
      setCustomAnswers(prev => ({ ...prev, [key]: url }))
    } catch (e: any) { setError(e.message || 'Upload failed.') }
  }

  const handleTeamFileField = async (memberIdx: number, key: string, file: File | null) => {
    if (!file) return
    try {
      const url = await uploadFieldFile(file)
      setTeamMembers(prev => prev.map((m, i) => i === memberIdx ? { ...m, custom_answers: { ...m.custom_answers, [key]: url } } : m))
    } catch (e: any) { setError(e.message || 'Upload failed.') }
  }

  const submit = async () => {
    if (!currentLeaf) return
    setError('')
    if (!form.full_name.trim()) return setError('Name is required.')
    if (!form.phone.trim()) return setError('Phone number is required.')
    if (!form.email.trim()) return setError('Email is required.')
    if (!form.college_roll.trim()) return setError('College roll is required.')
    if (currentLeaf.project_name_enabled && !projectName.trim()) return setError(`${currentLeaf.project_name_label || 'Project name'} is required.`)

    setSubmitting(true)
    setPhase('submitting')
    try {
      const res = await fetch('/api/activity-register', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          category_id: currentLeaf.id,
          ...form,
          project_name: currentLeaf.project_name_enabled ? projectName : undefined,
          custom_answers: customAnswers,
          team_members: currentLeaf.requires_team ? teamMembers : undefined,
          member_id: memberId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed.')

      // Save primary info to localStorage for future pre-fill (non-member users)
      if (!memberId) {
        localStorage.setItem(PRIMARY_INFO_KEY, JSON.stringify({
          full_name: form.full_name, phone: form.phone, email: form.email,
          college: form.college, college_roll: form.college_roll,
          hsc_session: form.hsc_session, division: form.division,
        }))
      }

      // Save per-session registration ID
      if (sessionInfo?.id) {
        localStorage.setItem(sessionRegKey(sessionInfo.id), data.registration.id)
      }
      localStorage.setItem('ndsc_activity_reg_id', data.registration.id)

      // Online submission → go to dashboard (which will show exam/submit button)
      // Don't redirect to olympiad page separately; everything is in the activity dashboard
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
      }

      router.push(`/activities/${slug}/dashboard?reg=${data.registration.id}`)
    } catch (e: any) {
      setError(e.message || 'Something went wrong.')
      setPhase('form')
    } finally {
      setSubmitting(false)
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Field label helper — respects form config overrides
  const fieldLabel = (key: string, fallback: string) => {
    if (!formConfig?.primary_fields) return fallback
    const override = formConfig.primary_fields.find((f: any) => f.field_key === key)
    return override?.label || fallback
  }
  const fieldDesc = (key: string) => {
    if (!formConfig?.primary_fields) return null
    const override = formConfig.primary_fields.find((f: any) => f.field_key === key)
    return override?.description || null
  }
  const fieldVisible = (key: string) => {
    if (!formConfig?.primary_fields) return true
    const override = formConfig.primary_fields.find((f: any) => f.field_key === key)
    return override ? override.visible !== false : true
  }

  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}><p style={{ color: 'var(--muted)' }}>Loading...</p></div>
  if (error && !sessionInfo) return <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)' }}><p style={{ color: 'var(--danger-soft)' }}>{error}</p></div>

  const contactPersons: any[] = formConfig?.contact_persons || []
  const accent = resolveAccent(formConfig?.bg_theme)
  const sessionDesc: string = sessionInfo?.description || ''
  const isLongDesc = sessionDesc.length > 220

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: 'var(--bg)', paddingTop: '88px' }}>
      <div className="max-w-lg mx-auto">
        <Link href={`/activities/${slug}`} className="inline-flex items-center gap-2 text-sm mb-6" style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={14} /> Back to activity
        </Link>

        {/* Form header from config or session title */}
        <h1 className="text-2xl font-black mb-1" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--white)' }}>
          {formConfig?.title || sessionInfo?.title}
        </h1>
        {formConfig?.subtitle && <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>{formConfig.subtitle}</p>}

        {/* Cover image — form-specific override if set, else the activity session's own cover */}
        {(formConfig?.cover_photo_url || sessionInfo?.cover_image_url) && (
          <div className="rounded-2xl overflow-hidden mb-4 border" style={{ borderColor: 'var(--border)' }}>
            <img src={formConfig?.cover_photo_url || sessionInfo?.cover_image_url} alt=""
              style={{ width: '100%', maxHeight: '200px', objectFit: 'cover' }} />
          </div>
        )}

        {/* Short event description — separate from the registration field's own description, expandable */}
        {sessionDesc && (
          <div className="mb-4">
            <p className="text-sm leading-relaxed" style={{ color: 'var(--muted)' }}>
              {isLongDesc && !showFullDesc ? `${sessionDesc.slice(0, 220).trim()}…` : sessionDesc}
            </p>
            {isLongDesc && (
              <button onClick={() => setShowFullDesc(s => !s)} className="text-xs font-semibold mt-1" style={{ color: accent }}>
                {showFullDesc ? 'Show less' : 'Show more'}
              </button>
            )}
          </div>
        )}

        <p className="text-sm mb-8" style={{ color: 'var(--muted)' }}>
          {path.length > 0 ? path.map(p => p.name).join(' → ') : 'Choose your category to begin'}
        </p>


        {error && (
          <div className="mb-5 p-3 rounded-lg text-sm" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)', border: '1px solid rgba(var(--danger-rgb), 0.3)' }}>
            {error}
          </div>
        )}

        {/* ── IDENTITY STEP ────────────────────────────────────────── */}
        {phase === 'identity' && !identityChecked && (
          <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
            <p className="text-sm font-semibold mb-1" style={{ color: 'var(--white)' }}>Have you registered with NDSC before?</p>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              Enter your college roll or email — we'll pre-fill the basics so you don't type them again.
            </p>
            <input value={lookupQuery} onChange={e => setLookupQuery(e.target.value)}
              placeholder="College roll or email (optional)" className={inputCls} style={inputStyle}
              onKeyDown={e => e.key === 'Enter' && lookupIdentity()} />
            <button onClick={lookupIdentity} disabled={lookupLoading}
              className="w-full mt-3 py-2.5 rounded-lg text-sm font-bold text-black disabled:opacity-60"
              style={{ background: 'var(--blue)' }}>
              {lookupLoading ? 'Checking...' : 'Continue'}
            </button>
            <button onClick={() => { setIdentityChecked(true); proceedAfterIdentity() }}
              className="w-full mt-2 py-2 text-sm" style={{ color: 'var(--muted)' }}>
              Skip — I'll fill in my info manually
            </button>
          </div>
        )}

        {/* ── CATEGORY PICKER ───────────────────────────────────────── */}
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
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      {cat.requires_team && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(var(--accent2-rgb), 0.1)', color: 'var(--accent2)' }}>Team event</span>}
                      {cat.requires_payment && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(var(--warning-rgb), 0.1)', color: 'var(--warning)' }}>{cat.payment_label || 'Fee'}: ৳{cat.payment_amount}</span>}
                      {cat.is_online_submission && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>Online round</span>}
                    </div>
                  )}
                </div>
                <ChevronRight size={16} style={{ color: 'var(--muted)', flexShrink: 0 }} />
              </button>
            ))}
          </div>
        )}

        {/* ── REGISTRATION FORM ─────────────────────────────────────── */}
        {phase === 'form' && currentLeaf && (
          <div className="space-y-4">
            <button onClick={goBack} className="flex items-center gap-1.5 text-sm" style={{ color: 'var(--blue)' }}>
              <ArrowLeft size={13} /> Change category
            </button>

            {currentLeaf.schedule_date && (
              <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(var(--cat-teal-rgb), 0.08)', color: 'var(--cat-teal)' }}>
                📅 {new Date(currentLeaf.schedule_date).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })}
                {currentLeaf.schedule_time && ` — ${currentLeaf.schedule_time}`}
                {currentLeaf.schedule_room && ` — ${currentLeaf.schedule_room}`}
              </div>
            )}

            {knownInfo && (
              <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(var(--blue-rgb), 0.06)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.2)' }}>
                ✓ We've pre-filled your info from a previous registration — update anything that's changed.
              </div>
            )}

            {/* Primary info fields — labels/visibility driven by formConfig, same styling as every other field below */}
            <div className="space-y-3">
              {fieldVisible('full_name') && (
                <div>
                  <label className={fieldLabelCls} style={{ color: 'var(--white)' }}>{fieldLabel('full_name', 'Full Name')} <span style={{ color: accent }}>*</span></label>
                  {fieldDesc('full_name') && <p className={fieldDescCls} style={{ color: 'var(--muted)' }}>{fieldDesc('full_name')}</p>}
                  <input value={form.full_name} onChange={e => setForm(f => ({ ...f, full_name: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
              )}
              {fieldVisible('phone') && (
                <div>
                  <label className={fieldLabelCls} style={{ color: 'var(--white)' }}>{fieldLabel('phone', 'Phone Number')} <span style={{ color: accent }}>*</span></label>
                  {fieldDesc('phone') && <p className={fieldDescCls} style={{ color: 'var(--muted)' }}>{fieldDesc('phone')}</p>}
                  <input value={form.phone} onChange={e => setForm(f => ({ ...f, phone: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
              )}
              {fieldVisible('email') && (
                <div>
                  <label className={fieldLabelCls} style={{ color: 'var(--white)' }}>{fieldLabel('email', 'Email Address')} <span style={{ color: accent }}>*</span></label>
                  {fieldDesc('email') && <p className={fieldDescCls} style={{ color: 'var(--muted)' }}>{fieldDesc('email')}</p>}
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                {fieldVisible('college') && (
                  <div>
                    <label className={fieldLabelCls} style={{ color: 'var(--white)' }}>{fieldLabel('college', 'College')}</label>
                    <input value={form.college} onChange={e => setForm(f => ({ ...f, college: e.target.value }))} className={inputCls} style={inputStyle} />
                  </div>
                )}
                {fieldVisible('college_roll') && (
                  <div>
                    <label className={fieldLabelCls} style={{ color: 'var(--white)' }}>{fieldLabel('college_roll', 'College Roll')} <span style={{ color: accent }}>*</span></label>
                    <input value={form.college_roll} onChange={e => setForm(f => ({ ...f, college_roll: e.target.value }))} className={inputCls} style={inputStyle} />
                  </div>
                )}
              </div>
              {fieldVisible('hsc_session') && (
                <div>
                  <label className={fieldLabelCls} style={{ color: 'var(--white)' }}>{fieldLabel('hsc_session', 'HSC Session')}</label>
                  {fieldDesc('hsc_session') && <p className={fieldDescCls} style={{ color: 'var(--muted)' }}>{fieldDesc('hsc_session')}</p>}
                  <input value={form.hsc_session} onChange={e => setForm(f => ({ ...f, hsc_session: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
              )}
              {fieldVisible('division') && (
                <div>
                  <label className={fieldLabelCls} style={{ color: 'var(--white)' }}>{fieldLabel('division', 'Division')}</label>
                  <input value={form.division} onChange={e => setForm(f => ({ ...f, division: e.target.value }))} className={inputCls} style={inputStyle} />
                </div>
              )}
            </div>

            {/* Project name field */}
            {currentLeaf.project_name_enabled && (
              <div>
                <label className={fieldLabelCls} style={{ color: 'var(--white)' }}>
                  {currentLeaf.project_name_label || 'Project Name'} <span style={{ color: accent }}>*</span>
                </label>
                <input value={projectName} onChange={e => setProjectName(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
            )}

            {/* Custom extra fields from category */}
            {(currentLeaf.custom_fields || []).length > 0 && (
              <div className="space-y-3 pt-1">
                {currentLeaf.custom_fields.map((field: any) => (
                  <div key={field.key}>
                    <label className={fieldLabelCls} style={{ color: 'var(--white)' }}>
                      {field.label} {field.required && <span style={{ color: accent }}>*</span>}
                    </label>
                    {field.description && <p className={fieldDescCls} style={{ color: 'var(--muted)' }}>{field.description}</p>}
                    {field.type === 'textarea' ? (
                      <textarea rows={3} value={customAnswers[field.key] || ''}
                        onChange={e => setCustomAnswers(p => ({ ...p, [field.key]: e.target.value }))}
                        className={inputCls + ' resize-none'} style={inputStyle} />
                    ) : field.type === 'dropdown' ? (
                      <select value={customAnswers[field.key] || ''} onChange={e => setCustomAnswers(p => ({ ...p, [field.key]: e.target.value }))}
                        className={inputCls} style={inputStyle}>
                        <option value="">Select...</option>
                        {(field.options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
                      </select>
                    ) : field.type === 'photo' || field.type === 'file' ? (
                      <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer text-sm" style={{ ...inputStyle, color: accent }}>
                        <Upload size={14} />
                        {customAnswers[field.key] && customAnswers[field.key] !== 'uploading...' ? `${field.label} uploaded ✓` : customAnswers[field.key] === 'uploading...' ? 'Uploading…' : `Upload ${field.label}${field.max_file_size_mb ? ` (max ${field.max_file_size_mb}MB)` : ''}`}
                        <input type="file" accept={field.type === 'photo' ? 'image/*' : undefined} className="hidden"
                          onChange={e => handleCustomFileField(field.key, e.target.files?.[0] || null, field.max_file_size_mb)} />
                      </label>
                    ) : (
                      <input type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'}
                        value={customAnswers[field.key] || ''}
                        onChange={e => setCustomAnswers(p => ({ ...p, [field.key]: e.target.value }))}
                        className={inputCls} style={inputStyle} />
                    )}
                  </div>
                ))}
              </div>
            )}

            {/* Extra fields from global form config */}
            {(formConfig?.extra_fields || []).length > 0 && (
              <div className="space-y-3 pt-1">
                {formConfig.extra_fields.map((field: any) => (
                  <div key={field.key}>
                    <label className={fieldLabelCls} style={{ color: 'var(--white)' }}>
                      {field.label} {field.required && <span style={{ color: accent }}>*</span>}
                    </label>
                    {field.description && <p className={fieldDescCls} style={{ color: 'var(--muted)' }}>{field.description}</p>}
                    <input type="text" value={customAnswers[`cfg_${field.key}`] || ''}
                      onChange={e => setCustomAnswers(p => ({ ...p, [`cfg_${field.key}`]: e.target.value }))}
                      className={inputCls} style={inputStyle} />
                  </div>
                ))}
              </div>
            )}

            {/* Team members */}
            {currentLeaf.requires_team && (
              <div className="pt-2">
                <p className="text-sm font-bold flex items-center gap-2 mb-1" style={{ color: 'var(--accent2)' }}>
                  <Users size={15} /> Team Members ({teamMembers.length})
                </p>
                <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
                  You are the team leader. Add your team members below. Each will receive an email with login credentials to access the team dashboard.
                </p>
                <div className="space-y-3">
                  {teamMembers.map((m, idx) => (
                    <div key={m.id} className="p-3 rounded-lg space-y-2" style={{ background: 'rgba(var(--accent2-rgb), 0.05)', border: '1px solid rgba(var(--accent2-rgb), 0.2)' }}>
                      <div className="flex justify-between items-center">
                        <p className="text-xs font-semibold" style={{ color: 'var(--accent2)' }}>Member {idx + 1}</p>
                        {teamMembers.length > (currentLeaf.team_size_min || 0) && (
                          <button onClick={() => setTeamMembers(prev => prev.filter((_, i) => i !== idx))}>
                            <X size={13} style={{ color: 'var(--danger-soft)' }} />
                          </button>
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
                    className="mt-2 flex items-center gap-1 text-xs px-3 py-1.5 rounded"
                    style={{ background: 'rgba(var(--accent2-rgb), 0.1)', color: 'var(--accent2)' }}>
                    <Plus size={12} /> Add team member
                  </button>
                )}
              </div>
            )}

            {currentLeaf.requires_payment && (
              <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(var(--warning-rgb), 0.08)', color: 'var(--warning)' }}>
                💳 {currentLeaf.payment_label || 'Registration fee'}: ৳{currentLeaf.payment_amount} — you'll be redirected to pay after submitting.
              </div>
            )}

            {currentLeaf.is_online_submission && (
              <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(var(--blue-rgb), 0.06)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.2)' }}>
                🔗 This category includes an online round. You'll find the exam / submission link in your dashboard after registering.
              </div>
            )}

            <button onClick={submit} disabled={submitting}
              className="w-full py-3 rounded-xl font-bold text-sm text-black disabled:opacity-60"
              style={{ background: 'var(--blue)', fontFamily: "'Orbitron', sans-serif" }}>
              {submitting ? 'Submitting...' : 'Submit Registration →'}
            </button>

            {/* Contact persons */}
            {contactPersons.length > 0 && (
              <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>For more information, contact:</p>
                <div className="space-y-2">
                  {contactPersons.map((cp: any, i: number) => (
                    <div key={i} className="text-xs space-y-0.5" style={{ color: 'var(--muted)' }}>
                      <p className="font-medium" style={{ color: 'var(--white)' }}>{cp.name} {cp.post && `— ${cp.post}`}</p>
                      {cp.phone && <p>📞 {cp.phone}</p>}
                      {cp.email && <p>✉️ {cp.email}</p>}
                      {cp.whatsapp && <a href={`https://wa.me/${cp.whatsapp.replace(/\D/g, '')}`} target="_blank" rel="noopener noreferrer" className="block" style={{ color: 'var(--cat-teal)' }}>💬 WhatsApp</a>}
                      {cp.facebook && <a href={cp.facebook} target="_blank" rel="noopener noreferrer" className="block" style={{ color: 'var(--blue)' }}>Facebook →</a>}
                    </div>
                  ))}
                </div>
              </div>
            )}
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

export default function ActivityRegisterPage() {
  return (
    <Suspense fallback={null}>
      <ActivityRegisterPageInner />
    </Suspense>
  )
}
