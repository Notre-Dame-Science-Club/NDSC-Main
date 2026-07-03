'use client'
import { useEffect, useState, useRef } from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, MapPin, Clock, Edit2, Save, Users, Upload, CheckCircle, FileText, ExternalLink, BookOpen, Play } from 'lucide-react'

const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--white)' }
const inputCls = 'w-full px-3 py-2.5 rounded-lg text-sm outline-none'
const STORAGE_KEY = 'ndsc_activity_reg_id'

// ── helpers ──────────────────────────────────────────────────────────────────

function Countdown({ target }: { target: string }) {
  const [diff, setDiff] = useState(0)
  useEffect(() => {
    const tick = () => setDiff(Math.max(0, new Date(target).getTime() - Date.now()))
    tick()
    const t = setInterval(tick, 1000)
    return () => clearInterval(t)
  }, [target])
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  const s = Math.floor((diff % 60000) / 1000)
  return <span>{h}h {m}m {s}s</span>
}

// ── main component ────────────────────────────────────────────────────────────

export default function ActivityDashboardPage() {
  const params = useParams()
  const searchParams = useSearchParams()
  const slug = params.slug as string

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [registration, setRegistration] = useState<any>(null)
  const [category, setCategory] = useState<any>(null)
  const [session, setSession] = useState<any>(null)
  const [viewAsTeamMemberId, setViewAsTeamMemberId] = useState<string | null>(null)

  // Team member login
  const [showTeamLogin, setShowTeamLogin] = useState(false)
  const [teamEmail, setTeamEmail] = useState('')
  const [teamPassword, setTeamPassword] = useState('')
  const [teamLoginError, setTeamLoginError] = useState('')
  const [teamLoginLoading, setTeamLoginLoading] = useState(false)

  // Edit mode
  const [editing, setEditing] = useState(false)
  const [editForm, setEditForm] = useState<any>({})
  const [saving, setSaving] = useState(false)

  // Submissions
  const [submissions, setSubmissions] = useState<any[]>([])
  const [submissionAnswers, setSubmissionAnswers] = useState<Record<string, any>>({})
  const [submitting, setSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState('')
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [uploadingField, setUploadingField] = useState<string | null>(null)

  // Olympiad / relay
  const [olympiad, setOlympiad] = useState<any>(null)
  const [relayState, setRelayState] = useState<any>(null)
  const [subjectAssignments, setSubjectAssignments] = useState<any[]>([])
  const [selectedSubject, setSelectedSubject] = useState<string>('')
  const [examScheduledStart, setExamScheduledStart] = useState<string | null>(null)
  const [examStarted, setExamStarted] = useState(false)

  const loadRegistration = async (id: string) => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/activity-register?id=${id}`)
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Registration not found.'); setLoading(false); return }
      setRegistration(data.registration)
      setCategory(data.category)
      setSession(data.session)
      setEditForm({
        full_name: data.registration.full_name, phone: data.registration.phone,
        email: data.registration.email, college: data.registration.college,
        college_roll: data.registration.college_roll, hsc_session: data.registration.hsc_session || '',
      })
      localStorage.setItem(STORAGE_KEY, id)

      // Load submissions
      const subRes = await fetch(`/api/activity-submission?registration_id=${id}`)
      if (subRes.ok) {
        const subData = await subRes.json()
        setSubmissions(subData.submissions || [])
        if (subData.submissions?.length > 0) {
          setSubmissionAnswers(subData.submissions[0].answers || {})
        }
      }

      // If online submission → load olympiad + relay state
      if (data.category?.is_online_submission && data.category?.linked_olympiad_id) {
        const [olyRes, relayRes] = await Promise.all([
          fetch(`/api/olympiad?id=${data.category.linked_olympiad_id}`),
          fetch(`/api/relay-exam?registration_id=${id}&olympiad_id=${data.category.linked_olympiad_id}`),
        ])
        if (olyRes.ok) {
          const olyData = await olyRes.json()
          setOlympiad(olyData.olympiad || null)
          if (olyData.olympiad?.scheduled_start_at) setExamScheduledStart(olyData.olympiad.scheduled_start_at)
        }
        if (relayRes.ok) {
          const relayData = await relayRes.json()
          setRelayState(relayData.state)
        }
      }
    } catch {
      setError('Network error while loading your dashboard.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    const regId = searchParams.get('reg') || localStorage.getItem(STORAGE_KEY)
    if (regId) loadRegistration(regId)
    else setLoading(false)
  }, [])

  const paymentRedirectStatus = searchParams.get('payment')

  const teamLogin = async () => {
    setTeamLoginError('')
    if (!teamEmail.trim() || !teamPassword) { setTeamLoginError('Email and password are required.'); return }
    setTeamLoginLoading(true)
    try {
      const res = await fetch('/api/activity-team-login', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: teamEmail.trim(), password: teamPassword }),
      })
      const data = await res.json()
      if (!res.ok) { setTeamLoginError(data.error || 'Login failed.'); setTeamLoginLoading(false); return }
      setViewAsTeamMemberId(data.team_member_id)
      await loadRegistration(data.registration_id)
    } catch { setTeamLoginError('Network error. Please try again.') }
    finally { setTeamLoginLoading(false) }
  }

  const isEditWindowOpen = () => {
    if (!registration?.edit_locked_at) return true
    return new Date(registration.edit_locked_at).getTime() > Date.now()
  }

  const saveEdit = async () => {
    setSaving(true)
    try {
      const res = await fetch('/api/activity-register', {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: registration.id, ...editForm }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not save changes.'); setSaving(false); return }
      setRegistration((prev: any) => ({ ...prev, ...editForm }))
      setEditing(false)
    } catch { setError('Network error while saving.') }
    finally { setSaving(false) }
  }

  // ── File upload for submission fields ────────────────────────────────────
  const uploadFile = (file: File, allowedTypes?: string[], maxSizeMb?: number): Promise<string> => new Promise((resolve, reject) => {
    const fd = new FormData()
    fd.append('file', file)
    if (allowedTypes?.length) fd.append('allowed_types', allowedTypes.join(','))
    if (maxSizeMb) fd.append('max_size_mb', String(maxSizeMb))
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

  const handleFileField = async (fieldId: string, file: File | null, maxFiles: number) => {
    if (!file) return
    const field = (category?.submission_config || []).find((f: any) => f.id === fieldId)
    setUploadingField(fieldId)
    setSubmitError('')
    try {
      const url = await uploadFile(file, field?.file_types, field?.max_file_size_mb)
      setSubmissionAnswers(prev => {
        const existing: string[] = Array.isArray(prev[fieldId]) ? prev[fieldId] : (prev[fieldId] ? [prev[fieldId]] : [])
        const updated = maxFiles === 1 ? [url] : [...existing, url].slice(0, maxFiles)
        return { ...prev, [fieldId]: updated }
      })
    } catch (e: any) { setSubmitError(e.message || 'Upload failed.') }
    finally { setUploadingField(null) }
  }

  const removeFileFromField = (fieldId: string, index: number) => {
    setSubmissionAnswers(prev => {
      const arr: string[] = Array.isArray(prev[fieldId]) ? [...prev[fieldId]] : []
      arr.splice(index, 1)
      return { ...prev, [fieldId]: arr }
    })
  }

  // ── Submit submission ─────────────────────────────────────────────────────
  const submitAnswers = async (isFinal: boolean) => {
    setSubmitting(true)
    setSubmitError('')
    const submittedBy = viewAsTeamMemberId || 'leader'
    try {
      const res = await fetch('/api/activity-submission', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          registration_id: registration.id,
          submitted_by: submittedBy,
          answers: submissionAnswers,
          is_final: isFinal,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Submission failed.')
      setSubmitSuccess(true)
      setSubmissions(prev => {
        const idx = prev.findIndex(s => s.submitted_by === submittedBy)
        if (idx >= 0) { const n = [...prev]; n[idx] = data.submission; return n }
        return [data.submission, ...prev]
      })
    } catch (e: any) { setSubmitError(e.message) }
    finally { setSubmitting(false) }
  }

  // ── Subject assignment ────────────────────────────────────────────────────
  const assignSubject = async (subjectId: string) => {
    if (!olympiad || !registration) return
    const memberId = viewAsTeamMemberId || 'leader'
    try {
      const res = await fetch('/api/relay-exam', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'assign_subject',
          registration_id: registration.id,
          olympiad_id: olympiad.id,
          member_id: memberId,
          subject_id: subjectId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setSelectedSubject(subjectId)
    } catch (e: any) { setSubmitError(e.message) }
  }

  // ── Relay: start / submit member ─────────────────────────────────────────
  const startRelay = async () => {
    if (!olympiad || !registration) return
    try {
      const res = await fetch('/api/relay-exam', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'start', registration_id: registration.id, olympiad_id: olympiad.id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setRelayState(data.state)
    } catch (e: any) { setSubmitError(e.message) }
  }

  // ─────────────────────────────────────────────────────────────────────────
  if (loading) return <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}><p style={{ color: 'var(--muted)' }}>Loading your dashboard...</p></div>

  if (!registration) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--bg)', paddingTop: '88px' }}>
        <div className="max-w-sm w-full">
          <Link href={`/activities/${slug}`} className="inline-flex items-center gap-2 text-sm mb-6" style={{ color: 'var(--muted)' }}>
            <ArrowLeft size={14} /> Back to activity
          </Link>
          {error && <p className="text-sm mb-4" style={{ color: 'var(--danger-soft)' }}>{error}</p>}
          {!showTeamLogin ? (
            <div className="rounded-2xl p-6 border text-center" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
              <p className="text-sm mb-4" style={{ color: 'var(--white)' }}>We couldn't find your registration on this device.</p>
              <button onClick={() => setShowTeamLogin(true)} className="text-sm underline" style={{ color: 'var(--blue)' }}>
                Are you a team member? Log in here →
              </button>
            </div>
          ) : (
            <div className="rounded-2xl p-6 border" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
              <p className="text-sm font-semibold mb-3" style={{ color: 'var(--white)' }}>Team Member Login</p>
              <div className="space-y-2">
                <input placeholder="Email" value={teamEmail} onChange={e => setTeamEmail(e.target.value)} className={inputCls} style={inputStyle} />
                <input type="password" placeholder="Password" value={teamPassword} onChange={e => setTeamPassword(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
              {teamLoginError && <p className="text-xs mt-2" style={{ color: 'var(--danger-soft)' }}>{teamLoginError}</p>}
              <button onClick={teamLogin} disabled={teamLoginLoading}
                className="w-full mt-3 py-2.5 rounded-lg text-sm font-bold text-black disabled:opacity-60" style={{ background: 'var(--blue)' }}>
                {teamLoginLoading ? 'Logging in...' : 'Log In'}
              </button>
            </div>
          )}
        </div>
      </div>
    )
  }

  const viewingMember = viewAsTeamMemberId
    ? (registration.team_members || []).find((m: any) => m.id === viewAsTeamMemberId)
    : null
  const editWindowOpen = isEditWindowOpen()

  // Determine current user's submission
  const mySubmittedBy = viewAsTeamMemberId || 'leader'
  const mySubmission = submissions.find(s => s.submitted_by === mySubmittedBy)
  const submissionConfig: any[] = category?.submission_config || []
  const hasSubmissionConfig = submissionConfig.length > 0
  const canSubmit = category?.submission_who === 'any_member' || mySubmittedBy === 'leader'

  // Relay: can this member go now?
  const teamMembers: any[] = registration.team_members || []
  const allMembers = [{ id: 'leader', full_name: registration.full_name }, ...teamMembers]
  const relayCurrentIndex = relayState?.current_member_index ?? 0
  const myRelayIndex = allMembers.findIndex(m => m.id === mySubmittedBy)
  const isMyRelayTurn = olympiad?.relay_mode ? myRelayIndex === relayCurrentIndex : true

  // Exam schedule
  const examNotYetStarted = examScheduledStart && new Date(examScheduledStart) > new Date()
  const examEnded = olympiad?.scheduled_end_at && new Date(olympiad.scheduled_end_at) < new Date()

  return (
    <div className="min-h-screen py-12 px-4" style={{ background: 'var(--bg)', paddingTop: '88px' }}>
      <div className="max-w-lg mx-auto space-y-5">

        <Link href={`/activities/${slug}`} className="inline-flex items-center gap-2 text-sm" style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={14} /> Back to activity
        </Link>

        <div>
          <h1 className="text-2xl font-black mb-1" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--white)' }}>
            {session?.title}
          </h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{category?.name}</p>
          {registration.project_name && (
            <p className="text-sm mt-1 font-semibold" style={{ color: 'var(--blue)' }}>🔬 {registration.project_name}</p>
          )}
          {viewingMember && (
            <span className="text-xs mt-1 px-2.5 py-1 rounded-full inline-block" style={{ background: 'rgba(var(--accent2-rgb), 0.1)', color: 'var(--accent2)' }}>
              Viewing as: {viewingMember.full_name}
            </span>
          )}
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--danger-soft)' }}>{error}</p>}

        {paymentRedirectStatus && (
          <div className="rounded-xl p-4 text-sm" style={{
            background: paymentRedirectStatus === 'success' ? 'rgba(var(--success-rgb), 0.08)' : 'rgba(var(--danger-rgb), 0.08)',
            color: paymentRedirectStatus === 'success' ? 'var(--success)' : 'var(--danger-soft)',
            border: `1px solid ${paymentRedirectStatus === 'success' ? 'rgba(var(--success-rgb), 0.25)' : 'rgba(var(--danger-rgb), 0.25)'}`,
          }}>
            {paymentRedirectStatus === 'success' && '✅ Payment received! It may take a moment to fully confirm below.'}
            {paymentRedirectStatus === 'failed' && '❌ Payment failed. You can try again from your dashboard.'}
            {paymentRedirectStatus === 'cancelled' && '⚠️ Payment was cancelled.'}
          </div>
        )}

        {/* ── Schedule ──────────────────────────────────────────────────── */}
        {category?.schedule_date && (
          <div className="rounded-xl p-4 space-y-1.5" style={{ background: 'rgba(var(--cat-teal-rgb), 0.08)', border: '1px solid rgba(var(--cat-teal-rgb), 0.25)' }}>
            <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--cat-teal)' }}>
              <Calendar size={14} /> Your Schedule
            </p>
            <p className="text-sm" style={{ color: 'var(--white)' }}>
              {new Date(category.schedule_date).toLocaleDateString('en-BD', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
            {category.schedule_time && <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><Clock size={12} /> {category.schedule_time}</p>}
            {category.schedule_room && <p className="text-sm flex items-center gap-1.5" style={{ color: 'var(--muted)' }}><MapPin size={12} /> {category.schedule_room}</p>}
          </div>
        )}

        {/* ── Payment ───────────────────────────────────────────────────── */}
        {registration.payment_status !== 'not_required' && (
          <div className="rounded-xl p-4" style={{
            background: registration.payment_status === 'paid' ? 'rgba(var(--success-rgb), 0.08)' : 'rgba(var(--warning-rgb), 0.08)',
            border: `1px solid ${registration.payment_status === 'paid' ? 'rgba(var(--success-rgb), 0.25)' : 'rgba(var(--warning-rgb), 0.25)'}`,
          }}>
            <p className="text-sm font-bold" style={{ color: registration.payment_status === 'paid' ? 'var(--success)' : 'var(--warning)' }}>
              💳 Payment: {registration.payment_status === 'paid' ? 'Completed ✓' : registration.payment_status === 'pending' ? 'Pending verification' : 'Failed'}
            </p>
            {registration.payment_amount && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>৳{registration.payment_amount}</p>}
          </div>
        )}

        {/* ── Online Submission / Exam Section ─────────────────────────── */}
        {category?.is_online_submission && (
          <div className="rounded-xl p-5 space-y-4" style={{ background: 'rgba(var(--blue-rgb), 0.05)', border: '1px solid rgba(var(--blue-rgb), 0.25)' }}>
            <p className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--blue)', fontFamily: "'Orbitron', sans-serif" }}>
              <ExternalLink size={14} /> Online Round
            </p>

            {/* Exam scheduled but not started yet */}
            {examNotYetStarted && (
              <div className="text-sm" style={{ color: 'var(--warning)' }}>
                ⏳ Exam starts in: <strong><Countdown target={examScheduledStart!} /></strong>
                <br /><span style={{ color: 'var(--muted)', fontSize: '0.75rem' }}>
                  {new Date(examScheduledStart!).toLocaleString('en-BD', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                </span>
              </div>
            )}

            {/* Exam ended */}
            {examEnded && (
              <p className="text-sm" style={{ color: 'var(--danger-soft)' }}>⛔ Submission window has closed.</p>
            )}

            {/* Subject assignment */}
            {!examNotYetStarted && !examEnded && olympiad?.subjects?.length > 0 && olympiad.subject_assignment_mode === 'self_select' && (
              <div>
                <p className="text-xs font-semibold mb-2" style={{ color: 'var(--muted)' }}>Select your subject</p>
                <div className="flex flex-wrap gap-2">
                  {(olympiad.subjects as any[]).map((sub: any) => (
                    <button key={sub.id} onClick={() => assignSubject(sub.id)}
                      className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-all"
                      style={{
                        background: selectedSubject === sub.id ? 'var(--blue)' : 'rgba(255,255,255,0.05)',
                        color: selectedSubject === sub.id ? '#000' : 'var(--white)',
                        border: `1px solid ${selectedSubject === sub.id ? 'var(--blue)' : 'var(--border)'}`,
                      }}>
                      <BookOpen size={10} className="inline mr-1" />
                      {sub.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Relay status */}
            {olympiad?.relay_mode && relayState && (
              <div className="text-sm space-y-1" style={{ color: 'var(--muted)' }}>
                <p className="font-semibold" style={{ color: 'var(--white)' }}>Team Relay Progress</p>
                {allMembers.map((m, i) => {
                  const done = (relayState.member_submissions as any[]).find((s: any) => s.member_id === m.id)
                  const isCurrent = i === relayCurrentIndex
                  return (
                    <div key={m.id} className="flex items-center gap-2">
                      <span style={{ color: done ? 'var(--cat-teal)' : isCurrent ? 'var(--blue)' : 'var(--muted)' }}>
                        {done ? '✅' : isCurrent ? '▶' : '⏸'}
                      </span>
                      <span style={{ color: done ? 'var(--cat-teal)' : isCurrent ? 'var(--white)' : 'var(--muted)' }}>
                        {m.full_name} {i === 0 ? '(Leader)' : ''}
                      </span>
                    </div>
                  )
                })}
              </div>
            )}

            {/* Relay: not my turn yet */}
            {olympiad?.relay_mode && !isMyRelayTurn && !relayState?.completed_at && (
              <p className="text-sm" style={{ color: 'var(--warning)' }}>
                ⏳ Waiting for the previous team member to complete their round…
              </p>
            )}

            {/* Relay: start button (only leader can start) */}
            {olympiad?.relay_mode && !relayState && mySubmittedBy === 'leader' && !examNotYetStarted && !examEnded && (
              <button onClick={startRelay}
                className="w-full py-3 rounded-xl font-bold text-sm text-black"
                style={{ background: 'var(--blue)', fontFamily: "'Orbitron', sans-serif" }}>
                <Play size={14} className="inline mr-2" />Start Team Relay
              </button>
            )}

            {/* Live exam button */}
            {olympiad && !hasSubmissionConfig && !examNotYetStarted && !examEnded && isMyRelayTurn && !mySubmission && (
              <Link href={`/activities/${slug}/relay-exam?reg=${registration.id}&olympiad=${olympiad.id}&member=${mySubmittedBy}`}
                className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-bold text-sm text-black"
                style={{ background: 'var(--blue)', fontFamily: "'Orbitron', sans-serif" }}>
                <Play size={14} /> Start Exam →
              </Link>
            )}

            {/* File/text submission form */}
            {hasSubmissionConfig && canSubmit && !examNotYetStarted && !examEnded && isMyRelayTurn && (
              <div className="space-y-4">
                <p className="text-sm font-semibold" style={{ color: 'var(--white)' }}>
                  {mySubmission?.is_final ? '✅ Submitted' : mySubmission ? 'Update Submission' : 'Submit Now'}
                </p>

                {mySubmission?.is_final ? (
                  <p className="text-xs" style={{ color: 'var(--cat-teal)' }}>Your submission is finalised and can no longer be changed.</p>
                ) : (
                  <>
                    {submitError && <p className="text-xs" style={{ color: 'var(--danger-soft)' }}>{submitError}</p>}
                    {submitSuccess && <p className="text-xs" style={{ color: 'var(--cat-teal)' }}>Saved successfully!</p>}

                    {submissionConfig.map((field: any) => (
                      <div key={field.id}>
                        <label className="block text-sm font-medium mb-1" style={{ color: 'var(--white)' }}>
                          {field.title} {field.required && <span style={{ color: 'var(--blue)' }}>*</span>}
                        </label>
                        {field.description && <p className="text-xs mb-1.5" style={{ color: 'var(--muted)' }}>{field.description}</p>}

                        {field.field_type === 'file' ? (
                          <div className="space-y-2">
                            {/* Existing uploaded files */}
                            {(Array.isArray(submissionAnswers[field.id]) ? submissionAnswers[field.id] : submissionAnswers[field.id] ? [submissionAnswers[field.id]] : []).map((url: string, idx: number) => (
                              <div key={idx} className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg" style={{ background: 'rgba(var(--blue-rgb), 0.06)', border: '1px solid rgba(var(--blue-rgb), 0.2)' }}>
                                <FileText size={12} style={{ color: 'var(--blue)' }} />
                                <span style={{ color: 'var(--white)', flex: 1, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                  {url.split('/').pop()}
                                </span>
                                <a href={url} target="_blank" rel="noopener noreferrer" style={{ color: 'var(--blue)' }}><ExternalLink size={11} /></a>
                                <button onClick={() => removeFileFromField(field.id, idx)} style={{ color: 'var(--danger-soft)' }}>✕</button>
                              </div>
                            ))}
                            {/* Upload button */}
                            {(Array.isArray(submissionAnswers[field.id]) ? submissionAnswers[field.id] : [submissionAnswers[field.id]].filter(Boolean)).length < (field.max_files || 1) && (
                              <label className="flex items-center gap-2 px-3 py-2.5 rounded-lg border cursor-pointer text-sm"
                                style={{ ...inputStyle, color: uploadingField === field.id ? 'var(--warning)' : 'var(--blue)' }}>
                                <Upload size={14} />
                                {uploadingField === field.id ? 'Uploading…' : `Upload ${field.field_type === 'file' ? (field.file_types?.join(', ') || 'file') : 'file'} (max ${field.max_file_size_mb || 5}MB)`}
                                <input type="file"
                                  accept={field.file_types?.map((t: string) => `.${t}`).join(',') || undefined}
                                  className="hidden"
                                  disabled={uploadingField === field.id}
                                  onChange={e => handleFileField(field.id, e.target.files?.[0] || null, field.max_files || 1)} />
                              </label>
                            )}
                          </div>
                        ) : field.field_type === 'textarea' ? (
                          <textarea rows={4} value={submissionAnswers[field.id] || ''} onChange={e => setSubmissionAnswers(p => ({ ...p, [field.id]: e.target.value }))}
                            className={inputCls + ' resize-none'} style={inputStyle} />
                        ) : (
                          <input value={submissionAnswers[field.id] || ''} onChange={e => setSubmissionAnswers(p => ({ ...p, [field.id]: e.target.value }))}
                            className={inputCls} style={inputStyle} />
                        )}
                      </div>
                    ))}

                    <div className="flex gap-2 pt-1">
                      <button onClick={() => submitAnswers(false)} disabled={submitting}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold disabled:opacity-60"
                        style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
                        {submitting ? 'Saving…' : 'Save Draft'}
                      </button>
                      <button onClick={() => submitAnswers(true)} disabled={submitting}
                        className="flex-1 py-2.5 rounded-xl text-sm font-bold text-black disabled:opacity-60"
                        style={{ background: 'var(--blue)', fontFamily: "'Orbitron', sans-serif" }}>
                        {submitting ? 'Submitting…' : 'Submit Final ✓'}
                      </button>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>
                      ⚠️ Final submission cannot be changed. Save as draft to continue later.
                    </p>
                  </>
                )}
              </div>
            )}

            {/* View olympiad page link */}
            {olympiad && (
              <Link href={`/olympiad?id=${olympiad.id}`} className="flex items-center gap-1 text-xs underline" style={{ color: 'var(--muted)' }}>
                View Olympiad page <ExternalLink size={10} />
              </Link>
            )}
          </div>
        )}

        {/* ── Registration Info ────────────────────────────────────────── */}
        {!viewingMember && (
          <div className="rounded-xl p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-3">
              <p className="text-sm font-bold" style={{ color: 'var(--white)' }}>Your Information</p>
              {editWindowOpen && !editing && (
                <button onClick={() => setEditing(true)} className="flex items-center gap-1 text-xs" style={{ color: 'var(--blue)' }}>
                  <Edit2 size={12} /> Edit
                </button>
              )}
            </div>
            {!editWindowOpen && <p className="text-xs mb-3" style={{ color: 'var(--warning)' }}>The edit window for this registration has closed.</p>}
            {editing ? (
              <div className="space-y-2">
                {(['full_name', 'phone', 'email', 'college', 'college_roll', 'hsc_session'] as const).map(key => (
                  <input key={key} value={editForm[key] || ''} onChange={e => setEditForm((p: any) => ({ ...p, [key]: e.target.value }))}
                    placeholder={key.replace(/_/g, ' ')} className={inputCls} style={inputStyle} />
                ))}
                <div className="flex gap-2 pt-1">
                  <button onClick={saveEdit} disabled={saving} className="flex-1 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-60" style={{ background: 'var(--blue)' }}>
                    <Save size={13} className="inline mr-1" />{saving ? 'Saving...' : 'Save'}
                  </button>
                  <button onClick={() => setEditing(false)} className="px-4 py-2 rounded-lg text-sm" style={{ color: 'var(--muted)' }}>Cancel</button>
                </div>
              </div>
            ) : (
              <div className="space-y-1.5 text-sm">
                {[['Name', registration.full_name], ['Phone', registration.phone], ['Email', registration.email],
                  ['College', registration.college], ['Roll', registration.college_roll],
                  ['HSC Session', registration.hsc_session]].filter(([, v]) => v).map(([label, val]) => (
                  <p key={label as string} style={{ color: 'var(--muted)' }}>{label as string}: <span style={{ color: 'var(--white)' }}>{val as string}</span></p>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Team Members ──────────────────────────────────────────────── */}
        {(registration.team_members || []).length > 0 && (
          <div className="rounded-xl p-5" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <p className="text-sm font-bold flex items-center gap-2 mb-3" style={{ color: 'var(--accent2)' }}>
              <Users size={14} /> Team Members
            </p>
            <div className="space-y-2">
              {registration.team_members.map((m: any) => (
                <div key={m.id} className="flex items-center justify-between text-sm">
                  <span style={{ color: m.id === viewAsTeamMemberId ? 'var(--accent2)' : 'var(--white)' }}>
                    {m.full_name} {m.id === viewAsTeamMemberId && <span style={{ color: 'var(--accent2)' }}>(you)</span>}
                  </span>
                  {relayState && (
                    <span className="text-xs" style={{ color: (relayState.member_submissions as any[]).find((s: any) => s.member_id === m.id) ? 'var(--cat-teal)' : 'var(--muted)' }}>
                      {(relayState.member_submissions as any[]).find((s: any) => s.member_id === m.id) ? '✅ Done' : '⏳ Pending'}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
