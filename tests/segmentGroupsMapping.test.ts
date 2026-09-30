import test from 'node:test'
import assert from 'node:assert/strict'
import { buildGroupMapping, lockedTerminals } from '../lib/segmentGroups.ts'

const N = (id: string, parent_id: string | null, gid?: string, extra: any = {}) =>
  ({ id, parent_id, behavior: gid ? { segment_group_id: gid } : {}, ...extra })
const groups = [{ id: 'g1', name: 'Science' }]
const nodes = [N('root', null), N('A', 'root', 'g1', { is_terminal: true }), N('B', 'root', 'g1', { is_terminal: true }), N('C', 'root', undefined, { is_terminal: true })]

test('mapping covers every node; ungrouped are null', () => {
  assert.deepEqual(buildGroupMapping(nodes, groups, false), { root: null, A: 'g1', B: 'g1', C: null })
})
test('disable_multi_segment_enroll maps everything to __all__', () => {
  const m = buildGroupMapping(nodes, groups, true)
  assert.ok(Object.values(m).every(v => v === '__all__'))
})
test('deleted group -> nodes become independent', () => {
  assert.deepEqual(buildGroupMapping(nodes, [], false), { root: null, A: null, B: null, C: null })
})
test('locked: holding A locks B (same group) but not C; A itself is same_segment', () => {
  const l = lockedTerminals('root', nodes, groups, false, { groupKeys: { g1: 'Seg A' }, terminals: { A: 'Seg A' } })
  assert.equal(l.A.reason, 'same_segment')
  assert.equal(l.B.reason, 'same_group'); assert.equal(l.B.groupName, 'Science')
  assert.equal(l.C, undefined)
})
test('locked: nothing held -> nothing locked', () => {
  assert.deepEqual(lockedTerminals('root', nodes, groups, false, { groupKeys: {}, terminals: {} }), {})
})
