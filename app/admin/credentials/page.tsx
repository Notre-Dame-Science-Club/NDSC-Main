'use client'
import { useCallback, useEffect, useState } from 'react'
import { KeyRound, Plus, Trash2, Edit2, CheckCircle, Zap } from 'lucide-react'
import { Modal } from '@/components/ui'

// Add / edit / activate the URL + token the admin panel uses to reach external
// services (currently the WhatsApp sender, services/whatsapp-bulk). Tokens are
// stored encrypted on the server and only ever shown masked.

type Cred = { id: string; provider: string; label: string; base_url: string; token_masked: string; is_active: boolean; is_auto?: boolean }

const card = { background: 'var(--bg2)', borderColor: 'var(--border)' }
const field = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }
const primary = { background: 'var(--blue)', color: '#000' }
const ghost = { background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }
const EMPTY = { label: '', base_url: '', token: '' }

async function call(method: string, body?: unknown, qs = '') {
  const r = await fetch('/api/admin/credentials' + qs, {
    method, cache: 'no-store',
    ...(body ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Request failed')
  return j
}

export default function CredentialsPage() {
  const [creds, setCreds] = useState<Cred[]>([])
  const [envSet, setEnvSet] = useState(false)
  const [autoOn, setAutoOn] = useState(false)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [dlg, setDlg] = useState<null | { id?: string }>(null)
  const [f, setF] = useState(EMPTY)
  const [saving, setSaving] = useState(false)
  const [formErr, setFormErr] = useState('')
  const [test, setTest] = useState<Record<string, string>>({})

  const load = useCallback(async () => {
    try { const j = await call('GET'); setCreds(j.credentials || []); setEnvSet(!!j.env?.whatsapp); setAutoOn(!!j.autoRegister); setError('') }
    catch (e: any) { setError(e.message) } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const open = (c?: Cred) => { setF(c ? { label: c.label, base_url: c.base_url, token: '' } : EMPTY); setFormErr(''); setDlg({ id: c?.id }) }

  const save = async () => {
    setSaving(true); setFormErr('')
    try {
      if (dlg?.id) await call('PATCH', { id: dlg.id, label: f.label, base_url: f.base_url, token: f.token })
      else await call('POST', { provider: 'whatsapp', ...f })
      setDlg(null); await load()
    } catch (e: any) { setFormErr(e.message) } finally { setSaving(false) }
  }
  const act = async (fn: () => Promise<unknown>) => { try { await fn(); await load() } catch (e: any) { setError(e.message) } }

  // Uses the saved/active credential via the proxy, so it tests exactly what the WhatsApp page will use.
  const check = async (id: string) => {
    setTest(t => ({ ...t, [id]: 'Checking…' }))
    // Pings the service (this also wakes it if it was asleep: first answer can take about a minute).
    try {
      const r = await fetch('/api/admin/whatsapp-wake', { cache: 'no-store' }); const j = await r.json().catch(() => ({}))
      setTest(t => ({ ...t, [id]: j.state === 'awake' ? '✓ Service is awake and answering' : j.state === 'waking' ? '⏳ Not answering yet. If it was asleep it is waking up, press Test again in 30–60 seconds.' : '✗ ' + (j.error || 'Not set up') }))
    } catch { setTest(t => ({ ...t, [id]: '✗ Could not check' })) }
  }

  return (
    <div>
      <div className="flex items-start justify-between gap-3 flex-wrap mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1 flex items-center gap-2" style={{ fontFamily: 'inherit', color: 'var(--blue)' }}><KeyRound size={22} /> Credentials</h1>
          <p className="text-sm" style={{ color: 'var(--muted)', maxWidth: 640 }}>
            The address and secret token the admin panel uses to talk to the WhatsApp sender service. Saved here, encrypted, no server restart or env editing needed.
          </p>
        </div>
        <button onClick={() => open()} className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold" style={primary}><Plus size={14} /> Add credential</button>
      </div>

      {error && <p className="text-sm mb-4" style={{ color: 'var(--danger)' }}>{error}</p>}
      {loading ? <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading…</p> : (
        <div className="space-y-3">
          {creds.length === 0 && (
            <div className="p-5 rounded-xl border" style={card}>
              <b>No credentials saved yet.</b>
              <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
                {envSet ? 'The panel is currently using WHATSAPP_SERVICE_URL / WHATSAPP_SERVICE_TOKEN from the server environment. Add one here to override it.' : 'Press “Add credential” and enter the WhatsApp service URL and token.'}
              </p>
            </div>
          )}
          {creds.map(c => (
            <div key={c.id} className="p-4 rounded-xl border flex items-center gap-4 flex-wrap" style={card}>
              <div className="flex-1 min-w-[220px]">
                <div className="flex items-center gap-2"><b>{c.label}</b>
                  <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(var(--blue-rgb),0.1)', color: 'var(--blue)' }}>WhatsApp service</span>
                  {c.is_auto && <span className="text-[11px] px-2 py-0.5 rounded-full" style={{ background: 'rgba(var(--blue-rgb),0.1)', color: 'var(--muted)' }}>Auto-registered</span>}
                  {c.is_active && <span className="text-[11px] px-2 py-0.5 rounded-full flex items-center gap-1" style={{ background: 'rgba(64,192,87,0.15)', color: '#40c057' }}><CheckCircle size={11} /> In use</span>}
                </div>
                <div className="text-xs mt-1 break-all" style={{ color: 'var(--muted)' }}>{c.base_url} · token {c.token_masked}</div>
                {test[c.id] && <div className="text-xs mt-1" style={{ color: test[c.id].startsWith('✓') ? '#40c057' : 'var(--muted)' }}>{test[c.id]}</div>}
              </div>
              <div className="flex gap-2 flex-wrap">
                {!c.is_active && <button className="px-3 py-1.5 rounded text-xs font-bold" style={primary} onClick={() => act(() => call('PATCH', { id: c.id, is_active: true }))}>Use this</button>}
                {c.is_active && <button className="px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1" style={ghost} onClick={() => check(c.id)}><Zap size={12} /> Test</button>}
                <button className="px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1" style={ghost} onClick={() => open(c)}><Edit2 size={12} /> Edit</button>
                <button className="px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1" style={{ background: 'rgba(250,82,82,0.1)', color: '#fa5252', border: '1px solid rgba(250,82,82,0.3)' }}
                  onClick={() => { if (confirm(`Delete “${c.label}”?`)) act(() => call('DELETE', undefined, `?id=${c.id}`)) }}><Trash2 size={12} /> Delete</button>
              </div>
            </div>
          ))}
          {autoOn && <p className="text-xs" style={{ color: 'var(--muted)' }}>
            Auto-registration is on: each time the WhatsApp service starts (including after waking up) it saves its own URL and token here as “Auto”. It is used unless you pick a manual credential.
          </p>}
          <p className="text-xs" style={{ color: 'var(--muted)' }}>
            The token must match <code>WA_API_TOKEN</code> on the WhatsApp service itself (set when you start it). Only one credential is used at a time; the server environment variables are the fallback if none is in use.
          </p>
        </div>
      )}

      {dlg && (
        <Modal onClose={() => setDlg(null)} title={dlg.id ? 'Edit credential' : 'Add credential'}>
          <div className="space-y-3">
            {([['label', 'Name', 'e.g. Main WhatsApp server', 'text'], ['base_url', 'Service URL', 'http://127.0.0.1:3100 or https://wa.example.com', 'text'],
               ['token', dlg.id ? 'Token (leave blank to keep the saved one)' : 'Token', 'the WA_API_TOKEN value', 'password']] as const).map(([k, l, ph, type]) => (
              <div key={k}>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>{l}</label>
                <input type={type} value={f[k]} placeholder={ph} autoComplete="off" onChange={e => setF({ ...f, [k]: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={field} />
              </div>
            ))}
            {formErr && <p className="text-xs" style={{ color: 'var(--danger)' }}>{formErr}</p>}
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setDlg(null)} className="px-4 py-2 rounded-lg text-sm" style={ghost}>Cancel</button>
              <button onClick={save} disabled={saving || !f.label.trim() || !f.base_url.trim() || (!dlg.id && !f.token.trim())}
                className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50" style={primary}>{saving ? 'Saving…' : 'Save'}</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  )
}
