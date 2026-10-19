// College-name normalisation. People type Notre Dame College many ways:
// "Notre Dame College", "notredame college", "NDC", "N.D.C", "Notre Dame College, Dhaka",
// "notre-dame college"... Everything that decides "is this an NDC student?" or groups
// accounts by college must go through here so the variants are treated as one college.

export const NDC_NAME = 'Notre Dame College'

/** Lowercase, strip everything but letters/digits ("N.D.C." -> "ndc", "Notre-Dame " -> "notredame"). */
function squash(s: string): string {
  return s.toLowerCase().replace(/[^a-z0-9]+/g, '')
}

export function isNDCName(name: string | null | undefined): boolean {
  if (!name) return false
  const k = squash(name)
  if (!k) return false
  if (k.includes('notredame')) return true
  // "ndc", "ndc dhaka", "ndcdhaka" — but not words that merely contain the letters (e.g. "abcndcxyz")
  if (k === 'ndc' || k === 'ndcdhaka') return true
  // "NDC, Dhaka", "NDC (Dhaka)", "NDC college": first word is exactly "ndc"
  const firstWord = name.toLowerCase().split(/[^a-z0-9]+/).filter(Boolean)[0]
  return firstWord === 'ndc'
}

/** Stable grouping key for a college: all NDC variants share one key. */
export function collegeKey(name: string | null | undefined): string {
  const trimmed = (name || '').trim()
  if (!trimmed) return ''
  if (isNDCName(trimmed)) return 'ndc'
  return squash(trimmed)
}

/**
 * NDC students are identified by their college roll (every roll is unique), so an NDC account
 * without one is an incomplete profile. Non-NDC accounts never "need" a roll.
 */
export function needsCollegeRoll(user: { institution?: string | null; college_roll?: string | null } | null | undefined): boolean {
  if (!user) return false
  return isNDCName(user.institution) && !String(user.college_roll ?? '').trim()
}

/** Canonical name to store/display: NDC variants become "Notre Dame College"; others are just trimmed. */
export function canonicalCollege(name: string | null | undefined): string {
  const trimmed = (name || '').trim().replace(/\s+/g, ' ')
  if (!trimmed) return ''
  return isNDCName(trimmed) ? NDC_NAME : trimmed
}
