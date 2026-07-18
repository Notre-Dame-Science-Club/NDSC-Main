'use client'
import { useState } from 'react'
import { CheckCircle, Upload, X } from 'lucide-react'
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
}

export default function FieldsRenderer({
  schema, form, onFormChange, customAnswers, onCustomAnswersChange, accent = 'var(--blue)', upload,
}: FieldsRendererProps) {
  const safeSchema = normalizeBlocks(schema)
  const [uploading, setUploading] = useState<Record<string, boolean>>({})
  const hardMinSet = new Set<string>(HARD_MINIMUM_KEYS)

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
          return (
            <BuiltInFieldInput
              key={field.id}
              field={field}
              value={form[builtinKey] ?? ''}
              onChange={v => onFormChange({ ...form, [builtinKey]: v })}
              accent={accent}
              isServerHardMin={isServerHardMin}
            />
          )
        }
        // Non-built-in field — bind via customAnswers
        return (
          <FieldInput
            key={field.id}
            field={field}
            value={getValue(field)}
            onChange={v => setValue(field, v)}
            accent={accent}
            isUploading={!!uploading[field.key ?? field.id]}
            onFileSelect={files => handleFile(field, files)}
            onRemoveFile={idx => removeFile(field, idx)}
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
function BuiltInFieldInput({ field, value, onChange, accent, isServerHardMin }: {
  field: FormBlock
  value: any
  onChange: (v: any) => void
  accent: string
  isServerHardMin: boolean
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
    </div>
  )
}

// Generic non-built-in field input. Handles all field types except the
// special built-in mapping above.
function FieldInput({ field, value, onChange, accent, isUploading, onFileSelect, onRemoveFile }: {
  field: FormBlock
  value: any
  onChange: (v: any) => void
  accent: string
  isUploading: boolean
  onFileSelect: (files: FileList | null) => void
  onRemoveFile: (idx: number) => void
}) {
  const labelEl = (
    <label className="block text-sm font-medium mb-1" style={{ color: 'var(--white)' }}>
      {field.label || field.key || field.id}
      {field.required && <span style={{ color: accent }}> *</span>}
    </label>
  )
  const descEl = field.description
    ? <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>{field.description}</p>
    : null

  if (field.type === 'textarea') {
    return <div>{labelEl}{descEl}<textarea rows={3} value={value || ''} onChange={e => onChange(e.target.value)} className={inputCls + ' resize-none'} style={inputStyle} placeholder={(field as any).placeholder} /></div>
  }
  if (field.type === 'dropdown') {
    return (
      <div>
        {labelEl}{descEl}
        <select value={value || ''} onChange={e => onChange(e.target.value)} className={inputCls} style={inputStyle}>
          <option value="">Select...</option>
          {(field.options || []).map((opt: string) => <option key={opt} value={opt}>{opt}</option>)}
        </select>
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
      </div>
    )
  }
  // Default: text / number / date / time
  const htmlType = field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : field.type === 'time' ? 'time' : 'text'
  return <div>{labelEl}{descEl}<input type={htmlType} value={value || ''} onChange={e => onChange(e.target.value)} className={inputCls} style={inputStyle} placeholder={(field as any).placeholder} /></div>
}
