/**
 * lib/email/campaign-runner.ts — Campaign sending engine with quota management.
 *
 * Self-contained campaign processor that doesn't depend on external cron jobs.
 * Implements daily quota reset (Asia/Dhaka timezone), round-robin account selection,
 * concurrency guards, and automatic continuation until campaign completes.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { sendBrevoBatch } from './brevo'
import { decrypt } from '@/lib/crypto'

const MAX_RECIPIENTS_PER_RUN = 300

/**
 * Resets sent_today counters for accounts whose quota_date is stale (not today in Asia/Dhaka).
 */
async function resetStaleQuotas(): Promise<void> {
  // Get current date in Asia/Dhaka
  const dhakaNow = new Date().toLocaleString('en-CA', { timeZone: 'Asia/Dhaka', year: 'numeric', month: '2-digit', day: '2-digit' })
  const todayDhaka = dhakaNow.split(',')[0] // 'YYYY-MM-DD' format

  await supabaseAdmin
    .from('email_accounts')
    .update({ sent_today: 0, quota_date: todayDhaka })
    .neq('quota_date', todayDhaka)
}

/**
 * Processes a batch of pending recipients for a campaign.
 * Safe to call multiple times — uses processing_lock_at to prevent concurrent execution.
 */
export async function processCampaignBatch(campaignId: string, maxRecipients = MAX_RECIPIENTS_PER_RUN): Promise<void> {
  // 1. Take a lock on the campaign (skip if already locked within last 2 minutes)
  const lockExpiry = new Date(Date.now() - 2 * 60 * 1000).toISOString()
  const { data: campaign, error: lockError } = await supabaseAdmin
    .from('email_campaigns')
    .select('*')
    .eq('id', campaignId)
    .or(`processing_lock_at.is.null,processing_lock_at.lt.${lockExpiry}`)
    .single()

  if (lockError || !campaign) {
    // Campaign is locked or doesn't exist
    return
  }

  // Only process if status is 'sending' or 'scheduled' and due now
  if (campaign.status === 'scheduled' && campaign.scheduled_at) {
    if (new Date(campaign.scheduled_at) > new Date()) {
      return // Not due yet
    }
    // Flip to sending
    await supabaseAdmin
      .from('email_campaigns')
      .update({ status: 'sending' })
      .eq('id', campaignId)
  } else if (campaign.status !== 'sending') {
    return // Not in a processable state
  }

  // Take the lock
  await supabaseAdmin
    .from('email_campaigns')
    .update({ processing_lock_at: new Date().toISOString() })
    .eq('id', campaignId)

  try {
    // 2. Reset stale quotas
    await resetStaleQuotas()

    // 3. Fetch active accounts with remaining capacity, sorted by capacity descending
    const { data: allAccounts, error: accountsError } = await supabaseAdmin
      .from('email_accounts')
      .select('*')
      .eq('is_active', true)
      .order('sent_today', { ascending: true }) // accounts with lower sent_today come first

    if (accountsError) {
      return
    }

    // Filter accounts with remaining capacity
    const accounts = allAccounts?.filter(acc => acc.sent_today < acc.daily_limit) || []

    if (!accounts || accounts.length === 0) {
      // No accounts available — leave status as 'sending', will retry later
      return
    }

    // 4. Fetch pending recipients
    const { data: recipients, error: recipientsError } = await supabaseAdmin
      .from('email_campaign_recipients')
      .select('*')
      .eq('campaign_id', campaignId)
      .eq('status', 'pending')
      .limit(maxRecipients)

    if (recipientsError || !recipients || recipients.length === 0) {
      // No pending recipients — mark campaign as complete
      const { data: stats } = await supabaseAdmin
        .from('email_campaign_recipients')
        .select('status')
        .eq('campaign_id', campaignId)

      const sentCount = stats?.filter(s => s.status === 'sent').length || 0
      const failedCount = stats?.filter(s => s.status === 'failed').length || 0
      const finalStatus = failedCount > 0 ? 'partially_sent' : 'sent'

      await supabaseAdmin
        .from('email_campaigns')
        .update({
          status: finalStatus,
          sent_at: new Date().toISOString(),
          sent_count: sentCount,
          failed_count: failedCount,
        })
        .eq('id', campaignId)

      return
    }

    // 5. Distribute recipients across accounts
    let accountIdx = 0
    const batches: { account: any; recipients: any[] }[] = []

    for (const recipient of recipients) {
      const account = accounts[accountIdx]
      const remaining = account.daily_limit - account.sent_today

      if (remaining <= 0) {
        // This account is out of quota, move to next
        accountIdx++
        if (accountIdx >= accounts.length) {
          // All accounts exhausted — stop here, will retry later
          break
        }
        continue
      }

      // Add to this account's batch
      let batch = batches.find(b => b.account.id === account.id)
      if (!batch) {
        batch = { account, recipients: [] }
        batches.push(batch)
      }
      batch.recipients.push(recipient)
      account.sent_today++ // increment locally for this run
    }

    // 6. Send batches
    for (const batch of batches) {
      const account = batch.account
      const apiKey = decrypt(account.api_key_encrypted)

      const results = await sendBrevoBatch(
        apiKey,
        { email: account.sender_email, name: account.sender_name },
        campaign.subject,
        campaign.body_html,
        batch.recipients.map((r: any) => ({ email: r.email, name: r.name || r.email }))
      )

      // Update recipients
      for (let i = 0; i < results.length; i++) {
        const result = results[i]
        const recipient = batch.recipients[i]

        await supabaseAdmin
          .from('email_campaign_recipients')
          .update({
            status: result.ok ? 'sent' : 'failed',
            email_account_id: account.id,
            error: result.error || null,
            sent_at: result.ok ? new Date().toISOString() : null,
          })
          .eq('id', recipient.id)
      }

      // Update account sent_today
      const sentThisBatch = results.filter(r => r.ok).length
      if (sentThisBatch > 0) {
        await supabaseAdmin
          .from('email_accounts')
          .update({ sent_today: account.sent_today + sentThisBatch })
          .eq('id', account.id)
      }
    }

    // 7. Recompute campaign counts
    const { data: stats } = await supabaseAdmin
      .from('email_campaign_recipients')
      .select('status')
      .eq('campaign_id', campaignId)

    const sentCount = stats?.filter(s => s.status === 'sent').length || 0
    const failedCount = stats?.filter(s => s.status === 'failed').length || 0
    const pendingCount = stats?.filter(s => s.status === 'pending').length || 0

    if (pendingCount === 0) {
      // All done
      const finalStatus = failedCount > 0 ? 'partially_sent' : 'sent'
      await supabaseAdmin
        .from('email_campaigns')
        .update({
          status: finalStatus,
          sent_at: new Date().toISOString(),
          sent_count: sentCount,
          failed_count: failedCount,
        })
        .eq('id', campaignId)
    } else {
      // Still pending — update counts but keep status as 'sending'
      await supabaseAdmin
        .from('email_campaigns')
        .update({
          sent_count: sentCount,
          failed_count: failedCount,
        })
        .eq('id', campaignId)

      // Continue processing if there are more recipients and we have capacity
      if (batches.length > 0) {
        // Schedule next batch asynchronously (don't wait)
        setTimeout(() => {
          processCampaignBatch(campaignId, maxRecipients).catch(err => {
            console.error(`Error processing next batch for campaign ${campaignId}:`, err)
          })
        }, 1000) // 1 second delay between batches
      }
    }
  } finally {
    // Clear the lock
    await supabaseAdmin
      .from('email_campaigns')
      .update({ processing_lock_at: null })
      .eq('id', campaignId)
  }
}

/**
 * Process all active campaigns (sending or scheduled and due).
 * Can be called manually or from a cron job.
 */
export async function processAllCampaigns(): Promise<{ processed: number; campaigns: string[] }> {
  const { data: campaigns, error } = await supabaseAdmin
    .from('email_campaigns')
    .select('id, status, scheduled_at')
    .or('status.eq.sending,status.eq.scheduled')

  if (error) {
    console.error('Error fetching campaigns:', error)
    return { processed: 0, campaigns: [] }
  }

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

  return { processed: processed.length, campaigns: processed }
}
