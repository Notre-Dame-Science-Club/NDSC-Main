import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveGroupId, groupKeyFor, terminalsOf } from '../lib/segmentGroups.ts'
import { buildSlotIdentities } from '../lib/identity.ts'

const N = (id: string, parent_id: string | null, gid?: string, extra: any = {}) =>
  ({ id, parent_id, behavior: gid ? { segment_group_id: gid } : {}, ...extra })
const groups = [{ id: 'g1', name: 'G1' }, { id: 'h', name: 'H' }]
const nodes = [N('root', null), N('P', 'root', 'g1'), N('P1', 'P'), N('P2', 'P'), N('P3', 'P', 'h'), N('C', 'root'), N('D', 'root', 'gone')]
const by = new Map(nodes.map(n => [n.id, n]))

test('children inherit the nearest group', () => { assert.equal(resolveGroupId('P1', by, groups), 'g1'); assert.equal(resolveGroupId('P2', by, groups), 'g1') })
test('nearer assignment overrides inherited', () => assert.equal(resolveGroupId('P3', by, groups), 'h'))
test('ungrouped -> null', () => assert.equal(resolveGroupId('C', by, groups), null))
test('stale group id ignored', () => assert.equal(resolveGroupId('D', by, groups), null))
test('stale nearer id falls back to valid ancestor', () => {
  const m = new Map([N('r', null, 'g1'), N('x', 'r', 'deleted')].map(n => [n.id, n]))
  assert.equal(resolveGroupId('x', m, groups), 'g1')
})
test('disable_multi_segment_enroll -> __all__', () => assert.equal(groupKeyFor('C', by, groups, true), '__all__'))
test('zero groups -> null (independent)', () => assert.equal(groupKeyFor('P1', by, [], false), null))
test('terminalsOf skips disabled, walks to leaves', () => {
  const ns = [N('root', null), N('P', 'root'), N('a', 'P'), N('b', 'P', undefined, { enabled: false }), N('c', 'P')]
  assert.deepEqual(terminalsOf('P', ns).sort(), ['a', 'c'])
  assert.deepEqual(terminalsOf('a', ns), ['a'])
})

test('identities normalized + deduped, leader wins', () => {
  const ids = buildSlotIdentities({
    leader: { member_id: 'm1', email: ' Foo@X.com ', phone: '+8801711111111', college_roll: ' 12 ' },
    team: [{ email: 'foo@x.com', phone: '01722222222', college_roll: '13' }],
    teamMemberAccountIds: ['m2'],
  })
  const has = (k: string, v: string, r: string) => ids.some(i => i.kind === k && i.value === v && i.role === r)
  assert.ok(has('email', 'foo@x.com', 'leader'))
  assert.equal(ids.filter(i => i.kind === 'email').length, 1)
  assert.ok(has('phone', '01711111111', 'leader'))
  assert.ok(has('phone', '01722222222', 'team_member'))
  assert.ok(has('member', 'm2', 'team_member'))
})
