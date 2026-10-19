// Run: node --experimental-strip-types --test tests/formGraph.pack.test.ts
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { packFormNodeUpdate, packFormGraphUpdate, packFormNodeBody } from '../lib/formGraph.ts'

test('B1: {enabled:false} emits only enabled', () => {
  assert.deepEqual(packFormNodeUpdate({ enabled: false }), { enabled: false })
})
test('B1: absent keys are never defaulted on update', () => {
  const out = packFormNodeUpdate({ label: 'X' })
  for (const k of ['fields','behavior','appearance','kind','is_terminal','display_order','position']) assert.ok(!(k in out), k)
})
test('unknown keys and wrong types dropped', () => {
  assert.deepEqual(packFormNodeUpdate({ evil: 1, enabled: 'no', fields: {} }), {})
})
test('graph update does not reset title/settings', () => {
  assert.deepEqual(packFormGraphUpdate({ root_node_id: 'a' }), { root_node_id: 'a' })
})
test('insert packer still fills defaults', () => {
  assert.equal(packFormNodeBody({}).label, 'Untitled form')
})
