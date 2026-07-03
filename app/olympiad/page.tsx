'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Clock, ChevronRight, ChevronLeft, Upload, CheckCircle, AlertCircle, Camera } from 'lucide-react'

type QuestionType = 'mcq' | 'short' | 'photo'
type McqOption = { id: string; text: string }
type Question = { id: string; type: QuestionType; text: string; description?: string; options?: McqOption[]; correct_option_id?: string; marks?: number; subject_id?: string }
type RegField = { key: string; label: string; type: string; required: boolean }
type Olympiad = {
  id: string; name: string; description: string; cover_image_url?: string; pdf_url?: string
  mode: string; exam_type: 'photo_only' | 'live_only' | 'mixed'
  question_display: 'one_by_one' | 'all_at_once'; timer_minutes: number
  is_active: boolean; result_published: boolean; annotations_published?: boolean
  registration_deadline?: string; exam_date?: string
  eligibility?: string; external_only?: boolean; registration_fields: RegField[]; questions: Question[]
  scheduled_start_at?: string | null; scheduled_end_at?: string | null
}

type Phase = 'list' | 'register' | 'dashboard' | 'exam' | 'done' | 'result'
const MAX_PHOTO_MB = 15

export default function OlympiadPage() {
  const router = useRouter()
  const [olympiads, setOlympiads] = useState<Olympiad[]>([])
  // New unified source: one card per Activity primary field that has an
  // open online leaf underneath it. This is what the list view now shows —
  // "Olympiad" is just this filtered view into the Activity system, not a
  // separately-registered thing anymore. `olympiads` above is kept loaded
  // purely so an already-in-progress legacy registration (old saved `reg`
  // links, or a direct `?id=` link) can still resume and finish here.
  const [onlineCards, setOnlineCards] = useState<any[]>([])
  const [cardsLoading, setCardsLoading] = useState(true)
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

  const [restoring, setRestoring] = useState(true)

  const bg = 'var(--bg1, var(--surface-deep))'
  const card = { background: 'var(--surface-deep)', border: '1px solid var(--border)', borderRadius: 16 }
  const inp = { background: 'var(--surface-alt)', border: '1px solid var(--border)', color: 'var(--white-soft)', borderRadius: 8 }
  const inputCls = 'w-full px-4 py-2.5 text-sm outline-none'

  const STORAGE_KEY = 'ndsc_olympiad_reg_id'

  // Decide which phase to land a returning student on, based on what their
  // registration record already shows — this is what makes a page refresh
  // (or coming back later on the same device) not lose their progress.
  const phaseForRegistration = (reg: any, oly: Olympiad): Phase => {
    if (reg.exam_submitted_at || reg.answer_sheet_url) {
      return oly.result_published ? 'result' : 'done'
    }
    if (reg.exam_started_at) return 'exam'
    return 'dashboard'
  }

  useEffect(() => {
    fetch('/api/olympiad').then(r => r.json()).then(d => { setOlympiads(Array.isArray(d) ? d : []) }).catch(() => {}).finally(() => setLoading(false))
    fetch('/api/activity-online-categories-public').then(r => r.json()).then(d => { setOnlineCards(Array.isArray(d) ? d : []) }).catch(() => {}).finally(() => setCardsLoading(false))

    // Resume a previous session if we have a registration id saved — check
    // the URL first (so a shared/bookmarked link works), then localStorage.
    const params = new URLSearchParams(window.location.search)
    const savedId = params.get('reg') || localStorage.getItem(STORAGE_KEY)
    const directOlympiadId = params.get('id')

    if (!savedId) {
      // No registration to resume — but if we were linked here with a
      // specific olympiad id (e.g. from an Activity registration category
      // that's really an online-submission round), jump straight to that
      // olympiad's registration form instead of showing the full list.
      // This is what makes the Activity ↔ Olympiad auto-link actually work
      // end-to-end: Activity hands off here, and the person lands directly
      // on the right registration form rather than having to find it again.
      if (directOlympiadId) {
        fetch('/api/olympiad').then(r => r.json()).then(list => {
          const found = Array.isArray(list) ? list.find((o: Olympiad) => o.id === directOlympiadId) : null
          if (found) openRegister(found)
        }).catch(() => {}).finally(() => setRestoring(false))
        return
      }
      setRestoring(false)
      return
    }

    fetch(`/api/olympiad-register?id=${savedId}`)
      .then(async r => {
        if (!r.ok) throw new Error('not found')
        return r.json()
      })
      .then(({ registration, olympiad }) => {
        setRegId(registration.id)
        setRegData(registration)
        setSelected(olympiad)
        localStorage.setItem(STORAGE_KEY, registration.id)
        const nextPhase = phaseForRegistration(registration, olympiad)
        setPhase(nextPhase)
        if (nextPhase === 'exam' && registration.exam_started_at) {
          // Resume the timer from where it should be based on elapsed time,
          // not a fresh full duration — otherwise refreshing would let a
          // student extend their time indefinitely.
          const startedAt = new Date(registration.exam_started_at).getTime()
          const elapsedSec = Math.floor((Date.now() - startedAt) / 1000)
          const totalSec = (olympiad.timer_minutes || 60) * 60
          const remaining = Math.max(0, totalSec - elapsedSec)
          if (remaining <= 0) {
            // Time's already up while the student was away — submit
            // immediately using the freshly-fetched registration/olympiad
            // data directly (not via submitExam(), which would read this
            // effect's stale closed-over `selected`/`regId` state — both
            // still null/empty at this point since this runs before the
            // setSelected/setRegId calls above have actually committed).
            setTimeLeft(0)
            const photoAnswers = Object.entries(
              (registration.photo_answers || []).reduce((acc: any, pa: any) => ({ ...acc, [pa.question_id]: pa.url }), {})
            ).map(([question_id, url]) => ({ question_id, url }))
            let score = 0
            for (const q of olympiad.questions.filter((q: any) => q.type === 'mcq')) {
              if ((registration.mcq_answers || {})[q.id] === q.correct_option_id) score += (q.marks || 1)
            }
            fetch('/api/olympiad-register', {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                id: registration.id,
                mcq_answers: registration.mcq_answers || {},
                short_answers: registration.short_answers || {},
                photo_answers: photoAnswers,
                mcq_score: score,
                exam_submitted_at: new Date().toISOString(),
                review_status: 'pending',
              }),
            }).then(() => setPhase(olympiad.result_published ? 'result' : 'done')).catch(() => {})
          } else {
            setMcqAnswers(registration.mcq_answers || {})
            setShortAnswers(registration.short_answers || {})
            const restoredPhotoUrls: Record<string, string> = {}
            for (const pa of registration.photo_answers || []) restoredPhotoUrls[pa.question_id] = pa.url
            setPhotoUrls(restoredPhotoUrls)
            startTimer(Math.ceil(remaining / 60))
            setTimeLeft(remaining)
          }
        }
      })
      .catch(() => {
        // Saved id is stale/invalid — clear it and just show the list normally.
        localStorage.removeItem(STORAGE_KEY)
      })
      .finally(() => setRestoring(false))
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

  // Autosave in-progress MCQ/short answers every 15s while the exam is
  // active, so a refresh or closed tab mid-exam doesn't lose what the
  // student has already answered (the timer itself already resumes
  // correctly from exam_started_at — this just makes the answers resume too).
  useEffect(() => {
    if (phase !== 'exam' || !regId) return
    const interval = setInterval(() => {
      const photoAnswers = Object.entries(photoUrls).map(([question_id, url]) => ({ question_id, url }))
      fetch('/api/olympiad-register', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: regId, mcq_answers: mcqAnswers, short_answers: shortAnswers, photo_answers: photoAnswers }),
      }).catch(() => { /* best-effort — next interval will retry */ })
    }, 15000)
    return () => clearInterval(interval)
  }, [phase, regId, mcqAnswers, shortAnswers, photoUrls])

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
    if (!/^\d+$/.test(form.college_roll.trim())) return setError('College roll number must contain digits only.')
    const isNDC = (form.college || 'Notre Dame College').trim().toLowerCase() === 'notre dame college'
    if (isNDC && form.college_roll.trim().length !== 8) {
      return setError('Notre Dame College roll numbers are exactly 8 digits.')
    }
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
      if (data.id) {
        localStorage.setItem(STORAGE_KEY, data.id)
        const url = new URL(window.location.href)
        url.searchParams.set('reg', data.id)
        window.history.replaceState({}, '', url.toString())
      }
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
      // MCQ auto-score, plus build a per-question breakdown now while we have
      // everything in memory — this is what the student's result page will
      // read from once the admin publishes results, so they see exactly
      // which questions they got right/wrong, not just a total.
      let score = 0
      const questionResults = selected.questions.map(q => {
        if (q.type === 'mcq') {
          const isCorrect = mcqAnswers[q.id] === q.correct_option_id
          if (isCorrect) score += (q.marks || 1)
          const chosen = (q.options || []).find(o => o.id === mcqAnswers[q.id])
          const correct = (q.options || []).find(o => o.id === q.correct_option_id)
          return {
            question_id: q.id, question_text: q.text, type: q.type,
            student_answer: chosen?.text ?? null, correct_answer: correct?.text ?? null,
            is_correct: isCorrect, marks_awarded: isCorrect ? (q.marks || 1) : 0, marks_possible: q.marks || 1,
          }
        }
        if (q.type === 'short') {
          return {
            question_id: q.id, question_text: q.text, type: q.type,
            student_answer: shortAnswers[q.id] || null, correct_answer: null,
            is_correct: null, marks_awarded: null, marks_possible: q.marks || 1,
          }
        }
        // photo
        return {
          question_id: q.id, question_text: q.text, type: q.type,
          student_answer: uploadedUrls[q.id] || null, correct_answer: null,
          is_correct: null, marks_awarded: null, marks_possible: q.marks || 1,
        }
      })
      const res = await fetch('/api/olympiad-register', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: regId,
          mcq_answers: mcqAnswers,
          short_answers: shortAnswers,
          photo_answers: photoAnswers,
          mcq_score: score,
          question_results: questionResults,
          exam_submitted_at: new Date().toISOString(),
          review_status: 'pending',
        }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error || 'Submit failed') }
      setRegData((prev: any) => ({ ...prev, mcq_answers: mcqAnswers, short_answers: shortAnswers, photo_answers: photoAnswers, mcq_score: score, question_results: questionResults, exam_submitted_at: new Date().toISOString() }))
      setPhase(selected.result_published ? 'result' : 'done')
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
      setRegData((prev: any) => ({ ...prev, answer_sheet_url: url, exam_submitted_at: new Date().toISOString() }))
      setPhase('done')
    } catch (e: any) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const startExam = async () => {
    // Phase D: respect admin-set scheduling, if any.
    if (selected?.scheduled_start_at && new Date(selected.scheduled_start_at) > new Date()) {
      setError(`This exam hasn't started yet. It opens at ${new Date(selected.scheduled_start_at).toLocaleString()}.`)
      return
    }
    if (selected?.scheduled_end_at && new Date(selected.scheduled_end_at) < new Date()) {
      setError('The exam window has closed.')
      return
    }
    await fetch('/api/olympiad-register', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: regId, exam_started_at: new Date().toISOString() }) })
    setExamStarted(true)
    setCurrentQ(0)
    startTimer(selected!.timer_minutes || 60)
    setPhase('exam')
  }

  // exam_type is the admin's explicit choice and takes priority; if it's not
  // set (older olympiads created before this field existed default to
  // 'mixed'), fall back to inferring from the actual question mix so nothing
  // that worked before suddenly breaks.
  const hasOnlineQuestions = (o: Olympiad) => {
    if (o.exam_type === 'photo_only') return false
    if (o.exam_type === 'live_only' || o.exam_type === 'mixed') return o.questions?.some(q => q.type === 'mcq' || q.type === 'short') ?? false
    return o.questions?.some(q => q.type === 'mcq' || q.type === 'short')
  }
  const hasPhotoSubmit = (o: Olympiad) => {
    if (o.exam_type === 'live_only') return false
    if (o.exam_type === 'photo_only' || o.exam_type === 'mixed') return true
    return o.questions?.some(q => q.type === 'photo') || !!o.pdf_url
  }

  // ── RESTORING ────────────────────────────────────────────────────────────────
  if (restoring) return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: bg }}>
      <p style={{ color: 'var(--border-soft)' }}>Loading…</p>
    </div>
  )

  // ── LIST ────────────────────────────────────────────────────────────────────
  if (phase === 'list') return (
    <div className="min-h-screen py-16 px-4" style={{ background: bg }}>
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-3xl font-bold mb-3" style={{ fontFamily: 'Orbitron, monospace', color: 'var(--blue)' }}>NDSC Olympiads</h1>
          <p style={{ color: 'var(--muted)' }}>Take part in NDSC science olympiads, test your knowledge, and win prizes.</p>
        </div>
        {cardsLoading && <p className="text-center" style={{ color: 'var(--border-soft)' }}>Loading…</p>}
        {!cardsLoading && onlineCards.length === 0 && <p className="text-center py-12" style={{ color: 'var(--border-soft)' }}>No online olympiad rounds open right now. Check back soon.</p>}
        <div className="space-y-4">
          {onlineCards.map(c => (
            <div key={c.category_id} className="flex gap-5 p-5" style={card}>
              {c.cover_image_url && <img src={c.cover_image_url} alt="" className="w-24 h-24 rounded-xl object-cover flex-shrink-0" />}
              <div className="flex-1">
                <p className="text-xs mb-1" style={{ color: 'var(--border-soft)' }}>{c.session_title}</p>
                <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--white-soft)' }}>{c.name}</h2>
                {c.description && <p className="text-sm" style={{ color: 'var(--muted)' }}>{c.description}</p>}
              </div>
              <button
                onClick={() => router.push(`/activities/${c.session_slug}/register?start=${c.category_id}`)}
                className="self-center px-5 py-2.5 rounded-xl text-sm font-bold flex-shrink-0"
                style={{ background: 'linear-gradient(90deg,var(--blue),var(--blue2))', color: '#fff' }}>
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
        <button onClick={() => setPhase('list')} className="text-sm mb-6 flex items-center gap-1" style={{ color: 'var(--muted)' }}>← Back</button>
        <div className="p-6 space-y-4" style={card}>
          <h2 className="text-xl font-bold" style={{ fontFamily: 'Orbitron, monospace', color: 'var(--blue)' }}>Register — {selected.name}</h2>
          {error && <div className="p-3 rounded-lg text-sm flex items-center gap-2" style={{ background: 'rgba(var(--danger-rgb), 0.1)', border: '1px solid rgba(var(--danger-rgb), 0.3)', color: 'var(--danger-soft)' }}><AlertCircle size={14} />{error}</div>}

          {/* Mandatory fields */}
          {[
            { key: 'full_name', label: 'Full Name', type: 'text', placeholder: 'Your full name' },
            { key: 'phone', label: 'Phone Number', type: 'tel', placeholder: '01XXXXXXXXX' },
            { key: 'email', label: 'Email', type: 'email', placeholder: 'you@example.com' },
            { key: 'hsc_session', label: 'HSC Session', type: 'text', placeholder: 'e.g. 2025–26' },
            { key: 'college', label: 'College', type: 'text', placeholder: selected.external_only ? 'Your college name' : 'Notre Dame College' },
            { key: 'college_roll', label: 'College Roll', type: 'text', placeholder: 'e.g. 24010123 (8 digits for NDC)' },
          ].map(f => (
            <div key={f.key}>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>{f.label} *</label>
              <input type={f.type} className={inputCls} style={inp} placeholder={f.placeholder}
                value={form[f.key] || (f.key === 'college' && !selected.external_only ? 'Notre Dame College' : '')}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}

          {/* Custom registration fields */}
          {(selected.registration_fields || []).map(rf => (
            <div key={rf.key}>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>{rf.label}{rf.required ? ' *' : ''}</label>
              {rf.type === 'textarea'
                ? <textarea rows={3} className={inputCls + ' resize-none'} style={inp} value={form[rf.key] || ''} onChange={e => setForm(p => ({ ...p, [rf.key]: e.target.value }))} />
                : <input type={rf.type} className={inputCls} style={inp} value={form[rf.key] || ''} onChange={e => setForm(p => ({ ...p, [rf.key]: e.target.value }))} />
              }
            </div>
          ))}

          <button onClick={submitRegistration} disabled={submitting} className="w-full py-3 rounded-xl font-bold text-sm" style={{ background: 'linear-gradient(90deg,var(--blue),var(--blue2))', color: '#fff', opacity: submitting ? 0.6 : 1 }}>
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
            <CheckCircle size={18} style={{ color: 'var(--success)' }} />
            <h2 className="font-bold text-lg" style={{ color: 'var(--success)' }}>Registration Successful!</h2>
          </div>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{selected.name}</p>
        </div>

        {hasOnlineQuestions(selected) && (
          <div className="p-6 space-y-3" style={card}>
            <h3 className="font-semibold" style={{ color: 'var(--white-soft)' }}>Start Online Exam</h3>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              {selected.questions.length} questions · {selected.timer_minutes} minutes · {selected.question_display === 'one_by_one' ? 'One question at a time' : 'All questions at once'}
            </p>
            <p className="text-xs" style={{ color: 'var(--border-soft)' }}>Once you start, the timer begins. It will auto-submit when time runs out.</p>
            <button onClick={startExam} className="w-full py-3 rounded-xl font-bold text-sm" style={{ background: 'linear-gradient(90deg,var(--blue),var(--blue2))', color: '#fff' }}>
              Start Exam →
            </button>
          </div>
        )}

        {hasPhotoSubmit(selected) && (
          <div className="p-6 space-y-3" style={card}>
            <h3 className="font-semibold" style={{ color: 'var(--white-soft)' }}>Submit Answer Sheet</h3>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>Upload a clear photo of your handwritten answer sheet.</p>
            {selected.pdf_url && (
              <a href={selected.pdf_url} target="_blank" className="text-sm underline flex items-center gap-1" style={{ color: 'var(--blue)' }}>
                <Upload size={13} /> View Question Paper (PDF)
              </a>
            )}
            <label className="flex flex-col items-center justify-center gap-2 py-6 rounded-xl border-2 border-dashed cursor-pointer" style={{ borderColor: answerSheetFile ? 'var(--success)' : 'var(--border)', color: answerSheetFile ? 'var(--success)' : 'var(--border-soft)' }}>
              <Camera size={24} />
              <span className="text-sm">{answerSheetFile ? answerSheetFile.name : 'Tap to choose / take photo'}</span>
              {answerSheetFile && <span className="text-xs">{(answerSheetFile.size / 1024 / 1024).toFixed(1)}MB</span>}
              <input type="file" accept="image/*" capture="environment" className="hidden" onChange={e => handleFileSelect(e.target.files?.[0] || null)} />
            </label>
            {fileError && <p className="text-xs" style={{ color: 'var(--danger-soft)' }}>{fileError}</p>}
            {submitting && answerSheetProgress > 0 && (
              <div>
                <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--muted)' }}><span>Uploading…</span><span>{answerSheetProgress}%</span></div>
                <div className="w-full rounded-full overflow-hidden" style={{ height: 4, background: 'var(--border)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${answerSheetProgress}%`, background: 'var(--blue)' }} />
                </div>
              </div>
            )}
            {error && <p className="text-xs" style={{ color: 'var(--danger-soft)' }}>{error}</p>}
            <button onClick={submitAnswerSheet} disabled={submitting || !answerSheetFile} className="w-full py-3 rounded-xl font-bold text-sm" style={{ background: 'rgba(var(--blue-rgb), 0.12)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)', opacity: submitting || !answerSheetFile ? 0.5 : 1 }}>
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
      <div key={q.id} className="p-5 rounded-xl space-y-3" style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)' }}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <span className="text-xs px-2 py-0.5 rounded-full mr-2" style={{ background: q.type === 'mcq' ? 'rgba(var(--blue-rgb), 0.09)' : q.type === 'short' ? 'rgba(var(--success-rgb), 0.09)' : 'rgba(var(--warning-rgb), 0.09)', color: q.type === 'mcq' ? 'var(--blue)' : q.type === 'short' ? 'var(--success)' : 'var(--warning)' }}>
              Q{idx + 1} · {q.type === 'mcq' ? 'MCQ' : q.type === 'short' ? 'Short Answer' : 'Photo Upload'} · {q.marks || 1} mark{(q.marks || 1) > 1 ? 's' : ''}
            </span>
            <p className="mt-2 text-sm font-medium" style={{ color: 'var(--white-soft)' }}>{q.text}</p>
            {q.description && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{q.description}</p>}
          </div>
        </div>

        {q.type === 'mcq' && (
          <div className="space-y-2">
            {(q.options || []).map(o => (
              <label key={o.id} className="flex items-center gap-3 p-3 rounded-lg cursor-pointer" style={{ background: mcqAnswers[q.id] === o.id ? 'rgba(var(--blue-rgb), 0.12)' : 'rgba(255,255,255,0.02)', border: `1px solid ${mcqAnswers[q.id] === o.id ? 'var(--blue)' : 'var(--border)'}` }}>
                <input type="radio" name={`q-${q.id}`} checked={mcqAnswers[q.id] === o.id} onChange={() => setMcqAnswers(p => ({ ...p, [q.id]: o.id }))} style={{ accentColor: 'var(--blue)' }} />
                <span className="text-sm" style={{ color: 'var(--white-soft)' }}>{o.text}</span>
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
            <label className="flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed cursor-pointer" style={{ borderColor: photoUrls[q.id] ? 'var(--success)' : photoFiles[q.id] ? 'var(--blue)' : 'var(--border)', color: 'var(--muted)' }}>
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
                <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--muted)' }}><span>Uploading…</span><span>{photoUploading[q.id]}%</span></div>
                <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: 'var(--border)' }}>
                  <div className="h-full rounded-full transition-all" style={{ width: `${photoUploading[q.id]}%`, background: 'var(--blue)' }} />
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
          <div className="sticky top-4 z-10 flex items-center justify-between px-5 py-3 rounded-xl mb-6" style={{ background: 'var(--surface-deep)', border: '1px solid var(--border)' }}>
            <span className="font-semibold text-sm" style={{ color: 'var(--white-soft)' }}>{selected.name}</span>
            <div className="flex items-center gap-2">
              <Clock size={14} style={{ color: timeLeft < 300 ? 'var(--danger-soft)' : 'var(--blue)' }} />
              <span className="font-mono text-lg font-bold" style={{ color: timeLeft < 300 ? 'var(--danger-soft)' : 'var(--blue)' }}>{fmtTime(timeLeft)}</span>
            </div>
            {!isOneByOne && (
              <button onClick={() => submitExam()} disabled={submitting} className="px-4 py-1.5 rounded-lg text-sm font-bold" style={{ background: 'linear-gradient(90deg,var(--blue),var(--blue2))', color: '#fff', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Submitting…' : 'Submit'}
              </button>
            )}
          </div>

          {/* Progress */}
          {isOneByOne && (
            <div className="mb-4">
              <div className="flex justify-between text-xs mb-1" style={{ color: 'var(--border-soft)' }}>
                <span>Question {currentQ + 1} of {questions.length}</span>
                <span>{Math.round((currentQ + 1) / questions.length * 100)}% complete</span>
              </div>
              <div className="w-full rounded-full overflow-hidden" style={{ height: 3, background: 'var(--border)' }}>
                <div className="h-full rounded-full transition-all" style={{ width: `${(currentQ + 1) / questions.length * 100}%`, background: 'var(--blue)' }} />
              </div>
            </div>
          )}

          {error && <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)' }}>{error}</div>}

          {/* Questions */}
          {isOneByOne ? (
            <div className="space-y-4">
              {renderQuestion(currentQuestion, currentQ)}
              <div className="flex justify-between gap-3 mt-4">
                <button onClick={() => setCurrentQ(p => Math.max(0, p - 1))} disabled={currentQ === 0} className="px-4 py-2 rounded-lg text-sm flex items-center gap-1" style={{ border: '1px solid var(--border)', color: 'var(--muted)', opacity: currentQ === 0 ? 0.4 : 1 }}>
                  <ChevronLeft size={14} /> Previous
                </button>
                {currentQ < questions.length - 1 ? (
                  <button onClick={() => setCurrentQ(p => p + 1)} className="px-4 py-2 rounded-lg text-sm flex items-center gap-1 font-medium" style={{ background: 'rgba(var(--blue-rgb), 0.12)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
                    Next <ChevronRight size={14} />
                  </button>
                ) : (
                  <button onClick={() => submitExam()} disabled={submitting} className="px-5 py-2 rounded-lg text-sm font-bold" style={{ background: 'linear-gradient(90deg,var(--blue),var(--blue2))', color: '#fff', opacity: submitting ? 0.6 : 1 }}>
                    {submitting ? 'Submitting…' : 'Submit Exam →'}
                  </button>
                )}
              </div>
              {/* Jump navigator */}
              <div className="flex flex-wrap gap-1.5 mt-4">
                {questions.map((q, i) => (
                  <button key={q.id} onClick={() => setCurrentQ(i)} className="w-8 h-8 rounded-lg text-xs font-medium"
                    style={{ background: i === currentQ ? 'var(--blue)' : (mcqAnswers[q.id] || shortAnswers[q.id] || photoUrls[q.id]) ? 'rgba(var(--success-rgb), 0.15)' : 'var(--surface-alt)', color: i === currentQ ? '#000' : (mcqAnswers[q.id] || shortAnswers[q.id] || photoUrls[q.id]) ? 'var(--success)' : 'var(--border-soft)', border: '1px solid var(--border)' }}>
                    {i + 1}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              {questions.map((q, i) => renderQuestion(q, i))}
              <button onClick={() => submitExam()} disabled={submitting} className="w-full py-3 rounded-xl font-bold text-sm mt-4" style={{ background: 'linear-gradient(90deg,var(--blue),var(--blue2))', color: '#fff', opacity: submitting ? 0.6 : 1 }}>
                {submitting ? 'Submitting…' : 'Submit Exam →'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  // ── DONE ─────────────────────────────────────────────────────────────────────
  const clearSession = () => {
    localStorage.removeItem(STORAGE_KEY)
    const url = new URL(window.location.href)
    url.searchParams.delete('reg')
    window.history.replaceState({}, '', url.toString())
    setPhase('list'); setSelected(null); setRegId(''); setRegData(null)
    setMcqAnswers({}); setShortAnswers({}); setPhotoFiles({}); setPhotoUrls({}); setAnswerSheetFile(null)
  }

  if (phase === 'done') return (
    <div className="min-h-screen flex items-center justify-center py-12 px-4" style={{ background: bg }}>
      <div className="max-w-md w-full p-8 text-center space-y-4" style={card}>
        <CheckCircle size={48} className="mx-auto" style={{ color: 'var(--success)' }} />
        <h2 className="text-xl font-bold" style={{ fontFamily: 'Orbitron, monospace', color: 'var(--success)' }}>Submitted!</h2>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Your response has been recorded. Results will be announced by the organizers.</p>
        <button onClick={clearSession}
          className="px-6 py-2.5 rounded-xl text-sm font-medium" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.2)' }}>
          Back to Olympiads
        </button>
      </div>
    </div>
  )

  // ── RESULT ───────────────────────────────────────────────────────────────────
  if (phase === 'result' && selected && regData) {
    const results: any[] = regData.question_results || []
    const totalAwarded = results.reduce((sum, r) => sum + (r.marks_awarded || 0), 0)
    const totalPossible = results.reduce((sum, r) => sum + (r.marks_possible || 0), 0)
    const finalScore = regData.final_score ?? regData.mcq_score ?? totalAwarded

    return (
      <div className="min-h-screen py-12 px-4" style={{ background: bg }}>
        <div className="max-w-2xl mx-auto space-y-5">
          <div className="p-6 text-center" style={card}>
            <h2 className="text-xl font-bold mb-1" style={{ fontFamily: 'Orbitron, monospace', color: 'var(--blue)' }}>{selected.name} — Result</h2>
            <p className="text-3xl font-black mt-3" style={{ color: 'var(--success)' }}>
              {finalScore}{totalPossible > 0 ? ` / ${totalPossible}` : ''}
            </p>
            {regData.organizer_note && (
              <p className="text-sm mt-3 p-3 rounded-lg text-left" style={{ background: 'var(--surface-alt)', color: 'var(--white-soft)' }}>
                <span className="font-semibold" style={{ color: 'var(--warning)' }}>Organizer's note: </span>{regData.organizer_note}
              </p>
            )}
          </div>

          {results.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-bold px-1" style={{ color: 'var(--muted)' }}>QUESTION BREAKDOWN</h3>
              {results.map((r, i) => (
                <div key={r.question_id || i} className="p-4 rounded-xl" style={{ background: 'var(--surface-alt)', border: `1px solid ${r.is_correct === true ? 'rgba(var(--success-rgb), 0.27)' : r.is_correct === false ? '#ff4d4d44' : 'var(--border)'}` }}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm font-medium flex-1" style={{ color: 'var(--white-soft)' }}>Q{i + 1}. {r.question_text}</p>
                    {r.is_correct === true && <CheckCircle size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />}
                    {r.is_correct === false && <span style={{ color: 'var(--danger)', flexShrink: 0 }}>✗</span>}
                  </div>
                  {r.type === 'mcq' && (
                    <div className="mt-2 text-xs space-y-1">
                      <p style={{ color: r.is_correct ? 'var(--success)' : 'var(--danger-soft)' }}>Your answer: {r.student_answer ?? '(not answered)'}</p>
                      {!r.is_correct && <p style={{ color: 'var(--muted)' }}>Correct answer: {r.correct_answer}</p>}
                    </div>
                  )}
                  {r.type === 'short' && (
                    <div className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                      Your answer: <span style={{ color: 'var(--white-soft)' }}>{r.student_answer || '(not answered)'}</span>
                    </div>
                  )}
                  {r.type === 'photo' && selected.annotations_published && r.student_answer && (
                    <button onClick={() => window.open(r.student_answer, '_blank')} className="mt-2 text-xs underline" style={{ color: 'var(--blue)' }}>
                      View marked answer sheet
                    </button>
                  )}
                  <p className="text-xs mt-2" style={{ color: 'var(--border-soft)' }}>
                    {r.marks_awarded != null ? `${r.marks_awarded} / ${r.marks_possible} marks` : `Out of ${r.marks_possible} marks — pending review`}
                  </p>
                </div>
              ))}
            </div>
          )}

          {regData.answer_sheet_url && selected.annotations_published && (
            <div className="p-4 rounded-xl text-center" style={card}>
              <p className="text-sm mb-3" style={{ color: 'var(--muted)' }}>Your marked answer sheet</p>
              <img src={regData.answer_sheet_url} alt="Marked answer sheet" className="max-w-full rounded-lg mx-auto" />
              {regData.organizer_note && (
                <p className="text-sm mt-3 text-left p-3 rounded-lg" style={{ background: 'var(--surface-alt)', color: 'var(--white-soft)' }}>{regData.organizer_note}</p>
              )}
            </div>
          )}

          <button onClick={clearSession} className="w-full py-3 rounded-xl text-sm font-medium" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.2)' }}>
            Back to Olympiads
          </button>
        </div>
      </div>
    )
  }

  return null
}
