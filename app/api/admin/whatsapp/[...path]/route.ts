import { NextRequest, NextResponse } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError } from '@/lib/api/response'
import { getServiceConfig } from '@/lib/server/serviceCredentials'

// Admin-only proxy to the WhatsApp sender service (services/whatsapp-bulk).
// That service keeps WhatsApp sockets open, which a serverless host can't do,
// so it runs as its own process. The browser never sees its address or token:
// we check the admin session here, then forward with the shared secret.
//
// URL + token come from Admin → Credentials (active entry); the env vars below
// are only a fallback when nothing is saved there:
//   WHATSAPP_SERVICE_URL=http://127.0.0.1:3100
//   WHATSAPP_SERVICE_TOKEN=<same value as WA_API_TOKEN on the service>

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

type Ctx = { params: Promise<{ path: string[] }> }

async function forward(req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const cfg = await getServiceConfig('whatsapp')
  if (!cfg) {
    return apiError('WhatsApp service is not configured. Add its URL and token under Admin → Credentials.', 503)
  }
  const { base, token } = cfg

  const { path } = await ctx.params
  const target = `${base}/${path.map(encodeURIComponent).join('/')}${req.nextUrl.search}`

  const headers: Record<string, string> = { authorization: `Bearer ${token}` }
  const ct = req.headers.get('content-type')
  if (ct) headers['content-type'] = ct

  let body: ArrayBuffer | undefined
  if (req.method !== 'GET' && req.method !== 'HEAD') body = await req.arrayBuffer()

  try {
    const upstream = await fetch(target, { method: req.method, headers, body, cache: 'no-store', signal: AbortSignal.timeout(30_000) })
    // Render answers 502/503/504 (an HTML page, not our JSON) while a sleeping service is starting.
    const type = upstream.headers.get('content-type') || ''
    if ([502, 503, 504].includes(upstream.status) && !type.includes('json')) {
      return apiError('The WhatsApp service is waking up. This can take about a minute.', 503, { waking: true })
    }
    return new NextResponse(await upstream.arrayBuffer(), {
      status: upstream.status,
      headers: {
        'content-type': upstream.headers.get('content-type') || 'application/json',
        'cache-control': 'no-store',
      },
    })
  } catch {
    // Timeout / refused connection: on a sleeping host this is the cold start in progress.
    return apiError('Could not reach the WhatsApp service yet. It may be waking up.', 503, { waking: true })
  }
}

export const GET = forward
export const POST = forward
export const DELETE = forward
