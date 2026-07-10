'use client'
import { useEffect, useState } from 'react'
import { CheckCircle2, Loader2 } from 'lucide-react'
import type { SurveyQuestion } from '@/lib/survey'

type SurveyDetail = {
  id: string
  title: string
  description?: string
  cover_image_url?: string
  questions: SurveyQuestion[]
  allow_multiple_responses: boolean
  already_responded: boolean
}

const inputClass = 'w-full px-3 py-2.5 rounded-lg text-sm outline-none border transition-colors'
const inputStyle = { background: 'var(--surface-alt)', borderColor: 'var(--border)', color: 'var(--white-soft)' }

async function getAuthToken(): Promise<string | null> {
  try {
    const { supabase } = await import('@/lib/supabase')
    const { data } = await supabase.auth.getSession()
    return data.session?.access_token || null
  } catch {
    return null
  }
}

/**
 * Renders and handles submission for a single survey. Self-contained —
 * fetches its own data given just an id, so it can be dropped into the
 * notification overlay modal and the standalone /survey/[id] page without
 * either one owning survey-fetching logic.
 */
export default function SurveyForm({ surveyId, onSubmitted, compact = false }: {
  surveyId: string
  onSubmitted?: () => void
  compact?: boolean
}) {
  const [survey, setSurvey] = useState<SurveyDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [otherActive, setOtherActive] = useState<Record<string, boolean>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [respondentName, setRespondentName] = useState('')
  const [respondentEmail, setRespondentEmail] = useState('')
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      setLoading(true)
      setError('')
      const token = await getAuthToken()
      if (!cancelled) setIsLoggedIn(!!token)
      try {
        const res = await fetch(`/api/survey/${surveyId}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        })
        const data = await res.json()
        if (cancelled) return
        if (!res.ok) { setError(data.error || 'This survey isn\u2019t available.'); setLoading(false); return }
        setSurvey(data)
      } catch {
        if (!cancelled) setError('Network error while loading the survey.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => { cancelled = true }
  }, [surveyId])

  const setAnswer = (qid: string, value: any) => setAnswers(p => ({ ...p, [qid]: value }))

  const toggleCheckbox = (qid: string, text: string) => {
    setAnswers(p => {
      const cur: string[] = Array.isArray(p[qid]) ? p[qid] : []
      const next = cur.includes(text) ? cur.filter(v => v !== text) : [...cur, text]
      return { ...p, [qid]: next }
    })
  }

  const submit = async () => {
    if (!survey) return
    setError('')
    setSubmitting(true)
    try {
      const token = await getAuthToken()
      const res = await fetch('/api/survey-response', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          survey_id: survey.id,
          answers,
          respondent_name: isLoggedIn ? undefined : respondentName || undefined,
          respondent_email: isLoggedIn ? undefined : respondentEmail || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not submit your response.'); return }
      setSubmitted(true)
      onSubmitted?.()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 gap-2" style={{ color: 'var(--muted)' }}>
        <Loader2 size={18} className="animate-spin" /> <span className="text-sm">Loading survey...</span>
      </div>
    )
  }

  if (error && !survey) {
    return <p className="text-sm py-6 text-center" style={{ color: 'var(--danger-soft)' }}>{error}</p>
  }

  if (!survey) return null

  if (survey.already_responded || submitted) {
    return (
      <div className="text-center py-8 px-4">
        <CheckCircle2 size={36} className="mx-auto mb-3" style={{ color: 'var(--success)' }} />
        <p className="font-bold text-sm" style={{ color: 'var(--white)' }}>
          {submitted ? 'Thanks — your response has been recorded!' : 'You\u2019ve already responded to this survey.'}
        </p>
      </div>
    )
  }

  return (
    <div className={compact ? '' : 'max-w-xl mx-auto'}>
      {survey.cover_image_url && (
        <img src={survey.cover_image_url} alt="" className="w-full rounded-xl mb-4 object-cover" style={{ maxHeight: 220 }} />
      )}
      <h2 className="font-bold text-lg mb-1" style={{ color: 'var(--white)', fontFamily: "'Orbitron', sans-serif" }}>{survey.title}</h2>
      {survey.description && <p className="text-sm mb-5" style={{ color: 'var(--muted)' }}>{survey.description}</p>}

      <div className="space-y-5">
        {!isLoggedIn && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-1">
            <input placeholder="Your name (optional)" value={respondentName} onChange={e => setRespondentName(e.target.value)}
              className={inputClass} style={inputStyle} />
            <input placeholder="Your email (optional)" value={respondentEmail} onChange={e => setRespondentEmail(e.target.value)}
              className={inputClass} style={inputStyle} />
          </div>
        )}

        {survey.questions.map((q, qi) => (
          <div key={q.id}>
            <label className="block text-sm font-semibold mb-1" style={{ color: 'var(--white)' }}>
              {qi + 1}. {q.title} {q.required && <span style={{ color: 'var(--accent)' }}>*</span>}
            </label>
            {q.description && <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>{q.description}</p>}

            {q.type === 'short_text' && (
              <input value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)} className={inputClass} style={inputStyle} />
            )}

            {q.type === 'paragraph' && (
              <textarea rows={3} value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)}
                className={inputClass + ' resize-none'} style={inputStyle} />
            )}

            {q.type === 'date' && (
              <input type="date" value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)} className={inputClass} style={inputStyle} />
            )}

            {q.type === 'time' && (
              <input type="time" value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)} className={inputClass} style={inputStyle} />
            )}

            {q.type === 'multiple_choice' && (
              <div className="space-y-1.5">
                {(q.options || []).map(opt => (
                  <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--white-soft)' }}>
                    <input type="radio" name={q.id} checked={!otherActive[q.id] && answers[q.id] === opt.text}
                      onChange={() => { setOtherActive(p => ({ ...p, [q.id]: false })); setAnswer(q.id, opt.text) }} />
                    {opt.text}
                  </label>
                ))}
                {q.allow_other && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--white-soft)' }}>
                    <input type="radio" name={q.id} checked={!!otherActive[q.id]}
                      onChange={() => { setOtherActive(p => ({ ...p, [q.id]: true })); setAnswer(q.id, '') }} />
                    Other:
                    {otherActive[q.id] && (
                      <input value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)}
                        className="flex-1 px-2 py-1 rounded border text-sm outline-none" style={inputStyle} />
                    )}
                  </label>
                )}
              </div>
            )}

            {q.type === 'checkboxes' && (
              <div className="space-y-1.5">
                {(q.options || []).map(opt => (
                  <label key={opt.id} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--white-soft)' }}>
                    <input type="checkbox" checked={Array.isArray(answers[q.id]) && answers[q.id].includes(opt.text)}
                      onChange={() => toggleCheckbox(q.id, opt.text)} />
                    {opt.text}
                  </label>
                ))}
                {q.allow_other && (
                  <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--white-soft)' }}>
                    <input type="checkbox" checked={!!otherActive[q.id]}
                      onChange={() => {
                        const next = !otherActive[q.id]
                        setOtherActive(p => ({ ...p, [q.id]: next }))
                        if (!next) {
                          const cur: string[] = Array.isArray(answers[q.id]) ? answers[q.id] : []
                          setAnswer(q.id, cur.filter((v: string) => !v.startsWith('Other: ')))
                        }
                      }} />
                    Other:
                    {otherActive[q.id] && (
                      <input onChange={e => {
                        const cur: string[] = (Array.isArray(answers[q.id]) ? answers[q.id] : []).filter((v: string) => !v.startsWith('Other: '))
                        setAnswer(q.id, e.target.value ? [...cur, `Other: ${e.target.value}`] : cur)
                      }} className="flex-1 px-2 py-1 rounded border text-sm outline-none" style={inputStyle} />
                    )}
                  </label>
                )}
              </div>
            )}

            {q.type === 'dropdown' && (
              <div>
                <select
                  value={otherActive[q.id] ? '__other__' : (answers[q.id] || '')}
                  onChange={e => {
                    if (e.target.value === '__other__') { setOtherActive(p => ({ ...p, [q.id]: true })); setAnswer(q.id, '') }
                    else { setOtherActive(p => ({ ...p, [q.id]: false })); setAnswer(q.id, e.target.value) }
                  }}
                  className={inputClass} style={inputStyle}>
                  <option value="">Select...</option>
                  {(q.options || []).map(opt => <option key={opt.id} value={opt.text}>{opt.text}</option>)}
                  {q.allow_other && <option value="__other__">Other…</option>}
                </select>
                {q.allow_other && otherActive[q.id] && (
                  <input placeholder="Please specify" value={answers[q.id] || ''} onChange={e => setAnswer(q.id, e.target.value)}
                    className={inputClass + ' mt-2'} style={inputStyle} />
                )}
              </div>
            )}

            {q.type === 'linear_scale' && (
              <div className="flex items-center gap-2 flex-wrap">
                {q.scale_min_label && <span className="text-xs" style={{ color: 'var(--muted)' }}>{q.scale_min_label}</span>}
                {Array.from({ length: (q.scale_max ?? 5) - (q.scale_min ?? 1) + 1 }, (_, i) => (q.scale_min ?? 1) + i).map(n => (
                  <button key={n} type="button" onClick={() => setAnswer(q.id, n)}
                    className="w-9 h-9 rounded-full text-xs font-bold border flex items-center justify-center transition-colors"
                    style={{
                      borderColor: answers[q.id] === n ? 'var(--blue)' : 'var(--border)',
                      background: answers[q.id] === n ? 'var(--blue)' : 'transparent',
                      color: answers[q.id] === n ? '#000' : 'var(--muted)',
                    }}>{n}</button>
                ))}
                {q.scale_max_label && <span className="text-xs" style={{ color: 'var(--muted)' }}>{q.scale_max_label}</span>}
              </div>
            )}
          </div>
        ))}
      </div>

      {error && <p className="text-xs mt-4" style={{ color: 'var(--danger-soft)' }}>{error}</p>}

      <button onClick={submit} disabled={submitting}
        className="mt-6 w-full py-2.5 rounded-lg text-sm font-black disabled:opacity-50 flex items-center justify-center gap-2"
        style={{ background: 'var(--blue)', color: '#000', fontFamily: "'Orbitron', sans-serif" }}>
        {submitting ? <><Loader2 size={15} className="animate-spin" /> SUBMITTING...</> : 'SUBMIT RESPONSE'}
      </button>
    </div>
  )
}
