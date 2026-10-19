import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizePhone, parseExternal, mergeRecipients, reachSummary, whatsappCsv, emailRecipients, emailHtml,
  filterGroup, EMPTY_GROUP, distinct,
} from '../lib/bulkRecipients.ts'
import type { Account } from '../lib/accountStats.ts'

const acc = (o: Partial<Account>): Account => ({ id: o.id || 'x', full_name: 'N', email: null, ...o })

test('phones: bd forms normalise, junk is rejected', () => {
  assert.equal(normalizePhone('01711-111111'), '8801711111111')
  assert.equal(normalizePhone('+880 1711 111111'), '8801711111111')
  assert.equal(normalizePhone('008801711111111'), '8801711111111')
  assert.equal(normalizePhone('12'), ''); assert.equal(normalizePhone(null), '')
})

test('external: header csv, headerless lines in any order, junk and duplicates', () => {
  const a = parseExternal('name,phone,gmail\nRahim,01711111111,Rahim@Gmail.com\nKarim,,k@x.com\nBad,abc,\nRahim again,+8801711111111,\n')
  assert.deepEqual(a.people.map(p => [p.name, p.phone, p.email]), [['Rahim', '8801711111111', 'rahim@gmail.com'], ['Karim', '', 'k@x.com']])
  assert.equal(a.duplicates, 1); assert.equal(a.invalid.length, 1)
  const b = parseExternal('Nusrat, nusrat@gmail.com, 01800000002\n01900000003\nfoo@bar.com\nnonsense')
  assert.deepEqual(b.people.map(p => [p.name, p.phone, p.email]),
    [['Nusrat', '8801800000002', 'nusrat@gmail.com'], ['', '8801900000003', ''], ['', '', 'foo@bar.com']])
  assert.equal(b.invalid.length, 1)
})

test('merge: accounts win, external duplicates by phone or email are dropped, reach counts', () => {
  const accounts = [acc({ id: '1', full_name: 'A', phone: '01711111111', email: 'a@x.com' }), acc({ id: '2', full_name: 'B', phone: null, email: 'b@x.com' })]
  const ext = parseExternal('01711111111\nb@x.com\n01822222222\nc@x.com').people
  const { recipients, droppedExternal } = mergeRecipients(accounts, ext)
  assert.equal(droppedExternal, 2); assert.equal(recipients.length, 4)
  assert.deepEqual(reachSummary(recipients), { total: 4, phone: 2, email: 3, neither: 0 })
  assert.equal(whatsappCsv(recipients), 'phone,name\r\n8801711111111,A\r\n8801822222222,Member')
  assert.deepEqual(emailRecipients(recipients).map(r => r.email), ['a@x.com', 'b@x.com', 'c@x.com'])
  assert.equal(emailRecipients(recipients)[0].source_id, '1')
})

test('email html escapes and fills {name}', () => {
  const h = emailHtml('Hi {name} <b>')
  assert.ok(h.includes('Hi there &lt;b&gt;')); assert.ok(!h.includes('<b>'))
})

test('group filter: batch + college + department + search combine; any/empty ignores a field', () => {
  const list = [
    acc({ id: '1', batch: '2024-2025', institution: 'Notre Dame College', department: 'ICT', membership_status: 'approved', full_name: 'Rahim' }),
    acc({ id: '2', batch: '2024-2025', institution: 'NDC', department: 'LWS' }),
    acc({ id: '3', batch: '2023-2024', institution: 'Dhaka College', membership_status: 'pending' }),
    acc({ id: '4', institution: '' }),
  ]
  const ids = (f: Partial<typeof EMPTY_GROUP>) => filterGroup(list, { ...EMPTY_GROUP, ...f }).map(a => a.id)
  assert.deepEqual(ids({}), ['1', '2', '3', '4'])
  assert.deepEqual(ids({ batches: ['2024-2025'] }), ['1', '2'])
  assert.deepEqual(ids({ batches: ['2024-2025'], colleges: ['ndc'], departments: ['ict'] }), ['1'])
  assert.deepEqual(ids({ colleges: ['ndc', 'dhakacollege'] }), ['1', '2', '3'])
  assert.deepEqual(ids({ excludeColleges: ['ndc'] }), ['3', '4'])
  assert.deepEqual(ids({ types: ['member'] }), ['1']); assert.deepEqual(ids({ types: ['pending'] }), ['3'])
  assert.deepEqual(ids({ batches: ['(no batch)'] }), ['4'])
  assert.deepEqual(ids({ search: 'rahim' }), ['1'])
  assert.deepEqual(distinct(list, a => a.department), [{ value: 'ICT', count: 1 }, { value: 'LWS', count: 1 }])
})
