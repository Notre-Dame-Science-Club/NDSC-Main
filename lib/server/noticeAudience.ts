// Server-only: loads the (id, institution, batch) of every account so the admin screens can
// answer "how many people would see this notice?" using the SAME matching code members hit
// (lib/notices.ts). PostgREST caps one response at 1000 rows, so page through the table.

import { supabaseAdmin } from '@/lib/supabase'
import type { AudienceUser } from '@/lib/notices'

const PAGE = 1000

export async function fetchAudienceUsers(): Promise<{ users: AudienceUser[]; error: unknown }> {
  const users: AudienceUser[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select('id, institution, batch')
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) return { users: [], error }
    users.push(...((data || []) as AudienceUser[]))
    if (!data || data.length < PAGE) break
  }
  return { users, error: null }
}
