import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

// Read-only feed for the "Manage Accounts" overview + CSV export. Returns every website
// account with only the columns the admin needs (no password hashes, no slip URLs).
// PostgREST caps a single response (1000 rows by default), so page through the table.

const COLUMNS =
  'id, full_name, email, phone, institution, college_roll, batch, department, hsc_session, ndsc_id, membership_status, is_verified, education_level, created_at'
const PAGE = 1000

export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const all: any[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabaseAdmin
      .from('users')
      .select(COLUMNS)
      .order('created_at', { ascending: false })
      .order('id')
      .range(from, from + PAGE - 1)
    if (error) return apiError(error, 400)
    all.push(...(data || []))
    if (!data || data.length < PAGE) break
  }
  return apiOk({ accounts: all })
}
