import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

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
    if (error || !data) return NextResponse.json({ error: 'Olympiad not found.' }, { status: 404 })
    return NextResponse.json({ olympiad: data })
  }

  const { data, error } = await supabaseAdmin
    .from('olympiads')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
