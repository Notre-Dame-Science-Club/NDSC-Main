'use client'
import { useEffect, useState, useRef, useCallback } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Clock, ChevronRight, ChevronLeft, CheckCircle, ArrowLeft, Upload, X } from 'lucide-react'

type QuestionType = 'mcq' | 'short' | 'photo'
type McqOption = { id: string; text: string }
type Question = {
  id: string; type: QuestionType; text: string; description?: string
  options?: McqOption[]; correct_option_id?: string; marks?: number; subject_id?: string
}
type Subject = { id: string; name: string; description?: string }
type Olympiad = {
  id: string; name: string; exam_type: 'photo_only' | 'live_only' | 'mixed'
  question_display: 'one_by_one' | 'all_at_once'; timer_minutes: number
  questions: Question[]
  relay_mode: boolean; relay_type: 'sequential' | 'chain'
  subjects: Subject[]; subject_assignment_mode: 'self_select' | 'admin_assign' | 'auto'
  scheduled_start_at: string | null; scheduled_end_at: string | null
  result_published?: boolean
}

const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--white)' }
const STORAGE_PREFIX = 'ndsc_relay_exam_'

// Replaces {{chain.memberN.questionId}} tokens in a question's text with
// the actual value the previous team member submitted for that question.
function resolveChainText(text: string, chainValues: Record<string, any>): string {
  return text.replace(/\{\{chain\.(member\d+)\.([\w-]+)\}\}/g, (_match, member, qId) => {
    const val = chainValues[`${member}.${qId}`]
    return val !== undefined ? String(val) : '???'
  })
}

export default function RelayExamPage() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const slug = params.slug as string

  const regId = searchParams.get('reg') || ''
  const olympiadId = searchParams.get('olympiad') || ''
  const memberIdParam = searchParams.get('member') || 'leader' // who is taking this turn

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [olympiad, setOlympiad] = useState<Olympiad | null>(null)
  const [registration, setRegistration] = useState<any>(null)
  const [relayState, setRelayState] = useState<any>(null)
  const [mySubjectId, setMySubjectId] = useState<string | null>(null)

  const [phase, setPhase] = useState<'loading' | 'waiting_turn' | 'select_subject' | 'intro' | 'exam' | 'done'>('loading')

  const [mcqAnswers, setMcqAnswers] = useState<Record<string, string>>({})
  const [shortAnswers, setShortAnswers] = useState<Record<string, string>>({})
  const [photoFiles, setPhotoFiles] = useState<Record<string, File>>({})
  const [photoUrls, setPhotoUrls] = useState<Record<string, string>>({})
  const [photoUploading, setPhotoUploading] = useState<Record<string, boolean>>({})
  const [currentQ, setCurrentQ] = useState(0)
  const [timeLeft, setTimeLeft] = useState(0)
  const timerRef = useRef<any>(null)
  const [submitting, setSubmitting] = useState(false)

  const allMembers = registration
    ? [{ id: 'leader', full_name: registration.full_name }, ...(registration.team_members || [])]
    : []
  const myIndex = allMembers.findIndex(m => m.id === memberIdParam)

  // ── Load everything ──────────────────────────────────────────────────────
  const load = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const [olyRes, regRes, relayRes] = await Promise.all([
        fetch(`/api/olympiad?id=${olympiadId}`),
        fetch(`/api/activity-register?id=${regId}`),
        fetch(`/api/relay-exam?registration_id=${regId}&olympiad_id=${olympiadId}`),
      ])
      const olyData = await olyRes.json()
      const regData = await regRes.json()
      const relayData = await relayRes.json()

      if (!olyRes.ok) throw new Error(olyData.error || 'Olympiad not found.')
      if (!regRes.ok) throw new Error(regData.error || 'Registration not found.')

      setOlympiad(olyData.olympiad)
      setRegistration(regData.registration)
      setRelayState(relayData.state)

      // Scheduling gate
      const oly = olyData.olympiad as Olympiad
      if (oly.scheduled_start_at && new Date(oly.scheduled_start_at) > new Date()) {
        setError(`This exam opens at ${new Date(oly.scheduled_start_at).toLocaleString()}.`)
        setLoading(false)
        return
      }
      if (oly.scheduled_end_at && new Date(oly.scheduled_end_at) < new Date()) {
        setError('The exam window has closed.')
        setLoading(false)
        return
      }

      determinePhase(oly, regData.registration, relayData.state)
    } catch (e: any) {
      setError(e.message || 'Could not load the exam.')
    } finally {
      setLoading(false)
    }
  }, [regId, olympiadId, memberIdParam])

  useEffect(() => { if (regId && olympiadId) load() }, [load, regId, olympiadId])

  const determinePhase = (oly: Olympiad, reg: any, relay: any) => {
    const members = [{ id: 'leader', full_name: reg.full_name }, ...(reg.team_members || [])]
    const myIdx = members.findIndex(m => m.id === memberIdParam)

    // Already submitted?
    const already = relay?.member_submissions?.find((s: any) => s.member_id === memberIdParam)
    if (already) { setPhase('done'); return }

    // Relay mode: check whose turn it is
    if (oly.relay_mode) {
      if (!relay) {
        // Relay hasn't started — only the leader can kick it off
        if (memberIdParam !== 'leader') { setPhase('waiting_turn'); return }
        setPhase(oly.subjects?.length > 0 && oly.subject_assignment_mode === 'self_select' ? 'select_subject' : 'intro')
        return
      }
      const currentIdx = relay.current_member_index ?? 0
      if (myIdx !== currentIdx) { setPhase('waiting_turn'); return }
    }

    // Subject selection needed?
    if (oly.subjects?.length > 0 && oly.subject_assignment_mode === 'self_select' && !mySubjectId) {
      setPhase('select_subject')
      return
    }

    setPhase('intro')
  }

  // Poll while waiting for your turn
  useEffect(() => {
    if (phase !== 'waiting_turn') return
    const t = setInterval(load, 5000)
    return () => clearInterval(t)
  }, [phase, load])

  // ── Subject selection ────────────────────────────────────────────────────
  const pickSubject = async (subjectId: string) => {
    try {
      const res = await fetch('/api/relay-exam', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'assign_subject', registration_id: regId, olympiad_id: olympiadId, member_id: memberIdParam, subject_id: subjectId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setMySubjectId(subjectId)
      setPhase('intro')
    } catch (e: any) { setError(e.message) }
  }

  // ── Start relay if needed, then start exam timer ────────────────────────
  const startExam = async () => {
    // The state row is needed for EVERY exam (not just relay-mode ones) —
    // submit_member always requires it to exist. Previously this only ran
    // for relay_mode, so a plain single-member online exam would silently
    // fail at submit time with "Relay not started yet."
    if (!relayState) {
      const res = await fetch('/api/relay-exam', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', registration_id: regId, olympiad_id: olympiadId }),
      })
      const data = await res.json()
      if (res.ok) setRelayState(data.state)
    }
    setCurrentQ(0)
    setPhase('exam')
    startTimer(olympiad?.timer_minutes || 60)
  }

  const startTimer = (minutes: number) => {
    setTimeLeft(minutes * 60)
    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) { clearInterval(timerRef.current); submitMyTurn(); return 0 }
        return prev - 1
      })
    }, 1000)
  }
  useEffect(() => () => clearInterval(timerRef.current), [])

  // ── Filter questions: by subject (if applicable), resolve chain text ────
  const visibleQuestions = (olympiad?.questions || []).filter(q => {
    if (!mySubjectId) return true
    return !q.subject_id || q.subject_id === mySubjectId
  })

  const chainValues = relayState?.chain_values || {}
  const resolvedQuestion = (q: Question): Question => {
    if (olympiad?.relay_type !== 'chain') return q
    return { ...q, text: resolveChainText(q.text, chainValues), description: q.description ? resolveChainText(q.description, chainValues) : q.description }
  }

  // ── Submit this member's turn ────────────────────────────────────────────
  const submitMyTurn = async () => {
    if (submitting) return
    setSubmitting(true)
    clearInterval(timerRef.current)
    try {
      // Make sure every selected photo answer actually finished uploading —
      // if one failed silently while the timer ran out, retry it here.
      const resolvedPhotoUrls = { ...photoUrls }
      for (const q of visibleQuestions.filter(q => q.type === 'photo')) {
        if (photoFiles[q.id] && !resolvedPhotoUrls[q.id]) {
          try { resolvedPhotoUrls[q.id] = await uploadExamPhoto(photoFiles[q.id]) } catch { /* skip — leaves unanswered */ }
        }
      }
      const answers: Record<string, any> = { ...mcqAnswers, ...shortAnswers, ...resolvedPhotoUrls }
      const res = await fetch('/api/relay-exam', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'submit_member', registration_id: regId, olympiad_id: olympiadId, member_id: memberIdParam, subject_id: mySubjectId, answers }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRelayState(data.state)
      setPhase('done')
    } catch (e: any) { setError(e.message) }
    finally { setSubmitting(false) }
  }

  const fmtTime = (s: number) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  // Photo question upload — same upload endpoint the rest of the activity
  // flow already uses, so admin file-size/type rules stay consistent.
  const uploadExamPhoto = (file: File): Promise<string> =>
    new Promise((resolve, reject) => {
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

  const handlePhotoAnswer = async (qId: string, file: File | null) => {
    if (!file) return
    setPhotoFiles(p => ({ ...p, [qId]: file }))
    setPhotoUploading(p => ({ ...p, [qId]: true }))
    try {
      const url = await uploadExamPhoto(file)
      setPhotoUrls(p => ({ ...p, [qId]: url }))
    } catch { /* left unresolved — submitMyTurn retries from photoFiles */ }
    finally { setPhotoUploading(p => ({ ...p, [qId]: false })) }
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}><p style={{ color: 'var(--muted)' }}>Loading exam…</p></div>

  if (error) return (
    <div className="min-h-screen flex items-center justify-center px-4 text-center" style={{ background: 'var(--bg)' }}>
      <div>
        <p className="text-sm mb-4" style={{ color: 'var(--danger-soft)' }}>{error}</p>
        <Link href={`/activities/${slug}/dashboard?reg=${regId}`} className="text-sm underline" style={{ color: 'var(--blue)' }}>← Back to dashboard</Link>
      </div>
    </div>
  )

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: 'var(--bg)', paddingTop: '88px' }}>
      <div className="max-w-xl mx-auto space-y-5">
        <Link href={`/activities/${slug}/dashboard?reg=${regId}`} className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={14} /> Back to dashboard
        </Link>

        <h1 className="text-2xl font-black" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--white)' }}>{olympiad?.name}</h1>

        {phase === 'waiting_turn' && (
          <div className="rounded-2xl p-6 border text-center" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
            <p className="text-sm mb-2" style={{ color: 'var(--warning)' }}>⏳ Waiting for your turn…</p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              This event uses team relay mode — the previous member needs to submit before you can start. This page refreshes automatically.
            </p>
          </div>
        )}

        {phase === 'select_subject' && (
          <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
            <p className="text-sm font-bold mb-3" style={{ color: 'var(--white)' }}>Select your subject</p>
            <div className="space-y-2">
              {(olympiad?.subjects || []).map(sub => (
                <button key={sub.id} onClick={() => pickSubject(sub.id)}
                  className="w-full text-left p-3 rounded-lg border transition-all hover:-translate-y-0.5"
                  style={{ background: 'rgba(var(--blue-rgb), 0.05)', borderColor: 'rgba(var(--blue-rgb), 0.2)', color: 'var(--white)' }}>
                  {sub.name}
                  {sub.description && <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{sub.description}</p>}
                </button>
              ))}
            </div>
          </div>
        )}

        {phase === 'intro' && (
          <div className="rounded-2xl p-6 border text-center space-y-4" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
            <p className="text-sm" style={{ color: 'var(--white)' }}>
              {visibleQuestions.length} questions · {olympiad?.timer_minutes} minutes
              {mySubjectId && <><br />Subject: {olympiad?.subjects.find(s => s.id === mySubjectId)?.name}</>}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>Once you start, the timer begins and cannot be paused.</p>
            <button onClick={startExam} className="w-full py-3 rounded-xl font-bold text-sm text-black" style={{ background: 'var(--blue)' }}>
              Start Exam →
            </button>
          </div>
        )}

        {phase === 'exam' && visibleQuestions.length > 0 && (
          <div className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'rgba(var(--warning-rgb), 0.08)', border: '1px solid rgba(var(--warning-rgb), 0.25)' }}>
              <span className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--warning)' }}><Clock size={14} /> {fmtTime(timeLeft)}</span>
              <span className="text-xs" style={{ color: 'var(--muted)' }}>Question {currentQ + 1} / {visibleQuestions.length}</span>
            </div>

            {(() => {
              const q = resolvedQuestion(visibleQuestions[currentQ])
              return (
                <div className="rounded-xl p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  <p className="text-sm font-semibold mb-1" style={{ color: 'var(--white)' }}>{q.text}</p>
                  {q.description && <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>{q.description}</p>}

                  {q.type === 'mcq' && (
                    <div className="space-y-2 mt-3">
                      {(q.options || []).map(opt => (
                        <button key={opt.id} onClick={() => setMcqAnswers(p => ({ ...p, [q.id]: opt.id }))}
                          className="w-full text-left p-3 rounded-lg border text-sm transition-all"
                          style={{
                            background: mcqAnswers[q.id] === opt.id ? 'rgba(var(--blue-rgb), 0.15)' : 'rgba(255,255,255,0.03)',
                            borderColor: mcqAnswers[q.id] === opt.id ? 'var(--blue)' : 'var(--border)',
                            color: 'var(--white)',
                          }}>
                          {opt.text}
                        </button>
                      ))}
                    </div>
                  )}

                  {q.type === 'short' && (
                    <textarea rows={4} value={shortAnswers[q.id] || ''} onChange={e => setShortAnswers(p => ({ ...p, [q.id]: e.target.value }))}
                      className="w-full px-3 py-2.5 rounded-lg text-sm outline-none resize-none mt-2" style={inputStyle} />
                  )}

                  {q.type === 'photo' && (
                    <label className="flex flex-col items-center gap-2 py-5 rounded-xl border-2 border-dashed cursor-pointer mt-2"
                      style={{ borderColor: photoUrls[q.id] ? 'var(--cat-teal)' : photoFiles[q.id] ? 'var(--blue)' : 'var(--border)', color: 'var(--muted)' }}>
                      <Upload size={18} />
                      <span className="text-xs inline-flex items-center gap-1">
                        {photoUploading[q.id] ? 'Uploading…' : photoUrls[q.id] ? <><CheckCircle size={12} /> Uploaded — tap to replace</> : photoFiles[q.id] ? photoFiles[q.id].name : 'Tap to upload your photo answer'}
                      </span>
                      <input type="file" accept="image/*" capture="environment" className="hidden"
                        onChange={e => handlePhotoAnswer(q.id, e.target.files?.[0] || null)} />
                    </label>
                  )}
                </div>
              )
            })()}

            <div className="flex gap-2">
              {currentQ > 0 && (
                <button onClick={() => setCurrentQ(c => c - 1)} className="px-4 py-2.5 rounded-lg text-sm flex items-center gap-1" style={{ color: 'var(--muted)' }}>
                  <ChevronLeft size={14} /> Previous
                </button>
              )}
              {currentQ < visibleQuestions.length - 1 ? (
                <button onClick={() => setCurrentQ(c => c + 1)} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-black flex items-center justify-center gap-1" style={{ background: 'var(--blue)' }}>
                  Next <ChevronRight size={14} />
                </button>
              ) : (
                <button onClick={submitMyTurn} disabled={submitting} className="flex-1 py-2.5 rounded-lg text-sm font-bold text-black disabled:opacity-60 flex items-center justify-center gap-1.5" style={{ background: 'var(--cat-teal)' }}>
                  {submitting ? 'Submitting…' : <>Submit Final <CheckCircle size={14} /></>}
                </button>
              )}
            </div>
          </div>
        )}

        {phase === 'done' && (() => {
          const mySubmission = (relayState?.member_submissions || []).find((s: any) => s.member_id === memberIdParam)
          const showResults = !!olympiad?.result_published && mySubmission?.question_results?.length > 0
          if (!showResults) {
            return (
              <div className="rounded-2xl p-6 border text-center" style={{ background: 'rgba(var(--cat-teal-rgb), 0.08)', borderColor: 'rgba(var(--cat-teal-rgb), 0.25)' }}>
                <CheckCircle size={32} style={{ color: 'var(--cat-teal)', margin: '0 auto 12px' }} />
                <p className="text-sm font-bold mb-2" style={{ color: 'var(--cat-teal)' }}>Submitted!</p>
                {olympiad?.relay_mode && (
                  <p className="text-xs" style={{ color: 'var(--muted)' }}>The next team member can now take their turn.</p>
                )}
                <Link href={`/activities/${slug}/dashboard?reg=${regId}`} className="inline-block mt-4 text-sm underline" style={{ color: 'var(--blue)' }}>
                  ← Back to dashboard
                </Link>
              </div>
            )
          }
          const results: any[] = mySubmission.question_results
          const totalAwarded = results.reduce((sum, r) => sum + (r.marks_awarded || 0), 0)
          const totalPossible = results.reduce((sum, r) => sum + (r.marks_possible || 0), 0)
          return (
            <div className="space-y-4">
              <div className="rounded-2xl p-6 border text-center" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
                <p className="text-sm font-bold mb-1" style={{ color: 'var(--white)' }}>Your Result</p>
                <p className="text-3xl font-black mt-2" style={{ color: 'var(--cat-teal)' }}>
                  {mySubmission.score ?? totalAwarded}{totalPossible > 0 ? ` / ${totalPossible}` : ''}
                </p>
              </div>
              <div className="space-y-3">
                <h3 className="text-sm font-bold px-1" style={{ color: 'var(--muted)' }}>QUESTION BREAKDOWN</h3>
                {results.map((r, i) => (
                  <div key={r.question_id || i} className="p-4 rounded-xl" style={{ background: 'var(--bg2)', border: `1px solid ${r.is_correct === true ? 'rgba(var(--cat-teal-rgb), 0.3)' : r.is_correct === false ? 'rgba(255,77,77,0.3)' : 'var(--border)'}` }}>
                    <div className="flex items-start justify-between gap-3">
                      <p className="text-sm font-medium flex-1" style={{ color: 'var(--white)' }}>Q{i + 1}. {r.question_text}</p>
                      {r.is_correct === true && <CheckCircle size={16} style={{ color: 'var(--cat-teal)', flexShrink: 0 }} />}
                      {r.is_correct === false && <X size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} strokeWidth={3} />}
                    </div>
                    {r.type === 'mcq' && (
                      <div className="mt-2 text-xs space-y-1">
                        <p style={{ color: r.is_correct ? 'var(--cat-teal)' : 'var(--danger-soft)' }}>Your answer: {r.student_answer ?? '(not answered)'}</p>
                        {!r.is_correct && <p style={{ color: 'var(--muted)' }}>Correct answer: {r.correct_answer}</p>}
                      </div>
                    )}
                    {r.type === 'short' && (
                      <div className="mt-2 text-xs" style={{ color: 'var(--muted)' }}>
                        Your answer: <span style={{ color: 'var(--white)' }}>{r.student_answer || '(not answered)'}</span>
                      </div>
                    )}
                    {r.type === 'photo' && r.student_answer && (
                      <a href={r.student_answer} target="_blank" rel="noopener noreferrer" className="mt-2 text-xs underline inline-block" style={{ color: 'var(--blue)' }}>
                        View your uploaded photo answer
                      </a>
                    )}
                    <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
                      {r.marks_awarded != null ? `${r.marks_awarded} / ${r.marks_possible} marks` : `Out of ${r.marks_possible} marks — pending review`}
                    </p>
                  </div>
                ))}
              </div>
              <Link href={`/activities/${slug}/dashboard?reg=${regId}`} className="block text-center text-sm underline py-2" style={{ color: 'var(--blue)' }}>
                ← Back to dashboard
              </Link>
            </div>
          )
        })()}
      </div>
    </div>
  )
}
