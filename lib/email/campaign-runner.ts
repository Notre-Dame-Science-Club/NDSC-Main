/**
 * lib/email/campaign-runner.ts — Campaign sending engine with quota management.
 *
 * Self-contained campaign processor. Implements daily quota reset (Asia/Dhaka
 * timezone), round-robin account selection, concurrency guards, and
 * continuation until the campaign completes.
 *
 * Continuation model: a single invocation loops internally (see
 * TIME_BUDGET_MS below) sending round after round until the campaign is
 * done, no account has capacity left, or the invocation's own time budget
 * runs out — instead of chaining further work across invocations with
 * `setTimeout`, which on Vercel's serverless runtime is not reliably
 * guaranteed to run once a response has already been returned. Callers that
 * fire this off without awaiting it (e.g. the "send now" API route) should
 * wrap the call in Next's `after()` so the platform keeps the invocation
 * alive to actually finish the loop; see app/api/admin/emailing/campaigns/route.ts.
 * If a campaign is left with pending recipients after the time budget runs
 * out (a very large send), it stays in 'sending' status and picking it back
 * up relies on something calling processAllCampaigns() again later — the
 * daily Vercel Cron backup (vercel.json; Hobby plan caps Cron at once/day,
 * so don't rely on it alone) and/or a free external scheduler (cron-job.org,
 * a GitHub Actions schedule, UptimeRobot, etc.) hitting
 * /api/cron/process-email-queue every few minutes, which isn't bound by
 * Vercel's own Cron frequency limits since it's just an ordinary HTTP
 * request to that route.
 */

import { supabaseAdmin } from '@/lib/supabase'
import { sendBrevoBatch } from './brevo'
import { decrypt } from '@/lib/crypto'

const MAX_RECIPIENTS_PER_RUN = 300

// Stay well under Vercel's function-duration ceiling (300s on Hobby as of
// writing) so there's headroom left for the final DB writes and lock
// release before the platform would hard-kill the invocation. Raise this
// (and the route's `maxDuration` config) together if sends are slower than
// expected in practice.
const TIME_BUDGET_MS = 45_000

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

type RoundResult =
  | { outcome: 'complete' }
  | { outcome: 'no_capacity' }
  | { outcome: 'sent_some' }

/**
 * Runs one distribute-and-send round: fetch accounts with capacity, fetch a
 * page of pending recipients, distribute them across accounts (respecting
 * daily_limit), send, and record results. Does not recurse or schedule
 * anything — the caller's loop decides whether to run another round.
 */
async function runOneRound(campaignId: string, campaign: any, maxRecipients: number): Promise<RoundResult> {
  // Fetch active accounts with remaining capacity, lowest sent_today first
  // (so sends fan out evenly rather than draining one account first).
  const { data: allAccounts, error: accountsError } = await supabaseAdmin
    .from('email_accounts')
    .select('*')
    .eq('is_active', true)
    .order('sent_today', { ascending: true })

  if (accountsError) {
    return { outcome: 'no_capacity' }
  }

  // Filter accounts with remaining capacity
  const accounts = allAccounts?.filter(acc => acc.sent_today < acc.daily_limit) || []

  if (accounts.length === 0) {
    // No accounts available — leave status as 'sending', will retry later
    return { outcome: 'no_capacity' }
  }

  // Fetch pending recipients
  const { data: recipients, error: recipientsError } = await supabaseAdmin
    .from('email_campaign_recipients')
    .select('*')
    .eq('campaign_id', campaignId)
    .eq('status', 'pending')
    .limit(maxRecipients)

  if (recipientsError || !recipients || recipients.length === 0) {
    return { outcome: 'complete' }
  }

  // Distribute recipients across accounts.
  //
  // IMPORTANT: `account.sent_today` here is the value freshly loaded from
  // the DB above and is intentionally left untouched — it's still needed as
  // the "original" value for the DB write after sending. Capacity during
  // distribution is tracked separately in `assignedThisRun`, keyed by
  // account id, so the account-selection loop can still respect
  // daily_limit without mutating `account.sent_today`.
  let accountIdx = 0
  const batches: { account: any; recipients: any[] }[] = []
  const assignedThisRun = new Map<string, number>()

  for (const recipient of recipients) {
    // Find an account with remaining capacity. If the current account is
    // full, advance to the next active one and retry this same recipient
    // against it (within this same pass) instead of dropping the
    // recipient for this run. Account fill/rotation order itself
    // (fill current to its limit, then move on) is unchanged.
    while (accountIdx < accounts.length) {
      const account = accounts[accountIdx]
      const alreadyAssigned = assignedThisRun.get(account.id) || 0
      const remaining = account.daily_limit - account.sent_today - alreadyAssigned

      if (remaining <= 0) {
        // This account is out of quota, move to next and keep trying
        // the same recipient.
        accountIdx++
        continue
      }

      // Add to this account's batch
      let batch = batches.find(b => b.account.id === account.id)
      if (!batch) {
        batch = { account, recipients: [] }
        batches.push(batch)
      }
      batch.recipients.push(recipient)
      assignedThisRun.set(account.id, alreadyAssigned + 1)
      break
    }

    if (accountIdx >= accounts.length) {
      // All accounts exhausted — stop here. Remaining recipients stay
      // 'pending' and will be picked up on the next round/invocation.
      break
    }
  }

  if (batches.length === 0) {
    return { outcome: 'no_capacity' }
  }

  // Send batches
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

    // Update account sent_today. `account.sent_today` was never mutated
    // above, so this is still the original persisted value — plus only the
    // successful sends from this batch, written once. Failed sends do not
    // consume quota.
    const sentThisBatch = results.filter(r => r.ok).length
    if (sentThisBatch > 0) {
      await supabaseAdmin
        .from('email_accounts')
        .update({ sent_today: account.sent_today + sentThisBatch })
        .eq('id', account.id)
    }
  }

  return { outcome: 'sent_some' }
}

/**
 * Processes a campaign: loops running rounds (see runOneRound) until the
 * campaign is fully sent, no account has remaining capacity, or this
 * invocation's time budget runs out.
 * Safe to call multiple times — uses processing_lock_at to prevent concurrent execution.
 */
export async function processCampaignBatch(campaignId: string, maxRecipients = MAX_RECIPIENTS_PER_RUN): Promise<void> {
  const startedAt = Date.now()

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
    // 2. Reset stale quotas (once per invocation is enough — rounds within
    // the same invocation happen within milliseconds of each other, so the
    // Dhaka date can't roll over between them in practice)
    await resetStaleQuotas()

    // 3. Keep running rounds until done, out of capacity, or time's up.
    while (true) {
      if (Date.now() - startedAt > TIME_BUDGET_MS) break

      const result = await runOneRound(campaignId, campaign, maxRecipients)
      if (result.outcome === 'complete' || result.outcome === 'no_capacity') break
      // 'sent_some' — loop again immediately for the next round, no delay
      // and no setTimeout: this invocation keeps working synchronously.
    }

    // 4. Recompute campaign counts
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
      // Still pending (out of capacity for now, or the time budget ran
      // out on a very large send) — update counts but keep status as
      // 'sending'. See the file-level comment for what picks this back up.
      await supabaseAdmin
        .from('email_campaigns')
        .update({
          sent_count: sentCount,
          failed_count: failedCount,
        })
        .eq('id', campaignId)
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
