import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, after } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { resolveAudience, type EmailAudienceFilters } from '@/lib/email/audience'
import { processCampaignBatch } from '@/lib/email/campaign-runner'

// Give this route enough wall-clock time to actually finish sending (see
// campaign-runner.ts's TIME_BUDGET_MS) — otherwise the platform can kill the
// invocation mid-send. 60s comfortably covers TIME_BUDGET_MS (45s) plus the
// lock/count DB round-trips before and after. Raise both together if needed;
// Hobby's ceiling is 300s.
export const maxDuration = 60

// GET /api/admin/emailing/campaigns — list campaigns with pagination
export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(req.url)
  const page = parseInt(searchParams.get('page') || '1')
  const limit = parseInt(searchParams.get('limit') || '20')
  const offset = (page - 1) * limit

  const { data: campaigns, error } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1)

  if (error) return apiError(error)

  const { count } = await supabaseAdmin
    .from('email_campaigns')
    .select('*', { count: 'exact', head: true })

  return apiOk({ campaigns, total: count || 0 })
}

// POST /api/admin/emailing/campaigns — create and optionally send/schedule
export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => ({}))
  const {
    name,
    subject,
    body_html,
    audience_source,
    audience_filters,
    scheduled_at,
    send_now,
  } = body as {
    name: string
    subject: string
    body_html: string
    audience_source: 'members' | 'users' | 'both'
    audience_filters: EmailAudienceFilters
    scheduled_at?: string
    send_now?: boolean
  }

  if (!name || !subject || !body_html || !audience_source) {
    return apiError('Missing required fields: name, subject, body_html, audience_source')
  }

  // Resolve audience
  const recipients = await resolveAudience(audience_source, audience_filters || {})

  if (recipients.length === 0) {
    return apiError('No recipients match the selected audience filters', 400)
  }

  // Create campaign
  const status = send_now ? 'sending' : scheduled_at ? 'scheduled' : 'draft'
  const { data: campaign, error: campaignError } = await supabaseAdmin
    .from('email_campaigns')
    .insert({
      name,
      subject,
      body_html,
      audience_source,
      audience_filters: audience_filters || {},
      status,
      scheduled_at: scheduled_at || null,
      total_recipients: recipients.length,
    })
    .select()
    .single()

  if (campaignError) return apiError(campaignError)

  // Insert recipients
  const recipientRows = recipients.map(r => ({
    campaign_id: campaign.id,
    email: r.email,
    name: r.name,
    source: r.source,
    source_id: r.source_id,
    status: 'pending',
  }))

  const { error: recipientsError } = await supabaseAdmin
    .from('email_campaign_recipients')
    .insert(recipientRows)

  if (recipientsError) return apiError(recipientsError)

  // If send_now, kick off the first batch. Wrapped in `after()` so the
  // platform keeps this invocation alive to actually run it, even though we
  // return the API response immediately — a bare unawaited call (or
  // setTimeout) isn't reliably guaranteed to run once the response has been
  // sent on Vercel's serverless runtime. `after()` is a Next.js/runtime
  // primitive, unrelated to (and not limited by) Vercel Cron's plan-based
  // frequency cap.
  if (send_now) {
    after(() => processCampaignBatch(campaign.id).catch(err => {
      console.error('Error processing campaign batch:', err)
    }))
  }

  return apiOk({ campaign })
}
