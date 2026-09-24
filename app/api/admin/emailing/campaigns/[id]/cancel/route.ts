import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

type RouteContext = { params: Promise<{ id: string }> }

// POST /api/admin/emailing/campaigns/[id]/cancel
export async function POST(_req: Request, context: RouteContext) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { id } = await context.params

  // Only allow canceling draft or scheduled campaigns
  const { data: campaign, error } = await supabaseAdmin
    .from('email_campaigns')
    .select('status')
    .eq('id', id)
    .single()

  if (error) return apiError(error, 404)
  if (!['draft', 'scheduled'].includes(campaign.status)) {
    return apiError('Can only cancel draft or scheduled campaigns', 400)
  }

  const { error: updateError } = await supabaseAdmin
    .from('email_campaigns')
    .update({ status: 'cancelled' })
    .eq('id', id)

  if (updateError) return apiError(updateError)

  return apiOk({ success: true })
}
