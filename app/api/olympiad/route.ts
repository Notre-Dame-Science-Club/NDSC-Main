import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

// Public route — no auth required.
// Uses supabaseAdmin so it bypasses RLS (which restricts anon reads).
// Only returns is_active=true olympiads — safe to expose publicly.
export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('olympiads')
    .select('*')
    .eq('is_active', true)
    .order('created_at', { ascending: false })
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data)
}
