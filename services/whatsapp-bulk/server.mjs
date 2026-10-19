// WhatsApp sender. Run: npm start   then open http://localhost:3000
// Control panel + API. Listens on 127.0.0.1 unless WA_HOST / Render says otherwise. State lives in DATA_DIR (default ./data).

import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import crypto from 'node:crypto'
import { fileURLToPath } from 'node:url'
import QRCode from 'qrcode'
import { Engine, SIM_ID } from './engine.mjs'
import { baileysConnect } from './baileysDriver.mjs'
import { mockConnect } from './mockDriver.mjs'

const root = path.dirname(fileURLToPath(import.meta.url))
const PORT = Number(process.env.PORT || 3000)
// Standalone use: 127.0.0.1 only. When the NDSC website drives this service, set WA_API_TOKEN (and
// WA_HOST=0.0.0.0 if the website runs on another machine); every request must then carry that token.
// On Render (RENDER=true is set automatically) it must bind 0.0.0.0 to be reachable.
const HOST = process.env.WA_HOST || (process.env.RENDER ? '0.0.0.0' : '127.0.0.1')
const API_TOKEN = process.env.WA_API_TOKEN || ''
// Standalone use on a public host: set WA_ADMIN_PASSWORD and sign in through the panel (cookie session).
const ADMIN_PASSWORD = process.env.WA_ADMIN_PASSWORD || ''
const DEMO = process.env.DEMO === '1' // fake SIMs, separate data folder, nothing is really sent
// DATA_DIR = where SIM logins, credits and history live. On Render point it at a persistent disk (e.g. /var/data).
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, DEMO ? 'data-demo' : 'data')
const engine = new Engine({ dataDir: DATA_DIR, connect: DEMO ? mockConnect : baileysConnect })
engine.connectAll() // re-open every SIM that was already linked

// ── password sessions (standalone mode) ──
const sha = (s) => crypto.createHash('sha256').update(s).digest()
const sessionKey = ADMIN_PASSWORD ? sha('wa-session:' + ADMIN_PASSWORD) : null
const SESSION_MS = 7 * 24 * 3600 * 1000
const hmac = (v) => crypto.createHmac('sha256', sessionKey).update(v).digest('hex')
const makeSession = () => { const exp = String(Date.now() + SESSION_MS); return `${exp}.${hmac(exp)}` }
function cookie(req, name) {
  const m = String(req.headers.cookie || '').split(/;\s*/).find(c => c.startsWith(name + '='))
  return m ? decodeURIComponent(m.slice(name.length + 1)) : ''
}
function validSession(req) {
  if (!sessionKey) return false
  const [exp, sig] = cookie(req, 'wa_session').split('.')
  if (!exp || !sig || Number(exp) < Date.now()) return false
  const a = Buffer.from(sig), b = Buffer.from(hmac(exp))
  return a.length === b.length && crypto.timingSafeEqual(a, b)
}
const secureCookie = (req) => process.env.RENDER || req.headers['x-forwarded-proto'] === 'https' ? '; Secure' : ''
const setSession = (req, res, value, maxAge) => res.setHeader('Set-Cookie', `wa_session=${value}; HttpOnly; SameSite=Strict; Path=/; Max-Age=${maxAge}${secureCookie(req)}`)
const fails = new Map() // ip -> { n, until }: 5 wrong passwords locks that address for 15 min
const ipOf = (req) => String(req.headers['x-forwarded-for'] || req.socket.remoteAddress || '').split(',')[0].trim()

const qrCache = new Map() // qr string -> data URL
async function qrImage(qr) {
  if (!qr) return null
  if (!qrCache.has(qr)) {
    if (qrCache.size > 20) qrCache.clear()
    qrCache.set(qr, await QRCode.toDataURL(qr, { margin: 1, width: 280 }))
  }
  return qrCache.get(qr)
}

const send = (res, code, body, type = 'application/json') => {
  res.writeHead(code, { 'Content-Type': type, 'Cache-Control': 'no-store' })
  res.end(type === 'application/json' ? JSON.stringify(body) : body)
}
const fail = (res, code, msg) => send(res, code, { error: msg })

function readBody(req, limit = 6_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = []; let size = 0
    req.on('data', (c) => { size += c.length; if (size > limit) { reject(new Error('Upload too large')); req.destroy() } else chunks.push(c) })
    req.on('end', () => resolve(Buffer.concat(chunks)))
    req.on('error', reject)
  })
}
const readJson = async (req) => { try { return JSON.parse((await readBody(req)).toString('utf8') || '{}') } catch { return {} } }

// Magic-byte sniffing: only real PNG/JPEG logos are accepted.
function imageExt(buf) {
  if (buf.length > 8 && buf.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png'
  if (buf.length > 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'jpg'
  return null
}

async function state(url) {
  const simId = url.searchParams.get('sim') || undefined
  const status = url.searchParams.get('status') || undefined
  const sims = await Promise.all(engine.publicSims().map(async (s) => ({ ...s, qr: undefined, qrImage: await qrImage(s.qr) })))
  return {
    sims, settings: engine.settings, hasLogo: !!engine.logoPath() && fs.existsSync(engine.logoPath()),
    campaign: engine.publicCampaign(), recent: engine.recent(150, { simId, status }), now: Date.now(), passwordLogin: !!ADMIN_PASSWORD,
  }
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${HOST}`)
    const p = url.pathname

    // Unauthenticated, reveals nothing: lets the website (and Render) tell whether the service is awake.
    if (req.method === 'GET' && p === '/healthz') return send(res, 200, { ok: true })

    if (req.method === 'POST' && p === '/login' && ADMIN_PASSWORD) {
      const ip = ipOf(req), f = fails.get(ip)
      if (f && f.until > Date.now()) return fail(res, 429, 'Too many wrong passwords. Try again in a few minutes.')
      const given = String((await readJson(req)).password || '')
      if (crypto.timingSafeEqual(sha(given), sha(ADMIN_PASSWORD))) { fails.delete(ip); setSession(req, res, makeSession(), SESSION_MS / 1000); return send(res, 200, { ok: true }) }
      const n = (f?.n || 0) + 1; fails.set(ip, { n, until: n >= 5 ? Date.now() + 15 * 60 * 1000 : 0 })
      return fail(res, 401, 'Wrong password')
    }
    if (req.method === 'POST' && p === '/logout') { setSession(req, res, '', 0); return send(res, 200, { ok: true }) }

    if (API_TOKEN || ADMIN_PASSWORD) {
      // Website mode: Bearer token (server-to-server). Standalone mode: password session cookie.
      let bearerOk = false
      if (API_TOKEN) {
        const given = Buffer.from(String(req.headers.authorization || ''))
        const want = Buffer.from(`Bearer ${API_TOKEN}`)
        bearerOk = given.length === want.length && crypto.timingSafeEqual(given, want)
      }
      const cookieOk = !bearerOk && validSession(req)
      const isPage = req.method === 'GET' && (p === '/' || p === '/index.html') // the page holds no secrets; it shows the login box itself
      if (!bearerOk && !cookieOk && !isPage) return fail(res, 401, 'Unauthorized')
      if (cookieOk && req.method !== 'GET') { // cookie sessions: only our own page may change things
        const origin = req.headers.origin
        if (req.headers['x-ndsc'] !== '1' || (origin && new URL(origin).host !== req.headers.host)) return fail(res, 403, 'Forbidden')
      }
    } else {
      // Local-only mode. Anything that changes state must come from our own page (blocks other websites from driving this server).
      if (req.method !== 'GET') {
        const origin = req.headers.origin
        if (req.headers['x-ndsc'] !== '1' || (origin && new URL(origin).host !== req.headers.host)) return fail(res, 403, 'Forbidden')
      }
      if (!/^(localhost|127\.0\.0\.1)(:\d+)?$/.test(req.headers.host || '')) return fail(res, 403, 'Forbidden host')
    }

    if (req.method === 'GET' && (p === '/' || p === '/index.html')) return send(res, 200, fs.readFileSync(path.join(root, 'ui', 'index.html')), 'text/html; charset=utf-8')
    if (req.method === 'GET' && p === '/api/state') return send(res, 200, await state(url))
    if (req.method === 'GET' && p === '/logo') {
      const f = engine.logoPath()
      if (!f || !fs.existsSync(f)) return fail(res, 404, 'No logo')
      return send(res, 200, fs.readFileSync(f), f.endsWith('.png') ? 'image/png' : 'image/jpeg')
    }

    if (req.method === 'POST' && p === '/api/sims') {
      const b = await readJson(req)
      return send(res, 200, { id: engine.addSim({ label: b.label, credits: b.credits, dailyLimit: b.dailyLimit }) })
    }
    const m = p.match(/^\/api\/sims\/([^/]+)(?:\/([a-z-]+))?$/)
    if (m) {
      const [, id, action] = m
      if (!SIM_ID.test(id)) return fail(res, 400, 'Bad id')
      if (req.method === 'DELETE' && !action) { await engine.removeSim(id); return send(res, 200, { ok: true }) }
      if (req.method === 'POST') {
        const b = await readJson(req)
        if (action === 'credits') return send(res, 200, { credits: engine.addCredits(id, b.add) })
        if (action === 'limits') { engine.setLimits(id, b); return send(res, 200, { ok: true }) }
        if (action === 'connect') { engine.connectSim(id); return send(res, 200, { ok: true }) }
        if (action === 'pause') { engine.pauseSim(id); return send(res, 200, { ok: true }) }
        if (action === 'resume') { engine.resumeSim(id); return send(res, 200, { ok: true }) }
        if (action === 'apply-brand') return send(res, 200, { applied: await engine.applyBrand(id) })
      }
    }

    if (req.method === 'POST' && p === '/api/settings') return send(res, 200, engine.saveSettings(await readJson(req)))
    if (req.method === 'POST' && p === '/api/logo') {
      const buf = await readBody(req)
      const ext = imageExt(buf)
      if (!ext) return fail(res, 400, 'The logo must be a PNG or JPEG image')
      for (const old of ['logo.png', 'logo.jpg']) fs.rmSync(path.join(engine.dir, old), { force: true })
      fs.writeFileSync(path.join(engine.dir, `logo.${ext}`), buf)
      engine.saveSettings({ logoFile: `logo.${ext}` })
      return send(res, 200, { ok: true })
    }
    if (req.method === 'DELETE' && p === '/api/logo') {
      for (const old of ['logo.png', 'logo.jpg']) fs.rmSync(path.join(engine.dir, old), { force: true })
      engine.saveSettings({ logoFile: '' })
      return send(res, 200, { ok: true })
    }

    if (req.method === 'POST' && p === '/api/campaign/preview') { const b = await readJson(req); return send(res, 200, engine.preview(b.csv, b)) }
    if (req.method === 'POST' && p === '/api/campaign/start') { const b = await readJson(req); return send(res, 200, engine.startCampaign(b.csv, b)) }
    if (req.method === 'POST' && p === '/api/campaign/stop') { engine.stopCampaign(); return send(res, 200, { ok: true }) }
    if (req.method === 'POST' && p === '/api/sent/clear') { engine.clearSent(); return send(res, 200, { ok: true }) }

    fail(res, 404, 'Not found')
  } catch (err) {
    fail(res, 400, err.message || 'Something went wrong')
  }
})

if (HOST !== '127.0.0.1' && !API_TOKEN && !ADMIN_PASSWORD) { console.error('Refusing to listen on a public address without WA_API_TOKEN or WA_ADMIN_PASSWORD.'); process.exit(1) }
server.listen(PORT, HOST, () => console.log(`NDSC WhatsApp sender${DEMO ? ' (DEMO: nothing is really sent)' : ''} → http://${HOST}:${PORT}${API_TOKEN ? ' (token required)' : ''}${ADMIN_PASSWORD ? ' (password login)' : ''}`))

// ── Tell the NDSC website where we are, every time we start (e.g. after Render wakes us) ──
// Set NDSC_URL (the website's address) and NDSC_REGISTER_SECRET (same value as SERVICE_REGISTER_SECRET on the website).
// Our public address is RENDER_EXTERNAL_URL on Render, or WA_PUBLIC_URL elsewhere. The website may itself be
// cold-starting, so retry for a few minutes.
const NDSC_URL = (process.env.NDSC_URL || '').replace(/\/+$/, '')
const REGISTER_SECRET = process.env.NDSC_REGISTER_SECRET || ''
const PUBLIC_URL = (process.env.WA_PUBLIC_URL || process.env.RENDER_EXTERNAL_URL || '').replace(/\/+$/, '')
async function registerWithWebsite() {
  if (DEMO || !NDSC_URL || !REGISTER_SECRET) return
  if (!PUBLIC_URL || !API_TOKEN) { console.warn('Auto-register skipped: needs WA_PUBLIC_URL (or RENDER_EXTERNAL_URL) and WA_API_TOKEN.'); return }
  for (let attempt = 1; attempt <= 8; attempt++) {
    try {
      const r = await fetch(`${NDSC_URL}/api/service/register`, {
        method: 'POST', headers: { 'content-type': 'application/json', authorization: `Bearer ${REGISTER_SECRET}` },
        body: JSON.stringify({ provider: 'whatsapp', base_url: PUBLIC_URL, token: API_TOKEN }), signal: AbortSignal.timeout(60_000),
      })
      if (r.ok) { console.log('Registered with the NDSC website.'); return }
      if (r.status === 401 || r.status === 404) { console.error(`NDSC website refused registration (${r.status}): check NDSC_REGISTER_SECRET / SERVICE_REGISTER_SECRET.`); return }
      console.warn(`Registration attempt ${attempt} failed: HTTP ${r.status}`)
    } catch (e) { console.warn(`Registration attempt ${attempt} failed: ${e.message}`) }
    await new Promise(r => setTimeout(r, Math.min(60_000, 5_000 * attempt)))
  }
  console.error('Could not register with the NDSC website; add the URL and token under Admin → Credentials instead.')
}
registerWithWebsite()
