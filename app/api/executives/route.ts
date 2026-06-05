import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// GET /api/executives?panel=committee|moderators
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const panel = searchParams.get('panel') // 'committee' | 'moderators' | null for all

  let query = supabaseAdmin
    .from('executives')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (panel) query = query.eq('panel', panel)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json(data ?? [])
}
