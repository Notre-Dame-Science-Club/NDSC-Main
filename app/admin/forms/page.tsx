'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Save, ChevronDown, ChevronRight, Check } from 'lucide-react'

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'
const inputStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }
const uid = () => Math.random().toString(36).slice(2, 9)

const PRIMARY_FIELD_KEYS = [
  { key: 'full_name', defaultLabel: 'Full Name' },
  { key: 'phone', defaultLabel: 'Phone Number' },
  { key: 'email', defaultLabel: 'Email Address' },
  { key: 'college', defaultLabel: 'College' },
  { key: 'college_roll', defaultLabel: 'College Roll' },
  { key: 'hsc_session', defaultLabel: 'HSC Session' },
  { key: 'division', defaultLabel: 'Division' },
]

const FORM_PRESETS = [
  { key: 'activity_register', label: 'Activity Registration (global default)' },
  { key: 'olympiad_register', label: 'Olympiad Registration (global default)' },
  { key: 'membership', label: 'Membership Form' },
]

const THEME_PRESETS = [
  { value: 'default', label: 'NDSC Blue (default)', swatch: 'var(--blue)' },
  { value: 'var(--accent2)', label: 'Violet', swatch: 'var(--accent2)' },
  { value: 'var(--cat-teal)', label: 'Green', swatch: 'var(--cat-teal)' },
  { value: 'var(--warning)', label: 'Amber', swatch: 'var(--warning)' },
  { value: 'var(--danger-soft)', label: 'Red', swatch: 'var(--danger-soft)' },
]

type ExtraField = { key: string; label: string; description?: string; type: string; required: boolean; options?: string[] }
type ContactPerson = { name: string; post: string; phone: string; email: string; whatsapp: string; facebook: string }
type EcMember = { id: string; full_name: string; position: string; email: string; whatsapp: string; facebook_url: string }
type PrimaryFieldOverride = { field_key: string; label: string; description: string; visible: boolean; required: boolean }

type FormConfig = {
  form_key: string
  title: string
  subtitle: string
  cover_photo_url: string
  bg_theme: string
  primary_fields: PrimaryFieldOverride[]
  extra_fields: ExtraField[]
  contact_persons: ContactPerson[]
  use_ec_page?: boolean
  ec_ids?: string[]
}

const BLANK_EXTRA = (): ExtraField => ({ key: uid(), label: '', description: '', type: 'text', required: false })
const BLANK_CONTACT = (): ContactPerson => ({ name: '', post: '', phone: '', email: '', whatsapp: '', facebook: '' })

const blankConfig = (key: string): FormConfig => ({
  form_key: key,
  title: '',
  subtitle: '',
  cover_photo_url: '',
  bg_theme: 'default',
  primary_fields: PRIMARY_FIELD_KEYS.map(f => ({ field_key: f.key, label: f.defaultLabel, description: '', visible: true, required: ['full_name','phone','email','college_roll'].includes(f.key) })),
  extra_fields: [],
  contact_persons: [],
  use_ec_page: false,
  ec_ids: [],
})

export default function AdminFormsPage() {
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
      .then(d => { setConfigs(d.configs || []) })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [])

  const selectForm = (key: string) => {
    setSelected(key)
    setSaved(false)
    setError('')
    const existing = configs.find(c => c.form_key === key)
    setEditingConfig(existing ? { ...existing } : blankConfig(key))
  }

  const patch = (field: keyof FormConfig, value: any) => {
    setEditingConfig(prev => prev ? { ...prev, [field]: value } : null)
  }

  const patchPrimaryField = (fieldKey: string, changes: Partial<PrimaryFieldOverride>) => {
    if (!editingConfig) return
    const updated = editingConfig.primary_fields.map(f =>
      f.field_key === fieldKey ? { ...f, ...changes } : f
    )
    patch('primary_fields', updated)
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
          Customize every form on the website — labels, descriptions, extra fields, contact persons, cover images.
          Changes apply site-wide or per event (use <code style={{ color: 'var(--blue)' }}>activity_register:SESSION_ID</code> as the key for per-event overrides).
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
                    <input value={editingConfig.title} onChange={e => patch('title', e.target.value)}
                      placeholder="Leave blank to use event/olympiad title" className={inputCls} style={inputStyle} />
                  </Field>
                  <Field label="Subtitle / description under the title">
                    <input value={editingConfig.subtitle} onChange={e => patch('subtitle', e.target.value)}
                      className={inputCls} style={inputStyle} />
                  </Field>
                  <Field label="Cover photo URL (shown at top of form, same ratio it was uploaded in)">
                    <input value={editingConfig.cover_photo_url} onChange={e => patch('cover_photo_url', e.target.value)}
                      placeholder="https://..." className={inputCls} style={inputStyle} />
                    {editingConfig.cover_photo_url && (
                      <img src={editingConfig.cover_photo_url} alt="" className="mt-2 rounded-lg w-full h-24 object-cover" />
                    )}
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
                </Section>


                {/* Primary fields */}
                <Section title="Primary Fields (name, phone, email, etc.)">
                  <p className="text-xs mb-3" style={{ color: 'var(--border-soft)' }}>
                    These are always collected. You can rename labels, add descriptions, or hide non-essential ones.
                    Required fields (name, phone, email, roll) cannot be hidden.
                  </p>
                  {editingConfig.primary_fields.map(f => {
                    const preset = PRIMARY_FIELD_KEYS.find(p => p.key === f.field_key)
                    const isMandatory = ['full_name', 'phone', 'email', 'college_roll'].includes(f.field_key)
                    return (
                      <div key={f.field_key} className="p-3 rounded-lg mb-2" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>
                            {preset?.defaultLabel || f.field_key}
                          </span>
                          {!isMandatory && (
                            <label className="flex items-center gap-1 text-xs" style={{ color: 'var(--muted)' }}>
                              <input type="checkbox" checked={f.visible}
                                onChange={e => patchPrimaryField(f.field_key, { visible: e.target.checked })} />
                              Show this field
                            </label>
                          )}
                        </div>
                        <div className="space-y-2">
                          <input placeholder={`Label (default: ${preset?.defaultLabel})`} value={f.label}
                            onChange={e => patchPrimaryField(f.field_key, { label: e.target.value })}
                            className={inputCls} style={inputStyle} />
                          <input placeholder="Helper text shown under the field (optional)" value={f.description}
                            onChange={e => patchPrimaryField(f.field_key, { description: e.target.value })}
                            className={inputCls} style={inputStyle} />
                        </div>
                      </div>
                    )
                  })}
                </Section>

                {/* Extra fields */}
                <Section title="Extra Custom Fields">
                  <p className="text-xs mb-3" style={{ color: 'var(--border-soft)' }}>
                    Add any additional fields beyond the primary info. Like Google Forms — each field has a title, description, type, and required toggle.
                  </p>
                  {editingConfig.extra_fields.map((f, idx) => (
                    <div key={f.key} className="p-3 rounded-lg mb-2 space-y-2" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                      <div className="flex gap-2">
                        <input placeholder="Field title *" value={f.label}
                          onChange={e => {
                            const updated = [...editingConfig.extra_fields]
                            updated[idx] = { ...updated[idx], label: e.target.value }
                            patch('extra_fields', updated)
                          }}
                          className={inputCls} style={inputStyle} />
                        <select value={f.type}
                          onChange={e => {
                            const updated = [...editingConfig.extra_fields]
                            updated[idx] = { ...updated[idx], type: e.target.value }
                            patch('extra_fields', updated)
                          }}
                          className="px-2 py-2 rounded-lg text-sm border outline-none" style={inputStyle}>
                          {[['text','Short text'],['textarea','Long text'],['number','Number'],['dropdown','Dropdown'],['date','Date'],['time','Time'],['photo','Photo upload'],['file','File upload']].map(([v,l]) => (
                            <option key={v} value={v}>{l}</option>
                          ))}
                        </select>
                        <button onClick={() => patch('extra_fields', editingConfig.extra_fields.filter((_, i) => i !== idx))}
                          style={{ color: 'var(--danger-soft)' }}><Trash2 size={14} /></button>
                      </div>
                      <input placeholder="Description / helper text (optional)" value={f.description || ''}
                        onChange={e => {
                          const updated = [...editingConfig.extra_fields]
                          updated[idx] = { ...updated[idx], description: e.target.value }
                          patch('extra_fields', updated)
                        }}
                        className={inputCls} style={inputStyle} />
                      {f.type === 'dropdown' && (
                        <input placeholder="Options (comma-separated, e.g. Option A,Option B,Option C)"
                          value={(f.options || []).join(',')}
                          onChange={e => {
                            const updated = [...editingConfig.extra_fields]
                            updated[idx] = { ...updated[idx], options: e.target.value.split(',').map(s => s.trim()).filter(Boolean) }
                            patch('extra_fields', updated)
                          }}
                          className={inputCls} style={inputStyle} />
                      )}
                      <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                        <input type="checkbox" checked={f.required}
                          onChange={e => {
                            const updated = [...editingConfig.extra_fields]
                            updated[idx] = { ...updated[idx], required: e.target.checked }
                            patch('extra_fields', updated)
                          }} />
                        Required
                      </label>
                    </div>
                  ))}
                  <button onClick={() => patch('extra_fields', [...editingConfig.extra_fields, BLANK_EXTRA()])}
                    className="text-xs px-3 py-1.5 rounded flex items-center gap-1"
                    style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>
                    <Plus size={11} /> Add field
                  </button>
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
