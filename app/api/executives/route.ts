import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeUploadUrl } from '@/lib/uploadUrl'

// GET /api/executives?panel=committee|moderators|founder
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const panel = searchParams.get('panel')

  let query = supabaseAdmin
    .from('executives')
    .select('*')
    .eq('is_active', true)
    .order('display_order', { ascending: true })

  if (panel) query = query.eq('panel', panel)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  const normalized = (data ?? []).map((e: any) => ({
    ...e,
    photo_url: normalizeUploadUrl(e.photo_url),
  }))

  return NextResponse.json(normalized)
}
