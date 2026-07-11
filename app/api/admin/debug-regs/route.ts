import { supabaseAdmin } from '@/lib/supabase'
import { apiOk } from '@/lib/api/response'
import { requireAdmin } from '@/lib/api/admin-auth'

// Temporary diagnostic route for the olympiad-registrations data pipeline.
// Gated behind admin auth (previously computed the admin flag but never
// actually enforced it, so this was reachable by anyone) — remove once the
// underlying data issue is confirmed fixed.
export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const envCheck = {
    hasUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
    hasAnon: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    hasServiceKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
  }

  const { data: allRegs, error: allError } = await supabaseAdmin
    .from('olympiad_registrations')
    .select('id, full_name, olympiad_id, created_at')
    .limit(20)

  const { data: allOlympiads, error: olympError } = await supabaseAdmin
    .from('olympiads')
    .select('id, name, is_active')
    .limit(10)

  return apiOk({
    envCheck,
    registrations: { data: allRegs, error: allError?.message },
    olympiads: { data: allOlympiads, error: olympError?.message },
  })
}
