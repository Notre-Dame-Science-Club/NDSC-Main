// Signed, expiring session token for team members who log in with the emailed
// password (S6). Sent by the client in the `x-team-token` header.
import { signPayload, verifyPayload } from './sign'

export const TEAM_TOKEN_TTL_SECONDS = 6 * 3600
type TeamTokenPayload = { p: 'team'; reg: string; tm: string; exp: number }

function assertSecret() {
  // Fail closed: never mint forgeable tokens with the hardcoded dev secret.
  if (process.env.NODE_ENV === 'production' && !process.env.SESSION_SECRET) {
    throw new Error('SESSION_SECRET must be set to issue team sessions.')
  }
}
export function issueTeamToken(registrationId: string, teamMemberId: string): string {
  assertSecret()
  const payload: TeamTokenPayload = { p: 'team', reg: registrationId, tm: teamMemberId, exp: Math.floor(Date.now() / 1000) + TEAM_TOKEN_TTL_SECONDS }
  return signPayload(payload)
}
export function verifyTeamToken(token: string | null | undefined): { registrationId: string; teamMemberId: string } | null {
  if (!token) return null
  assertSecret()
  const p = verifyPayload<TeamTokenPayload>(token)
  if (!p || p.p !== 'team' || !p.reg || !p.tm || typeof p.exp !== 'number') return null
  if (p.exp < Math.floor(Date.now() / 1000)) return null
  return { registrationId: p.reg, teamMemberId: p.tm }
}
