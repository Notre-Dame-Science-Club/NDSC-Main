import { test } from 'node:test'
import assert from 'node:assert/strict'
import { isNDCName, canonicalCollege, collegeKey } from '../lib/college.ts'
import { validateCollegeRoll } from '../lib/validation.ts'
import { computeStats, filterAccounts, accountsToCsv, exportFileName, EMPTY_FILTER, NO_BATCH, type Account } from '../lib/accountStats.ts'

test('NDC spelling variants are all recognised', () => {
  for (const n of ['Notre Dame College', 'notre dame college', 'NOTREDAME COLLEGE', 'Notre-Dame College', 'Notre Dame College, Dhaka',
    'NDC', 'ndc', 'N.D.C.', 'NDC Dhaka', 'ndc college', 'Notredame'])
    assert.equal(isNDCName(n), true, n)
  for (const n of ['', null, undefined, 'Dhaka College', 'Holy Cross College', 'Andc School', 'Viqarunnisa Noon School and College'])
    assert.equal(isNDCName(n as any), false, String(n))
})

test('canonical name + key merge variants, leave others alone', () => {
  assert.equal(canonicalCollege('  ndc '), 'Notre Dame College')
  assert.equal(canonicalCollege('Dhaka  College'), 'Dhaka College')
  assert.equal(collegeKey('NDC'), collegeKey('notredame college'))
  assert.equal(collegeKey('Dhaka College'), collegeKey('dhaka-college'))
  assert.notEqual(collegeKey('Dhaka College'), collegeKey('Dhaka City College'))
})

test('8-digit roll rule now applies to NDC variants too', () => {
  assert.match(validateCollegeRoll('NDC', '123')!, /8 digits/)
  assert.equal(validateCollegeRoll('ndc', '12345678'), null)
  assert.equal(validateCollegeRoll('Dhaka College', '123'), null)
})

const A = (o: Partial<Account>): Account => ({ id: Math.random().toString(), full_name: 'X', email: 'x@x.com', ...o })
const data: Account[] = [
  A({ institution: 'Notre Dame College', batch: '2025', membership_status: 'approved', is_verified: true }),
  A({ institution: 'NDC', batch: '2025', membership_status: 'none' }),
  A({ institution: 'notredame college', batch: '2024', membership_status: 'pending' }),
  A({ institution: 'Dhaka College', batch: '2025', membership_status: 'none' }),
  A({ institution: 'dhaka-college', batch: ' 2025 ', membership_status: 'none' }),
  A({ institution: null, batch: null, membership_status: 'none' }),
]

test('stats', () => {
  const s = computeStats(data)
  assert.equal(s.totals.total, 6)
  assert.equal(s.totals.members, 1)
  assert.equal(s.totals.users, 5)
  assert.equal(s.totals.pending, 1)
  assert.equal(s.totals.ndc, 3)
  assert.equal(s.totals.ndcNotMembers, 2)
  assert.equal(s.totals.otherColleges, 2)
  assert.equal(s.totals.noCollege, 1)
  assert.deepEqual(s.byBatch.map(b => [b.batch, b.total]), [['2025', 4], ['2024', 1], [NO_BATCH, 1]])
  assert.equal(s.byCollege[0].label, 'Notre Dame College')
  assert.equal(s.byCollege[0].total, 3)
  assert.equal(s.byCollege.filter(c => c.key !== 'ndc' && c.key !== '').length, 1) // Dhaka College spellings merged
})

test('filters combine and are flexible', () => {
  assert.equal(filterAccounts(data, { ...EMPTY_FILTER, batches: ['2025'] }).length, 4)           // batch, any college
  assert.equal(filterAccounts(data, { ...EMPTY_FILTER, college: 'key:ndc' }).length, 3)         // college, any batch
  assert.equal(filterAccounts(data, { type: 'user', college: 'key:ndc', batches: ['2025'] }).length, 1)
  assert.equal(filterAccounts(data, { ...EMPTY_FILTER, college: 'not-ndc' }).length, 3)
  assert.equal(filterAccounts(data, { ...EMPTY_FILTER, batches: ['2024', NO_BATCH] }).length, 2)
  assert.equal(filterAccounts(data, { ...EMPTY_FILTER, type: 'pending' }).length, 1)
})

test('csv + file name', () => {
  const csv = accountsToCsv([A({ full_name: 'Doe, Jane', institution: 'NDC', batch: '2025' })], ['full_name', 'college', 'batch'])
  assert.equal(csv, 'full_name,college,batch\r\n"Doe, Jane",Notre Dame College,2025')
  assert.equal(exportFileName({ type: 'member', college: 'key:ndc', batches: ['2025', '2024'] }), 'accounts_members_ndc_batch-2025-2024.csv')
})
