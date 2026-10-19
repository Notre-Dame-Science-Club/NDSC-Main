import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { encrypt, maskApiKey } from '@/lib/crypto'
import { cleanBaseUrl, PROVIDERS } from '@/lib/server/serviceCredentials'

export const dynamic = 'force-dynamic'
export const runtime = 'nodejs'

const present = (r: any) => ({
  id: r.id, provider: r.provider, label: r.label, base_url: r.base_url, is_active: r.is_active, is_auto: !!r.is_auto,
  token_masked: maskApiKey(r.token_encrypted), created_at: r.created_at,
})

// Tokens never leave the server: the list only carries a masked tail.
export async function GET() {
  const unauthorized = await requireAdmin(); if (unauthorized) return unauthorized
  const { data, error } = await supabaseAdmin.from('service_credentials').select('*').order('created_at', { ascending: false })
  if (error) return apiError(error)
  return apiOk({
    credentials: (data || []).map(present),
    env: { whatsapp: !!(process.env.WHATSAPP_SERVICE_URL && process.env.WHATSAPP_SERVICE_TOKEN) },
    autoRegister: !!process.env.SERVICE_REGISTER_SECRET,
  })
}

async function activate(id: string, provider: string) {
  await supabaseAdmin.from('service_credentials').update({ is_active: false }).eq('provider', provider).neq('id', id)
  return supabaseAdmin.from('service_credentials').update({ is_active: true, updated_at: new Date().toISOString() }).eq('id', id).select().single()
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin(); if (unauthorized) return unauthorized
  const b = await req.json().catch(() => ({}))
  const provider = String(b.provider || 'whatsapp')
  const label = String(b.label || '').trim()
  const base = cleanBaseUrl(String(b.base_url || ''))
  const token = String(b.token || '').trim()
  if (!(PROVIDERS as readonly string[]).includes(provider)) return apiError('Unknown provider')
  if (!label || !token) return apiError('Name and token are required')
  if (!base) return apiError('That URL does not look valid')

  const { data, error } = await supabaseAdmin.from('service_credentials')
    .insert({ provider, label, base_url: base, token_encrypted: encrypt(token), is_active: false }).select().single()
  if (error) return apiError(error)
  // The first one added for a provider becomes active automatically.
  const { count } = await supabaseAdmin.from('service_credentials').select('id', { count: 'exact', head: true }).eq('provider', provider)
  if ((count ?? 0) <= 1 || b.make_active) { const r = await activate(data.id, provider); if (r.data) return apiOk({ credential: present(r.data) }) }
  return apiOk({ credential: present(data) })
}

export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAdmin(); if (unauthorized) return unauthorized
  const b = await req.json().catch(() => ({}))
  if (!b.id) return apiError('Missing id')
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() }
  if (b.label !== undefined) { const l = String(b.label).trim(); if (!l) return apiError('Name cannot be empty'); updates.label = l }
  if (b.base_url !== undefined) { const u = cleanBaseUrl(String(b.base_url)); if (!u) return apiError('That URL does not look valid'); updates.base_url = u }
  if (b.token) updates.token_encrypted = encrypt(String(b.token).trim())   // blank = keep the saved token
  const { data, error } = await supabaseAdmin.from('service_credentials').update(updates).eq('id', b.id).select().single()
  if (error) return apiError(error)
  if (b.is_active === true) { const r = await activate(data.id, data.provider); if (r.data) return apiOk({ credential: present(r.data) }) }
  if (b.is_active === false) { const r = await supabaseAdmin.from('service_credentials').update({ is_active: false }).eq('id', b.id).select().single(); if (r.data) return apiOk({ credential: present(r.data) }) }
  return apiOk({ credential: present(data) })
}

export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin(); if (unauthorized) return unauthorized
  const id = new URL(req.url).searchParams.get('id')
  if (!id) return apiError('Missing id')
  const { error } = await supabaseAdmin.from('service_credentials').delete().eq('id', id)
  if (error) return apiError(error)
  return apiOk({ ok: true })
}
