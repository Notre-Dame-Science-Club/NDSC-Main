'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useSearchParams } from 'next/navigation'
import { ArrowLeft, Plus, Trash2, Save, ChevronDown, ChevronRight, Check } from 'lucide-react'
import FormBlocksBuilder from '@/components/admin/FormBlocksBuilder'
import { FormBlock, normalizeBlocks } from '@/lib/formBlocks'
import { THEME_PRESETS, FONT_OPTIONS, COVER_RATIO_OPTIONS } from '@/lib/appearancePresets'

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'
const inputStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }

const FORM_PRESETS = [
  { key: 'activity_register', label: 'Activity Registration (global default)' },
  { key: 'olympiad_register', label: 'Olympiad Registration (global default)' },
  { key: 'membership', label: 'Membership Form' },
]

// Per-event appearance (title, cover, bg, font, contacts, auto-pulls) used
// to live here as form_key=activity_register:<sessionId>. That's now a
// separate 1:1 table (activity_session_form_appearance) edited inline from
// the event's Manage → Appearance tab. This filter hides any stale rows that
// somehow survived the backfill so they don't reappear on this page.
const isPerSessionFormKey = (key: string) => /^activity_register:[0-9a-f-]{36}$/.test(key)

type ContactPerson = { name: string; post: string; phone: string; email: string; whatsapp: string; facebook: string }
type EcMember = { id: string; full_name: string; position: string; email: string; whatsapp: string; facebook_url: string }

type FormConfig = {
  form_key: string
  title: string
  subtitle: string
  cover_photo_url: string
  bg_theme: string
  extra_fields: FormBlock[]
  contact_persons: ContactPerson[]
  use_ec_page?: boolean
  ec_ids?: string[]
  bg_color?: string
  bg_image_url?: string
  font_family?: string
  cover_aspect_ratio?: string
  auto_pull_title?: boolean
  auto_pull_description?: boolean
  auto_pull_cover?: boolean
}

const BLANK_CONTACT = (): ContactPerson => ({ name: '', post: '', phone: '', email: '', whatsapp: '', facebook: '' })

const blankConfig = (key: string): FormConfig => ({
  form_key: key,
  title: '',
  subtitle: '',
  cover_photo_url: '',
  bg_theme: 'default',
  extra_fields: [],
  contact_persons: [],
  use_ec_page: false,
  ec_ids: [],
  bg_color: '',
  bg_image_url: '',
  font_family: 'default',
  cover_aspect_ratio: 'auto',
  auto_pull_title: false,
  auto_pull_description: false,
  auto_pull_cover: false,
})

export default function AdminFormsPage() {
  const searchParams = useSearchParams()
  const [configs, setConfigs] = useState<FormConfig[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<string | null>(null)
  const [editingConfig, setEditingConfig] = useState<FormConfig | null>(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')
  const [customKey, setCustomKey] = useState('')
  const [ecMembers, setEcMembers] = useState<EcMember[]>([])

  useEffect(() => {
    fetch('/api/executives').then(r => r.json()).then(d => setEcMembers(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  useEffect(() => {
    fetch('/api/admin/form-configs')
      .then(r => r.json())
      .then(d => {
        const loaded: FormConfig[] = (d.configs || [])
          .filter((c: FormConfig) => !isPerSessionFormKey(c.form_key))
          .map((c: FormConfig) => ({ ...c, extra_fields: normalizeBlocks(c.extra_fields) }))
        setConfigs(loaded)
        const keyParam = searchParams.get('key')
        if (keyParam && !isPerSessionFormKey(keyParam)) {
          const existing = loaded.find(c => c.form_key === keyParam)
          setSelected(keyParam)
          setEditingConfig(existing ? { ...existing } : blankConfig(keyParam))
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const selectForm = (key: string) => {
    if (isPerSessionFormKey(key)) return
    setSelected(key)
    setSaved(false)
    setError('')
    const existing = configs.find(c => c.form_key === key)
    setEditingConfig(existing ? { ...existing } : blankConfig(key))
  }

  const patch = (field: keyof FormConfig, value: any) => {
    setEditingConfig(prev => prev ? { ...prev, [field]: value } : null)
  }

  const saveConfig = async () => {
    if (!editingConfig) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/admin/form-configs', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingConfig),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setConfigs(prev => {
        const idx = prev.findIndex(c => c.form_key === editingConfig.form_key)
        if (idx >= 0) { const n = [...prev]; n[idx] = data.config; return n }
        return [...prev, data.config]
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (e: any) { setError(e.message) }
    finally { setSaving(false) }
  }

  const allKeys = [
    ...FORM_PRESETS.map(p => p.key),
    ...configs.filter(c => !FORM_PRESETS.find(p => p.key === c.form_key)).map(c => c.form_key),
  ]

  return (
    <div className="min-h-screen p-6" style={{ background: 'var(--bg2)' }}>
      <div className="max-w-4xl mx-auto">
        <Link href="/admin" className="inline-flex items-center gap-2 text-sm mb-6" style={{ color: 'var(--border-soft)' }}>
          <ArrowLeft size={14} /> Admin Panel
        </Link>

        <h1 className="text-2xl font-black mb-1" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }}>
          Form Configuration
        </h1>
        <p className="text-sm mb-8" style={{ color: 'var(--border-soft)' }}>
          Customize the global default forms — labels, cover, theme, contact persons, and extra content blocks.
          For per-event appearance (title, cover, theme, contacts) use the event's Manage → Appearance tab;
          for per-segment fields (name, phone, email, etc.) use Manage → Segments.
        </p>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">

          {/* Left: form list */}
          <div className="space-y-2">
            <p className="text-xs font-bold mb-3" style={{ color: 'var(--border-soft)', fontFamily: "'Orbitron', sans-serif" }}>FORMS</p>

            {FORM_PRESETS.map(p => (
              <button key={p.key} onClick={() => selectForm(p.key)}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all"
                style={{
                  background: selected === p.key ? 'rgba(var(--blue-rgb), 0.1)' : 'var(--surface)',
                  border: `1px solid ${selected === p.key ? 'rgba(var(--blue-rgb), 0.4)' : 'var(--border)'}`,
                  color: selected === p.key ? 'var(--blue)' : 'var(--muted)',
                }}>
                {p.label}
              </button>
            ))}

            {configs.filter(c => !FORM_PRESETS.find(p => p.key === c.form_key)).map(c => (
              <button key={c.form_key} onClick={() => selectForm(c.form_key)}
                className="w-full text-left px-3 py-2.5 rounded-lg text-sm transition-all"
                style={{
                  background: selected === c.form_key ? 'rgba(var(--blue-rgb), 0.1)' : 'var(--surface)',
                  border: `1px solid ${selected === c.form_key ? 'rgba(var(--blue-rgb), 0.4)' : 'var(--border)'}`,
                  color: selected === c.form_key ? 'var(--blue)' : 'var(--muted)',
                }}>
                {c.form_key}
              </button>
            ))}

            <div className="pt-2 flex gap-2">
              <input value={customKey} onChange={e => setCustomKey(e.target.value)}
                placeholder="custom form key" className="flex-1 px-2 py-1.5 rounded text-xs border outline-none"
                style={inputStyle} />
              <button onClick={() => { if (customKey.trim()) { selectForm(customKey.trim()); setCustomKey('') } }}
                className="px-2 py-1.5 rounded text-xs font-bold"
                style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
                <Plus size={12} />
              </button>
            </div>
          </div>

          {/* Right: editor */}
          <div className="md:col-span-2">
            {!editingConfig ? (
              <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <p style={{ color: 'var(--border-soft)' }}>Select a form from the left to edit it.</p>
              </div>
            ) : (
              <div className="space-y-5">
                {error && <p className="text-sm p-3 rounded-lg" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)' }}>{error}</p>}

                {/* Basic info */}
                <Section title="Form Title & Appearance">
                  <Field label="Title shown at the top of the form">
                    <div className="flex items-center gap-2">
                      <input value={editingConfig.title} onChange={e => patch('title', e.target.value)}
                        disabled={!!editingConfig.auto_pull_title}
                        placeholder="Leave blank to use event/olympiad title" className={`${inputCls} disabled:opacity-40`} style={inputStyle} />
                    </div>
                    <label className="flex items-center gap-2 text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
                      <input type="checkbox" checked={!!editingConfig.auto_pull_title} onChange={e => patch('auto_pull_title', e.target.checked)} />
                      Auto-pull from the parent event's title instead
                    </label>
                  </Field>
                  <Field label="Subtitle / description under the title">
                    <input value={editingConfig.subtitle} onChange={e => patch('subtitle', e.target.value)}
                      disabled={!!editingConfig.auto_pull_description}
                      className={`${inputCls} disabled:opacity-40`} style={inputStyle} />
                    <label className="flex items-center gap-2 text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
                      <input type="checkbox" checked={!!editingConfig.auto_pull_description} onChange={e => patch('auto_pull_description', e.target.checked)} />
                      Auto-pull from the parent event's description instead
                    </label>
                  </Field>
                  <Field label="Cover photo URL (shown at top of form)">
                    <input value={editingConfig.cover_photo_url} onChange={e => patch('cover_photo_url', e.target.value)}
                      disabled={!!editingConfig.auto_pull_cover}
                      placeholder="https://..." className={`${inputCls} disabled:opacity-40`} style={inputStyle} />
                    <label className="flex items-center gap-2 text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
                      <input type="checkbox" checked={!!editingConfig.auto_pull_cover} onChange={e => patch('auto_pull_cover', e.target.checked)} />
                      Auto-pull from the parent event's cover image instead
                    </label>
                    {editingConfig.cover_photo_url && !editingConfig.auto_pull_cover && (
                      <img src={editingConfig.cover_photo_url} alt="" className="mt-2 rounded-lg w-full h-24"
                        style={{ objectFit: editingConfig.cover_aspect_ratio === 'auto' ? 'contain' : 'cover' }} />
                    )}
                    <div className="mt-2">
                      <label className="text-xs block mb-1" style={{ color: 'var(--border-soft)' }}>Render cover at</label>
                      <select value={editingConfig.cover_aspect_ratio || 'auto'} onChange={e => patch('cover_aspect_ratio', e.target.value)}
                        className="px-2 py-1.5 rounded text-xs border outline-none" style={inputStyle}>
                        {COVER_RATIO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                      </select>
                    </div>
                  </Field>
                  <Field label="Accent color / theme">
                    <div className="flex flex-wrap gap-2">
                      {THEME_PRESETS.map(t => (
                        <button key={t.value} type="button" onClick={() => patch('bg_theme', t.value)}
                          className="w-9 h-9 rounded-full border-2 flex items-center justify-center"
                          style={{ background: t.swatch, borderColor: editingConfig.bg_theme === t.value ? '#fff' : 'transparent' }}
                          title={t.label}>
                          {editingConfig.bg_theme === t.value && <Check size={13} style={{ color: '#000' }} strokeWidth={3} />}
                        </button>
                      ))}
                      <input type="color"
                        value={editingConfig.bg_theme?.startsWith('#') ? editingConfig.bg_theme : 'var(--blue)'}
                        onChange={e => patch('bg_theme', e.target.value)}
                        className="w-9 h-9 rounded-full border-2 cursor-pointer"
                        style={{ borderColor: editingConfig.bg_theme?.startsWith('#') ? '#fff' : 'transparent', padding: 0, background: 'none' }}
                        title="Custom color" />
                    </div>
                    <p className="text-xs mt-1" style={{ color: 'var(--border-soft)' }}>
                      Controls the accent color (buttons, highlights, "*") and a subtle background tint on this form.
                    </p>
                  </Field>
                  <Field label="Page background">
                    <div className="flex gap-2 items-center">
                      <input type="color" value={editingConfig.bg_color || '#0b0f19'}
                        onChange={e => patch('bg_color', e.target.value)}
                        className="w-9 h-9 rounded cursor-pointer" style={{ padding: 0, background: 'none', border: '1px solid var(--border)' }}
                        title="Background color" />
                      <input value={editingConfig.bg_image_url || ''} onChange={e => patch('bg_image_url', e.target.value)}
                        placeholder="Optional background image URL (tiled/cover behind the whole form)"
                        className={inputCls} style={inputStyle} />
                    </div>
                  </Field>
                  <Field label="Font">
                    <select value={editingConfig.font_family || 'default'} onChange={e => patch('font_family', e.target.value)}
                      className={inputCls} style={inputStyle}>
                      {FONT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                    </select>
                  </Field>
                </Section>


                {/* Form builder: content blocks + form fields, in order.
                    Note: primary info fields (name, phone, email, college, roll, HSC, division)
                    are no longer edited here. They're now part of each segment's own
                    form_field_schema, edited per-event in the Manage Activity page. */}
                <Section title="Form Builder — Extra Content & Fields">
                  <p className="text-xs mb-3" style={{ color: 'var(--border-soft)' }}>
                    Add extra content blocks (text, images, links, dividers) and additional fields
                    to this form, in whatever order you like. The core info fields (name, phone,
                    email, etc.) are configured per-event in the Manage Activity page under each segment.
                  </p>
                  <FormBlocksBuilder blocks={editingConfig.extra_fields} onChange={blocks => patch('extra_fields', blocks)} />
                </Section>

                {/* Contact persons */}
                <Section title="Contact Persons (shown at bottom of form)">
                  <p className="text-xs mb-3" style={{ color: 'var(--border-soft)' }}>
                    Add contact info for people students can reach out to. You can type contacts manually, or pull directly from the Executive Committee page — their name, position, email, WhatsApp, and Facebook are already there.
                  </p>

                  <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer" style={{ color: 'var(--blue)' }}>
                    <input type="checkbox" checked={editingConfig.use_ec_page || false}
                      onChange={e => patch('use_ec_page', e.target.checked)} />
                    Pull contacts from the EC page instead of typing manually
                  </label>

                  {editingConfig.use_ec_page ? (
                    <div className="space-y-2">
                      {ecMembers.length === 0 ? (
                        <p className="text-xs" style={{ color: 'var(--border-soft)' }}>No EC members found yet — add them on the Executives admin page first.</p>
                      ) : ecMembers.map(ec => {
                        const isSelected = (editingConfig.ec_ids || []).includes(ec.id)
                        return (
                          <label key={ec.id} className="flex items-center gap-2 p-2.5 rounded-lg text-sm cursor-pointer"
                            style={{ background: isSelected ? 'rgba(var(--blue-rgb), 0.08)' : 'var(--bg2)', border: `1px solid ${isSelected ? 'rgba(var(--blue-rgb), 0.3)' : 'var(--border)'}` }}>
                            <input type="checkbox" checked={isSelected}
                              onChange={e => {
                                const current = editingConfig.ec_ids || []
                                const updated = e.target.checked ? [...current, ec.id] : current.filter(id => id !== ec.id)
                                patch('ec_ids', updated)
                              }} />
                            <span style={{ color: 'var(--white)' }}>{ec.full_name}</span>
                            <span className="text-xs" style={{ color: 'var(--muted)' }}>— {ec.position}</span>
                          </label>
                        )
                      })}
                    </div>
                  ) : (
                    <>
                      {editingConfig.contact_persons.map((cp, idx) => (
                        <div key={idx} className="p-3 rounded-lg mb-2 space-y-2" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Contact {idx + 1}</span>
                            <button onClick={() => patch('contact_persons', editingConfig.contact_persons.filter((_, i) => i !== idx))}
                              style={{ color: 'var(--danger-soft)' }}><Trash2 size={13} /></button>
                          </div>
                          <div className="grid grid-cols-2 gap-2">
                            {(['name','post','phone','email','whatsapp','facebook'] as const).map(field => (
                              <input key={field} placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                                value={cp[field]} onChange={e => {
                                  const updated = [...editingConfig.contact_persons]
                                  updated[idx] = { ...updated[idx], [field]: e.target.value }
                                  patch('contact_persons', updated)
                                }}
                                className={inputCls} style={inputStyle} />
                            ))}
                          </div>
                        </div>
                      ))}
                      <button onClick={() => patch('contact_persons', [...editingConfig.contact_persons, BLANK_CONTACT()])}
                        className="text-xs px-3 py-1.5 rounded flex items-center gap-1"
                        style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>
                        <Plus size={11} /> Add contact person
                      </button>
                    </>
                  )}
                </Section>

                <button onClick={saveConfig} disabled={saving}
                  className="w-full py-3 rounded-xl font-bold text-sm text-black disabled:opacity-60 flex items-center justify-center gap-2"
                  style={{ background: saved ? 'var(--cat-teal)' : 'var(--blue)' }}>
                  {saving ? <Save size={14} /> : saved ? <Check size={14} strokeWidth={3} /> : <Save size={14} />}
                  {saving ? 'Saving...' : saved ? 'Saved' : 'Save Form Config'}
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(true)
  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold"
        style={{ background: 'var(--surface)', color: 'var(--muted)', fontFamily: "'Orbitron', sans-serif" }}>
        {title}
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="p-4 space-y-3" style={{ background: 'var(--bg2)' }}>{children}</div>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</label>
      {children}
    </div>
  )
}
