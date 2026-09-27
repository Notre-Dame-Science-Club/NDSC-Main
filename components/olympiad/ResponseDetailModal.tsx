'use client'
import { useMemo, useState } from 'react'
import { X, CheckCircle2, XCircle, ImageIcon } from 'lucide-react'
import MathText from './MathText'

type QuestionResult = {
  question_id: string
  question_text: string
  type: string
  student_answer: any
  correct_answer: any
  is_correct: boolean | null
  marks_awarded: number | null
  marks_possible: number
}

// Builds a Google-Forms-style "individual response" breakdown from either
// the already-computed `question_results` (saved at submit time) or, for
// older registrations that predate that field, derives it live from the
// raw answer columns + the olympiad's question bank.
//
// NEW BEHAVIOR: Handles ALL field types, not just mcq/checkbox/short_answer/photo.
// For mcq/checkbox, auto-grades by comparing to correct_option_id(s). For all
// other types, shows the raw answer and lets the organizer manually enter marks.
function buildResults(reg: any, questions: any[]): QuestionResult[] {
  if (Array.isArray(reg.question_results) && reg.question_results.length) return reg.question_results

  return (questions || []).map((q: any): QuestionResult => {
    const qKey = q.key || q.id

    // MCQ: auto-grade by comparing chosen option to correct_option_id
    if (q.type === 'mcq') {
      const chosenId = (reg.mcq_answers || {})[qKey]
      const chosen = (q.mcq_options || []).find((o: any) => o.id === chosenId)
      const correct = (q.mcq_options || []).find((o: any) => o.id === q.correct_option_id)
      const isCorrect = !!chosenId && chosenId === q.correct_option_id
      return {
        question_id: qKey, question_text: q.label, type: q.type,
        student_answer: chosen?.text ?? null, correct_answer: correct?.text ?? null,
        is_correct: isCorrect, marks_awarded: isCorrect ? (q.marks || 1) : 0, marks_possible: q.marks || 1,
      }
    }

    // Checkbox (multi-select): auto-grade by comparing chosen set to correct_option_ids
    if (q.type === 'checkbox') {
      const chosenIds: string[] = Array.isArray((reg.mcq_answers || {})[qKey]) ? (reg.mcq_answers || {})[qKey] : []
      const correctIds: string[] = q.correct_option_ids || []
      const isCorrect = chosenIds.length > 0 && chosenIds.length === correctIds.length && chosenIds.every(id => correctIds.includes(id))
      const chosenText = (q.mcq_options || []).filter((o: any) => chosenIds.includes(o.id)).map((o: any) => o.text).join(', ')
      const correctText = (q.mcq_options || []).filter((o: any) => correctIds.includes(o.id)).map((o: any) => o.text).join(', ')
      return {
        question_id: qKey, question_text: q.label, type: q.type,
        student_answer: chosenText || null, correct_answer: correctText || null,
        is_correct: isCorrect, marks_awarded: isCorrect ? (q.marks || 1) : 0, marks_possible: q.marks || 1,
      }
    }

    // Short answer: read from short_answers, no auto-grading
    if (q.type === 'short_answer') {
      return {
        question_id: qKey, question_text: q.label, type: q.type,
        student_answer: (reg.short_answers || {})[qKey] || null, correct_answer: null,
        is_correct: null, marks_awarded: null, marks_possible: q.marks || 1,
      }
    }

    // Photo: read from photo_answers array (legacy format) or custom_answers (new format)
    if (q.type === 'photo') {
      const photoFromArray = (reg.photo_answers || []).find((p: any) => p.question_id === qKey)
      const photoFromCustom = (reg.custom_answers || {})[qKey]
      const photoUrl = photoFromArray?.url || photoFromCustom || null
      return {
        question_id: qKey, question_text: q.label, type: q.type,
        student_answer: photoUrl, correct_answer: null,
        is_correct: null, marks_awarded: null, marks_possible: q.marks || 1,
      }
    }

    // All other types (text, textarea, number, dropdown, multiple_choice,
    // checkboxes, date, time, file, etc.): read from custom_answers, no auto-grading.
    // The organizer manually enters marks_awarded for these.
    const rawAnswer = (reg.custom_answers || {})[qKey]
    let displayAnswer: string | null = null
    if (rawAnswer === undefined || rawAnswer === null) {
      displayAnswer = null
    } else if (Array.isArray(rawAnswer)) {
      // For checkboxes, multiple_choice, or file uploads (arrays)
      displayAnswer = rawAnswer.join(', ')
    } else {
      displayAnswer = String(rawAnswer)
    }

    return {
      question_id: qKey, question_text: q.label, type: q.type,
      student_answer: displayAnswer, correct_answer: null,
      is_correct: null, marks_awarded: null, marks_possible: q.marks || 1,
    }
  })
}

export default function ResponseDetailModal({ reg, questions, onClose, onSave }: {
  reg: any
  questions: any[]
  onClose: () => void
  onSave: (regId: string, patch: { question_results: QuestionResult[]; final_score: number; review_status: string }) => Promise<void>
}) {
  const initial = useMemo(() => buildResults(reg, questions), [reg, questions])
  const [results, setResults] = useState<QuestionResult[]>(initial)
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const setMarks = (qid: string, raw: string) => {
    const q = results.find(r => r.question_id === qid)
    if (!q) return
    const clamped = raw === '' ? null : Math.max(0, Math.min(q.marks_possible, Number(raw) || 0))
    setResults(rs => rs.map(r => r.question_id === qid ? { ...r, marks_awarded: clamped, is_correct: clamped == null ? r.is_correct : clamped >= r.marks_possible } : r))
  }

  const total = results.reduce((sum, r) => sum + (r.marks_awarded || 0), 0)
  const possible = results.reduce((sum, r) => sum + (r.marks_possible || 0), 0)
  const pendingCount = results.filter(r => r.marks_awarded == null).length

  const submit = async () => {
    setSaving(true); setErr('')
    try {
      await onSave(reg.id, { question_results: results, final_score: total, review_status: pendingCount > 0 ? 'pending' : 'reviewed' })
      onClose()
    } catch (e: any) {
      setErr(e.message || 'Could not save.')
    } finally {
      setSaving(false)
    }
  }

  const typeLabel = (t: string) => {
    if (t === 'mcq') return 'MCQ'
    if (t === 'checkbox') return 'Multi-select'
    if (t === 'short_answer') return 'Short Answer'
    if (t === 'photo') return 'Photo Upload'
    if (t === 'text') return 'Text'
    if (t === 'textarea') return 'Long Text'
    if (t === 'number') return 'Number'
    if (t === 'dropdown') return 'Dropdown'
    if (t === 'multiple_choice') return 'Multiple Choice'
    if (t === 'checkboxes') return 'Checkboxes'
    if (t === 'date') return 'Date'
    if (t === 'time') return 'Time'
    if (t === 'file') return 'File Upload'
    return t.charAt(0).toUpperCase() + t.slice(1)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(2,8,16,0.85)' }}>
      <div className="w-full max-w-2xl max-h-[85vh] overflow-y-auto rounded-2xl border p-6 space-y-5" style={{ background: 'var(--surface-deep)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-bold text-sm" style={{ fontFamily: 'inherit', color: 'var(--blue)' }}>{reg.full_name}'s Response</h2>
            <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>{reg.email} · {reg.phone}</p>
          </div>
          <button onClick={onClose}><X size={18} style={{ color: 'var(--muted)' }} /></button>
        </div>

        <div className="flex items-center justify-between px-4 py-3 rounded-lg" style={{ background: 'rgba(var(--blue-rgb), 0.08)' }}>
          <span className="text-sm font-bold" style={{ color: 'var(--white-soft)' }}>Total Score</span>
          <span className="text-lg font-bold" style={{ color: 'var(--blue)' }}>{total} / {possible}{pendingCount > 0 ? ` (${pendingCount} pending)` : ''}</span>
        </div>

        {err && <div className="px-3 py-2 rounded-lg text-xs" style={{ background: 'rgba(var(--danger-rgb), 0.12)', color: 'var(--danger)' }}>{err}</div>}

        <div className="space-y-4">
          {results.length === 0 && (
            <p className="text-xs text-center py-6" style={{ color: 'var(--border-soft)' }}>No answers recorded for this registration.</p>
          )}
          {results.map((r, i) => (
            <div key={r.question_id || i} className="rounded-lg p-4 space-y-2" style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)' }}>
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <span className="text-[10px] px-1.5 py-0.5 rounded" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>{typeLabel(r.type)}</span>
                  <p className="text-sm font-medium mt-1" style={{ color: 'var(--white-soft)' }}><MathText text={`Q${i + 1}. ${r.question_text}`} /></p>
                </div>
                {r.is_correct === true && <CheckCircle2 size={16} style={{ color: 'var(--success)', flexShrink: 0 }} />}
                {r.is_correct === false && <XCircle size={16} style={{ color: 'var(--danger)', flexShrink: 0 }} />}
              </div>

              {r.type === 'photo' ? (
                r.student_answer ? (
                  <a href={r.student_answer} target="_blank" rel="noreferrer" className="inline-block">
                    <img src={r.student_answer} alt="Student answer" className="max-h-64 rounded-lg border" style={{ borderColor: 'var(--border)' }} />
                  </a>
                ) : (
                  <p className="text-xs flex items-center gap-1" style={{ color: 'var(--border-soft)' }}><ImageIcon size={12} /> No photo submitted</p>
                )
              ) : (
                <p className="text-sm px-3 py-2 rounded" style={{ background: 'rgba(255,255,255,0.03)', color: r.student_answer ? 'var(--white-soft)' : 'var(--border-soft)' }}>
                  {r.student_answer ? <MathText text={String(r.student_answer)} /> : 'No answer'}
                </p>
              )}

              {r.correct_answer != null && (
                <p className="text-xs" style={{ color: 'var(--success)' }}>Correct: <MathText text={String(r.correct_answer)} /></p>
              )}

              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs" style={{ color: 'var(--muted)' }}>Marks:</span>
                <input
                  type="number" min={0} max={r.marks_possible}
                  value={r.marks_awarded ?? ''}
                  onChange={e => setMarks(r.question_id, e.target.value)}
                  className="w-16 px-2 py-1 rounded text-xs border text-right"
                  style={{ background: 'var(--surface-deep)', borderColor: 'var(--border)', color: 'var(--white-soft)' }}
                />
                <span className="text-xs" style={{ color: 'var(--border-soft)' }}>/ {r.marks_possible}</span>
              </div>
            </div>
          ))}
        </div>

        <div className="flex justify-end gap-3 pt-2">
          <button onClick={onClose} className="px-4 py-2 rounded-lg text-sm border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>Close</button>
          <button onClick={submit} disabled={saving || results.length === 0} className="px-5 py-2 rounded-lg text-sm font-bold" style={{ background: 'linear-gradient(90deg,var(--blue),var(--blue2))', color: '#fff', opacity: saving ? 0.6 : 1 }}>
            {saving ? 'Saving…' : 'Save & Mark Reviewed'}
          </button>
        </div>
      </div>
    </div>
  )
}
