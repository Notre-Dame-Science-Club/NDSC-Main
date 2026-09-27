import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

type Ctx = { params: Promise<{ id: string; recipientId: string }> }

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id, recipientId } = await ctx.params

  const { error } = await supabaseAdmin
    .from('certificate_recipients')
    .delete()
    .eq('id', recipientId)
    .eq('certificate_id', id)
  if (error) return apiError(error, 400)

  return apiOk({ deleted: true })
}
