import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// Public route — the multi-layer category picker on the registration page
// fetches the tree through here. Safety check: only returns categories for
// a session that is actually upcoming AND has registration_enabled = true;
// otherwise a stale/disabled session's category tree (and any leaf field
// definitions) could be probed even after registration closed.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return NextResponse.json({ error: 'slug is required.' }, { status: 400 })

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('activity_sessions')
    .select('id, title, slug, is_upcoming, registration_enabled, registration_note')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (sessionError || !session) {
    return NextResponse.json({ error: 'Activity not found.' }, { status: 404 })
  }
  if (!session.is_upcoming || !session.registration_enabled) {
    return NextResponse.json({ error: 'Registration is not open for this activity.' }, { status: 403 })
  }

  const { data: categories, error: catError } = await supabaseAdmin
    .from('activity_reg_categories')
    .select('*')
    .eq('activity_session_id', session.id)
    .order('display_order', { ascending: true })

  if (catError) return NextResponse.json({ error: catError.message }, { status: 400 })

  return NextResponse.json({ session, categories: categories || [] })
}
