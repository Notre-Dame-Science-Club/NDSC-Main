'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { Clock, ChevronRight, ChevronLeft, Upload, CheckCircle, AlertCircle, Camera } from 'lucide-react'

type QuestionType = 'mcq' | 'short' | 'photo'
type McqOption = { id: string; text: string }
type Question = { id: string; type: QuestionType; text: string; description?: string; options?: McqOption[]; correct_option_id?: string; marks?: number }
type RegField = { key: string; label: string; type: string; required: boolean }
type Olympiad = {
  id: string; name: string; description: string; cover_image_url?: string; pdf_url?: string
  mode: string; question_display: 'one_by_one' | 'all_at_once'; timer_minutes: number
  is_active: boolean; result_published: boolean; registration_deadline?: string; exam_date?: string
  eligibility?: string; external_only?: boolean; registration_fields: RegField[]; questions: Question[]
}

type Phase = 'list' | 'register' | 'dashboard' | 'exam' | 'done'
const MAX_PHOTO_MB = 15

export default function OlympiadPage() {
  const [olympiads, setOlympiads] = useState<Olympiad[]>([])
  const [loading, setLoading] = useState(true)
  const [selected, setSelected] = useState<Olympiad | null>(null)
  const [phase, setPhase] = useState<Phase>('list')
  const [form, setForm] = useState<Record<string, string>>({})
  const [error, setError] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [regId, setRegId] = useState('')
  const [regData, setRegData] = useState<any>(null)

  // Exam state
  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({})
  const [shortAnswers, setShortAnswers] = useState<Record<string, string>>({})
  const [photoFiles, setPhotoFiles] = useState<Record<string, File>>({})
  const [photoUploading, setPhotoUploading] = useState<Record<string, number>>({})
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [currentQ, setCurrentQ] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const [examStarted, setExamStarted] = useState(false)
  const timerRef = useRef<any>(null)

  // Answer sheet (offline photo)
  const [answerSheetFile, setAnswerSheetFile] = useState<File | null>(null)
  const [answerSheetProgress, setAnswerSheetProgress] = useState(0)
  const [fileError, setFileError] = useState('')

  const bg = 'var(--bg1, #061420)'
  const card = { background: '#061420', border: '1px solid #0f2a4a', borderRadius: 16 }
  const inp = { background: '#0a1f35', border: '1px solid #0f2a4a', color: '#e0f0ff', borderRadius: 8 }
  const inputCls = 'w-full px-4 py-2.5 text-sm outline-none'

  useEffect(() => {
    fetch('/api/olympiad').then(r => r.json()).then(d => { setOlympiads(Array.isArray(d) ? d : []); setLoading(false) }).catch(() => setLoading(false))
  }, [])

  const fmtDate = (d?: string) => d ? new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : ''

  const openRegister = (o: Olympiad) => {
    setSelected(o); setPhase('register'); setError(''); setForm({}); setFileError(''); setAnswerSheetFile(null)
  }

  // Timer
  const startTimer = useCallback((minutes: number) => {
    setTimeLeft(minutes * 60)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); handleAutoSubmit(); return 0 }
        return prev - 1
      })
    }, 1000)
  }, [])

  useEffect(() => () => clearInterval(timerRef.current), [])

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // Upload helper
  const uploadPhoto = (file: File, questionId: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fd = new FormData(); fd.append('file', file)
      const xhr = new XMLHttpRequest()
      xhr.upload.addEventListener('progress', e => {
        if (e.lengthComputable) setPhotoUploading(prev => ({ ...prev, [questionId]: Math.round(e.loaded / e.total * 100) }))
      })
      xhr.addEventListener('load', () => {
        try {
          const d = JSON.parse(xhr.responseText)
          if (xhr.status >= 200 && xhr.status < 300 && d.url) resolve(d.url)
          else reject(new Error(d.error || 'Upload failed'))
        } catch { reject(new Error('Upload failed')) }
      })
      xhr.addEventListener('error', () => reject(new Error('Network error')))
      xhr.open('POST', '/api/olympiad-upload')
      xhr.send(fd)
    })
  }

  const uploadAnswerSheet = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const fd = new FormData(); fd.append('file', file)
      const xhr = new XMLHttpRequest()
      xhr.upload.addEventListener('progress', e => { if (e.lengthComputable) setAnswerSheetProgress(Math.round(e.loaded / e.total * 100)) })
      xhr.addEventListener('load', () => {
        try { const d = JSON.parse(xhr.responseText); d.url ? resolve(d.url) : reject(new Error(d.error || 'Upload failed')) }
        catch { reject(new Error('Upload failed')) }
      })
      xhr.addEventListener('error', () => reject(new Error('Network error')))
      xhr.open('POST', '/api/olympiad-upload')
      xhr.send(fd)
    })
  }

  const handleFileSelect = (file: File | null) => {
    setFileError('')
    if (!file) { setAnswerSheetFile(null); return }
    if (file.size > MAX_PHOTO_MB * 1024 * 1024) { setFileError(`Max ${MAX_PHOTO_MB}MB allowed`); return }
    if (!['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/heic', 'image/heif'].includes(file.type)) { setFileError('Only JPG, PNG, WEBP allowed'); return }
    setAnswerSheetFile(file)
  }

  // REGISTER SUBMIT
  const submitRegistration = async () => {
    if (!selected) return
    setError('')
    if (!form.full_name?.trim()) return setError('Full name is required.')
    if (!form.phone?.trim()) return setError('Phone number is required.')
    if (!form.email?.trim()) return setError('Email is required.')
    if (!form.hsc_session?.trim()) return setError('HSC session is required.')
    if (!form.college?.trim()) return setError('College name is required.')
    if (!form.college_roll?.trim()) return setError('College roll is required.')
    for (const rf of selected.registration_fields || []) {
      if (rf.required && !form[rf.key]?.trim()) return setError(`"${rf.label}" is required.`)
    }
    setSubmitting(true)
    try {
      const extra: Record<string, string> = {}
      for (const rf of selected.registration_fields || []) extra[rf.key] = form[rf.key] || ''
      const payload = {
        olympiad_id: selected.id,
        full_name: form.full_name,
        phone: form.phone,
        email: form.email,
        hsc_session: form.hsc_session,
        college: form.college || 'Notre Dame College',
        college_roll: form.college_roll,
        custom_answers: extra,
      }
      const res = await fetch('/api/olympiad-register', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Registration failed.')
      setRegId(data.id || '')
      setRegData(data)
      setPhase('dashboard')
    } catch (e: any) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  // EXAM SUBMIT
  const submitExam = async (auto = false) => {
    if (!selected || !regId) return
    clearInterval(timerRef.current)
    setSubmitting(true)
    try {
      // Upload any pending photo answers
      const uploadedUrls = { ...photoUrls }
      for (const q of selected.questions.filter(q => q.type === 'photo')) {
        if (photoFiles[q.id] && !uploadedUrls[q.id]) {
          try { uploadedUrls[q.id] = await uploadPhoto(photoFiles[q.id], q.id) } catch { /* skip */ }
        }
      }
      const photoAnswers = Object.entries(uploadedUrls).map(([question_id, url]) => ({ question_id, url }))
      // MCQ auto-score
      let score = 0
      for (const q of selected.questions.filter(q => q.type === 'mcq')) {
        if (mcqAnswers[q.id] === q.correct_option_id) score += (q.marks || 1)
      }
      const res = await fetch('/api/olympiad-register', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: regId,
          mcq_answers: mcqAnswers,
          short_answers: shortAnswers,
          photo_answers: photoAnswers,
          mcq_score: score,
          exam_submitted_at: new Date().toISOString(),
          review_status: 'pending',
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Submit failed') }
      setPhase('done')
    } catch (e: any) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const handleAutoSubmit = () => submitExam(true)

  // Submit answer sheet (offline photo)
  const submitAnswerSheet = async () => {
    if (!selected || !regId) return
    if (!answerSheetFile) return setError('Please upload your answer sheet photo.')
    setSubmitting(true); setError('')
    try {
      const url = await uploadAnswerSheet(answerSheetFile)
      const res = await fetch('/api/olympiad-register', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: regId, answer_sheet_url: url, exam_submitted_at: new Date().toISOString(), review_status: 'pending' }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Submit failed') }
      setPhase('done')
    } catch (e: any) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const startExam = async () => {
    await fetch('/api/olympiad-register', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: regId, exam_started_at: new Date().toISOString() }) })
    setExamStarted(true)
    setCurrentQ(0)
    startTimer(selected!.timer_minutes || 60)
    setPhase('exam')
  }

  const hasOnlineQuestions = (o: Olympiad) => o.questions?.some(q => q.type === 'mcq' || q.type === 'short')
  const hasPhotoSubmit = (o: Olympiad) => o.questions?.some(q => q.type === 'photo') || o.pdf_url

  // ── LIST ────────────────────────────────────────────────────────────────────
  if (phase === 'list') return (
    <div className="min-h-screen py-16 px-4" style={{ background: bg }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-3" style={{ fontFamily: 'Orbitron, monospace', color: '#00d4ff' }}>NDSC Olympiads</h1>
          <p style={{ color: '#6a8faf' }}>Take part in NDSC science olympiads, test your knowledge, and win prizes.</p>
        </div>
        {loading && <p className="text-center" style={{ color: '#3d5a78' }}>Loading…</p>}
        {!loading && olympiads.length === 0 && <p className="text-center py-12" style={{ color: '#3d5a78' }}>No active olympiads right now. Check back soon.</p>}
        <div className="space-y-4">
          {olympiads.map(o => (
            <div key={o.id} className="flex gap-5 p-5" style={card}>
              {o.cover_image_url && <img src={o.cover_image_url} alt="" className="w-24 h-24 rounded-xl object-cover flex-shrink-0" />}
              <div className="flex-1">
                <h2 className="font-bold text-lg mb-1" style={{ color: '#e0f0ff' }}>{o.name}</h2>
                {o.description && <p className="text-sm mb-2" style={{ color: '#6a8faf' }}>{o.description}</p>}
                <div className="flex gap-4 text-xs flex-wrap" style={{ color: '#3d5a78' }}>
                  {o.exam_date && <span>Exam: {fmtDate(o.exam_date)}</span>}
                  {o.registration_deadline && <span>Register by: {fmtDate(o.registration_deadline)}</span>}
                  {o.eligibility && <span>Eligibility: {o.eligibility}</span>}
                  {o.timer_minutes && <span className="flex items-center gap-1"><Clock size={10} /> {o.timer_minutes} min</span>}
                  <span>{(o.questions || []).length} questions</span>
                </div>
              </div>
              <button onClick={() => openRegister(o)} className="self-center px-5 py-2.5 rounded-xl text-sm font-bold flex-shrink-0" style={{ background: 'linear-gradient(90deg,#00d4ff,#0070ff)', color: '#fff' }}>
                Register Now
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  )

  // ── REGISTER ────────────────────────────────────────────────────────────────
  if (phase === 'register' && selected) return (
    <div className="min-h-screen py-12 px-4" style={{ background: bg }}>
      <div className="max-w-lg mx-auto">
        <button onClick={() => setPhase('list')} className="text-sm mb-6 flex items-center gap-1" style={{ color: '#6a8faf' }}>← Back</button>
        <div className="p-6 space-y-4" style={card}>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Orbitron, monospace', color: '#00d4ff' }}>Register — {selected.name}</h2>
          {error && <div className="p-3 rounded-lg text-sm flex items-center gap-2" style={{ background: 'rgba(255,80,80,0.1)', border: '1px solid rgba(255,80,80,0.3)', color: '#ff7070' }}><AlertCircle size={14} />{error}</div>}

          {/* Mandatory fields */}
          {[
            { key: 'full_name', label: 'Full Name', type: 'text', placeholder: 'Your full name' },
            { key: 'phone', label: 'Phone Number', type: 'tel', placeholder: '01XXXXXXXXX' },
            { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
            { key: 'hsc_session', label: 'HSC Session', type: 'text', placeholder: 'e.g. 2025–26' },
            { key: 'college', label: 'College', type: 'text', placeholder: selected.external_only ? 'Your college name' : 'Notre Dame College' },
            { key: 'college_roll', label: 'College Roll', type: 'text', placeholder: 'Your college roll number' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>{f.label} *</label>
              <input type={f.type} className={inputCls} style={inp} placeholder={f.placeholder}
                value={form[f.key] || (f.key === 'college' && !selected.external_only ? 'Notre Dame College' : '')}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}

          {/* Custom registration fields */}
          {(selected.registration_fields || []).map(rf => (
            <div key={rf.key}>
              <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>{rf.label}{rf.required ? ' *' : ''}</label>
              {rf.type === 'textarea'
                ? <textarea rows={3} className={inputCls + ' resize-none'} style={inp} value={form[rf.key] || ''} onChange={e => setForm(p => ({ ...p, [rf.key]: e.target.value }))} />
                : <input type={rf.type} className={inputCls} style={inp} value={form[rf.key] || ''} onChange={e => setForm(p => ({ ...p, [rf.key]: e.target.value }))} />
              }
            </div>
          ))}

          <button onClick={submitRegistration} disabled={submitting} className="w-full py-3 rounded-xl font-bold text-sm" style={{ background: 'linear-gradient(90deg,#00d4ff,#0070ff)', color: '#fff', opacity: submitting ? 0.6 : 1 }}>
            {submitting ? 'Registering…' : 'Complete Registration →'}
          </button>
        </div>
      </div>
    </div>
  )

  // ── DASHBOARD ────────────────────────────────────────────────────────────────
  if (phase === 'dashboard' && selected) return (
    <div className="min-h-screen py-12 px-4" style={{ background: bg }}>
      <div className="max-w-lg mx-auto space-y-4">
        <div className="p-6" style={card}>
          <div className="flex items-center gap-2 mb-1">
            <CheckCircle size={18} style={{ color: '#00ff80' }} />
            <h2 className="font-bold text-lg" style={{ color: '#00ff80' }}>Registration Successful!</h2>
          </div>
          <p className="text-sm" style={{ color: '#6a8faf' }}>{selected.name}</p>
        </div>

        {hasOnlineQuestions(selected) && (
          <div className="p-6 space-y-3" style={card}>
            <h3 className="font-semibold" style={{ color: '#e0f0ff' }}>Start Online Exam</h3>
            <p className="text-sm" style={{ color: '#6a8faf' }}>
              {selected.questions.length} questions · {selected.timer_minutes} minutes · {selected.question_display === 'one_by_one' ? 'One question at a time' : 'All questions at once'}
            </p>
            <p className="text-xs" style={{ color: '#3d5a78' }}>Once you start, the timer begins. It will auto-submit when time runs out.</p>
            <button onClick={startExam} className="w-full py-3 rounded-xl font-bold text-sm" style={{ background: 'linear-gradient(90deg,#00d4ff,#0070ff)', color: '#fff' }}>
              Start Exam →
            </button>
          </div>
        )}

        {hasPhotoSubmit(selected) && (
          <div className="p-6 space-y-3" style={card}>
            <h3 className="font-semibold" style={{ color: '#e0f0ff' }}>Submit Answer Sheet</h3>
            <p className="text-sm" style={{ color: '#6a8faf' }}>Upload a clear photo of your handwritten answer sheet.</p>
            {selected.pdf_url && (
              <a href={selected.pdf_url} target="_blank" className="text-sm underline flex items-center gap-1" style={{ color: '#00d4ff' }}>
                <Upload size={13} /> View Question Paper (PDF)
              </a>
            )}
            <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed cursor-pointer" style={{ borderColor: answerSheetFile ? '#00ff80' : '#0f2a4a', color: answerSheetFile ? '#00ff80' : '#3d5a78' }}>
              <Camera size={24} />
              <span className="text-sm">{answerSheetFile ? answerSheetFile.name : 'Tap to choose / take photo'}</span>
              {answerSheetFile && <span className="text-xs">{(answerSheetFile.size / 1024 / 1024).toFixed(1)}MB</span>}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFileSelect(e.target.files?.[0] || null)} />
            </label>
            {fileError && <p className="text-xs" style={{ color: '#ff7070' }}>{fileError}</p>}
            {submitting && answerSheetProgress > 0 && (
              <div>
                <div className="flex justify-between text-xs mb-1" style={{ color: '#6a8faf' }}><span>Uploading…</span><span>{answerSheetProgress}%</span></div>
                <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: '#0f2a4a' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${answerSheetProgress}%`, background: '#00d4ff' }} />
                </div>
              </div>
            )}
            {error && <p className="text-xs" style={{ color: '#ff7070' }}>{error}</p>}
            <button onClick={submitAnswerSheet} disabled={submitting || !answerSheetFile} className="w-full py-3 rounded-xl font-bold text-sm" style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)', opacity: submitting || !answerSheetFile ? 0.5 : 1 }}>
              {submitting ? 'Uploading…' : 'Submit Answer Sheet →'}
            </button>
          </div>
        )}
      </div>
    </div>
  )

  // ── EXAM ─────────────────────────────────────────────────────────────────────
  if (phase === 'exam' && selected) {
    const questions = selected.questions
    const isOneByOne = selected.question_display === 'one_by_one'
    const currentQuestion = questions[currentQ]

    const renderQuestion = (q: Question, idx: number) => (
      <div key={q.id} className="p-5 rounded-xl space-y-3" style={{ background: '#0a1f35', border: '1px solid #0f2a4a' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <span className="text-xs px-2 py-0.5 rounded-full mr-2" style={{ background: q.type === 'mcq' ? '#00d4ff18' : q.type === 'short' ? '#00ff8018' : '#ffb34718', color: q.type === 'mcq' ? '#00d4ff' : q.type === 'short' ? '#00ff80' : '#ffb347' }}>
              Q{idx + 1} · {q.type === 'mcq' ? 'MCQ' : q.type === 'short' ? 'Short Answer' : 'Photo Upload'} · {q.marks || 1} mark{(q.marks || 1) > 1 ? 's' : ''}
            </span>
            <p className="mt-2 text-sm font-medium" style={{ color: '#e0f0ff' }}>{q.text}</p>
            {q.description && <p className="text-xs mt-1" style={{ color: '#6a8faf' }}>{q.description}</p>}
          </div>
        </div>

        {q.type === 'mcq' && (
          <div className="space-y-2">
            {(q.options || []).map(o => (
              <label key={o.id} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer" style={{ background: mcqAnswers[q.id] === o.id ? 'rgba(0,212,255,0.12)' : 'rgba(255,255,255,0.02)', border: `1px solid ${mcqAnswers[q.id] === o.id ? '#00d4ff' : '#0f2a4a'}` }}>
                <input type="radio" name={`q-${q.id}`} checked={mcqAnswers[q.id] === o.id} onChange={() => setMcqAnswers(p => ({ ...p, [q.id]: o.id }))} style={{ accentColor: '#00d4ff' }} />
                <span className="text-sm" style={{ color: '#e0f0ff' }}>{o.text}</span>
              </label>
            ))}
          </div>
        )}

        {q.type === 'short' && (
          <textarea rows={3} className="w-full px-4 py-3 rounded-lg text-sm outline-none resize-none" style={inp}
            placeholder="Type your answer here…"
            value={shortAnswers[q.id] || ''}
            onChange={e => setShortAnswers(p => ({ ...p, [q.id]: e.target.value }))} />
        )}

        {q.type === 'photo' && (
          <div>
            <label className="flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed cursor-pointer" style={{ borderColor: photoUrls[q.id] ? '#00ff80' : photoFiles[q.id] ? '#00d4ff' : '#0f2a4a', color: '#6a8faf' }}>
              <Camera size={20} />
              <span className="text-xs">{photoUrls[q.id] ? '✓ Uploaded' : photoFiles[q.id] ? photoFiles[q.id].name : 'Tap to upload photo answer'}</span>
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={async e => {
                const file = e.target.files?.[0]
                if (!file) return
                setPhotoFiles(p => ({ ...p, [q.id]: file }))
                try {
                  const url = await uploadPhoto(file, q.id)
                  setPhotoUrls(p => ({ ...p, [q.id]: url }))
                } catch { /* will retry on submit */ }
              }} />
            </label>
            {photoUploading[q.id] != null && !photoUrls[q.id] && (
              <div className="mt-2">
                <div className="flex justify-between text-xs mb-1" style={{ color: '#6a8faf' }}><span>Uploading…</span><span>{photoUploading[q.id]}%</span></div>
                <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: '#0f2a4a' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${photoUploading[q.id]}%`, background: '#00d4ff' }} />
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    )

    return (
      <div className="min-h-screen py-8 px-4" style={{ background: bg }}>
        <div className="max-w-2xl mx-auto">
          {/* Timer bar */}
          <div className="sticky top-4 z-10 flex items-center justify-between px-5 py-3 rounded-xl mb-6" style={{ background: '#061420', border: '1px solid #0f2a4a' }}>
            <span className="font-semibold text-sm" style={{ color: '#e0f0ff' }}>{selected.name}</span>
            <div className="flex items-center gap-2">
              <Clock size={14} style={{ color: timeLeft < 300 ? '#ff7070' : '#00d4ff' }} />
              <span className="font-mono text-lg font-bold" style={{ color: timeLeft < 300 ? '#ff7070' : '#00d4ff' }}>{fmtTime(timeLeft)}</span>
            </div>
            {!isOneByOne && (
              <button onClick={() => submitExam()} disabled={submitting} className="px-4 py-1.5 rounded-lg text-sm font-bold" style={{ background: 'linear-gradient(90deg,#00d4ff,#0070ff)', color: '#fff', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            )}
          </div>

          {/* Progress */}
          {isOneByOne && (
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1" style={{ color: '#3d5a78' }}>
                <span>Question {currentQ + 1} of {questions.length}</span>
                <span>{Math.round((currentQ + 1) / questions.length * 100)}% complete</span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: '#0f2a4a' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(currentQ + 1) / questions.length * 100}%`, background: '#00d4ff' }} />
              </div>
            </div>
          )}

          {error && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(255,80,80,0.1)', color: '#ff7070' }}>{error}</div>}

          {/* Questions */}
          {isOneByOne ? (
            <div className="space-y-4">
              {renderQuestion(currentQuestion, currentQ)}
              <div className="flex justify-between gap-3 mt-4">
                <button onClick={() => setCurrentQ(p => Math.max(0, p - 1))} disabled={currentQ === 0} className="px-4 py-2 rounded-lg text-sm flex items-center gap-1" style={{ border: '1px solid #0f2a4a', color: '#6a8faf', opacity: currentQ === 0 ? 0.4 : 1 }}>
                  <ChevronLeft size={14} /> Previous
                </button>
                {currentQ < questions.length - 1 ? (
                  <button onClick={() => setCurrentQ(p => p + 1)} className="px-4 py-2 rounded-lg text-sm flex items-center gap-1 font-medium" style={{ background: 'rgba(0,212,255,0.12)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}>
                    Next <ChevronRight size={14} />
                  </button>
                ) : (
                  <button onClick={() => submitExam()} disabled={submitting} className="px-5 py-2 rounded-lg text-sm font-bold" style={{ background: 'linear-gradient(90deg,#00d4ff,#0070ff)', color: '#fff', opacity: submitting ? 0.6 : 1 }}>
                    {submitting ? 'Submitting…' : 'Submit Exam →'}
                  </button>
                )}
              </div>
              {/* Jump navigator */}
              <div className="flex flex-wrap gap-1.5 mt-4">
                {questions.map((q, i) => (
                  <button key={q.id} onClick={() => setCurrentQ(i)} className="w-8 h-8 rounded-lg text-xs font-medium"
                    style={{ background: i === currentQ ? '#00d4ff' : (mcqAnswers[q.id] || shortAnswers[q.id] || photoUrls[q.id]) ? 'rgba(0,255,128,0.15)' : '#0a1f35', color: i === currentQ ? '#000' : (mcqAnswers[q.id] || shortAnswers[q.id] || photoUrls[q.id]) ? '#00ff80' : '#3d5a78', border: '1px solid #0f2a4a' }}>
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, i) => renderQuestion(q, i))}
              <button onClick={() => submitExam()} disabled={submitting} className="w-full py-3 rounded-xl font-bold text-sm mt-4" style={{ background: 'linear-gradient(90deg,#00d4ff,#0070ff)', color: '#fff', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Submitting…' : 'Submit Exam →'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── DONE ─────────────────────────────────────────────────────────────────────
  if (phase === 'done') return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4" style={{ background: bg }}>
      <div className="max-w-md w-full p-8 text-center space-y-4" style={card}>
        <CheckCircle size={48} className="mx-auto" style={{ color: '#00ff80' }} />
        <h2 className="text-xl font-bold" style={{ fontFamily: 'Orbitron, monospace', color: '#00ff80' }}>Submitted!</h2>
        <p className="text-sm" style={{ color: '#6a8faf' }}>Your response has been recorded. Results will be announced by the organizers.</p>
        <button onClick={() => { setPhase('list'); setSelected(null); setRegId(''); setMcqAnswers({}); setShortAnswers({}); setPhotoFiles({}); setPhotoUrls({}); setAnswerSheetFile(null) }}
          className="px-6 py-2.5 rounded-xl text-sm font-medium" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.2)' }}>
          Back to Olympiads
        </button>
      </div>
    </div>
  )

  return null
}
