import { authCookies } from '@/lib/config/site'
import { readSessionCookie } from '@/lib/api/session-cookie'

export type OrganizerSession = { olympiadIds: string[] }

export async function getOrganizerSession(): Promise<OrganizerSession | null> {
  const parsed = await readSessionCookie<OrganizerSession>(authCookies.organizer)
  if (!parsed || !Array.isArray(parsed.olympiadIds)) return null
  return parsed
}
