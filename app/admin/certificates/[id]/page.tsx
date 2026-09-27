'use client'
import { type ChangeEvent, useEffect, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import {
  ArrowLeft, Download, Loader2, Trash2, Upload, Users, Copy, Check, AlertCircle, Eye,
} from 'lucide-react'
import { uploadFile } from '@/lib/uploadClient'
import {
  parseCsv,
  validateCertificateRecipientsCsv,
  generateCertificateRecipientsCsvTemplate,
  type CertificateRecipientData,
} from '@/lib/csvParser'

type Align = 'left' | 'center' | 'right'

type Certificate = {
  id: string
  title: string
  slug: string
  template_pdf_url: string | null
  name_x_pct: number
  name_y_pct: number
  name_page: number
  font_size: number
  font_color: string
  align: Align
  is_active: boolean
}

type Recipient = { id: string; email: string; full_name: string }

const s = { background: 'var(--bg2)', borderColor: 'var(--border)' }
const h = { fontFamily: 'inherit', color: 'var(--blue)' }

export default function AdminCertificateEditPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const id = params.id

  const [cert, setCert] = useState<Certificate | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [msgOk, setMsgOk] = useState(true)

  const [uploading, setUploading] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const templateRef = useRef<HTMLInputElement>(null)
  const csvFileRef = useRef<HTMLInputElement>(null)

  const [previewToken, setPreviewToken] = useState(0)
  const [copied, setCopied] = useState(false)

  const [csvText, setCsvText] = useState('')
  const [csvFile, setCsvFile] = useState<File | null>(null)
  const [preview, setPreview] = useState<CertificateRecipientData[]>([])
  const [validationErrors, setValidationErrors] = useState<Array<{ row: number; errors: string[] }>>([])
  const [addingRecipients, setAddingRecipients] = useState(false)

  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/certificates/${id}`)
      const data = await res.json()
      if (!res.ok) {
        setMsg(data.error || 'Failed to load batch.')
        setMsgOk(false)
        return
      }
      setCert(data)
      setRecipients(data.recipients || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { if (id) load() }, [id])

  const patch = async (update: Record<string, any>) => {
    setSaving(true)
    setMsg('')
    try {
      const res = await fetch(`/api/certificates/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(update),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data.error || 'Failed to save.')
        setMsgOk(false)
        return null
      }
      setCert(data)
      setMsg('Saved.')
      setMsgOk(true)
      return data
    } catch {
      setMsg('Network error. Please try again.')
      setMsgOk(false)
      return null
    } finally {
      setSaving(false)
    }
  }

  const handleTemplateUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setUploadProgress(0)
    const url = await uploadFile(file, 'certificate-templates', setUploadProgress)
    setUploading(false)
    if (!url) {
      setMsg('Upload failed. Please try again.')
      setMsgOk(false)
      return
    }
    await patch({ template_pdf_url: url })
    setPreviewToken((t) => t + 1)
    // Reset the file input so selecting the same filename again (e.g. a
    // re-exported version of the same template) still fires onChange —
    // browsers don't re-fire it for an unchanged file input value.
    if (templateRef.current) templateRef.current.value = ''
  }

  const handleDelete = async () => {
    if (!confirm('Delete this certificate batch and all its recipients? This cannot be undone.')) return
    const res = await fetch(`/api/certificates/${id}`, { method: 'DELETE' })
    if (res.ok) router.push('/admin/certificates')
  }

  const copyLink = () => {
    if (!cert) return
    navigator.clipboard.writeText(`${window.location.origin}/certificate/${cert.slug}`).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  // --- Recipients (paste / CSV) ---------------------------------------

  const parseAndValidate = (text: string) => {
    if (!text.trim()) {
      setPreview([])
      setValidationErrors([])
      return
    }
    const { headers, rows } = parseCsv(text)
    const { valid, errors } = validateCertificateRecipientsCsv(headers, rows)
    setPreview(valid)
    setValidationErrors(errors)
  }

  const handleCsvFile = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setCsvFile(file)
    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      setCsvText(text)
      parseAndValidate(text)
    }
    reader.readAsText(file)
  }

  const handleCsvText = (text: string) => {
    setCsvText(text)
    setCsvFile(null)
    parseAndValidate(text)
  }

  const downloadTemplate = () => {
    const blob = new Blob([generateCertificateRecipientsCsvTemplate()], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'certificate_recipients_template.csv'
    a.click()
    URL.revokeObjectURL(url)
  }

  const handleAddRecipients = async () => {
    if (preview.length === 0) return
    setAddingRecipients(true)
    try {
      const res = await fetch(`/api/certificates/${id}/recipients`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipients: preview }),
      })
      const data = await res.json()
      if (!res.ok) {
        setMsg(data.error || 'Failed to add recipients.')
        setMsgOk(false)
        return
      }
      setCsvText('')
      setCsvFile(null)
      if (csvFileRef.current) csvFileRef.current.value = ''
      setPreview([])
      setValidationErrors([])
      setMsg(`Added ${data.added} recipient${data.added === 1 ? '' : 's'}.`)
      setMsgOk(true)
      await load()
    } catch {
      setMsg('Network error. Please try again.')
      setMsgOk(false)
    } finally {
      setAddingRecipients(false)
    }
  }

  const removeRecipient = async (recipientId: string) => {
    const res = await fetch(`/api/certificates/${id}/recipients/${recipientId}`, { method: 'DELETE' })
    if (res.ok) setRecipients((r) => r.filter((x) => x.id !== recipientId))
  }

  if (loading) {
    return <div className="py-16 text-center text-sm" style={{ color: 'var(--muted)' }}>Loading…</div>
  }
  if (!cert) {
    return <div className="py-16 text-center text-sm" style={{ color: 'var(--danger)' }}>Batch not found.</div>
  }

  return (
    <div>
      <button
        onClick={() => router.push('/admin/certificates')}
        className="flex items-center gap-1.5 text-xs mb-4 hover:underline"
        style={{ color: 'var(--muted)' }}
      >
        <ArrowLeft size={14} /> Back to Certificates
      </button>

      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold" style={h}>{cert.title}</h1>
          <button onClick={copyLink} className="flex items-center gap-1.5 text-xs font-mono mt-1 hover:underline" style={{ color: 'var(--blue)' }}>
            /certificate/{cert.slug} {copied ? <Check size={12} /> : <Copy size={12} />}
          </button>
        </div>
        <button
          onClick={handleDelete}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold"
          style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger)', border: '1px solid rgba(var(--danger-rgb), 0.3)' }}
        >
          <Trash2 size={12} /> Delete Batch
        </button>
      </div>

      {msg && (
        <div className="mb-4 px-4 py-2.5 rounded-lg text-sm border"
          style={{
            background: msgOk ? 'rgba(var(--success-rgb), 0.05)' : 'rgba(var(--danger-rgb), 0.05)',
            borderColor: msgOk ? 'rgba(var(--success-rgb), 0.3)' : 'rgba(var(--danger-rgb), 0.3)',
            color: msgOk ? 'var(--success)' : 'var(--danger)',
          }}>
          {msg}
        </div>
      )}

      {/* Title / slug / active */}
      <div className="mb-6 p-4 rounded-xl border" style={s}>
        <label className="block text-sm font-bold mb-3" style={{ color: 'var(--white)' }}>Basics</label>
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Title</label>
            <input
              key={`title-${cert.title}`}
              defaultValue={cert.title}
              onBlur={(e) => e.target.value.trim() && e.target.value !== cert.title && patch({ title: e.target.value.trim() })}
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }}
            />
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Slug</label>
            <input
              key={`slug-${cert.slug}`}
              defaultValue={cert.slug}
              onBlur={(e) => e.target.value.trim() && e.target.value !== cert.slug && patch({ slug: e.target.value.trim() })}
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono"
              style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={cert.is_active} onChange={(e) => patch({ is_active: e.target.checked })} className="w-4 h-4" />
          <span className="text-sm" style={{ color: 'var(--white)' }}>Active (visitors can view/download certificates)</span>
        </label>
      </div>

      {/* Template + placement */}
      <div className="mb-6 p-4 rounded-xl border" style={s}>
        <label className="block text-sm font-bold mb-3" style={{ color: 'var(--white)' }}>Template & Name Placement</label>

        <div className="mb-4">
          <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer"
            style={{ borderColor: 'var(--border)', background: 'rgba(var(--blue-rgb), 0.05)' }}>
            <Upload size={16} style={{ color: 'var(--blue)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--blue)' }}>
              {uploading ? `Uploading… ${uploadProgress}%` : cert.template_pdf_url ? 'Replace Template PDF' : 'Upload Template PDF'}
            </span>
            <input ref={templateRef} type="file" accept="application/pdf" onChange={handleTemplateUpload} className="hidden" disabled={uploading} />
          </label>
        </div>

        {!cert.template_pdf_url && (
          <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>Upload a certificate PDF with blank space for the name, then position it below.</p>
        )}

        {cert.template_pdf_url && (
          <>
            <div className="grid sm:grid-cols-3 gap-3 mb-3">
              <NumberField key={`x-${cert.name_x_pct}`} label="X position (%)" value={cert.name_x_pct} min={0} max={100} onCommit={(v) => patch({ name_x_pct: v })} />
              <NumberField key={`y-${cert.name_y_pct}`} label="Y position (%)" value={cert.name_y_pct} min={0} max={100} onCommit={(v) => patch({ name_y_pct: v })} />
              <NumberField key={`page-${cert.name_page}`} label="Page (0-indexed)" value={cert.name_page} min={0} onCommit={(v) => patch({ name_page: v })} />
            </div>
            <div className="grid sm:grid-cols-3 gap-3 mb-4">
              <NumberField key={`fontsize-${cert.font_size}`} label="Font size" value={cert.font_size} min={1} onCommit={(v) => patch({ font_size: v })} />
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Font color</label>
                <input
                  key={`color-${cert.font_color}`}
                  type="color"
                  defaultValue={cert.font_color}
                  onBlur={(e) => patch({ font_color: e.target.value })}
                  className="w-full h-9 rounded-lg border cursor-pointer"
                  style={{ borderColor: 'var(--border)', background: 'var(--surface)' }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Alignment</label>
                <select
                  value={cert.align}
                  onChange={(e) => patch({ align: e.target.value as Align })}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
                  style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }}
                >
                  <option value="left">Left</option>
                  <option value="center">Center</option>
                  <option value="right">Right</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between mb-2">
              <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>Preview with sample name (&quot;Jane Doe&quot;)</label>
              <button
                onClick={() => setPreviewToken((t) => t + 1)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold"
                style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}
              >
                <Eye size={12} /> Refresh Preview
              </button>
            </div>
            <iframe
              key={previewToken}
              src={`/api/certificates/${id}/preview?name=Jane%20Doe&v=${previewToken}`}
              title="Certificate preview"
              className="w-full rounded-lg border"
              style={{ height: '60vh', borderColor: 'var(--border)', background: '#fff' }}
            />
          </>
        )}
      </div>

      {/* Recipients */}
      <div className="mb-6 p-4 rounded-xl border" style={s}>
        <div className="flex items-center justify-between mb-3">
          <label className="flex items-center gap-2 text-sm font-bold" style={{ color: 'var(--white)' }}>
            <Users size={15} /> Recipients ({recipients.length})
          </label>
          <button
            onClick={downloadTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold"
            style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}
          >
            <Download size={12} /> Download Template
          </button>
        </div>

        <div className="mb-3">
          <label className="flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 border-dashed cursor-pointer"
            style={{ borderColor: 'var(--border)', background: 'rgba(var(--blue-rgb), 0.05)' }}>
            <Upload size={16} style={{ color: 'var(--blue)' }} />
            <span className="text-sm font-medium" style={{ color: 'var(--blue)' }}>{csvFile ? csvFile.name : 'Upload CSV File'}</span>
            <input ref={csvFileRef} type="file" accept=".csv" onChange={handleCsvFile} className="hidden" />
          </label>
        </div>
        <div className="text-xs text-center mb-3" style={{ color: 'var(--muted)' }}>OR</div>
        <textarea
          value={csvText}
          onChange={(e) => handleCsvText(e.target.value)}
          placeholder="email,full_name&#10;jane@example.com,Jane Doe"
          rows={6}
          className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none font-mono mb-3"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }}
        />

        {validationErrors.length > 0 && (
          <div className="mb-3 p-3 rounded-lg border" style={{ background: 'rgba(var(--danger-rgb), 0.05)', borderColor: 'rgba(var(--danger-rgb), 0.3)' }}>
            <div className="flex items-center gap-2 mb-1.5">
              <AlertCircle size={14} style={{ color: 'var(--danger)' }} />
              <span className="text-xs font-bold" style={{ color: 'var(--danger)' }}>{validationErrors.length} validation error{validationErrors.length > 1 ? 's' : ''}</span>
            </div>
            {validationErrors.map((err, i) => (
              <div key={i} className="text-xs" style={{ color: 'var(--danger-soft)' }}>Row {err.row}: {err.errors.join(', ')}</div>
            ))}
          </div>
        )}

        {preview.length > 0 && (
          <button
            onClick={handleAddRecipients}
            disabled={addingRecipients}
            className="mb-4 px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
            style={{ background: 'var(--blue)', color: '#000' }}
          >
            {addingRecipients ? 'Adding…' : `Add ${preview.length} Recipient${preview.length > 1 ? 's' : ''}`}
          </button>
        )}

        {recipients.length > 0 && (
          <div className="rounded-lg border overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(var(--blue-rgb), 0.05)' }}>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>Email</th>
                  <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>Full Name</th>
                  <th className="px-3 py-2"></th>
                </tr>
              </thead>
              <tbody>
                {recipients.map((r) => (
                  <tr key={r.id} style={{ borderBottom: '1px solid var(--surface-alt)' }}>
                    <td className="px-3 py-2" style={{ color: 'var(--white)' }}>{r.email}</td>
                    <td className="px-3 py-2" style={{ color: 'var(--white)' }}>{r.full_name}</td>
                    <td className="px-3 py-2 text-right">
                      <button onClick={() => removeRecipient(r.id)} className="text-xs" style={{ color: 'var(--danger)' }}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {saving && (
        <div className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
          <Loader2 size={12} className="animate-spin" /> Saving…
        </div>
      )}
    </div>
  )
}

function NumberField({
  label, value, min, max, onCommit,
}: { label: string; value: number; min?: number; max?: number; onCommit: (v: number) => void }) {
  return (
    <div>
      <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>{label}</label>
      <input
        type="number"
        defaultValue={value}
        min={min}
        max={max}
        onBlur={(e) => {
          const n = Number(e.target.value)
          if (Number.isFinite(n)) onCommit(n)
        }}
        className="w-full px-3 py-2 rounded-lg text-sm border outline-none"
        style={{ background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }}
      />
    </div>
  )
}
