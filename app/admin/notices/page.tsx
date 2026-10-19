'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Megaphone, Pause, Pencil, Play, Plus, Trash2, Users, X } from 'lucide-react'
import {
  NOTICE_TONES, NOTICE_LIMITS, defaultLinkLabel, describeAudience,
  type NoticeStatus, type NoticeTone,
} from '@/lib/notices'

type Notice = {
  id: string
  title: string
  body: string | null
  link_url: string | null
  link_label: string | null
  tone: NoticeTone
  audience_colleges: string[]
  audience_batches: string[]
  is_active: boolean
  dismissible: boolean
  starts_at: string | null
  ends_at: string | null
  created_at: string
  status: NoticeStatus
  reach: number
  dismissed_count: number
}
type Option = { name: string; count: number }
type Form = {
  id?: string
  title: string
  body: string
  link_url: string
  link_label: string
  tone: NoticeTone
  audience_colleges: string[]
  audience_batches: string[]
  is_active: boolean
  dismissible: boolean
  starts_at: string
  ends_at: string
}

const s = { background: 'var(--bg2)', borderColor: 'var(--border)' }
const h = { fontFamily: 'inherit', color: 'var(--blue)' }
const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'
const inputStyle = { background: 'var(--bg3)', borderColor: 'var(--border)', color: 'var(--white)' }
const label = 'block text-xs mb-1'

const BLANK: Form = {
  title: '', body: '', link_url: '', link_label: '', tone: 'info',
  audience_colleges: [], audience_batches: [], is_active: true, dismissible: true, starts_at: '', ends_at: '',
}

// The example from the brief: a new batch of Notre Dame College gets its WhatsApp group link.
const WHATSAPP_TEMPLATE: Form = {
  ...BLANK,
  title: 'Join your batch WhatsApp group',
  body: 'Welcome to NDSC! Please join your batch group so you never miss an update.',
  tone: 'important',
  audience_colleges: ['Notre Dame College'],
}

const STATUS_STYLE: Record<NoticeStatus, { text: string; color: string }> = {
  live: { text: 'Live', color: 'var(--success)' },
  scheduled: { text: 'Scheduled', color: 'var(--blue)' },
  expired: { text: 'Expired', color: 'var(--muted)' },
  off: { text: 'Paused', color: 'var(--warning)' },
}

// <input type="datetime-local"> works in local time without a zone.
const toLocalInput = (iso: string | null) => {
  if (!iso) return ''
  const d = new Date(iso)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}
const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null)

function ChipInput({
  values, onChange, placeholder, suggestions, ariaLabel,
}: {
  values: string[]
  onChange: (v: string[]) => void
  placeholder: string
  suggestions: Option[]
  ariaLabel: string
}) {
  const [draft, setDraft] = useState('')
  const add = (raw: string) => {
    const v = raw.trim()
    if (v && !values.some(x => x.toLowerCase() === v.toLowerCase())) onChange([...values, v])
    setDraft('')
  }
  const unused = suggestions.filter(o => !values.some(x => x.toLowerCase() === o.name.toLowerCase())).slice(0, 8)
  return (
    <div>
      <div className="flex flex-wrap gap-1.5 mb-2">
        {values.map(v => (
          <span key={v} className="inline-flex items-center gap-1 text-xs px-2.5 py-1 rounded-full"
            style={{ background: 'rgba(var(--blue-rgb), 0.12)', color: 'var(--blue)' }}>
            {v}
            <button type="button" onClick={() => onChange(values.filter(x => x !== v))} aria-label={`Remove ${v}`}><X size={12} /></button>
          </span>
        ))}
      </div>
      <input
        className={inputClass} style={inputStyle} value={draft} placeholder={placeholder} aria-label={ariaLabel}
        onChange={e => setDraft(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); add(draft) } }}
        onBlur={() => add(draft)}
      />
      {unused.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          <span className="text-[11px] self-center" style={{ color: 'var(--muted)' }}>On file:</span>
          {unused.map(o => (
            <button key={o.name} type="button" onClick={() => add(o.name)}
              className="text-[11px] px-2 py-0.5 rounded-full border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              + {o.name} <span style={{ opacity: 0.6 }}>({o.count})</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

export default function AdminNoticesPage() {
  const [notices, setNotices] = useState<Notice[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [form, setForm] = useState<Form | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [options, setOptions] = useState<{ colleges: Option[]; batches: Option[]; total: number }>({ colleges: [], batches: [], total: 0 })
  const [reach, setReach] = useState<{ count: number; total: number } | null>(null)
  const formRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/admin/notices')
      const data = await res.json().catch(() => null)
      if (!res.ok) throw new Error(data?.error || 'Could not load notices. Has migration 41 been run?')
      setNotices(Array.isArray(data) ? data : [])
      setLoadError('')
    } catch (e: any) {
      setLoadError(e.message || 'Could not load notices.')
    }
    setLoading(false)
  }, [])

  useEffect(() => {
    load()
    fetch('/api/admin/notice-audience').then(r => (r.ok ? r.json() : null)).then(d => { if (d) setOptions(d) }).catch(() => {})
  }, [load])

  // Live "reaches N of M" while the audience is being edited (debounced).
  const audienceKey = form ? JSON.stringify([form.audience_colleges, form.audience_batches]) : ''
  useEffect(() => {
    if (!form) { setReach(null); return }
    const t = setTimeout(() => {
      fetch('/api/admin/notice-audience', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience_colleges: form.audience_colleges, audience_batches: form.audience_batches }),
      }).then(r => (r.ok ? r.json() : null)).then(d => setReach(d)).catch(() => {})
    }, 300)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [audienceKey])

  const open = (f: Form) => {
    setForm(f)
    setFormError('')
    setTimeout(() => formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50)
  }

  const edit = (n: Notice) =>
    open({
      id: n.id, title: n.title, body: n.body || '', link_url: n.link_url || '', link_label: n.link_label || '',
      tone: n.tone, audience_colleges: n.audience_colleges || [], audience_batches: n.audience_batches || [],
      is_active: n.is_active, dismissible: n.dismissible,
      starts_at: toLocalInput(n.starts_at), ends_at: toLocalInput(n.ends_at),
    })

  const save = async () => {
    if (!form) return
    if (!form.title.trim()) { setFormError('Please give the notice a title.'); return }
    setSaving(true)
    setFormError('')
    try {
      const { id, starts_at, ends_at, ...rest } = form
      const res = await fetch('/api/admin/notices', {
        method: id ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...(id ? { id } : {}), ...rest, starts_at: fromLocalInput(starts_at), ends_at: fromLocalInput(ends_at) }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save the notice.')
      setForm(null)
      await load()
    } catch (e: any) {
      setFormError(e.message || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  const toggle = async (n: Notice) => {
    await fetch('/api/admin/notices', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: n.id, is_active: !n.is_active }),
    })
    load()
  }

  const remove = async (n: Notice) => {
    if (!confirm(`Delete "${n.title}"? Members will no longer see it.`)) return
    await fetch('/api/admin/notices', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: n.id }) })
    load()
  }

  const set = <K extends keyof Form>(k: K, v: Form[K]) => setForm(f => (f ? { ...f, [k]: v } : f))
  const when = (iso: string | null) => (iso ? new Date(iso).toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '')

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-2">
        <h1 className="text-2xl font-bold" style={h}>Notices</h1>
        {!form && (
          <div className="flex gap-2 flex-wrap">
            <button onClick={() => open({ ...WHATSAPP_TEMPLATE })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-semibold border"
              style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              Batch WhatsApp group template
            </button>
            <button onClick={() => open({ ...BLANK })}
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black"
              style={{ background: 'var(--blue)', color: '#000', fontFamily: 'inherit' }}>
              <Plus size={15} /> NEW NOTICE
            </button>
          </div>
        )}
      </div>
      <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
        Shown at the top of the member dashboard to everyone in the audience you pick. Leave colleges and batches empty to reach everyone.
      </p>

      {form && (
        <div ref={formRef} className="rounded-xl border p-6 mb-6" style={s}>
          <h2 className="font-bold text-sm mb-4 inline-flex items-center gap-2" style={{ color: 'var(--blue)', fontFamily: 'inherit' }}>
            <Megaphone size={15} /> {form.id ? 'Edit notice' : 'New notice'}
          </h2>

          <div className="grid gap-3 md:grid-cols-2">
            <div className="md:col-span-2">
              <label className={label} style={{ color: 'var(--muted)' }} htmlFor="n-title">Title</label>
              <input id="n-title" className={inputClass} style={inputStyle} value={form.title} maxLength={NOTICE_LIMITS.title}
                onChange={e => set('title', e.target.value)} placeholder="e.g. Join the Batch 28 WhatsApp group" />
            </div>
            <div className="md:col-span-2">
              <label className={label} style={{ color: 'var(--muted)' }} htmlFor="n-body">Message (optional)</label>
              <textarea id="n-body" rows={3} className={inputClass + ' resize-none'} style={inputStyle} value={form.body} maxLength={NOTICE_LIMITS.body}
                onChange={e => set('body', e.target.value)} placeholder="Anything members should know…" />
            </div>
            <div>
              <label className={label} style={{ color: 'var(--muted)' }} htmlFor="n-link">Link (optional)</label>
              <input id="n-link" className={inputClass} style={inputStyle} value={form.link_url}
                onChange={e => set('link_url', e.target.value)} placeholder="https://chat.whatsapp.com/…" />
            </div>
            <div>
              <label className={label} style={{ color: 'var(--muted)' }} htmlFor="n-label">Button text (optional)</label>
              <input id="n-label" className={inputClass} style={inputStyle} value={form.link_label} maxLength={NOTICE_LIMITS.linkLabel}
                onChange={e => set('link_label', e.target.value)} placeholder={defaultLinkLabel(form.link_url)} />
            </div>

            <div>
              <label className={label} style={{ color: 'var(--muted)' }}>Colleges</label>
              <ChipInput ariaLabel="Colleges" values={form.audience_colleges} onChange={v => set('audience_colleges', v)}
                suggestions={options.colleges} placeholder="Type a college and press Enter (empty = any college)" />
            </div>
            <div>
              <label className={label} style={{ color: 'var(--muted)' }}>Batches</label>
              <ChipInput ariaLabel="Batches" values={form.audience_batches} onChange={v => set('audience_batches', v)}
                suggestions={options.batches} placeholder="Type a batch and press Enter (empty = any batch)" />
            </div>

            <div className="md:col-span-2 rounded-lg px-3 py-2 text-xs flex items-center gap-2"
              style={{ background: 'rgba(var(--blue-rgb), 0.07)', color: 'var(--blue)' }}>
              <Users size={14} />
              {reach
                ? <>Reaches <b>{reach.count}</b> of {reach.total} accounts{form.audience_colleges.length > 0 && form.audience_batches.length > 0 ? ' — must match a listed college AND a listed batch' : ''}.</>
                : 'Counting who this reaches…'}
              {reach && reach.count === 0 && <span style={{ color: 'var(--warning)' }}> Nobody matches yet; check the spelling against the “On file” suggestions.</span>}
            </div>

            <div>
              <label className={label} style={{ color: 'var(--muted)' }} htmlFor="n-tone">Style</label>
              <select id="n-tone" className={inputClass} style={inputStyle} value={form.tone} onChange={e => set('tone', e.target.value as NoticeTone)}>
                {NOTICE_TONES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
              </select>
            </div>
            <div className="flex flex-col gap-2 justify-end">
              <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)} /> Active (visible to members)
              </label>
              <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={form.dismissible} onChange={e => set('dismissible', e.target.checked)} /> Members can dismiss it
              </label>
            </div>
            <div>
              <label className={label} style={{ color: 'var(--muted)' }} htmlFor="n-start">Show from (optional)</label>
              <input id="n-start" type="datetime-local" className={inputClass} style={inputStyle} value={form.starts_at} onChange={e => set('starts_at', e.target.value)} />
            </div>
            <div>
              <label className={label} style={{ color: 'var(--muted)' }} htmlFor="n-end">Hide after (optional)</label>
              <input id="n-end" type="datetime-local" className={inputClass} style={inputStyle} value={form.ends_at} onChange={e => set('ends_at', e.target.value)} />
            </div>
          </div>

          {formError && (
            <div role="alert" className="mt-4 p-3 rounded-lg text-sm"
              style={{ background: 'rgba(var(--danger-rgb), 0.1)', border: '1px solid rgba(var(--danger-rgb), 0.3)', color: 'var(--danger-soft)' }}>
              {formError}
            </div>
          )}

          <div className="flex gap-2 mt-4">
            <button onClick={save} disabled={saving}
              className="px-5 py-2.5 rounded-lg text-sm font-black disabled:opacity-50" style={{ background: 'var(--blue)', color: '#000', fontFamily: 'inherit' }}>
              {saving ? 'SAVING…' : form.id ? 'SAVE CHANGES' : 'PUBLISH NOTICE'}
            </button>
            <button onClick={() => setForm(null)} className="px-4 py-2.5 rounded-lg text-sm" style={{ color: 'var(--muted)' }}>Cancel</button>
          </div>
        </div>
      )}

      <div className="rounded-xl border" style={s}>
        <div className="p-5 border-b" style={{ borderColor: 'var(--border)' }}>
          <h2 className="font-bold text-sm" style={{ color: 'var(--blue)', fontFamily: 'inherit' }}>All notices</h2>
        </div>
        {loading ? (
          <p className="p-6 text-sm" style={{ color: 'var(--muted)' }}>Loading…</p>
        ) : loadError ? (
          <p className="p-6 text-sm" style={{ color: 'var(--danger-soft)' }}>{loadError}</p>
        ) : notices.length === 0 ? (
          <p className="p-6 text-sm" style={{ color: 'var(--muted)' }}>No notices yet. Create one above.</p>
        ) : (
          <div className="divide-y" style={{ borderColor: 'var(--surface-alt)' }}>
            {notices.map(n => {
              const st = STATUS_STYLE[n.status] || STATUS_STYLE.off
              return (
                <div key={n.id} className="p-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-bold text-sm break-words" style={{ color: 'var(--white)' }}>{n.title}</p>
                        <span className="text-[10px] font-bold px-2 py-0.5 rounded-full border" style={{ color: st.color, borderColor: st.color }}>{st.text}</span>
                      </div>
                      {n.body && <p className="text-sm mt-1 whitespace-pre-line break-words" style={{ color: 'var(--muted)' }}>{n.body}</p>}
                      {n.link_url && (
                        <p className="text-xs mt-1 break-all" style={{ color: 'var(--blue)' }}>
                          {n.link_label || defaultLinkLabel(n.link_url)} → {n.link_url}
                        </p>
                      )}
                      <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                        <b style={{ color: 'var(--white)' }}>{describeAudience({ audience_colleges: n.audience_colleges, audience_batches: n.audience_batches })}</b>
                        {' · '}reaches {n.reach} · dismissed by {n.dismissed_count}
                        {n.starts_at ? ` · from ${when(n.starts_at)}` : ''}{n.ends_at ? ` · until ${when(n.ends_at)}` : ''}
                        {!n.dismissible ? ' · cannot be dismissed' : ''}
                      </p>
                    </div>
                    <div className="flex gap-1.5 flex-shrink-0">
                      <button onClick={() => edit(n)} className="p-2 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }} aria-label="Edit"><Pencil size={14} /></button>
                      <button onClick={() => toggle(n)} className="p-2 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }} aria-label={n.is_active ? 'Pause' : 'Activate'}>
                        {n.is_active ? <Pause size={14} /> : <Play size={14} />}
                      </button>
                      <button onClick={() => remove(n)} className="p-2 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--danger-soft)' }} aria-label="Delete"><Trash2 size={14} /></button>
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
