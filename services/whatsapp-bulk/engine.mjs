// Engine behind the web UI: SIM accounts (each one a linked WhatsApp number), their credits and
// limits, error handling, a usage log, and the campaign loop that spreads messages across SIMs.
//
// It never talks to WhatsApp directly. A `connect` function (see baileysDriver.mjs) is injected,
// which is what lets tests run the whole thing with fake SIMs.
//
// Credit model: 1 credit = 1 message actually sent (text or logo+caption). Numbers that are not on
// WhatsApp and failed attempts cost nothing. A SIM also has a daily limit, which resets at local midnight.

import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'

export const DEFAULT_SETTINGS = {
  brandName: '', // shown in bold at the top of messages when set; edit in the panel (Brand & message)
  brandHeader: true, // put the brand name in bold at the top of every message
  groupLink: '',
  template: 'Hi {name}!', // default text; every send can also use its own message
  countryCode: '880',
  minDelayMs: 8000,
  maxDelayMs: 20000,
  logoFile: '', // file name inside the data folder
}

export const RATE_LIMIT_COOLDOWN_MS = 30 * 60 * 1000
export const MAX_CONSECUTIVE_ERRORS = 5

// ── helpers ────────────────────────────────────────────────────────────────

export function normalizePhone(raw, cc = '880') {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  else if (d.startsWith('0')) d = cc + d.slice(1) // 01XXXXXXXXX -> 8801XXXXXXXXX
  return d
}
export const isValidPhone = (p) => /^\d{8,15}$/.test(p)

function parseCsvRows(text) {
  const rows = []
  let row = [], cell = '', q = false
  for (let i = 0; i < text.length; i++) {
    const ch = text[i]
    if (q) {
      if (ch === '"' && text[i + 1] === '"') { cell += '"'; i++ }
      else if (ch === '"') q = false
      else cell += ch
    } else if (ch === '"') q = true
    else if (ch === ',') { row.push(cell.trim()); cell = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++
      row.push(cell.trim()); cell = ''
      if (row.some(Boolean)) rows.push(row)
      row = []
    } else cell += ch
  }
  row.push(cell.trim())
  if (row.some(Boolean)) rows.push(row)
  return rows
}

/** CSV with a `phone` (and optional `name`) column, or just pasted numbers one per line. */
export function parseContacts(text, cc = '880') {
  const rows = parseCsvRows(String(text || '').replace(/^﻿/, ''))
  if (!rows.length) return { contacts: [], invalid: [], duplicates: 0 }
  const head = rows[0].map(h => h.toLowerCase())
  const pi = head.findIndex(h => ['phone', 'number', 'mobile', 'whatsapp', 'phone_number'].includes(h))
  const ni = head.findIndex(h => ['name', 'full_name'].includes(h))
  let data = rows, phoneCol = 0, nameCol = 1
  if (pi !== -1) { data = rows.slice(1); phoneCol = pi; nameCol = ni }
  const contacts = [], invalid = [], seen = new Set()
  let duplicates = 0
  for (const r of data) {
    const phone = normalizePhone(r[phoneCol], cc)
    if (!isValidPhone(phone)) { invalid.push(r[phoneCol] || '(empty)'); continue }
    if (seen.has(phone)) { duplicates++; continue }
    seen.add(phone)
    contacts.push({ phone, name: (nameCol >= 0 ? r[nameCol] : '') || 'Member' })
  }
  return { contacts, invalid, duplicates }
}

export function renderMessage(settings, contact) {
  const body = String(settings.template || '')
    .replaceAll('{name}', contact.name || 'Member')
    .replaceAll('{link}', settings.groupLink || '')
    .replaceAll('{brand}', settings.brandName || '')
    .trim()
  return (settings.brandHeader && settings.brandName ? `*${settings.brandName}*\n\n` : '') + body
}

/** Turns a WhatsApp/Baileys/network error into something the engine can act on. */
export function classifyError(err) {
  const code = err?.output?.statusCode ?? err?.statusCode ?? (typeof err?.data === 'number' ? err.data : undefined)
  const msg = String(err?.message ?? err ?? '')
  if (/not on whatsapp/i.test(msg)) return 'not_on_whatsapp'
  if (code === 401 || /logged ?out/i.test(msg)) return 'logged_out'
  if (code === 403 || /forbidden|banned|blocked|spam|restricted/i.test(msg)) return 'blocked'
  if (code === 429 || /rate-?overlimit|rate limit|too many/i.test(msg)) return 'rate_limit'
  if ([408, 428, 440, 515].includes(code) || /closed|timed? ?out|not connected|econn|socket|connecting/i.test(msg)) return 'connection'
  return 'other'
}

const dayKey = (ms) => new Date(ms).toLocaleDateString('en-CA') // YYYY-MM-DD, local time
const SIM_ID = /^[a-f0-9-]{8,40}$/

// ── engine ─────────────────────────────────────────────────────────────────

export class Engine {
  constructor({ dataDir, connect, now = () => Date.now(), sleep = (ms) => new Promise(r => setTimeout(r, ms)),
    rand = (a, b) => a + Math.floor(Math.random() * (Math.max(a, b) - a + 1)) }) {
    this.dir = dataDir
    this.connectFn = connect
    this.now = now
    this.sleep = sleep
    this.rand = rand
    fs.mkdirSync(path.join(dataDir, 'auth'), { recursive: true })
    this.simsFile = path.join(dataDir, 'sims.json')
    this.settingsFile = path.join(dataDir, 'settings.json')
    this.usageFile = path.join(dataDir, 'usage.jsonl')
    this.sentFile = path.join(dataDir, 'sent.txt')
    this.sims = new Map() // id -> { meta, rt }
    this.settings = { ...DEFAULT_SETTINGS, ...this.#readJson(this.settingsFile, {}) }
    for (const meta of this.#readJson(this.simsFile, [])) {
      this.sims.set(meta.id, { meta, rt: { status: 'disconnected', qr: null, driver: null, nextAt: 0, message: '' } })
    }
    this.campaign = null
  }

  // persistence
  #readJson(file, fallback) { try { return JSON.parse(fs.readFileSync(file, 'utf8')) } catch { return fallback } }
  #writeJson(file, data) { fs.writeFileSync(file + '.tmp', JSON.stringify(data, null, 2)); fs.renameSync(file + '.tmp', file) }
  #saveSims() { this.#writeJson(this.simsFile, [...this.sims.values()].map(s => s.meta)) }
  saveSettings(patch) {
    const p = { ...patch }
    const num = (v, d) => (Number.isFinite(+v) && +v >= 0 ? +v : d)
    if ('minDelayMs' in p) p.minDelayMs = num(p.minDelayMs, this.settings.minDelayMs)
    if ('maxDelayMs' in p) p.maxDelayMs = num(p.maxDelayMs, this.settings.maxDelayMs)
    if (p.minDelayMs > (p.maxDelayMs ?? this.settings.maxDelayMs)) p.maxDelayMs = p.minDelayMs
    for (const k of Object.keys(p)) if (!(k in DEFAULT_SETTINGS)) delete p[k]
    this.settings = { ...this.settings, ...p }
    this.#writeJson(this.settingsFile, this.settings)
    return this.settings
  }
  logoPath() { return this.settings.logoFile ? path.join(this.dir, this.settings.logoFile) : '' }

  // usage log (recent use / errors)
  log(entry) {
    const e = { ts: this.now(), ...entry }
    fs.appendFileSync(this.usageFile, JSON.stringify(e) + '\n')
    return e
  }
  recent(limit = 100, { simId, status } = {}) {
    let text = ''
    try {
      const st = fs.statSync(this.usageFile)
      const size = Math.min(st.size, 1_500_000)
      const fd = fs.openSync(this.usageFile, 'r')
      const buf = Buffer.alloc(size)
      fs.readSync(fd, buf, 0, size, st.size - size)
      fs.closeSync(fd)
      text = buf.toString('utf8')
    } catch { return [] }
    const out = []
    const lines = text.split('\n').filter(Boolean)
    for (let i = lines.length - 1; i >= 0 && out.length < limit; i--) {
      try {
        const e = JSON.parse(lines[i])
        if (simId && e.simId !== simId) continue
        if (status && e.status !== status) continue
        out.push(e)
      } catch { /* partial first line of the tail window */ }
    }
    return out
  }

  // sent history (so re-running a list never messages the same person twice)
  sentSet() { try { return new Set(fs.readFileSync(this.sentFile, 'utf8').split('\n').filter(Boolean)) } catch { return new Set() } }
  clearSent() { try { fs.unlinkSync(this.sentFile) } catch { /* none */ } }

  // ── SIMs ──────────────────────────────────────────────────────────────────

  #get(id) {
    const s = this.sims.get(id)
    if (!s) throw new Error('SIM not found')
    return s
  }

  #rollDay(sim) {
    const k = dayKey(this.now())
    if (sim.meta.day !== k) { sim.meta.day = k; sim.meta.sentToday = 0 }
  }

  addSim({ label, credits = 0, dailyLimit = 100 } = {}) {
    const id = crypto.randomUUID()
    const n = (v, d) => (Number.isFinite(+v) && +v >= 0 ? Math.floor(+v) : d)
    const meta = {
      id, label: String(label || '').trim() || `SIM ${this.sims.size + 1}`, phone: '',
      credits: n(credits, 0), dailyLimit: Math.max(1, n(dailyLimit, 100)),
      day: dayKey(this.now()), sentToday: 0, totalSent: 0, totalFailed: 0,
      paused: false, pauseReason: '', cooldownUntil: 0, consecutiveErrors: 0,
      lastError: null, lastUsedAt: 0, createdAt: this.now(),
    }
    this.sims.set(id, { meta, rt: { status: 'disconnected', qr: null, driver: null, nextAt: 0, message: '' } })
    this.#saveSims()
    this.connectSim(id)
    return id
  }

  /** Start (or restart) the WhatsApp connection. Shows a QR when the number isn't linked yet. */
  connectSim(id) {
    const sim = this.#get(id)
    if (sim.rt.driver) { try { sim.rt.driver.close() } catch { /* already closed */ } }
    sim.rt.status = 'connecting'
    sim.rt.qr = null
    sim.rt.message = ''
    const authDir = path.join(this.dir, 'auth', id)
    sim.rt.driver = this.connectFn(id, authDir, {
      onQr: (qr) => { sim.rt.status = 'qr'; sim.rt.qr = qr },
      onOpen: ({ phone } = {}) => {
        sim.rt.status = 'connected'; sim.rt.qr = null; sim.rt.message = ''
        if (phone) sim.meta.phone = phone
        this.#saveSims()
        this.log({ simId: id, status: 'info', error: 'Connected' + (phone ? ` as +${phone}` : '') })
      },
      onClose: ({ loggedOut, gaveUp, message } = {}) => {
        sim.rt.qr = null
        sim.rt.message = message || ''
        if (loggedOut) {
          sim.rt.status = 'logged_out'
          sim.rt.driver = null
          fs.rmSync(authDir, { recursive: true, force: true })
          this.#noteError(sim, 'logged_out', message || 'Logged out from the phone')
        } else if (gaveUp) {
          sim.rt.status = 'disconnected'
          sim.rt.driver = null
        } else {
          sim.rt.status = 'connecting' // driver is retrying on its own
        }
      },
    })
  }

  connectAll() { for (const [id, s] of this.sims) if (fs.existsSync(path.join(this.dir, 'auth', id)) && !s.rt.driver) this.connectSim(id) }

  addCredits(id, n) {
    const sim = this.#get(id)
    const v = Math.floor(+n)
    if (!Number.isFinite(v) || v === 0) throw new Error('Enter a number of credits')
    sim.meta.credits = Math.max(0, sim.meta.credits + v)
    this.#saveSims()
    this.log({ simId: id, status: 'credits', error: `${v > 0 ? '+' : ''}${v} credits (now ${sim.meta.credits})` })
    return sim.meta.credits
  }

  setLimits(id, { dailyLimit, credits, label } = {}) {
    const sim = this.#get(id)
    if (dailyLimit !== undefined) {
      const v = Math.floor(+dailyLimit)
      if (!Number.isFinite(v) || v < 1) throw new Error('Daily limit must be at least 1')
      sim.meta.dailyLimit = v
    }
    if (credits !== undefined) {
      const v = Math.floor(+credits)
      if (!Number.isFinite(v) || v < 0) throw new Error('Credits cannot be negative')
      sim.meta.credits = v
    }
    if (label !== undefined && String(label).trim()) sim.meta.label = String(label).trim()
    this.#saveSims()
  }

  pauseSim(id, reason = 'Paused by you') { const s = this.#get(id); s.meta.paused = true; s.meta.pauseReason = reason; this.#saveSims() }
  resumeSim(id) {
    const s = this.#get(id)
    Object.assign(s.meta, { paused: false, pauseReason: '', cooldownUntil: 0, consecutiveErrors: 0 })
    this.#saveSims()
    if (!s.rt.driver) this.connectSim(id)
  }

  async removeSim(id) {
    const s = this.#get(id)
    if (this.campaign?.running) throw new Error('Stop the running campaign before removing a SIM')
    try { await s.rt.driver?.logout?.() } catch { /* best effort: unlink from the phone */ }
    try { s.rt.driver?.close() } catch { /* already closed */ }
    fs.rmSync(path.join(this.dir, 'auth', id), { recursive: true, force: true })
    this.sims.delete(id)
    this.#saveSims()
  }

  /** Put the brand name and logo on the SIM's WhatsApp profile (what people who haven't saved the number see). */
  async applyBrand(id) {
    const sim = this.#get(id)
    if (sim.rt.status !== 'connected') throw new Error('Connect this SIM first')
    const done = []
    try {
      const name = this.settings.brandName
      const logo = this.logoPath()
      const picture = logo && fs.existsSync(logo) ? fs.readFileSync(logo) : null
      if (!name && !picture) throw new Error('Set a brand name or upload a logo first')
      await sim.rt.driver.setProfile({ name: name || undefined, picture: picture || undefined })
      if (name) done.push('name')
      if (picture) done.push('photo')
      this.log({ simId: id, status: 'info', error: `Profile updated (${done.join(' + ')})` })
      return done
    } catch (err) {
      this.#noteError(sim, classifyError(err), `Profile update failed: ${err.message}`, { count: false })
      throw err
    }
  }

  // error bookkeeping shared by every code path
  #noteError(sim, kind, message, { count = true } = {}) {
    sim.meta.lastError = { at: this.now(), kind, message: String(message).slice(0, 300) }
    if (count) sim.meta.totalFailed++
    if (kind === 'blocked') {
      sim.meta.paused = true
      sim.meta.pauseReason = 'WhatsApp refused to send (possible restriction). Check the phone, then resume.'
    } else if (kind === 'rate_limit') {
      sim.meta.cooldownUntil = this.now() + RATE_LIMIT_COOLDOWN_MS
    } else if (kind === 'connection') {
      sim.meta.cooldownUntil = Math.max(sim.meta.cooldownUntil, this.now() + 30_000)
    } else if (kind === 'other' && count) {
      sim.meta.consecutiveErrors++
      if (sim.meta.consecutiveErrors >= MAX_CONSECUTIVE_ERRORS) {
        sim.meta.paused = true
        sim.meta.pauseReason = `${MAX_CONSECUTIVE_ERRORS} errors in a row. Check the last error, then resume.`
      }
    }
    this.#saveSims()
  }

  /** Why can't this SIM send right now? null = it can. */
  #blocker(sim) {
    this.#rollDay(sim)
    const { meta, rt } = sim
    if (rt.status === 'logged_out') return 'logged out: scan the QR again'
    if (rt.status === 'qr') return 'waiting for QR scan'
    if (rt.status !== 'connected') return 'not connected'
    if (meta.paused) return meta.pauseReason || 'paused'
    if (meta.cooldownUntil > this.now()) return `cooling down for ${Math.ceil((meta.cooldownUntil - this.now()) / 60000)} min`
    if (meta.credits <= 0) return 'out of credits'
    if (meta.sentToday >= meta.dailyLimit) return 'daily limit reached'
    return null
  }

  publicSims() {
    return [...this.sims.values()].map(sim => {
      const blocker = this.#blocker(sim)
      const m = sim.meta
      let status = sim.rt.status
      if (status === 'connected') {
        status = m.paused ? 'paused' : m.cooldownUntil > this.now() ? 'cooldown'
          : m.credits <= 0 ? 'no_credits' : m.sentToday >= m.dailyLimit ? 'daily_limit' : 'ready'
      }
      return {
        id: m.id, label: m.label, phone: m.phone, status,
        problem: blocker || '', connection: sim.rt.status, message: sim.rt.message,
        credits: m.credits, dailyLimit: m.dailyLimit, sentToday: m.sentToday,
        capacity: Math.max(0, Math.min(m.credits, m.dailyLimit - m.sentToday)),
        totalSent: m.totalSent, totalFailed: m.totalFailed, lastUsedAt: m.lastUsedAt,
        lastError: m.lastError, cooldownUntil: m.cooldownUntil, paused: m.paused, pauseReason: m.pauseReason,
        qr: sim.rt.status === 'qr' ? sim.rt.qr : null,
      }
    })
  }

  // ── campaign ──────────────────────────────────────────────────────────────

  /** What would happen if you pressed Start: counts, plus whether the SIMs' credits cover it. */
  // `opts` (all optional) lets a one-off announcement carry its own text instead of the saved invitation:
  //   template  – message text for this run ({name}, {brand}, {link} still work)
  //   notify    – true = a notice, not an invitation: people messaged before are NOT skipped and
  //               this run is not added to the "already messaged" list
  //   withLogo  – false = text only
  preview(csv, opts = {}) {
    const { contacts, invalid, duplicates } = parseContacts(csv, this.settings.countryCode)
    const settings = this.#runSettings(opts)
    const sent = opts.notify ? new Set() : this.sentSet()
    const todo = contacts.filter(c => !sent.has(c.phone))
    const sims = this.publicSims()
    const capacityAll = sims.reduce((a, s) => a + s.capacity, 0) // credits/daily room on every SIM
    const usable = sims.filter(s => s.status === 'ready').reduce((a, s) => a + s.capacity, 0) // SIMs that can send right now
    return {
      total: contacts.length, invalid: invalid.length, invalidExamples: invalid.slice(0, 5), duplicates,
      alreadySent: contacts.length - todo.length, toSend: todo.length,
      capacityNow: usable, capacityAll, shortBy: Math.max(0, todo.length - usable),
      sample: todo[0] ? renderMessage(settings, todo[0]) : '',
    }
  }

  #runSettings(opts = {}) {
    const t = typeof opts.template === 'string' ? opts.template.trim() : ''
    return t ? { ...this.settings, template: t } : this.settings
  }

  startCampaign(csv, opts = {}) {
    if (this.campaign?.running) throw new Error('A campaign is already running')
    const { contacts } = parseContacts(csv, this.settings.countryCode)
    const settings = this.#runSettings(opts)
    const sent = opts.notify ? new Set() : this.sentSet()
    const queue = contacts.filter(c => !sent.has(c.phone)).map(c => ({ ...c, tried: new Set(), attempts: 0 }))
    if (!queue.length) throw new Error('Nothing to send: no valid numbers, or everyone has already been messaged')
    if (settings.template.includes('{link}') && !settings.groupLink) throw new Error('Your message uses {link} but no group link is set (Brand tab)')
    const logoPath = opts.withLogo === false ? '' : this.logoPath()
    const c = this.campaign = {
      running: true, stopRequested: false, settings, track: !opts.notify, startedAt: this.now(), finishedAt: 0, stopReason: '',
      total: queue.length, ok: 0, failed: 0, skipped: 0, current: null, waiting: '', failedList: [], perSim: {},
      logo: logoPath && fs.existsSync(logoPath) ? fs.readFileSync(logoPath) : null,
    }
    this.#run(c, queue).catch(err => { c.stopReason = `Stopped by an unexpected error: ${err.message}` })
      .finally(() => { c.running = false; c.finishedAt = this.now(); c.current = null; c.waiting = '' })
    return { total: queue.length }
  }
  stopCampaign() { if (this.campaign?.running) this.campaign.stopRequested = true }

  publicCampaign() {
    const c = this.campaign
    if (!c) return null
    const { logo, settings: _s, ...rest } = c
    return { ...rest, hasLogo: !!logo, failedList: c.failedList.slice(-500), done: c.ok + c.failed + c.skipped }
  }

  async #waitUntil(c, t) {
    while (!c.stopRequested && this.now() < t) await this.sleep(Math.min(1000, t - this.now()))
  }

  async #run(c, queue) {
    const { minDelayMs, maxDelayMs } = this.settings
    let idleSince = 0
    while (queue.length && !c.stopRequested) {
      const contact = queue[0]
      const all = [...this.sims.values()]
      const ready = all.filter(s => !this.#blocker(s))
      const candidates = ready.filter(s => !contact.tried.has(s.meta.id))

      if (!candidates.length) {
        if (ready.length) { // every ready SIM already failed on this contact: give up on this one
          this.#fail(c, queue, contact, 'Every available SIM failed to send to this number')
          continue
        }
        // Nobody can send. Wait if something may recover on its own, otherwise stop and say why.
        const recovering = all.some(s => !s.meta.paused && s.rt.status !== 'logged_out' && s.rt.status !== 'qr' && s.rt.status !== 'disconnected'
          && s.meta.credits > 0 && s.meta.sentToday < s.meta.dailyLimit)
        idleSince ||= this.now()
        c.waiting = 'Waiting for a SIM to become available: ' + all.map(s => `${s.meta.label} (${this.#blocker(s)})`).join('; ')
        if (!recovering || this.now() - idleSince > 40 * 60 * 1000) {
          c.stopReason = 'No SIM can send: ' + (all.map(s => `${s.meta.label} (${this.#blocker(s)})`).join('; ') || 'no SIMs added')
          break
        }
        await this.sleep(2000)
        continue
      }
      idleSince = 0
      c.waiting = ''

      candidates.sort((a, b) => a.rt.nextAt - b.rt.nextAt)
      const sim = candidates[0]
      await this.#waitUntil(c, sim.rt.nextAt)
      if (c.stopRequested) break
      if (this.#blocker(sim)) continue // state changed while waiting; pick again

      c.current = { phone: contact.phone, name: contact.name, simId: sim.meta.id }
      const stat = (c.perSim[sim.meta.id] ||= { label: sim.meta.label, ok: 0, failed: 0 })
      try {
        const jid = await sim.rt.driver.exists(contact.phone)
        if (!jid) {
          queue.shift(); c.skipped++
          this.log({ simId: sim.meta.id, to: contact.phone, status: 'skipped', error: 'Not on WhatsApp' })
          c.failedList.push({ phone: contact.phone, name: contact.name, reason: 'Not on WhatsApp' })
          continue
        }
        await sim.rt.driver.send(jid, { text: renderMessage(c.settings, contact), image: c.logo || undefined })
        queue.shift(); c.ok++; stat.ok++
        const m = sim.meta
        m.credits--; m.sentToday++; m.totalSent++; m.lastUsedAt = this.now(); m.consecutiveErrors = 0
        this.#saveSims()
        if (c.track) fs.appendFileSync(this.sentFile, contact.phone + '\n')
        this.log({ simId: m.id, to: contact.phone, name: contact.name, status: 'sent' })
        sim.rt.nextAt = this.now() + this.rand(minDelayMs, maxDelayMs)
      } catch (err) {
        const kind = classifyError(err)
        stat.failed++
        if (kind === 'not_on_whatsapp') {
          queue.shift(); c.skipped++
          c.failedList.push({ phone: contact.phone, name: contact.name, reason: 'Not on WhatsApp' })
          this.log({ simId: sim.meta.id, to: contact.phone, status: 'skipped', error: 'Not on WhatsApp' })
          continue
        }
        this.#noteError(sim, kind, err.message || kind)
        this.log({ simId: sim.meta.id, to: contact.phone, status: 'failed', kind, error: String(err.message || kind).slice(0, 300) })
        if (kind === 'other') contact.tried.add(sim.meta.id) // transient/SIM-level errors retry the same contact later
        contact.attempts++
        sim.rt.nextAt = this.now() + this.rand(minDelayMs, maxDelayMs)
        if (contact.attempts >= 3) this.#fail(c, queue, contact, `Failed ${contact.attempts} times: ${err.message}`)
      }
    }
    if (!c.stopReason) c.stopReason = c.stopRequested ? 'Stopped by you' : 'Finished'
  }

  #fail(c, queue, contact, reason) {
    queue.shift(); c.failed++
    c.failedList.push({ phone: contact.phone, name: contact.name, reason })
  }
}

export { SIM_ID }
