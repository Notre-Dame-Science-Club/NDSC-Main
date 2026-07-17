import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiBadRequest, apiError, apiOk } from '@/lib/api/response'

// Public, read-only lookup for a session's per-event appearance row.
// Used by the public register page (app/activities/[slug]/register/page.tsx)
// to read title/subtitle/cover/bg/font/contacts/auto-pulls — the same
// data that used to come from form_configs where form_key =
// 'activity_register:<sessionId>'. No admin check: an anonymous visitor
// filling out the form is exactly who this is for.
export async function GET(req: NextRequest) {
  const sessionId = req.nextUrl.searchParams.get('session_id')
  if (!sessionId) return apiBadRequest('session_id is required.')

  const { data, error } = await supabaseAdmin
    .from('activity_session_form_appearance')
    .select('*')
    .eq('session_id', sessionId)
    .maybeSingle()

  if (error) return apiError(error, 400)
  return apiOk({ appearance: data })
}
