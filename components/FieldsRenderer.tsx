'use client'
import { useState, useEffect, useRef } from 'react'
import { CheckCircle, Upload, X, AlertTriangle, ExternalLink, Users, Info } from 'lucide-react'
import Link from 'next/link'
import { FormBlock, normalizeBlocks, BuiltinFieldKey, HARD_MINIMUM_KEYS } from '@/lib/formBlocks'

// Renders an ordered list of fields driven by form_field_schema. Each field
// is rendered by its `type` (text, textarea, number, dropdown, multiple_choice,
// checkboxes, date, time, photo, file).
//
// Built-in fields (is_builtin set) bind to the `form` state via their
// is_builtin key (full_name, phone, etc.). Non-built-in fields bind to
// `customAnswers[field.key]`.
//
// Required asterisks, descriptions, and placeholders all come from the schema.
//
// This component owns the photo/file upload flow; the parent just passes in
// an `upload` function. Photo/file previews show a small removable chip per
// uploaded URL.

const inputCls = 'w-full px-3 py-2.5 rounded-lg text-sm outline-none reg-input'
const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--white)' }
const accentRgb = 'var(--blue-rgb)'

export type FieldsRendererProps = {
  schema: FormBlock[]
  form: Record<string, any>            // built-in field values (full_name, phone, etc.)
  onFormChange: (next: Record<string, any>) => void
  customAnswers: Record<string, any>   // non-built-in field values
  onCustomAnswersChange: (next: Record<string, any>) => void
  accent?: string
  upload?: (file: File) => Promise<string>  // returns uploaded URL
  // Optional: when set, fields with `unique_field: true` do a live lookup
  // against /api/activity-unique-check.
  sessionId?: string
  eventSlug?: string
  onUniqueMatch?: (fieldKey: string, match: any) => void
  onUniqueBlock?: (blocked: boolean) => void
}

export type UniqueMatch = {
  type: 'leader' | 'team_member'
  registration_id: string
  member_id?: string
  existing_name?: string
  added_by_name?: string
  leader_email?: string
  leader_phone?: string
  field_label: string
  field_value: string
}

export default function FieldsRenderer({
  schema, form, onFormChange, customAnswers, onCustomAnswersChange,
  accent = 'var(--blue)', upload, sessionId, eventSlug, onUniqueMatch, onUniqueBlock,
}: FieldsRendererProps) {
  const safeSchema = normalizeBlocks(schema)
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const hardMinSet = new Set<string>(HARD_MINIMUM_KEYS)

  // Per-field unique-check state. Map of fieldKey -> { status, match, value }.
  // status: 'idle' | 'checking' | 'taken' | 'free' | 'error'
  const [uniqueState, setUniqueState] = useState<Record<string, { status: 'idle' | 'checking' | 'taken' | 'free' | 'error'; match?: any; value: string }>>({})
  const debounceTimers = useRef<Record<string, any>>({})
  const reqSeq = useRef<Record<string, number>>({})

  // Whenever a unique-field's value changes we debounce a lookup. If a
  // previous request is still in flight for the same field we ignore its
  // response (handled by reqSeq).
  const checkUnique = async (field: FormBlock, value: string) => {
    if (!sessionId || !field.unique_field) return
    const key = (field as any).is_builtin as string || field.key || field.id
    const trimmed = (value || '').trim()
    if (!trimmed) {
      setUniqueState(prev => {
        const next = { ...prev }; delete next[key]; return next
      })
      onUniqueMatch?.(key, null)
      return
    }
    setUniqueState(prev => ({ ...prev, [key]: { status: 'checking', value: trimmed } }))
    const seq = (reqSeq.current[key] = (reqSeq.current[key] || 0) + 1)
    try {
      const fieldKey = (field as any).is_builtin as string || field.key || field.id
      const res = await fetch(`/api/activity-unique-check?session_id=${encodeURIComponent(sessionId)}&field=${encodeURIComponent(fieldKey)}&value=${encodeURIComponent(trimmed)}`)
      if (!res.ok) throw new Error('lookup failed')
      const data = await res.json()
      if (reqSeq.current[key] !== seq) return // stale
      const match = data?.match || null
      const status = match ? 'taken' : 'free'
      setUniqueState(prev => ({ ...prev, [key]: { status, match, value: trimmed } }))
      onUniqueMatch?.(key, match ? { ...match, field_label: field.label || key, field_value: trimmed } : null)
    } catch {
      if (reqSeq.current[key] !== seq) return
      setUniqueState(prev => ({ ...prev, [key]: { status: 'error', value: trimmed } }))
    }
  }

  const scheduleCheck = (field: FormBlock, value: string) => {
    const key = (field as any).is_builtin as string || field.key || field.id
    if (debounceTimers.current[key]) clearTimeout(debounceTimers.current[key])
    debounceTimers.current[key] = setTimeout(() => checkUnique(field, value), 350)
  }

  // Re-evaluate `onUniqueBlock` whenever any unique field's status changes.
  useEffect(() => {
    if (!onUniqueBlock) return
    const anyBlocking = Object.values(uniqueState).some(s => s.status === 'taken')
    onUniqueBlock(anyBlocking)
  }, [uniqueState, onUniqueBlock])

  // Cleanup timers on unmount
  useEffect(() => () => {
    Object.values(debounceTimers.current).forEach((t: any) => clearTimeout(t))
  }, [])

  // Effective upload fn — falls back to the legacy /api/activity-upload XHR
  // pattern if the parent didn't supply one. (Kept simple so most callers
  // don't need to think about it.)
  const doUpload = async (file: File): Promise<string> => {
    if (upload) return upload(file)
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

  // For each schema field, get the current value (from form or customAnswers)
  // and the setter.
  const getValue = (field: FormBlock) => {
    const k = (field as any).is_builtin as BuiltinFieldKey | undefined
    if (k) return form[k] ?? ''
    return customAnswers[field.key ?? field.id] ?? ''
  }
  const setValue = (field: FormBlock, v: any) => {
    const k = (field as any).is_builtin as BuiltinFieldKey | undefined
    if (k) onFormChange({ ...form, [k]: v })
    else onCustomAnswersChange({ ...customAnswers, [field.key ?? field.id]: v })
  }

  const handleFile = async (field: FormBlock, fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return
    const files = Array.from(fileList)
    const maxFiles = (field as any).max_files && (field as any).max_files > 1 ? (field as any).max_files : 1
    const maxSizeMb = (field as any).max_file_size_mb
    const current: string[] = maxFiles > 1 && Array.isArray(getValue(field)) ? getValue(field) : []
    if (current.length + files.length > maxFiles) {
      alert(`You can upload at most ${maxFiles} file${maxFiles > 1 ? 's' : ''} for "${field.label}".`)
      return
    }
    for (const f of files) {
      if (maxSizeMb && f.size > maxSizeMb * 1024 * 1024) {
        alert(`File too large — max ${maxSizeMb}MB allowed for this field.`)
        return
      }
    }
    const k = field.key ?? field.id
    setUploading(p => ({ ...p, [k]: true }))
    try {
      const urls = await Promise.all(files.map(f => doUpload(f)))
      setValue(field, maxFiles > 1 ? [...current, ...urls] : urls[0])
    } catch (e: any) {
      alert(e.message || 'Upload failed.')
    } finally {
      setUploading(p => ({ ...p, [k]: false }))
    }
  }

  const removeFile = (field: FormBlock, idx: number) => {
    const v = getValue(field)
    if (!Array.isArray(v)) { setValue(field, ''); return }
    const next = v.filter((_, i) => i !== idx)
    setValue(field, next)
  }

  return (
    <div className="space-y-3">
      {safeSchema.map((field) => {
        if ((field as any).is_builtin) {
          // Built-in field — also need to flag required server-side if the
          // server's hard minimum includes this key.
          const builtinKey = (field as any).is_builtin as BuiltinFieldKey
          const isServerHardMin = hardMinSet.has(builtinKey)
          const fieldKey = builtinKey as string
          const uState = uniqueState[fieldKey]
          return (
            <BuiltInFieldInput
              key={field.id}
              field={field}
              value={form[builtinKey] ?? ''}
              onChange={v => { onFormChange({ ...form, [builtinKey]: v }); scheduleCheck(field, v) }}
              accent={accent}
              isServerHardMin={isServerHardMin}
              uniqueState={uState}
              eventSlug={eventSlug}
            />
          )
        }
        // Non-built-in field — bind via customAnswers
        const fieldKey = field.key || field.id
        const uState = uniqueState[fieldKey]
        return (
          <FieldInput
            key={field.id}
            field={field}
            value={getValue(field)}
            onChange={v => { setValue(field, v); scheduleCheck(field, v) }}
            accent={accent}
            isUploading={!!uploading[field.key ?? field.id]}
            onFileSelect={files => handleFile(field, files)}
            onRemoveFile={idx => removeFile(field, idx)}
            uniqueState={uState}
            eventSlug={eventSlug}
          />
        )
      })}
    </div>
  )
}

// Built-in fields. Reuse the form's existing field state by binding
// `value`/`onChange` to the form's top-level keys (full_name, etc.) — so
// the hardcoded identity-step and other parts of the register page keep
// working with no changes.
function BuiltInFieldInput({ field, value, onChange, accent, isServerHardMin, uniqueState, eventSlug }: {
  field: FormBlock
  value: any
  onChange: (v: any) => void
  accent: string
  isServerHardMin: boolean
  uniqueState?: { status: 'idle' | 'checking' | 'taken' | 'free' | 'error'; match?: any; value: string }
  eventSlug?: string
}) {
  const isRequired = !!field.required || isServerHardMin
  // Built-in fields are mostly `text`. For email and phone, use the right
  // input type.
  const builtinKey = (field as any).is_builtin as BuiltinFieldKey
  const type = builtinKey === 'email' ? 'email' : (field.type || 'text')
  return (
    <div>
      <label className="block text-sm font-medium mb-1" style={{ color: 'var(--white)' }}>
        {field.label || builtinKey.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase())}
        {isRequired && <span style={{ color: accent }}> *</span>}
        {field.unique_field && (
          <span className="text-[10px] uppercase tracking-wide ml-2 px-1.5 py-0.5 rounded" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>unique</span>
        )}
      </label>
      {field.description && <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>{field.description}</p>}
      <input
        type={type}
        value={value}
        onChange={e => onChange(e.target.value)}
        placeholder={(field as any).placeholder}
        className={inputCls}
        style={inputStyle}
      />
      <UniqueStateBadge state={uniqueState} fieldLabel={field.label || builtinKey} eventSlug={eventSlug} />
    </div>
  )
}

// Generic non-built-in field input. Handles all field types except the
// special built-in mapping above.
function FieldInput({ field, value, onChange, accent, isUploading, onFileSelect, onRemoveFile, uniqueState, eventSlug }: {
  field: FormBlock
  value: any
  onChange: (v: any) => void
  accent: string
  isUploading: boolean
  onFileSelect: (files: FileList | null) => void
  onRemoveFile: (idx: number) => void
  uniqueState?: { status: 'idle' | 'checking' | 'taken' | 'free' | 'error'; match?: any; value: string }
  eventSlug?: string
}) {
  const labelEl = (
    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--white)' }}>
      {field.label || field.key || field.id}
      {field.required && <span style={{ color: accent }}> *</span>}
      {field.unique_field && (
        <span className="text-[10px] uppercase tracking-wide ml-2 px-1.5 py-0.5 rounded" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>unique</span>
      )}
    </label>
  )
  const descEl = field.description
    ? <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>{field.description}</p>
    : null
  const badgeEl = <UniqueStateBadge state={uniqueState} fieldLabel={field.label || field.key || field.id} eventSlug={eventSlug} />

  if (field.type === 'textarea') {
    return <div>{labelEl}{descEl}<textarea rows={3} value={value || ''} onChange={e => onChange(e.target.value)} className={inputCls + ' resize-none'} style={inputStyle} placeholder={(field as any).placeholder} />{badgeEl}</div>
  }
  if (field.type === 'dropdown') {
    return (
      <div>
        {labelEl}{descEl}
        <select value={value || ''} onChange={e => onChange(e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Select...</option>
          {(field.options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
        {badgeEl}
      </div>
    )
  }
  if (field.type === 'multiple_choice') {
    return (
      <div>
        {labelEl}{descEl}
        <div className="space-y-1.5">
          {(field.options || []).map((opt: string) => (
            <label key={opt} className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer reg-input" style={inputStyle}>
              <input type="radio" name={field.key ?? field.id} checked={(value || '') === opt} onChange={() => onChange(opt)} />
              {opt}
            </label>
          ))}
        </div>
        {badgeEl}
      </div>
    )
  }
  if (field.type === 'checkboxes') {
    const selected: string[] = Array.isArray(value) ? value : []
    return (
      <div>
        {labelEl}{descEl}
        <div className="space-y-1.5">
          {(field.options || []).map((opt: string) => (
            <label key={opt} className="flex items-center gap-2 px-3 py-2 rounded-lg border text-sm cursor-pointer reg-input" style={inputStyle}>
              <input type="checkbox" checked={selected.includes(opt)}
                onChange={e => onChange(e.target.checked ? [...selected, opt] : selected.filter(o => o !== opt))} />
              {opt}
            </label>
          ))}
        </div>
        {badgeEl}
      </div>
    )
  }
  if (field.type === 'photo' || field.type === 'file') {
    const maxFiles = (field as any).max_files && (field as any).max_files > 1 ? (field as any).max_files : 1
    const urls: string[] = Array.isArray(value) ? value : (value ? [value] : [])
    const atCap = urls.length >= maxFiles
    return (
      <div>
        {labelEl}{descEl}
        <div className="space-y-2">
          {urls.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {urls.map((u, i) => (
                <span key={i} className="flex items-center gap-1 px-2 py-1 rounded text-xs" style={{ background: 'var(--bg2)', color: accent }}>
                  {field.label}{maxFiles > 1 ? ` #${i + 1}` : ''} <CheckCircle size={11} />
                  <button type="button" onClick={() => onRemoveFile(i)}><X size={11} /></button>
                </span>
              ))}
            </div>
          )}
          {!atCap && (
            <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer text-sm" style={{ ...inputStyle, color: accent }}>
              <Upload size={14} />
              {isUploading ? 'Uploading…' : `Upload ${field.label}${(field as any).max_file_size_mb ? ` (max ${(field as any).max_file_size_mb}MB${maxFiles > 1 ? ` each, up to ${maxFiles} files` : ''})` : maxFiles > 1 ? ` (up to ${maxFiles} files)` : ''}`}
              <input type="file" multiple={maxFiles > 1} accept={field.type === 'photo' ? 'image/*' : undefined} className="hidden"
                onChange={e => { onFileSelect(e.target.files); e.target.value = '' }} />
            </label>
          )}
        </div>
        {badgeEl}
      </div>
    )
  }
  // Default: text / number / date / time
  const htmlType = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'
  return <div>{labelEl}{descEl}<input type={htmlType} value={value || ''} onChange={e => onChange(e.target.value)} className={inputCls} style={inputStyle} placeholder={(field as any).placeholder} />{badgeEl}</div>
}

// Inline status badge shown beneath any unique-flagged field. Renders one
// of:
//   - "Checking…" (pulsing dot, while debounced request is in flight)
//   - "You're already registered" with a link to the existing dashboard
//     (when the value matches a leader of an existing registration)
//   - "You've been added to <event> by <leader>" with a link to the team
//     dashboard (when the value matches a team member)
//   - "Available" small green check (when no match — purely informational)
//   - "Couldn't verify" (network error, non-blocking)
function UniqueStateBadge({ state, fieldLabel, eventSlug }: {
  state?: { status: 'idle' | 'checking' | 'taken' | 'free' | 'error'; match?: any; value: string }
  fieldLabel: string
  eventSlug?: string
}) {
  if (!state || state.status === 'idle') return null

  if (state.status === 'checking') {
    return (
      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--muted)' }}>
        <Info size={11} /> Checking {fieldLabel}…
      </p>
    )
  }

  if (state.status === 'error') {
    return (
      <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--warning)' }}>
        <AlertTriangle size={11} /> Couldn't verify uniqueness. We'll double-check on submit.
      </p>
    )
  }

  if (state.status === 'taken') {
    const m = state.match
    if (m?.type === 'team_member') {
      // "You were added by X to Y" — the value belongs to a team member of
      // some leader's registration. Offer a link into the team dashboard.
      const dashHref = eventSlug ? `/activities/${eventSlug}/dashboard?reg=${m.registration_id}` : '#'
      return (
        <div className="mt-1.5 p-2.5 rounded-lg flex items-start gap-2 text-xs"
          style={{ background: 'rgba(var(--blue-rgb), 0.08)', border: '1px solid rgba(var(--blue-rgb), 0.3)', color: 'var(--blue)' }}>
          <Users size={13} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="font-semibold" style={{ color: 'var(--white)' }}>
              {m.existing_name ? `${m.existing_name}, you've been added` : "You've been added"} to this event by <strong>{m.added_by_name || 'someone'}</strong> as a team member.
            </p>
            <p className="mt-0.5" style={{ color: 'var(--muted)' }}>Open your team dashboard instead of re-registering.</p>
            {eventSlug && (
              <Link href={dashHref} className="inline-flex items-center gap-1 mt-1.5 font-semibold underline" style={{ color: 'var(--blue)' }}>
                Open team dashboard <ExternalLink size={10} />
              </Link>
            )}
          </div>
        </div>
      )
    }
    // Leader match — they themselves are the registrant on an existing row.
    const dashHref = eventSlug ? `/activities/${eventSlug}/dashboard?reg=${m.registration_id}` : '#'
    return (
      <div className="mt-1.5 p-2.5 rounded-lg flex items-start gap-2 text-xs"
        style={{ background: 'rgba(var(--warning-rgb), 0.08)', border: '1px solid rgba(var(--warning-rgb), 0.3)', color: 'var(--warning)' }}>
        <AlertTriangle size={13} className="shrink-0 mt-0.5" />
        <div className="flex-1">
          <p className="font-semibold" style={{ color: 'var(--white)' }}>
            You're already registered{m.existing_name ? ` as ${m.existing_name}` : ''}.
          </p>
          <p className="mt-0.5" style={{ color: 'var(--muted)' }}>Pick a different {fieldLabel.toLowerCase()} or open your existing dashboard.</p>
          {eventSlug && (
            <Link href={dashHref} className="inline-flex items-center gap-1 mt-1.5 font-semibold underline" style={{ color: 'var(--warning)' }}>
              Open my dashboard <ExternalLink size={10} />
            </Link>
          )}
        </div>
      </div>
    )
  }

  // free
  return (
    <p className="text-xs mt-1 flex items-center gap-1" style={{ color: 'var(--cat-teal)' }}>
      <CheckCircle size={11} /> {fieldLabel} is available.
    </p>
  )
}
