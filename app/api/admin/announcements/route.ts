import { supabaseAdmin } from '@/lib/supabase'

import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { data, error } = await supabaseAdmin
    .from('announcements')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(50)
  if (error) return apiError(error, 400)
  return apiOk(data)
}
