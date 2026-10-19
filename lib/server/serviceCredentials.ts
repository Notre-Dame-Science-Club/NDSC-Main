import { supabaseAdmin } from '@/lib/supabase'
import { decrypt } from '@/lib/crypto'

export const PROVIDERS = ['whatsapp'] as const
export type Provider = (typeof PROVIDERS)[number]

/** Normalises a user-typed URL: trims, adds http:// when missing, drops trailing slashes. */
export function cleanBaseUrl(raw: string): string | null {
  let v = (raw || '').trim()
  if (!v) return null
  if (!/^https?:\/\//i.test(v)) v = 'http://' + v
  try {
    const u = new URL(v)
    return (u.origin + u.pathname).replace(/\/+$/, '')
  } catch { return null }
}

/**
 * The URL + token the proxy should use for a provider: the active credential
 * saved in the admin panel, else the environment variables.
 */
export async function getServiceConfig(provider: Provider = 'whatsapp'): Promise<{ base: string; token: string; source: 'admin' | 'env' } | null> {
  const { data } = await supabaseAdmin
    .from('service_credentials')
    .select('base_url, token_encrypted')
    .eq('provider', provider).eq('is_active', true)
    .maybeSingle()
  if (data?.base_url && data.token_encrypted) {
    try { return { base: data.base_url.replace(/\/+$/, ''), token: decrypt(data.token_encrypted), source: 'admin' } } catch { /* fall through to env */ }
  }
  const base = process.env.WHATSAPP_SERVICE_URL?.replace(/\/+$/, '')
  const token = process.env.WHATSAPP_SERVICE_TOKEN
  return provider === 'whatsapp' && base && token ? { base, token, source: 'env' } : null
}
