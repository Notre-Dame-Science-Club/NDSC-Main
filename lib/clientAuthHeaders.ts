// Client helper: headers proving who is calling (account bearer token and/or
// signed team-member token) to the segment-gated APIs.
import { supabase } from '@/lib/supabase'

export const teamTokenKey = (registrationId: string) => `ndsc_team_token:${registrationId}`

export async function segmentAuthHeaders(registrationId?: string | null): Promise<Record<string, string>> {
  const h: Record<string, string> = {}
  try {
    const { data } = await supabase.auth.getSession()
    if (data.session?.access_token) h['Authorization'] = `Bearer ${data.session.access_token}`
  } catch { /* anonymous */ }
  if (registrationId && typeof window !== 'undefined') {
    try {
      const t = window.sessionStorage.getItem(teamTokenKey(registrationId))
      if (t) h['x-team-token'] = t
    } catch { /* storage unavailable */ }
  }
  return h
}
