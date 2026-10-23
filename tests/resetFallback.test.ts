import { test, beforeEach } from 'node:test'
import assert from 'node:assert/strict'
import { signPayload } from '../lib/api/sign.ts'
import { issueFallbackToken, verifyFallbackToken, FALLBACK_TTL_MS } from '../lib/api/resetFallback.ts'
import { maskEmail } from '../lib/api/serverAlert.ts'

const env = process.env as Record<string, string | undefined>
beforeEach(() => { env.SESSION_SECRET = 'test-secret-for-unit-tests' })

test('fallback token: valid for the same email (case/space-insensitive)', () => {
  const t = issueFallbackToken('Student@Example.com')
  assert.equal(verifyFallbackToken(t, ' student@example.com '), true)
})

test('fallback token: rejected for a different email', () => {
  const t = issueFallbackToken('a@example.com')
  assert.equal(verifyFallbackToken(t, 'b@example.com'), false)
})

test('fallback token: expires after the TTL', () => {
  const now = Date.now()
  const t = issueFallbackToken('a@example.com', now)
  assert.equal(verifyFallbackToken(t, 'a@example.com', now + FALLBACK_TTL_MS - 1000), true)
  assert.equal(verifyFallbackToken(t, 'a@example.com', now + FALLBACK_TTL_MS + 1000), false)
})

test('fallback token: tampered, unsigned, empty or non-string values are rejected', () => {
  const t = issueFallbackToken('a@example.com')
  assert.equal(verifyFallbackToken(t.slice(0, -2) + 'xx', 'a@example.com'), false)
  assert.equal(verifyFallbackToken('not-a-token', 'a@example.com'), false)
  assert.equal(verifyFallbackToken('', 'a@example.com'), false)
  assert.equal(verifyFallbackToken(undefined, 'a@example.com'), false)
  assert.equal(verifyFallbackToken({ a: 1 }, 'a@example.com'), false)
})

test('fallback token: a signed payload with another purpose (e.g. the phone-verified reset token) is rejected', () => {
  const other = signPayload({ purpose: 'phone-reset', email: 'a@example.com', exp: new Date(Date.now() + 60000).toISOString() })
  assert.equal(verifyFallbackToken(other, 'a@example.com'), false)
  const noPurpose = signPayload({ email: 'a@example.com', exp: new Date(Date.now() + 60000).toISOString() })
  assert.equal(verifyFallbackToken(noPurpose, 'a@example.com'), false)
})

test('maskEmail hides most of the address', () => {
  assert.equal(maskEmail('student@example.com'), 's***@example.com')
  assert.equal(maskEmail('nonsense'), '***')
})
