import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getOrganizerSession } from '@/lib/organizerAuth'

export const dynamic = 'force-dynamic'

export async function GET(req: NextRequest) {
  const session = await getOrganizerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const olympiadId = req.nextUrl.searchParams.get('olympiadId')
  if (!olympiadId) return NextResponse.json({ error: 'olympiadId is required.' }, { status: 400 })

  // Make sure this organizer's session was actually granted access to this olympiad
  if (!session.olympiadIds.includes(olympiadId)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const { data, error } = await supabaseAdmin
    .from('olympiad_registrations')
    .select('*')
    .eq('olympiad_id', olympiadId)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Could not load registrations.' }, { status: 500 })
  }

  return NextResponse.json({ registrations: data || [] })
}
