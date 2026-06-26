'use client'
import { useState, useEffect } from 'react'
import { CheckCircle, XCircle, Clock, Eye } from 'lucide-react'

type Reg = {
  id: string; full_name: string; phone: string; email?: string; college?: string
  college_roll?: string; batch?: string; group_name?: string; answer_sheet_url?: string
  mcq_score?: number; final_score?: number; review_status?: string; created_at: string
  custom_answers?: Record<string, string>; mcq_answers?: Record<string, string>
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
  const [markingId, setMarkingId] = useState<string | null>(null)
  const [scoreInput, setScoreInput] = useState('')
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

  const saveScore = async (regId: string, score: string) => {
    const res = await fetch('/api/organizer/score', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ regId, score }),
    })
    if (res.ok) {
      setRegs(prev => prev.map(r => r.id === regId ? { ...r, final_score: Number(score), review_status: 'reviewed' } : r))
    }
    setMarkingId(null)
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

  const inpStyle = { background: '#0a1628', borderColor: '#0f2a4a', color: '#e8f4ff' }

  if (checkingSession) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: '#030a12', paddingTop: 72 }}>
        <p style={{ color: '#6a8faf' }}>Loading...</p>
      </div>
    )
  }

  // ---- LOGIN ----
  if (step === 'login') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#030a12', paddingTop: 72 }}>
      <div className="w-full max-w-sm p-8 rounded-2xl border" style={{ background: '#050d1a', borderColor: '#0f2a4a' }}>
        <h1 className="text-2xl font-black mb-2 text-center" style={{ fontFamily: "'Orbitron', sans-serif", color: '#00d4ff' }}>ORGANIZER</h1>
        <p className="text-xs text-center mb-6" style={{ color: '#6a8faf' }}>Review panel for NDSC Olympiad submissions</p>
        <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Organizer Password</label>
        <input type="password" className="w-full px-4 py-3 rounded-lg text-sm border outline-none mb-4"
          style={inpStyle} value={password} onChange={e => setPassword(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && doLogin(password)} placeholder="Enter organizer password" />
        {error && <p className="text-xs mb-3" style={{ color: '#ff7070' }}>{error}</p>}
        <button onClick={() => doLogin(password)} disabled={loading}
          className="w-full py-3 font-black text-sm rounded-lg disabled:opacity-50"
          style={{ background: '#00d4ff', color: '#000', fontFamily: "'Orbitron', sans-serif" }}>
          {loading ? 'CHECKING...' : 'LOGIN →'}
        </button>
      </div>
    </div>
  )

  // ---- SELECT OLYMPIAD ----
  if (step === 'select') return (
    <div className="min-h-screen flex items-center justify-center" style={{ background: '#030a12', paddingTop: 72 }}>
      <div className="w-full max-w-md p-8 rounded-2xl border" style={{ background: '#050d1a', borderColor: '#0f2a4a' }}>
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-xl font-black" style={{ fontFamily: "'Orbitron', sans-serif", color: '#00d4ff' }}>Select Olympiad</h1>
          <button onClick={logout} className="text-xs px-3 py-1 rounded-lg border" style={{ borderColor: '#0f2a4a', color: '#6a8faf' }}>Logout</button>
        </div>
        <div className="space-y-3">
          {olympiads.map(o => (
            <button key={o.id} onClick={() => selectOlympiad(o)} disabled={loading}
              className="w-full text-left p-4 rounded-xl border transition-all hover:border-[#00d4ff]"
              style={{ borderColor: '#0f2a4a', background: '#030a12', color: '#e8f4ff' }}>
              <p className="font-bold">{o.name}</p>
              <p className="text-xs mt-1" style={{ color: '#6a8faf' }}>{o.mode === 'online_mcq' ? 'Online MCQ' : 'Photo Submit'}</p>
            </button>
          ))}
          {olympiads.length === 0 && (
            <p className="text-sm text-center" style={{ color: '#6a8faf' }}>No olympiads assigned to this organizer account yet.</p>
          )}
        </div>
      </div>
    </div>
  )

  // ---- REVIEW ----
  return (
    <div className="min-h-screen" style={{ background: '#030a12', paddingTop: 72 }}>
      <div className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-4">
            <button onClick={() => { setStep(olympiads.length > 1 ? 'select' : 'select'); setSelected(null) }}
              className="text-sm px-3 py-1.5 rounded-lg border" style={{ borderColor: '#0f2a4a', color: '#6a8faf' }}>
              ← Back
            </button>
            <div>
              <h1 className="text-xl font-black" style={{ fontFamily: "'Orbitron', sans-serif", color: '#00d4ff' }}>{selected?.name}</h1>
              <p className="text-xs" style={{ color: '#6a8faf' }}>{regs.length} total submissions</p>
            </div>
          </div>
          <button onClick={logout} className="text-xs px-3 py-1.5 rounded-lg border" style={{ borderColor: '#0f2a4a', color: '#6a8faf' }}>Logout</button>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-3 gap-4 mb-6">
          {[
            { label: 'Total', value: regs.length, color: '#00d4ff' },
            { label: 'Reviewed', value: regs.filter(r => r.review_status === 'reviewed').length, color: '#00ff80' },
            { label: 'Pending', value: regs.filter(r => !r.review_status || r.review_status === 'pending').length, color: '#ffa500' },
          ].map(s => (
            <div key={s.label} className="rounded-xl p-4 text-center border" style={{ background: '#050d1a', borderColor: '#0f2a4a' }}>
              <p className="text-2xl font-black" style={{ color: s.color }}>{s.value}</p>
              <p className="text-xs mt-1" style={{ color: '#6a8faf' }}>{s.label}</p>
            </div>
          ))}
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-4">
          {(['all', 'pending', 'reviewed'] as const).map(f => (
            <button key={f} onClick={() => setFilter(f)}
              className="px-4 py-1.5 rounded-lg text-xs font-semibold border capitalize"
              style={{
                borderColor: filter === f ? '#00d4ff' : '#0f2a4a',
                color: filter === f ? '#00d4ff' : '#6a8faf',
                background: filter === f ? 'rgba(0,212,255,0.1)' : 'transparent',
              }}>{f}</button>
          ))}
        </div>

        {/* Submission Grid */}
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {filteredRegs.map(r => (
            <div key={r.id} className="rounded-xl border overflow-hidden" style={{ background: '#050d1a', borderColor: '#0f2a4a' }}>
              {r.answer_sheet_url && (
                <div className="relative h-40 bg-black overflow-hidden">
                  <img src={r.answer_sheet_url} alt="Answer sheet" className="w-full h-full object-cover opacity-80" />
                  <a href={r.answer_sheet_url} target="_blank"
                    className="absolute inset-0 flex items-center justify-center"
                    style={{ background: 'rgba(0,0,0,0.4)' }}>
                    <Eye size={24} style={{ color: '#00d4ff' }} />
                  </a>
                </div>
              )}
              <div className="p-4">
                <div className="flex items-start justify-between mb-2">
                  <div>
                    <p className="font-bold text-sm" style={{ color: '#e8f4ff' }}>{r.full_name}</p>
                    <p className="text-xs" style={{ color: '#6a8faf' }}>{r.phone}</p>
                    {r.college && <p className="text-xs" style={{ color: '#6a8faf' }}>{r.college} {r.college_roll ? `· Roll: ${r.college_roll}` : ''}</p>}
                    {r.batch && <p className="text-xs" style={{ color: '#6a8faf' }}>Batch: {r.batch} {r.group_name ? `· ${r.group_name}` : ''}</p>}
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full flex-shrink-0" style={{
                    background: r.review_status === 'reviewed' ? 'rgba(0,255,128,0.1)' : 'rgba(255,165,0,0.1)',
                    color: r.review_status === 'reviewed' ? '#00ff80' : '#ffa500',
                    border: `1px solid ${r.review_status === 'reviewed' ? 'rgba(0,255,128,0.3)' : 'rgba(255,165,0,0.3)'}`,
                  }}>{r.review_status || 'pending'}</span>
                </div>

                {r.custom_answers && Object.keys(r.custom_answers).length > 0 && (
                  <div className="mt-2 p-2 rounded-lg text-xs space-y-1" style={{ background: '#030a12' }}>
                    {Object.entries(r.custom_answers).map(([k, v]) => v ? (
                      <div key={k}><span style={{ color: '#6a8faf' }}>{k}: </span><span style={{ color: '#e8f4ff' }}>{v}</span></div>
                    ) : null)}
                  </div>
                )}

                {selected?.mode === 'online_mcq' && r.mcq_score != null && (
                  <div className="mt-2 text-sm" style={{ color: '#6a8faf' }}>
                    Auto score: <span style={{ color: '#00ff80', fontWeight: 'bold' }}>{r.mcq_score} / {selected.questions?.length || '?'}</span>
                  </div>
                )}

                <div className="mt-3 flex items-center gap-2">
                  {markingId === r.id ? (
                    <>
                      <input type="number" className="flex-1 px-3 py-1.5 rounded-lg text-sm border outline-none" style={inpStyle}
                        value={scoreInput} onChange={e => setScoreInput(e.target.value)} placeholder="Score" />
                      <button onClick={() => saveScore(r.id, scoreInput)}
                        className="p-1.5 rounded-lg" style={{ background: 'rgba(0,255,128,0.15)', color: '#00ff80' }}><CheckCircle size={18} /></button>
                      <button onClick={() => setMarkingId(null)}
                        className="p-1.5 rounded-lg" style={{ background: 'rgba(255,80,80,0.1)', color: '#ff7070' }}><XCircle size={18} /></button>
                    </>
                  ) : (
                    <button onClick={() => { setMarkingId(r.id); setScoreInput(r.final_score?.toString() || '') }}
                      className="flex-1 py-1.5 rounded-lg text-xs font-semibold border"
                      style={{
                        borderColor: r.final_score != null ? 'rgba(0,255,128,0.3)' : '#0f2a4a',
                        color: r.final_score != null ? '#00ff80' : '#6a8faf',
                        background: r.final_score != null ? 'rgba(0,255,128,0.05)' : 'transparent',
                      }}>
                      {r.final_score != null ? `Score: ${r.final_score} (edit)` : 'Mark Score'}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {filteredRegs.length === 0 && (
            <div className="col-span-3 text-center py-12" style={{ color: '#6a8faf' }}>
              <Clock size={40} className="mx-auto mb-3 opacity-30" />
              <p>No submissions {filter !== 'all' ? `with status "${filter}"` : ''} yet.</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
