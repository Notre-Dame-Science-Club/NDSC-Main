import { test } from 'node:test'
import assert from 'node:assert/strict'
import { checkWindow, paymentSettled, terminalOf } from '../lib/segmentAccess.ts'
import { stripAnswerKeysFromBlocks } from '../lib/server/stripAnswerKeys.ts'
import { normalizeEmail, normalizePhone } from '../lib/identity.ts'

const now = new Date('2026-06-01T12:00:00Z')
test('window', () => {
  assert.equal(checkWindow(now, {}), 'ok')
  assert.equal(checkWindow(now, { opens_at: '2026-06-02T00:00:00Z' }), 'not_open')
  assert.equal(checkWindow(now, { closes_at: '2026-05-31T00:00:00Z' }), 'closed')
  assert.equal(checkWindow(now, { opens_at: '2026-05-01T00:00:00Z', closes_at: '2026-07-01T00:00:00Z' }), 'ok')
})
test('payment', () => {
  for (const s of [null, undefined, 'paid', 'not_required']) assert.equal(paymentSettled(s as any), true)
  for (const s of ['pending', 'failed', 'cancelled']) assert.equal(paymentSettled(s), false)
})
test('terminalOf prefers column, falls back to path tail', () => {
  assert.equal(terminalOf({ terminal_node_id: 'T', submitted_node_ids: ['a', 'b'] }), 'T')
  assert.equal(terminalOf({ submitted_node_ids: ['a', 'b'] }), 'b')
  assert.equal(terminalOf({ submitted_node_ids: [] }), null)
})
test('S4: answer keys stripped, other props kept', () => {
  const out: any = stripAnswerKeysFromBlocks([{ id: 'q', kind: 'field', type: 'mcq', label: 'L', correct_option_id: 'a', correct_option_ids: ['a'], mcq_options: [{ id: 'a', text: 'x' }] }])
  assert.equal('correct_option_id' in out[0], false)
  assert.equal('correct_option_ids' in out[0], false)
  assert.equal(out[0].mcq_options.length, 1)
  assert.equal(out[0].label, 'L')
})
test('identity normalization', () => {
  assert.equal(normalizeEmail('  Foo@Gmail.COM '), 'foo@gmail.com')
  assert.equal(normalizePhone('+880 1712-345678'), '01712345678')
})
