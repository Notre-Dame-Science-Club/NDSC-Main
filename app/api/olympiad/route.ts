import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'

// Public route — no auth required.
// Uses supabaseAdmin so it bypasses RLS (which restricts anon reads).
// GET (no params)  -> list of all active olympiads
// GET ?id=UUID      -> single olympiad by id (used by the activity dashboard
//                      to fetch relay/subject/scheduling info for a linked olympiad)
export async function GET(req: NextRequest) {
  const id = req.nextUrl.searchParams.get('id')

  if (id) {
    const { data, error } = await supabaseAdmin
      .from('olympiads')
      .select('*')
      .eq('id', id)
      .single()
    if (error || !data) return apiError('Olympiad not found.', 404)
    return apiOk({ olympiad: data })
  }

  const { data, error } = await supabaseAdmin
    .from('olympiads')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) return apiError(error, 400)
  return apiOk(data)
}
