import test from 'node:test'
import assert from 'node:assert/strict'
import { planImport, buildTemplate, norm, NOT_SET } from '../lib/activityImport.ts'

const F = (key: string, extra: any = {}) => ({ id: key, kind: 'field', type: 'text', label: key, key, ...extra })
const N = (id: string, parent_id: string | null, label: string, extra: any = {}) =>
  ({ id, parent_id, label, enabled: true, is_terminal: false, fields: [], behavior: {}, ...extra })

// root
//  ├─ Math Olympiad (terminal) — fields: school_rank
//  ├─ Quiz
//  │   ├─ Junior (terminal) — fields: team_size
//  │   └─ Senior (terminal)
//  └─ Debate (terminal, no fields)
const nodes = [
  N('root', null, 'Registration', { fields: [F('guardian_phone')] }),
  N('math', 'root', 'Math Olympiad', { is_terminal: true, fields: [F('school_rank', { label: 'School Rank' })] }),
  N('quiz', 'root', 'Quiz', { fields: [F('level')] }),
  N('junior', 'quiz', 'Junior', { is_terminal: true, fields: [F('team_size', { type: 'number' }), F('shift', { type: 'dropdown', options: ['Morning', 'Evening'], required: true })] }),
  N('senior', 'quiz', 'Senior', { is_terminal: true }),
  N('debate', 'root', 'Debate', { is_terminal: true }),
]
const H = (...h: string[]) => h

test('norm: spaces/punctuation/case', () => {
  assert.equal(norm(' Math Olympiad! '), 'math_olympiad')
  assert.equal(norm('\uFEFFEmail'), 'email')
})

test('header resolution: common, segment, sub-segment, ambiguous prefix', () => {
  const p = planImport(H('Email', 'full_name', 'guardian_phone', 'Math_Olympiad_school_rank', 'quiz_junior_team_size', 'quiz_level', 'junk'), [], nodes)
  const kinds = Object.fromEntries(p.columns.map(c => [c.header, c.kind === 'field' ? `field@${(c as any).nodeId}` : c.kind]))
  assert.deepEqual(kinds, {
    Email: 'builtin', full_name: 'builtin', guardian_phone: 'field@root',
    Math_Olympiad_school_rank: 'field@math', quiz_junior_team_size: 'field@junior', quiz_level: 'field@quiz', junk: 'ignored',
  })
})

test('missing email column is fatal', () => {
  assert.match(planImport(H('full_name'), [], nodes).fatal!, /email/)
})

test('segment inferred from filled columns; missing info -> <not set>', () => {
  const p = planImport(H('email', 'full_name', 'phone', 'Math_Olympiad_school_rank'), [['A@X.com', 'Ann', '', '3']], nodes)
  const r = p.rows[0]
  assert.deepEqual(r.errors, [])
  assert.equal(r.email, 'a@x.com')
  assert.equal(r.stored.phone, NOT_SET)
  assert.equal(r.real.phone, '')            // placeholder never leaks into identity checks
  assert.equal(r.stored.college, NOT_SET)
  assert.equal(r.targets.length, 1)
  assert.equal(r.targets[0].terminalId, 'math')
  assert.deepEqual(r.targets[0].custom, { school_rank: '3' })
})

test('sub-segment column registers the leaf and lists the full path', () => {
  const p = planImport(H('email', 'quiz_junior_team_size', 'quiz_junior_shift'), [['b@x.com', '4', 'evening']], nodes)
  const t = p.rows[0].targets[0]
  assert.deepEqual(p.rows[0].errors, [])
  assert.equal(t.terminalId, 'junior')
  assert.deepEqual(t.pathIds, ['root', 'quiz', 'junior'])
  assert.equal(t.label, 'Quiz › Junior')
  assert.deepEqual(t.custom, { team_size: 4, shift: 'Evening' })   // number parsed, option canonicalised
})

test('segment-level value alone is ambiguous when the segment has sub-segments', () => {
  const p = planImport(H('email', 'quiz_level'), [['c@x.com', '2']], nodes)
  assert.match(p.rows[0].errors.join(' '), /sub-segments \(Junior, Senior\)/)
})

test('segment column: fieldless segments, paths, and multi-enrol', () => {
  const p = planImport(H('email', 'segment'), [['d@x.com', 'Debate'], ['e@x.com', 'Quiz > Senior; Math Olympiad'], ['f@x.com', 'Nope']], nodes)
  assert.deepEqual(p.rows[0].targets.map(t => t.terminalId), ['debate'])
  assert.deepEqual(p.rows[1].targets.map(t => t.terminalId).sort(), ['math', 'senior'])
  assert.match(p.rows[2].errors.join(' '), /Unknown segment "Nope"/)
})

test('no segment info at all is an error; blank rows are skipped', () => {
  const p = planImport(H('email', 'full_name'), [['g@x.com', 'Gus'], ['', '']], nodes)
  assert.match(p.rows[0].errors.join(' '), /No segment given/)
  assert.equal(p.rows[1].blank, true)
})

test('required custom field left empty -> <not set> with a warning, not an error', () => {
  const p = planImport(H('email', 'quiz_junior_team_size'), [['h@x.com', '2']], nodes)
  assert.deepEqual(p.rows[0].errors, [])
  assert.equal(p.rows[0].targets[0].custom.shift, NOT_SET)
  assert.equal(p.rows[0].warnings.length, 1)
})

test('bad values are row errors: option, number, email, short password, NDC roll', () => {
  const p = planImport(H('email', 'password', 'college_roll', 'quiz_junior_team_size', 'quiz_junior_shift'),
    [['i@x.com', 'abc', '123', 'many', 'Noon'], ['not-an-email', '', '', '1', 'Morning']], nodes)
  const e = p.rows[0].errors.join(' | ')
  assert.match(e, /at least 6/); assert.match(e, /8 digits/); assert.match(e, /must be a number/); assert.match(e, /not one of Morning, Evening/)
  assert.match(p.rows[1].errors.join(' '), /Invalid email/)
})

test('filled columns and the segment column combine (multi-enrol)', () => {
  const p = planImport(H('email', 'Math_Olympiad_school_rank', 'segment'), [['k@x.com', '1', 'Debate']], nodes)
  assert.deepEqual(p.rows[0].targets.map(t => t.terminalId).sort(), ['debate', 'math'])
})

test('team-required segments are rejected with a clear message', () => {
  const ns = [N('root', null, 'R'), N('t', 'root', 'Team Event', { is_terminal: true, fields: [F('x')], behavior: { require_team: { min: 2, max: 4 } } })]
  const p = planImport(H('email', 'team_event_x'), [['l@x.com', '1']], ns)
  assert.match(p.rows[0].errors.join(' '), /requires a team of at least 2/)
  const ok = [N('root', null, 'R'), N('t', 'root', 'Team Event', { is_terminal: true, fields: [F('x')], behavior: { require_team: { optional: true } } })]
  assert.deepEqual(planImport(H('email', 'team_event_x'), [['l@x.com', '1']], ok).rows[0].errors, [])
})

test('root-only activity (no segments) registers at the root', () => {
  const p = planImport(H('email'), [['m@x.com']], [N('root', null, 'R', { is_terminal: true })])
  assert.equal(p.rows[0].targets[0].terminalId, 'root')
})

test('template headers round-trip through the resolver', () => {
  const { columns, csv } = buildTemplate(nodes)
  const headers = columns.map(c => c.header)
  assert.ok(headers.includes('quiz_junior_team_size') && headers.includes('math_olympiad_school_rank') && headers.includes('segment'))
  const p = planImport(headers, [], nodes)
  assert.deepEqual(p.columns.filter(c => c.kind === 'ignored'), [])
  assert.ok(csv.startsWith('email,'))
})
