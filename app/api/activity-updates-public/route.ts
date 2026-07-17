import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'

// GET /api/activity-updates-public?sessionId=UUID — newest first, no auth
// (this is public event news, same trust level as the activity page itself)
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return apiError('sessionId is required.', 400)

  const { data, error } = await supabaseAdmin
    .from('activity_updates')
    .select('id, title, body, link_url, created_at')
    .eq('activity_session_id', sessionId)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return apiOk({ updates: [] })
  return apiOk({ updates: data ?? [] })
}
