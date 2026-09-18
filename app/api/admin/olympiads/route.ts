import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { data, error } = await supabaseAdmin
    .from('olympiads')
    .select('*')
    .order('created_at', { ascending: false })
  if (error) return apiError(error, 400)
  return apiOk(data)
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json()
  const { data, error } = await supabaseAdmin
    .from('olympiads')
    .insert(body)
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
    .from('olympiads')
    .update(rest)
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
  // Delete registrations first (foreign key constraint)
  await supabaseAdmin.from('olympiad_registrations').delete().eq('olympiad_id', id)
  // Delete the form_graph and its nodes (orphan graph would keep serving the public form)
  const { data: graphs } = await supabaseAdmin
    .from('form_graphs')
    .select('id')
    .eq('owner_kind', 'olympiad')
    .eq('owner_id', id)
  if (graphs && graphs.length > 0) {
    for (const g of graphs) {
      await supabaseAdmin.from('form_nodes').delete().eq('graph_id', g.id)
    }
    await supabaseAdmin.from('form_graphs').delete().eq('owner_kind', 'olympiad').eq('owner_id', id)
  }
  const { error } = await supabaseAdmin.from('olympiads').delete().eq('id', id)
  if (error) return apiError(error, 400)
  return apiOk({ success: true })
}
