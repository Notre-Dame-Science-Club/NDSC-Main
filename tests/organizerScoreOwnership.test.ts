import { test } from 'node:test'
import assert from 'node:assert/strict'
import { registrationBelongsToLink } from '../lib/server/olympiadOwnership.ts'

// Olympiad A is linked to form node "node-A"; olympiad B to "node-B".
const linkA = { category_id: 'node-A' }

test('registration in the requested olympiad is allowed', () => {
  assert.equal(registrationBelongsToLink('node-A', linkA), true)
})

test('organizer for A cannot score a registration whose real olympiad is B (olympiadId in body = A)', () => {
  // regId belongs to node-B; the request claims olympiadId = A, so the link we
  // resolve is A's. The mismatch must be rejected (route returns 403).
  assert.equal(registrationBelongsToLink('node-B', linkA), false)
})

test('standalone olympiad (no activity link) or unknown node never matches', () => {
  assert.equal(registrationBelongsToLink('node-A', null), false)
  assert.equal(registrationBelongsToLink(null, linkA), false)
  assert.equal(registrationBelongsToLink(undefined, linkA), false)
})
