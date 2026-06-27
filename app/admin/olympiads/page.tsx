'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Eye, EyeOff, X, Megaphone, ArrowRight, Image as ImageIcon, FileText, Clock, AlignLeft, List, Camera } from 'lucide-react'
import AnnotationViewer, { Annotation } from '@/components/olympiad/AnnotationViewer'

const uid = () => Math.random().toString(36).slice(2, 9)

type FieldType = 'text' | 'textarea' | 'email' | 'tel' | 'select'
type RegField = { key: string; label: string; type: FieldType; required: boolean; options?: string[] }

type QuestionType = 'mcq' | 'short' | 'photo'
type McqOption = { id: string; text: string }
type Question = {
  id: string
  type: QuestionType
  text: string
  description?: string
  options?: McqOption[]
  correct_option_id?: string
  marks?: number
}

type Olympiad = {
  id: string
  name: string
  description: string
  cover_image_url?: string
  pdf_url?: string
  mode: string
  exam_type: 'photo_only' | 'live_only' | 'mixed'
  question_display: 'one_by_one' | 'all_at_once'
  timer_minutes: number
  is_active: boolean
  result_published: boolean
  annotations_published: boolean
  registration_deadline?: string
  exam_date?: string
  eligibility?: string
  external_only?: boolean
  organizer_password?: string
  registration_fields: RegField[]
  questions: Question[]
  created_at: string
}

const BLANK: Partial<Olympiad> = {
  name: '', description: '', mode: 'mixed', exam_type: 'mixed', question_display: 'all_at_once',
  timer_minutes: 60, is_active: true, result_published: false, annotations_published: false,
  external_only: false, registration_fields: [], questions: [],
}

const MAX_COVER_MB = 10
const MAX_PDF_MB = 20

export default function AdminOlympiadsPage() {
  const [olympiads, setOlympiads] = useState<Olympiad[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Olympiad> | null>(null)
  const [saving, setSaving] = useState(false)
  const [pageError, setPageError] = useState('')
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [tab, setTab] = useState<'olympiads' | 'registrations'>('olympiads')
  const [selectedOlympiadId, setSelectedOlympiadId] = useState<string | null>(null)
  const [registrations, setRegistrations] = useState<Record<string, any[]>>({})
  const [viewingReg, setViewingReg] = useState<any | null>(null)
  const [uploading, setUploading] = useState<'cover' | 'pdf' | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')

  const h = { fontFamily: 'Orbitron, monospace', color: '#00d4ff' }
  const s = { background: '#061420', border: '1px solid #0f2a4a' }
  const inputStyle = { background: '#0a1f35', borderColor: '#0f2a4a', color: '#e0f0ff' }
  const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'

  const [pageError2, setPageError2] = useState('')

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/olympiads')
    if (res.ok) setOlympiads(await res.json() || [])
    else setPageError('Failed to load olympiads.')
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const loadRegistrations = async (olympiadId: string) => {
    const res = await fetch(`/api/admin/olympiad-registrations?olympiad_id=${olympiadId}`)
    const data = res.ok ? await res.json() : []
    setRegistrations(prev => ({ ...prev, [olympiadId]: data || [] }))
  }

  const toggleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    loadRegistrations(id)
  }

  // Upload helper
  const uploadFile = (file: File, folder: string, maxMB: number, accept: string[]): Promise<string> => {
    return new Promise(async (resolve, reject) => {
      if (file.size > maxMB * 1024 * 1024) { reject(new Error(`Max ${maxMB}MB allowed`)); return }
      if (!accept.includes(file.type)) { reject(new Error('File type not allowed')); return }
      const tokenRes = await fetch('/api/admin/upload-token')
      if (!tokenRes.ok) { reject(new Error('Could not get upload token')); return }
      const { uploadUrl, secret } = await tokenRes.json()
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', folder)
      const xhr = new XMLHttpRequest()
      xhr.upload.addEventListener('progress', e => { if (e.lengthComputable) setUploadProgress(Math.round(e.loaded / e.total * 100)) })
      xhr.addEventListener('load', () => {
        try {
          const d = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300 && d.url) resolve(d.url)
          else reject(new Error(d.error || 'Upload failed'))
        } catch { reject(new Error('Upload failed')) }
      })
      xhr.addEventListener('error', () => reject(new Error('Network error')))
      xhr.open('POST', uploadUrl)
      // The secret must be sent as a header, not a form field — Hostinger's
      // upload script authenticates by reading the X-Upload-Secret header.
      // Sending it as a body field (the previous bug) meant the server never
      // saw it and rejected every direct upload as unauthorized.
      xhr.setRequestHeader('X-Upload-Secret', secret)
      xhr.send(fd)
    })
  }

  const handleCoverUpload = async (file: File | null) => {
    if (!file) return
    setUploading('cover'); setUploadError(''); setUploadProgress(0)
    try {
      const url = await uploadFile(file, 'olympiad-covers', MAX_COVER_MB, ['image/jpeg', 'image/png', 'image/webp'])
      setEditing(p => ({ ...p, cover_image_url: url }))
    } catch (e: any) { setUploadError(e.message) }
    setUploading(null)
  }

  const handlePdfUpload = async (file: File | null) => {
    if (!file) return
    setUploading('pdf'); setUploadError(''); setUploadProgress(0)
    try {
      const url = await uploadFile(file, 'olympiad-pdfs', MAX_PDF_MB, ['application/pdf'])
      setEditing(p => ({ ...p, pdf_url: url }))
    } catch (e: any) { setUploadError(e.message) }
    setUploading(null)
  }

  // Registration fields helpers
  const addRegField = () => setEditing(p => ({
    ...p, registration_fields: [...(p?.registration_fields || []), { key: uid(), label: '', type: 'text', required: false }]
  }))
  const removeRegField = (key: string) => setEditing(p => ({ ...p, registration_fields: (p?.registration_fields || []).filter(f => f.key !== key) }))
  const updateRegField = (key: string, patch: Partial<RegField>) => setEditing(p => ({
    ...p, registration_fields: (p?.registration_fields || []).map(f => f.key === key ? { ...f, ...patch } : f)
  }))

  // Question helpers
  const addQuestion = (type: QuestionType) => {
    const q: Question = { id: uid(), type, text: '', description: '', marks: 1 }
    if (type === 'mcq') q.options = [{ id: uid(), text: '' }, { id: uid(), text: '' }]
    setEditing(p => ({ ...p, questions: [...(p?.questions || []), q] }))
  }
  const removeQuestion = (qid: string) => setEditing(p => ({ ...p, questions: (p?.questions || []).filter(q => q.id !== qid) }))
  const updateQuestion = (qid: string, patch: Partial<Question>) => setEditing(p => ({
    ...p, questions: (p?.questions || []).map(q => q.id === qid ? { ...q, ...patch } : q)
  }))
  const addOption = (qid: string) => updateQuestion(qid, { options: [...((editing?.questions || []).find(q => q.id === qid)?.options || []), { id: uid(), text: '' }] })
  const removeOption = (qid: string, oid: string) => {
    const q = (editing?.questions || []).find(q => q.id === qid)
    if (!q) return
    updateQuestion(qid, { options: (q.options || []).filter(o => o.id !== oid) })
  }
  const updateOption = (qid: string, oid: string, text: string) => {
    const q = (editing?.questions || []).find(q => q.id === qid)
    if (!q) return
    updateQuestion(qid, { options: (q.options || []).map(o => o.id === oid ? { ...o, text } : o) })
  }

  const save = async () => {
    if (!editing) return
    setSaving(true); setPageError('')
    const payload = {
      name: editing.name || '',
      description: editing.description || '',
      cover_image_url: editing.cover_image_url || null,
      pdf_url: editing.pdf_url || null,
      mode: editing.mode || 'mixed',
      exam_type: editing.exam_type || 'mixed',
      question_display: editing.question_display || 'all_at_once',
      timer_minutes: editing.timer_minutes ?? 60,
      is_active: editing.is_active ?? true,
      result_published: editing.result_published ?? false,
      annotations_published: editing.annotations_published ?? false,
      registration_deadline: editing.registration_deadline || null,
      exam_date: editing.exam_date || null,
      eligibility: editing.eligibility || null,
      external_only: editing.external_only ?? false,
      organizer_password: editing.organizer_password || null,
      registration_fields: editing.registration_fields || [],
      questions: editing.questions || [],
    }
    const res = await fetch('/api/admin/olympiads', {
      method: editing.id ? 'PUT' : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editing.id ? { id: editing.id, ...payload } : payload),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      setPageError(d.error || 'Save failed.')
    } else { setEditing(null); load() }
    setSaving(false)
  }

  const del = async (id: string) => {
    if (!confirm('Delete this olympiad and all its registrations?')) return
    const res = await fetch('/api/admin/olympiads', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (!res.ok) { const d = await res.json().catch(() => ({})); setPageError(d.error || 'Delete failed.') }
    load()
  }

  const toggleField = async (id: string, field: string, value: boolean) => {
    await fetch('/api/admin/olympiads', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, [field]: value }) })
    load()
  }

  const saveAnnotatedScore = async (regId: string, data: { score: number; annotations: Annotation[]; organizerNote: string }) => {
    const res = await fetch('/api/admin/olympiad-registrations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        id: regId,
        final_score: data.score,
        annotations: data.annotations,
        organizer_note: data.organizerNote,
        review_status: 'reviewed',
      }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error || 'Could not save score.')
    }
    if (selectedOlympiadId) loadRegistrations(selectedOlympiadId)
  }

  const qTypeLabel = (t: QuestionType) => t === 'mcq' ? 'MCQ' : t === 'short' ? 'Short Answer' : 'Photo Upload'
  const qTypeColor = (t: QuestionType) => t === 'mcq' ? '#00d4ff' : t === 'short' ? '#00ff80' : '#ffb347'
  const qTypeIcon = (t: QuestionType) => t === 'mcq' ? <List size={12} /> : t === 'short' ? <AlignLeft size={12} /> : <Camera size={12} />

  // ── Registrations view ──────────────────────────────────────────────────────
  if (tab === 'registrations' && selectedOlympiadId) {
    const regs = registrations[selectedOlympiadId] || []
    const olympiad = olympiads.find(o => o.id === selectedOlympiadId)
    return (
      <div>
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setTab('olympiads')} className="text-sm px-3 py-1 rounded border" style={{ borderColor: '#0f2a4a', color: '#6a8faf' }}>← Back</button>
          <h1 className="text-xl font-bold" style={h}>{olympiad?.name} — Registrations ({regs.length})</h1>
          <button onClick={() => loadRegistrations(selectedOlympiadId!)} className="text-sm px-3 py-1 rounded border ml-auto" style={{ borderColor: 'rgba(0,212,255,0.3)', color: '#00d4ff' }}>↺ Refresh</button>
        </div>
        <div className="rounded-xl border overflow-x-auto" style={s}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #0f2a4a', background: 'rgba(0,212,255,0.04)' }}>
                {['Name','Phone','Email','HSC Session','College','Roll','Score','Status','Answer Sheet'].map(h2 => (
                  <th key={h2} className="text-left px-4 py-3 font-medium whitespace-nowrap" style={{ color: '#6a8faf' }}>{h2}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regs.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center" style={{ color: '#3d5a78' }}>No registrations yet.</td></tr>
              )}
              {regs.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #0f2a4a' }}>
                  <td className="px-4 py-3" style={{ color: '#e0f0ff' }}>{r.full_name}</td>
                  <td className="px-4 py-3" style={{ color: '#6a8faf' }}>{r.phone}</td>
                  <td className="px-4 py-3" style={{ color: '#6a8faf' }}>{r.email}</td>
                  <td className="px-4 py-3" style={{ color: '#6a8faf' }}>{r.hsc_session}</td>
                  <td className="px-4 py-3" style={{ color: '#6a8faf' }}>{r.college}</td>
                  <td className="px-4 py-3" style={{ color: '#6a8faf' }}>{r.college_roll}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setViewingReg(r)}
                      className="text-xs px-2 py-1 rounded border" style={{ borderColor: '#0f2a4a', color: r.final_score != null ? '#00ff80' : '#3d5a78' }}>
                      {r.final_score != null ? r.final_score : 'Mark'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: r.review_status === 'reviewed' ? '#00ff8022' : '#ffb34722', color: r.review_status === 'reviewed' ? '#00ff80' : '#ffb347' }}>
                      {r.review_status || 'pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {r.answer_sheet_url && (
                      <button onClick={() => setViewingReg(r)} className="text-xs underline" style={{ color: '#00d4ff' }}>
                        View{(r.annotations?.length ?? 0) > 0 ? ` (${r.annotations.length} marks)` : ''}
                      </button>
                    )}
                    {!r.answer_sheet_url && r.exam_submitted_at && <span className="text-xs" style={{ color: '#00ff80' }}>Online ✓</span>}
                    {!r.answer_sheet_url && !r.exam_submitted_at && <span className="text-xs" style={{ color: '#3d5a78' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {viewingReg && viewingReg.answer_sheet_url && (
          <AnnotationViewer
            imageUrl={viewingReg.answer_sheet_url}
            initialAnnotations={viewingReg.annotations || []}
            initialScore={viewingReg.final_score ?? ''}
            initialNote={viewingReg.organizer_note || ''}
            onClose={() => setViewingReg(null)}
            onSave={async data => {
              await saveAnnotatedScore(viewingReg.id, data)
              setViewingReg(null)
            }}
          />
        )}
        {viewingReg && !viewingReg.answer_sheet_url && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(2,8,16,0.85)' }}>
            <div className="w-full max-w-sm rounded-2xl border p-6" style={s}>
              <h2 className="font-bold text-sm mb-4" style={h}>Score — {viewingReg.full_name}</h2>
              <AdminScoreOnlyForm reg={viewingReg} onClose={() => setViewingReg(null)} onSave={saveAnnotatedScore} inputClass={inputClass} inputStyle={inputStyle} />
            </div>
          </div>
        )}
      </div>

    )
  }

  // ── Editor modal ────────────────────────────────────────────────────────────
  if (editing !== null) {
    return (
      <div>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-bold" style={h}>{editing.id ? 'Edit Olympiad' : 'New Olympiad'}</h1>
          <div className="flex gap-3">
            <button onClick={() => { setEditing(null); setUploadError('') }} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: '#0f2a4a', color: '#6a8faf' }}>Cancel</button>
            <button onClick={save} disabled={saving} className="px-5 py-2 rounded-lg text-sm font-bold" style={{ background: 'linear-gradient(90deg,#00d4ff,#0070ff)', color: '#fff' }}>
              {saving ? 'Saving…' : 'SAVE →'}
            </button>
          </div>
        </div>
        {pageError && <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.4)', color: '#ff6b6b' }}>{pageError}</div>}

        <div className="space-y-5 max-w-3xl">
          {/* Basic info */}
          <div className="rounded-xl p-5 space-y-4" style={s}>
            <p className="text-xs font-bold tracking-widest" style={{ color: '#00d4ff' }}>BASIC INFO</p>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Title *</label>
              <input className={inputClass} style={inputStyle} value={editing.name || ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Batch 28 Introductory Quiz" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Description</label>
              <textarea rows={3} className={inputClass + ' resize-none'} style={inputStyle} value={editing.description || ''} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Status</label>
                <select className={inputClass} style={inputStyle} value={editing.is_active ? 'true' : 'false'} onChange={e => setEditing(p => ({ ...p, is_active: e.target.value === 'true' }))}>
                  <option value="true">Active (visible)</option>
                  <option value="false">Hidden</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Eligibility</label>
                <input className={inputClass} style={inputStyle} value={editing.eligibility || ''} onChange={e => setEditing(p => ({ ...p, eligibility: e.target.value }))} placeholder="e.g. NDC Batch 28" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Registration Deadline</label>
                <input type="datetime-local" className={inputClass} style={inputStyle} value={editing.registration_deadline?.slice(0, 16) || ''} onChange={e => setEditing(p => ({ ...p, registration_deadline: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Exam Date</label>
                <input type="datetime-local" className={inputClass} style={inputStyle} value={editing.exam_date?.slice(0, 16) || ''} onChange={e => setEditing(p => ({ ...p, exam_date: e.target.value }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#6a8faf' }}>
              <input type="checkbox" checked={editing.external_only || false} onChange={e => setEditing(p => ({ ...p, external_only: e.target.checked }))} />
              Open to external colleges
            </label>
          </div>

          {/* Exam settings */}
          <div className="rounded-xl p-5 space-y-4" style={s}>
            <p className="text-xs font-bold tracking-widest" style={{ color: '#00d4ff' }}>EXAM SETTINGS</p>
            <div>
              <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Exam Format</label>
              <select className={inputClass} style={inputStyle} value={editing.exam_type || 'mixed'}
                onChange={e => setEditing(p => ({ ...p, exam_type: e.target.value as any }))}>
                <option value="photo_only">Photo Submission Only — students just upload a photo of their answer sheet</option>
                <option value="live_only">Live Exam Only — fully online, timed, on this website</option>
                <option value="mixed">Mixed — students can do both</option>
              </select>
              <p className="text-xs mt-1" style={{ color: '#3d5a78' }}>
                Controls which option(s) students see on their dashboard after registering.
              </p>
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Question Display</label>
                <select className={inputClass} style={inputStyle} value={editing.question_display || 'all_at_once'} onChange={e => setEditing(p => ({ ...p, question_display: e.target.value as any }))}>
                  <option value="all_at_once">All at once (scroll)</option>
                  <option value="one_by_one">One by one (Next button)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Timer (minutes)</label>
                <input type="number" min={1} max={300} className={inputClass} style={inputStyle} value={editing.timer_minutes ?? 60} onChange={e => setEditing(p => ({ ...p, timer_minutes: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Organizer Password</label>
                <input className={inputClass} style={inputStyle} value={editing.organizer_password || ''} onChange={e => setEditing(p => ({ ...p, organizer_password: e.target.value }))} placeholder="For organizer login" />
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#6a8faf' }}>
                <input type="checkbox" checked={editing.result_published || false} onChange={e => setEditing(p => ({ ...p, result_published: e.target.checked }))} />
                Publish results (students can see scores)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#6a8faf' }}>
                <input type="checkbox" checked={editing.annotations_published || false} onChange={e => setEditing(p => ({ ...p, annotations_published: e.target.checked }))} />
                Publish annotations (students see marked sheets)
              </label>
            </div>
          </div>

          {/* Cover & PDF */}
          <div className="rounded-xl p-5 space-y-4" style={s}>
            <p className="text-xs font-bold tracking-widest" style={{ color: '#00d4ff' }}>COVER IMAGE & PDF</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Cover Image (max {MAX_COVER_MB}MB)</label>
                <label className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm border cursor-pointer" style={{ ...inputStyle, color: '#00d4ff', opacity: uploading === 'cover' ? 0.6 : 1 }}>
                  <ImageIcon size={15} />
                  {uploading === 'cover' ? `${uploadProgress}%` : editing.cover_image_url ? 'Replace image' : 'Upload image'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading === 'cover'} onChange={e => handleCoverUpload(e.target.files?.[0] || null)} />
                </label>
                {editing.cover_image_url && uploading !== 'cover' && (
                  <div className="relative w-fit mt-2">
                    <img src={editing.cover_image_url} alt="cover" className="h-16 rounded object-cover border" style={{ borderColor: '#0f2a4a' }} />
                    <button onClick={() => setEditing(p => ({ ...p, cover_image_url: '' }))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-xs flex items-center justify-center" style={{ background: 'rgba(255,80,80,0.85)', color: 'white' }}>✕</button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Question PDF (optional, max {MAX_PDF_MB}MB)</label>
                <label className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm border cursor-pointer" style={{ ...inputStyle, color: '#00d4ff', opacity: uploading === 'pdf' ? 0.6 : 1 }}>
                  <FileText size={15} />
                  {uploading === 'pdf' ? `${uploadProgress}%` : editing.pdf_url ? 'Replace PDF' : 'Upload PDF'}
                  <input type="file" accept="application/pdf" className="hidden" disabled={uploading === 'pdf'} onChange={e => handlePdfUpload(e.target.files?.[0] || null)} />
                </label>
                {editing.pdf_url && uploading !== 'pdf' && (
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <a href={editing.pdf_url} target="_blank" className="underline" style={{ color: '#00d4ff' }}>View PDF</a>
                    <button onClick={() => setEditing(p => ({ ...p, pdf_url: '' }))} style={{ color: '#ff7070' }}>✕ Remove</button>
                  </div>
                )}
              </div>
            </div>
            {uploadError && (
              <div className="p-2.5 rounded text-xs" style={{ background: 'rgba(255,80,80,0.1)', color: '#ff7070' }}>
                {uploadError} You can still save this olympiad without it, or try the upload again.
              </div>
            )}
          </div>

          {/* Registration fields */}
          <div className="rounded-xl p-5 space-y-4" style={s}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold tracking-widest" style={{ color: '#00d4ff' }}>REGISTRATION FIELDS</p>
                <p className="text-xs mt-0.5" style={{ color: '#3d5a78' }}>Mandatory: Name, Phone, Email, HSC Session, College, College Roll — always included</p>
              </div>
              <button onClick={addRegField} className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}>
                <Plus size={12} /> Add field
              </button>
            </div>
            {(editing.registration_fields || []).map(f => (
              <div key={f.key} className="flex gap-2 items-start">
                <input className={inputClass + ' flex-1'} style={inputStyle} placeholder="Field label" value={f.label} onChange={e => updateRegField(f.key, { label: e.target.value })} />
                <select className="px-2 py-2 rounded-lg text-sm border" style={{ ...inputStyle, width: 130 }} value={f.type} onChange={e => updateRegField(f.key, { type: e.target.value as any })}>
                  <option value="text">Text</option>
                  <option value="textarea">Long text</option>
                  <option value="email">Email</option>
                  <option value="tel">Phone</option>
                </select>
                <label className="flex items-center gap-1 text-xs pt-2.5 whitespace-nowrap cursor-pointer" style={{ color: '#6a8faf' }}>
                  <input type="checkbox" checked={f.required} onChange={e => updateRegField(f.key, { required: e.target.checked })} /> Required
                </label>
                <button onClick={() => removeRegField(f.key)} className="pt-2" style={{ color: '#ff7070' }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>

          {/* Questions */}
          <div className="rounded-xl p-5 space-y-4" style={s}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold tracking-widest" style={{ color: '#00d4ff' }}>QUESTIONS</p>
                <p className="text-xs mt-0.5" style={{ color: '#3d5a78' }}>Mix MCQ, short answer, and photo-submit questions freely</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => addQuestion('mcq')} className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1" style={{ background: '#00d4ff18', color: '#00d4ff', border: '1px solid #00d4ff33' }}>
                  <List size={11} /> MCQ
                </button>
                <button onClick={() => addQuestion('short')} className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1" style={{ background: '#00ff8018', color: '#00ff80', border: '1px solid #00ff8033' }}>
                  <AlignLeft size={11} /> Short Ans
                </button>
                <button onClick={() => addQuestion('photo')} className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1" style={{ background: '#ffb34718', color: '#ffb347', border: '1px solid #ffb34733' }}>
                  <Camera size={11} /> Photo
                </button>
              </div>
            </div>
            {(editing.questions || []).length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: '#3d5a78' }}>No questions yet. Add MCQ, short answer, or photo questions above.</p>
            )}
            {(editing.questions || []).map((q, qi) => (
              <div key={q.id} className="rounded-lg p-4 space-y-3" style={{ background: '#0a1f35', border: `1px solid ${qTypeColor(q.type)}33` }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: `${qTypeColor(q.type)}18`, color: qTypeColor(q.type) }}>
                    {qTypeIcon(q.type)} Q{qi + 1} · {qTypeLabel(q.type)}
                  </span>
                  <div className="flex items-center gap-1 ml-auto">
                    <input type="number" min={0} value={q.marks ?? 1} onChange={e => updateQuestion(q.id, { marks: Number(e.target.value) })} className="w-14 px-2 py-1 rounded text-xs border text-right" style={inputStyle} title="Marks for this question" />
                    <span className="text-xs" style={{ color: '#3d5a78' }}>marks</span>
                    <button onClick={() => removeQuestion(q.id)} className="ml-2" style={{ color: '#ff7070' }}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Question text *</label>
                  <textarea rows={2} className={inputClass + ' resize-none'} style={inputStyle} value={q.text} onChange={e => updateQuestion(q.id, { text: e.target.value })} placeholder="Enter the question..." />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Description / hint (optional)</label>
                  <input className={inputClass} style={inputStyle} value={q.description || ''} onChange={e => updateQuestion(q.id, { description: e.target.value })} placeholder="Additional context or instructions for this question" />
                </div>
                {q.type === 'mcq' && (
                  <div className="space-y-2">
                    <label className="text-xs" style={{ color: '#6a8faf' }}>Options (click radio to mark correct answer)</label>
                    {(q.options || []).map(o => (
                      <div key={o.id} className="flex items-center gap-2">
                        <input type="radio" name={`correct-${q.id}`} checked={q.correct_option_id === o.id} onChange={() => updateQuestion(q.id, { correct_option_id: o.id })} style={{ accentColor: '#00ff80' }} />
                        <input className={inputClass} style={inputStyle} value={o.text} onChange={e => updateOption(q.id, o.id, e.target.value)} placeholder="Option text" />
                        <button onClick={() => removeOption(q.id, o.id)} style={{ color: '#ff7070' }}><X size={13} /></button>
                      </div>
                    ))}
                    <button onClick={() => addOption(q.id)} className="text-xs flex items-center gap-1" style={{ color: '#00d4ff' }}><Plus size={11} /> Add option</button>
                  </div>
                )}
                {q.type === 'photo' && (
                  <p className="text-xs" style={{ color: '#3d5a78' }}>Student will upload a photo (their handwritten answer) for this question.</p>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  // ── Main list view ──────────────────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={h}>Olympiads</h1>
        <button onClick={() => { setEditing({ ...BLANK }); setUploadError(''); setUploadProgress(0); setUploading(null) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
          style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}>
          <Plus size={16} /> New Olympiad
        </button>
      </div>

      {pageError && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between" style={{ background: 'rgba(255,80,80,0.12)', border: '1px solid rgba(255,80,80,0.4)', color: '#ff6b6b' }}>
          <span>{pageError}</span>
          <button onClick={() => setPageError('')}><X size={14} /></button>
        </div>
      )}

      {/* Announcement link */}
      <Link href="/admin/announcements" className="flex items-center justify-between mb-6 px-4 py-3 rounded-xl" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.15)' }}>
        <div className="flex items-center gap-3">
          <Megaphone size={16} style={{ color: '#00d4ff' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: '#e0f0ff' }}>Send an Announcement</p>
            <p className="text-xs" style={{ color: '#3d5a78' }}>Email members, olympiad registrants, or everyone — manage announcements →</p>
          </div>
        </div>
        <ArrowRight size={16} style={{ color: '#3d5a78' }} />
      </Link>

      {loading && <p className="text-center py-12" style={{ color: '#3d5a78' }}>Loading…</p>}

      {!loading && olympiads.length === 0 && (
        <div className="text-center py-12 rounded-xl" style={s}>
          <p style={{ color: '#3d5a78' }}>No olympiads yet. Click &quot;New Olympiad&quot; to create one.</p>
        </div>
      )}

      <div className="space-y-3">
        {olympiads.map(o => (
          <div key={o.id} className="rounded-xl overflow-hidden" style={s}>
            <div className="flex items-center gap-4 px-5 py-4">
              {o.cover_image_url && <img src={o.cover_image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold" style={{ color: '#e0f0ff' }}>{o.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: o.is_active ? '#00ff8022' : '#ff707022', color: o.is_active ? '#00ff80' : '#ff7070' }}>
                    {o.is_active ? 'Active' : 'Hidden'}
                  </span>
                  {o.result_published && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: '#00d4ff22', color: '#00d4ff' }}>Results Published</span>}
                  {o.timer_minutes && <span className="text-xs flex items-center gap-1" style={{ color: '#3d5a78' }}><Clock size={10} />{o.timer_minutes}min</span>}
                  <span className="text-xs" style={{ color: '#3d5a78' }}>{(o.questions || []).length} questions</span>
                </div>
                {o.description && <p className="text-xs mt-1 truncate" style={{ color: '#3d5a78' }}>{o.description}</p>}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleField(o.id, 'is_active', !o.is_active)} title={o.is_active ? 'Hide' : 'Activate'} className="p-1.5 rounded" style={{ color: '#3d5a78' }}>
                  {o.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button onClick={() => { setEditing(o); setUploadError(''); setUploadProgress(0); setUploading(null) }} className="p-1.5 rounded" style={{ color: '#6a8faf' }}>
                  <Edit2 size={15} />
                </button>
                <button onClick={() => del(o.id)} className="p-1.5 rounded" style={{ color: '#ff7070' }}><Trash2 size={15} /></button>
                <button onClick={() => { setSelectedOlympiadId(o.id); setTab('registrations'); loadRegistrations(o.id) }}
                  className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'rgba(0,212,255,0.3)', color: '#00d4ff' }}>
                  Registrations
                </button>
                <button onClick={() => toggleExpand(o.id)} className="p-1.5 rounded" style={{ color: '#3d5a78' }}>
                  {expandedId === o.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
              </div>
            </div>

            {expandedId === o.id && (
              <div className="px-5 pb-4 space-y-2" style={{ borderTop: '1px solid #0f2a4a' }}>
                <div className="flex gap-4 pt-3 text-xs flex-wrap" style={{ color: '#3d5a78' }}>
                  {o.exam_date && <span>Exam: {new Date(o.exam_date).toLocaleString()}</span>}
                  {o.registration_deadline && <span>Reg deadline: {new Date(o.registration_deadline).toLocaleString()}</span>}
                  {o.eligibility && <span>Eligibility: {o.eligibility}</span>}
                  <span>Display: {o.question_display === 'one_by_one' ? 'One by one' : 'All at once'}</span>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => toggleField(o.id, 'result_published', !o.result_published)}
                    className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: o.result_published ? '#00ff8044' : '#0f2a4a', color: o.result_published ? '#00ff80' : '#3d5a78' }}>
                    {o.result_published ? '✓ Results Published' : 'Publish Results'}
                  </button>
                  <button onClick={() => toggleField(o.id, 'annotations_published', !o.annotations_published)}
                    className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: o.annotations_published ? '#00d4ff44' : '#0f2a4a', color: o.annotations_published ? '#00d4ff' : '#3d5a78' }}>
                    {o.annotations_published ? '✓ Annotations Published' : 'Publish Annotations'}
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

function AdminScoreOnlyForm({ reg, onClose, onSave, inputClass, inputStyle }: {
  reg: any
  onClose: () => void
  onSave: (regId: string, data: { score: number; annotations: Annotation[]; organizerNote: string }) => Promise<void>
  inputClass: string
  inputStyle: React.CSSProperties
}) {
  const [score, setScore] = useState(reg.final_score?.toString() || '')
  const [note, setNote] = useState(reg.organizer_note || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    const num = Number(score)
    if (score === '' || Number.isNaN(num)) { setErr('Please enter a valid score.'); return }
    setSaving(true); setErr('')
    try {
      await onSave(reg.id, { score: num, annotations: reg.annotations || [], organizerNote: note })
      onClose()
    } catch (e: any) {
      setErr(e.message || 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Score</label>
        <input type="number" className={inputClass} style={inputStyle} value={score} onChange={e => setScore(e.target.value)} autoFocus />
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Note (optional)</label>
        <textarea rows={3} className={inputClass + ' resize-none'} style={inputStyle} value={note} onChange={e => setNote(e.target.value)} />
      </div>
      {err && <p className="text-xs" style={{ color: '#ff7070' }}>{err}</p>}
      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
          style={{ background: '#00d4ff', color: '#000' }}>{saving ? 'Saving...' : 'Save'}</button>
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: '#6a8faf' }}>Cancel</button>
      </div>
    </div>
  )
}
