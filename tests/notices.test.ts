import { test } from 'node:test'
import assert from 'node:assert/strict'
import {
  normalizeBatch, matchesNoticeAudience, noticeStatus, isNoticeLive, describeAudience,
  safeHttpUrl, defaultLinkLabel, isWhatsAppLink, parseNoticeInput, parseMessageInput, parseMessageUpdate,
  countAudience, summarizeAudiences,
} from '../lib/notices.ts'
import { needsCollegeRoll } from '../lib/college.ts'

// ── batch normalisation ──────────────────────────────────────────────────────
test('normalizeBatch treats the usual spellings of one batch as equal', () => {
  for (const v of ['28', ' 28 ', '028', 'Batch 28', 'batch-28', 'BATCH28', '28th', '28 th']) {
    assert.equal(normalizeBatch(v), '28', `"${v}"`)
  }
  assert.equal(normalizeBatch('1st'), '1')
  assert.equal(normalizeBatch('2024'), '2024')        // a year is NOT batch 28
  assert.notEqual(normalizeBatch('2024'), normalizeBatch('28'))
  assert.equal(normalizeBatch('Alumni 5'), 'alumni5')
  assert.equal(normalizeBatch(null), '')
  assert.equal(normalizeBatch(undefined), '')
  assert.equal(normalizeBatch('0'), '0')
})

// ── audience matching ────────────────────────────────────────────────────────
const ndc28 = { institution: 'Notre Dame College', batch: '28' }
const aud = (colleges: string[] = [], batches: string[] = []) => ({ audience_colleges: colleges, audience_batches: batches })

test('an untargeted notice reaches everyone, even without a profile row', () => {
  assert.equal(matchesNoticeAudience(aud(), ndc28), true)
  assert.equal(matchesNoticeAudience(aud(), { institution: null, batch: null }), true)
  assert.equal(matchesNoticeAudience(aud(), null), true)
  assert.equal(matchesNoticeAudience(null, undefined), true)
})

test('college + batch must BOTH match (batch 28 of NDC is not batch 28 of another college)', () => {
  const a = aud(['Notre Dame College'], ['28'])
  assert.equal(matchesNoticeAudience(a, ndc28), true)
  assert.equal(matchesNoticeAudience(a, { institution: 'Dhaka College', batch: '28' }), false)
  assert.equal(matchesNoticeAudience(a, { institution: 'Notre Dame College', batch: '27' }), false)
  assert.equal(matchesNoticeAudience(a, { institution: 'Notre Dame College', batch: null }), false)
  assert.equal(matchesNoticeAudience(a, null), false)
})

test('every spelling of Notre Dame College matches, on both sides', () => {
  const a = aud(['Notre Dame College'], ['28'])
  for (const inst of ['NDC', 'N.D.C.', 'notredame college', 'Notre-Dame College, Dhaka', 'NDC Dhaka']) {
    assert.equal(matchesNoticeAudience(a, { institution: inst, batch: 'Batch 28' }), true, inst)
  }
  // admin typed "NDC" — stored canonical, still matches a user who typed the long name
  const b = parseNoticeInput({ title: 't', audience_colleges: ['ndc'] })
  assert.ok(b.ok)
  if (b.ok) assert.equal(matchesNoticeAudience({ audience_colleges: b.value.audience_colleges }, ndc28), true)
})

test('college-only and batch-only audiences', () => {
  assert.equal(matchesNoticeAudience(aud(['Notre Dame College']), { institution: 'NDC', batch: '5' }), true)
  assert.equal(matchesNoticeAudience(aud(['Notre Dame College']), { institution: 'BUET', batch: '5' }), false)
  assert.equal(matchesNoticeAudience(aud([], ['28']), { institution: 'BUET', batch: 'batch 28' }), true)
  assert.equal(matchesNoticeAudience(aud([], ['28']), { institution: 'BUET', batch: '29' }), false)
  // several values in one dimension are OR'd
  assert.equal(matchesNoticeAudience(aud(['Notre Dame College'], ['27', '28']), { institution: 'NDC', batch: '27' }), true)
  assert.equal(matchesNoticeAudience(aud(['Notre Dame College', 'Dhaka College']), { institution: 'dhaka college', batch: '1' }), true)
})

test('describeAudience', () => {
  assert.equal(describeAudience(aud()), 'Everyone')
  assert.equal(describeAudience(aud(['Notre Dame College'], ['28'])), 'Notre Dame College · Batch 28')
  assert.equal(describeAudience(aud([], ['Batch 28', '29'])), 'Batch 28, Batch 29')
})

// ── reach + suggestions ──────────────────────────────────────────────────────
const people = [
  { institution: 'Notre Dame College', batch: '28' },
  { institution: 'NDC', batch: 'Batch 28' },
  { institution: 'notre dame college', batch: '28' },
  { institution: 'Notre Dame College', batch: '27' },
  { institution: 'Dhaka College', batch: '28' },
  { institution: null, batch: null },
]
test('countAudience', () => {
  assert.equal(countAudience(aud(), people), 6)
  assert.equal(countAudience(aud(['Notre Dame College']), people), 4)
  assert.equal(countAudience(aud(['Notre Dame College'], ['28']), people), 3)
  assert.equal(countAudience(aud([], ['28']), people), 4)
  assert.equal(countAudience(aud(['Nowhere College']), people), 0)
  assert.equal(countAudience(aud(), []), 0)
})

test('summarizeAudiences merges spellings, ignores blanks, sorts by size', () => {
  const s = summarizeAudiences(people)
  assert.deepEqual(s.colleges, [
    { name: 'Notre Dame College', count: 4 },
    { name: 'Dhaka College', count: 1 },
  ])
  assert.deepEqual(s.batches, [
    { name: '28', count: 4 },       // "28" x3 + "Batch 28" x1 -> most common spelling wins
    { name: '27', count: 1 },
  ])
  // irregular spacing in a batch is tidied for display
  assert.deepEqual(summarizeAudiences([{ institution: 'X', batch: 'Alumni   5' }]).batches, [{ name: 'Alumni 5', count: 1 }])
  assert.deepEqual(summarizeAudiences([]), { colleges: [], batches: [] })
  assert.deepEqual(summarizeAudiences([null, undefined]), { colleges: [], batches: [] })
})

// ── lifecycle ────────────────────────────────────────────────────────────────
test('notice window and active flag', () => {
  const now = new Date('2026-10-18T12:00:00Z')
  assert.equal(noticeStatus({ is_active: true }, now), 'live')
  assert.equal(noticeStatus({ is_active: false }, now), 'off')
  assert.equal(noticeStatus({ is_active: true, starts_at: '2026-10-19T00:00:00Z' }, now), 'scheduled')
  assert.equal(noticeStatus({ is_active: true, ends_at: '2026-10-17T00:00:00Z' }, now), 'expired')
  assert.equal(noticeStatus({ is_active: true, starts_at: '2026-10-01T00:00:00Z', ends_at: '2026-11-01T00:00:00Z' }, now), 'live')
  assert.equal(isNoticeLive({ is_active: true, ends_at: '2026-10-17T00:00:00Z' }, now), false)
})

// ── links ────────────────────────────────────────────────────────────────────
test('safeHttpUrl only allows http(s)', () => {
  assert.equal(safeHttpUrl('https://chat.whatsapp.com/AbC123'), 'https://chat.whatsapp.com/AbC123')
  assert.equal(safeHttpUrl('chat.whatsapp.com/AbC123'), 'https://chat.whatsapp.com/AbC123')
  assert.equal(safeHttpUrl('http://example.com/x'), 'http://example.com/x')
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'data:text/html,<script>1</script>', 'ftp://x.com/a', 'not a url', '', null, undefined, 'mailto:a@b.com']) {
    assert.equal(safeHttpUrl(bad as any), null, String(bad))
  }
})

test('WhatsApp links get a recognisable default label', () => {
  assert.equal(defaultLinkLabel('https://chat.whatsapp.com/AbC'), 'Join WhatsApp group')
  assert.equal(defaultLinkLabel('https://wa.me/8801700000000'), 'Join WhatsApp group')
  assert.equal(defaultLinkLabel('https://example.com'), 'Open link')
  assert.equal(defaultLinkLabel(null), 'Open link')
  assert.equal(isWhatsAppLink('https://chat.whatsapp.com/AbC'), true)
  assert.equal(isWhatsAppLink('https://example.com'), false)
})

// ── notice input validation ──────────────────────────────────────────────────
test('parseNoticeInput: the batch-28 WhatsApp example', () => {
  const r = parseNoticeInput({
    title: '  Join the Batch 28 WhatsApp group ',
    body: 'Please join so we can reach you.',
    link_url: 'chat.whatsapp.com/XYZ',
    link_label: '',
    tone: 'important',
    audience_colleges: ['NDC', 'notre dame college', ''],
    audience_batches: ['28', 'Batch 28', '028', ' '],
    is_active: true,
    dismissible: true,
    starts_at: '',
    ends_at: null,
    created_by: 'hacker@example.com',       // must be dropped
    id: 'nope',                              // must be dropped
  })
  assert.ok(r.ok)
  if (!r.ok) return
  assert.deepEqual(r.value, {
    title: 'Join the Batch 28 WhatsApp group',
    body: 'Please join so we can reach you.',
    link_url: 'https://chat.whatsapp.com/XYZ',
    link_label: null,
    tone: 'important',
    audience_colleges: ['Notre Dame College'],   // NDC variants collapse to one canonical college
    audience_batches: ['28'],                    // 28 / Batch 28 / 028 collapse to one batch
    is_active: true,
    dismissible: true,
    starts_at: null,
    ends_at: null,
  })
})

test('parseNoticeInput rejects bad input', () => {
  const bad = (input: any, opts?: any) => { const r = parseNoticeInput(input, opts); assert.equal(r.ok, false, JSON.stringify(input)); return r.ok ? '' : r.error }
  bad(null)
  bad([])
  assert.match(bad({ title: '   ' }), /Title is required/)
  assert.match(bad({}), /Title is required/)
  assert.match(bad({ title: 'x'.repeat(121) }), /120/)
  assert.match(bad({ title: 'ok', link_url: 'javascript:alert(1)' }), /https/)
  assert.match(bad({ title: 'ok', tone: 'neon' }), /style/)
  assert.match(bad({ title: 'ok', audience_colleges: 'NDC' }), /list/)
  assert.match(bad({ title: 'ok', is_active: 'yes' }), /true or false/)
  assert.match(bad({ title: 'ok', starts_at: 'garbage' }), /Start date/)
  assert.match(bad({ title: 'ok', starts_at: '2026-10-20T00:00:00Z', ends_at: '2026-10-19T00:00:00Z' }), /after the start/)
  assert.match(bad({ title: 'ok', body: 'x'.repeat(1001) }), /1000/)
})

test('parseNoticeInput partial updates only touch the keys sent', () => {
  const r = parseNoticeInput({ is_active: false }, { partial: true })
  assert.ok(r.ok)
  if (r.ok) assert.deepEqual(r.value, { is_active: false })
  const t = parseNoticeInput({ title: '' }, { partial: true })
  assert.equal(t.ok, false)                         // but a title that IS sent must still be valid
  const empty = parseNoticeInput({}, { partial: true })
  assert.ok(empty.ok)
  if (empty.ok) assert.deepEqual(empty.value, {})
})

test('clearing the audience (everyone) is allowed via an empty list', () => {
  const r = parseNoticeInput({ audience_colleges: [], audience_batches: [] }, { partial: true })
  assert.ok(r.ok)
  if (r.ok) assert.deepEqual(r.value, { audience_colleges: [], audience_batches: [] })
})

// ── message box ──────────────────────────────────────────────────────────────
test('parseMessageInput', () => {
  const ok = parseMessageInput({ category: 'professional', subject: ' Exam week ', message: '  I have exams from 3rd–12th.  ' })
  assert.ok(ok.ok)
  if (ok.ok) assert.deepEqual(ok.value, { category: 'professional', subject: 'Exam week', message: 'I have exams from 3rd–12th.' })

  const dflt = parseMessageInput({ message: 'hi' })
  assert.ok(dflt.ok)
  if (dflt.ok) assert.deepEqual(dflt.value, { category: 'other', subject: null, message: 'hi' })

  assert.equal(parseMessageInput({ message: '   ' }).ok, false)
  assert.equal(parseMessageInput({ category: 'spam', message: 'x' }).ok, false)
  assert.equal(parseMessageInput({ message: 'x'.repeat(2001) }).ok, false)
  assert.equal(parseMessageInput({ message: 'x', subject: 'y'.repeat(121) }).ok, false)
  assert.equal(parseMessageInput(null).ok, false)
})

test('parseMessageUpdate', () => {
  const r = parseMessageUpdate({ status: 'resolved', admin_reply: '  Fixed, thanks.  ', id: 'ignored' })
  assert.ok(r.ok)
  if (r.ok) assert.deepEqual(r.value, { status: 'resolved', admin_reply: 'Fixed, thanks.' })
  const cleared = parseMessageUpdate({ admin_reply: '  ' })
  assert.ok(cleared.ok)
  if (cleared.ok) assert.deepEqual(cleared.value, { admin_reply: null })
  assert.equal(parseMessageUpdate({ status: 'archived' }).ok, false)
  assert.equal(parseMessageUpdate({}).ok, false)
})

// ── college roll nudge ───────────────────────────────────────────────────────
test('needsCollegeRoll: only NDC accounts without a roll', () => {
  assert.equal(needsCollegeRoll({ institution: 'Notre Dame College', college_roll: null }), true)
  assert.equal(needsCollegeRoll({ institution: 'NDC', college_roll: '   ' }), true)
  assert.equal(needsCollegeRoll({ institution: 'NDC', college_roll: '24010123' }), false)
  assert.equal(needsCollegeRoll({ institution: 'BUET', college_roll: null }), false)
  assert.equal(needsCollegeRoll({ institution: null, college_roll: null }), false)
  assert.equal(needsCollegeRoll(null), false)
})
