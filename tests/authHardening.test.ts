import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signPayload, verifyPayload } from '../lib/api/sign.ts'
import {
  checkRateLimit, isLocked, recordFailure, clearFailures, __resetRateLimitsForTests,
} from '../lib/api/rateLimitCore.ts'
import { sniffImageType, declaredFamily } from '../lib/api/imageSniff.ts'

const env = process.env as Record<string, string | undefined>
const saved = { s: env.SESSION_SECRET, n: env.NODE_ENV }
beforeEach(() => {
  env.SESSION_SECRET = 'test-secret-for-unit-tests'
  env.NODE_ENV = 'test'
  __resetRateLimitsForTests()
})
test.after(() => {
  if (saved.s === undefined) delete env.SESSION_SECRET; else env.SESSION_SECRET = saved.s
  if (saved.n === undefined) delete env.NODE_ENV; else env.NODE_ENV = saved.n
})

// ---- reset token signing ----------------------------------------------------
const claims = () => ({ id: 'u1', email: 'a@b.c', source: 'users', exp: new Date(Date.now() + 60_000).toISOString() })

test('a hand-crafted, unsigned base64 JSON reset token is rejected', () => {
  const forged = Buffer.from(JSON.stringify({ ...claims(), nonce: 'x' })).toString('base64')
  assert.equal(verifyPayload(forged), null)
  // also with a made-up signature half
  assert.equal(verifyPayload(forged + '.AAAA'), null)
})

test('a signed token round-trips; tampering with the payload is rejected', () => {
  const token = signPayload(claims())
  assert.deepEqual((verifyPayload(token) as any).id, 'u1')
  const [, sig] = token.split('.')
  const evil = Buffer.from(JSON.stringify({ ...claims(), id: 'victim' })).toString('base64')
  assert.equal(verifyPayload(`${evil}.${sig}`), null)
})

test('a token signed with a different secret is rejected', () => {
  const token = signPayload(claims())
  env.SESSION_SECRET = 'some-other-secret'
  assert.equal(verifyPayload(token), null)
})

test('production without SESSION_SECRET fails closed instead of using the hardcoded secret', () => {
  delete env.SESSION_SECRET
  env.NODE_ENV = 'production'
  assert.throws(() => signPayload(claims()), /SESSION_SECRET/)
  assert.throws(() => verifyPayload('a.b'), /SESSION_SECRET/)
})

// ---- rate limiting ----------------------------------------------------------
test('checkRateLimit allows `limit` calls per window then blocks', () => {
  for (let i = 0; i < 3; i++) assert.equal(checkRateLimit('k', 3, 60_000).ok, true)
  const r = checkRateLimit('k', 3, 60_000)
  assert.equal(r.ok, false)
  assert.ok(r.retryAfterSec >= 1)
  assert.equal(checkRateLimit('other', 3, 60_000).ok, true)
})

test('5 failures lock a key; success clears them', () => {
  for (let i = 0; i < 4; i++) recordFailure('ip:user')
  assert.equal(isLocked('ip:user').locked, false)
  recordFailure('ip:user')
  assert.equal(isLocked('ip:user').locked, true)
  assert.equal(isLocked('ip:other').locked, false)
  clearFailures('ip:user')
  assert.equal(isLocked('ip:user').locked, false)
})

// ---- upload magic bytes -----------------------------------------------------
const bytes = (...n: number[]) => new Uint8Array([...n, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0])
const ascii = (s: string) => Array.from(s).map(c => c.charCodeAt(0))

test('image sniffing recognises real headers and rejects others', () => {
  assert.equal(sniffImageType(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a)), 'png')
  assert.equal(sniffImageType(bytes(0xff, 0xd8, 0xff, 0xe0)), 'jpeg')
  assert.equal(sniffImageType(new Uint8Array([...ascii('RIFF'), 1, 2, 3, 4, ...ascii('WEBP')])), 'webp')
  assert.equal(sniffImageType(new Uint8Array([0, 0, 0, 24, ...ascii('ftyp'), ...ascii('heic')])), 'heic')
  assert.equal(sniffImageType(new Uint8Array(ascii('<script>alert(1)</script>'))), null)
  assert.equal(sniffImageType(new Uint8Array(ascii('GIF89a......'))), null)
})

test('declared MIME maps to the sniffed family (mismatch detectable)', () => {
  assert.equal(declaredFamily('image/jpg'), 'jpeg')
  assert.equal(declaredFamily('image/heif'), 'heic')
  assert.notEqual(declaredFamily('image/png'), sniffImageType(bytes(0xff, 0xd8, 0xff)))
  assert.equal(declaredFamily('text/html'), null)
})
