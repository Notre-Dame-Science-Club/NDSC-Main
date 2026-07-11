'use client'
import { useEffect, useMemo, useState } from 'react'
import {
  Plus, Trash2, Edit2, X, ArrowUp, ArrowDown, Image as ImageIcon,
  MessageSquare, AlignLeft, CircleDot, CheckSquare, ChevronDown, SlidersHorizontal,
  Calendar, Clock, Bell, Mail, Users, BarChart3, Send, Eye, EyeOff,
} from 'lucide-react'
import {
  type SurveyQuestion, type SurveyQuestionType, type SurveyAudienceType, type SurveyAudienceConfig,
  SURVEY_QUESTION_TYPES, AUDIENCE_LABELS, blankQuestion,
} from '@/lib/survey'

type Survey = {
  id: string
  title: string
  description?: string
  cover_image_url?: string
  questions: SurveyQuestion[]
  is_active: boolean
  starts_at?: string | null
  ends_at?: string | null
  allow_multiple_responses: boolean
  show_notification: boolean
  notification_title?: string
  notification_message?: string
  send_email: boolean
  email_sent_at?: string | null
  audience_type: SurveyAudienceType
  audience_config: SurveyAudienceConfig
  created_at: string
  response_count?: number
}

type Member = {
  id: string; full_name: string; email: string; batch?: string
  is_organizer?: boolean; is_executive?: boolean; is_verified?: boolean
}

type SurveyResponse = {
  id: string; survey_id: string; member_id?: string | null
  respondent_name?: string | null; respondent_email?: string | null
  answers: Record<string, any>; created_at: string
  member?: { full_name: string; email: string } | null
}

const uid = () => Math.random().toString(36).slice(2, 9)

const BLANK: Partial<Survey> = {
  title: '', description: '', questions: [], is_active: true, allow_multiple_responses: false,
  show_notification: false, send_email: false, audience_type: 'all', audience_config: {},
}

const MAX_COVER_MB = 8

const QUESTION_ICON: Record<SurveyQuestionType, any> = {
  short_text: MessageSquare, paragraph: AlignLeft, multiple_choice: CircleDot, checkboxes: CheckSquare,
  dropdown: ChevronDown, linear_scale: SlidersHorizontal, date: Calendar, time: Clock,
}

const h = { fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }
const s = { background: 'var(--bg2)', borderColor: 'var(--border)' }
const inputClass = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'
const inputStyle = { background: 'var(--surface-alt)', borderColor: 'var(--border)', color: 'var(--white-soft)' }

/** Small dependency-free bar chart — consistent with the rest of the admin's plain-CSS visual style rather than pulling in a charting library for one page. */
function BarChart({ data, color = 'var(--blue)', height = 110, minBarWidth }: {
  data: { label: string; value: number }[]; color?: string; height?: number; minBarWidth?: number
}) {
  const max = Math.max(1, ...data.map(d => d.value))
  return (
    <div className="flex items-end gap-1" style={{ height }}>
      {data.map((d, i) => (
        <div key={i} className="flex-1 flex flex-col items-center justify-end h-full" style={minBarWidth ? { minWidth: minBarWidth } : undefined}>
          <span className="text-[9px] mb-0.5 leading-none" style={{ color: 'var(--border-soft)' }}>{d.value > 0 ? d.value : ''}</span>
          <div className="w-full rounded-t" style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 3 : 0, background: color, opacity: d.value > 0 ? 1 : 0.15 }} />
          {d.label && <span className="text-[8px] mt-1 truncate w-full text-center leading-tight" style={{ color: 'var(--border-soft)' }}>{d.label}</span>}
        </div>
      ))}
    </div>
  )
}

const formatHour = (hh: number) => { const period = hh < 12 ? 'AM' : 'PM'; const h12 = hh % 12 === 0 ? 12 : hh % 12; return `${h12}${period}` }
const DOW_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

export default function AdminSurveysPage() {
  const [surveys, setSurveys] = useState<Survey[]>([])
  const [loading, setLoading] = useState(true)
  const [pageError, setPageError] = useState('')
  const [editing, setEditing] = useState<Partial<Survey> | null>(null)
  const [saving, setSaving] = useState(false)

  const [members, setMembers] = useState<Member[]>([])
  const [membersLoaded, setMembersLoaded] = useState(false)
  const [memberSearch, setMemberSearch] = useState('')

  const [uploading, setUploading] = useState(false)
  const [uploadError, setUploadError] = useState('')

  const [responsesFor, setResponsesFor] = useState<Survey | null>(null)
  const [responses, setResponses] = useState<SurveyResponse[]>([])
  const [responsesLoading, setResponsesLoading] = useState(false)

  const [emailSending, setEmailSending] = useState(false)
  const [emailResult, setEmailResult] = useState<{ ok: boolean; text: string } | null>(null)

  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/surveys')
    if (res.ok) setSurveys(await res.json() || [])
    else setPageError('Failed to load surveys.')
    setLoading(false)
  }
  useEffect(() => { load() }, [])

  const loadMembers = async () => {
    if (membersLoaded) return
    const res = await fetch('/api/admin/members')
    if (res.ok) {
      const data = await res.json()
      setMembers(data.members || [])
    }
    setMembersLoaded(true)
  }

  const batches = useMemo(
    () => Array.from(new Set(members.map(m => m.batch).filter((b): b is string => !!b))).sort(),
    [members]
  )

  const filteredMembers = useMemo(() => {
    const q = memberSearch.trim().toLowerCase()
    if (!q) return members
    return members.filter(m =>
      m.full_name?.toLowerCase().includes(q) || m.email?.toLowerCase().includes(q) || m.batch?.toLowerCase().includes(q)
    )
  }, [members, memberSearch])

  // ── analytics (timing) ──────────────────────────────────────────
  const timingStats = useMemo(() => {
    const total = responses.length
    const memberCount = responses.filter(r => r.member_id).length
    const hourCounts = Array.from({ length: 24 }, (_, hh) => ({
      label: hh % 3 === 0 ? formatHour(hh) : '', value: responses.filter(r => new Date(r.created_at).getHours() === hh).length,
    }))
    const dowCounts = DOW_LABELS.map((label, i) => ({ label, value: responses.filter(r => new Date(r.created_at).getDay() === i).length }))
    const dateMap: Record<string, number> = {}
    for (const r of responses) {
      const d = new Date(r.created_at).toLocaleDateString('en-CA')
      dateMap[d] = (dateMap[d] || 0) + 1
    }
    const dateEntries = Object.entries(dateMap).sort((a, b) => a[0].localeCompare(b[0]))
      .map(([d, value]) => ({ label: new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }), value }))
    const peakHourIdx = hourCounts.reduce((best, cur, i) => cur.value > hourCounts[best].value ? i : best, 0)
    const peakDowIdx = dowCounts.reduce((best, cur, i) => cur.value > dowCounts[best].value ? i : best, 0)
    return {
      total, memberCount, anonCount: total - memberCount, hourCounts, dowCounts, dateEntries,
      peakHourLabel: total > 0 ? formatHour(peakHourIdx) : '—',
      peakDowLabel: total > 0 ? DOW_LABELS[peakDowIdx] : '—',
    }
  }, [responses])

  // ── editor helpers ──────────────────────────────────────────────
  const openNew = () => { setEditing({ ...BLANK, questions: [] }); loadMembers() }
  const openEdit = (sv: Survey) => { setEditing({ ...sv }); loadMembers() }
  const closeEditor = () => { setEditing(null); setUploadError('') }

  const patchAudience = (patch: Partial<SurveyAudienceConfig>) =>
    setEditing(p => ({ ...p, audience_config: { ...(p?.audience_config || {}), ...patch } }))

  const toggleBatch = (batch: string) => {
    const cur = editing?.audience_config?.batches || []
    patchAudience({ batches: cur.includes(batch) ? cur.filter(b => b !== batch) : [...cur, batch] })
  }
  const toggleCustomMember = (id: string) => {
    const cur = editing?.audience_config?.member_ids || []
    patchAudience({ member_ids: cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id] })
  }
  const toggleRole = (role: 'organizer' | 'executive' | 'member') => {
    const cur = editing?.audience_config?.roles || []
    patchAudience({ roles: cur.includes(role) ? cur.filter(r => r !== role) : [...cur, role] })
  }

  const addQuestion = (type: SurveyQuestionType) =>
    setEditing(p => ({ ...p, questions: [...(p?.questions || []), blankQuestion(type)] }))
  const removeQuestion = (qid: string) =>
    setEditing(p => ({ ...p, questions: (p?.questions || []).filter(q => q.id !== qid) }))
  const updateQuestion = (qid: string, patch: Partial<SurveyQuestion>) =>
    setEditing(p => ({ ...p, questions: (p?.questions || []).map(q => q.id === qid ? { ...q, ...patch } : q) }))
  const moveQuestion = (qid: string, dir: -1 | 1) => {
    setEditing(p => {
      const list = [...(p?.questions || [])]
      const i = list.findIndex(q => q.id === qid)
      const j = i + dir
      if (i < 0 || j < 0 || j >= list.length) return p
      ;[list[i], list[j]] = [list[j], list[i]]
      return { ...p, questions: list }
    })
  }
  const addOption = (qid: string) => {
    const q = (editing?.questions || []).find(q => q.id === qid)
    updateQuestion(qid, { options: [...(q?.options || []), { id: uid(), text: '' }] })
  }
  const updateOption = (qid: string, oid: string, text: string) => {
    const q = (editing?.questions || []).find(q => q.id === qid)
    updateQuestion(qid, { options: (q?.options || []).map(o => o.id === oid ? { ...o, text } : o) })
  }
  const removeOption = (qid: string, oid: string) => {
    const q = (editing?.questions || []).find(q => q.id === qid)
    updateQuestion(qid, { options: (q?.options || []).filter(o => o.id !== oid) })
  }

  const uploadCover = async (file: File | null) => {
    if (!file || !editing) return
    if (file.size > MAX_COVER_MB * 1024 * 1024) { setUploadError(`Max ${MAX_COVER_MB}MB allowed`); return }
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) { setUploadError('Only JPG/PNG/WebP allowed'); return }
    setUploading(true); setUploadError('')
    try {
      const tokenRes = await fetch('/api/admin/upload-token')
      if (!tokenRes.ok) throw new Error('Could not get upload token')
      const { uploadUrl, secret } = await tokenRes.json()
      const fd = new FormData()
      fd.append('file', file)
      fd.append('folder', 'survey-covers')
      const url: string = await new Promise((resolve, reject) => {
        const xhr = new XMLHttpRequest()
        xhr.addEventListener('load', () => {
          try {
            const d = JSON.parse(xhr.responseText)
            if (xhr.status >= 200 && xhr.status < 300 && d.url) resolve(d.url)
            else reject(new Error(d.error || 'Upload failed'))
          } catch { reject(new Error('Upload failed')) }
        })
        xhr.addEventListener('error', () => reject(new Error('Network error')))
        xhr.open('POST', uploadUrl)
        // Secret must go in the header — Hostinger's upload script reads
        // X-Upload-Secret, not a body field (see the same note in the
        // Olympiads admin page's uploadFile helper).
        xhr.setRequestHeader('X-Upload-Secret', secret)
        xhr.send(fd)
      })
      setEditing(p => ({ ...p, cover_image_url: url }))
    } catch (e: any) {
      setUploadError(e.message || 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  const save = async () => {
    if (!editing?.title?.trim()) { setPageError('Title is required.'); return }
    setSaving(true); setPageError('')
    try {
      const method = editing.id ? 'PUT' : 'POST'
      const res = await fetch('/api/admin/surveys', {
        method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(editing),
      })
      const data = await res.json()
      if (!res.ok) { setPageError(data.error || 'Could not save the survey.'); return }
      closeEditor()
      load()
    } catch {
      setPageError('Network error while saving.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this survey and all of its responses? This cannot be undone.')) return
    const res = await fetch('/api/admin/surveys', {
      method: 'DELETE', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id }),
    })
    if (res.ok) setSurveys(prev => prev.filter(x => x.id !== id))
  }

  const toggleActive = async (sv: Survey) => {
    const res = await fetch('/api/admin/surveys', {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: sv.id, is_active: !sv.is_active }),
    })
    if (res.ok) setSurveys(prev => prev.map(x => x.id === sv.id ? { ...x, is_active: !x.is_active } : x))
  }

  const openResponses = async (sv: Survey) => {
    setResponsesFor(sv); setResponsesLoading(true)
    const res = await fetch(`/api/admin/surveys/responses?survey_id=${sv.id}`)
    setResponses(res.ok ? await res.json() : [])
    setResponsesLoading(false)
  }

  const sendEmailNow = async (sv: Survey) => {
    setEmailSending(true); setEmailResult(null)
    try {
      const res = await fetch('/api/admin/surveys/send-email', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ survey_id: sv.id }),
      })
      const data = await res.json()
      if (!res.ok) { setEmailResult({ ok: false, text: data.error || 'Could not send.' }); return }
      if (data.configured === false) setEmailResult({ ok: false, text: data.message })
      else setEmailResult({ ok: true, text: `Sent to ${data.sentCount} of ${data.totalRecipients} recipient(s).` })
    } catch {
      setEmailResult({ ok: false, text: 'Network error.' })
    } finally {
      setEmailSending(false)
    }
  }

  const distributionEnabled = !!(editing?.show_notification || editing?.send_email)

  // ── responses / analytics view ──────────────────────────────────
  if (responsesFor) {
    return (
      <div>
        <button onClick={() => setResponsesFor(null)} className="text-xs mb-4" style={{ color: 'var(--blue)' }}>&larr; Back to Surveys</button>
        <h1 className="text-2xl font-bold mb-1" style={h}>{responsesFor.title} — Analytics</h1>
        <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>{responses.length} response{responses.length === 1 ? '' : 's'}</p>

        {responsesLoading ? (
          <p style={{ color: 'var(--muted)' }}>Loading...</p>
        ) : responses.length === 0 ? (
          <div className="rounded-xl border p-8 text-center" style={s}>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>No responses yet.</p>
          </div>
        ) : (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              {[
                { label: 'Total responses', value: timingStats.total },
                { label: 'From members', value: timingStats.memberCount },
                { label: 'Busiest hour', value: timingStats.peakHourLabel },
                { label: 'Busiest day', value: timingStats.peakDowLabel },
              ].map(c => (
                <div key={c.label} className="rounded-xl border p-3.5" style={s}>
                  <p className="text-xl font-black" style={{ color: 'var(--blue)', fontFamily: "'Orbitron', sans-serif" }}>{c.value}</p>
                  <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{c.label}</p>
                </div>
              ))}
            </div>

            {/* Timing — when people usually respond */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
              <div className="rounded-xl border p-4" style={s}>
                <p className="font-bold text-sm mb-3" style={{ color: 'var(--white)' }}>Responses by time of day</p>
                <BarChart data={timingStats.hourCounts} color="var(--blue)" />
              </div>
              <div className="rounded-xl border p-4" style={s}>
                <p className="font-bold text-sm mb-3" style={{ color: 'var(--white)' }}>Responses by day of week</p>
                <BarChart data={timingStats.dowCounts} color="var(--accent2)" />
              </div>
            </div>

            {timingStats.dateEntries.length > 1 && (
              <div className="rounded-xl border p-4 mb-8" style={s}>
                <p className="font-bold text-sm mb-3" style={{ color: 'var(--white)' }}>Responses over time</p>
                <div className="overflow-x-auto">
                  <BarChart data={timingStats.dateEntries} color="var(--warning)" minBarWidth={timingStats.dateEntries.length > 14 ? 28 : undefined} />
                </div>
              </div>
            )}

            {/* Per-question breakdown */}
            <div className="space-y-4 mb-8">
              <p className="font-bold text-sm" style={{ color: 'var(--white)' }}>Answers by question</p>
              {(responsesFor.questions || []).map((q, qi) => {
                const answersForQ = responses.map(r => r.answers?.[q.id]).filter(a => a !== undefined && a !== null && a !== '')
                const isChoice = ['multiple_choice', 'checkboxes', 'dropdown'].includes(q.type)
                let counts: Record<string, number> = {}
                if (isChoice) {
                  for (const a of answersForQ) {
                    const vals = Array.isArray(a) ? a : [a]
                    for (const v of vals) counts[v] = (counts[v] || 0) + 1
                  }
                }
                return (
                  <div key={q.id} className="rounded-xl border p-4" style={s}>
                    <p className="font-bold text-sm mb-3" style={{ color: 'var(--white)' }}>{qi + 1}. {q.title}</p>
                    {isChoice ? (
                      Object.keys(counts).length === 0 ? (
                        <p className="text-xs" style={{ color: 'var(--border-soft)' }}>No answers yet.</p>
                      ) : (
                        <div className="space-y-1.5">
                          {Object.entries(counts).sort((a, b) => b[1] - a[1]).map(([opt, count]) => (
                            <div key={opt} className="flex items-center gap-2 text-xs">
                              <span className="w-32 truncate" style={{ color: 'var(--white-soft)' }}>{opt}</span>
                              <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface-alt)' }}>
                                <div className="h-full rounded-full" style={{ width: `${(count / answersForQ.length) * 100}%`, background: 'var(--blue)' }} />
                              </div>
                              <span style={{ color: 'var(--muted)' }}>{count}</span>
                            </div>
                          ))}
                        </div>
                      )
                    ) : (
                      <div className="space-y-1.5 max-h-40 overflow-y-auto">
                        {answersForQ.length === 0 ? (
                          <p className="text-xs" style={{ color: 'var(--border-soft)' }}>No answers yet.</p>
                        ) : answersForQ.map((a, i) => (
                          <p key={i} className="text-xs px-2 py-1 rounded" style={{ background: 'var(--surface-alt)', color: 'var(--white-soft)' }}>{String(a)}</p>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>

            {/* Raw table */}
            <div className="rounded-xl border overflow-x-auto" style={s}>
              <table className="w-full text-xs">
                <thead>
                  <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(var(--blue-rgb), 0.05)' }}>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>Respondent</th>
                    <th className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>Submitted</th>
                    {(responsesFor.questions || []).map(q => (
                      <th key={q.id} className="text-left px-3 py-2 font-medium" style={{ color: 'var(--muted)' }}>{q.title}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {responses.map(r => (
                    <tr key={r.id} style={{ borderBottom: '1px solid var(--surface-alt)' }}>
                      <td className="px-3 py-2" style={{ color: 'var(--white)' }}>
                        {r.member?.full_name || r.respondent_name || 'Anonymous'}
                        {(r.member?.email || r.respondent_email) && (
                          <span className="block" style={{ color: 'var(--border-soft)' }}>{r.member?.email || r.respondent_email}</span>
                        )}
                      </td>
                      <td className="px-3 py-2" style={{ color: 'var(--muted)' }}>
                        {new Date(r.created_at).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}
                      </td>
                      {(responsesFor.questions || []).map(q => (
                        <td key={q.id} className="px-3 py-2" style={{ color: 'var(--white-soft)' }}>
                          {Array.isArray(r.answers?.[q.id]) ? r.answers[q.id].join(', ') : (r.answers?.[q.id] ?? '—')}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    )
  }

  // ── editor view ──────────────────────────────────────────────
  if (editing) {
    return (
      <div className="max-w-3xl">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold" style={h}>{editing.id ? 'Edit Survey' : 'New Survey'}</h1>
          <button onClick={closeEditor} style={{ color: 'var(--muted)' }}><X size={20} /></button>
        </div>

        {pageError && (
          <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)', border: '1px solid rgba(var(--danger-rgb), 0.3)' }}>
            {pageError}
          </div>
        )}

        {/* Basics */}
        <div className="rounded-xl border p-5 mb-5" style={s}>
          <h2 className="font-bold text-sm mb-4" style={h}>Basics</h2>
          <div className="mb-3">
            <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Title *</label>
            <input value={editing.title || ''} onChange={e => setEditing(p => ({ ...p, title: e.target.value }))}
              className={inputClass} style={inputStyle} placeholder="e.g. Science Sunday Feedback" />
          </div>
          <div className="mb-3">
            <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Description</label>
            <textarea rows={2} value={editing.description || ''} onChange={e => setEditing(p => ({ ...p, description: e.target.value }))}
              className={inputClass + ' resize-none'} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Cover Image (optional)</label>
            {editing.cover_image_url && (
              <img src={editing.cover_image_url} alt="" className="w-full max-w-xs rounded-lg mb-2 object-cover" style={{ maxHeight: 140 }} />
            )}
            <label className="inline-flex items-center gap-2 text-xs px-3 py-2 rounded-lg cursor-pointer border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              <ImageIcon size={14} /> {uploading ? 'Uploading...' : 'Upload Image'}
              <input type="file" accept="image/*" className="hidden" disabled={uploading} onChange={e => uploadCover(e.target.files?.[0] || null)} />
            </label>
            {uploadError && <p className="text-xs mt-1" style={{ color: 'var(--danger-soft)' }}>{uploadError}</p>}
          </div>
        </div>

        {/* Questions */}
        <div className="rounded-xl border p-5 mb-5" style={s}>
          <h2 className="font-bold text-sm mb-1" style={h}>Questions</h2>
          <p className="text-xs mb-4" style={{ color: 'var(--border-soft)' }}>Mix any question types freely — Short Answer, Paragraph, Multiple Choice, Checkboxes, Dropdown, Linear Scale, Date, and Time.</p>

          <div className="flex flex-wrap gap-2 mb-4">
            {SURVEY_QUESTION_TYPES.map(t => {
              const Icon = QUESTION_ICON[t.value]
              return (
                <button key={t.value} onClick={() => addQuestion(t.value)}
                  className="text-xs px-2.5 py-1.5 rounded-lg flex items-center gap-1.5"
                  style={{ background: 'rgba(var(--blue-rgb), 0.09)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.2)' }}>
                  <Icon size={12} /> {t.label}
                </button>
              )
            })}
          </div>

          {(editing.questions || []).length === 0 && (
            <p className="text-xs text-center py-4" style={{ color: 'var(--border-soft)' }}>No questions yet. Add one above.</p>
          )}

          <div className="space-y-3">
            {(editing.questions || []).map((q, qi) => {
              const Icon = QUESTION_ICON[q.type]
              return (
                <div key={q.id} className="rounded-lg border p-3" style={{ background: 'var(--surface-deep)', borderColor: 'var(--border)' }}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold flex items-center gap-1.5" style={{ color: 'var(--blue)' }}>
                      <Icon size={13} /> Q{qi + 1} — {SURVEY_QUESTION_TYPES.find(t => t.value === q.type)?.label}
                    </span>
                    <div className="flex items-center gap-2">
                      <button onClick={() => moveQuestion(q.id, -1)} disabled={qi === 0} style={{ color: 'var(--muted)', opacity: qi === 0 ? 0.35 : 1 }}><ArrowUp size={13} /></button>
                      <button onClick={() => moveQuestion(q.id, 1)} disabled={qi === (editing.questions || []).length - 1} style={{ color: 'var(--muted)', opacity: qi === (editing.questions || []).length - 1 ? 0.35 : 1 }}><ArrowDown size={13} /></button>
                      <button onClick={() => removeQuestion(q.id)} style={{ color: 'var(--danger-soft)' }}><Trash2 size={13} /></button>
                    </div>
                  </div>

                  <input value={q.title} onChange={e => updateQuestion(q.id, { title: e.target.value })}
                    placeholder="Question text" className={inputClass + ' mb-2'} style={inputStyle} />
                  <input value={q.description || ''} onChange={e => updateQuestion(q.id, { description: e.target.value })}
                    placeholder="Description (optional)" className={inputClass + ' mb-2'} style={{ ...inputStyle, fontSize: 12 }} />

                  {(q.type === 'multiple_choice' || q.type === 'checkboxes' || q.type === 'dropdown') && (
                    <div className="space-y-1.5 mb-2">
                      {(q.options || []).map(opt => (
                        <div key={opt.id} className="flex items-center gap-2">
                          <input value={opt.text} onChange={e => updateOption(q.id, opt.id, e.target.value)}
                            placeholder="Option" className={inputClass} style={{ ...inputStyle, padding: '6px 10px' }} />
                          <button onClick={() => removeOption(q.id, opt.id)} style={{ color: 'var(--danger-soft)' }}><X size={13} /></button>
                        </div>
                      ))}
                      <button onClick={() => addOption(q.id)} className="text-xs" style={{ color: 'var(--blue)' }}>+ Add option</button>
                      <label className="flex items-center gap-1.5 text-xs mt-1" style={{ color: 'var(--muted)' }}>
                        <input type="checkbox" checked={!!q.allow_other} onChange={e => updateQuestion(q.id, { allow_other: e.target.checked })} />
                        Allow "Other" (free text)
                      </label>
                    </div>
                  )}

                  {q.type === 'linear_scale' && (
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>From</span>
                        <input type="number" value={q.scale_min ?? 1} onChange={e => updateQuestion(q.id, { scale_min: Number(e.target.value) })}
                          className={inputClass} style={{ ...inputStyle, width: 70 }} />
                        <span className="text-xs" style={{ color: 'var(--muted)' }}>to</span>
                        <input type="number" value={q.scale_max ?? 5} onChange={e => updateQuestion(q.id, { scale_max: Number(e.target.value) })}
                          className={inputClass} style={{ ...inputStyle, width: 70 }} />
                      </div>
                      <input value={q.scale_min_label || ''} onChange={e => updateQuestion(q.id, { scale_min_label: e.target.value })}
                        placeholder="Low label (optional)" className={inputClass} style={{ ...inputStyle, fontSize: 12 }} />
                      <input value={q.scale_max_label || ''} onChange={e => updateQuestion(q.id, { scale_max_label: e.target.value })}
                        placeholder="High label (optional)" className={inputClass} style={{ ...inputStyle, fontSize: 12 }} />
                    </div>
                  )}

                  <label className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--muted)' }}>
                    <input type="checkbox" checked={!!q.required} onChange={e => updateQuestion(q.id, { required: e.target.checked })} />
                    Required
                  </label>
                </div>
              )
            })}
          </div>
        </div>

        {/* Response window */}
        <div className="rounded-xl border p-5 mb-5" style={s}>
          <h2 className="font-bold text-sm mb-4" style={h}>Response Window</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Opens (optional)</label>
              <input type="datetime-local" value={editing.starts_at ? editing.starts_at.slice(0, 16) : ''}
                onChange={e => setEditing(p => ({ ...p, starts_at: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                className={inputClass} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Closes (optional)</label>
              <input type="datetime-local" value={editing.ends_at ? editing.ends_at.slice(0, 16) : ''}
                onChange={e => setEditing(p => ({ ...p, ends_at: e.target.value ? new Date(e.target.value).toISOString() : null }))}
                className={inputClass} style={inputStyle} />
            </div>
          </div>
          <div className="flex flex-wrap gap-4">
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--white-soft)' }}>
              <input type="checkbox" checked={editing.is_active ?? true} onChange={e => setEditing(p => ({ ...p, is_active: e.target.checked }))} />
              Active
            </label>
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--white-soft)' }}>
              <input type="checkbox" checked={!!editing.allow_multiple_responses} onChange={e => setEditing(p => ({ ...p, allow_multiple_responses: e.target.checked }))} />
              Allow multiple responses per person
            </label>
          </div>
        </div>

        {/* Distribution */}
        <div className="rounded-xl border p-5 mb-5" style={s}>
          <h2 className="font-bold text-sm mb-4" style={h}>Notification &amp; Distribution</h2>

          <div className="flex flex-wrap gap-3 mb-4">
            <div className="flex-1 min-w-[220px] rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <label className="flex items-center justify-between text-sm font-semibold mb-1" style={{ color: 'var(--white)' }}>
                <span className="flex items-center gap-1.5"><Bell size={14} /> Show notification on website</span>
                <input type="checkbox" checked={!!editing.show_notification} onChange={e => setEditing(p => ({ ...p, show_notification: e.target.checked }))} />
              </label>
              <p className="text-xs" style={{ color: 'var(--border-soft)' }}>Pops a card for the selected audience on their next site visit.</p>
            </div>
            <div className="flex-1 min-w-[220px] rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
              <label className="flex items-center justify-between text-sm font-semibold mb-1" style={{ color: 'var(--white)' }}>
                <span className="flex items-center gap-1.5"><Mail size={14} /> Send email</span>
                <input type="checkbox" checked={!!editing.send_email} onChange={e => setEditing(p => ({ ...p, send_email: e.target.checked }))} />
              </label>
              <p className="text-xs" style={{ color: 'var(--border-soft)' }}>Brevo integration is coming soon — this saves the intent; use "Send Now" below once configured.</p>
            </div>
          </div>

          {editing.show_notification && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-4">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Notification title (optional)</label>
                <input value={editing.notification_title || ''} onChange={e => setEditing(p => ({ ...p, notification_title: e.target.value }))}
                  placeholder={editing.title || 'Defaults to survey title'} className={inputClass} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Notification message (optional)</label>
                <input value={editing.notification_message || ''} onChange={e => setEditing(p => ({ ...p, notification_message: e.target.value }))}
                  placeholder={editing.description || 'Defaults to survey description'} className={inputClass} style={inputStyle} />
              </div>
            </div>
          )}

          {editing.id && editing.send_email && (
            <div className="mb-4">
              <button onClick={() => sendEmailNow(editing as Survey)} disabled={emailSending}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold disabled:opacity-50"
                style={{ background: 'var(--blue)', color: '#000' }}>
                <Send size={13} /> {emailSending ? 'Sending...' : 'Send Now'}
              </button>
              {editing.email_sent_at && (
                <span className="text-xs ml-2" style={{ color: 'var(--border-soft)' }}>
                  Last sent {new Date(editing.email_sent_at).toLocaleString()}
                </span>
              )}
              {emailResult && (
                <p className="text-xs mt-2" style={{ color: emailResult.ok ? 'var(--success)' : 'var(--warning)' }}>{emailResult.text}</p>
              )}
            </div>
          )}

          {/* Audience */}
          <div className={distributionEnabled ? '' : 'opacity-40 pointer-events-none'}>
            <label className="flex items-center gap-1.5 text-sm font-semibold mb-2" style={{ color: 'var(--white)' }}>
              <Users size={14} /> Audience
            </label>
            {!distributionEnabled && (
              <p className="text-xs mb-2" style={{ color: 'var(--border-soft)' }}>Turn on notification or email above to choose an audience.</p>
            )}
            <div className="flex flex-wrap gap-2 mb-3">
              {(Object.keys(AUDIENCE_LABELS) as SurveyAudienceType[]).map(a => (
                <button key={a} onClick={() => setEditing(p => ({ ...p, audience_type: a }))}
                  className="px-3 py-1.5 rounded-lg text-xs font-semibold border"
                  style={{
                    borderColor: editing.audience_type === a ? 'var(--blue)' : 'var(--border)',
                    color: editing.audience_type === a ? 'var(--blue)' : 'var(--muted)',
                    background: editing.audience_type === a ? 'rgba(var(--blue-rgb), 0.1)' : 'transparent',
                  }}>
                  {AUDIENCE_LABELS[a]}
                </button>
              ))}
            </div>

            {editing.audience_type === 'alumni' && (
              <div className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs mb-2" style={{ color: 'var(--border-soft)' }}>Pick one or more batches, or leave empty for every batch on file.</p>
                <div className="flex flex-wrap gap-1.5">
                  {batches.length === 0 && <span className="text-xs" style={{ color: 'var(--border-soft)' }}>No batches on file yet.</span>}
                  {batches.map(b => (
                    <button key={b} onClick={() => toggleBatch(b)}
                      className="px-2.5 py-1 rounded text-xs border"
                      style={{
                        borderColor: (editing.audience_config?.batches || []).includes(b) ? 'var(--accent2)' : 'var(--border)',
                        color: (editing.audience_config?.batches || []).includes(b) ? 'var(--accent2)' : 'var(--muted)',
                        background: (editing.audience_config?.batches || []).includes(b) ? 'rgba(var(--accent2-rgb), 0.1)' : 'transparent',
                      }}>
                      {b}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {editing.audience_type === 'custom' && (
              <div className="rounded-lg border p-3 space-y-3" style={{ borderColor: 'var(--border)' }}>
                <div>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--white-soft)' }}>Include by role</p>
                  <div className="flex flex-wrap gap-1.5">
                    {(['member', 'organizer', 'executive'] as const).map(r => (
                      <button key={r} onClick={() => toggleRole(r)} className="px-2.5 py-1 rounded text-xs border capitalize"
                        style={{
                          borderColor: (editing.audience_config?.roles || []).includes(r) ? 'var(--accent2)' : 'var(--border)',
                          color: (editing.audience_config?.roles || []).includes(r) ? 'var(--accent2)' : 'var(--muted)',
                          background: (editing.audience_config?.roles || []).includes(r) ? 'rgba(var(--accent2-rgb), 0.1)' : 'transparent',
                        }}>
                        {r === 'member' ? 'All members' : `${r}s`}
                      </button>
                    ))}
                  </div>
                </div>

                {batches.length > 0 && (
                  <div>
                    <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--white-soft)' }}>Include by batch</p>
                    <div className="flex flex-wrap gap-1.5">
                      {batches.map(b => (
                        <button key={b} onClick={() => toggleBatch(b)} className="px-2.5 py-1 rounded text-xs border"
                          style={{
                            borderColor: (editing.audience_config?.batches || []).includes(b) ? 'var(--accent2)' : 'var(--border)',
                            color: (editing.audience_config?.batches || []).includes(b) ? 'var(--accent2)' : 'var(--muted)',
                            background: (editing.audience_config?.batches || []).includes(b) ? 'rgba(var(--accent2-rgb), 0.1)' : 'transparent',
                          }}>
                          {b}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--white-soft)' }}>
                    Include specific members {(editing.audience_config?.member_ids || []).length > 0 && `(${editing.audience_config?.member_ids?.length} selected)`}
                  </p>
                  <input value={memberSearch} onChange={e => setMemberSearch(e.target.value)} placeholder="Search by name, email, or batch..."
                    className={inputClass + ' mb-2'} style={{ ...inputStyle, fontSize: 12 }} />
                  <div className="max-h-48 overflow-y-auto space-y-1 rounded-lg border p-2" style={{ borderColor: 'var(--border)' }}>
                    {filteredMembers.length === 0 && <p className="text-xs p-2" style={{ color: 'var(--border-soft)' }}>No members found.</p>}
                    {filteredMembers.slice(0, 200).map(m => (
                      <label key={m.id} className="flex items-center gap-2 text-xs px-2 py-1 rounded cursor-pointer hover:opacity-80" style={{ color: 'var(--white-soft)' }}>
                        <input type="checkbox" checked={(editing.audience_config?.member_ids || []).includes(m.id)} onChange={() => toggleCustomMember(m.id)} />
                        {m.full_name} <span style={{ color: 'var(--border-soft)' }}>· {m.email}{m.batch ? ` · ${m.batch}` : ''}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="flex gap-2 pb-8">
          <button onClick={save} disabled={saving}
            className="px-6 py-2.5 rounded-lg text-sm font-black disabled:opacity-50" style={{ background: 'var(--blue)', color: '#000', fontFamily: "'Orbitron', sans-serif" }}>
            {saving ? 'SAVING...' : 'SAVE SURVEY'}
          </button>
          <button onClick={closeEditor} className="px-6 py-2.5 rounded-lg text-sm" style={{ color: 'var(--muted)' }}>Cancel</button>
        </div>
      </div>
    )
  }

  // ── list view ──────────────────────────────────────────────
  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold" style={h}>Surveys</h1>
        <button onClick={openNew} className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-bold"
          style={{ background: 'var(--blue)', color: '#000' }}>
          <Plus size={15} /> New Survey
        </button>
      </div>

      {pageError && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)', border: '1px solid rgba(var(--danger-rgb), 0.3)' }}>
          {pageError}
        </div>
      )}

      {loading ? (
        <p style={{ color: 'var(--muted)' }}>Loading...</p>
      ) : surveys.length === 0 ? (
        <div className="rounded-xl border p-10 text-center" style={s}>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>No surveys yet. Create one to get started.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {surveys.map(sv => (
            <div key={sv.id} className="rounded-xl border p-4" style={s}>
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <div>
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <h3 className="font-bold text-sm" style={{ color: 'var(--white)' }}>{sv.title}</h3>
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{
                      background: sv.is_active ? 'rgba(var(--success-rgb), 0.1)' : 'rgba(var(--danger-rgb), 0.1)',
                      color: sv.is_active ? 'var(--success)' : 'var(--danger-soft)',
                    }}>{sv.is_active ? 'Active' : 'Inactive'}</span>
                    {sv.show_notification && (
                      <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>
                        <Bell size={10} /> Notify
                      </span>
                    )}
                    {sv.send_email && (
                      <span className="text-xs px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(var(--accent2-rgb), 0.1)', color: 'var(--accent2)' }}>
                        <Mail size={10} /> Email
                      </span>
                    )}
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(var(--warning-rgb), 0.1)', color: 'var(--warning)' }}>
                      {AUDIENCE_LABELS[sv.audience_type]}
                    </span>
                  </div>
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>{sv.questions?.length || 0} question{sv.questions?.length === 1 ? '' : 's'} · {sv.response_count || 0} response{sv.response_count === 1 ? '' : 's'}</p>
                </div>
                <div className="flex items-center gap-1.5 flex-wrap">
                  <button onClick={() => openResponses(sv)} title="View responses"
                    className="p-2 rounded-lg" style={{ background: 'rgba(var(--blue-rgb), 0.08)', color: 'var(--blue)' }}><BarChart3 size={14} /></button>
                  <button onClick={() => toggleActive(sv)} title={sv.is_active ? 'Deactivate' : 'Activate'}
                    className="p-2 rounded-lg" style={{ background: 'rgba(var(--muted-rgb), 0.08)', color: 'var(--muted)' }}>
                    {sv.is_active ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                  <button onClick={() => openEdit(sv)} title="Edit"
                    className="p-2 rounded-lg" style={{ background: 'rgba(var(--blue-rgb), 0.08)', color: 'var(--blue)' }}><Edit2 size={14} /></button>
                  <button onClick={() => remove(sv.id)} title="Delete"
                    className="p-2 rounded-lg" style={{ background: 'rgba(var(--danger-rgb), 0.08)', color: 'var(--danger-soft)' }}><Trash2 size={14} /></button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
