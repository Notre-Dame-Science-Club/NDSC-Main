import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { resolveAudience, type EmailAudienceFilters } from '@/lib/email/audience'
import { processCampaignBatch } from '@/lib/email/campaign-runner'

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

  // If send_now, kick off the first batch
  if (send_now) {
    // Run asynchronously, don't wait
    processCampaignBatch(campaign.id).catch(err => {
      console.error('Error processing campaign batch:', err)
    })
  }

  return apiOk({ campaign })
}
