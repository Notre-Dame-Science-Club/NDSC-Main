// Pure helpers behind the admin "Bulk sending" and "Group notify" tabs: pick accounts by flexible
// filters, read extra people from pasted text / CSV, merge everything into one de-duplicated
// recipient list, and turn it into what the WhatsApp service and the email campaign API expect.
// No React, no I/O.

import { batchOf, collegeKeyOf, kindOf, NO_BATCH, type Account, type AccountKind } from './accountStats.ts'
import { rowsToCsv } from './csv.ts'

export const DEFAULT_COUNTRY_CODE = '880'
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

export type Recipient = {
  /** stable id for de-duplication / React keys */
  key: string
  name: string
  phone: string // normalised digits with country code, or ''
  email: string // lower-case, or ''
  source: 'account' | 'external'
  accountId?: string
}

// ── phone / email cleaning ──────────────────────────────────────────────────

/** "01711-111111" / "+880 1711 111111" / "008801711111111" -> "8801711111111". '' when it can't be a phone number. */
export function normalizePhone(raw: string | null | undefined, cc = DEFAULT_COUNTRY_CODE): string {
  let d = String(raw ?? '').replace(/\D/g, '')
  if (d.startsWith('00')) d = d.slice(2)
  else if (d.startsWith('0')) d = cc + d.slice(1)
  return /^\d{8,15}$/.test(d) ? d : ''
}
export function cleanEmail(raw: string | null | undefined): string {
  const e = String(raw ?? '').trim().toLowerCase()
  return EMAIL_RE.test(e) ? e : ''
}

// ── people typed in or uploaded (not on the website) ─────────────────────────

function splitCsvLine(line: string): string[] {
  const out: string[] = []
  let cell = '', q = false
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (q) { if (ch === '"' && line[i + 1] === '"') { cell += '"'; i++ } else if (ch === '"') q = false; else cell += ch }
    else if (ch === '"') q = true
    else if (ch === ',' || ch === ';' || ch === '\t') { out.push(cell.trim()); cell = '' }
    else cell += ch
  }
  out.push(cell.trim())
  return out
}

export type ExternalParse = { people: Recipient[]; invalid: string[]; duplicates: number }

/**
 * Accepts a CSV with any of the headers phone/number/mobile/whatsapp, email/gmail/mail, name — or loose
 * lines such as "Rahim, 01711111111, rahim@gmail.com", "01711111111", "someone@gmail.com". Every cell is
 * classified by what it looks like, so column order doesn't matter when there is no header.
 */
export function parseExternal(text: string, cc = DEFAULT_COUNTRY_CODE): ExternalParse {
  const lines = String(text || '').replace(/^﻿/, '').split(/\r?\n/).map(l => l.trim()).filter(Boolean)
  const people: Recipient[] = [], invalid: string[] = []
  const seen = new Set<string>()
  let duplicates = 0
  if (!lines.length) return { people, invalid, duplicates }

  const first = splitCsvLine(lines[0]).map(h => h.toLowerCase())
  const idx = (names: string[]) => first.findIndex(h => names.includes(h))
  const pi = idx(['phone', 'number', 'mobile', 'whatsapp', 'phone_number', 'phone number'])
  const ei = idx(['email', 'gmail', 'mail', 'email_address', 'e-mail'])
  const ni = idx(['name', 'full_name', 'full name'])
  const hasHeader = pi !== -1 || ei !== -1

  for (const line of hasHeader ? lines.slice(1) : lines) {
    const cells = splitCsvLine(line)
    let phone = '', email = '', name = ''
    if (hasHeader) {
      phone = pi !== -1 ? normalizePhone(cells[pi], cc) : ''
      email = ei !== -1 ? cleanEmail(cells[ei]) : ''
      name = ni !== -1 ? (cells[ni] || '') : ''
      if (pi !== -1 && cells[pi] && !phone && !email) { invalid.push(cells[pi]); continue }
      if (ei !== -1 && cells[ei] && !email && !phone) { invalid.push(cells[ei]); continue }
    } else {
      const rest: string[] = []
      for (const c of cells) {
        if (!email && cleanEmail(c)) email = cleanEmail(c)
        else if (!phone && /^[+\d][\d\s\-().]{6,}$/.test(c) && normalizePhone(c, cc)) phone = normalizePhone(c, cc)
        else if (c) rest.push(c)
      }
      name = rest[0] || ''
      if (!phone && !email) { invalid.push(line.slice(0, 40)); continue }
    }
    if (!phone && !email) continue
    const key = email ? `e:${email}` : `p:${phone}`
    const dupKeys = [email && `e:${email}`, phone && `p:${phone}`].filter(Boolean) as string[]
    if (dupKeys.some(k => seen.has(k))) { duplicates++; continue }
    dupKeys.forEach(k => seen.add(k))
    people.push({ key, name: name.trim(), phone, email, source: 'external' })
  }
  return { people, invalid, duplicates }
}

// ── accounts → recipients, and merging ────────────────────────────────────────

export function accountToRecipient(a: Account, cc = DEFAULT_COUNTRY_CODE): Recipient {
  return {
    key: `a:${a.id}`, name: (a.full_name || '').trim(), phone: normalizePhone(a.phone, cc),
    email: cleanEmail(a.email), source: 'account', accountId: a.id,
  }
}

/** Accounts win over typed-in people: an external row that repeats an account's phone or email is dropped. */
export function mergeRecipients(accounts: Account[], external: Recipient[], cc = DEFAULT_COUNTRY_CODE) {
  const out: Recipient[] = []
  const phones = new Set<string>(), emails = new Set<string>()
  const add = (r: Recipient) => {
    if ((r.phone && phones.has(r.phone)) || (r.email && emails.has(r.email))) return false
    if (r.phone) phones.add(r.phone)
    if (r.email) emails.add(r.email)
    out.push(r)
    return true
  }
  accounts.forEach(a => add(accountToRecipient(a, cc)))
  let droppedExternal = 0
  external.forEach(r => { if (!add(r)) droppedExternal++ })
  return { recipients: out, droppedExternal }
}

export function reachSummary(rs: Recipient[]) {
  const phone = rs.filter(r => r.phone).length
  const email = rs.filter(r => r.email).length
  return { total: rs.length, phone, email, neither: rs.filter(r => !r.phone && !r.email).length }
}

/** The `phone,name` text the WhatsApp service reads. */
export function whatsappCsv(rs: Recipient[]): string {
  return rowsToCsv(['phone', 'name'], rs.filter(r => r.phone).map(r => [r.phone, r.name || 'Member']))
}
export function emailRecipients(rs: Recipient[]) {
  return rs.filter(r => r.email).map(r => ({ email: r.email, name: r.name || r.email, source_id: r.accountId ?? null }))
}

/** `{name}` is filled per person on WhatsApp; email goes out as one shared body, so it reads "there". */
export function emailHtml(message: string): string {
  const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
  const text = esc(message.replaceAll('{name}', 'there').replaceAll('{brand}', 'Notre Dame Science Club'))
  return `<div style="font-family:sans-serif;max-width:520px;margin:0 auto;"><p style="white-space:pre-wrap;line-height:1.6;">${text}</p>`
    + `<p style="font-size:12px;color:#888;margin-top:24px;">Notre Dame Science Club — ndscbd.net</p></div>`
}

// ── flexible group filter ("notify batch X of college Y …") ──────────────────

export interface GroupFilter {
  types: AccountKind[] // empty = everyone
  colleges: string[] // collegeKey values ('ndc', 'dhakacollege', '' = no college); empty = any
  excludeColleges: string[]
  batches: string[] // NO_BATCH allowed; empty = any
  departments: string[]
  levels: string[]
  sessions: string[]
  search: string
}
export const EMPTY_GROUP: GroupFilter = { types: [], colleges: [], excludeColleges: [], batches: [], departments: [], levels: [], sessions: [], search: '' }

const norm = (s: string | null | undefined) => (s || '').trim().toLowerCase()
const anyOf = (list: string[], v: string) => list.length === 0 || list.map(norm).includes(norm(v))

export function filterGroup(accounts: Account[], f: GroupFilter): Account[] {
  const q = norm(f.search)
  return accounts.filter(a => {
    if (f.types.length && !f.types.includes(kindOf(a))) return false
    const ck = collegeKeyOf(a)
    if (f.colleges.length && !f.colleges.includes(ck)) return false
    if (f.excludeColleges.includes(ck)) return false
    if (!anyOf(f.batches, batchOf(a) || NO_BATCH)) return false
    if (!anyOf(f.departments, a.department || '')) return false
    if (!anyOf(f.levels, a.education_level || '')) return false
    if (!anyOf(f.sessions, a.hsc_session || '')) return false
    if (q) {
      const hay = [a.full_name, a.email, a.phone, a.institution, a.college_roll, a.ndsc_id, a.batch].map(norm).join(' ')
      if (!hay.includes(q)) return false
    }
    return true
  })
}

/** Distinct non-empty values of a column with counts, biggest first — feeds the filter chips. */
export function distinct(accounts: Account[], pick: (a: Account) => string | null | undefined): { value: string; count: number }[] {
  const m = new Map<string, number>()
  for (const a of accounts) { const v = (pick(a) || '').trim(); if (v) m.set(v, (m.get(v) || 0) + 1) }
  return [...m.entries()].map(([value, count]) => ({ value, count })).sort((x, y) => y.count - x.count || x.value.localeCompare(y.value))
}
