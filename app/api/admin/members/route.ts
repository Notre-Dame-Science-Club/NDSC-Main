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

  // Lists every website account. `is_verified` / `membership_status` are kept in sync by the
  // DB from the `members` table (a row there == approved club member).
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, full_name, email, phone, batch, college_roll, ndsc_id, department, is_verified, stage, payment_slip_url, achievements, created_at, institution, education_level, membership_status')
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
  // Membership is no longer a plain column: approving/rejecting/revoking goes through the
  // `members` table (admin_set_membership). Everything else is a normal profile update.
  const { id, membership_status, is_verified, ...rest } = body

  let target: 'approved' | 'rejected' | 'none' | null = null
  if (membership_status === 'approved' || membership_status === 'rejected' || membership_status === 'none') {
    target = membership_status
  } else if (membership_status === undefined && typeof is_verified === 'boolean') {
    target = is_verified ? 'approved' : 'none'
  }

  if (Object.keys(rest).length > 0) {
    const { error: updateError } = await supabaseAdmin.from('users').update(rest).eq('id', id)
    if (updateError) return apiError(updateError, 400)
  }

  if (target) {
    const { data: current } = await supabaseAdmin
      .from('users')
      .select('membership_status')
      .eq('id', id)
      .single()

    if (current && current.membership_status !== target) {
      const { error: rpcError } = await supabaseAdmin.rpc('admin_set_membership', {
        p_user_id: id,
        p_status: target,
        p_admin: 'admin',
      })
      if (rpcError) return apiError(rpcError, 400)
    }
  }

  const { data, error } = await supabaseAdmin
    .from('users')
    .select()
    .eq('id', id)
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

  const newAchievement = {
    id: crypto.randomUUID(),
    title: body.title.trim(),
    description: body.description?.trim() || undefined,
    image_url: body.image_url || undefined,
    status: 'approved' as const, // admin-added achievements skip the review queue
    created_at: new Date().toISOString(),
  }

  // Use atomic JSONB append via Supabase RPC to avoid read-modify-write race
  const { data, error } = await supabaseAdmin.rpc('append_achievement', {
    member_id: body.member_id,
    achievement: newAchievement,
  })

  if (error) {
    // Fallback: if RPC doesn't exist, do a direct update with COALESCE
    const { data: member, error: memberError } = await supabaseAdmin
      .from('users')
      .select('achievements')
      .eq('id', body.member_id)
      .single()

    if (memberError || !member) {
      return apiError('Member not found.', 404)
    }

    const achievements = [...(member.achievements || []), newAchievement]
    const { error: updateError } = await supabaseAdmin
      .from('users')
      .update({ achievements })
      .eq('id', body.member_id)

    if (updateError) return apiError(updateError, 400)
    return apiOk({ achievements })
  }

  return apiOk({ achievements: data })
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

  // Delete auth user first — if this fails, abort. Otherwise we'd orphan
  // the login account (members row gone but user can still log in).
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(body.id)
  if (authError) {
    return apiError(`Could not delete login account: ${authError.message}`, 400)
  }

  // Cascades to the user's `members` row and membership applications
  const { error: dbError } = await supabaseAdmin
    .from('users')
    .delete()
    .eq('id', body.id)

  if (dbError) return apiError(dbError, 400)

  return apiOk({ success: true })
}
