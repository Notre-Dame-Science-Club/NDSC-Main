import { supabase } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { normalizeUploadUrl } from '@/lib/uploadUrl'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category')
  const latest = searchParams.get('latest')

  let query = supabase
    .from('publications')
    .select('*')
    .eq('is_published', true)
    .order('published_year', { ascending: false })
    .order('created_at', { ascending: false })

  if (category) query = query.eq('category', category)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 400 })

  // Normalize URLs
  const normalized = (data || []).map((p: any) => ({
    ...p,
    cover_image_url: normalizeUploadUrl(p.cover_image_url),
    pdf_url: normalizeUploadUrl(p.pdf_url),
  }))

  if (latest === 'true' && !category) {
    const seen = new Set<string>()
    const filtered = normalized.filter((p: any) => {
      if (seen.has(p.category)) return false
      seen.add(p.category)
      return true
    })
    return NextResponse.json(filtered)
  }

  return NextResponse.json(normalized)
}
