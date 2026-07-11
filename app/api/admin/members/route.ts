import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

// Replaces the old server-component-with-form-POST pattern in
// app/admin/members/page.tsx with a proper client-side fetch flow, consistent
// with how the Olympiads/Announcements admin pages already work — and
// crucially, this uses supabaseAdmin (service-role, bypasses RLS) for every
// read/write, the same fix already applied to the Olympiads admin page
// earlier for the same root-cause reason (the anon client silently failing
// writes when no RLS policy permits them).

export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { data, error } = await supabaseAdmin
    .from('members')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return apiError(error, 400)
  return apiOk({ members: data || [] })
}

export async function PUT(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  if (!body || !body.id) {
    return apiError('A member id is required.', 400)
  }
  const { id, ...rest } = body

  const { data, error } = await supabaseAdmin
    .from('members')
    .update(rest)
    .eq('id', id)
    .select()
    .single()

  if (error) return apiError(error, 400)
  return apiOk({ member: data })
}

// Lets an admin add a new achievement directly to a member's profile,
// pre-approved (skipping the pending-review step a member's own
// self-submitted achievement goes through via /api/member-achievements).
export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  if (!body || !body.member_id || !body.title?.trim()) {
    return apiError('member_id and title are required.', 400)
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from('members')
    .select('achievements')
    .eq('id', body.member_id)
    .single()

  if (memberError || !member) {
    return apiError('Member not found.', 404)
  }

  const newAchievement = {
    id: Math.random().toString(36).slice(2, 9),
    title: body.title.trim(),
    description: body.description?.trim() || undefined,
    image_url: body.image_url || undefined,
    status: 'approved' as const, // admin-added achievements skip the review queue
    created_at: new Date().toISOString(),
  }

  const achievements = [...(member.achievements || []), newAchievement]

  const { error: updateError } = await supabaseAdmin
    .from('members')
    .update({ achievements })
    .eq('id', body.member_id)

  if (updateError) return apiError(updateError, 400)
  return apiOk({ achievements })
}

// "Cancel membership" — distinct from the existing Revoke (is_verified =
// false, which keeps all data and just blocks login). This is the hard,
// irreversible version: removes the members row AND the underlying
// Supabase Auth user, so the person could sign up again from scratch if
// they wanted to. Confirmed with the user this is meant to be a full,
// permanent delete, not a soft toggle.
export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  if (!body || !body.id) {
    return apiError('A member id is required.', 400)
  }

  const { error: dbError } = await supabaseAdmin
    .from('members')
    .delete()
    .eq('id', body.id)

  if (dbError) return apiError(dbError, 400)

  // Best-effort — if the auth user is already gone for some reason, don't
  // fail the whole cancellation just because of that.
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(body.id)
  if (authError) {
    return apiOk({
      success: true,
      warning: `Member record deleted, but the login account could not be removed: ${authError.message}`,
    })
  }

  return apiOk({ success: true })
}
