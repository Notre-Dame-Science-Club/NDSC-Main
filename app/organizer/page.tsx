'use client'
import { useState, useEffect } from 'react'
import { Clock, Eye } from 'lucide-react'
import AnnotationViewer, { Annotation } from '@/components/olympiad/AnnotationViewer'

type Reg = {
  id: string; full_name: string; phone: string; email?: string; college?: string
  college_roll?: string; batch?: string; group_name?: string; answer_sheet_url?: string
  mcq_score?: number; final_score?: number; review_status?: string; created_at: string
  custom_answers?: Record<string, string>; mcq_answers?: Record<string, string>
  annotations?: Annotation[]; organizer_note?: string
}

type Olympiad = { id: string; name: string; mode: string; questions?: any[] }

export default function OrganizerPage() {
  const [step, setStep] = useState<'login' | 'select' | 'review'>('login')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [olympiads, setOlympiads] = useState<Olympiad[]>([])
  const [selected, setSelected] = useState<Olympiad | null>(null)
  const [regs, setRegs] = useState<Reg[]>([])
  const [loading, setLoading] = useState(false)
  const [checkingSession, setCheckingSession] = useState(true)
  const [viewingReg, setViewingReg] = useState<Reg | null>(null)
  const [filter, setFilter] = useState<'all' | 'pending' | 'reviewed'>('all')

  // On mount, see if the httpOnly cookie from a previous login is still valid —
  // we never store the password itself client-side, just ask the server "am I still logged in?"
  useEffect(() => {
    (async () => {
      try {
        const res = await fetch('/api/organizer/olympiads')
        if (res.ok) {
          const data = await res.json()
          setOlympiads(data.olympiads || [])
          setStep('select')
        }
      } catch {
        // ignore — just show the login screen
      } finally {
        setCheckingSession(false)
      }
    })()
  }, [])

  const doLogin = async (pwd: string) => {
    if (!pwd) return
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/organizer/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password: pwd }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || 'Incorrect password.')
        setLoading(false)
        return
      }
      setOlympiads(data.olympiads || [])
      setStep('select')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const selectOlympiad = async (o: Olympiad) => {
    setSelected(o); setLoading(true)
    try {
      const res = await fetch(`/api/organizer/registrations?olympiadId=${o.id}`)
      const data = await res.json()
      if (res.ok) setRegs(data.registrations || [])
      setStep('review')
    } finally {
      setLoading(false)
    }
  }

  const saveAnnotatedScore = async (regId: string, data: { score: number; annotations: Annotation[]; organizerNote: string }) => {
    const res = await fetch('/api/organizer/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        regId,
        score: data.score,
        annotations: data.annotations,
        organizer_note: data.organizerNote,
      }),
    })
    if (res.ok) {
      setRegs(prev => prev.map(r => r.id === regId
        ? { ...r, final_score: data.score, review_status: 'reviewed', annotations: data.annotations, organizer_note: data.organizerNote }
        : r))
    } else {
      const d = await res.json().catch(() => ({}))
      throw new Error(d.error || 'Could not save. Please try again.')
    }
  }

  const logout = async () => {
    await fetch('/api/organizer/logout', { method: 'POST' })
    setStep('login'); setPassword(''); setOlympiads([]); setSelected(null); setRegs([])
  }

  const filteredRegs = regs.filter(r => {
    if (filter === 'pending') return !r.review_status || r.review_status === 'pending'
    if (filter === 'reviewed') return r.review_status === 'reviewed'
    return true
  })

  const inpStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg3)', paddingTop: 72 }}>
        <p style={{ color: 'var(--muted)' }}>Loading...</p>
      </div>
    )
  }

  // ---- LOGIN ----
  if (step === 'login') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg3)', paddingTop: 72 }}>
      <div className="w-full max-w-sm p-8 rounded-2xl border" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
        <h1 className="text-2xl font-black mb-2 text-center" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }}>ORGANIZER</h1>
        <p className="text-xs text-center mb-6" style={{ color: 'var(--muted)' }}>Review panel for NDSC Olympiad submissions</p>
        <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Organizer Password</label>
        <input type="password" className="w-full px-4 py-3 rounded-lg text-sm border outline-none mb-4"
          style={inpStyle} value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doLogin(password)} placeholder="Enter organizer password" />
        {error && <p className="text-xs mb-3" style={{ color: 'var(--danger-soft)' }}>{error}</p>}
        <button onClick={() => doLogin(password)} disabled={loading}
          className="w-full py-3 font-black text-sm rounded-lg disabled:opacity-50"
          style={{ background: 'var(--blue)', color: '#000', fontFamily: "'Orbitron', sans-serif" }}>
          {loading ? 'CHECKING...' : 'LOGIN →'}
        </button>
      </div>
    </div>
  )

  // ---- SELECT OLYMPIAD ----
  if (step === 'select') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg3)', paddingTop: 72 }}>
      <div className="w-full max-w-md p-8 rounded-2xl border" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-black" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }}>Select Olympiad</h1>
          <button onClick={logout} className="text-xs px-3 py-1 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>Logout</button>
        </div>
        <div className="space-y-3">
          {olympiads.map(o => (
            <button key={o.id} onClick={() => selectOlympiad(o)} disabled={loading}
              className="w-full text-left p-4 rounded-xl border transition-all hover:border-[var(--blue)]"
              style={{ borderColor: 'var(--border)', background: 'var(--bg3)', color: 'var(--white)' }}>
              <p className="font-bold">{o.name}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{o.mode === 'online_mcq' ? 'Online MCQ' : 'Photo Submit'}</p>
            </button>
          ))}
          {olympiads.length === 0 && (
            <p className="text-sm text-center" style={{ color: 'var(--muted)' }}>No olympiads assigned to this organizer account yet.</p>
          )}
        </div>
      </div>
    </div>
  )

  // ---- REVIEW ----
  return (
    <div className="min-h-screen" style={{ background: 'var(--bg3)', paddingTop: 72 }}>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => { setStep(olympiads.length > 1 ? 'select' : 'select'); setSelected(null) }}
              className="text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>
              ← Back
            </button>
            <div>
              <h1 className="text-xl font-black" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }}>{selected?.name}</h1>
              <p className="text-xs" style={{ color: 'var(--muted)' }}>{regs.length} total submissions</p>
            </div>
          </div>
          <button onClick={logout} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: 'var(--border)', color: 'var(--muted)' }}>Logout</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total', value: regs.length, color: 'var(--blue)' },
            { label: 'Reviewed', value: regs.filter(r => r.review_status === 'reviewed').length, color: 'var(--success)' },
            { label: 'Pending', value: regs.filter(r => !r.review_status || r.review_status === 'pending').length, color: 'var(--warning)' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center border" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {(['all', 'pending', 'reviewed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold border capitalize"
              style={{
                borderColor: filter === f ? 'var(--blue)' : 'var(--border)',
                color: filter === f ? 'var(--blue)' : 'var(--muted)',
                background: filter === f ? 'rgba(var(--blue-rgb), 0.1)' : 'transparent',
              }}>{f}</button>
          ))}
        </div>

        {/* Submission Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRegs.map(r => (
            <div key={r.id} className="rounded-xl border overflow-hidden" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
              {r.answer_sheet_url && (
                <button onClick={() => setViewingReg(r)} className="relative h-40 w-full bg-black overflow-hidden block">
                  <img src={r.answer_sheet_url} alt="Answer sheet" className="w-full h-full object-cover opacity-80" />
                  <div className="absolute inset-0 flex items-center justify-center" style={{ background: 'rgba(0,0,0,0.4)' }}>
                    <Eye size={24} style={{ color: 'var(--blue)' }} />
                  </div>
                  {(r.annotations?.length ?? 0) > 0 && (
                    <span className="absolute top-2 right-2 text-xs px-2 py-0.5 rounded-full font-semibold"
                      style={{ background: 'rgba(var(--blue-rgb), 0.85)', color: '#001018' }}>
                      {r.annotations!.length} marks
                    </span>
                  )}
                </button>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-sm" style={{ color: 'var(--white)' }}>{r.full_name}</p>
                    <p className="text-xs" style={{ color: 'var(--muted)' }}>{r.phone}</p>
                    {r.college && <p className="text-xs" style={{ color: 'var(--muted)' }}>{r.college} {r.college_roll ? `· Roll: ${r.college_roll}` : ''}</p>}
                    {r.batch && <p className="text-xs" style={{ color: 'var(--muted)' }}>Batch: {r.batch} {r.group_name ? `· ${r.group_name}` : ''}</p>}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{
                    background: r.review_status === 'reviewed' ? 'rgba(var(--success-rgb), 0.1)' : 'rgba(255,165,0,0.1)',
                    color: r.review_status === 'reviewed' ? 'var(--success)' : 'var(--warning)',
                    border: `1px solid ${r.review_status === 'reviewed' ? 'rgba(var(--success-rgb), 0.3)' : 'rgba(255,165,0,0.3)'}`,
                  }}>{r.review_status || 'pending'}</span>
                </div>

                {r.custom_answers && Object.keys(r.custom_answers).length > 0 && (
                  <div className="mt-2 p-2 rounded-lg text-xs space-y-1" style={{ background: 'var(--bg3)' }}>
                    {Object.entries(r.custom_answers).map(([k, v]) => v ? (
                      <div key={k}><span style={{ color: 'var(--muted)' }}>{k}: </span><span style={{ color: 'var(--white)' }}>{v}</span></div>
                    ) : null)}
                  </div>
                )}

                {selected?.mode === 'online_mcq' && r.mcq_score != null && (
                  <div className="mt-2 text-sm" style={{ color: 'var(--muted)' }}>
                    Auto score: <span style={{ color: 'var(--success)', fontWeight: 'bold' }}>{r.mcq_score} / {selected.questions?.length || '?'}</span>
                  </div>
                )}

                <div className="mt-3">
                  <button onClick={() => setViewingReg(r)}
                    className="w-full py-1.5 rounded-lg text-xs font-semibold border"
                    style={{
                      borderColor: r.final_score != null ? 'rgba(var(--success-rgb), 0.3)' : 'var(--border)',
                      color: r.final_score != null ? 'var(--success)' : 'var(--muted)',
                      background: r.final_score != null ? 'rgba(var(--success-rgb), 0.05)' : 'transparent',
                    }}>
                    {r.final_score != null ? `Score: ${r.final_score} (review)` : (r.answer_sheet_url ? 'Mark & Score' : 'Score')}
                  </button>
                </div>
              </div>
            </div>
          ))}
          {filteredRegs.length === 0 && (
            <div className="col-span-3 text-center py-12" style={{ color: 'var(--muted)' }}>
              <Clock size={40} className="mx-auto mb-3 opacity-30" />
              <p>No submissions {filter !== 'all' ? `with status "${filter}"` : ''} yet.</p>
            </div>
          )}
        </div>
      </div>

      {/* Full annotation tool — only makes sense when there's an answer sheet image to mark up */}
      {viewingReg && viewingReg.answer_sheet_url && (
        <AnnotationViewer
          imageUrl={viewingReg.answer_sheet_url}
          initialAnnotations={viewingReg.annotations || []}
          initialScore={viewingReg.final_score ?? ''}
          initialNote={viewingReg.organizer_note || ''}
          onClose={() => setViewingReg(null)}
          onSave={data => saveAnnotatedScore(viewingReg.id, data)}
        />
      )}

      {/* Simple score-only modal for submissions with no photo to annotate (e.g. pure online MCQ) */}
      {viewingReg && !viewingReg.answer_sheet_url && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(2,8,16,0.85)' }}>
          <div className="w-full max-w-sm rounded-2xl border p-6" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
            <h2 className="font-bold text-sm mb-4" style={{ color: 'var(--blue)', fontFamily: "'Orbitron', sans-serif" }}>
              Score — {viewingReg.full_name}
            </h2>
            <ScoreOnlyForm reg={viewingReg} onClose={() => setViewingReg(null)} onSave={saveAnnotatedScore} />
          </div>
        </div>
      )}
    </div>
  )
}

function ScoreOnlyForm({ reg, onClose, onSave }: {
  reg: Reg
  onClose: () => void
  onSave: (regId: string, data: { score: number; annotations: Annotation[]; organizerNote: string }) => Promise<void>
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

  const inpStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Score</label>
        <input type="number" className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={inpStyle}
          value={score} onChange={e => setScore(e.target.value)} autoFocus />
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Note (optional)</label>
        <textarea rows={3} className="w-full px-3 py-2 rounded-lg text-sm border outline-none resize-none" style={inpStyle}
          value={note} onChange={e => setNote(e.target.value)} />
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
