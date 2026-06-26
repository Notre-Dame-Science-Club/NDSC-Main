'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { supabase } from '@/lib/supabase'
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Eye, EyeOff, Star, Image as ImageIcon, FileText, X, Check, Megaphone, ArrowRight } from 'lucide-react'

type CustomField = { key: string; label: string; type: 'text' | 'textarea' | 'email' | 'tel'; required: boolean }
type McqOption = { id: string; text: string }
type McqQuestion = { id: string; text: string; options: McqOption[]; correct_option_id: string }

type Olympiad = {
  id: string
  name: string
  description: string
  cover_image_url?: string
  mode: 'photo_submit' | 'online_mcq'
  is_active: boolean
  registration_deadline?: string
  exam_date?: string
  eligibility?: string
  external_only?: boolean
  custom_fields: CustomField[]
  questions: McqQuestion[]
  show_results_immediately: boolean
  pdf_url?: string
  organizer_password?: string
  created_at: string
}

const BLANK_OLYMPIAD: Partial<Olympiad> = {
  name: '', description: '', mode: 'photo_submit', is_active: true,
  external_only: false, custom_fields: [], questions: [], show_results_immediately: false,
  organizer_password: '',
}

const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'
const inputStyle = { background: '#030a12', borderColor: '#0f2a4a', color: '#e8f4ff' }

function uid() { return Math.random().toString(36).slice(2, 9) }

export default function AdminOlympiadsPage() {
  const [olympiads, setOlympiads] = useState<Olympiad[]>([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState<Partial<Olympiad> | null>(null)
  const [saving, setSaving] = useState(false)
  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [registrations, setRegistrations] = useState<Record<string, any[]>>({})
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [markScore, setMarkScore] = useState<Record<string, string>>({})
  const [tab, setTab] = useState<'olympiads' | 'registrations'>('olympiads')
  const [selectedOlympiadId, setSelectedOlympiadId] = useState<string | null>(null)
  const [uploading, setUploading] = useState<'cover' | 'pdf' | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadError, setUploadError] = useState('')

  const load = async () => {
    const { data } = await supabase.from('olympiads').select('*').order('created_at', { ascending: false })
    setOlympiads((data as Olympiad[]) || [])
    setLoading(false)
  }

  useEffect(() => { load() }, [])

  const loadRegistrations = async (olympiadId: string) => {
    const { data } = await supabase
      .from('olympiad_registrations')
      .select('*')
      .eq('olympiad_id', olympiadId)
      .order('created_at', { ascending: false })
    setRegistrations(prev => ({ ...prev, [olympiadId]: data || [] }))
  }

  const toggleExpand = (id: string) => {
    if (expandedId === id) { setExpandedId(null); return }
    setExpandedId(id)
    if (!registrations[id]) loadRegistrations(id)
  }

  // Direct-to-Hostinger upload. The admin is already authenticated, so it is
  // safe to hand the browser a one-time-fetched upload URL + secret and let
  // it talk to Hostinger directly — this is the same pattern already used in
  // the Publications admin page, kept here for the Olympiad cover image / PDF.
  const MAX_COVER_MB = 10
  const MAX_PDF_MB = 20

  const uploadFile = (
    file: File,
    folder: 'olympiad-covers' | 'olympiad-pdfs',
    onProgress?: (pct: number) => void
  ): Promise<string | null> => {
    return new Promise(async (resolve) => {
      let uploadUrl: string
      let secret: string
      try {
        const res = await fetch('/api/admin/upload-token')
        const data = await res.json()
        if (!data.uploadUrl || !data.secret) { resolve(null); return }
        uploadUrl = data.uploadUrl
        secret = data.secret
      } catch { resolve(null); return }

      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', folder)

      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable && onProgress) {
          onProgress(Math.round((e.loaded / e.total) * 100))
        }
      })

      xhr.addEventListener('load', () => {
        try {
          const data = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300 && data.url) resolve(data.url)
          else resolve(null)
        } catch { resolve(null) }
      })

      xhr.addEventListener('error', () => resolve(null))
      xhr.open('POST', uploadUrl)
      xhr.setRequestHeader('X-Upload-Secret', secret)
      xhr.send(fd)
    })
  }

  const handleCoverUpload = async (file: File | null) => {
    if (!file) return
    setUploadError('')
    if (file.size > MAX_COVER_MB * 1024 * 1024) {
      setUploadError(`Cover image too large. Maximum size is ${MAX_COVER_MB}MB.`)
      return
    }
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp'].includes(file.type)) {
      setUploadError('Invalid file type. Please upload a JPG, PNG, or WEBP image.')
      return
    }
    setUploading('cover')
    setUploadProgress(0)
    const url = await uploadFile(file, 'olympiad-covers', (pct) => setUploadProgress(pct))
    if (url) setEditing(p => ({ ...p, cover_image_url: url }))
    else setUploadError('Upload failed. Please try again.')
    setUploading(null)
    setUploadProgress(0)
  }

  const handlePdfUpload = async (file: File | null) => {
    if (!file) return
    setUploadError('')
    if (file.size > MAX_PDF_MB * 1024 * 1024) {
      setUploadError(`PDF too large. Maximum size is ${MAX_PDF_MB}MB.`)
      return
    }
    if (file.type !== 'application/pdf') {
      setUploadError('Invalid file type. Please upload a PDF.')
      return
    }
    setUploading('pdf')
    setUploadProgress(0)
    const url = await uploadFile(file, 'olympiad-pdfs', (pct) => setUploadProgress(pct))
    if (url) setEditing(p => ({ ...p, pdf_url: url }))
    else setUploadError('Upload failed. Please try again.')
    setUploading(null)
    setUploadProgress(0)
  }


  const save = async () => {
    if (!editing) return
    setSaving(true)
    const payload = {
      name: editing.name || '',
      description: editing.description || '',
      cover_image_url: editing.cover_image_url || null,
      mode: editing.mode || 'photo_submit',
      is_active: editing.is_active ?? true,
      registration_deadline: editing.registration_deadline || null,
      exam_date: editing.exam_date || null,
      eligibility: editing.eligibility || null,
      external_only: editing.external_only ?? false,
      custom_fields: editing.custom_fields || [],
      questions: editing.questions || [],
      show_results_immediately: editing.show_results_immediately ?? false,
      pdf_url: editing.pdf_url || null,
      organizer_password: editing.organizer_password || null,
    }
    if (editing.id) {
      await supabase.from('olympiads').update(payload).eq('id', editing.id)
    } else {
      await supabase.from('olympiads').insert(payload)
    }
    setSaving(false)
    setEditing(null)
    load()
  }

  const del = async (id: string) => {
    if (!confirm('Delete this olympiad? All registrations will also be deleted.')) return
    await supabase.from('olympiad_registrations').delete().eq('olympiad_id', id)
    await supabase.from('olympiads').delete().eq('id', id)
    load()
  }

  const toggleActive = async (o: Olympiad) => {
    await supabase.from('olympiads').update({ is_active: !o.is_active }).eq('id', o.id)
    load()
  }

  const saveScore = async (regId: string, score: string) => {
    await supabase.from('olympiad_registrations').update({ final_score: Number(score), review_status: 'reviewed' }).eq('id', regId)
    if (selectedOlympiadId) loadRegistrations(selectedOlympiadId)
    setMarkingId(null)
  }

  // ---------- EDITOR HELPERS ----------
  const addCustomField = () => {
    const cf: CustomField = { key: uid(), label: '', type: 'text', required: false }
    setEditing(p => ({ ...p, custom_fields: [...(p?.custom_fields || []), cf] }))
  }
  const removeCustomField = (key: string) =>
    setEditing(p => ({ ...p, custom_fields: (p?.custom_fields || []).filter(f => f.key !== key) }))
  const updateCustomField = (key: string, patch: Partial<CustomField>) =>
    setEditing(p => ({ ...p, custom_fields: (p?.custom_fields || []).map(f => f.key === key ? { ...f, ...patch } : f) }))

  const addQuestion = () => {
    const q: McqQuestion = { id: uid(), text: '', options: [{ id: uid(), text: '' }, { id: uid(), text: '' }], correct_option_id: '' }
    setEditing(p => ({ ...p, questions: [...(p?.questions || []), q] }))
  }
  const removeQuestion = (qid: string) =>
    setEditing(p => ({ ...p, questions: (p?.questions || []).filter(q => q.id !== qid) }))
  const updateQuestion = (qid: string, patch: Partial<McqQuestion>) =>
    setEditing(p => ({ ...p, questions: (p?.questions || []).map(q => q.id === qid ? { ...q, ...patch } : q) }))
  const addOption = (qid: string) =>
    updateQuestion(qid, { options: [...((editing?.questions || []).find(q => q.id === qid)?.options || []), { id: uid(), text: '' }] })
  const removeOption = (qid: string, oid: string) => {
    const q = (editing?.questions || []).find(q => q.id === qid)
    if (!q) return
    updateQuestion(qid, { options: q.options.filter(o => o.id !== oid) })
  }
  const updateOption = (qid: string, oid: string, text: string) => {
    const q = (editing?.questions || []).find(q => q.id === qid)
    if (!q) return
    updateQuestion(qid, { options: q.options.map(o => o.id === oid ? { ...o, text } : o) })
  }

  const s = { background: '#050d1a', borderColor: '#0f2a4a' }
  const h = { fontFamily: "'Orbitron', sans-serif", color: '#00d4ff' }

  if (loading) return <div style={{ color: '#6a8faf' }}>Loading...</div>

  // ---------- REGISTRATION VIEWER ----------
  if (tab === 'registrations' && selectedOlympiadId) {
    const regs = registrations[selectedOlympiadId] || []
    const olympiad = olympiads.find(o => o.id === selectedOlympiadId)
    return (
      <div>
        <div className="flex items-center gap-4 mb-6">
          <button onClick={() => setTab('olympiads')} className="text-sm px-3 py-1 rounded border" style={{ borderColor: '#0f2a4a', color: '#6a8faf' }}>← Back</button>
          <h1 className="text-xl font-bold" style={h}>{olympiad?.name} — Registrations ({regs.length})</h1>
        </div>
        <div className="rounded-xl border overflow-x-auto" style={s}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid #0f2a4a', background: 'rgba(0,212,255,0.04)' }}>
                {['Name','Phone','College','Roll','Batch','Group','Score','Status','Answer Sheet'].map(h2 => (
                  <th key={h2} className="text-left px-4 py-3 font-medium whitespace-nowrap" style={{ color: '#6a8faf' }}>{h2}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {regs.map(r => (
                <tr key={r.id} style={{ borderBottom: '1px solid #0a1f35' }}>
                  <td className="px-4 py-3" style={{ color: '#e8f4ff' }}>{r.full_name}</td>
                  <td className="px-4 py-3" style={{ color: '#6a8faf' }}>{r.phone}</td>
                  <td className="px-4 py-3" style={{ color: '#6a8faf' }}>{r.college || '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#6a8faf' }}>{r.college_roll || '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#6a8faf' }}>{r.batch || '—'}</td>
                  <td className="px-4 py-3" style={{ color: '#6a8faf' }}>{r.group_name || '—'}</td>
                  <td className="px-4 py-3">
                    {markingId === r.id ? (
                      <div className="flex gap-1">
                        <input type="number" className="w-16 px-2 py-1 rounded text-xs border" style={inputStyle}
                          value={markScore[r.id] || ''} onChange={e => setMarkScore(p => ({ ...p, [r.id]: e.target.value }))} />
                        <button onClick={() => saveScore(r.id, markScore[r.id] || '0')}
                          className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(0,255,128,0.15)', color: '#00ff80' }}>✓</button>
                        <button onClick={() => setMarkingId(null)} className="px-2 py-1 rounded text-xs" style={{ background: 'rgba(255,80,80,0.1)', color: '#ff7070' }}>✗</button>
                      </div>
                    ) : (
                      <button onClick={() => { setMarkingId(r.id); setMarkScore(p => ({ ...p, [r.id]: r.final_score ?? '' })) }}
                        className="text-xs px-2 py-1 rounded border" style={{ borderColor: '#0f2a4a', color: r.final_score != null ? '#00ff80' : '#6a8faf' }}>
                        {r.final_score != null ? r.final_score : 'Mark'}
                      </button>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: r.review_status === 'reviewed' ? 'rgba(0,255,128,0.1)' : 'rgba(255,165,0,0.1)',
                      color: r.review_status === 'reviewed' ? '#00ff80' : '#ffa500',
                      border: `1px solid ${r.review_status === 'reviewed' ? 'rgba(0,255,128,0.3)' : 'rgba(255,165,0,0.3)'}`,
                    }}>{r.review_status || 'pending'}</span>
                  </td>
                  <td className="px-4 py-3">
                    {r.answer_sheet_url
                      ? <a href={r.answer_sheet_url} target="_blank" className="text-xs underline" style={{ color: '#00d4ff' }}>View</a>
                      : <span style={{ color: '#6a8faf' }}>—</span>}
                  </td>
                </tr>
              ))}
              {regs.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center" style={{ color: '#6a8faf' }}>No registrations yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    )
  }

  // ---------- MAIN ----------
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={h}>Olympiads</h1>
        <button onClick={() => { setEditing({ ...BLANK_OLYMPIAD }); setUploadError(''); setUploadProgress(0); setUploading(null) }}
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
          style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}>
          <Plus size={16} /> New Olympiad
        </button>
      </div>

      {/* Announcements now live on their own dedicated page — this used to be
          a second, half-working copy of the same compose box, which is the
          "announcement is messy" bug. Single source of truth now. */}
      <Link href="/admin/announcements"
        className="flex items-center justify-between rounded-xl border p-5 mb-6 transition-colors hover:border-[#00d4ff]"
        style={s}>
        <div className="flex items-center gap-3">
          <Megaphone size={20} style={{ color: '#00d4ff' }} />
          <div>
            <p className="font-bold text-sm" style={{ color: '#e8f4ff' }}>Send an Announcement</p>
            <p className="text-xs mt-0.5" style={{ color: '#6a8faf' }}>
              Email members, olympiad registrants, or everyone — manage announcements →
            </p>
          </div>
        </div>
        <ArrowRight size={18} style={{ color: '#6a8faf' }} />
      </Link>

      {/* Olympiad List */}
      <div className="space-y-4">
        {olympiads.map(o => (
          <div key={o.id} className="rounded-xl border overflow-hidden" style={s}>
            <div className="flex items-center gap-4 p-4">
              {o.cover_image_url && (
                <img src={o.cover_image_url} alt={o.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0" />
              )}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <h3 className="font-bold" style={{ color: '#e8f4ff' }}>{o.name}</h3>
                  <span className="text-xs px-2 py-0.5 rounded" style={{
                    background: o.mode === 'online_mcq' ? '#00ff8022' : '#00d4ff22',
                    color: o.mode === 'online_mcq' ? '#00ff80' : '#00d4ff',
                  }}>{o.mode === 'online_mcq' ? 'Online MCQ' : 'Photo Submit'}</span>
                  <span className="text-xs px-2 py-0.5 rounded" style={{
                    background: o.is_active ? 'rgba(0,255,128,0.1)' : 'rgba(255,80,80,0.1)',
                    color: o.is_active ? '#00ff80' : '#ff7070',
                  }}>{o.is_active ? 'Active' : 'Hidden'}</span>
                </div>
                <p className="text-xs mt-0.5 truncate" style={{ color: '#6a8faf' }}>{o.description}</p>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <button onClick={() => { setSelectedOlympiadId(o.id); setTab('registrations'); loadRegistrations(o.id) }}
                  className="px-3 py-1.5 rounded text-xs border" style={{ borderColor: '#0f2a4a', color: '#6a8faf' }}>
                  Registrations
                </button>
                <button onClick={() => toggleActive(o)} className="p-1.5 rounded" style={{ color: '#6a8faf' }} title={o.is_active ? 'Hide' : 'Show'}>
                  {o.is_active ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
                <button onClick={() => { setEditing(o); setUploadError(''); setUploadProgress(0); setUploading(null) }} className="p-1.5 rounded" style={{ color: '#00d4ff' }}><Edit2 size={16} /></button>
                <button onClick={() => del(o.id)} className="p-1.5 rounded" style={{ color: '#ff7070' }}><Trash2 size={16} /></button>
              </div>
            </div>
          </div>
        ))}
        {olympiads.length === 0 && (
          <div className="rounded-xl border p-8 text-center" style={s}>
            <p style={{ color: '#6a8faf' }}>No olympiads yet. Click "New Olympiad" to create one.</p>
          </div>
        )}
      </div>

      {/* EDITOR MODAL */}
      {editing && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto py-8 px-4"
          style={{ background: 'rgba(0,0,0,0.85)' }}>
          <div className="w-full max-w-2xl rounded-2xl border" style={{ background: '#050d1a', borderColor: '#0f2a4a' }}>
            <div className="flex items-center justify-between p-6 border-b" style={{ borderColor: '#0f2a4a' }}>
              <h2 className="font-black text-lg" style={h}>{editing.id ? 'Edit Olympiad' : 'New Olympiad'}</h2>
              <button onClick={() => { setEditing(null); setUploadError('') }} style={{ color: '#6a8faf' }}><X size={20} /></button>
            </div>
            <div className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">

              <div>
                <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Title *</label>
                <input className={inputClass} style={inputStyle} value={editing.name || ''}
                  onChange={e => setEditing(p => ({ ...p, name: e.target.value }))} placeholder="e.g. Batch 28 Introductory Quiz" />
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Description</label>
                <textarea rows={3} className={inputClass + ' resize-none'} style={inputStyle} value={editing.description || ''}
                  onChange={e => setEditing(p => ({ ...p, description: e.target.value }))} />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Mode</label>
                  <select className={inputClass} style={inputStyle} value={editing.mode || 'photo_submit'}
                    onChange={e => setEditing(p => ({ ...p, mode: e.target.value as any }))}>
                    <option value="photo_submit">Photo Submit (offline paper)</option>
                    <option value="online_mcq">Online MCQ</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Status</label>
                  <select className={inputClass} style={inputStyle} value={editing.is_active ? 'true' : 'false'}
                    onChange={e => setEditing(p => ({ ...p, is_active: e.target.value === 'true' }))}>
                    <option value="true">Active (visible)</option>
                    <option value="false">Hidden</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Registration Deadline</label>
                  <input type="datetime-local" className={inputClass} style={inputStyle}
                    value={editing.registration_deadline?.slice(0, 16) || ''}
                    onChange={e => setEditing(p => ({ ...p, registration_deadline: e.target.value }))} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Exam Date</label>
                  <input type="datetime-local" className={inputClass} style={inputStyle}
                    value={editing.exam_date?.slice(0, 16) || ''}
                    onChange={e => setEditing(p => ({ ...p, exam_date: e.target.value }))} />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>
                    Cover Image <span style={{ color: '#3d5a78' }}>(max {MAX_COVER_MB}MB — JPG, PNG, WEBP)</span>
                  </label>
                  <label className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm border cursor-pointer"
                    style={{ ...inputStyle, color: '#00d4ff', opacity: uploading === 'cover' ? 0.6 : 1 }}>
                    <ImageIcon size={15} />
                    {uploading === 'cover' ? 'Uploading...' : editing.cover_image_url ? 'Replace cover image' : 'Upload cover image'}
                    <input type="file" accept="image/jpeg,image/png,image/webp" className="hidden"
                      disabled={uploading === 'cover'}
                      onChange={e => handleCoverUpload(e.target.files?.[0] || null)} />
                  </label>
                  {uploading === 'cover' && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1" style={{ color: '#6a8faf' }}>
                        <span>Uploading...</span><span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: '#0f2a4a' }}>
                        <div className="h-full rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%`, background: '#00d4ff' }} />
                      </div>
                    </div>
                  )}
                  {editing.cover_image_url && uploading !== 'cover' && (
                    <div className="relative w-fit mt-2">
                      <img src={editing.cover_image_url} alt="cover" className="h-16 rounded-lg object-cover border" style={{ borderColor: '#0f2a4a' }} />
                      <button onClick={() => setEditing(p => ({ ...p, cover_image_url: '' }))}
                        className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full text-xs flex items-center justify-center"
                        style={{ background: 'rgba(255,80,80,0.85)', color: 'white' }}>✕</button>
                    </div>
                  )}
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>
                    Question PDF <span style={{ color: '#3d5a78' }}>(optional — max {MAX_PDF_MB}MB)</span>
                  </label>
                  <label className="flex items-center justify-center gap-2 w-full px-3 py-2.5 rounded-lg text-sm border cursor-pointer"
                    style={{ ...inputStyle, color: '#00d4ff', opacity: uploading === 'pdf' ? 0.6 : 1 }}>
                    <FileText size={15} />
                    {uploading === 'pdf' ? 'Uploading...' : editing.pdf_url ? 'Replace PDF' : 'Upload PDF'}
                    <input type="file" accept="application/pdf" className="hidden"
                      disabled={uploading === 'pdf'}
                      onChange={e => handlePdfUpload(e.target.files?.[0] || null)} />
                  </label>
                  {uploading === 'pdf' && (
                    <div className="mt-2">
                      <div className="flex justify-between text-xs mb-1" style={{ color: '#6a8faf' }}>
                        <span>Uploading...</span><span>{uploadProgress}%</span>
                      </div>
                      <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: '#0f2a4a' }}>
                        <div className="h-full rounded-full transition-all duration-200" style={{ width: `${uploadProgress}%`, background: '#00d4ff' }} />
                      </div>
                    </div>
                  )}
                  {editing.pdf_url && uploading !== 'pdf' && (
                    <div className="flex items-center gap-2 mt-2 text-xs" style={{ color: '#6a8faf' }}>
                      <a href={editing.pdf_url} target="_blank" className="underline" style={{ color: '#00d4ff' }}>View current PDF</a>
                      <button onClick={() => setEditing(p => ({ ...p, pdf_url: '' }))} style={{ color: '#ff7070' }}>✕ Remove</button>
                    </div>
                  )}
                </div>
              </div>

              {uploadError && (
                <div className="p-2.5 rounded-lg text-xs" style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', color: '#ff7070' }}>
                  {uploadError}
                </div>
              )}

              <div>
                <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Eligibility</label>
                <input className={inputClass} style={inputStyle} value={editing.eligibility || ''}
                  onChange={e => setEditing(p => ({ ...p, eligibility: e.target.value }))} placeholder="e.g. Notre Dame College Batch 28 students" />
              </div>

              <div>
                <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Organizer Review Password</label>
                <input className={inputClass} style={inputStyle} value={editing.organizer_password || ''}
                  onChange={e => setEditing(p => ({ ...p, organizer_password: e.target.value }))} placeholder="Password organizers use to log in and review" />
              </div>

              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#6a8faf' }}>
                  <input type="checkbox" checked={editing.external_only || false}
                    onChange={e => setEditing(p => ({ ...p, external_only: e.target.checked }))} />
                  Open to external colleges (no NDC pre-fill)
                </label>
                {editing.mode === 'online_mcq' && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: '#6a8faf' }}>
                    <input type="checkbox" checked={editing.show_results_immediately || false}
                      onChange={e => setEditing(p => ({ ...p, show_results_immediately: e.target.checked }))} />
                    Show score immediately after submission
                  </label>
                )}
              </div>

              {/* Custom Fields */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold" style={{ color: '#00d4ff' }}>ADDITIONAL FORM FIELDS</label>
                  <button onClick={addCustomField} className="text-xs px-3 py-1 rounded" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>+ Add Field</button>
                </div>
                {(editing.custom_fields || []).map(cf => (
                  <div key={cf.key} className="flex gap-2 mb-2 items-center">
                    <input className={inputClass} style={inputStyle} value={cf.label} placeholder="Field label"
                      onChange={e => updateCustomField(cf.key, { label: e.target.value })} />
                    <select className="px-2 py-2 rounded-lg text-sm border outline-none" style={inputStyle}
                      value={cf.type} onChange={e => updateCustomField(cf.key, { type: e.target.value as any })}>
                      <option value="text">Text</option>
                      <option value="textarea">Textarea</option>
                      <option value="email">Email</option>
                      <option value="tel">Phone</option>
                    </select>
                    <label className="flex items-center gap-1 text-xs whitespace-nowrap" style={{ color: '#6a8faf' }}>
                      <input type="checkbox" checked={cf.required} onChange={e => updateCustomField(cf.key, { required: e.target.checked })} /> Req.
                    </label>
                    <button onClick={() => removeCustomField(cf.key)} style={{ color: '#ff7070' }}><X size={14} /></button>
                  </div>
                ))}
              </div>

              {/* MCQ Questions */}
              {editing.mode === 'online_mcq' && (
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <label className="text-xs font-bold" style={{ color: '#00d4ff' }}>MCQ QUESTIONS</label>
                    <button onClick={addQuestion} className="text-xs px-3 py-1 rounded" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>+ Add Question</button>
                  </div>
                  {(editing.questions || []).map((q, qi) => (
                    <div key={q.id} className="p-3 rounded-lg border mb-3" style={{ borderColor: '#0f2a4a', background: '#030a12' }}>
                      <div className="flex gap-2 mb-2">
                        <span className="text-xs font-bold mt-2.5" style={{ color: '#00d4ff' }}>Q{qi + 1}</span>
                        <input className={inputClass} style={inputStyle} value={q.text} placeholder="Question text"
                          onChange={e => updateQuestion(q.id, { text: e.target.value })} />
                        <button onClick={() => removeQuestion(q.id)} style={{ color: '#ff7070' }}><X size={14} /></button>
                      </div>
                      {q.options.map((opt, oi) => (
                        <div key={opt.id} className="flex gap-2 mb-1 ml-6">
                          <input type="radio" name={`correct_${q.id}`} checked={q.correct_option_id === opt.id}
                            onChange={() => updateQuestion(q.id, { correct_option_id: opt.id })} />
                          <input className={inputClass} style={{ ...inputStyle, border: '1px solid ' + (q.correct_option_id === opt.id ? '#00ff80' : '#0f2a4a') }}
                            value={opt.text} placeholder={`Option ${String.fromCharCode(65 + oi)}`}
                            onChange={e => updateOption(q.id, opt.id, e.target.value)} />
                          {q.options.length > 2 && (
                            <button onClick={() => removeOption(q.id, opt.id)} style={{ color: '#ff7070' }}><X size={14} /></button>
                          )}
                        </div>
                      ))}
                      <button onClick={() => addOption(q.id)} className="ml-6 mt-1 text-xs" style={{ color: '#6a8faf' }}>+ Add option</button>
                      <p className="ml-6 mt-1 text-xs" style={{ color: '#6a8faf' }}>Select the radio button next to the correct answer.</p>
                    </div>
                  ))}
                </div>
              )}

            </div>
            <div className="flex justify-end gap-3 p-6 border-t" style={{ borderColor: '#0f2a4a' }}>
              <button onClick={() => { setEditing(null); setUploadError('') }} className="px-5 py-2 rounded-lg text-sm border" style={{ borderColor: '#0f2a4a', color: '#6a8faf' }}>Cancel</button>
              <button onClick={save} disabled={saving}
                className="px-6 py-2 rounded-lg text-sm font-black disabled:opacity-50"
                style={{ background: '#00d4ff', color: '#000', fontFamily: "'Orbitron', sans-serif" }}>
                {saving ? 'SAVING...' : 'SAVE →'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
