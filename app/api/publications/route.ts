import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const latest = searchParams.get('latest') === 'true'
  const category = searchParams.get('category')

  let query = supabaseAdmin
    .from('publications')
    .select('*')
    .eq('is_published', true)
    .order('published_year', { ascending: false })
    .order('created_at', { ascending: false })

  if (category) {
    query = query.eq('category', category)
  }

  const { data, error } = await query
  if (error) return apiError(error, 400)

  if (latest && !category) {
    // প্রতিটি category থেকে সর্বশেষ একটি করে return করো
    const seen = new Set<string>()
    const result = (data || []).filter((pub: any) => {
      if (seen.has(pub.category)) return false
      seen.add(pub.category)
      return true
    })
    return apiOk(result)
  }

  return apiOk(data || [])
}
