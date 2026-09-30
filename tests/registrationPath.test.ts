import { test } from 'node:test'
import assert from 'node:assert/strict'
import { evaluateStep } from '../lib/registrationPath.ts'

const R='root', A='segA', B='segB', A1='a1', X='other'
test('advances to a child of the last node', () => {
  assert.deepEqual(evaluateStep({ priorPath:[R], rootId:R, node:{id:A,parent_id:R} }), { ok:true, newPath:[R,A], dropped:[] })
})
test('B3: rejects a node whose parent is not on the path', () => {
  assert.equal(evaluateStep({ priorPath:[R,A], rootId:R, node:{id:X,parent_id:'zzz'} }).ok, false)
  assert.equal(evaluateStep({ priorPath:[R], rootId:R, node:{id:A1,parent_id:A} }).ok, false)
})
test('branch switch on a draft truncates and reports dropped nodes', () => {
  assert.deepEqual(evaluateStep({ priorPath:[R,A,A1], rootId:R, node:{id:B,parent_id:R} }), { ok:true, newPath:[R,B], dropped:[A,A1] })
})
test('revisit truncates path and drops descendants + itself', () => {
  assert.deepEqual(evaluateStep({ priorPath:[R,A,A1], rootId:R, node:{id:A,parent_id:R} }), { ok:true, newPath:[R,A], dropped:[A,A1] })
})
test('revisit of last node is idempotent (no duplicate ids)', () => {
  assert.deepEqual(evaluateStep({ priorPath:[R,A], rootId:R, node:{id:A,parent_id:R} }), { ok:true, newPath:[R,A], dropped:[A] })
})
test('empty legacy path only accepts root children', () => {
  assert.equal(evaluateStep({ priorPath:[], rootId:R, node:{id:A,parent_id:R} }).ok, true)
  assert.equal(evaluateStep({ priorPath:null, rootId:R, node:{id:A1,parent_id:A} }).ok, false)
})
