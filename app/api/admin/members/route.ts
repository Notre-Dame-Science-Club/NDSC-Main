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
