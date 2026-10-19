import { NextRequest } from 'next/server'
import { timingSafeEqual } from 'crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, apiOk } from '@/lib/api/response'
import { encrypt } from '@/lib/crypto'
import { cleanBaseUrl, PROVIDERS } from '@/lib/server/serviceCredentials'

// Called by the WhatsApp service itself every time it starts (e.g. after Render wakes it):
// it announces its public URL and API token so nobody has to copy them into the admin panel.
// Authenticated with a shared bootstrap secret (SERVICE_REGISTER_SECRET on the website,
// NDSC_REGISTER_SECRET on the service), not an admin session.
//
// The registered entry is stored encrypted like any other credential, labelled "Auto".
// It becomes the one in use unless an admin has deliberately picked a manual credential.

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

function secretOk(req: NextRequest): boolean {
  const want = process.env.SERVICE_REGISTER_SECRET
  if (!want || want.length < 16) return false
  const given = Buffer.from(req.headers.get('authorization') || '')
  const exp = Buffer.from(`Bearer ${want}`)
  return given.length === exp.length && timingSafeEqual(given, exp)
}

export async function POST(req: NextRequest) {
  if (!process.env.SERVICE_REGISTER_SECRET) return apiError('Auto-registration is not enabled on this site.', 404)
  if (!secretOk(req)) return apiError('Unauthorized', 401)

  const b = await req.json().catch(() => ({}))
  const provider = String(b.provider || 'whatsapp')
  const token = String(b.token || '').trim()
  const base = cleanBaseUrl(String(b.base_url || ''))
  if (!(PROVIDERS as readonly string[]).includes(provider)) return apiError('Unknown provider')
  if (!base || !token) return apiError('base_url and token are required')
  // Only https (or a local address for development) so the token is never sent in clear over the internet.
  const host = new URL(base)
  const local = ['localhost', '127.0.0.1'].includes(host.hostname)
  if (host.protocol !== 'https:' && !local) return apiError('base_url must be https')

  const row = { base_url: base, token_encrypted: encrypt(token), updated_at: new Date().toISOString() }
  const { data: existing } = await supabaseAdmin.from('service_credentials').select('id').eq('provider', provider).eq('is_auto', true).maybeSingle()
  let id = existing?.id as string | undefined
  if (id) {
    const { error } = await supabaseAdmin.from('service_credentials').update(row).eq('id', id)
    if (error) return apiError(error)
  } else {
    const { data, error } = await supabaseAdmin.from('service_credentials')
      .insert({ provider, label: 'Auto (registered by the service)', is_auto: true, is_active: false, ...row }).select('id').single()
    if (error) return apiError(error)
    id = data.id
  }

  // Make it the one in use, unless a manually added credential is currently active.
  const { data: active } = await supabaseAdmin.from('service_credentials').select('id, is_auto').eq('provider', provider).eq('is_active', true).maybeSingle()
  let inUse = active?.id === id
  if (!active) {
    await supabaseAdmin.from('service_credentials').update({ is_active: true }).eq('id', id)
    inUse = true
  }
  return apiOk({ ok: true, in_use: inUse })
}
