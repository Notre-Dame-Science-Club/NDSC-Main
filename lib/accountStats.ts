// Pure helpers behind the admin "Manage Accounts" overview: classify accounts, compute the
// stats tables, filter by type / college / batch, and serialise to CSV. No React, no I/O.

import { collegeKey, canonicalCollege, isNDCName } from './college.ts'
import { rowsToCsv } from './csv.ts'

export type Account = {
  id: string
  full_name: string | null
  email: string | null
  phone?: string | null
  institution?: string | null
  college_roll?: string | null
  batch?: string | null
  department?: string | null
  hsc_session?: string | null
  ndsc_id?: string | null
  membership_status?: string | null
  is_verified?: boolean | null
  education_level?: string | null
  created_at?: string | null
}

export type AccountKind = 'member' | 'pending' | 'rejected' | 'user'

export const NO_BATCH = '(no batch)'
export const NO_COLLEGE = '(no college given)'

/** member = approved club member; pending/rejected = membership application states; user = everyone else. */
export function kindOf(a: Account): AccountKind {
  if (a.membership_status === 'approved' || a.is_verified === true) return 'member'
  if (a.membership_status === 'pending') return 'pending'
  if (a.membership_status === 'rejected') return 'rejected'
  return 'user'
}

export const isMember = (a: Account) => kindOf(a) === 'member'
export const isNDC = (a: Account) => isNDCName(a.institution)
export const batchOf = (a: Account) => (a.batch || '').trim()
export const collegeKeyOf = (a: Account) => collegeKey(a.institution)

export interface Counts { total: number; members: number; pending: number; users: number; ndc: number }

export interface BatchRow { batch: string; total: number; members: number; users: number; ndc: number; otherColleges: number }
export interface CollegeRow { key: string; label: string; total: number; members: number; users: number; batches: number }

export interface Stats {
  totals: Counts & {
    rejected: number
    /** NDC accounts that are not members yet — people who can apply from their dashboard */
    ndcNotMembers: number
    otherColleges: number
    noCollege: number
  }
  byBatch: BatchRow[]
  byCollege: CollegeRow[]
}

/** Newest/largest numeric batch first; non-numeric batches after, "(no batch)" last. */
function compareBatch(a: string, b: string): number {
  if (a === NO_BATCH) return 1
  if (b === NO_BATCH) return -1
  const na = parseInt(a, 10), nb = parseInt(b, 10)
  if (!isNaN(na) && !isNaN(nb) && na !== nb) return nb - na
  return a.localeCompare(b)
}

export function computeStats(accounts: Account[]): Stats {
  const totals = {
    total: 0, members: 0, pending: 0, users: 0, ndc: 0,
    rejected: 0, ndcNotMembers: 0, otherColleges: 0, noCollege: 0,
  }
  const batches = new Map<string, BatchRow>()
  const colleges = new Map<string, { row: CollegeRow; labels: Map<string, number>; batches: Set<string> }>()

  for (const a of accounts) {
    const kind = kindOf(a)
    const member = kind === 'member'
    const ndc = isNDC(a)
    const ck = collegeKeyOf(a)

    totals.total++
    if (member) totals.members++
    else totals.users++
    if (kind === 'pending') totals.pending++
    if (kind === 'rejected') totals.rejected++
    if (ndc) { totals.ndc++; if (!member) totals.ndcNotMembers++ }
    else if (ck) totals.otherColleges++
    else totals.noCollege++

    const b = batchOf(a) || NO_BATCH
    let br = batches.get(b)
    if (!br) { br = { batch: b, total: 0, members: 0, users: 0, ndc: 0, otherColleges: 0 }; batches.set(b, br) }
    br.total++
    if (member) br.members++; else br.users++
    if (ndc) br.ndc++; else br.otherColleges++

    let cr = colleges.get(ck)
    if (!cr) {
      cr = { row: { key: ck, label: '', total: 0, members: 0, users: 0, batches: 0 }, labels: new Map(), batches: new Set() }
      colleges.set(ck, cr)
    }
    cr.row.total++
    if (member) cr.row.members++; else cr.row.users++
    const label = canonicalCollege(a.institution)
    if (label) cr.labels.set(label, (cr.labels.get(label) || 0) + 1)
    if (batchOf(a)) cr.batches.add(batchOf(a))
  }

  const byCollege: CollegeRow[] = [...colleges.values()].map(({ row, labels, batches: bs }) => {
    // Show the spelling most people used for that college (NDC is always the canonical name).
    const best = [...labels.entries()].sort((x, y) => y[1] - x[1])[0]?.[0]
    return { ...row, label: row.key === '' ? NO_COLLEGE : (best || row.key), batches: bs.size }
  }).sort((x, y) => (x.key === 'ndc' ? -1 : y.key === 'ndc' ? 1 : 0) || y.total - x.total || x.label.localeCompare(y.label))

  return {
    totals,
    byBatch: [...batches.values()].sort((x, y) => compareBatch(x.batch, y.batch)),
    byCollege,
  }
}

// ── Filtering ───────────────────────────────────────────────────────────────

export type TypeFilter = 'all' | 'member' | 'user' | 'pending'
/** 'any' | 'not-ndc' | `key:<collegeKey>` ('key:' with empty key = no college given) */
export type CollegeFilter = string

export interface AccountFilter {
  type: TypeFilter
  college: CollegeFilter
  /** Selected batches (use NO_BATCH for blanks). Empty = every batch. */
  batches: string[]
}

export const EMPTY_FILTER: AccountFilter = { type: 'all', college: 'any', batches: [] }

export function filterAccounts(accounts: Account[], f: AccountFilter): Account[] {
  const batchSet = new Set(f.batches)
  return accounts.filter(a => {
    const kind = kindOf(a)
    if (f.type === 'member' && kind !== 'member') return false
    if (f.type === 'user' && kind === 'member') return false
    if (f.type === 'pending' && kind !== 'pending') return false

    if (f.college === 'not-ndc') { if (isNDC(a)) return false }
    else if (f.college.startsWith('key:')) { if (collegeKeyOf(a) !== f.college.slice(4)) return false }

    if (batchSet.size && !batchSet.has(batchOf(a) || NO_BATCH)) return false
    return true
  })
}

// ── CSV ─────────────────────────────────────────────────────────────────────

export const CSV_COLUMNS: { key: string; label: string; get: (a: Account) => string }[] = [
  { key: 'full_name', label: 'full_name', get: a => a.full_name || '' },
  { key: 'email', label: 'email', get: a => a.email || '' },
  { key: 'phone', label: 'phone', get: a => a.phone || '' },
  { key: 'type', label: 'account_type', get: a => (isMember(a) ? 'club member' : 'website user') },
  { key: 'membership_status', label: 'membership_status', get: a => a.membership_status || 'none' },
  { key: 'college', label: 'college', get: a => canonicalCollege(a.institution) },
  { key: 'college_roll', label: 'college_roll', get: a => a.college_roll || '' },
  { key: 'batch', label: 'batch', get: a => batchOf(a) },
  { key: 'department', label: 'department', get: a => a.department || '' },
  { key: 'hsc_session', label: 'hsc_session', get: a => a.hsc_session || '' },
  { key: 'education_level', label: 'education_level', get: a => a.education_level || '' },
  { key: 'ndsc_id', label: 'ndsc_id', get: a => a.ndsc_id || '' },
  { key: 'created_at', label: 'joined', get: a => (a.created_at || '').slice(0, 10) },
]

export const DEFAULT_CSV_COLUMNS = CSV_COLUMNS.map(c => c.key)

export function accountsToCsv(accounts: Account[], columnKeys: string[] = DEFAULT_CSV_COLUMNS): string {
  const cols = CSV_COLUMNS.filter(c => columnKeys.includes(c.key))
  return rowsToCsv(cols.map(c => c.label), accounts.map(a => cols.map(c => c.get(a))))
}

/** Readable file name such as `accounts_members_ndc_batch-2024-2025.csv`. */
export function exportFileName(f: AccountFilter, collegeLabel?: string): string {
  const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')
  const parts = ['accounts']
  if (f.type !== 'all') parts.push(f.type === 'member' ? 'members' : f.type === 'user' ? 'website-users' : 'pending')
  if (f.college === 'not-ndc') parts.push('non-ndc')
  else if (f.college.startsWith('key:')) parts.push(f.college === 'key:ndc' ? 'ndc' : slug(collegeLabel || f.college.slice(4)) || 'no-college')
  if (f.batches.length) parts.push('batch-' + f.batches.map(slug).join('-'))
  return parts.filter(Boolean).join('_') + '.csv'
}
