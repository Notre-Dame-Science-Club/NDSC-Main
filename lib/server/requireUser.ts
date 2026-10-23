import type { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getBearerFromAuthHeader } from '@/lib/localAuth'

/**
 * Resolves the signed-in caller from the Authorization bearer token and returns their user id
 * (or null). Same mechanism as /api/member-profile: supabaseAdmin.auth.getUser(token). With
 * SUPABASE_ENV=local the fetch shim in lib/supabase.ts routes that call to /api/auth/local-verify,
 * so local dev keeps working. Never trust a member_id / sender_id sent by the client; use this.
 */
export async function getCallerId(req: NextRequest | Request): Promise<string | null> {
  const token = getBearerFromAuthHeader(req.headers.get('authorization'))
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  return error || !data?.user ? null : data.user.id
}
