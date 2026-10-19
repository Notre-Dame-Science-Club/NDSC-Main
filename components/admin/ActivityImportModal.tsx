'use client'
// "Import participants (CSV)" for an activity session. Two steps, so nothing is written blind:
//   1. Preview  -> POST dry_run=true: shows how every column was understood and what each row would do
//   2. Import   -> POST in small chunks (progress bar), then a results table + downloadable results CSV
// Column convention: see lib/activityImport.ts and docs/ACTIVITY_CSV_IMPORT.md.

import { useRef, useState } from 'react'
import { X, Upload, Download, CheckCircle, AlertCircle, XCircle } from 'lucide-react'
import { parseCsv } from '@/lib/csvParser'
import { rowsToCsv } from '@/lib/csv'

const CHUNK = 10
const MAX_ROWS = 1000

type TargetResult = { label: string; status: 'registered' | 'ready' | 'already' | 'failed'; message?: string }
type RowResult = {
  row: number; email: string; name: string
  account: 'created' | 'existing' | 'will_create' | 'none'
  targets: TargetResult[]; errors: string[]; warnings: string[]
}
type Column = { header: string; kind: string; maps_to: string }

const input = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'
const inputStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }

function rowState(r: RowResult): 'ok' | 'skipped' | 'partial' | 'error' {
  if (r.errors.length || r.targets.some(t => t.status === 'failed')) return r.targets.some(t => t.status === 'registered' || t.status === 'ready') ? 'partial' : 'error'
  if (r.targets.length && r.targets.every(t => t.status === 'already')) return 'skipped'
  if (r.targets.some(t => t.status === 'already')) return 'partial'
  return 'ok'
}
const chip: Record<string, { bg: string; fg: string; text: string }> = {
  ok: { bg: '#34d39922', fg: 'var(--cat-teal)', text: 'OK' },
  skipped: { bg: 'rgba(var(--warning-rgb), 0.13)', fg: 'var(--warning)', text: 'Already registered' },
  partial: { bg: 'rgba(var(--warning-rgb), 0.13)', fg: 'var(--warning)', text: 'Partial' },
  error: { bg: 'rgba(var(--danger-soft-rgb), 0.13)', fg: 'var(--danger-soft)', text: 'Error' },
}

export default function ActivityImportModal({ sessionId, onClose, onDone }: { sessionId: string; onClose: () => void; onDone: () => void }) {
  const fileRef = useRef<HTMLInputElement>(null)
  const [fileName, setFileName] = useState('')
  const [parsed, setParsed] = useState<{ headers: string[]; rows: string[][] } | null>(null)
  const [password, setPassword] = useState('')
  const [payment, setPayment] = useState<'not_required' | 'paid' | 'pending'>('not_required')
  const [welcome, setWelcome] = useState(false)
  const [busy, setBusy] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [error, setError] = useState('')
  const [columns, setColumns] = useState<Column[] | null>(null)
  const [results, setResults] = useState<RowResult[] | null>(null)
  const [phase, setPhase] = useState<'setup' | 'preview' | 'done'>('setup')

  const base = () => ({
    session_id: sessionId, default_password: password, payment_status: payment, send_welcome_email: welcome,
  })

  const post = async (body: any) => {
    const res = await fetch('/api/admin/activity-registrations-import', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`)
    return data
  }

  const onFile = (f: File | undefined) => {
    if (!f) return
    setError(''); setColumns(null); setResults(null); setPhase('setup'); setFileName(f.name)
    const reader = new FileReader()
    reader.onload = e => {
      const { headers, rows } = parseCsv(String(e.target?.result || ''))
      if (!headers.length) { setParsed(null); setError('That file looks empty.'); return }
      if (rows.length > MAX_ROWS) { setParsed(null); setError(`${rows.length} rows is over the ${MAX_ROWS}-row limit — split the file.`); return }
      setParsed({ headers, rows })
    }
    reader.readAsText(f)
  }

  const downloadTemplate = async () => {
    try {
      const res = await fetch(`/api/admin/activity-registrations-import?sessionId=${sessionId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not build the template.')
      save(data.csv, 'participants-template.csv')
    } catch (e: any) { setError(e.message) }
  }

  const save = (text: string, name: string) => {
    const a = document.createElement('a')
    a.href = URL.createObjectURL(new Blob(['\uFEFF' + text], { type: 'text/csv;charset=utf-8;' }))
    a.download = name; a.click(); URL.revokeObjectURL(a.href)
  }

  const preview = async () => {
    if (!parsed) return
    setBusy(true); setError('')
    try {
      const d = await post({ ...base(), headers: parsed.headers, rows: parsed.rows, dry_run: true })
      setColumns(d.columns); setResults(d.results); setPhase('preview')
    } catch (e: any) { setError(e.message) } finally { setBusy(false) }
  }

  const runImport = async () => {
    if (!parsed) return
    setBusy(true); setError('')
    const all: RowResult[] = []
    const rows = parsed.rows
    setProgress({ done: 0, total: rows.length })
    for (let i = 0; i < rows.length; i += CHUNK) {
      const slice = rows.slice(i, i + CHUNK)
      try {
        const d = await post({ ...base(), headers: parsed.headers, rows: slice, row_offset: i })
        all.push(...d.results)
      } catch (e: any) {
        // one failed request must not hide the rest: mark just this chunk, keep going
        slice.forEach((_, j) => all.push({ row: i + j + 2, email: '', name: '', account: 'none', targets: [], warnings: [], errors: [e.message] }))
      }
      setProgress({ done: Math.min(i + CHUNK, rows.length), total: rows.length })
    }
    setResults(all); setPhase('done'); setBusy(false); setProgress(null)
    onDone()
  }

  const downloadResults = () => {
    const out: string[][] = []
    for (const r of results || []) {
      if (!r.targets.length) out.push([String(r.row), r.email, r.account, '', 'error', r.errors.join(' | ')])
      for (const t of r.targets) out.push([String(r.row), r.email, r.account, t.label, t.status, [t.message, ...r.errors].filter(Boolean).join(' | ')])
    }
    save(rowsToCsv(['row', 'email', 'account', 'segment', 'status', 'message'], out), 'import-results.csv')
  }

  const counts = (results || []).reduce((c, r) => { c[rowState(r)]++; return c }, { ok: 0, skipped: 0, partial: 0, error: 0 } as Record<string, number>)
  const importable = (results || []).filter(r => !r.errors.length && r.targets.some(t => t.status === 'ready')).length
  const pwOk = password.length >= 6

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => !busy && onClose()}>
      <div className="max-w-4xl w-full rounded-2xl p-5 space-y-4 max-h-[88vh] overflow-y-auto" style={{ background: 'var(--surface-deep)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold" style={{ color: 'var(--white)' }}>Import participants from CSV</h3>
          <button onClick={() => !busy && onClose()} style={{ color: 'var(--muted)' }}><X size={16} /></button>
        </div>

        {phase !== 'done' && (
          <div className="text-xs space-y-1" style={{ color: 'var(--muted)' }}>
            <p>One row per participant. Common details use plain columns (<code>email</code>, <code>full_name</code>, <code>phone</code>, <code>college</code>, <code>college_roll</code>…). Segment fields are <code>segment_field</code> and sub-segment fields <code>segment_subsegment_field</code>; the segment is taken from whichever of those columns has a value.</p>
            <p>People without a website account get one automatically (missing details are saved as <code>{'<not set>'}</code>). Already-registered people are skipped, never duplicated.</p>
          </div>
        )}

        {phase !== 'done' && (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2 flex items-center gap-2 flex-wrap">
              <input ref={fileRef} type="file" accept=".csv,text/csv" className="hidden" onChange={e => onFile(e.target.files?.[0])} />
              <button onClick={() => fileRef.current?.click()} disabled={busy} className="text-xs px-3 py-2 rounded-lg flex items-center gap-1.5"
                style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.25)' }}>
                <Upload size={12} /> {fileName || 'Choose CSV file'}
              </button>
              <button onClick={downloadTemplate} disabled={busy} className="text-xs px-3 py-2 rounded-lg flex items-center gap-1.5"
                style={{ background: 'rgba(var(--cat-teal-rgb), 0.1)', color: 'var(--cat-teal)', border: '1px solid rgba(var(--cat-teal-rgb), 0.25)' }}>
                <Download size={12} /> Download template for this activity
              </button>
              {parsed && <span className="text-xs" style={{ color: 'var(--border-soft)' }}>{parsed.rows.length} row(s), {parsed.headers.length} column(s)</span>}
            </div>
            <label className="text-xs space-y-1" style={{ color: 'var(--muted)' }}>
              Default password for newly created accounts (used when a row has no <code>password</code>)
              <input type="text" value={password} onChange={e => { setPassword(e.target.value); setPhase('setup') }} placeholder="min 6 characters" className={input} style={inputStyle} />
            </label>
            <label className="text-xs space-y-1" style={{ color: 'var(--muted)' }}>
              Payment, for segments that have a fee
              <select value={payment} onChange={e => { setPayment(e.target.value as any); setPhase('setup') }} className={input} style={inputStyle}>
                <option value="not_required">Waived / not required</option>
                <option value="paid">Mark as paid</option>
                <option value="pending">Pending (participant pays later)</option>
              </select>
            </label>
            <label className="text-xs flex items-center gap-2 sm:col-span-2" style={{ color: 'var(--muted)' }}>
              <input type="checkbox" checked={welcome} onChange={e => setWelcome(e.target.checked)} />
              Send the event's welcome email to each imported participant (only if the event has one turned on)
            </label>
          </div>
        )}

        {error && <p className="text-sm p-3 rounded-lg" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)', border: '1px solid rgba(var(--danger-rgb), 0.3)' }}>{error}</p>}

        {phase === 'setup' && (
          <div className="flex justify-end">
            <button onClick={preview} disabled={!parsed || !pwOk || busy} className="text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-40"
              style={{ background: 'var(--blue)', color: '#000' }}>
              {busy ? 'Checking…' : 'Preview (nothing is saved yet)'}
            </button>
          </div>
        )}

        {columns && phase === 'preview' && (
          <details className="rounded-lg border p-3" style={{ borderColor: 'var(--border)' }} open={columns.some(c => c.kind === 'ignored')}>
            <summary className="text-xs font-bold cursor-pointer" style={{ color: 'var(--accent2)' }}>
              HOW YOUR COLUMNS WERE UNDERSTOOD {columns.some(c => c.kind === 'ignored') && `— ${columns.filter(c => c.kind === 'ignored').length} ignored`}
            </summary>
            <div className="mt-2 space-y-0.5">
              {columns.map((c, i) => (
                <p key={i} className="text-xs" style={{ color: c.kind === 'ignored' ? 'var(--warning)' : 'var(--muted)' }}>
                  <code>{c.header}</code> → {c.kind === 'ignored' ? `ignored (${c.maps_to})` : c.maps_to}
                </p>
              ))}
            </div>
          </details>
        )}

        {results && phase !== 'setup' && (
          <>
            <div className="flex items-center gap-3 flex-wrap text-xs">
              <span style={{ color: 'var(--cat-teal)' }}><CheckCircle size={12} className="inline mr-1" />{counts.ok} {phase === 'preview' ? 'ready' : 'registered'}</span>
              <span style={{ color: 'var(--warning)' }}><AlertCircle size={12} className="inline mr-1" />{counts.skipped + counts.partial} skipped / partial</span>
              <span style={{ color: 'var(--danger-soft)' }}><XCircle size={12} className="inline mr-1" />{counts.error} with errors</span>
              {phase === 'done' && <button onClick={downloadResults} className="ml-auto underline" style={{ color: 'var(--blue)' }}>Download results CSV</button>}
            </div>
            <div className="space-y-1.5">
              {results.map(r => {
                const st = rowState(r), c = chip[st]
                return (
                  <div key={r.row} className="rounded-lg border p-2.5" style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs" style={{ color: 'var(--border-soft)' }}>Row {r.row}</span>
                      <span className="text-sm font-semibold" style={{ color: 'var(--white)' }}>{r.name !== '<not set>' ? r.name : r.email}</span>
                      <span className="text-xs" style={{ color: 'var(--muted)' }}>{r.name !== '<not set>' ? r.email : ''}</span>
                      <span className="text-xs px-1.5 py-0.5 rounded ml-auto" style={{ background: c.bg, color: c.fg }}>{c.text}</span>
                      {(r.account === 'created' || r.account === 'will_create') && (
                        <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(var(--blue-rgb), 0.13)', color: 'var(--blue)' }}>
                          {r.account === 'created' ? 'account created' : 'new account'}
                        </span>
                      )}
                    </div>
                    {r.targets.map((t, i) => (
                      <p key={i} className="text-xs mt-0.5" style={{ color: t.status === 'failed' ? 'var(--danger-soft)' : t.status === 'already' ? 'var(--warning)' : 'var(--muted)' }}>
                        {t.status === 'registered' ? '✓' : t.status === 'ready' ? '→' : '✗'} {t.label}{t.message ? ` — ${t.message}` : ''}
                      </p>
                    ))}
                    {r.errors.map((m, i) => <p key={'e' + i} className="text-xs mt-0.5" style={{ color: 'var(--danger-soft)' }}>✗ {m}</p>)}
                    {r.warnings.map((m, i) => <p key={'w' + i} className="text-xs mt-0.5" style={{ color: 'var(--border-soft)' }}>! {m}</p>)}
                  </div>
                )
              })}
            </div>
          </>
        )}

        {progress && (
          <div>
            <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--surface)' }}>
              <div className="h-full" style={{ width: `${(progress.done / progress.total) * 100}%`, background: 'var(--blue)' }} />
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>Importing… {progress.done} / {progress.total} rows — keep this window open.</p>
          </div>
        )}

        {phase === 'preview' && (
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {importable} row(s) will be imported{counts.error ? `; ${counts.error} with errors will be skipped (fix them in the CSV and re-import — already-imported rows are safely skipped).` : '.'}
            </p>
            <button onClick={runImport} disabled={busy || importable === 0} className="text-sm px-4 py-2 rounded-lg font-semibold disabled:opacity-40 flex-shrink-0"
              style={{ background: 'var(--blue)', color: '#000' }}>
              {busy ? 'Importing…' : `Import ${importable} participant(s)`}
            </button>
          </div>
        )}
        {phase === 'done' && (
          <div className="flex justify-end"><button onClick={onClose} className="text-sm px-4 py-2 rounded-lg font-semibold" style={{ background: 'var(--blue)', color: '#000' }}>Close</button></div>
        )}
      </div>
    </div>
  )
}
