import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

/**
 * The 14 slots are seeded once by the migration and never added to or
 * removed from here — the content they belong to is fixed in
 * app/_components/home2/glanceGalleryContent.ts. This route only ever
 * updates a row's photo, focal points, link and active flag, addressed by
 * slot_key (not id), so the admin page never has to know the row's uuid.
 */
export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { data, error } = await supabaseAdmin.from('glance_gallery').select('*')
  if (error) return apiError(error, 400)
  return apiOk(data ?? [])
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const body = await req.json()
  const { slot_key, ...rest } = body
  if (!slot_key) return apiError('slot_key is required', 400)
  const { data, error } = await supabaseAdmin
    .from('glance_gallery')
    .update({ ...rest, updated_at: new Date().toISOString() })
    .eq('slot_key', slot_key)
    .select()
    .single()
  if (error) return apiError(error, 400)
  return apiOk(data)
}
