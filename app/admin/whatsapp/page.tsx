'use client'
import { useCallback, useEffect, useRef, useState } from 'react'
import { Phone, Plus, Send, Square } from 'lucide-react'
import { useWhatsAppService } from '@/hooks/useWhatsAppService'

// Control panel for the WhatsApp sender service (services/whatsapp-bulk).
// Every call goes through /api/admin/whatsapp/*, which checks the admin session
// and forwards to the service. See services/whatsapp-bulk/README.md.

const API = '/api/admin/whatsapp'

type Sim = {
  id: string; label: string; phone?: string; status: string; connection?: string; paused?: boolean
  credits: number; dailyLimit: number; sentToday: number; capacity: number
  lastUsedAt?: number; totalSent: number; totalFailed: number
  lastError?: { at: number; message: string }; message?: string; problem?: string; qrImage?: string | null
}
type Settings = {
  brandName: string; brandHeader: boolean; groupLink: string; template: string
  countryCode: string; minDelayMs: number; maxDelayMs: number; logoFile: string
}
type Campaign = {
  running: boolean; total: number; done: number; ok: number; skipped: number; failed: number
  waiting?: string; current?: { name: string; phone: string }; stopReason?: string
  perSim: Record<string, { label: string; ok: number; failed: number }>
  failedList: { phone: string; name: string; reason: string }[]
}
type Recent = { ts: number; simId: string; to?: string; status: string; error?: string }
type State = { sims: Sim[]; settings: Settings; hasLogo: boolean; campaign: Campaign | null; recent: Recent[]; now: number }
type Preview = {
  total: number; duplicates: number; invalid: number; invalidExamples: string[]
  alreadySent: number; toSend: number; shortBy: number; capacityNow: number; sample?: string
}
type Member = { full_name?: string; phone?: string; is_verified?: boolean }

const STATUS: Record<string, [string, string]> = {
  ready: ['Ready', 'ok'], connecting: ['Connecting…', ''], qr: ['Scan QR', 'warn'], disconnected: ['Not connected', 'warn'],
  logged_out: ['Logged out', 'bad'], paused: ['Paused', 'bad'], cooldown: ['Cooling down', 'warn'],
  no_credits: ['Out of credits', 'warn'], daily_limit: ['Daily limit reached', 'warn'],
}
const TONE: Record<string, string> = { ok: '#12b886', warn: '#f59f00', bad: '#fa5252', '': 'var(--muted)' }

const card: React.CSSProperties = { background: 'var(--bg2)', border: '1px solid var(--border)', borderRadius: 12, padding: 16 }
const inputCls = 'w-full rounded-lg px-3 py-2 text-sm bg-transparent border'
const inputStyle: React.CSSProperties = { borderColor: 'var(--border)', color: 'inherit' }
const btn: React.CSSProperties = { border: '1px solid var(--border)', borderRadius: 8, padding: '6px 12px', fontSize: 13, fontWeight: 600, cursor: 'pointer', background: 'transparent', color: 'inherit' }
const btnPrimary: React.CSSProperties = { ...btn, background: 'var(--blue2)', borderColor: 'var(--blue2)', color: '#fff' }
const btnDanger: React.CSSProperties = { ...btn, color: '#fa5252', borderColor: '#fa525266' }
const note: React.CSSProperties = { background: 'rgba(var(--blue-rgb), .08)', borderRadius: 8, padding: '9px 11px', fontSize: 12, color: 'var(--muted)', margin: '8px 0' }

async function api<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const init: RequestInit = { method, cache: 'no-store' }
  if (body instanceof Blob) init.body = body
  else if (body !== undefined) { init.headers = { 'content-type': 'application/json' }; init.body = JSON.stringify(body) }
  const r = await fetch(`${API}${path}`, init)
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Request failed')
  return j
}

const ago = (t: number | undefined, now: number) => {
  if (!t) return 'never'
  const s = Math.max(0, (now - t) / 1000)
  return s < 60 ? 'just now' : s < 3600 ? `${Math.floor(s / 60)} min ago` : s < 86400 ? `${Math.floor(s / 3600)} h ago` : new Date(t).toLocaleDateString()
}
const when = (t: number) => new Date(t).toLocaleString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' })

function Badge({ tone, children }: { tone: string; children: React.ReactNode }) {
  return <span style={{ fontSize: 11, fontWeight: 700, padding: '3px 9px', borderRadius: 99, color: TONE[tone], border: `1px solid ${TONE[tone]}55` }}>{children}</span>
}
function Bar({ pct }: { pct: number }) {
  return <div style={{ height: 6, borderRadius: 4, background: 'rgba(var(--blue-rgb), .15)', overflow: 'hidden' }}><div style={{ width: `${pct}%`, height: '100%', background: 'var(--blue2)' }} /></div>
}
function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,.55)', zIndex: 60, display: 'grid', placeItems: 'center', padding: 16 }}>
      <div onClick={e => e.stopPropagation()} style={{ ...card, background: 'var(--bg)', width: 'min(420px, 100%)' }}>
        <h2 className="text-base font-bold mb-3">{title}</h2>
        {children}
      </div>
    </div>
  )
}
const Label = ({ children }: { children: React.ReactNode }) => <label className="block text-xs mt-3 mb-1" style={{ color: 'var(--muted)' }}>{children}</label>

export default function AdminWhatsAppPage() {
  const [tab, setTab] = useState<'sims' | 'send' | 'brand' | 'activity'>('sims')
  const svc = useWhatsAppService()
  const awake = svc.state === 'awake'
  const [S, setS] = useState<State | null>(null)
  const [error, setError] = useState('')
  const [toast, setToast] = useState('')
  const [fSim, setFSim] = useState('')
  const [fStatus, setFStatus] = useState('')
  const filters = useRef({ sim: '', status: '' })
  filters.current = { sim: fSim, status: fStatus }

  const notify = (m: string) => { setToast(m); setTimeout(() => setToast(''), 3800) }

  const refresh = useCallback(async () => {
    const q = new URLSearchParams()
    if (filters.current.sim) q.set('sim', filters.current.sim)
    if (filters.current.status) q.set('status', filters.current.status)
    try { setS(await api<State>(`/api/state?${q}`)); setError('') } catch (e: any) { setError(e.message) }
  }, [])

  // Only poll once the service is awake (polling also keeps it from going back to sleep while this page is open).
  useEffect(() => { if (!awake) return; refresh(); const t = setInterval(refresh, 2500); return () => clearInterval(t) }, [awake, refresh])
  useEffect(() => { if (awake) refresh() }, [fSim, fStatus, awake, refresh])

  const act = async (fn: () => Promise<unknown>) => { try { await fn(); await refresh() } catch (e: any) { notify(e.message) } }

  // dialogs
  const [dlg, setDlg] = useState<null | { kind: 'add' } | { kind: 'credits' | 'limits'; sim: Sim }>(null)
  const [f, setF] = useState({ label: '', credits: '100', daily: '100', amount: '' })

  // send tab
  const [csv, setCsv] = useState('')
  const [preview, setPreview] = useState<Preview | null>(null)
  const [verifiedOnly, setVerifiedOnly] = useState(false)

  // brand tab (local editable copy of the settings)
  const [form, setForm] = useState<Settings | null>(null)
  useEffect(() => { if (S && !form) setForm(S.settings) }, [S, form])

  const importMembers = () => act(async () => {
    const r = await fetch('/api/admin/members', { cache: 'no-store' })
    const j = await r.json().catch(() => ({}))
    if (!r.ok) throw new Error(j.error || 'Could not load members')
    const rows = ((j.members || []) as Member[]).filter(m => m.phone?.trim() && (!verifiedOnly || m.is_verified))
    if (!rows.length) throw new Error('No accounts with a phone number found')
    const q = (v: string) => `"${v.replace(/"/g, '""')}"`
    setCsv('phone,name\n' + rows.map(m => `${q(m.phone!.trim())},${q((m.full_name || '').trim())}`).join('\n'))
    setPreview(null)
    notify(`Loaded ${rows.length} contacts`)
  })

  if (!S) {
    return (
      <div>
        <Header />
        <div style={card}>
          {svc.state === 'unconfigured' ? (<>
            <b>WhatsApp service isn’t set up yet.</b>
            <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>Add its URL and token under <a href="/admin/credentials" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>Credentials</a>.</p>
          </>) : svc.state === 'down' ? (<>
            <b style={{ color: '#fa5252' }}>The WhatsApp service isn’t answering.</b>
            <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>It has been {svc.elapsed}s. Check that it is deployed and running, and that the URL and token under <a href="/admin/credentials" style={{ color: 'var(--blue)', textDecoration: 'underline' }}>Credentials</a> are right. Still trying in the background.</p>
            <button style={{ ...btnPrimary, marginTop: 12 }} onClick={svc.retry}>Try again now</button>
          </>) : (<>
            <b>{svc.state === 'unknown' ? 'Checking the WhatsApp service…' : 'Waking up the WhatsApp service…'}</b>
            {svc.state === 'waking' && <>
              <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>The server sleeps when it isn’t used and takes up to about a minute to start. This page will load by itself. {svc.elapsed}s so far.</p>
              <div className="h-1.5 rounded mt-3 overflow-hidden" style={{ background: 'rgba(var(--blue-rgb), .15)' }}><div style={{ width: `${Math.min(95, (svc.elapsed / 60) * 100)}%`, height: '100%', background: 'var(--blue)', transition: 'width 1s linear' }} /></div>
            </>}
            {awake && error && <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>{error}</p>}
          </>)}
        </div>
      </div>
    )
  }

  const c = S.campaign
  const simName = (id: string) => S.sims.find(s => s.id === id)?.label || '(removed)'
  const tpl = form ?? S.settings
  const pvText = tpl.template.replaceAll('{name}', 'Rahim').replaceAll('{link}', tpl.groupLink || 'https://chat.whatsapp.com/…').replaceAll('{brand}', tpl.brandName).trim()

  return (
    <div>
      <Header sub={S.settings.brandName} logo={S.hasLogo ? `${API}/logo?v=${S.settings.logoFile}` : undefined} />
      {error && <div style={{ ...note, color: '#fa5252' }}>Connection problem: {error}</div>}

      <div className="flex gap-1 mb-5 flex-wrap" style={{ borderBottom: '1px solid var(--border)' }}>
        {([['sims', 'SIMs'], ['send', 'Send'], ['brand', 'Brand & message'], ['activity', 'Activity']] as const).map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)} className="px-4 py-2 text-sm font-semibold"
            style={{ color: tab === k ? 'var(--blue)' : 'var(--muted)', borderBottom: `2px solid ${tab === k ? 'var(--blue)' : 'transparent'}`, marginBottom: -1 }}>{l}</button>
        ))}
      </div>

      {tab === 'sims' && (
        <section>
          <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
            <div className="text-xs" style={{ color: 'var(--muted)', maxWidth: 620 }}>Each SIM is a WhatsApp number linked to the sender. Messages are spread across SIMs that still have credits. <b>1 credit = 1 message sent.</b></div>
            <button style={btnPrimary} onClick={() => { setF({ label: '', credits: '100', daily: '100', amount: '' }); setDlg({ kind: 'add' }) }}><Plus size={14} className="inline -mt-0.5" /> Add SIM</button>
          </div>
          {!S.sims.length && <div style={card}><b>No SIMs yet.</b><p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>Press “Add SIM”, give it some credits, then scan the QR from that phone: WhatsApp → Settings → Linked devices → Link a device.</p></div>}
          <div className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))' }}>
            {S.sims.map(s => {
              const [label, tone] = STATUS[s.status] || [s.status, '']
              const pct = Math.min(100, Math.round(100 * s.sentToday / s.dailyLimit))
              return (
                <div key={s.id} style={card}>
                  <div className="flex justify-between gap-2"><div><b>{s.label}</b><div className="text-xs" style={{ color: 'var(--muted)' }}>{s.phone ? `+${s.phone}` : 'number not linked yet'}</div></div><div><Badge tone={tone}>{label}</Badge></div></div>
                  {s.qrImage && <><img src={s.qrImage} alt="QR" style={{ display: 'block', margin: '12px auto', width: 230, height: 230, background: '#fff', borderRadius: 8, padding: 6 }} /><div className="text-xs text-center" style={{ color: 'var(--muted)' }}>On that phone: WhatsApp → Settings → Linked devices → Link a device</div></>}
                  {s.problem && s.status !== 'ready' && !s.qrImage && <div style={note}>{s.problem}</div>}
                  <div className="flex gap-5 mt-3 items-center">
                    <div><div className="text-2xl font-bold">{s.credits}</div><div className="text-xs" style={{ color: 'var(--muted)' }}>credits left</div></div>
                    <div className="flex-1"><div className="flex justify-between text-xs"><span>Today</span><span>{s.sentToday} / {s.dailyLimit}</span></div><Bar pct={pct} /><div className="text-xs" style={{ color: 'var(--muted)' }}>can send {s.capacity} more today</div></div>
                  </div>
                  <div className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Last used: {ago(s.lastUsedAt, S.now)} · {s.totalSent} sent · {s.totalFailed} failed in total</div>
                  {s.lastError && <div style={{ ...note, color: '#fa5252' }}><b>Last error</b> ({ago(s.lastError.at, S.now)}): {s.lastError.message}</div>}
                  {s.message && !s.lastError && <div style={note}>{s.message}</div>}
                  <div className="flex gap-2 flex-wrap mt-3">
                    <button style={btnPrimary} onClick={() => { setF({ ...f, amount: '' }); setDlg({ kind: 'credits', sim: s }) }}>+ Credits</button>
                    <button style={btn} onClick={() => { setF({ ...f, label: s.label, daily: String(s.dailyLimit), credits: String(s.credits) }); setDlg({ kind: 'limits', sim: s }) }}>Limits</button>
                    {s.connection !== 'connected' && <button style={btn} onClick={() => act(() => api(`/api/sims/${s.id}/connect`, 'POST', {}))}>{s.status === 'qr' ? 'New QR' : 'Connect'}</button>}
                    {s.paused || s.status === 'cooldown'
                      ? <button style={btn} onClick={() => act(() => api(`/api/sims/${s.id}/resume`, 'POST', {}))}>Resume</button>
                      : <button style={btn} onClick={() => act(() => api(`/api/sims/${s.id}/pause`, 'POST', {}))}>Pause</button>}
                    {s.connection === 'connected' && <button style={btn} title="Set this number's WhatsApp profile name and photo to your brand"
                      onClick={() => act(async () => { const r = await api(`/api/sims/${s.id}/apply-brand`, 'POST', {}); notify('Profile updated: ' + r.applied.join(' + ')) })}>Apply brand to profile</button>}
                    <button style={btn} onClick={() => { setFSim(s.id); setTab('activity') }}>Recent use</button>
                    <button style={btnDanger} onClick={() => { if (confirm(`Remove ${s.label}? This also unlinks it from WhatsApp. Its credits are lost.`)) act(() => api(`/api/sims/${s.id}`, 'DELETE')) }}>Remove</button>
                  </div>
                </div>
              )
            })}
          </div>
        </section>
      )}

      {tab === 'send' && (
        <section className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
          <div style={card}>
            <h2 className="font-bold mb-2">1. Contacts</h2>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>CSV with a <code>phone</code> column (and optional <code>name</code>), or paste one number per line. 01XXXXXXXXX is read as +880.</div>
            <textarea className={inputCls + ' mt-2'} style={{ ...inputStyle, minHeight: 170 }} value={csv} onChange={e => { setCsv(e.target.value); setPreview(null) }} placeholder={'phone,name\n01700000001,Rahim\n01800000002,Karim'} />
            <div className="flex gap-2 mt-2 items-center flex-wrap">
              <input type="file" accept=".csv,.txt" className="text-xs flex-1" onChange={async e => { const file = e.target.files?.[0]; if (file) { setCsv(await file.text()); setPreview(null) } }} />
              <button style={btn} onClick={() => act(async () => setPreview(await api<Preview>('/api/campaign/preview', 'POST', { csv })))}>Check</button>
            </div>
            <div className="flex gap-3 mt-3 items-center flex-wrap text-xs">
              <button style={btn} onClick={importMembers}>Load from accounts</button>
              <label className="flex gap-1 items-center"><input type="checkbox" checked={verifiedOnly} onChange={e => setVerifiedOnly(e.target.checked)} /> approved members only</label>
            </div>
            {preview && (
              <div style={note}>
                <b>{preview.total}</b> valid numbers{preview.duplicates ? `, ${preview.duplicates} duplicates removed` : ''}{preview.invalid ? <>, <b>{preview.invalid}</b> invalid ({preview.invalidExamples.join(', ')})</> : ''}.<br />
                {preview.alreadySent} already messaged → <b>{preview.toSend}</b> to send.<br />
                {preview.shortBy > 0
                  ? <span style={{ color: '#f59f00' }}>SIMs that are ready can send {preview.capacityNow} now, so about <b>{preview.shortBy}</b> would be left. Add credits or raise a daily limit.</span>
                  : <>SIMs ready to send: {preview.capacityNow} (enough).</>}
                {preview.sample && <><br /><br />First message:<br /><i style={{ whiteSpace: 'pre-wrap' }}>{preview.sample}</i></>}
              </div>
            )}
          </div>
          <div style={card}>
            <h2 className="font-bold mb-2">2. Send</h2>
            <div className="flex gap-2">
              <button style={btnPrimary} disabled={!!c?.running} onClick={() => { if (confirm('Start sending now?')) act(() => api('/api/campaign/start', 'POST', { csv })) }}><Send size={13} className="inline -mt-0.5" /> Start sending</button>
              <button style={btnDanger} disabled={!c?.running} onClick={() => act(() => api('/api/campaign/stop', 'POST', {}))}><Square size={12} className="inline -mt-0.5" /> Stop</button>
            </div>
            {c && (
              <div className="mt-3">
                <div className="flex justify-between"><b className="text-sm">{c.done} of {c.total} done · {c.ok} sent · {c.skipped} skipped · {c.failed} failed</b><Badge tone={c.running ? 'ok' : ''}>{c.running ? 'Running' : 'Finished'}</Badge></div>
                <div className="my-2"><Bar pct={c.total ? 100 * c.done / c.total : 0} /></div>
                <div className="text-xs" style={{ color: 'var(--muted)' }}>{c.running ? (c.waiting || (c.current ? `Sending to ${c.current.name} (+${c.current.phone})…` : '')) : ''}</div>
                <div className="text-xs mt-1">{(Object.values(c.perSim) as { label: string; ok: number; failed: number }[]).map(p => `${p.label}: ${p.ok} sent${p.failed ? `, ${p.failed} errors` : ''}`).join(' · ')}</div>
                {!c.running && c.stopReason && <div style={note}>{c.stopReason}</div>}
                {c.failedList.length > 0 && (
                  <div className="mt-2">
                    <h3 className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Not sent</h3>
                    <div className="text-xs">{c.failedList.slice(-30).map((x, i) => <div key={i}>+{x.phone} {x.name} — {x.reason}</div>)}</div>
                    <button style={{ ...btn, marginTop: 6 }} onClick={() => {
                      const rows = ['phone,name,reason', ...c.failedList.map(x => [x.phone, x.name, x.reason].map(v => '"' + String(v).replace(/"/g, '""') + '"').join(','))]
                      const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([rows.join('\n')], { type: 'text/csv' })); a.download = 'not-sent.csv'; a.click()
                    }}>Download as CSV</button>
                  </div>
                )}
              </div>
            )}
            <h3 className="text-xs font-semibold mt-5" style={{ color: 'var(--muted)' }}>Already-messaged list</h3>
            <div className="text-xs" style={{ color: 'var(--muted)' }}>People you have messaged are remembered, so running the same list again skips them.</div>
            <button style={{ ...btnDanger, marginTop: 6 }} onClick={() => { if (confirm('Forget everyone you have messaged? Running a list again would message them again.')) act(async () => { await api('/api/sent/clear', 'POST', {}); notify('History cleared') }) }}>Forget who was messaged</button>
          </div>
        </section>
      )}

      {tab === 'brand' && form && (
        <section className="grid gap-4" style={{ gridTemplateColumns: 'repeat(auto-fit, minmax(340px, 1fr))' }}>
          <div style={card}>
            <h2 className="font-bold">Name &amp; logo shown to people</h2>
            <Label>Brand name</Label>
            <input className={inputCls} style={inputStyle} value={form.brandName} onChange={e => setForm({ ...form, brandName: e.target.value })} />
            <label className="flex gap-2 items-center text-sm mt-3"><input type="checkbox" checked={form.brandHeader} onChange={e => setForm({ ...form, brandHeader: e.target.checked })} /> Show the name in bold at the top of every message</label>
            <Label>Logo (PNG or JPEG), sent with every message</Label>
            <div className="flex gap-2 items-center">
              <input type="file" accept="image/png,image/jpeg" className="text-xs flex-1" onChange={e => { const file = e.target.files?.[0]; if (file) act(async () => { await api('/api/logo', 'POST', file); notify('Logo saved') }) }} />
              <button style={btnDanger} onClick={() => act(() => api('/api/logo', 'DELETE'))}>Remove</button>
            </div>
            <div style={note}><b>What recipients see:</b> the logo and bold name inside the message itself (always). Use <b>Apply brand to profile</b> on a SIM to also set that number’s WhatsApp profile name and photo. A verified business name needs Meta approval and can’t be set here.</div>
            <Label>Group link (replaces {'{link}'})</Label>
            <input className={inputCls} style={inputStyle} placeholder="https://chat.whatsapp.com/…" value={form.groupLink} onChange={e => setForm({ ...form, groupLink: e.target.value })} />
            <Label>Message: use {'{name}'}, {'{link}'}, {'{brand}'}</Label>
            <textarea className={inputCls} style={{ ...inputStyle, minHeight: 140 }} value={form.template} onChange={e => setForm({ ...form, template: e.target.value })} />
            <h3 className="text-xs font-semibold mt-4" style={{ color: 'var(--muted)' }}>Pace</h3>
            <div className="flex gap-2">
              <div className="flex-1"><Label>Min wait (seconds)</Label><input type="number" min={1} className={inputCls} style={inputStyle} value={form.minDelayMs / 1000} onChange={e => setForm({ ...form, minDelayMs: Math.round(+e.target.value * 1000) })} /></div>
              <div className="flex-1"><Label>Max wait (seconds)</Label><input type="number" min={1} className={inputCls} style={inputStyle} value={form.maxDelayMs / 1000} onChange={e => setForm({ ...form, maxDelayMs: Math.round(+e.target.value * 1000) })} /></div>
              <div className="flex-1"><Label>Country code</Label><input className={inputCls} style={inputStyle} value={form.countryCode} onChange={e => setForm({ ...form, countryCode: e.target.value })} /></div>
            </div>
            <div className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Wait time is per SIM, random between min and max. Slower is safer for the number.</div>
            <button style={{ ...btnPrimary, marginTop: 12 }} onClick={() => act(async () => {
              const saved = await api<Settings>('/api/settings', 'POST', { ...form, brandName: form.brandName.trim(), groupLink: form.groupLink.trim(), countryCode: form.countryCode.trim() || '880' })
              setForm(saved); notify('Saved')
            })}>Save</button>
          </div>
          <div style={card}>
            <h2 className="font-bold mb-2">Preview</h2>
            <div style={{ background: '#dcf8c6', color: '#111', borderRadius: 10, padding: 8, maxWidth: 320 }}>
              {S.hasLogo && <img src={`${API}/logo?v=${S.settings.logoFile}`} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 6, marginBottom: 6 }} />}
              <div style={{ whiteSpace: 'pre-wrap', wordBreak: 'break-word', fontSize: 14 }}>
                {tpl.brandHeader && tpl.brandName && <><b>{tpl.brandName}</b>{'\n\n'}</>}
                {pvText}
              </div>
            </div>
          </div>
        </section>
      )}

      {tab === 'activity' && (
        <section style={card}>
          <div className="flex justify-between items-center gap-2 flex-wrap">
            <h2 className="font-bold">Recent activity</h2>
            <div className="flex gap-2">
              <select className="rounded-lg px-2 py-1 text-sm bg-transparent border" style={inputStyle} value={fSim} onChange={e => setFSim(e.target.value)}>
                <option value="">All SIMs</option>{S.sims.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
              </select>
              <select className="rounded-lg px-2 py-1 text-sm bg-transparent border" style={inputStyle} value={fStatus} onChange={e => setFStatus(e.target.value)}>
                <option value="">All</option>{['sent', 'failed', 'skipped', 'credits', 'info'].map(x => <option key={x} value={x}>{x}</option>)}
              </select>
            </div>
          </div>
          <div style={{ overflow: 'auto', marginTop: 8 }}>
            <table className="w-full text-xs" style={{ borderCollapse: 'collapse' }}>
              <thead><tr style={{ color: 'var(--muted)', textAlign: 'left' }}>{['When', 'SIM', 'Number', 'Result', 'Details'].map(h => <th key={h} className="p-2">{h}</th>)}</tr></thead>
              <tbody>
                {S.recent.map((e, i) => (
                  <tr key={i} style={{ borderTop: '1px solid var(--border)' }}>
                    <td className="p-2">{when(e.ts)}</td><td className="p-2">{simName(e.simId)}</td><td className="p-2">{e.to ? `+${e.to}` : ''}</td>
                    <td className="p-2" style={{ color: e.status === 'sent' ? '#12b886' : e.status === 'failed' ? '#fa5252' : 'var(--muted)' }}>{e.status}</td><td className="p-2">{e.error || ''}</td>
                  </tr>
                ))}
                {!S.recent.length && <tr><td colSpan={5} className="p-2" style={{ color: 'var(--muted)' }}>Nothing yet.</td></tr>}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {dlg?.kind === 'add' && (
        <Modal title="Add SIM" onClose={() => setDlg(null)}>
          <Label>Name (so you can tell them apart)</Label>
          <input className={inputCls} style={inputStyle} placeholder="e.g. President's SIM" value={f.label} onChange={e => setF({ ...f, label: e.target.value })} />
          <div className="flex gap-2">
            <div className="flex-1"><Label>Starting credits</Label><input type="number" min={0} className={inputCls} style={inputStyle} value={f.credits} onChange={e => setF({ ...f, credits: e.target.value })} /></div>
            <div className="flex-1"><Label>Daily limit</Label><input type="number" min={1} className={inputCls} style={inputStyle} value={f.daily} onChange={e => setF({ ...f, daily: e.target.value })} /></div>
          </div>
          <div style={note}>Daily limit is the most this SIM will send in one day, even if it has more credits. Keeping it modest protects the number from being restricted.</div>
          <div className="flex gap-2 justify-end mt-3"><button style={btn} onClick={() => setDlg(null)}>Cancel</button>
            <button style={btnPrimary} onClick={() => act(async () => { await api('/api/sims', 'POST', { label: f.label, credits: +f.credits, dailyLimit: +f.daily }); setDlg(null) })}>Add &amp; show QR</button></div>
        </Modal>
      )}
      {dlg?.kind === 'credits' && (
        <Modal title={`Add credits: ${dlg.sim.label} (${dlg.sim.credits} left)`} onClose={() => setDlg(null)}>
          <div className="flex gap-2">{[50, 100, 500].map(n => <button key={n} style={btn} onClick={() => setF({ ...f, amount: String(n) })}>+{n}</button>)}</div>
          <Label>Or enter an amount (use a minus to remove)</Label>
          <input type="number" className={inputCls} style={inputStyle} placeholder="e.g. 250" value={f.amount} onChange={e => setF({ ...f, amount: e.target.value })} />
          <div className="flex gap-2 justify-end mt-3"><button style={btn} onClick={() => setDlg(null)}>Cancel</button>
            <button style={btnPrimary} onClick={() => act(async () => { await api(`/api/sims/${dlg.sim.id}/credits`, 'POST', { add: +f.amount }); setDlg(null) })}>Apply</button></div>
        </Modal>
      )}
      {dlg?.kind === 'limits' && (
        <Modal title={`Limits: ${dlg.sim.label}`} onClose={() => setDlg(null)}>
          <Label>Name</Label>
          <input className={inputCls} style={inputStyle} value={f.label} onChange={e => setF({ ...f, label: e.target.value })} />
          <div className="flex gap-2">
            <div className="flex-1"><Label>Daily limit</Label><input type="number" min={1} className={inputCls} style={inputStyle} value={f.daily} onChange={e => setF({ ...f, daily: e.target.value })} /></div>
            <div className="flex-1"><Label>Set credits to</Label><input type="number" min={0} className={inputCls} style={inputStyle} value={f.credits} onChange={e => setF({ ...f, credits: e.target.value })} /></div>
          </div>
          <div className="flex gap-2 justify-end mt-3"><button style={btn} onClick={() => setDlg(null)}>Cancel</button>
            <button style={btnPrimary} onClick={() => act(async () => { await api(`/api/sims/${dlg.sim.id}/limits`, 'POST', { label: f.label, dailyLimit: +f.daily, credits: +f.credits }); setDlg(null) })}>Save</button></div>
        </Modal>
      )}

      {toast && <div style={{ position: 'fixed', bottom: 18, left: '50%', transform: 'translateX(-50%)', background: 'var(--blue2)', color: '#fff', padding: '10px 16px', borderRadius: 10, zIndex: 80, maxWidth: '90vw' }}>{toast}</div>}
    </div>
  )
}

function Header({ sub, logo }: { sub?: string; logo?: string }) {
  return (
    <div className="flex items-center gap-3 mb-6">
      {logo ? <img src={logo} alt="" style={{ width: 34, height: 34, borderRadius: 8, objectFit: 'cover' }} /> : <Phone size={26} style={{ color: 'var(--blue)' }} />}
      <div>
        <h1 className="text-2xl font-bold" style={{ color: 'var(--blue)' }}>WhatsApp Sender</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{sub ? `${sub} · bulk invitations via linked SIMs` : 'Bulk invitations via linked SIMs'}</p>
      </div>
    </div>
  )
}
