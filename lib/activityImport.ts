// Bulk-import participants into an activity from a CSV (pure logic, unit-tested).
//
// COLUMN CONVENTION — one CSV column per form field, named after where the field lives in the
// activity's form-graph (Form Builder tree):
//
//   email, full_name, phone, ...      unprefixed built-ins: the participant's common details
//   password                          optional; used only if the website account has to be created
//   team_name, project_name           optional top-level registration columns
//   segment                           optional; names a segment explicitly ("Junior_Quiz" or "Junior > Quiz";
//                                     several can be separated by ';') — needed for segments with no fields
//   <segment>_<field>                 a custom field on a segment
//   <segment>_<subsegment>_<field>    a custom field on a sub-segment (any depth)
//
// <segment>/<field> tokens are matched on the form's own labels/keys, normalised (lower-case,
// punctuation and spaces -> "_"), so "Math Olympiad" is written Math_Olympiad. The row's segment(s)
// are INFERRED from which of those columns hold a value, so no separate "which segment" column is
// required. A person can be registered into several segments from one row.
//
// This module does no I/O; app/api/admin/activity-registrations-import/route.ts performs the writes.

import { normalizeBlocks, validateFieldFormat, type FormBlock } from './formBlocks.ts'
import { terminalsOf } from './segmentGroups.ts'
import { validateCollegeRoll } from './validation.ts'
import { rowsToCsv } from './csv.ts'

export const NOT_SET = '<not set>'

export const BUILTIN_KEYS = ['full_name', 'phone', 'email', 'college', 'college_roll', 'hsc_session', 'division'] as const
export const META_KEYS = ['password', 'team_name', 'project_name', 'segment'] as const

const FILE_TYPES = new Set(['photo', 'file'])

export type ImportNode = {
  id: string
  parent_id: string | null
  label: string
  kind?: string
  enabled?: boolean
  is_terminal?: boolean
  fields?: any
  behavior?: any
  display_order?: number
}

export type ColumnMap =
  | { header: string; kind: 'builtin'; key: string }
  | { header: string; kind: 'meta'; key: string }
  | { header: string; kind: 'field'; key: string; nodeId: string; nodeLabel: string; field: FormBlock }
  | { header: string; kind: 'ignored'; reason: string }

export type PlannedTarget = {
  terminalId: string
  pathIds: string[]            // root -> ... -> terminal (becomes submitted_node_ids)
  label: string                // "Junior › Quiz"
  custom: Record<string, any>  // custom_answers for this registration
}

export type PlannedRow = {
  rowNum: number               // 1-based spreadsheet row (header = 1)
  blank: boolean
  email: string
  real: Record<string, string> // values actually present in the CSV ('' when missing)
  stored: Record<string, string> // same, with <not set> filled in (what lands in the DB)
  password: string
  teamName: string
  projectName: string
  targets: PlannedTarget[]
  errors: string[]
  warnings: string[]
}

export type ImportPlan = { fatal?: string; columns: ColumnMap[]; rows: PlannedRow[] }

/** lower-case, every run of non letter/digit -> "_", trimmed. Unicode-aware (Bangla labels work). */
export function norm(s: unknown): string {
  return String(s ?? '')
    .replace(/^\uFEFF/, '')
    .trim()
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, '_')
    .replace(/^_+|_+$/g, '')
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

// ── tree index ─────────────────────────────────────────────────────────────

type Index = {
  root: ImportNode
  byId: Map<string, ImportNode>
  kids: Map<string, ImportNode[]>
  fieldMap: (n: ImportNode) => Map<string, FormBlock>
  chain: (id: string) => string[]
}

function buildIndex(nodes: ImportNode[]): Index | null {
  const root = nodes.find(n => n.parent_id === null)
  if (!root) return null
  const byId = new Map(nodes.map(n => [n.id, n]))
  const kids = new Map<string, ImportNode[]>()
  for (const n of nodes) {
    if (!n.parent_id || n.enabled === false) continue
    if (!kids.has(n.parent_id)) kids.set(n.parent_id, [])
    kids.get(n.parent_id)!.push(n)
  }
  for (const list of kids.values()) list.sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))

  const cache = new Map<string, Map<string, FormBlock>>()
  const fieldMap = (n: ImportNode) => {
    let m = cache.get(n.id)
    if (m) return m
    m = new Map()
    for (const f of normalizeBlocks(n.fields || [])) {
      if (f.kind !== 'field' || (f as any).is_builtin) continue
      if (FILE_TYPES.has(f.type as string)) continue
      for (const t of [norm(f.key), norm(f.id), norm(f.label)]) if (t && !m.has(t)) m.set(t, f)
    }
    cache.set(n.id, m)
    return m
  }
  const chain = (id: string): string[] => {
    const out: string[] = []
    let cur: ImportNode | undefined = byId.get(id)
    let guard = 0
    while (cur && guard++ < 200) { out.unshift(cur.id); cur = cur.parent_id ? byId.get(cur.parent_id) : undefined }
    return out
  }
  return { root, byId, kids, fieldMap, chain }
}

/** Deepest "<node-path>_<field>" reading of a normalised header, or null. */
function findPrefixedField(ix: Index, header: string): { node: ImportNode; field: FormBlock } | null {
  let best: { node: ImportNode; field: FormBlock; depth: number } | null = null
  const walk = (cur: ImportNode, s: string, depth: number) => {
    for (const c of ix.kids.get(cur.id) || []) {
      const L = norm(c.label)
      if (!L || !s.startsWith(L + '_')) continue
      const rest = s.slice(L.length + 1)
      const f = ix.fieldMap(c).get(rest)
      if (f && (!best || depth + 1 > best.depth)) best = { node: c, field: f, depth: depth + 1 }
      walk(c, rest, depth + 1)
    }
  }
  walk(ix.root, header, 0)
  return best ? { node: best.node, field: best.field } : null
}

/** Resolve a whole segment path ("junior_quiz") to a node below the root. */
function findNodeByPath(ix: Index, s: string): ImportNode | null {
  const walk = (cur: ImportNode, rest: string): ImportNode | null => {
    for (const c of ix.kids.get(cur.id) || []) {
      const L = norm(c.label)
      if (!L) continue
      if (rest === L) return c
      if (rest.startsWith(L + '_')) { const r = walk(c, rest.slice(L.length + 1)); if (r) return r }
    }
    return null
  }
  return walk(ix.root, s)
}

export function resolveColumns(headers: string[], ix: Index): ColumnMap[] {
  const rootFields = ix.fieldMap(ix.root)
  return headers.map((raw): ColumnMap => {
    const header = String(raw ?? '').replace(/^\uFEFF/, '').trim()
    const n = norm(header)
    if (!n) return { header, kind: 'ignored', reason: 'Empty header' }
    if ((BUILTIN_KEYS as readonly string[]).includes(n)) return { header, kind: 'builtin', key: n }
    if ((META_KEYS as readonly string[]).includes(n)) return { header, kind: 'meta', key: n }
    const rootField = rootFields.get(n)
    const prefixed = findPrefixedField(ix, n)
    if (prefixed) {
      const f = prefixed.field
      return { header, kind: 'field', key: (f.key || f.id) as string, nodeId: prefixed.node.id, nodeLabel: prefixed.node.label, field: f }
    }
    if (rootField) {
      return { header, kind: 'field', key: (rootField.key || rootField.id) as string, nodeId: ix.root.id, nodeLabel: ix.root.label, field: rootField }
    }
    // a built-in written with a segment prefix, e.g. "quiz_phone"
    for (const b of BUILTIN_KEYS) {
      if (n.endsWith('_' + b)) return { header, kind: 'ignored', reason: `"${b}" is a common detail — use the plain "${b}" column` }
    }
    return { header, kind: 'ignored', reason: 'Does not match any segment/field in this activity' }
  })
}

// ── answer parsing ─────────────────────────────────────────────────────────

function matchOption(opts: string[], raw: string): string | null {
  const t = raw.trim().toLowerCase()
  return opts.find(o => String(o).trim().toLowerCase() === t) ?? null
}

function parseAnswer(f: FormBlock, raw: string): { value: any } | { error: string } {
  const label = f.label || f.key || f.id
  const type = f.type as string
  const opts = Array.isArray(f.options) ? f.options.map(String) : []
  if (type === 'number') {
    const n = Number(raw)
    return Number.isFinite(n) ? { value: n } : { error: `"${label}" must be a number (got "${raw}")` }
  }
  if (type === 'checkboxes' || type === 'checkbox') {
    const parts = raw.split(/[;|]/).map(p => p.trim()).filter(Boolean)
    if (type === 'checkbox' || !opts.length) return { value: parts }
    const out: string[] = []
    for (const p of parts) {
      const m = matchOption(opts, p)
      if (m !== null) out.push(m)
      else if (f.allow_other) out.push(p)
      else return { error: `"${label}": "${p}" is not one of ${opts.join(', ')}` }
    }
    return { value: out }
  }
  if ((type === 'dropdown' || type === 'multiple_choice') && opts.length) {
    const m = matchOption(opts, raw)
    if (m !== null) return { value: m }
    if (f.allow_other) return { value: raw }
    return { error: `"${label}": "${raw}" is not one of ${opts.join(', ')}` }
  }
  return { value: raw }
}

// ── planning ───────────────────────────────────────────────────────────────

export function planImport(headers: string[], rows: string[][], nodes: ImportNode[], rowOffset = 0): ImportPlan {
  const ix = buildIndex(nodes)
  if (!ix) return { fatal: 'This activity has no registration form yet (Form Builder is empty).', columns: [], rows: [] }
  const columns = resolveColumns(headers, ix)
  if (!columns.some(c => c.kind === 'builtin' && c.key === 'email')) {
    return { fatal: 'Missing required column: email (it becomes the participant\'s website login).', columns, rows: [] }
  }

  const planned: PlannedRow[] = rows.map((cells, i) => {
    const rowNum = rowOffset + i + 2
    const val = (idx: number) => String(cells[idx] ?? '').trim()
    const row: PlannedRow = {
      rowNum, blank: false, email: '', real: {}, stored: {}, password: '', teamName: '', projectName: '',
      targets: [], errors: [], warnings: [],
    }
    if (cells.every(c => !String(c ?? '').trim())) { row.blank = true; return row }

    // 1) common details + meta columns
    for (const k of BUILTIN_KEYS) row.real[k] = ''
    const segmentRefs: string[] = []
    const fieldVals: { col: Extract<ColumnMap, { kind: 'field' }>; v: string }[] = []
    columns.forEach((col, idx) => {
      const v = val(idx)
      if (!v) return
      if (col.kind === 'builtin') row.real[col.key] = col.key === 'email' ? v.toLowerCase() : v
      else if (col.kind === 'meta') {
        if (col.key === 'password') row.password = String(cells[idx] ?? '')   // not trimmed: passwords may contain spaces
        else if (col.key === 'team_name') row.teamName = v
        else if (col.key === 'project_name') row.projectName = v
        else if (col.key === 'segment') segmentRefs.push(...v.split(/[;|]/).map(s => s.trim()).filter(Boolean))
      } else if (col.kind === 'field') fieldVals.push({ col, v })
    })
    row.email = row.real.email
    for (const k of BUILTIN_KEYS) row.stored[k] = row.real[k] || (k === 'email' ? '' : NOT_SET)

    if (!row.email) row.errors.push('Email is required (it is the participant\'s website login).')
    else if (!EMAIL_RE.test(row.email)) row.errors.push(`Invalid email "${row.email}".`)
    if (row.password && row.password.length < 6) row.errors.push('Password must be at least 6 characters.')

    // 2) which segment(s)? touched = nodes (below root) that have a value, plus explicit `segment` refs
    const touched = new Map<string, ImportNode>()
    for (const { col } of fieldVals) if (col.nodeId !== ix.root.id) touched.set(col.nodeId, ix.byId.get(col.nodeId)!)
    for (const ref of segmentRefs) {
      const n = findNodeByPath(ix, norm(ref))
      if (n) touched.set(n.id, n)
      else row.errors.push(`Unknown segment "${ref}".`)
    }
    // an ancestor of another touched node is just part of its path
    const isAncestor = (a: string, b: string) => a !== b && ix.chain(b).includes(a)
    const tips = [...touched.values()].filter(n => ![...touched.keys()].some(o => isAncestor(n.id, o)))

    const terminalIds: string[] = []
    if (tips.length === 0) {
      const rootTerms = terminalsOf(ix.root.id, nodes as any)
      if (rootTerms.length === 1 && rootTerms[0] === ix.root.id) terminalIds.push(ix.root.id)
      else if (!row.errors.some(e => e.startsWith('Unknown segment')))
        row.errors.push('No segment given: fill a "<segment>_<field>" column or use the "segment" column.')
    }
    for (const t of tips) {
      const terms = terminalsOf(t.id, nodes as any)
      if (terms.length === 0) row.errors.push(`Segment "${t.label}" has nothing to register into (disabled?).`)
      else if (terms.length === 1) terminalIds.push(terms[0])
      else row.errors.push(`"${t.label}" has sub-segments (${terms.map(id => ix.byId.get(id)?.label).join(', ')}) — say which one with a "${norm(t.label)}_<sub-segment>_<field>" column or the "segment" column.`)
    }
    const uniqueTerminals = [...new Set(terminalIds)]

    // 3) one target per terminal
    for (const terminalId of uniqueTerminals) {
      const pathIds = ix.chain(terminalId)
      const pathSet = new Set(pathIds)
      const label = pathIds.slice(1).map(id => ix.byId.get(id)?.label).filter(Boolean).join(' › ') || ix.root.label
      const custom: Record<string, any> = {}

      for (const { col, v } of fieldVals) {
        if (!pathSet.has(col.nodeId)) continue
        const r = parseAnswer(col.field, v)
        if ('error' in r) row.errors.push(`${label}: ${r.error}`)
        else custom[col.key] = r.value
      }

      // format rules the form's own fields carry (same checks as the public submit route)
      const pathBlocks = pathIds.flatMap(id => normalizeBlocks(ix.byId.get(id)?.fields || []))
      for (const f of pathBlocks) {
        if (f.kind !== 'field') continue
        const b = (f as any).is_builtin as string | undefined
        if (b === 'college_roll') continue
        const err = validateFieldFormat(f, b ? row.real[b] : custom[(f.key ?? f.id) as string])
        if (err) row.errors.push(`${label}: ${err}`)
      }
      if (row.real.college_roll) {
        const rollField = pathBlocks.find(f => f.kind === 'field' && (f as any).is_builtin === 'college_roll' && f.validation)
        const err = rollField ? validateFieldFormat(rollField, row.real.college_roll) : validateCollegeRoll(row.real.college, row.real.college_roll)
        if (err) row.errors.push(`${label}: ${err}`)
      }

      // required custom fields left empty -> <not set> (an import never blocks on missing info)
      for (const f of pathBlocks) {
        if (f.kind !== 'field' || (f as any).is_builtin || !f.required || FILE_TYPES.has(f.type as string)) continue
        const k = (f.key || f.id) as string
        if (custom[k] === undefined) { custom[k] = NOT_SET; row.warnings.push(`${label}: required "${f.label || k}" empty -> ${NOT_SET}`) }
      }

      // team-required segments can't be filled from a flat row
      for (const id of pathIds) {
        const team = ix.byId.get(id)?.behavior?.require_team
        if (team && !team.optional && (team.min ?? 1) > 0)
          row.errors.push(`${label}: this segment requires a team of at least ${team.min ?? 1} — team segments can't be imported from CSV yet.`)
      }

      row.targets.push({ terminalId, pathIds, label, custom })
    }

    return row
  })

  return { columns, rows: planned }
}

// ── template ───────────────────────────────────────────────────────────────

/** CSV header row for an activity, derived from its form tree, plus a human description per column. */
export function buildTemplate(nodes: ImportNode[]): { columns: { header: string; meaning: string }[]; csv: string } {
  const ix = buildIndex(nodes)
  const cols: { header: string; meaning: string }[] = [
    { header: 'email', meaning: 'Required — website login' },
    { header: 'full_name', meaning: 'Common detail' },
    { header: 'phone', meaning: 'Common detail' },
    { header: 'college', meaning: 'Common detail' },
    { header: 'college_roll', meaning: 'Common detail' },
    { header: 'hsc_session', meaning: 'Common detail' },
    { header: 'division', meaning: 'Common detail' },
    { header: 'password', meaning: 'Optional — only used when the account must be created' },
  ]
  if (ix) {
    const anyTeam = nodes.some(n => n.behavior?.require_team)
    const anyProject = nodes.some(n => n.behavior?.project_name?.enabled)
    if (anyTeam) cols.push({ header: 'team_name', meaning: 'Team name (team events)' })
    if (anyProject) cols.push({ header: 'project_name', meaning: 'Project name' })
    const tok = (f: FormBlock) => norm(f.key) || norm(f.label) || norm(f.id)
    for (const f of ix.fieldMap(ix.root).values()) {
      const h = tok(f); if (h && !cols.some(c => c.header === h)) cols.push({ header: h, meaning: `Common · ${f.label || h}` })
    }
    let hasSegments = false
    const walk = (n: ImportNode, prefix: string[], names: string[]) => {
      for (const c of ix.kids.get(n.id) || []) {
        hasSegments = true
        const p = [...prefix, norm(c.label)], nm = [...names, c.label]
        const seen = new Set<FormBlock>()
        for (const f of ix.fieldMap(c).values()) {
          if (seen.has(f)) continue; seen.add(f)
          const h = [...p, tok(f)].join('_')
          if (!cols.some(x => x.header === h)) cols.push({ header: h, meaning: `${nm.join(' › ')} · ${f.label || tok(f)}` })
        }
        walk(c, p, nm)
      }
    }
    walk(ix.root, [], [])
    if (hasSegments) cols.push({ header: 'segment', meaning: 'Optional — segment(s) to register into, e.g. Junior_Quiz; use for segments with no fields' })
  }
  return { columns: cols, csv: rowsToCsv(cols.map(c => c.header), []) + '\r\n' }
}
