import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'

async function isAdmin() {
  const cookieStore = await cookies()
  return !!cookieStore.get('admin_session')
}

// GET ?sessionId=UUID — every registrant across the whole category tree for
// this Activity session, with a breadcrumb showing exactly which category
// they registered under. Deliberately does NOT include submission file
// content or exam answers/marks — that view belongs on the Olympiad admin
// page / organizer page for online leaves, this is just "who registered
// for what" so nothing duplicates between the two admin surfaces.
export async function GET(req: NextRequest) {
  if (!(await isAdmin())) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const sessionId = req.nextUrl.searchParams.get('sessionId')
  if (!sessionId) return NextResponse.json({ error: 'sessionId is required.' }, { status: 400 })

  const { data: categories, error: catError } = await supabaseAdmin
    .from('activity_reg_categories')
    .select('id, name, parent_id, is_online_submission')
    .eq('activity_session_id', sessionId)

  if (catError) return NextResponse.json({ error: catError.message }, { status: 400 })

  const catById = new Map((categories || []).map(c => [c.id, c]))
  const breadcrumbFor = (categoryId: string) => {
    const names: string[] = []
    let node: any = catById.get(categoryId)
    while (node) { names.unshift(node.name); node = node.parent_id ? catById.get(node.parent_id) : null }
    return names
  }

  const { data: registrations, error: regError } = await supabaseAdmin
    .from('activity_registrations')
    .select('id, category_id, full_name, phone, email, college, college_roll, hsc_session, team_members, payment_status, created_at')
    .eq('activity_session_id', sessionId)
    .order('created_at', { ascending: false })

  if (regError) return NextResponse.json({ error: regError.message }, { status: 400 })

  const result = (registrations || []).map(r => ({
    ...r,
    breadcrumb: breadcrumbFor(r.category_id),
    is_online_category: catById.get(r.category_id)?.is_online_submission || false,
    team_size: 1 + ((r.team_members as any[]) || []).length,
  }))

  return NextResponse.json({ registrations: result })
}
