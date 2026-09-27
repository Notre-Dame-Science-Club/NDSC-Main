import { cookies } from 'next/headers'

export type OrganizerSession = { olympiadIds: string[] }

export async function getOrganizerSession(): Promise<OrganizerSession | null> {
  const cookieStore = await cookies()
  const raw = cookieStore.get('organizer_session')?.value
  if (!raw) return null
  try {
    const parsed = JSON.parse(raw)
    if (!Array.isArray(parsed.olympiadIds)) return null
    return parsed as OrganizerSession
  } catch {
    return null
  }
}
