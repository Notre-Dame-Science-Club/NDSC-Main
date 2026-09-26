'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Eye, EyeOff, X, Megaphone, ArrowRight, Image as ImageIcon, FileText, Clock, ClipboardList, Link2, Lightbulb, BookOpen, CheckCircle2, Download, Workflow } from 'lucide-react'
import AnnotationViewer, { Annotation } from '@/components/olympiad/AnnotationViewer'
import ResponseDetailModal from '@/components/olympiad/ResponseDetailModal'
import { FormGraphBuilderForOwner } from '@/components/admin/FormGraphBuilder'
import { normalizeUploadUrl } from '@/lib/uploadUrl'

const uid = () => Math.random().toString(36).slice(2, 9)

// datetime-local inputs give/take a naive "YYYY-MM-DDTHH:mm" string with no
// timezone attached. Every admin on this page is working in Bangladesh
// (UTC+6, no DST), but the DB columns are `timestamptz` — sent a naive
// string, Postgres stores it as if it were already UTC, silently shifting
// every exam start/end/deadline 6 hours off from what was actually typed.
// These two helpers make Dhaka-local time explicit on both sides of that
// round trip instead of relying on whatever timezone the DB session
// happens to default to.
const DHAKA_OFFSET_MS = 6 * 60 * 60 * 1000
function dhakaLocalToISO(value?: string | null): string | null {
  if (!value) return null
  return new Date(new Date(`${value}:00Z`).getTime() - DHAKA_OFFSET_MS).toISOString()
}
function isoToDhakaLocal(value?: string | null): string {
  if (!value) return ''
  return new Date(new Date(value).getTime() + DHAKA_OFFSET_MS).toISOString().slice(0, 16)
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
  is_just_a_submission?: boolean
  is_active: boolean
  result_published: boolean
  annotations_published: boolean
  registration_deadline?: string
  scheduled_start_at?: string
  scheduled_end_at?: string
  allow_resubmission?: boolean
  eligibility?: string
  external_only?: boolean
  organizer_username?: string
  organizer_password?: string
  parent_activity_session_id?: string | null
  // Read-only here — computed from the olympiad's form-graph question
  // node(s). Edited in Form Builder, not on this page.
  questions: any[]
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
  external_only: false, is_just_a_submission: false,
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
  const [tab, setTab] = useState<'olympiads' | 'registrations' | 'form-builder'>('olympiads')
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
  // For the form graph and parent activity pickers
  const [formGraphs, setFormGraphs] = useState<{ id: string; title: string; owner_id: string }[]>([])
  const [activitySessions, setActivitySessions] = useState<{ id: string; title: string; slug: string }[]>([])
  const [attachedFormGraph, setAttachedFormGraph] = useState<{ id: string; title: string } | null>(null)
  const [creatingFormGraph, setCreatingFormGraph] = useState(false)

  const h = { fontFamily: 'inherit', color: 'var(--blue)' }
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

    // Load form graphs and activity sessions for pickers
    try {
      const [graphsRes, sessionsRes] = await Promise.all([
        fetch('/api/admin/form-graphs').then(r => r.json()),
        fetch('/api/admin/activity-sessions').then(r => r.json()),
      ])
      if (graphsRes?.graphs) {
        setFormGraphs(graphsRes.graphs
          .filter((g: any) => g.owner_kind === 'olympiad')
          .map((g: any) => ({ id: g.id, title: g.title, owner_id: g.owner_id })))
      }
      if (Array.isArray(sessionsRes)) {
        setActivitySessions(sessionsRes.map((s: any) => ({ id: s.id, title: s.title, slug: s.slug })))
      }
    } catch { /* non-critical */ }

    setLoading(false)
  }

  useEffect(() => { load() }, [])

  // Load attached form graph when editing modal opens for an existing olympiad
  useEffect(() => {
    if (editing?.id) {
      loadAttachedFormGraph(editing.id)
    } else {
      setAttachedFormGraph(null)
    }
  }, [editing?.id])

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

  // Load attached form graph when editing an olympiad
  const loadAttachedFormGraph = async (olympiadId: string) => {
    try {
      const res = await fetch('/api/admin/form-graphs')
      const data = await res.json()
      if (data?.graphs) {
        const attached = data.graphs.find((g: any) =>
          g.owner_kind === 'olympiad' && g.owner_id === olympiadId
        )
        setAttachedFormGraph(attached ? { id: attached.id, title: attached.title } : null)
      }
    } catch {
      setAttachedFormGraph(null)
    }
  }

  // Create a form graph for this olympiad
  const createFormGraph = async (olympiadId: string, olympiadName: string) => {
    setCreatingFormGraph(true)
    try {
      const res = await fetch('/api/admin/form-graphs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_kind: 'olympiad',
          owner_id: olympiadId,
          title: `${olympiadName} Registration & Exam`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create form graph.')
      setAttachedFormGraph({ id: data.graph.id, title: data.graph.title })
      // Refresh form graphs list
      const graphsRes = await fetch('/api/admin/form-graphs').then(r => r.json())
      if (graphsRes?.graphs) {
        setFormGraphs(graphsRes.graphs
          .filter((g: any) => g.owner_kind === 'olympiad')
          .map((g: any) => ({ id: g.id, title: g.title, owner_id: g.owner_id })))
      }
    } catch (e: any) {
      setPageError(e.message || 'Failed to create form graph.')
    } finally {
      setCreatingFormGraph(false)
    }
  }

  // Detach (delete) the form graph for this olympiad
  const detachFormGraph = async (graphId: string) => {
    if (!confirm('Delete this form graph? All questions and fields will be permanently removed.')) return
    try {
      const res = await fetch(`/api/admin/form-graphs/${graphId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete.')
      }
      setAttachedFormGraph(null)
      // Refresh form graphs list
      const graphsRes = await fetch('/api/admin/form-graphs').then(r => r.json())
      if (graphsRes?.graphs) {
        setFormGraphs(graphsRes.graphs
          .filter((g: any) => g.owner_kind === 'olympiad')
          .map((g: any) => ({ id: g.id, title: g.title, owner_id: g.owner_id })))
      }
    } catch (e: any) {
      setPageError(e.message || 'Failed to delete form graph.')
    }
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
          // normalizeUploadUrl: Hostinger sometimes returns …/uploads/<folder>/file
          // while the file actually lives at …/<folder>/file.
          if (xhr.status >= 200 && xhr.status < 300 && d.url) resolve(normalizeUploadUrl(d.url))
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
      is_just_a_submission: editing.is_just_a_submission ?? false,
      is_active: editing.is_active ?? true,
      result_published: editing.result_published ?? false,
      annotations_published: editing.annotations_published ?? false,
      registration_deadline: dhakaLocalToISO(editing.registration_deadline),
      eligibility: editing.eligibility || null,
      external_only: editing.external_only ?? false,
      organizer_username: editing.organizer_username || null,
      organizer_password: editing.organizer_password || null,
      theme_bg_color: editing.theme_bg_color || null,
      theme_bg_image_url: editing.theme_bg_image_url || null,
      theme_accent_color: editing.theme_accent_color || null,
      theme_header_title: editing.theme_header_title || null,
      theme_header_subtitle: editing.theme_header_subtitle || null,
      theme_header_logo_url: editing.theme_header_logo_url || null,
      scheduled_start_at: dhakaLocalToISO(editing.scheduled_start_at),
      scheduled_end_at: dhakaLocalToISO(editing.scheduled_end_at),
      allow_resubmission: (editing as any).allow_resubmission ?? true,
      relay_mode: (editing as any).relay_mode ?? false,
      relay_type: (editing as any).relay_type || 'sequential',
      subjects: (editing as any).subjects || [],
      subject_assignment_mode: (editing as any).subject_assignment_mode || 'self_select',
      parent_activity_session_id: (editing as any).parent_activity_session_id || null,
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


  // ── Form builder view ────────────────────────────────────────────────────────
  if (tab === 'form-builder' && selectedOlympiadId) {
    const olympiad = olympiads.find(o => o.id === selectedOlympiadId)
    return (
      <div>
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setTab('olympiads')} className="text-sm px-3 py-1 rounded border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>← Back</button>
          <h1 className="text-xl font-bold" style={h}>{olympiad?.name} — Form Builder</h1>
        </div>
        <div className="mb-5 p-4 rounded-xl text-sm" style={{ background: 'rgba(var(--blue-rgb), 0.05)', border: '1px solid rgba(var(--blue-rgb), 0.2)', color: 'var(--muted)' }}>
          The full flowchart-style builder for this olympiad's registration — a tree of forms
          with branching, presets, and multi-step flows.
        </div>
        <FormGraphBuilderForOwner ownerKind="olympiad" ownerId={selectedOlympiadId} />
      </div>
    )
  }

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
          <a href={`/api/admin/olympiads/${selectedOlympiadId}/registrations.csv`}
            className="text-sm px-3 py-1 rounded border flex items-center gap-1.5"
            style={{ borderColor: 'rgba(var(--cat-teal-rgb), 0.3)', color: 'var(--cat-teal)' }}
            title="Server-built CSV with one column per question, score columns, and timing.">
            <Download size={13} /> CSV
          </a>
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
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Registration Deadline</label>
              <input type="datetime-local" className={inputClass} style={inputStyle} value={editing.registration_deadline || ''} onChange={e => setEditing(p => ({ ...p, registration_deadline: e.target.value }))} />
              <p className="text-xs mt-1" style={{ color: 'var(--border-soft)' }}>
                When people can no longer register. The exam window itself (when they can actually enter and take it) is set below, under Exam Scheduling.
              </p>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--muted)' }}>
              <input type="checkbox" checked={editing.external_only || false} onChange={e => setEditing(p => ({ ...p, external_only: e.target.checked }))} />
              Open to external colleges
            </label>
          </div>

          {/* Form & Content Linking */}
          <div className="rounded-xl p-5 space-y-4" style={s}>
            <p className="text-xs font-bold tracking-widest inline-flex items-center gap-1.5" style={{ color: 'var(--accent2)' }}>
              <Lightbulb size={13} /> FORM & CONTENT LINKING
            </p>
            <p className="text-xs" style={{ color: 'var(--border-soft)' }}>
              Attach a registration/exam form to this olympiad, or mark it as purely informational
              (pointing to a parent Activity registration instead).
            </p>

            {/* Attached Form Graph Status */}
            {editing.id ? (
              <div>
                <label className="block text-xs mb-2 font-semibold" style={{ color: 'var(--muted)' }}>
                  Attached Form Graph
                </label>
                {attachedFormGraph ? (
                  <div className="flex items-center gap-3 p-3 rounded-lg" style={{ background: 'rgba(var(--success-rgb), 0.08)', border: '1px solid rgba(var(--success-rgb), 0.2)' }}>
                    <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium" style={{ color: 'var(--white-soft)' }}>
                        {attachedFormGraph.title}
                      </p>
                      <p className="text-xs" style={{ color: 'var(--muted)' }}>
                        This olympiad has a form graph attached
                      </p>
                    </div>
                    <Link
                      href={`/admin/form-builder/${attachedFormGraph.id}`}
                      target="_blank"
                      className="text-xs px-3 py-1.5 rounded border inline-flex items-center gap-1"
                      style={{ borderColor: 'rgba(var(--accent2-rgb), 0.3)', color: 'var(--accent2)' }}>
                      <Workflow size={12} /> Open
                    </Link>
                    <button
                      onClick={() => detachFormGraph(attachedFormGraph.id)}
                      className="text-xs px-3 py-1.5 rounded border"
                      style={{ borderColor: 'rgba(var(--danger-rgb), 0.3)', color: 'var(--danger-soft)' }}>
                      Detach
                    </button>
                  </div>
                ) : (
                  <div className="p-3 rounded-lg" style={{ background: 'rgba(var(--border-rgb), 0.05)', border: '1px dashed var(--border)' }}>
                    <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
                      No form attached yet. Create one to enable registration and exam functionality.
                    </p>
                    <button
                      onClick={() => createFormGraph(editing.id!, editing.name || 'Untitled Olympiad')}
                      disabled={creatingFormGraph}
                      className="text-xs px-3 py-1.5 rounded inline-flex items-center gap-1.5"
                      style={{
                        background: creatingFormGraph ? 'var(--surface-alt)' : 'rgba(var(--accent2-rgb), 0.12)',
                        color: creatingFormGraph ? 'var(--border-soft)' : 'var(--accent2)',
                        border: `1px solid ${creatingFormGraph ? 'var(--border)' : 'rgba(var(--accent2-rgb), 0.3)'}`,
                        cursor: creatingFormGraph ? 'not-allowed' : 'pointer'
                      }}>
                      <Plus size={12} /> {creatingFormGraph ? 'Creating...' : 'Create Form Graph'}
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="p-3 rounded-lg" style={{ background: 'rgba(var(--warning-rgb), 0.08)', border: '1px solid rgba(var(--warning-rgb), 0.2)' }}>
                <p className="text-xs" style={{ color: 'var(--warning)' }}>
                  Save this olympiad first before attaching a form graph.
                </p>
              </div>
            )}

            {/* Parent Activity Picker */}
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>
                Parent Activity (for informational entries)
              </label>
              <select
                className={inputClass}
                style={inputStyle}
                value={(editing as any).parent_activity_session_id || ''}
                onChange={e => setEditing(p => ({ ...p, parent_activity_session_id: e.target.value || null } as any))}>
                <option value="">— No parent activity —</option>
                {activitySessions.map(a => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
              <p className="text-xs mt-1" style={{ color: 'var(--border-soft)' }}>
                When set, the public listing shows &quot;Register for [activity]&quot; instead of this olympiad&apos;s own form.
                Use this for informational olympiad entries that are actually part of a larger Activity event.
              </p>
            </div>
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
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--muted)' }}>
              <input type="checkbox" checked={editing.is_just_a_submission || false}
                onChange={e => setEditing(p => ({ ...p, is_just_a_submission: e.target.checked }))} />
              Just a submission (no timer, doesn&apos;t say &quot;Start Exam&quot;)
            </label>
            <p className="text-xs -mt-2" style={{ color: 'var(--border-soft)' }}>
              When on, students see a plain &quot;Submit&quot; entry point with no countdown or auto-submit —
              everything else (questions, subjects, relay mode, scheduling, grading) works exactly the same.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Question Display</label>
                <select className={inputClass} style={inputStyle} value={editing.question_display || 'all_at_once'} onChange={e => setEditing(p => ({ ...p, question_display: e.target.value as any }))}>
                  <option value="all_at_once">All at once (scroll)</option>
                  <option value="one_by_one">One by one (Next button)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Timer (minutes)</label>
                <input type="number" min={1} max={300} className={inputClass} style={inputStyle} value={editing.timer_minutes ?? 60}
                  disabled={!!editing.is_just_a_submission}
                  onChange={e => setEditing(p => ({ ...p, timer_minutes: Number(e.target.value) }))} />
                {editing.is_just_a_submission && (
                  <p className="text-xs mt-1" style={{ color: 'var(--border-soft)' }}>Ignored — this olympiad is set to "just a submission".</p>
                )}
              </div>
            </div>

            {/* Organizer login — issued from here so admins control who can review this olympiad's submissions */}
            <div className="rounded-lg p-4 space-y-3" style={{ background: 'var(--bg3)', border: '1px solid var(--border)' }}>
              <p className="text-xs font-bold tracking-widest" style={{ color: 'var(--cat-teal)' }}>ORGANIZER LOGIN</p>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Organizer Username</label>
                  <input className={inputClass} style={inputStyle} value={editing.organizer_username || ''} onChange={e => setEditing(p => ({ ...p, organizer_username: e.target.value }))} placeholder="e.g. physics-organizer" />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Organizer Password</label>
                  <input className={inputClass} style={inputStyle} value={editing.organizer_password || ''} onChange={e => setEditing(p => ({ ...p, organizer_password: e.target.value }))} placeholder="For organizer login" />
                </div>
              </div>
              <p className="text-xs" style={{ color: 'var(--border-soft)' }}>
                Give these to the organizer reviewing this olympiad at <code>/organizer</code>. Leaving username blank keeps
                the old password-only login working for this olympiad. The same username + password can be reused across
                multiple olympiads to give one organizer access to all of them at once.
              </p>
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

          {/* ── Exam window: the one place that controls when students can enter ── */}
          <div className="rounded-xl p-5 space-y-4" style={s}>
            <p className="text-xs font-bold tracking-widest" style={{ color: 'var(--cat-teal)' }}>⏰ EXAM WINDOW</p>
            <p className="text-xs" style={{ color: 'var(--border-soft)' }}>
              The only dates that control the exam itself. Students can enter and take the exam any time between
              Start and End — set both to the same day for a one-day exam. Before Start, the page shows a countdown;
              after End, submissions are locked.
            </p>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Start</label>
                <input type="datetime-local" className={inputClass} style={inputStyle}
                  value={editing.scheduled_start_at || ''}
                  onChange={e => setEditing(p => ({ ...p, scheduled_start_at: e.target.value || undefined }))} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>End</label>
                <input type="datetime-local" className={inputClass} style={inputStyle}
                  value={editing.scheduled_end_at || ''}
                  onChange={e => setEditing(p => ({ ...p, scheduled_end_at: e.target.value || undefined }))} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer pt-1" style={{ color: 'var(--white)' }}>
              <input type="checkbox" checked={(editing as any).allow_resubmission ?? true}
                onChange={e => setEditing(p => ({ ...p, allow_resubmission: e.target.checked } as any))} />
              Allow resubmission
            </label>
            <p className="text-xs" style={{ color: 'var(--border-soft)' }}>
              On: students can overwrite an earlier submission any time before End. Off: once a student
              submits, that answer is final and any further attempt is rejected — use this for olympiads
              where seeing your own submitted answer sheet again could enable copying.
            </p>
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
              Each subject maps to a specific set of questions (set this per-question in Form Builder).
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
                  <input type="color" value={editing.theme_accent_color || '#00d4ff'}
                    onChange={e => setEditing(p => ({ ...p, theme_accent_color: e.target.value }))}
                    className="w-10 h-9 rounded border cursor-pointer flex-shrink-0" style={{ borderColor: 'var(--border)', background: 'transparent' }} />
                  <input type="text" className={inputClass} style={inputStyle} placeholder="e.g. #00d4ff — blank uses the default blue"
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
                  <p className="font-bold text-sm truncate" style={{ color: editing.theme_accent_color || 'var(--blue)', fontFamily: 'inherit' }}>
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

          {/* Fields & questions for this olympiad now live in Form Builder —
              same tree-of-forms editor every Activity uses, so there's one
              place to build a form instead of two that used to duplicate
              each other. Use the "Form Builder" button on this olympiad's
              row in the list to open it. */}
          <div className="rounded-xl p-5 space-y-2" style={s}>
            <p className="text-xs font-bold tracking-widest inline-flex items-center gap-1.5" style={{ color: 'var(--accent2)' }}><Workflow size={13} /> FIELDS & QUESTIONS</p>
            <p className="text-xs" style={{ color: 'var(--border-soft)' }}>
              Registration fields and exam questions are built in <strong>Form Builder</strong> now — the same
              flowchart-style form editor used for Activities, so there's one tool for this instead of two.
              Save this olympiad first if it's new, then open its Form Builder from the list.
            </p>
            {editing.id && (
              <button type="button" onClick={() => { setSelectedOlympiadId(editing.id!); setTab('form-builder') }}
                className="text-xs px-3 py-1.5 rounded-lg border inline-flex items-center gap-1.5 mt-1" style={{ borderColor: 'rgba(var(--accent2-rgb), 0.3)', color: 'var(--accent2)' }}>
                <Workflow size={12} /> Open Form Builder
              </button>
            )}
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
                  <span className="text-xs flex items-center gap-1" style={{ color: o.is_active && (o.questions || []).length === 0 ? 'var(--warning)' : 'var(--border-soft)' }}>
                    {o.is_active && (o.questions || []).length === 0 && <span>⚠</span>}
                    {(o.questions || []).length} questions
                  </span>
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
                <button onClick={() => { setEditing({ ...o, scheduled_start_at: isoToDhakaLocal(o.scheduled_start_at), scheduled_end_at: isoToDhakaLocal(o.scheduled_end_at), registration_deadline: isoToDhakaLocal(o.registration_deadline) } as any); setUploadError(''); setUploadProgress(0); setUploading(null) }} className="p-1.5 rounded" style={{ color: 'var(--muted)' }}>
                  <Edit2 size={15} />
                </button>
                <button onClick={() => del(o.id)} className="p-1.5 rounded" style={{ color: 'var(--danger-soft)' }}><Trash2 size={15} /></button>
                <button onClick={() => { setSelectedOlympiadId(o.id); setTab('registrations'); loadRegistrations(o.id) }}
                  className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'rgba(var(--blue-rgb), 0.3)', color: 'var(--blue)' }}>
                  Registrations
                </button>
                <button onClick={() => { setSelectedOlympiadId(o.id); setTab('form-builder') }}
                  title="Full flowchart-style form builder for this olympiad's registration"
                  className="text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1" style={{ borderColor: 'rgba(var(--accent2-rgb), 0.3)', color: 'var(--accent2)' }}>
                  <Workflow size={12} /> Form Builder
                </button>
                <a href={`/api/admin/olympiads/${o.id}/registrations.csv`}
                  className="text-xs px-3 py-1.5 rounded-lg border flex items-center gap-1"
                  style={{ borderColor: 'rgba(var(--cat-teal-rgb), 0.3)', color: 'var(--cat-teal)' }}
                  title="Download all registrations as CSV">
                  <Download size={12} /> CSV
                </a>
                <button onClick={() => toggleExpand(o.id)} className="p-1.5 rounded" style={{ color: 'var(--border-soft)' }}>
                  {expandedId === o.id ? <ChevronUp size={15} /> : <ChevronDown size={15} />}
                </button>
              </div>
            </div>

            {expandedId === o.id && (
              <div className="px-5 pb-4 space-y-2" style={{ borderTop: '1px solid var(--border)' }}>
                <div className="flex gap-4 pt-3 text-xs flex-wrap" style={{ color: 'var(--border-soft)' }}>
                  {(o.scheduled_start_at || o.scheduled_end_at) && (
                    <span>
                      Exam: {o.scheduled_start_at ? new Date(o.scheduled_start_at).toLocaleString() : '—'}
                      {o.scheduled_end_at && (
                        o.scheduled_start_at && new Date(o.scheduled_start_at).toDateString() === new Date(o.scheduled_end_at).toDateString()
                          ? ` – ${new Date(o.scheduled_end_at).toLocaleTimeString()}`
                          : ` → ${new Date(o.scheduled_end_at).toLocaleString()}`
                      )}
                    </span>
                  )}
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
