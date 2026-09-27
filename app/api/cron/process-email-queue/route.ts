import { apiError, apiOk } from '@/lib/api/response'
import { processAllCampaigns } from '@/lib/email/campaign-runner'

// Multiple campaigns can be in 'sending' state at once, and each can run up
// to campaign-runner's TIME_BUDGET_MS (45s). Give this route enough room to
// awaited-process all of them in one invocation. Hobby's ceiling is 300s.
export const maxDuration = 300

/**
 * GET /api/cron/process-email-queue — Optional cron job handler
 *
 * This endpoint is OPTIONAL. The email system is self-processing and will
 * continue sending batches automatically once started. This endpoint can be
 * used as a backup to pick up any campaigns that may have stopped (e.g., due
 * to server restart).
 *
 * Can be called by:
 * - Vercel Cron (with CRON_SECRET auth)
 * - Any external cron service
 * - Manually for testing (no auth required in development)
 */
export async function GET(req: Request) {
  // Auth: Optional CRON_SECRET for production
  const authHeader = req.headers.get('authorization')
  const expectedAuth = process.env.CRON_SECRET ? `Bearer ${process.env.CRON_SECRET}` : null

  // In production, require auth if CRON_SECRET is set
  if (expectedAuth && authHeader !== expectedAuth) {
    return apiError('Unauthorized', 401)
  }

  const result = await processAllCampaigns()

  return apiOk(result)
}
