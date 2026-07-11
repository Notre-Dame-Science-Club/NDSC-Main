'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Eye, EyeOff, X, Megaphone, ArrowRight, Image as ImageIcon, FileText, Clock, AlignLeft, List, Camera, ArrowUp, ArrowDown, Copy, CheckSquare, ClipboardList, Link2, Lightbulb, BookOpen, CheckCircle2 } from 'lucide-react'
import AnnotationViewer, { Annotation } from '@/components/olympiad/AnnotationViewer'
import MathInputField from '@/components/olympiad/MathInputField'
import MathText from '@/components/olympiad/MathText'
import ResponseDetailModal from '@/components/olympiad/ResponseDetailModal'

const uid = () => Math.random().toString(36).slice(2, 9)

type FieldType = 'text' | 'textarea' | 'email' | 'tel' | 'select'
type RegField = { key: string; label: string; type: FieldType; required: boolean; options?: string[] }

type QuestionType = 'mcq' | 'checkbox' | 'short' | 'photo'
type McqOption = { id: string; text: string }
type Question = {
  id: string
  type: QuestionType
  text: string
  description?: string
  image_url?: string
  options?: McqOption[]
  correct_option_id?: string
  correct_option_ids?: string[]
  required?: boolean
  marks?: number
  subject_id?: string
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
  // Appearance — all optional, blank means "use the site default"
  theme_bg_color?: string | null
  theme_bg_image_url?: string | null
  theme_accent_color?: string | null
  theme_header_title?: string | null
  theme_header_subtitle?: string | null
  theme_header_logo_url?: string | null
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
  const [viewingResponseReg, setViewingResponseReg] = useState<any | null>(null)
  const [uploading, setUploading] = useState<'cover' | 'pdf' | 'bg' | 'logo' | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')
  // Which olympiads are actually derived from an Activity online leaf, vs
  // legacy freestanding ones created directly here. Keyed by olympiad id.
  const [linkInfo, setLinkInfo] = useState<Record<string, any>>({})

  const h = { fontFamily: 'Orbitron, monospace', color: 'var(--blue)' }
  const s = { background: 'var(--surface-deep)', border: '1px solid var(--border)' }
  const inputStyle = { background: 'var(--surface-alt)', borderColor: 'var(--border)', color: 'var(--white-soft)' }
  const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'

  const [pageError2, setPageError2] = useState('')

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/olympiads')
    if (res.ok) setOlympiads(await res.json() || [])
    else setPageError('Failed to load olympiads.')
    try {
      const linkRes = await fetch('/api/admin/online-categories')
      if (linkRes.ok) {
        const links = await linkRes.json()
        setLinkInfo(Object.fromEntries((links || []).map((l: any) => [l.olympiad_id, l])))
      }
    } catch { /* non-critical — falls back to treating everything as standalone */ }
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

  const handleBgImageUpload = async (file: File | null) => {
    if (!file) return
    setUploading('bg'); setUploadError(''); setUploadProgress(0)
    try {
      const url = await uploadFile(file, 'olympiad-backgrounds', MAX_COVER_MB, ['image/jpeg', 'image/png', 'image/webp'])
      setEditing(p => ({ ...p, theme_bg_image_url: url }))
    } catch (e: any) { setUploadError(e.message) }
    setUploading(null)
  }

  const handleHeaderLogoUpload = async (file: File | null) => {
    if (!file) return
    setUploading('logo'); setUploadError(''); setUploadProgress(0)
    try {
      const url = await uploadFile(file, 'olympiad-logos', MAX_COVER_MB, ['image/jpeg', 'image/png', 'image/webp'])
      setEditing(p => ({ ...p, theme_header_logo_url: url }))
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
    const q: Question = { id: uid(), type, text: '', description: '', marks: 1, required: true }
    if (type === 'mcq') q.options = [{ id: uid(), text: '' }, { id: uid(), text: '' }]
    if (type === 'checkbox') { q.options = [{ id: uid(), text: '' }, { id: uid(), text: '' }]; q.correct_option_ids = [] }
    setEditing(p => ({ ...p, questions: [...(p?.questions || []), q] }))
  }
  const removeQuestion = (qid: string) => setEditing(p => ({ ...p, questions: (p?.questions || []).filter(q => q.id !== qid) }))
  const updateQuestion = (qid: string, patch: Partial<Question>) => setEditing(p => ({
    ...p, questions: (p?.questions || []).map(q => q.id === qid ? { ...q, ...patch } : q)
  }))
  const duplicateQuestion = (qid: string) => setEditing(p => {
    const list = p?.questions || []
    const idx = list.findIndex(q => q.id === qid)
    if (idx === -1) return p
    const orig = list[idx]
    const copy: Question = {
      ...orig,
      id: uid(),
      options: orig.options?.map(o => ({ ...o, id: uid() })),
    }
    // Remap correct-answer references onto the freshly-generated option ids
    if (orig.type === 'mcq' && orig.correct_option_id) {
      const origIdx = (orig.options || []).findIndex(o => o.id === orig.correct_option_id)
      copy.correct_option_id = origIdx >= 0 ? copy.options?.[origIdx]?.id : undefined
    }
    if (orig.type === 'checkbox' && orig.correct_option_ids) {
      copy.correct_option_ids = orig.correct_option_ids
        .map(cid => (orig.options || []).findIndex(o => o.id === cid))
        .filter(i => i >= 0)
        .map(i => copy.options?.[i]?.id)
        .filter(Boolean) as string[]
    }
    const next = [...list]
    next.splice(idx + 1, 0, copy)
    return { ...p, questions: next }
  })
  const moveQuestion = (qid: string, dir: -1 | 1) => setEditing(p => {
    const list = [...(p?.questions || [])]
    const idx = list.findIndex(q => q.id === qid)
    const swapIdx = idx + dir
    if (idx === -1 || swapIdx < 0 || swapIdx >= list.length) return p
    ;[list[idx], list[swapIdx]] = [list[swapIdx], list[idx]]
    return { ...p, questions: list }
  })
  const addOption = (qid: string) => updateQuestion(qid, { options: [...((editing?.questions || []).find(q => q.id === qid)?.options || []), { id: uid(), text: '' }] })
  const removeOption = (qid: string, oid: string) => {
    const q = (editing?.questions || []).find(q => q.id === qid)
    if (!q) return
    updateQuestion(qid, {
      options: (q.options || []).filter(o => o.id !== oid),
      correct_option_ids: (q.correct_option_ids || []).filter(id => id !== oid),
    })
  }
  const updateOption = (qid: string, oid: string, text: string) => {
    const q = (editing?.questions || []).find(q => q.id === qid)
    if (!q) return
    updateQuestion(qid, { options: (q.options || []).map(o => o.id === oid ? { ...o, text } : o) })
  }
  const toggleCheckboxCorrect = (qid: string, oid: string) => {
    const q = (editing?.questions || []).find(q => q.id === qid)
    if (!q) return
    const current = q.correct_option_ids || []
    const next = current.includes(oid) ? current.filter(id => id !== oid) : [...current, oid]
    updateQuestion(qid, { correct_option_ids: next })
  }
  const handleQuestionImageUpload = async (qid: string, file: File | null) => {
    if (!file) return
    setUploadError('')
    try {
      const url = await uploadFile(file, 'olympiad-question-images', MAX_COVER_MB, ['image/jpeg', 'image/png', 'image/webp'])
      updateQuestion(qid, { image_url: url })
    } catch (e: any) { setUploadError(e.message) }
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
      theme_bg_color: editing.theme_bg_color || null,
      theme_bg_image_url: editing.theme_bg_image_url || null,
      theme_accent_color: editing.theme_accent_color || null,
      theme_header_title: editing.theme_header_title || null,
      theme_header_subtitle: editing.theme_header_subtitle || null,
      theme_header_logo_url: editing.theme_header_logo_url || null,
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
    const warning = linkInfo[id]
      ? `This olympiad is linked to an Activity category (${linkInfo[id].breadcrumb.join(' → ')}). Deleting it will break online registration for that category. Delete anyway?`
      : 'Delete this olympiad and all its registrations?'
    if (!confirm(warning)) return
    const res = await fetch('/api/admin/olympiads', { method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }) })
    if (!res.ok) { const d = await res.json().catch(() => ({})); setPageError(d.error || 'Delete failed.') }
    load()
  }

  const toggleField = async (id: string, field: string, value: boolean) => {
    await fetch('/api/admin/olympiads', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, [field]: value }) })
    load()
  }

  const saveResponseGrading = async (regId: string, patch: { question_results: any[]; final_score: number; review_status: string }) => {
    const res = await fetch('/api/admin/olympiad-registrations', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: regId, ...patch }),
    })
    if (!res.ok) {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error || 'Could not save response.')
    }
    if (selectedOlympiadId) loadRegistrations(selectedOlympiadId)
  }

  const hasOnlineAnswers = (r: any) =>
    (Array.isArray(r.question_results) && r.question_results.length > 0) ||
    (r.mcq_answers && Object.keys(r.mcq_answers).length > 0) ||
    (r.short_answers && Object.keys(r.short_answers).length > 0) ||
    (Array.isArray(r.photo_answers) && r.photo_answers.length > 0 && !r.answer_sheet_url)

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

  const qTypeLabel = (t: QuestionType) => t === 'mcq' ? 'MCQ' : t === 'checkbox' ? 'Checkboxes' : t === 'short' ? 'Short Answer' : 'Photo Upload'
  const qTypeColor = (t: QuestionType) => t === 'mcq' ? 'var(--blue)' : t === 'checkbox' ? 'var(--accent2)' : t === 'short' ? 'var(--success)' : 'var(--warning)'
  const qTypeIcon = (t: QuestionType) => t === 'mcq' ? <List size={12} /> : t === 'checkbox' ? <CheckSquare size={12} /> : t === 'short' ? <AlignLeft size={12} /> : <Camera size={12} />

  // ── Registrations view ──────────────────────────────────────────────────────
  if (tab === 'registrations' && selectedOlympiadId) {
    const regs = registrations[selectedOlympiadId] || []
    const olympiad = olympiads.find(o => o.id === selectedOlympiadId)
    return (
      <div>
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setTab('olympiads')} className="text-sm px-3 py-1 rounded border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>← Back</button>
          <h1 className="text-xl font-bold" style={h}>{olympiad?.name} — Registrations ({regs.length})</h1>
          <button onClick={() => loadRegistrations(selectedOlympiadId!)} className="text-sm px-3 py-1 rounded border ml-auto" style={{ borderColor: 'rgba(var(--blue-rgb), 0.3)', color: 'var(--blue)' }}>↺ Refresh</button>
        </div>
        <div className="rounded-xl border overflow-x-auto" style={s}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(var(--blue-rgb), 0.04)' }}>
                {['Name','Phone','Email','HSC Session','College','Roll','Score','Status','Responses','Answer Sheet'].map(h2 => (
                  <th key={h2} className="text-left px-4 py-3 font-medium whitespace-nowrap" style={{ color: 'var(--muted)' }}>{h2}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regs.length === 0 && (
                <tr><td colSpan={10} className="px-4 py-8 text-center" style={{ color: 'var(--border-soft)' }}>No registrations yet.</td></tr>
              )}
              {regs.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid var(--border)' }}>
                  <td className="px-4 py-3" style={{ color: 'var(--white-soft)' }}>{r.full_name}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{r.phone}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{r.email}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{r.hsc_session}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{r.college}</td>
                  <td className="px-4 py-3" style={{ color: 'var(--muted)' }}>{r.college_roll}</td>
                  <td className="px-4 py-3">
                    <button onClick={() => setViewingReg(r)}
                      className="text-xs px-2 py-1 rounded border" style={{ borderColor: 'var(--border)', color: r.final_score != null ? 'var(--success)' : 'var(--border-soft)' }}>
                      {r.final_score != null ? r.final_score : 'Mark'}
                    </button>
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: r.review_status === 'reviewed' ? 'rgba(var(--success-rgb), 0.13)' : 'rgba(var(--warning-rgb), 0.13)', color: r.review_status === 'reviewed' ? 'var(--success)' : 'var(--warning)' }}>
                      {r.review_status || 'pending'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {hasOnlineAnswers(r) ? (
                      <button onClick={() => setViewingResponseReg(r)} className="text-xs px-2 py-1 rounded border flex items-center gap-1" style={{ borderColor: 'rgba(var(--blue-rgb), 0.3)', color: 'var(--blue)' }}>
                        <ClipboardList size={11} /> View
                      </button>
                    ) : (
                      <span className="text-xs" style={{ color: 'var(--border-soft)' }}>—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {r.answer_sheet_url && (
                      <button onClick={() => setViewingReg(r)} className="text-xs underline" style={{ color: 'var(--blue)' }}>
                        View{(r.annotations?.length ?? 0) > 0 ? ` (${r.annotations.length} marks)` : ''}
                      </button>
                    )}
                    {!r.answer_sheet_url && r.exam_submitted_at && <span className="text-xs inline-flex items-center gap-1" style={{ color: 'var(--success)' }}>Online <CheckCircle2 size={12} /></span>}
                    {!r.answer_sheet_url && !r.exam_submitted_at && <span className="text-xs" style={{ color: 'var(--border-soft)' }}>—</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {viewingResponseReg && (
          <ResponseDetailModal
            reg={viewingResponseReg}
            questions={olympiad?.questions || []}
            onClose={() => setViewingResponseReg(null)}
            onSave={saveResponseGrading}
          />
        )}

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
            <button onClick={() => { setEditing(null); setUploadError('') }} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>Cancel</button>
            <button onClick={save} disabled={saving} className="px-5 py-2 rounded-lg text-sm font-bold" style={{ background: 'linear-gradient(90deg,var(--blue),var(--blue2))', color: '#fff' }}>
              {saving ? 'Saving…' : 'SAVE →'}
            </button>
          </div>
        </div>
        {pageError && <div className="mb-4 px-4 py-3 rounded-lg text-sm" style={{ background: 'rgba(var(--danger-rgb), 0.12)', border: '1px solid rgba(var(--danger-rgb), 0.4)', color: 'var(--danger)' }}>{pageError}</div>}

        <div className="space-y-5 max-w-3xl">
          {/* Basic info */}
          <div className="rounded-xl p-5 space-y-4" style={s}>
            <p className="text-xs font-bold tracking-widest" style={{ color: 'var(--blue)' }}>BASIC INFO</p>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Title *</label>
              <input className={inputClass} style={inputStyle} value={editing.name || ''} onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Batch 28 Introductory Quiz" />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Description</label>
              <textarea rows={3} className={inputClass + ' resize-none'} style={inputStyle} value={editing.description || ''} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Status</label>
                <select className={inputClass} style={inputStyle} value={editing.is_active ? 'true' : 'false'} onChange={e => setEditing(p => ({ ...p, is_active: e.target.value === 'true' }))}>
                  <option value="true">Active (visible)</option>
                  <option value="false">Hidden</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Eligibility</label>
                <input className={inputClass} style={inputStyle} value={editing.eligibility || ''} onChange={e => setEditing(p => ({ ...p, eligibility: e.target.value }))} placeholder="e.g. NDC Batch 28" />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Registration Deadline</label>
                <input type="datetime-local" className={inputClass} style={inputStyle} value={editing.registration_deadline?.slice(0, 16) || ''} onChange={e => setEditing(p => ({ ...p, registration_deadline: e.target.value }))} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Exam Date</label>
                <input type="datetime-local" className={inputClass} style={inputStyle} value={editing.exam_date?.slice(0, 16) || ''} onChange={e => setEditing(p => ({ ...p, exam_date: e.target.value }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--muted)' }}>
              <input type="checkbox" checked={editing.external_only || false} onChange={e => setEditing(p => ({ ...p, external_only: e.target.checked }))} />
              Open to external colleges
            </label>
          </div>

          {/* Exam settings */}
          <div className="rounded-xl p-5 space-y-4" style={s}>
            <p className="text-xs font-bold tracking-widest" style={{ color: 'var(--blue)' }}>EXAM SETTINGS</p>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Exam Format</label>
              {editing.id && linkInfo[editing.id] ? (
                <>
                  <div className="px-3 py-2 rounded-lg text-sm border" style={{ ...inputStyle, opacity: 0.7 }}>
                    {editing.exam_type === 'photo_only' ? 'Pure Submission' : editing.exam_type === 'live_only' ? ((editing as any).relay_mode ? 'Science Relay' : 'Full Quiz System') : 'Mixed'}
                  </div>
                  <p className="text-xs mt-1" style={{ color: 'var(--border-soft)' }}>
                    Inherited from Activity Admin — <Link href={`/admin/activity-registration/${linkInfo[editing.id].session_id}`} className="hover:underline" style={{ color: 'var(--blue)' }}>edit the Online Type there</Link>.
                  </p>
                </>
              ) : (
                <>
                  <select className={inputClass} style={inputStyle} value={editing.exam_type || 'mixed'}
                    onChange={e => setEditing(p => ({ ...p, exam_type: e.target.value as any }))}>
                    <option value="photo_only">Photo Submission Only — students just upload a photo of their answer sheet</option>
                    <option value="live_only">Live Exam Only — fully online, timed, on this website</option>
                    <option value="mixed">Mixed — students can do both</option>
                  </select>
                  <p className="text-xs mt-1" style={{ color: 'var(--border-soft)' }}>
                    Controls which option(s) students see on their dashboard after registering.
                  </p>
                </>
              )}
            </div>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Question Display</label>
                <select className={inputClass} style={inputStyle} value={editing.question_display || 'all_at_once'} onChange={e => setEditing(p => ({ ...p, question_display: e.target.value as any }))}>
                  <option value="all_at_once">All at once (scroll)</option>
                  <option value="one_by_one">One by one (Next button)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Timer (minutes)</label>
                <input type="number" min={1} max={300} className={inputClass} style={inputStyle} value={editing.timer_minutes ?? 60} onChange={e => setEditing(p => ({ ...p, timer_minutes: Number(e.target.value) }))} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Organizer Password</label>
                <input className={inputClass} style={inputStyle} value={editing.organizer_password || ''} onChange={e => setEditing(p => ({ ...p, organizer_password: e.target.value }))} placeholder="For organizer login" />
              </div>
            </div>
            <div className="flex gap-6">
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={editing.result_published || false} onChange={e => setEditing(p => ({ ...p, result_published: e.target.checked }))} />
                Publish results (students can see scores)
              </label>
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={editing.annotations_published || false} onChange={e => setEditing(p => ({ ...p, annotations_published: e.target.checked }))} />
                Publish annotations (students see marked sheets)
              </label>
            </div>
          </div>

          {/* ── Phase D: Scheduling ────────────────────────────────── */}
          <div className="rounded-xl p-5 space-y-4" style={s}>
            <p className="text-xs font-bold tracking-widest" style={{ color: 'var(--cat-teal)' }}>⏰ EXAM SCHEDULING (auto-start at a set time)</p>
            <p className="text-xs" style={{ color: 'var(--border-soft)' }}>
              If set, the exam page will show a countdown and auto-unlock at the scheduled start time.
              Students cannot start early; submissions are locked after the end time.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Scheduled Start</label>
                <input type="datetime-local" className={inputClass} style={inputStyle}
                  value={(editing as any).scheduled_start_at?.slice(0, 16) || ''}
                  onChange={e => setEditing(p => ({ ...p, scheduled_start_at: e.target.value || null } as any))} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Scheduled End</label>
                <input type="datetime-local" className={inputClass} style={inputStyle}
                  value={(editing as any).scheduled_end_at?.slice(0, 16) || ''}
                  onChange={e => setEditing(p => ({ ...p, scheduled_end_at: e.target.value || null } as any))} />
              </div>
            </div>
          </div>

          {/* ── Phase D: Relay / Sequential exam ──────────────────── */}
          <div className="rounded-xl p-5 space-y-4" style={s}>
            <p className="text-xs font-bold tracking-widest inline-flex items-center gap-1.5" style={{ color: 'var(--accent2)' }}><Link2 size={13} /> TEAM RELAY MODE</p>
            <p className="text-xs" style={{ color: 'var(--border-soft)' }}>
              In relay mode, team members take turns. Member 1 submits → Member 2 can start → and so on.
              In <strong>chain</strong> mode, a later member's questions can reference earlier answers using <code style={{ color: 'var(--accent2)' }}>{'{{chain.member1.FIELD_ID}}'}</code> variables.
            </p>
            {editing.id && linkInfo[editing.id] ? (
              <p className="text-xs" style={{ color: 'var(--border-soft)' }}>
                Relay mode is currently <strong style={{ color: 'var(--accent2)' }}>{(editing as any).relay_mode ? 'ON' : 'OFF'}</strong> — inherited from Activity Admin's Online Type setting (choose &quot;Science Relay&quot; there to enable it).
              </p>
            ) : (
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--accent2)' }}>
                <input type="checkbox" checked={(editing as any).relay_mode || false}
                  onChange={e => setEditing(p => ({ ...p, relay_mode: e.target.checked } as any))} />
                Enable relay / sequential exam mode
              </label>
            )}
            {(editing as any).relay_mode && (
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Relay type</label>
                <select className={inputClass} style={inputStyle}
                  value={(editing as any).relay_type || 'sequential'}
                  onChange={e => setEditing(p => ({ ...p, relay_type: e.target.value } as any))}>
                  <option value="sequential">Sequential — each member waits for the previous one to finish</option>
                  <option value="chain">Chain — next member's questions can use previous answers as variables</option>
                </select>
              </div>
            )}
          </div>

          {/* ── Phase D: Subject assignment ───────────────────────── */}
          <div className="rounded-xl p-5 space-y-4" style={s}>
            <p className="text-xs font-bold tracking-widest inline-flex items-center gap-1.5" style={{ color: 'var(--warning)' }}><BookOpen size={13} /> SUBJECTS (assign different subjects to different team members)</p>
            <p className="text-xs" style={{ color: 'var(--border-soft)' }}>
              Add subjects here. Members can self-select their subject from the exam dashboard (or you can assign them).
              Each subject maps to a specific set of questions (set this in the Questions section above).
            </p>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Subject assignment mode</label>
              <select className={inputClass} style={inputStyle}
                value={(editing as any).subject_assignment_mode || 'self_select'}
                onChange={e => setEditing(p => ({ ...p, subject_assignment_mode: e.target.value } as any))}>
                <option value="self_select">Self-select — each member picks their own subject</option>
                <option value="admin_assign">Admin assigns — you assign subjects from the admin panel</option>
                <option value="auto">Auto — subjects are assigned automatically based on registration order</option>
              </select>
            </div>
            <div>
              <p className="text-xs font-semibold mb-2" style={{ color: 'var(--warning)' }}>Subject List</p>
              {((editing as any).subjects || []).map((sub: any, idx: number) => (
                <div key={sub.id} className="flex gap-2 mb-2">
                  <input placeholder="Subject name (e.g. Physics, Mathematics)" value={sub.name}
                    onChange={e => {
                      const updated = [...((editing as any).subjects || [])]
                      updated[idx] = { ...updated[idx], name: e.target.value }
                      setEditing(p => ({ ...p, subjects: updated } as any))
                    }}
                    className={inputClass} style={inputStyle} />
                  <button onClick={() => setEditing(p => ({ ...p, subjects: ((p as any).subjects || []).filter((_: any, i: number) => i !== idx) } as any))}
                    style={{ color: 'var(--danger-soft)' }}><Trash2 size={14} /></button>
                </div>
              ))}
              <button
                onClick={() => setEditing(p => ({ ...p, subjects: [...((p as any).subjects || []), { id: Math.random().toString(36).slice(2,9), name: '' }] } as any))}
                className="text-xs px-3 py-1.5 rounded flex items-center gap-1"
                style={{ background: 'rgba(var(--warning-rgb), 0.1)', color: 'var(--warning)' }}>
                <Plus size={11} /> Add subject
              </button>
            </div>
          </div>

          {/* Cover & PDF */}
          <div className="rounded-xl p-5 space-y-4" style={s}>
            <p className="text-xs font-bold tracking-widest" style={{ color: 'var(--blue)' }}>COVER IMAGE & PDF</p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Cover Image (max {MAX_COVER_MB}MB)</label>
                <label className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm border cursor-pointer" style={{ ...inputStyle, color: 'var(--blue)', opacity: uploading === 'cover' ? 0.6 : 1 }}>
                  <ImageIcon size={15} />
                  {uploading === 'cover' ? `${uploadProgress}%` : editing.cover_image_url ? 'Replace image' : 'Upload image'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading === 'cover'} onChange={e => handleCoverUpload(e.target.files?.[0] || null)} />
                </label>
                {editing.cover_image_url && uploading !== 'cover' && (
                  <div className="relative w-fit mt-2">
                    <img src={editing.cover_image_url} alt="cover" className="h-16 rounded object-cover border" style={{ borderColor: 'var(--border)' }} />
                    <button onClick={() => setEditing(p => ({ ...p, cover_image_url: '' }))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(var(--danger-rgb), 0.85)', color: 'white' }}><X size={11} /></button>
                  </div>
                )}
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Question PDF (optional, max {MAX_PDF_MB}MB)</label>
                <label className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm border cursor-pointer" style={{ ...inputStyle, color: 'var(--blue)', opacity: uploading === 'pdf' ? 0.6 : 1 }}>
                  <FileText size={15} />
                  {uploading === 'pdf' ? `${uploadProgress}%` : editing.pdf_url ? 'Replace PDF' : 'Upload PDF'}
                  <input type="file" accept="application/pdf" className="hidden" disabled={uploading === 'pdf'} onChange={e => handlePdfUpload(e.target.files?.[0] || null)} />
                </label>
                {editing.pdf_url && uploading !== 'pdf' && (
                  <div className="flex items-center gap-2 mt-2 text-xs">
                    <a href={editing.pdf_url} target="_blank" className="underline" style={{ color: 'var(--blue)' }}>View PDF</a>
                    <button onClick={() => setEditing(p => ({ ...p, pdf_url: '' }))} className="inline-flex items-center gap-1" style={{ color: 'var(--danger-soft)' }}><X size={12} /> Remove</button>
                  </div>
                )}
              </div>
            </div>
            {uploadError && (
              <div className="p-2.5 rounded text-xs" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)' }}>
                {uploadError} You can still save this olympiad without it, or try the upload again.
              </div>
            )}
          </div>

          {/* Appearance — per-olympiad theme override for the public
              register/exam/result pages. Everything here is optional; blank
              fields just fall back to the site's normal look. */}
          <div className="rounded-xl p-5 space-y-4" style={s}>
            <p className="text-xs font-bold tracking-widest" style={{ color: 'var(--blue)' }}>APPEARANCE</p>
            <p className="text-xs" style={{ color: 'var(--border-soft)' }}>
              Customize how this specific olympiad looks to students on the register, exam, and result pages. Leave anything blank to use the site's normal look.
            </p>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Background Color</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editing.theme_bg_color || '#0b1220'}
                    onChange={e => setEditing(p => ({ ...p, theme_bg_color: e.target.value }))}
                    className="w-10 h-9 rounded border cursor-pointer flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'transparent' }} />
                  <input type="text" className={inputClass} style={inputStyle} placeholder="e.g. #0b1220 — blank uses the default"
                    value={editing.theme_bg_color || ''} onChange={e => setEditing(p => ({ ...p, theme_bg_color: e.target.value || null }))} />
                  {editing.theme_bg_color && <button onClick={() => setEditing(p => ({ ...p, theme_bg_color: null }))} title="Clear" style={{ color: 'var(--danger-soft)' }}><X size={14} /></button>}
                </div>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Accent Color (buttons & highlights)</label>
                <div className="flex items-center gap-2">
                  <input type="color" value={editing.theme_accent_color || '#3b82f6'}
                    onChange={e => setEditing(p => ({ ...p, theme_accent_color: e.target.value }))}
                    className="w-10 h-9 rounded border cursor-pointer flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'transparent' }} />
                  <input type="text" className={inputClass} style={inputStyle} placeholder="e.g. #3b82f6 — blank uses the default blue"
                    value={editing.theme_accent_color || ''} onChange={e => setEditing(p => ({ ...p, theme_accent_color: e.target.value || null }))} />
                  {editing.theme_accent_color && <button onClick={() => setEditing(p => ({ ...p, theme_accent_color: null }))} title="Clear" style={{ color: 'var(--danger-soft)' }}><X size={14} /></button>}
                </div>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Background Image (optional, max {MAX_COVER_MB}MB)</label>
                <label className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm border cursor-pointer" style={{ ...inputStyle, color: 'var(--blue)', opacity: uploading === 'bg' ? 0.6 : 1 }}>
                  <ImageIcon size={15} />
                  {uploading === 'bg' ? `${uploadProgress}%` : editing.theme_bg_image_url ? 'Replace image' : 'Upload image'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading === 'bg'} onChange={e => handleBgImageUpload(e.target.files?.[0] || null)} />
                </label>
                {editing.theme_bg_image_url && uploading !== 'bg' && (
                  <div className="relative w-fit mt-2">
                    <img src={editing.theme_bg_image_url} alt="background" className="h-16 rounded object-cover border" style={{ borderColor: 'var(--border)' }} />
                    <button onClick={() => setEditing(p => ({ ...p, theme_bg_image_url: '' }))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(var(--danger-rgb), 0.85)', color: 'white' }}><X size={11} /></button>
                  </div>
                )}
                <p className="text-[11px] mt-1" style={{ color: 'var(--border-soft)' }}>Shown behind the register/exam/result pages, tinted with the background color above.</p>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Header Logo (optional, max {MAX_COVER_MB}MB)</label>
                <label className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm border cursor-pointer" style={{ ...inputStyle, color: 'var(--blue)', opacity: uploading === 'logo' ? 0.6 : 1 }}>
                  <ImageIcon size={15} />
                  {uploading === 'logo' ? `${uploadProgress}%` : editing.theme_header_logo_url ? 'Replace logo' : 'Upload logo'}
                  <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" disabled={uploading === 'logo'} onChange={e => handleHeaderLogoUpload(e.target.files?.[0] || null)} />
                </label>
                {editing.theme_header_logo_url && uploading !== 'logo' && (
                  <div className="relative w-fit mt-2">
                    <img src={editing.theme_header_logo_url} alt="logo" className="h-12 rounded object-contain border p-1" style={{ borderColor: 'var(--border)', background: 'rgba(255,255,255,0.05)' }} />
                    <button onClick={() => setEditing(p => ({ ...p, theme_header_logo_url: '' }))} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(var(--danger-rgb), 0.85)', color: 'white' }}><X size={11} /></button>
                  </div>
                )}
                <p className="text-[11px] mt-1" style={{ color: 'var(--border-soft)' }}>Shown above the olympiad's name on register/exam/result pages.</p>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Header Title (overrides the olympiad name)</label>
                <input type="text" className={inputClass} style={inputStyle} placeholder={editing.name || 'Defaults to the olympiad name'}
                  value={editing.theme_header_title || ''} onChange={e => setEditing(p => ({ ...p, theme_header_title: e.target.value || null }))} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Header Subtitle</label>
                <input type="text" className={inputClass} style={inputStyle} placeholder="e.g. Presented by ..."
                  value={editing.theme_header_subtitle || ''} onChange={e => setEditing(p => ({ ...p, theme_header_subtitle: e.target.value || null }))} />
              </div>
            </div>

            <div>
              <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>Preview</p>
              <div className="rounded-xl p-5 flex items-center gap-3" style={{
                background: editing.theme_bg_image_url
                  ? `linear-gradient(${editing.theme_bg_color || 'rgba(0,0,0,0.45)'}, ${editing.theme_bg_color || 'rgba(0,0,0,0.45)'}), url(${editing.theme_bg_image_url}) center/cover`
                  : (editing.theme_bg_color || 'var(--surface-deep)'),
                border: '1px solid var(--border)',
              }}>
                {editing.theme_header_logo_url && <img src={editing.theme_header_logo_url} alt="" className="h-9 object-contain flex-shrink-0" />}
                <div className="flex-1 min-w-0">
                  <p className="font-bold text-sm truncate" style={{ color: editing.theme_accent_color || 'var(--blue)', fontFamily: 'Orbitron, monospace' }}>
                    {editing.theme_header_title || editing.name || 'Olympiad Name'}
                  </p>
                  {editing.theme_header_subtitle && <p className="text-xs truncate" style={{ color: 'var(--muted)' }}>{editing.theme_header_subtitle}</p>}
                </div>
                <button className="px-3 py-1.5 rounded-lg text-xs font-bold flex-shrink-0" style={{ background: editing.theme_accent_color || 'linear-gradient(90deg,var(--blue),var(--blue2))', color: '#fff' }}>
                  Register Now
                </button>
              </div>
            </div>
          </div>

          {/* Registration fields — only editable for standalone olympiads.
              For Activity-linked ones, the registration structure (fields,
              team settings, payment) is owned by the Activity category
              editor, not here — editing it in two places would drift apart. */}
          {editing.id && linkInfo[editing.id] ? (
            <div className="rounded-xl p-5 space-y-2" style={s}>
              <p className="text-xs font-bold tracking-widest" style={{ color: 'var(--blue)' }}>REGISTRATION FIELDS</p>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>
                This olympiad's registration form is controlled from its Activity category — editing it here would
                create two different forms for the same thing. {(linkInfo[editing.id].custom_fields || []).length > 0
                  ? `Currently has ${linkInfo[editing.id].custom_fields.length} custom field(s), ${linkInfo[editing.id].requires_team ? 'team registration' : 'individual registration'}${linkInfo[editing.id].requires_payment ? ', with payment' : ''}.`
                  : 'Uses just the standard Name/Phone/Email/College fields right now.'}
              </p>
              <Link href={`/admin/activity-registration/${linkInfo[editing.id].session_id}`}
                className="inline-flex items-center gap-1 text-xs mt-1 px-3 py-1.5 rounded-lg" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.2)' }}>
                Edit registration fields in Activity admin <ArrowRight size={11} />
              </Link>
            </div>
          ) : (
          <div className="rounded-xl p-5 space-y-4" style={s}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold tracking-widest" style={{ color: 'var(--blue)' }}>REGISTRATION FIELDS</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--border-soft)' }}>Mandatory: Name, Phone, Email, HSC Session, College, College Roll — always included</p>
              </div>
              <button onClick={addRegField} className="text-xs px-3 py-1.5 rounded-lg flex items-center gap-1" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.2)' }}>
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
                <label className="flex items-center gap-1 text-xs pt-2.5 whitespace-nowrap cursor-pointer" style={{ color: 'var(--muted)' }}>
                  <input type="checkbox" checked={f.required} onChange={e => updateRegField(f.key, { required: e.target.checked })} /> Required
                </label>
                <button onClick={() => removeRegField(f.key)} className="pt-2" style={{ color: 'var(--danger-soft)' }}><Trash2 size={14} /></button>
              </div>
            ))}
          </div>
          )}

          {/* Questions */}
          <div className="rounded-xl p-5 space-y-4" style={s}>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-bold tracking-widest" style={{ color: 'var(--blue)' }}>QUESTIONS</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--border-soft)' }}>Mix MCQ, checkboxes, short answer, and photo-submit questions freely — insert equations with the Σ button</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => addQuestion('mcq')} className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1" style={{ background: 'rgba(var(--blue-rgb), 0.09)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.2)' }}>
                  <List size={11} /> MCQ
                </button>
                <button onClick={() => addQuestion('checkbox')} className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1" style={{ background: 'rgba(var(--accent2-rgb), 0.09)', color: 'var(--accent2)', border: '1px solid rgba(var(--accent2-rgb), 0.2)' }}>
                  <CheckSquare size={11} /> Checkboxes
                </button>
                <button onClick={() => addQuestion('short')} className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1" style={{ background: 'rgba(var(--success-rgb), 0.09)', color: 'var(--success)', border: '1px solid rgba(var(--success-rgb), 0.2)' }}>
                  <AlignLeft size={11} /> Short Ans
                </button>
                <button onClick={() => addQuestion('photo')} className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1" style={{ background: 'rgba(var(--warning-rgb), 0.09)', color: 'var(--warning)', border: '1px solid rgba(var(--warning-rgb), 0.2)' }}>
                  <Camera size={11} /> Photo
                </button>
              </div>
            </div>
            {(editing.questions || []).length === 0 && (
              <p className="text-xs text-center py-4" style={{ color: 'var(--border-soft)' }}>No questions yet. Add MCQ, short answer, or photo questions above.</p>
            )}
            {(editing.questions || []).map((q, qi) => (
              <div key={q.id} className="rounded-lg p-4 space-y-3" style={{ background: 'var(--surface-alt)', border: `1px solid ${qTypeColor(q.type)}33` }}>
                <div className="flex items-center gap-2">
                  <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: `${qTypeColor(q.type)}18`, color: qTypeColor(q.type) }}>
                    {qTypeIcon(q.type)} Q{qi + 1} · {qTypeLabel(q.type)}
                  </span>
                  {(editing as any).relay_mode && (editing as any).relay_type === 'chain' && (
                    <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(var(--accent2-rgb), 0.1)', color: 'var(--accent2)' }} title="Use this as the QUESTION_ID in chain references">
                      id: {q.id}
                    </span>
                  )}
                  <div className="flex items-center gap-1 ml-auto">
                    <button onClick={() => moveQuestion(q.id, -1)} disabled={qi === 0} title="Move up" style={{ color: 'var(--muted)', opacity: qi === 0 ? 0.35 : 1 }}><ArrowUp size={13} /></button>
                    <button onClick={() => moveQuestion(q.id, 1)} disabled={qi === (editing.questions || []).length - 1} title="Move down" style={{ color: 'var(--muted)', opacity: qi === (editing.questions || []).length - 1 ? 0.35 : 1 }}><ArrowDown size={13} /></button>
                    <button onClick={() => duplicateQuestion(q.id)} title="Duplicate question" style={{ color: 'var(--muted)' }}><Copy size={13} /></button>
                    <input type="number" min={0} value={q.marks ?? 1} onChange={e => updateQuestion(q.id, { marks: Number(e.target.value) })} className="w-14 px-2 py-1 rounded text-xs border text-right ml-1" style={inputStyle} title="Marks for this question" />
                    <span className="text-xs" style={{ color: 'var(--border-soft)' }}>marks</span>
                    <label className="flex items-center gap-1 text-xs pl-2 whitespace-nowrap cursor-pointer" style={{ color: 'var(--muted)' }} title="Whether the student must answer this before continuing">
                      <input type="checkbox" checked={q.required ?? true} onChange={e => updateQuestion(q.id, { required: e.target.checked })} /> Required
                    </label>
                    <button onClick={() => removeQuestion(q.id)} className="ml-2" style={{ color: 'var(--danger-soft)' }}><Trash2 size={14} /></button>
                  </div>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Question text *</label>
                  <MathInputField multiline rows={2} className={inputClass + ' resize-none'} style={inputStyle} value={q.text} onChange={v => updateQuestion(q.id, { text: v })} placeholder="Enter the question... (use the Σ button for equations)" />
                  {q.text?.includes('$') && (
                    <div className="mt-1.5 px-3 py-2 rounded text-sm" style={{ background: 'var(--surface-deep)', border: '1px dashed var(--border)' }}>
                      <span className="text-[10px] block mb-1" style={{ color: 'var(--border-soft)' }}>PREVIEW</span>
                      <MathText text={q.text} style={{ color: 'var(--white-soft)' }} />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Description / hint (optional)</label>
                  <MathInputField className={inputClass} style={inputStyle} value={q.description || ''} onChange={v => updateQuestion(q.id, { description: v })} placeholder="Additional context or instructions for this question" />
                  {q.description?.includes('$') && (
                    <div className="mt-1.5 px-3 py-2 rounded text-sm" style={{ background: 'var(--surface-deep)', border: '1px dashed var(--border)' }}>
                      <span className="text-[10px] block mb-1" style={{ color: 'var(--border-soft)' }}>PREVIEW</span>
                      <MathText text={q.description} style={{ color: 'var(--white-soft)' }} />
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Question image (optional — diagrams, graphs, etc.)</label>
                  {q.image_url ? (
                    <div className="relative inline-block">
                      <img src={q.image_url} alt="" className="h-20 rounded object-cover border" style={{ borderColor: 'var(--border)' }} />
                      <button onClick={() => updateQuestion(q.id, { image_url: '' })} className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: 'rgba(var(--danger-rgb), 0.85)', color: 'white' }}><X size={11} /></button>
                    </div>
                  ) : (
                    <label className="text-xs px-3 py-1.5 rounded-lg border cursor-pointer inline-flex items-center gap-1" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
                      <ImageIcon size={12} /> Upload image
                      <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={e => handleQuestionImageUpload(q.id, e.target.files?.[0] || null)} />
                    </label>
                  )}
                </div>
                {((editing as any).subjects || []).length > 0 && (
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--warning)' }}>Subject (which team member's question is this?)</label>
                    <select className={inputClass} style={inputStyle} value={q.subject_id || ''} onChange={e => updateQuestion(q.id, { subject_id: e.target.value || undefined })}>
                      <option value="">All subjects / not subject-specific</option>
                      {((editing as any).subjects || []).map((sub: any) => (
                        <option key={sub.id} value={sub.id}>{sub.name}</option>
                      ))}
                    </select>
                  </div>
                )}
                {(editing as any).relay_mode && (editing as any).relay_type === 'chain' && (
                  <p className="text-xs px-2 py-1.5 rounded flex items-start gap-1.5" style={{ background: 'rgba(var(--accent2-rgb), 0.08)', color: 'var(--accent2)' }}>
                    <Lightbulb size={13} className="shrink-0 mt-0.5" />
                    <span>Chain mode: reference a previous member's answer in this question's text using <code>{'{{chain.member1.QUESTION_ID}}'}</code> — question ID is shown below the question text once saved.</span>
                  </p>
                )}
                {q.type === 'mcq' && (
                  <div className="space-y-2">
                    <label className="text-xs" style={{ color: 'var(--muted)' }}>Options (click radio to mark correct answer)</label>
                    {(q.options || []).map(o => (
                      <div key={o.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input type="radio" name={`correct-${q.id}`} checked={q.correct_option_id === o.id} onChange={() => updateQuestion(q.id, { correct_option_id: o.id })} style={{ accentColor: 'var(--success)' }} />
                          <MathInputField className={inputClass} style={inputStyle} value={o.text} onChange={v => updateOption(q.id, o.id, v)} placeholder="Option text" />
                          <button onClick={() => removeOption(q.id, o.id)} style={{ color: 'var(--danger-soft)' }}><X size={13} /></button>
                        </div>
                        {o.text?.includes('$') && (
                          <div className="ml-6 px-3 py-1.5 rounded text-sm" style={{ background: 'var(--surface-deep)', border: '1px dashed var(--border)' }}>
                            <span className="text-[10px] block mb-0.5" style={{ color: 'var(--border-soft)' }}>PREVIEW</span>
                            <MathText text={o.text} style={{ color: 'var(--white-soft)' }} />
                          </div>
                        )}
                      </div>
                    ))}
                    <button onClick={() => addOption(q.id)} className="text-xs flex items-center gap-1" style={{ color: 'var(--blue)' }}><Plus size={11} /> Add option</button>
                  </div>
                )}
                {q.type === 'checkbox' && (
                  <div className="space-y-2">
                    <label className="text-xs" style={{ color: 'var(--muted)' }}>Options (check all correct answers — students may select multiple)</label>
                    {(q.options || []).map(o => (
                      <div key={o.id} className="space-y-1">
                        <div className="flex items-center gap-2">
                          <input type="checkbox" checked={(q.correct_option_ids || []).includes(o.id)} onChange={() => toggleCheckboxCorrect(q.id, o.id)} style={{ accentColor: 'var(--success)' }} />
                          <MathInputField className={inputClass} style={inputStyle} value={o.text} onChange={v => updateOption(q.id, o.id, v)} placeholder="Option text" />
                          <button onClick={() => removeOption(q.id, o.id)} style={{ color: 'var(--danger-soft)' }}><X size={13} /></button>
                        </div>
                        {o.text?.includes('$') && (
                          <div className="ml-6 px-3 py-1.5 rounded text-sm" style={{ background: 'var(--surface-deep)', border: '1px dashed var(--border)' }}>
                            <span className="text-[10px] block mb-0.5" style={{ color: 'var(--border-soft)' }}>PREVIEW</span>
                            <MathText text={o.text} style={{ color: 'var(--white-soft)' }} />
                          </div>
                        )}
                      </div>
                    ))}
                    <button onClick={() => addOption(q.id)} className="text-xs flex items-center gap-1" style={{ color: 'var(--blue)' }}><Plus size={11} /> Add option</button>
                  </div>
                )}
                {q.type === 'photo' && (
                  <p className="text-xs" style={{ color: 'var(--border-soft)' }}>Student will upload a photo (their handwritten answer) for this question.</p>
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
      <div className="flex items-center justify-between mb-2">
        <h1 className="text-2xl font-bold" style={h}>Olympiads</h1>
        <button onClick={() => { setEditing({ ...BLANK }); setUploadError(''); setUploadProgress(0); setUploading(null) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
          style={{ background: 'rgba(var(--blue-rgb), 0.12)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
          <Plus size={16} /> New Olympiad
        </button>
      </div>
      <p className="text-xs mb-6" style={{ color: 'var(--border-soft)' }}>
        Most olympiads should be created from <Link href="/admin/activities" className="underline" style={{ color: 'var(--blue)' }}>Activities</Link> —
        mark a registration leaf as "online" there and it shows up here automatically, with its registration form already matching the
        rest of that activity. Use "New Olympiad" only for a fully standalone exam with no associated Activity registration.
      </p>

      {pageError && (
        <div className="mb-4 px-4 py-3 rounded-lg text-sm flex items-center justify-between" style={{ background: 'rgba(var(--danger-rgb), 0.12)', border: '1px solid rgba(var(--danger-rgb), 0.4)', color: 'var(--danger)' }}>
          <span>{pageError}</span>
          <button onClick={() => setPageError('')}><X size={14} /></button>
        </div>
      )}

      {/* Announcement link */}
      <Link href="/admin/announcements" className="flex items-center justify-between mb-6 px-4 py-3 rounded-xl" style={{ background: 'rgba(var(--blue-rgb), 0.05)', border: '1px solid rgba(var(--blue-rgb), 0.15)' }}>
        <div className="flex items-center gap-3">
          <Megaphone size={16} style={{ color: 'var(--blue)' }} />
          <div>
            <p className="text-sm font-medium" style={{ color: 'var(--white-soft)' }}>Send an Announcement</p>
            <p className="text-xs" style={{ color: 'var(--border-soft)' }}>Email members, olympiad registrants, or everyone — manage announcements →</p>
          </div>
        </div>
        <ArrowRight size={16} style={{ color: 'var(--border-soft)' }} />
      </Link>

      {loading && <p className="text-center py-12" style={{ color: 'var(--border-soft)' }}>Loading…</p>}

      {!loading && olympiads.length === 0 && (
        <div className="text-center py-12 rounded-xl" style={s}>
          <p style={{ color: 'var(--border-soft)' }}>No olympiads yet. Click &quot;New Olympiad&quot; to create one.</p>
        </div>
      )}

      {(() => {
        const groupsMap = new Map<string, { label: string; sessionId: string; items: typeof olympiads }>()
        const standaloneList: typeof olympiads = []
        for (const o of olympiads) {
          const li = linkInfo[o.id]
          if (!li) { standaloneList.push(o); continue }
          const key = `${li.session_id}::${li.breadcrumb[0]}`
          if (!groupsMap.has(key)) groupsMap.set(key, { label: `${li.session_title} — ${li.breadcrumb[0]}`, sessionId: li.session_id, items: [] })
          groupsMap.get(key)!.items.push(o)
        }
        const linkedGroups = [...groupsMap.values()]

        const OlympiadRow = (o: (typeof olympiads)[number], hideBreadcrumbHead: boolean) => (
          <div key={o.id} className="rounded-xl overflow-hidden" style={s}>
            <div className="flex items-center gap-4 px-5 py-4">
              {o.cover_image_url && <img src={o.cover_image_url} alt="" className="w-14 h-14 rounded-lg object-cover flex-shrink-0" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold" style={{ color: 'var(--white-soft)' }}>{o.name}</span>
                  <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: o.is_active ? 'rgba(var(--success-rgb), 0.13)' : 'rgba(var(--danger-soft-rgb), 0.13)', color: o.is_active ? 'var(--success)' : 'var(--danger-soft)' }}>
                    {o.is_active ? 'Active' : 'Hidden'}
                  </span>
                  {o.result_published && <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(var(--blue-rgb), 0.13)', color: 'var(--blue)' }}>Results Published</span>}
                  {o.timer_minutes && <span className="text-xs flex items-center gap-1" style={{ color: 'var(--border-soft)' }}><Clock size={10} />{o.timer_minutes}min</span>}
                  <span className="text-xs" style={{ color: 'var(--border-soft)' }}>{(o.questions || []).length} questions</span>
                </div>
                {o.description && <p className="text-xs mt-1 truncate" style={{ color: 'var(--border-soft)' }}>{o.description}</p>}
                {linkInfo[o.id] ? (
                  <Link href={`/admin/activity-registration/${linkInfo[o.id].session_id}`}
                    className="text-xs mt-1 inline-flex items-center gap-1.5 hover:underline" style={{ color: 'var(--muted)' }}>
                    <Link2 size={12} /> {hideBreadcrumbHead ? linkInfo[o.id].breadcrumb.slice(1).join(' → ') || linkInfo[o.id].breadcrumb.join(' → ') : `From Activity: ${linkInfo[o.id].session_title} → ${linkInfo[o.id].breadcrumb.join(' → ')}`}
                    {linkInfo[o.id].registration_open === false && (
                      <span className="px-1.5 py-0.5 rounded" style={{ background: 'rgba(var(--danger-soft-rgb), 0.13)', color: 'var(--danger-soft)' }}>Registration closed</span>
                    )}
                  </Link>
                ) : (
                  <span className="text-xs mt-1 inline-block" style={{ color: '#5a7a3a' }}>Standalone (not linked to any Activity)</span>
                )}
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => toggleField(o.id, 'is_active', !o.is_active)} title={o.is_active ? 'Hide' : 'Activate'} className="p-1.5 rounded" style={{ color: 'var(--border-soft)' }}>
                  {o.is_active ? <Eye size={15} /> : <EyeOff size={15} />}
                </button>
                <button onClick={() => { setEditing(o); setUploadError(''); setUploadProgress(0); setUploading(null) }} className="p-1.5 rounded" style={{ color: 'var(--muted)' }}>
                  <Edit2 size={15} />
                </button>
                <button onClick={() => del(o.id)} className="p-1.5 rounded" style={{ color: 'var(--danger-soft)' }}><Trash2 size={15} /></button>
                <button onClick={() => { setSelectedOlympiadId(o.id); setTab('registrations'); loadRegistrations(o.id) }}
                  className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'rgba(var(--blue-rgb), 0.3)', color: 'var(--blue)' }}>
                  Registrations
                </button>
                <button onClick={() => toggleExpand(o.id)} className="p-1.5 rounded" style={{ color: 'var(--border-soft)' }}>
                  {expandedId === o.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
              </div>
            </div>

            {expandedId === o.id && (
              <div className="px-5 pb-4 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex gap-4 pt-3 text-xs flex-wrap" style={{ color: 'var(--border-soft)' }}>
                  {o.exam_date && <span>Exam: {new Date(o.exam_date).toLocaleString()}</span>}
                  {o.registration_deadline && <span>Reg deadline: {new Date(o.registration_deadline).toLocaleString()}</span>}
                  {o.eligibility && <span>Eligibility: {o.eligibility}</span>}
                  <span>Display: {o.question_display === 'one_by_one' ? 'One by one' : 'All at once'}</span>
                </div>
                <div className="flex gap-3 pt-1">
                  <button onClick={() => toggleField(o.id, 'result_published', !o.result_published)}
                    className="text-xs px-3 py-1.5 rounded-lg border inline-flex items-center gap-1.5" style={{ borderColor: o.result_published ? 'rgba(var(--success-rgb), 0.27)' : 'var(--border)', color: o.result_published ? 'var(--success)' : 'var(--border-soft)' }}>
                    {o.result_published && <CheckCircle2 size={13} />} {o.result_published ? 'Results Published' : 'Publish Results'}
                  </button>
                  <button onClick={() => toggleField(o.id, 'annotations_published', !o.annotations_published)}
                    className="text-xs px-3 py-1.5 rounded-lg border inline-flex items-center gap-1.5" style={{ borderColor: o.annotations_published ? 'rgba(var(--blue-rgb), 0.27)' : 'var(--border)', color: o.annotations_published ? 'var(--blue)' : 'var(--border-soft)' }}>
                    {o.annotations_published && <CheckCircle2 size={13} />} {o.annotations_published ? 'Annotations Published' : 'Publish Annotations'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )

        return (
          <>
            {linkedGroups.length > 0 && (
              <div className="space-y-4 mb-6">
                <p className="text-xs font-bold tracking-widest inline-flex items-center gap-1.5" style={{ color: 'var(--blue)' }}><Link2 size={13} /> LINKED FROM ACTIVITIES</p>
                {linkedGroups.map(g => (
                  <div key={g.label} className="rounded-xl p-3 space-y-3" style={{ background: 'rgba(var(--blue-rgb), 0.03)', border: '1px dashed rgba(var(--blue-rgb), 0.25)' }}>
                    <div className="flex items-center justify-between px-2">
                      <p className="text-sm font-semibold" style={{ color: 'var(--white-soft)' }}>{g.label}</p>
                      <Link href={`/admin/activity-registration/${g.sessionId}`} className="text-xs hover:underline flex items-center gap-1" style={{ color: 'var(--blue)' }}>
                        Manage in Activity Admin <ArrowRight size={11} />
                      </Link>
                    </div>
                    <div className="space-y-3">
                      {g.items.map(o => OlympiadRow(o, true))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {standaloneList.length > 0 && (
              <div className="space-y-3">
                {linkedGroups.length > 0 && <p className="text-xs font-bold tracking-widest mb-1" style={{ color: 'var(--border-soft)' }}>STANDALONE OLYMPIADS</p>}
                {standaloneList.map(o => OlympiadRow(o, false))}
              </div>
            )}
          </>
        )
      })()}
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
        <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Score</label>
        <input type="number" className={inputClass} style={inputStyle} value={score} onChange={e => setScore(e.target.value)} autoFocus />
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Note (optional)</label>
        <textarea rows={3} className={inputClass + ' resize-none'} style={inputStyle} value={note} onChange={e => setNote(e.target.value)} />
      </div>
      {err && <p className="text-xs" style={{ color: 'var(--danger-soft)' }}>{err}</p>}
      <div className="flex gap-2 pt-1">
        <button onClick={submit} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
          style={{ background: 'var(--blue)', color: '#000' }}>{saving ? 'Saving...' : 'Save'}</button>
        <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--muted)' }}>Cancel</button>
      </div>
    </div>
  )
}
