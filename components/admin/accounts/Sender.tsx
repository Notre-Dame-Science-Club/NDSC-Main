'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import type { Account } from '@/lib/accountStats'
import { emailHtml, emailRecipients, mergeRecipients, parseExternal, reachSummary, whatsappCsv } from '@/lib/bulkRecipients'
import { card, field, ghostBtn, primaryBtn } from './ui'
import { useWhatsAppService } from '@/hooks/useWhatsAppService'

// Sends one message to a list of accounts plus any extra people typed in / uploaded as CSV.
//  • WhatsApp → the sender service (services/whatsapp-bulk) through /api/admin/whatsapp/*
//  • Email    → the existing Mailing system (Brevo accounts, daily limits, history) as an explicit-recipient campaign

const WA = '/api/admin/whatsapp'

type WaPreview = { total: number; invalid: number; toSend: number; shortBy: number; capacityNow: number; sample?: string }
type WaCampaign = {
  running: boolean; total: number; done: number; ok: number; skipped: number; failed: number
  waiting?: string; stopReason?: string; failedList: { phone: string; name: string; reason: string }[]
}

async function wa<T = any>(path: string, method = 'GET', body?: unknown): Promise<T> {
  const r = await fetch(`${WA}${path}`, {
    method, cache: 'no-store',
    ...(body !== undefined ? { headers: { 'content-type': 'application/json' }, body: JSON.stringify(body) } : {}),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok) throw new Error(j.error || 'Request failed')
  return j
}

export default function Sender({ accounts, who, defaultMessage = '' }: {
  /** accounts already chosen by the tab (selection or group filter) */
  accounts: Account[]
  /** short description of who the accounts are, e.g. "12 selected accounts" */
  who: string
  defaultMessage?: string
}) {
  const [extText, setExtText] = useState('')
  const [useWa, setUseWa] = useState(true)
  const [useEmail, setUseEmail] = useState(false)
  const [message, setMessage] = useState(defaultMessage)
  const [subject, setSubject] = useState('')
  const [withLogo, setWithLogo] = useState(true)
  const [busy, setBusy] = useState(false)
  const [notes, setNotes] = useState<{ ok: boolean; text: string }[]>([])
  const [preview, setPreview] = useState<WaPreview | null>(null)
  const [camp, setCamp] = useState<WaCampaign | null>(null)
  const [waErr, setWaErr] = useState('')
  // Wake the sender service as soon as this panel opens (it sleeps when idle).
  const svc = useWhatsAppService(useWa)

  const ext = useMemo(() => parseExternal(extText), [extText])
  const { recipients, droppedExternal } = useMemo(() => mergeRecipients(accounts, ext.people), [accounts, ext.people])
  const reach = useMemo(() => reachSummary(recipients), [recipients])
  const missingPhone = reach.total - reach.phone
  const missingEmail = reach.total - reach.email

  const pollWa = useCallback(async () => {
    try { const s = await wa('/api/state'); setCamp(s.campaign); setWaErr('') } catch (e: any) { setWaErr(e.message) }
  }, [])
  useEffect(() => { if (!useWa || svc.state !== 'awake') return; pollWa(); const t = setInterval(pollWa, 2500); return () => clearInterval(t) }, [useWa, svc.state, pollWa])
  useEffect(() => { setPreview(null) }, [message, extText, accounts, withLogo])

  const note = (ok: boolean, text: string) => setNotes(n => [...n, { ok, text }])
  const ready = recipients.length > 0 && message.trim() && (useWa || useEmail) && (!useEmail || subject.trim())
    && ((useWa && reach.phone > 0) || (useEmail && reach.email > 0))
    && (!useWa || svc.state === 'awake' || useEmail)

  const waOpts = () => ({ csv: whatsappCsv(recipients), template: message, notify: true, withLogo })

  const check = async () => {
    setBusy(true)
    try { setPreview(await wa<WaPreview>('/api/campaign/preview', 'POST', waOpts())) } catch (e: any) { setNotes([{ ok: false, text: 'WhatsApp: ' + e.message }]) }
    setBusy(false)
  }

  const send = async () => {
    const parts = [useWa && reach.phone ? `WhatsApp to ${reach.phone}` : '', useEmail && reach.email ? `email to ${reach.email}` : ''].filter(Boolean).join(' and ')
    if (!confirm(`Send now: ${parts}?`)) return
    setBusy(true); setNotes([])
    if (useWa && reach.phone && svc.state !== 'awake') note(false, 'WhatsApp: skipped, the service is not ready yet (still waking up or not set up).')
    else if (useWa && reach.phone) {
      try { const r = await wa('/api/campaign/start', 'POST', waOpts()); note(true, `WhatsApp: started, ${r.total} message${r.total === 1 ? '' : 's'} queued. Progress is shown below.`); pollWa() }
      catch (e: any) { note(false, 'WhatsApp: ' + e.message) }
    }
    if (useEmail && reach.email) {
      try {
        const res = await fetch('/api/admin/emailing/campaigns', {
          method: 'POST', headers: { 'content-type': 'application/json' },
          body: JSON.stringify({
            name: `Accounts: ${subject.trim()}`.slice(0, 120), subject: subject.trim(), body_html: emailHtml(message),
            explicit_recipients: emailRecipients(recipients), send_now: true,
          }),
        })
        const j = await res.json().catch(() => ({}))
        if (!res.ok) throw new Error(j.error || 'Could not create the email campaign')
        note(true, `Email: campaign created for ${j.campaign?.total_recipients ?? reach.email} people and sending has started. Follow it in Mailing → History.`)
      } catch (e: any) { note(false, 'Email: ' + e.message) }
    }
    setBusy(false)
  }

  const stat = (n: number, label: string) => (
    <div className="px-3 py-2 rounded-lg border" style={card}><div className="text-lg font-bold" style={{ color: 'var(--white)' }}>{n.toLocaleString()}</div><div className="text-[11px]" style={{ color: 'var(--muted)' }}>{label}</div></div>
  )

  return (
    <div className="space-y-4">
      <section className="p-4 rounded-xl border" style={card}>
        <h2 className="text-sm font-bold mb-1" style={{ color: 'var(--white)' }}>Who gets it</h2>
        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>{who}. You can also add people who don’t have an account: paste numbers / Gmail addresses, or upload a CSV.</p>
        <textarea value={extText} onChange={e => setExtText(e.target.value)} rows={4} className="w-full px-3 py-2 rounded-lg text-sm border outline-none font-mono" style={field}
          placeholder={'One person per line, any order:\n01711111111\nRahim, 01822222222, rahim@gmail.com\nsomeone@gmail.com\n— or a CSV with phone / email / name columns'} />
        <div className="flex items-center gap-3 mt-2 flex-wrap">
          <input type="file" accept=".csv,.txt" className="text-xs" onChange={async e => {
            const input = e.target
            const f = input.files?.[0]
            if (f) { const text = await f.text(); setExtText(t => (t.trim() ? t.trimEnd() + '\n' : '') + text) }
            input.value = ''
          }} />
          {extText && <button onClick={() => setExtText('')} className="text-xs underline" style={{ color: 'var(--muted)' }}>Clear added people</button>}
        </div>
        {(ext.people.length > 0 || ext.invalid.length > 0) && (
          <p className="text-xs mt-2" style={{ color: 'var(--muted)' }}>
            {ext.people.length} added{droppedExternal ? `, ${droppedExternal} already in the list` : ''}{ext.duplicates ? `, ${ext.duplicates} repeated` : ''}
            {ext.invalid.length ? <span style={{ color: 'var(--danger)' }}> · {ext.invalid.length} not understood ({ext.invalid.slice(0, 3).join(', ')})</span> : ''}
          </p>
        )}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-4">
          {stat(reach.total, 'people in total')}{stat(reach.phone, 'have a phone number')}{stat(reach.email, 'have an email')}{stat(reach.neither, 'have neither (skipped)')}
        </div>
      </section>

      <section className="p-4 rounded-xl border" style={card}>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--white)' }}>Message</h2>
        <div className="flex gap-5 flex-wrap mb-3 text-sm" style={{ color: 'var(--white)' }}>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={useWa} onChange={e => setUseWa(e.target.checked)} /> WhatsApp {useWa && missingPhone > 0 && <span className="text-xs" style={{ color: 'var(--muted)' }}>({missingPhone} without a number skipped)</span>}</label>
          <label className="flex items-center gap-2 cursor-pointer"><input type="checkbox" checked={useEmail} onChange={e => setUseEmail(e.target.checked)} /> Email {useEmail && missingEmail > 0 && <span className="text-xs" style={{ color: 'var(--muted)' }}>({missingEmail} without an email skipped)</span>}</label>
        </div>
        {useEmail && <input value={subject} onChange={e => setSubject(e.target.value)} placeholder="Email subject" className="w-full px-3 py-2 mb-3 rounded-lg text-sm border outline-none" style={field} />}
        <textarea value={message} onChange={e => setMessage(e.target.value)} rows={7} className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={field}
          placeholder={'Hi {name}, …'} />
        <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
          <code>{'{name}'}</code> becomes each person’s name on WhatsApp (and “there” in email, which goes out as one shared message). <code>{'{brand}'}</code> is the club name.
          WhatsApp adds the club name in bold at the top.
        </p>
        {useWa && (
          <label className="flex items-center gap-2 text-xs mt-3 cursor-pointer" style={{ color: 'var(--white)' }}>
            <input type="checkbox" checked={withLogo} onChange={e => setWithLogo(e.target.checked)} /> Attach the club logo to each WhatsApp message
          </label>
        )}
        {useWa && (svc.state === 'waking' || svc.state === 'unknown') && (
          <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>⏳ Waking up the WhatsApp service{svc.state === 'waking' ? ` (${svc.elapsed}s, up to about a minute)` : '…'}. Sending to WhatsApp unlocks when it’s ready{useEmail ? '; email can go now' : ''}.</p>
        )}
        {useWa && svc.state === 'down' && <p className="text-xs mt-3" style={{ color: 'var(--danger)' }}>WhatsApp service isn’t answering after {svc.elapsed}s. <button className="underline" onClick={svc.retry}>Try again</button> or check <Link href="/admin/credentials" className="underline">Credentials</Link>.</p>}
        {useWa && svc.state === 'unconfigured' && <p className="text-xs mt-3" style={{ color: 'var(--danger)' }}>WhatsApp service isn’t set up. Add it under <Link href="/admin/credentials" className="underline">Credentials</Link>.</p>}
        {useWa && svc.state === 'awake' && waErr && <p className="text-xs mt-3" style={{ color: 'var(--danger)' }}>WhatsApp service: {waErr} (set it up under <Link href="/admin/whatsapp" className="underline">Admin → WhatsApp</Link>)</p>}

        {preview && (
          <div className="mt-3 p-3 rounded-lg text-xs" style={{ background: 'rgba(var(--blue-rgb), .08)', color: 'var(--muted)' }}>
            WhatsApp: <b>{preview.toSend}</b> to send{preview.invalid ? `, ${preview.invalid} invalid numbers` : ''}.{' '}
            {preview.shortBy > 0
              ? <span style={{ color: 'var(--danger)' }}>Ready SIMs can send {preview.capacityNow} now, about {preview.shortBy} would be left: add credits or raise a daily limit.</span>
              : <>SIMs ready: {preview.capacityNow} (enough).</>}
            {preview.sample && <div className="mt-2 whitespace-pre-wrap italic">{preview.sample}</div>}
          </div>
        )}

        <div className="flex items-center gap-3 mt-4 flex-wrap">
          <button onClick={send} disabled={!ready || busy || !!camp?.running && useWa && !useEmail} className="px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed" style={primaryBtn}>
            {busy ? 'Working…' : `Send to ${Math.max(useWa ? reach.phone : 0, useEmail ? reach.email : 0).toLocaleString()}`}
          </button>
          {useWa && <button onClick={check} disabled={busy || !recipients.length || !message.trim()} className="px-3 py-2 rounded-lg text-xs font-bold disabled:opacity-50" style={ghostBtn}>Check WhatsApp capacity</button>}
        </div>
        {notes.map((n, i) => <p key={i} className="text-xs mt-2" style={{ color: n.ok ? 'var(--blue)' : 'var(--danger)' }}>{n.text}</p>)}
      </section>

      {useWa && camp && (
        <section className="p-4 rounded-xl border" style={card}>
          <div className="flex justify-between items-center mb-2">
            <h2 className="text-sm font-bold" style={{ color: 'var(--white)' }}>WhatsApp progress</h2>
            <div className="flex items-center gap-3">
              <span className="text-xs" style={{ color: 'var(--muted)' }}>{camp.running ? 'Running' : 'Finished'}</span>
              {camp.running && <button className="text-xs underline" style={{ color: 'var(--danger)' }} onClick={() => wa('/api/campaign/stop', 'POST', {}).then(pollWa)}>Stop</button>}
            </div>
          </div>
          <div className="text-sm" style={{ color: 'var(--white)' }}>{camp.done} of {camp.total} done · {camp.ok} sent · {camp.skipped} skipped · {camp.failed} failed</div>
          <div className="h-1.5 rounded mt-2 overflow-hidden" style={{ background: 'rgba(var(--blue-rgb), .15)' }}><div style={{ width: `${camp.total ? (100 * camp.done) / camp.total : 0}%`, height: '100%', background: 'var(--blue)' }} /></div>
          {camp.running && camp.waiting && <div className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{camp.waiting}</div>}
          {!camp.running && camp.stopReason && camp.stopReason !== 'Finished' && <div className="text-xs mt-2" style={{ color: 'var(--muted)' }}>{camp.stopReason}</div>}
          {camp.failedList.length > 0 && <div className="text-xs mt-2" style={{ color: 'var(--muted)' }}>Not sent: {camp.failedList.slice(-10).map(f => `+${f.phone} (${f.reason})`).join(', ')}</div>}
        </section>
      )}
    </div>
  )
}
