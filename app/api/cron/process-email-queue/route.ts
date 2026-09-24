import { supabaseAdmin } from '@/lib/supabase'
import { apiError, apiOk } from '@/lib/api/response'
import { processCampaignBatch } from '@/lib/email/campaign-runner'

// GET /api/cron/process-email-queue — Vercel cron job handler
export async function GET(req: Request) {
  // Auth: Vercel Cron sends Authorization: Bearer $CRON_SECRET
  const authHeader = req.headers.get('authorization')
  const expectedAuth = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null

  if (!expectedAuth || authHeader !== expectedAuth) {
    return apiError('Unauthorized', 401)
  }

  // Find campaigns that need processing
  const { data: campaigns, error } = await supabaseAdmin
    .from('email_campaigns')
    .select('id, status, scheduled_at')
    .or('status.eq.sending,status.eq.scheduled')

  if (error) return apiError(error)

  const processed: string[] = []
  const now = new Date()

  for (const campaign of campaigns || []) {
    // Skip scheduled campaigns that aren't due yet
    if (campaign.status === 'scheduled' && campaign.scheduled_at) {
      if (new Date(campaign.scheduled_at) > now) continue
    }

    try {
      await processCampaignBatch(campaign.id)
      processed.push(campaign.id)
    } catch (err) {
      console.error(`Error processing campaign ${campaign.id}:`, err)
    }
  }

  return apiOk({ processed: processed.length, campaigns: processed })
}
