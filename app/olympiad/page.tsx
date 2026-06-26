'use client'
import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'
import { Trophy, Clock, Upload, CheckCircle, ChevronRight, BookOpen, ArrowLeft } from 'lucide-react'

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
}

type Phase = 'list' | 'register' | 'mcq' | 'done'

const MAX_ANSWER_SHEET_MB = 15
const MAX_ANSWER_SHEET_BYTES = MAX_ANSWER_SHEET_MB * 1024 * 1024
const ALLOWED_ANSWER_SHEET_TYPES = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif']

export default function OlympiadPage() {
  const [olympiads, setOlympiads] = useState<Olympiad[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Olympiad | null>(null)
  const [phase, setPhase] = useState<Phase>('list')
  const [form, setForm] = useState<Record<string, string>>({ college: 'Notre Dame College' })
  const [file, setFile] = useState<File | null>(null)
  const [fileError, setFileError] = useState('')
  const [uploadProgress, setUploadProgress] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({})
  const [mcqScore, setMcqScore] = useState(0)
  const [regId, setRegId] = useState('')

  useEffect(() => {
    fetch('/api/olympiad')
      .then(r => r.json())
      .then(data => { setOlympiads(Array.isArray(data) ? data : []); setLoading(false) })
      .catch(() => setLoading(false))
  }, [])

  const openRegister = (o: Olympiad) => {
    setSelected(o)
    setForm({ college: 'Notre Dame College' })
    setFile(null)
    setFileError('')
    setUploadProgress(0)
    setError('')
    setMcqAnswers({})
    setPhase('register')
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  // Client-side guard so students get instant feedback instead of waiting on
  // a network round-trip for a file that the server would reject anyway.
  const handleFileSelect = (f: File | null) => {
    setFileError('')
    if (!f) { setFile(null); return }
    if (f.size > MAX_ANSWER_SHEET_BYTES) {
      setFile(null)
      setFileError(`File too large. Maximum size is ${MAX_ANSWER_SHEET_MB}MB.`)
      return
    }
    if (f.type && !ALLOWED_ANSWER_SHEET_TYPES.includes(f.type)) {
      setFile(null)
      setFileError('Invalid file type. Please upload a JPG, PNG, WEBP, or HEIC image.')
      return
    }
    setFile(f)
  }

  // Uses XMLHttpRequest (instead of fetch) so we can report real upload
  // progress to the student while their answer sheet photo is sent to our
  // server, which then proxies it on to Hostinger.
  const uploadAnswerSheet = (f: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fd = new FormData()
      fd.append('file', f)

      const xhr = new XMLHttpRequest()

      xhr.upload.addEventListener('progress', (e) => {
        if (e.lengthComputable) {
          setUploadProgress(Math.round((e.loaded / e.total) * 100))
        }
      })

      xhr.addEventListener('load', () => {
        try {
          const data = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300 && data.url) {
            resolve(data.url)
          } else {
            reject(new Error(data.error || 'Upload failed'))
          }
        } catch {
          reject(new Error('Upload failed. Please try again.'))
        }
      })

      xhr.addEventListener('error', () => reject(new Error('Network error during upload.')))

      xhr.open('POST', '/api/olympiad-upload')
      xhr.send(fd)
    })
  }

  const submitRegistration = async () => {
    if (!selected) return
    setError('')

    if (!form.full_name?.trim()) return setError('Full name is required.')
    if (!form.phone?.trim()) return setError('Phone number is required.')
    for (const cf of selected.custom_fields || []) {
      if (cf.required && !form[cf.key]?.trim()) return setError(`"${cf.label}" is required.`)
    }
    if (selected.mode === 'photo_submit' && !file) {
      return setError('Please upload a photo of your answer sheet.')
    }

    setSubmitting(true)
    setUploadProgress(0)
    try {
      let answerSheetUrl = ''
      if (selected.mode === 'photo_submit' && file) {
        answerSheetUrl = await uploadAnswerSheet(file)
      }

      const custom_answers: Record<string, string> = {}
      for (const cf of selected.custom_fields || []) custom_answers[cf.key] = form[cf.key] || ''

      // Attach the logged-in member's id automatically, if any
      const { data: { user } } = await supabase.auth.getUser()

      const payload = {
        olympiad_id: selected.id,
        member_id: user?.id || null,
        full_name: form.full_name,
        phone: form.phone,
        email: form.email || null,
        college: selected.external_only ? (form.college || null) : (form.college || 'Notre Dame College'),
        college_roll: form.college_roll || null,
        group_name: form.group_name || null,
        batch: form.batch || null,
        custom_answers,
        answer_sheet_url: answerSheetUrl || null,
      }

      const regRes = await fetch('/api/olympiad-register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      })
      const regData = await regRes.json()
      if (!regRes.ok) throw new Error(regData.error || 'Registration failed.')

      setRegId(regData?.id || '')
      setPhase(selected.mode === 'online_mcq' ? 'mcq' : 'done')
    } catch (e: any) {
      setError(e.message || 'Something went wrong while submitting.')
    } finally {
      setSubmitting(false)
    }
  }

  const submitMCQ = async () => {
    if (!selected || !regId) return
    setSubmitting(true)
    try {
      let score = 0
      for (const q of selected.questions) {
        if (mcqAnswers[q.id] === q.correct_option_id) score++
      }
      const updRes = await fetch('/api/olympiad-register', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: regId, mcq_answers: mcqAnswers, mcq_score: score, final_score: score, review_status: 'reviewed' }),
      })
      if (!updRes.ok) {
        const d = await updRes.json()
        throw new Error(d.error || 'Could not submit your answers.')
      }
      setMcqScore(score)
      setPhase('done')
    } catch (e: any) {
      setError(e.message || 'Could not submit your answers.')
    } finally {
      setSubmitting(false)
    }
  }

  const inputStyle = { background: 'var(--bg2)', borderColor: 'var(--border)', color: 'var(--white)' }
  const inputClass = 'w-full px-4 py-2.5 rounded-lg text-sm outline-none border'

  const fmtDate = (d?: string) =>
    d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

  // ---------- LOADING ----------
  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ paddingTop: '72px' }}>
        <div
          className="w-8 h-8 rounded-full border-2 border-t-transparent animate-spin"
          style={{ borderColor: 'var(--blue)', borderTopColor: 'transparent' }}
        />
      </div>
    )
  }

  // ---------- LIST ----------
  if (phase === 'list') {
    return (
      <div className="min-h-screen relative z-10" style={{ paddingTop: '72px' }}>
        <div
          className="py-20 text-center border-b"
          style={{ background: 'linear-gradient(180deg, var(--bg2), var(--bg))', borderColor: 'var(--border)' }}
        >
          <div className="section-label justify-center mb-2">Competitions</div>
          <h1 className="text-4xl md:text-5xl font-black mb-4" style={{ fontFamily: "'Orbitron', sans-serif" }}>
            NDSC <span style={{ color: 'var(--blue)' }}>OLYMPIAD</span>
          </h1>
          <p className="text-sm max-w-lg mx-auto" style={{ color: 'var(--muted)' }}>
            Take part in NDSC science olympiads, test your knowledge, and win prizes at orientation.
          </p>
        </div>

        <div className="max-w-4xl mx-auto px-6 py-16 space-y-6">
          {olympiads.length === 0 && (
            <div className="text-center py-20" style={{ color: 'var(--muted)' }}>
              <Trophy size={48} className="mx-auto mb-4 opacity-20" />
              <p>No active olympiads right now. Check back soon.</p>
            </div>
          )}

          {olympiads.map((o) => (
            <div
              key={o.id}
              className="flex flex-col md:flex-row gap-6 p-6 rounded-xl border"
              style={{ borderColor: 'var(--border)', background: 'var(--card)' }}
            >
              {o.cover_image_url && (
                <div className="shrink-0 w-full md:w-32 h-32 rounded-lg overflow-hidden">
                  <img src={o.cover_image_url} alt={o.name} className="w-full h-full object-cover" />
                </div>
              )}
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-2 flex-wrap">
                  <span
                    className="text-xs font-bold px-2 py-0.5 rounded"
                    style={{
                      background: o.mode === 'online_mcq' ? '#00ff8022' : '#00d4ff22',
                      color: o.mode === 'online_mcq' ? '#00ff80' : 'var(--blue)',
                      fontFamily: "'Share Tech Mono', monospace",
                    }}
                  >
                    {o.mode === 'online_mcq' ? '● ONLINE MCQ' : '● PHOTO SUBMIT'}
                  </span>
                  {o.registration_deadline && (
                    <span className="text-xs flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                      <Clock size={12} /> Deadline: {fmtDate(o.registration_deadline)}
                    </span>
                  )}
                </div>
                <h3 className="font-black text-lg mb-2" style={{ fontFamily: "'Orbitron', sans-serif" }}>
                  {o.name}
                </h3>
                <p className="text-sm leading-relaxed mb-3" style={{ color: 'var(--muted)' }}>
                  {o.description}
                </p>
                {o.eligibility && <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>✅ {o.eligibility}</p>}
                {o.pdf_url && (
                  <a
                    href={o.pdf_url}
                    target="_blank"
                    className="text-xs font-medium hover:underline inline-block mt-1"
                    style={{ color: 'var(--blue)' }}
                  >
                    📄 Download question sheet
                  </a>
                )}
              </div>
              <div className="shrink-0 flex items-center">
                <button
                  onClick={() => openRegister(o)}
                  className="px-6 py-3 font-black text-sm tracking-widest rounded flex items-center gap-2"
                  style={{ background: 'var(--blue)', color: '#000', fontFamily: "'Orbitron', sans-serif" }}
                >
                  REGISTER <ChevronRight size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  // ---------- REGISTER ----------
  if (phase === 'register' && selected) {
    return (
      <div className="min-h-screen relative z-10" style={{ paddingTop: '72px' }}>
        <div className="max-w-2xl mx-auto px-6 py-12">
          <button
            onClick={() => setPhase('list')}
            className="text-sm mb-6 flex items-center gap-1"
            style={{ color: 'var(--muted)' }}
          >
            <ArrowLeft size={14} /> Back
          </button>

          <div className="mb-8 p-5 rounded-xl border" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
            <p className="text-xs mb-1" style={{ color: 'var(--blue)', fontFamily: "'Share Tech Mono', monospace" }}>
              REGISTERING FOR
            </p>
            <h2 className="text-xl font-black" style={{ fontFamily: "'Orbitron', sans-serif" }}>
              {selected.name}
            </h2>
            <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
              {selected.mode === 'online_mcq'
                ? `📝 The quiz (${selected.questions?.length || 0} questions) starts immediately after you register.`
                : '📸 Register and upload a photo of your completed answer sheet.'}
            </p>
          </div>

          <div className="space-y-4">
            <h3 className="font-bold text-sm" style={{ color: 'var(--blue)', fontFamily: "'Orbitron', sans-serif" }}>
              BASIC INFORMATION
            </h3>

            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Full Name *</label>
              <input
                type="text"
                placeholder="Your full name"
                value={form.full_name || ''}
                onChange={(e) => setForm((p) => ({ ...p, full_name: e.target.value }))}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Phone Number *</label>
              <input
                type="tel"
                placeholder="01XXXXXXXXX"
                value={form.phone || ''}
                onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Email (optional)</label>
              <input
                type="email"
                placeholder="example@email.com"
                value={form.email || ''}
                onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>
                {selected.external_only ? 'College / Institution' : 'College'}
              </label>
              <input
                type="text"
                placeholder={selected.external_only ? 'Your school/college name' : 'Notre Dame College'}
                value={form.college ?? (selected.external_only ? '' : 'Notre Dame College')}
                onChange={(e) => setForm((p) => ({ ...p, college: e.target.value }))}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>College Roll</label>
              <input
                type="text"
                value={form.college_roll || ''}
                onChange={(e) => setForm((p) => ({ ...p, college_roll: e.target.value }))}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Batch</label>
              <input
                type="text"
                placeholder="e.g. 28"
                value={form.batch || ''}
                onChange={(e) => setForm((p) => ({ ...p, batch: e.target.value }))}
                className={inputClass}
                style={inputStyle}
              />
            </div>

            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Group</label>
              <select
                value={form.group_name || ''}
                onChange={(e) => setForm((p) => ({ ...p, group_name: e.target.value }))}
                className={inputClass}
                style={inputStyle}
              >
                <option value="">Select group</option>
                <option>Science</option>
                <option>Commerce</option>
                <option>Arts</option>
              </select>
            </div>

            {selected.custom_fields?.length > 0 && (
              <>
                <h3 className="font-bold text-sm pt-2" style={{ color: 'var(--blue)', fontFamily: "'Orbitron', sans-serif" }}>
                  ADDITIONAL INFO
                </h3>
                {selected.custom_fields.map((cf) => (
                  <div key={cf.key}>
                    <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>
                      {cf.label}
                      {cf.required ? ' *' : ''}
                    </label>
                    {cf.type === 'textarea' ? (
                      <textarea
                        rows={3}
                        placeholder={`Write ${cf.label.toLowerCase()}...`}
                        value={form[cf.key] || ''}
                        onChange={(e) => setForm((p) => ({ ...p, [cf.key]: e.target.value }))}
                        className={inputClass + ' resize-none'}
                        style={inputStyle}
                      />
                    ) : (
                      <input
                        type={cf.type || 'text'}
                        placeholder={`Write ${cf.label.toLowerCase()}...`}
                        value={form[cf.key] || ''}
                        onChange={(e) => setForm((p) => ({ ...p, [cf.key]: e.target.value }))}
                        className={inputClass}
                        style={inputStyle}
                      />
                    )}
                  </div>
                ))}
              </>
            )}

            {selected.mode === 'photo_submit' && (
              <div>
                <h3 className="font-bold text-sm pt-2 mb-3" style={{ color: 'var(--blue)', fontFamily: "'Orbitron', sans-serif" }}>
                  ANSWER SHEET UPLOAD
                </h3>
                <label
                  className="flex flex-col items-center justify-center w-full h-36 rounded-xl border-2 border-dashed cursor-pointer"
                  style={{ borderColor: file ? 'var(--blue)' : 'var(--border)', background: 'var(--bg2)' }}
                >
                  <input
                    type="file"
                    accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
                    className="hidden"
                    disabled={submitting}
                    onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                  />
                  {file ? (
                    <div className="text-center">
                      <CheckCircle size={28} style={{ color: 'var(--blue)' }} className="mx-auto mb-1" />
                      <p className="text-sm font-medium" style={{ color: 'var(--blue)' }}>{file.name}</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                        {(file.size / (1024 * 1024)).toFixed(1)}MB — Tap again to change
                      </p>
                    </div>
                  ) : (
                    <div className="text-center">
                      <Upload size={28} className="mx-auto mb-2" style={{ color: 'var(--muted)' }} />
                      <p className="text-sm" style={{ color: 'var(--muted)' }}>Upload your answer sheet photo</p>
                      <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>JPG, PNG, WEBP — max {MAX_ANSWER_SHEET_MB}MB</p>
                    </div>
                  )}
                </label>

                {fileError && (
                  <p className="text-xs mt-2" style={{ color: '#ff7070' }}>{fileError}</p>
                )}

                {submitting && file && (
                  <div className="mt-3">
                    <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--muted)' }}>
                      <span>Uploading answer sheet...</span>
                      <span>{uploadProgress}%</span>
                    </div>
                    <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'var(--border)' }}>
                      <div className="h-full rounded-full transition-all duration-200"
                        style={{ width: `${uploadProgress}%`, background: 'var(--blue)' }} />
                    </div>
                  </div>
                )}
              </div>
            )}

            {error && (
              <div
                className="p-3 rounded-lg text-sm"
                style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', color: '#ff7070' }}
              >
                {error}
              </div>
            )}

            <button
              onClick={submitRegistration}
              disabled={submitting}
              className="w-full py-3 font-black text-sm tracking-widest rounded-lg disabled:opacity-50"
              style={{ background: 'var(--blue)', color: '#000', fontFamily: "'Orbitron', sans-serif" }}
            >
              {submitting
                ? 'SUBMITTING...'
                : selected.mode === 'online_mcq'
                ? 'REGISTER & START QUIZ →'
                : 'SUBMIT REGISTRATION →'}
            </button>
          </div>
        </div>
      </div>
    )
  }

  // ---------- MCQ ----------
  if (phase === 'mcq' && selected) {
    return (
      <div className="min-h-screen relative z-10" style={{ paddingTop: '72px' }}>
        <div className="max-w-2xl mx-auto px-6 py-12">
          <div
            className="flex items-center justify-between mb-8 p-4 rounded-xl border"
            style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}
          >
            <div>
              <h2 className="font-black text-lg" style={{ fontFamily: "'Orbitron', sans-serif" }}>{selected.name}</h2>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                {Object.keys(mcqAnswers).length} / {selected.questions.length} answered
              </p>
            </div>
            <BookOpen size={24} style={{ color: 'var(--blue)' }} />
          </div>

          <div className="space-y-6">
            {selected.questions.map((q, qi) => (
              <div
                key={q.id}
                className="p-5 rounded-xl border"
                style={{ background: 'var(--bg2)', borderColor: mcqAnswers[q.id] ? 'var(--blue)' : 'var(--border)' }}
              >
                <p className="font-semibold text-sm mb-4" style={{ color: 'var(--white)' }}>
                  <span style={{ color: 'var(--blue)' }}>Q{qi + 1}. </span>
                  {q.text}
                </p>
                <div className="space-y-2">
                  {q.options.map((opt) => (
                    <button
                      key={opt.id}
                      onClick={() => setMcqAnswers((p) => ({ ...p, [q.id]: opt.id }))}
                      className="w-full text-left px-4 py-2.5 rounded-lg text-sm border transition-all"
                      style={{
                        background: mcqAnswers[q.id] === opt.id ? 'rgba(0,212,255,0.15)' : 'transparent',
                        borderColor: mcqAnswers[q.id] === opt.id ? 'var(--blue)' : 'var(--border)',
                        color: mcqAnswers[q.id] === opt.id ? 'var(--blue)' : 'var(--muted)',
                      }}
                    >
                      {opt.text}
                    </button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {error && (
            <div
              className="mt-4 p-3 rounded-lg text-sm"
              style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', color: '#ff7070' }}
            >
              {error}
            </div>
          )}

          <button
            onClick={submitMCQ}
            disabled={submitting}
            className="w-full mt-8 py-3 font-black text-sm tracking-widest rounded-lg disabled:opacity-50"
            style={{ background: 'var(--blue)', color: '#000', fontFamily: "'Orbitron', sans-serif" }}
          >
            {submitting ? 'SUBMITTING...' : 'SUBMIT ANSWERS →'}
          </button>
        </div>
      </div>
    )
  }

  // ---------- DONE ----------
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ paddingTop: '72px' }}>
      <div className="text-center max-w-md px-6">
        <div
          className="w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6"
          style={{ background: 'rgba(0,212,255,0.1)', border: '2px solid rgba(0,212,255,0.3)' }}
        >
          <CheckCircle size={36} style={{ color: 'var(--blue)' }} />
        </div>
        <h2 className="text-2xl font-black mb-3" style={{ fontFamily: "'Orbitron', sans-serif" }}>SUBMITTED!</h2>

        {selected?.mode === 'online_mcq' && selected.show_results_immediately ? (
          <div className="p-4 rounded-xl border mb-6" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Your Score</p>
            <p className="text-4xl font-black mt-1" style={{ color: 'var(--blue)', fontFamily: "'Orbitron', sans-serif" }}>
              {mcqScore} / {selected.questions.length}
            </p>
          </div>
        ) : (
          <p className="text-sm mb-6" style={{ color: 'var(--muted)' }}>
            We've received your submission. Our organizers will review it and announce results soon.
          </p>
        )}

        <button
          onClick={() => {
            setPhase('list')
            setSelected(null)
          }}
          className="px-8 py-3 font-black text-sm rounded-lg"
          style={{ background: 'var(--blue)', color: '#000', fontFamily: "'Orbitron', sans-serif" }}
        >
          BACK TO OLYMPIADS
        </button>
      </div>
    </div>
  )
}
