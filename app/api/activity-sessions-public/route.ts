import { supabaseAdmin } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data, error } = await supabaseAdmin
    .from('activity_sessions')
    .select(`
      id, title, slug, cover_image_url, session_date,
      activity_types ( name, slug )
    `)
    .eq('is_published', true)
    .order('session_date', { ascending: false })
    .limit(25)

  if (error) return NextResponse.json([], { status: 200 })
  return NextResponse.json(data || [])
}