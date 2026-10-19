import { isNDCName } from '@/lib/college'

/**
 * Batch 28 = Notre Dame College students whose 8-digit college roll starts with 128.
 * Used on the server (to decide who may receive the community links) and on the client
 * (only to decide whether to bother asking the server).
 */
export const BATCH28_ROLL_RE = /^128\d{5}$/

export function isBatch28(user: { institution?: string | null; college_roll?: string | null } | null | undefined): boolean {
  if (!user) return false
  return isNDCName(user.institution) && BATCH28_ROLL_RE.test(String(user.college_roll ?? '').trim())
}
