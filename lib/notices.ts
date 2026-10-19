// Pure helpers for the two dashboard features built on top of the accounts table:
//
//   1. Targeted notices  — an admin posts a notice aimed at a college and/or batch
//      (e.g. "Notre Dame College, Batch 28 → join your WhatsApp group"). Every member who
//      opens the dashboard and matches the audience sees it.
//   2. Member messages   — a message box on the dashboard (professional obligation / report a
//      problem / tell us something) that admins read and resolve from /admin/messages.
//
// No React, no I/O: this file is imported by the API routes (server), the admin pages and the
// dashboard (client), and by tests/notices.test.ts. Matching decisions live ONLY here so the
// admin's "reaches N people" preview and what a member actually sees can never disagree.

import { collegeKey, canonicalCollege } from './college.ts'

// ── Notice types ─────────────────────────────────────────────────────────────

export type NoticeTone = 'info' | 'important' | 'success'

export const NOTICE_TONES: { value: NoticeTone; label: string }[] = [
  { value: 'info', label: 'Info' },
  { value: 'important', label: 'Important' },
  { value: 'success', label: 'Good news' },
]

/** The columns of `notices` that matter for matching/validation. */
export interface NoticeAudienceFields {
  audience_colleges?: string[] | null
  audience_batches?: string[] | null
}

export interface NoticeLifecycleFields {
  is_active?: boolean | null
  starts_at?: string | null
  ends_at?: string | null
}

/** The slice of a `users` row that audience matching needs. `null` = no profile row. */
export type AudienceUser = { institution?: string | null; batch?: string | null } | null | undefined

// ── Batch normalisation ──────────────────────────────────────────────────────

/**
 * `users.batch` is free text — people type "28", "Batch 28", "batch-28", "28th" or "028".
 * Comparing normalised values makes all of those the same batch. Purely numeric batches
 * lose leading zeros; anything else is lower-cased and stripped to letters/digits.
 * ("2024" and "28" stay different: they are genuinely different values on file.)
 */
export function normalizeBatch(v: unknown): string {
  let s = String(v ?? '').toLowerCase().trim()
  if (!s) return ''
  s = s.replace(/batch/g, ' ')
  s = s.replace(/(\d)\s*(st|nd|rd|th)\b/g, '$1')
  s = s.replace(/[^a-z0-9]+/g, '')
  if (/^\d+$/.test(s)) s = s.replace(/^0+(?=\d)/, '')
  return s
}

// ── Audience matching ────────────────────────────────────────────────────────

/**
 * Does this user belong to the notice's audience?
 *
 *  - No colleges and no batches        → everyone (incl. users with no profile row).
 *  - Colleges only                     → the user's college must be one of them.
 *  - Batches only                      → the user's batch must be one of them (any college).
 *  - Both                              → BOTH must match. "Batch 28 of Notre Dame College"
 *                                        must not reach Batch 28 of some other college.
 *
 * College comparison goes through `collegeKey`, so every spelling of Notre Dame College
 * ("NDC", "notredame college", "N.D.C. Dhaka", …) is the same college.
 */
export function matchesNoticeAudience(aud: NoticeAudienceFields | null | undefined, user: AudienceUser): boolean {
  const colleges = (aud?.audience_colleges ?? []).map(collegeKey).filter(Boolean)
  const batches = (aud?.audience_batches ?? []).map(normalizeBatch).filter(Boolean)
  if (colleges.length === 0 && batches.length === 0) return true
  if (!user) return false
  if (colleges.length > 0 && !colleges.includes(collegeKey(user.institution))) return false
  if (batches.length > 0 && !batches.includes(normalizeBatch(user.batch))) return false
  return true
}

/** How many of these users would see a notice with this audience. */
export function countAudience(aud: NoticeAudienceFields | null | undefined, users: AudienceUser[]): number {
  let n = 0
  for (const u of users) if (matchesNoticeAudience(aud, u)) n++
  return n
}

export interface AudienceOption { name: string; count: number }

/**
 * What colleges and batches actually exist on file, so the admin can pick values that will
 * really match instead of guessing how people typed them. Spellings that mean the same thing
 * are merged (the most common spelling is shown), most populous first.
 */
export function summarizeAudiences(users: AudienceUser[]): { colleges: AudienceOption[]; batches: AudienceOption[] } {
  const colleges = new Map<string, { spellings: Map<string, number>; count: number }>()
  const batches = new Map<string, { spellings: Map<string, number>; count: number }>()
  const bump = (m: typeof colleges, key: string, raw: string) => {
    if (!key) return
    const e = m.get(key) ?? { spellings: new Map(), count: 0 }
    e.count++
    e.spellings.set(raw, (e.spellings.get(raw) ?? 0) + 1)
    m.set(key, e)
  }
  for (const u of users) {
    if (!u) continue
    const inst = (u.institution ?? '').trim()
    const batch = (u.batch ?? '').trim()
    bump(colleges, collegeKey(inst), inst)
    bump(batches, normalizeBatch(batch), batch)
  }
  const top = (e: { spellings: Map<string, number> }) => [...e.spellings.entries()].sort((a, b) => b[1] - a[1])[0][0]
  const finish = (m: typeof colleges, label: (raw: string) => string): AudienceOption[] =>
    [...m.values()]
      .map(e => ({ name: label(top(e)), count: e.count }))
      .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name))
  return {
    colleges: finish(colleges, canonicalCollege),
    batches: finish(batches, raw => raw.replace(/\s+/g, ' ')),
  }
}

/** Active and inside its [starts_at, ends_at] window (either end optional). */
export function isNoticeLive(n: NoticeLifecycleFields, now: Date = new Date()): boolean {
  return noticeStatus(n, now) === 'live'
}

export type NoticeStatus = 'live' | 'scheduled' | 'expired' | 'off'

export function noticeStatus(n: NoticeLifecycleFields, now: Date = new Date()): NoticeStatus {
  if (!n.is_active) return 'off'
  if (n.starts_at && now < new Date(n.starts_at)) return 'scheduled'
  if (n.ends_at && now > new Date(n.ends_at)) return 'expired'
  return 'live'
}

/** Human label for the admin list: "Everyone", "Notre Dame College · Batch 28", … */
export function describeAudience(n: NoticeAudienceFields): string {
  const colleges = n.audience_colleges ?? []
  const batches = n.audience_batches ?? []
  if (colleges.length === 0 && batches.length === 0) return 'Everyone'
  const parts: string[] = []
  if (colleges.length > 0) parts.push(colleges.join(', '))
  if (batches.length > 0) parts.push(batches.map(b => (/batch/i.test(b) ? b : `Batch ${b}`)).join(', '))
  return parts.join(' · ')
}

// ── Links ────────────────────────────────────────────────────────────────────

/**
 * Admin-entered links end up in an <a href>, so only http(s) is ever allowed (no
 * `javascript:` / `data:` URLs). A bare domain such as "chat.whatsapp.com/abc" gets https://.
 * Returns null when the value isn't a usable link.
 */
export function safeHttpUrl(v: unknown): string | null {
  let s = String(v ?? '').trim()
  if (!s) return null
  if (!/^[a-z][a-z0-9+.-]*:/i.test(s) && /^[a-z0-9-]+(\.[a-z0-9-]+)+(\/|$|\?|#)/i.test(s)) s = `https://${s}`
  try {
    const u = new URL(s)
    return u.protocol === 'https:' || u.protocol === 'http:' ? u.toString() : null
  } catch {
    return null
  }
}

/** Button text when the admin didn't write one. WhatsApp links get a recognisable default. */
export function defaultLinkLabel(url: string | null | undefined): string {
  const safe = safeHttpUrl(url)
  if (!safe) return 'Open link'
  const host = new URL(safe).hostname.toLowerCase()
  if (host === 'chat.whatsapp.com' || host === 'wa.me' || host.endsWith('whatsapp.com')) return 'Join WhatsApp group'
  return 'Open link'
}

export function isWhatsAppLink(url: string | null | undefined): boolean {
  const safe = safeHttpUrl(url)
  if (!safe) return false
  const host = new URL(safe).hostname.toLowerCase()
  return host === 'wa.me' || host.endsWith('whatsapp.com')
}

// ── Notice input validation (admin create / update) ─────────────────────────

export type NoticePatch = Partial<{
  title: string
  body: string | null
  link_url: string | null
  link_label: string | null
  tone: NoticeTone
  audience_colleges: string[]
  audience_batches: string[]
  is_active: boolean
  dismissible: boolean
  starts_at: string | null
  ends_at: string | null
}>

// `error` / `value` are declared on both arms so callers can read them after an `ok` check even with
// `strictNullChecks` off (this repo's tsconfig has `strict: false`, where `!r.ok` does not narrow).
export type ParseResult<T> = { ok: true; value: T; error?: undefined } | { ok: false; error: string; value?: undefined }

const LIMITS = {
  title: 120,
  body: 1000,
  linkLabel: 40,
  college: 120,
  batch: 40,
  colleges: 20,
  batches: 40,
  subject: 120,
  message: 2000,
  reply: 2000,
}
export const NOTICE_LIMITS = LIMITS

function asStringList(v: unknown): string[] | null {
  if (!Array.isArray(v)) return null
  return v.map(x => (typeof x === 'string' ? x : String(x ?? '')))
}

function parseDate(v: unknown): { ok: true; value: string | null } | { ok: false } {
  if (v === null || v === undefined || v === '') return { ok: true, value: null }
  const d = new Date(String(v))
  if (Number.isNaN(d.getTime())) return { ok: false }
  return { ok: true, value: d.toISOString() }
}

/**
 * Whitelists, trims and validates a notice payload. Unknown keys are dropped (so a request
 * can't write created_by etc.). With `partial`, only the keys that are present are checked —
 * used by PUT so toggling `is_active` doesn't need to resend everything.
 * Colleges are stored canonical (NDC variants → "Notre Dame College") and de-duplicated by
 * college identity; batches are de-duplicated by normalised value.
 */
export function parseNoticeInput(input: unknown, opts: { partial?: boolean } = {}): ParseResult<NoticePatch> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Invalid request.' }
  const src = input as Record<string, unknown>
  const has = (k: string) => Object.prototype.hasOwnProperty.call(src, k) && src[k] !== undefined
  const out: NoticePatch = {}

  if (has('title') || !opts.partial) {
    const title = String(src.title ?? '').trim()
    if (!title) return { ok: false, error: 'Title is required.' }
    if (title.length > LIMITS.title) return { ok: false, error: `Title must be ${LIMITS.title} characters or fewer.` }
    out.title = title
  }

  if (has('body')) {
    const body = String(src.body ?? '').trim()
    if (body.length > LIMITS.body) return { ok: false, error: `Message must be ${LIMITS.body} characters or fewer.` }
    out.body = body || null
  }

  if (has('link_url')) {
    const raw = String(src.link_url ?? '').trim()
    if (!raw) out.link_url = null
    else {
      const safe = safeHttpUrl(raw)
      if (!safe) return { ok: false, error: 'Enter a full link starting with https:// (for example your WhatsApp group invite link).' }
      out.link_url = safe
    }
  }

  if (has('link_label')) {
    const label = String(src.link_label ?? '').trim()
    if (label.length > LIMITS.linkLabel) return { ok: false, error: `Button text must be ${LIMITS.linkLabel} characters or fewer.` }
    out.link_label = label || null
  }

  if (has('tone')) {
    if (!NOTICE_TONES.some(t => t.value === src.tone)) return { ok: false, error: 'Unknown notice style.' }
    out.tone = src.tone as NoticeTone
  }

  if (has('audience_colleges')) {
    const list = asStringList(src.audience_colleges)
    if (!list) return { ok: false, error: 'Colleges must be a list.' }
    const seen = new Set<string>()
    const colleges: string[] = []
    for (const raw of list) {
      const name = canonicalCollege(raw)
      if (!name) continue
      if (name.length > LIMITS.college) return { ok: false, error: `College names must be ${LIMITS.college} characters or fewer.` }
      const key = collegeKey(name)
      if (!key || seen.has(key)) continue
      seen.add(key)
      colleges.push(name)
    }
    if (colleges.length > LIMITS.colleges) return { ok: false, error: `Pick at most ${LIMITS.colleges} colleges.` }
    out.audience_colleges = colleges
  }

  if (has('audience_batches')) {
    const list = asStringList(src.audience_batches)
    if (!list) return { ok: false, error: 'Batches must be a list.' }
    const seen = new Set<string>()
    const batches: string[] = []
    for (const raw of list) {
      const batch = raw.trim().replace(/\s+/g, ' ')
      const key = normalizeBatch(batch)
      if (!batch || !key) continue
      if (batch.length > LIMITS.batch) return { ok: false, error: `Batch values must be ${LIMITS.batch} characters or fewer.` }
      if (seen.has(key)) continue
      seen.add(key)
      batches.push(batch)
    }
    if (batches.length > LIMITS.batches) return { ok: false, error: `Pick at most ${LIMITS.batches} batches.` }
    out.audience_batches = batches
  }

  for (const k of ['is_active', 'dismissible'] as const) {
    if (has(k)) {
      if (typeof src[k] !== 'boolean') return { ok: false, error: `"${k}" must be true or false.` }
      out[k] = src[k] as boolean
    }
  }

  for (const k of ['starts_at', 'ends_at'] as const) {
    if (has(k)) {
      const d = parseDate(src[k])
      if (!d.ok) return { ok: false, error: k === 'starts_at' ? 'Start date is not a valid date.' : 'End date is not a valid date.' }
      out[k] = d.value
    }
  }
  if (out.starts_at && out.ends_at && new Date(out.ends_at) <= new Date(out.starts_at)) {
    return { ok: false, error: 'The end date must be after the start date.' }
  }

  return { ok: true, value: out }
}

// ── Member message box ───────────────────────────────────────────────────────

export type MessageCategory = 'professional' | 'problem' | 'other'
export type MessageStatus = 'open' | 'in_progress' | 'resolved'

/**
 * What members can write to us about. Labels/hints are the only place these appear, so
 * rewording a category is a one-line change here (the stored values stay the same).
 */
export const MESSAGE_CATEGORIES: { value: MessageCategory; label: string; hint: string }[] = [
  { value: 'professional', label: 'Professional obligation', hint: 'A work, exam or other commitment that affects your involvement with NDSC.' },
  { value: 'problem', label: 'Report a problem', hint: 'Something broken, wrong or unfair — on the site or in the club.' },
  { value: 'other', label: 'Tell us something', hint: 'Feedback, an idea, or a question.' },
]

export const MESSAGE_STATUSES: { value: MessageStatus; label: string }[] = [
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
]

export const categoryLabel = (c: string) => MESSAGE_CATEGORIES.find(x => x.value === c)?.label ?? 'Message'
export const statusLabel = (s: string) => MESSAGE_STATUSES.find(x => x.value === s)?.label ?? s

/** At most this many messages per member per rolling 24 hours (stops accidental/abusive floods). */
export const MESSAGES_PER_DAY = 10

export type MessageInput = { category: MessageCategory; subject: string | null; message: string }

export function parseMessageInput(input: unknown): ParseResult<MessageInput> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Invalid request.' }
  const src = input as Record<string, unknown>
  const category = (src.category === undefined || src.category === '' ? 'other' : src.category) as MessageCategory
  if (!MESSAGE_CATEGORIES.some(c => c.value === category)) return { ok: false, error: 'Please choose what your message is about.' }
  const subject = String(src.subject ?? '').trim()
  if (subject.length > LIMITS.subject) return { ok: false, error: `Subject must be ${LIMITS.subject} characters or fewer.` }
  const message = String(src.message ?? '').trim()
  if (!message) return { ok: false, error: 'Please write your message.' }
  if (message.length > LIMITS.message) return { ok: false, error: `Message must be ${LIMITS.message} characters or fewer.` }
  return { ok: true, value: { category, subject: subject || null, message } }
}

export type MessageUpdate = Partial<{ status: MessageStatus; admin_reply: string | null }>

/** Admin-side update: a status change and/or a reply the member will see. */
export function parseMessageUpdate(input: unknown): ParseResult<MessageUpdate> {
  if (!input || typeof input !== 'object' || Array.isArray(input)) return { ok: false, error: 'Invalid request.' }
  const src = input as Record<string, unknown>
  const out: MessageUpdate = {}
  if (src.status !== undefined) {
    if (!MESSAGE_STATUSES.some(s => s.value === src.status)) return { ok: false, error: 'Unknown status.' }
    out.status = src.status as MessageStatus
  }
  if (src.admin_reply !== undefined) {
    const reply = String(src.admin_reply ?? '').trim()
    if (reply.length > LIMITS.reply) return { ok: false, error: `Reply must be ${LIMITS.reply} characters or fewer.` }
    out.admin_reply = reply || null
  }
  if (Object.keys(out).length === 0) return { ok: false, error: 'Nothing to update.' }
  return { ok: true, value: out }
}
