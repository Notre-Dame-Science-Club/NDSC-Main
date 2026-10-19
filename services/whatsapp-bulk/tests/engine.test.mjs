import { test } from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { Engine, parseContacts, renderMessage, classifyError, normalizePhone, DEFAULT_SETTINGS, MAX_CONSECUTIVE_ERRORS } from '../engine.mjs'

// A fake WhatsApp connection. `behaviour(simId, phone)` may throw to simulate errors.
function harness({ behaviour = () => {}, notOnWa = new Set() } = {}) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'wa-'))
  let clock = new Date('2026-06-01T10:00:00').getTime()
  const sends = []
  const handlers = {}
  const connect = (id, authDir, h) => {
    handlers[id] = h
    fs.mkdirSync(authDir, { recursive: true })
    queueMicrotask(() => h.onOpen({ phone: '8801700000' + sends.length }))
    return {
      exists: async (p) => (notOnWa.has(p) ? null : p + '@s.whatsapp.net'),
      send: async (jid, payload) => { await behaviour(id, jid); sends.push({ sim: id, jid, ...payload }) },
      setProfile: async (x) => { sends.push({ sim: id, profile: x }) },
      logout: async () => {}, close: () => {},
    }
  }
  const e = new Engine({ dataDir: dir, connect, now: () => clock, sleep: async (ms) => { clock += ms }, rand: (a) => a })
  e.saveSettings({ groupLink: 'https://chat.whatsapp.com/x', minDelayMs: 1000, maxDelayMs: 1000, brandName: 'Notre Dame Science Club',
    template: "Hi {name}!\n\nYou're invited to join our group on WhatsApp:\n{link}\n\nSee you there!" })
  return { e, sends, handlers, advance: (ms) => { clock += ms }, dir, now: () => clock }
}
const ready = () => new Promise(r => setTimeout(r, 5))
const wait = async (e) => { while (e.campaign?.running) await new Promise(r => setTimeout(r, 2)) }
const csv = (n, start = 1) => 'phone,name\n' + Array.from({ length: n }, (_, i) => `0170000${String(start + i).padStart(4, '0')},P${i}`).join('\n')

test('contacts: csv, pasted numbers, +880/00/0 forms, dupes and junk', () => {
  const r = parseContacts('phone,name\n01700000001,Rahim\n+8801700000001,Dup\n"880 1800-000002","Karim, K"\nabc,Bad\n', '880')
  assert.deepEqual(r.contacts, [{ phone: '8801700000001', name: 'Rahim' }, { phone: '8801800000002', name: 'Karim, K' }])
  assert.equal(r.duplicates, 1); assert.equal(r.invalid.length, 1)
  assert.deepEqual(parseContacts('01711111111\n01722222222').contacts.map(c => c.phone), ['8801711111111', '8801722222222'])
  assert.equal(normalizePhone('008801711111111'), '8801711111111')
})

test('message shows brand name header, name and link', () => {
  const m = renderMessage({ ...DEFAULT_SETTINGS, brandName: 'Notre Dame Science Club', template: 'Hi {name}!\n{link}\nBye', groupLink: 'L' }, { name: 'Rahim' })
  assert.match(m, /^\*Notre Dame Science Club\*\n\nHi Rahim!/)
  assert.ok(m.includes('\nL\n'))
  assert.ok(!renderMessage({ ...DEFAULT_SETTINGS, brandName: 'B', brandHeader: false }, { name: 'x' }).startsWith('*'))
})

test('classifyError', () => {
  assert.equal(classifyError({ output: { statusCode: 401 } }), 'logged_out')
  assert.equal(classifyError(new Error('rate-overlimit')), 'rate_limit')
  assert.equal(classifyError({ output: { statusCode: 403 }, message: 'x' }), 'blocked')
  assert.equal(classifyError(new Error('Connection Closed')), 'connection')
  assert.equal(classifyError(new Error('boom')), 'other')
})

test('credits are spent per message; stops when out of credits and says so', async () => {
  const h = harness(); const id = h.e.addSim({ label: 'A', credits: 3, dailyLimit: 100 }); await ready()
  h.e.startCampaign(csv(5)); await wait(h.e)
  const s = h.e.publicSims()[0]
  assert.equal(h.sends.length, 3); assert.equal(s.credits, 0); assert.equal(s.totalSent, 3); assert.equal(s.status, 'no_credits')
  assert.match(h.e.campaign.stopReason, /out of credits/)
  h.e.addCredits(id, 10)                                  // top up, run again: only the 2 unsent are messaged
  h.e.startCampaign(csv(5)); await wait(h.e)
  assert.equal(h.sends.length, 5); assert.equal(h.e.publicSims()[0].credits, 8)
  assert.equal(h.e.campaign.stopReason, 'Finished')
})

test('daily limit caps a SIM and resets the next day', async () => {
  const h = harness(); h.e.addSim({ credits: 100, dailyLimit: 2 }); await ready()
  h.e.startCampaign(csv(5)); await wait(h.e)
  assert.equal(h.sends.length, 2); assert.equal(h.e.publicSims()[0].status, 'daily_limit')
  h.advance(24 * 3600 * 1000)
  h.e.startCampaign(csv(5)); await wait(h.e)
  assert.equal(h.sends.length, 4)
})

test('several SIMs share the load and each one respects its own credits', async () => {
  const h = harness(); h.e.addSim({ label: 'A', credits: 2 }); h.e.addSim({ label: 'B', credits: 10 }); await ready()
  h.e.startCampaign(csv(6)); await wait(h.e)
  const [a, b] = h.e.publicSims()
  assert.equal(a.totalSent + b.totalSent, 6); assert.equal(a.totalSent, 2); assert.equal(b.totalSent, 4)
})

test('numbers not on WhatsApp are skipped for free and reported', async () => {
  const h = harness({ notOnWa: new Set(['8801700000002']) }); h.e.addSim({ credits: 10 }); await ready()
  h.e.startCampaign(csv(3)); await wait(h.e)
  assert.equal(h.e.campaign.skipped, 1)
  assert.equal(h.sends.length, 2)
  assert.equal(h.e.publicSims()[0].credits, 8) // only the 2 real sends cost credits
  assert.equal(h.e.campaign.failedList[0].reason, 'Not on WhatsApp')
})

test('rate limit: SIM cools down, work moves to the other SIM, error is recorded', async () => {
  let limited = true
  const h = harness({ behaviour: (sim) => { if (limited && sim === h.ids.A) throw new Error('rate-overlimit') } })
  h.ids = { A: h.e.addSim({ label: 'A', credits: 10 }) }; h.ids.B = h.e.addSim({ label: 'B', credits: 10 }); await ready()
  h.e.startCampaign(csv(4)); await wait(h.e)
  const a = h.e.publicSims().find(s => s.label === 'A'), b = h.e.publicSims().find(s => s.label === 'B')
  assert.equal(a.status, 'cooldown'); assert.equal(a.lastError.kind, 'rate_limit'); assert.equal(a.credits, 10) // failed sends cost nothing
  assert.equal(b.totalSent, 4); assert.equal(h.e.campaign.ok, 4)
  assert.ok(h.e.recent(50, { simId: h.ids.A, status: 'failed' }).length >= 1)
})

test('blocked: SIM is paused until you resume it', async () => {
  const h = harness({ behaviour: () => { throw Object.assign(new Error('forbidden'), { output: { statusCode: 403 } }) } })
  const id = h.e.addSim({ credits: 10 }); await ready()
  h.e.startCampaign(csv(2)); await wait(h.e)
  const s = h.e.publicSims()[0]
  assert.equal(s.status, 'paused'); assert.match(s.pauseReason, /restriction/); assert.match(h.e.campaign.stopReason, /No SIM can send/)
  h.e.resumeSim(id); assert.equal(h.e.publicSims()[0].status, 'ready')
})

test('repeated unknown errors pause the SIM; the contact is reported failed, not retried forever', async () => {
  const h = harness({ behaviour: () => { throw new Error('weird') } })
  h.e.addSim({ credits: 100 }); await ready()
  h.e.startCampaign(csv(MAX_CONSECUTIVE_ERRORS + 3)); await wait(h.e)
  assert.equal(h.e.publicSims()[0].status, 'paused')
  assert.equal(h.e.campaign.ok, 0); assert.equal(h.e.campaign.failed, MAX_CONSECUTIVE_ERRORS - 1) // 5th error pauses the SIM; that contact stays pending for after you resume
})

test('logged out: status flips, session is wiped, QR flow can restart', async () => {
  const h = harness(); const id = h.e.addSim({ credits: 5 }); await ready()
  h.handlers[id].onClose({ loggedOut: true, message: 'bye' })
  const s = h.e.publicSims()[0]
  assert.equal(s.status, 'logged_out'); assert.equal(s.lastError.kind, 'logged_out')
  assert.ok(!fs.existsSync(path.join(h.dir, 'auth', id)))
  h.e.connectSim(id); h.handlers[id].onQr('QRDATA')
  assert.equal(h.e.publicSims()[0].qr, 'QRDATA')
})

test('credits/limits editing, validation and persistence', async () => {
  const h = harness(); const id = h.e.addSim({ label: 'A', credits: 5, dailyLimit: 50 }); await ready()
  h.e.addCredits(id, 100); h.e.addCredits(id, -200)
  assert.equal(h.e.publicSims()[0].credits, 0)               // never negative
  assert.throws(() => h.e.addCredits(id, 0)); assert.throws(() => h.e.setLimits(id, { dailyLimit: 0 }))
  h.e.setLimits(id, { dailyLimit: 80, credits: 40 })
  const again = new Engine({ dataDir: h.dir, connect: () => ({ close() {} }) })   // "restart"
  const s = again.publicSims()[0]
  assert.equal(s.credits, 40); assert.equal(s.dailyLimit, 80); assert.equal(s.label, 'A')
  assert.ok(again.recent(10).some(e => e.status === 'credits'))
})

test('preview reports capacity shortfall and already-sent people; sent history survives', async () => {
  const h = harness(); h.e.addSim({ credits: 2 }); await ready()
  let p = h.e.preview(csv(5)); assert.equal(p.toSend, 5); assert.equal(p.capacityNow, 2); assert.equal(p.shortBy, 3)
  assert.match(p.sample, /Notre Dame Science Club/)
  h.e.startCampaign(csv(5)); await wait(h.e)
  p = h.e.preview(csv(5)); assert.equal(p.alreadySent, 2); assert.equal(p.toSend, 3)
  h.e.clearSent(); assert.equal(h.e.preview(csv(5)).alreadySent, 0)
})

test('logo is attached to every send; applyBrand pushes name + photo to the SIM profile', async () => {
  const h = harness(); const id = h.e.addSim({ credits: 5 }); await ready()
  fs.writeFileSync(path.join(h.dir, 'logo.png'), Buffer.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]))
  h.e.saveSettings({ logoFile: 'logo.png' })
  h.e.startCampaign(csv(1)); await wait(h.e)
  assert.ok(Buffer.isBuffer(h.sends[0].image)); assert.match(h.sends[0].text, /^\*Notre Dame Science Club\*/)
  const done = await h.e.applyBrand(id)
  assert.deepEqual(done, ['name', 'photo'])
  const prof = h.sends.find(x => x.profile).profile
  assert.equal(prof.name, 'Notre Dame Science Club'); assert.ok(Buffer.isBuffer(prof.picture))
})

test('needs {link}: refuses to start without a group link', async () => {
  const h = harness(); h.e.addSim({ credits: 5 }); await ready(); h.e.saveSettings({ groupLink: '' })
  assert.throws(() => h.e.startCampaign(csv(1)), /group link/)
})

test('notify run: own text, no logo, re-messages people already invited, and leaves the invite history alone', async () => {
  const h = harness(); h.e.addSim({ label: 'A', credits: 50, dailyLimit: 100 }); await ready()
  h.e.startCampaign(csv(2)); await wait(h.e)                       // normal invitation: 2 remembered
  assert.equal(h.sends.length, 2)
  const opts = { notify: true, template: 'Hello {name}, class moved to 5pm.', withLogo: false }
  const p = h.e.preview(csv(3), opts)
  assert.equal(p.alreadySent, 0); assert.equal(p.toSend, 3); assert.match(p.sample, /Hello P0, class moved to 5pm\./)
  h.e.startCampaign(csv(3), opts); await wait(h.e)
  assert.equal(h.sends.length, 5)                                  // all 3 messaged again, even the 2 invited before
  assert.match(h.sends[2].text, /class moved to 5pm/); assert.ok(!h.sends[2].image)
  assert.equal(h.e.sentSet().size, 2)                              // notice did not touch the invite list
  assert.match(h.e.preview(csv(3)).sample, /invited to join/)      // saved invitation text is unchanged
})
