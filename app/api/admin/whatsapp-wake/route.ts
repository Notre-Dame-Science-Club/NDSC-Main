import { requireAdmin } from '@/lib/api/admin-auth'
import { apiOk } from '@/lib/api/response'
import { getServiceConfig } from '@/lib/server/serviceCredentials'

// Admin-only "is the WhatsApp service awake?" check. Hitting it also wakes a sleeping
// host (Render free services sleep after 15 min idle and take about a minute to start),
// because it sends a real request to the service's /healthz.
//   state: 'unconfigured' | 'awake' | 'waking'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const cfg = await getServiceConfig('whatsapp')
  if (!cfg) return apiOk({ state: 'unconfigured' })
  try {
    const r = await fetch(`${cfg.base}/healthz`, { cache: 'no-store', signal: AbortSignal.timeout(8_000) })
    const type = r.headers.get('content-type') || ''
    return apiOk({ state: r.ok && type.includes('json') ? 'awake' : 'waking' })
  } catch {
    return apiOk({ state: 'waking' })
  }
}
