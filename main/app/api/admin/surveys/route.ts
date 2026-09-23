import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

// Mirrors app/api/admin/olympiads/route.ts's shape exactly (bare array /
// bare row, id-in-body for PUT/DELETE) — surveys are a sibling resource.

export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { data, error } = await supabaseAdmin
    .from('surveys')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return apiError(error, 400)

  // Response counts, one query for all surveys rather than N+1.
  const ids = (data || []).map((s: any) => s.id)
  let counts: Record<string, number> = {}
  if (ids.length > 0) {
    const { data: responses } = await supabaseAdmin
      .from('survey_responses')
      .select('survey_id')
      .in('survey_id', ids)
    counts = (responses || []).reduce((acc: Record<string, number>, r: any) => {
      acc[r.survey_id] = (acc[r.survey_id] || 0) + 1
      return acc
    }, {})
  }

  return apiOk((data || []).map((s: any) => ({ ...s, response_count: counts[s.id] || 0 })))
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json()
  if (!body.title?.trim()) return apiError('Title is required.', 400)
  const { data, error } = await supabaseAdmin
    .from('surveys')
    .insert({ ...body, updated_at: new Date().toISOString() })
    .select()
    .single()
  if (error) return apiError(error, 400)
  return apiOk(data)
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json()
  const { id, ...rest } = body
  if (!id) return apiError('Missing id', 400)
  const { data, error } = await supabaseAdmin
    .from('surveys')
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq('id', id)
    .select()
    .single()
  if (error) return apiError(error, 400)
  return apiOk(data)
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await req.json()
  if (!id) return apiError('Missing id', 400)
  await supabaseAdmin.from('survey_responses').delete().eq('survey_id', id)
  const { error } = await supabaseAdmin.from('surveys').delete().eq('id', id)
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
