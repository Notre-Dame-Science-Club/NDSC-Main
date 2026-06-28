import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

// Replaces the old server-component-with-form-POST pattern in
// app/admin/members/page.tsx with a proper client-side fetch flow, consistent
// with how the Olympiads/Announcements admin pages already work — and
// crucially, this uses supabaseAdmin (service-role, bypasses RLS) for every
// read/write, the same fix already applied to the Olympiads admin page
// earlier for the same root-cause reason (the anon client silently failing
// writes when no RLS policy permits them).

async function isAdmin() {
  const cookieStore = await cookies()
  return !!cookieStore.get('admin_session')
}

export async function GET() {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabaseAdmin
    .from('members')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ members: data || [] })
}

export async function PUT(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || !body.id) {
    return NextResponse.json({ error: 'A member id is required.' }, { status: 400 })
  }
  const { id, ...rest } = body

  const { data, error } = await supabaseAdmin
    .from('members')
    .update(rest)
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 400 })
  return NextResponse.json({ member: data })
}

// Lets an admin add a new achievement directly to a member's profile,
// pre-approved (skipping the pending-review step a member's own
// self-submitted achievement goes through via /api/member-achievements).
export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || !body.member_id || !body.title?.trim()) {
    return NextResponse.json({ error: 'member_id and title are required.' }, { status: 400 })
  }

  const { data: member, error: memberError } = await supabaseAdmin
    .from('members')
    .select('achievements')
    .eq('id', body.member_id)
    .single()

  if (memberError || !member) {
    return NextResponse.json({ error: 'Member not found.' }, { status: 404 })
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

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 400 })
  return NextResponse.json({ achievements })
}

// "Cancel membership" — distinct from the existing Revoke (is_verified =
// false, which keeps all data and just blocks login). This is the hard,
// irreversible version: removes the members row AND the underlying
// Supabase Auth user, so the person could sign up again from scratch if
// they wanted to. Confirmed with the user this is meant to be a full,
// permanent delete, not a soft toggle.
export async function DELETE(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => null)
  if (!body || !body.id) {
    return NextResponse.json({ error: 'A member id is required.' }, { status: 400 })
  }

  const { error: dbError } = await supabaseAdmin
    .from('members')
    .delete()
    .eq('id', body.id)

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 400 })

  // Best-effort — if the auth user is already gone for some reason, don't
  // fail the whole cancellation just because of that.
  const { error: authError } = await supabaseAdmin.auth.admin.deleteUser(body.id)
  if (authError) {
    return NextResponse.json({
      success: true,
      warning: `Member record deleted, but the login account could not be removed: ${authError.message}`,
    })
  }

  return NextResponse.json({ success: true })
}
