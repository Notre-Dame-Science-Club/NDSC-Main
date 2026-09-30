// One normalization for every identity comparison (email / phone / roll).
// Used by access checks now, and by slots / unique-check / team login later.
export function normalizeEmail(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim().toLowerCase()
}
export function normalizePhone(v: unknown): string {
  if (v === null || v === undefined) return ''
  let s = String(v).trim().replace(/[\s\-().]/g, '')
  if (s.startsWith('+880')) s = '0' + s.slice(4)
  else if (s.startsWith('880') && s.length >= 12) s = '0' + s.slice(3)
  return s
}
export function normalizeRoll(v: unknown): string {
  return v === null || v === undefined ? '' : String(v).trim().toLowerCase()
}
export type IdentityKind = 'email' | 'phone' | 'roll'
export function normalizeIdentity(kind: IdentityKind, v: unknown): string {
  return kind === 'email' ? normalizeEmail(v) : kind === 'phone' ? normalizePhone(v) : normalizeRoll(v)
}

// ── Slot identities (registration_slots) ────────────────────────────────────
// Identity list for one registration; duplicates inside it are collapsed (leader wins the role)
// so the unique indexes only fire for a real conflict with ANOTHER registration.
export type SlotIdentity = { kind: 'member' | 'email' | 'phone' | 'roll'; value: string; role: 'leader' | 'team_member' }

export function buildSlotIdentities(input: {
  leader: { member_id?: string | null; email?: any; phone?: any; college_roll?: any }
  team?: Array<{ email?: any; phone?: any; college_roll?: any }>
  teamMemberAccountIds?: string[]
}): SlotIdentity[] {
  const seen = new Map<string, SlotIdentity>()
  const add = (kind: SlotIdentity['kind'], value: string, role: SlotIdentity['role']) => {
    if (!value) return
    const k = `${kind}|${value}`
    if (!seen.has(k)) seen.set(k, { kind, value, role })
  }
  const L = input.leader
  add('member', L.member_id ? String(L.member_id) : '', 'leader')
  add('email', normalizeEmail(L.email), 'leader')
  add('phone', normalizePhone(L.phone), 'leader')
  add('roll', normalizeRoll(L.college_roll), 'leader')
  for (const m of input.team || []) {
    add('email', normalizeEmail(m?.email), 'team_member')
    add('phone', normalizePhone(m?.phone), 'team_member')
    add('roll', normalizeRoll(m?.college_roll), 'team_member')
  }
  for (const id of input.teamMemberAccountIds || []) add('member', String(id), 'team_member')
  return [...seen.values()]
}
