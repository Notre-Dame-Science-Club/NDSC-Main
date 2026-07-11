import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'

// Member-facing route — a logged-in member adds their own achievement entry
// from the dashboard. This is intentionally separate from /api/admin/members
// (which is gated by the admin_session cookie and meant for admin use only).
// Here, identity comes from the member's own Supabase Auth access token,
// sent as a Bearer token since the Supabase JS session lives in localStorage
// on the client, not in an HTTP cookie the server would see automatically.
//
// New achievements are always inserted with status 'pending' — they only
// become publicly visible/featured once an admin approves them from the
// Members admin page's achievement moderation queue.

async function getMemberFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null

  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function POST(req: NextRequest) {
  const user = await getMemberFromRequest(req)
  if (!user) return apiError('Unauthorized. Please log in again.', 401)

  const body = await req.json().catch(() => null)
  if (!body || !body.title || !String(body.title).trim()) {
    return apiError('Title is required.', 400)
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from('members')
    .select('id, achievements')
    .eq('id', user.id)
    .single()

  if (memberError || !member) {
    return apiError('Member record not found.', 404)
  }

  const newAchievement = {
    id: Math.random().toString(36).slice(2, 9),
    title: String(body.title).trim(),
    description: body.description ? String(body.description).trim() : undefined,
    image_url: body.image_url || undefined,
    status: 'pending' as const,
    created_at: new Date().toISOString(),
  }

  const achievements = [...(member.achievements || []), newAchievement]

  const { error: updateError } = await supabaseAdmin
    .from('members')
    .update({ achievements })
    .eq('id', user.id)

  if (updateError) {
    return apiError(updateError, 400)
  }

  return apiOk({ achievements })
}
