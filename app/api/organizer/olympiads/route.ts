import { NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getOrganizerSession } from '@/lib/organizerAuth'

export const dynamic = 'force-dynamic'

export async function GET() {
  const session = await getOrganizerSession()
  if (!session || session.olympiadIds.length === 0) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data, error } = await supabaseAdmin
    .from('olympiads')
    .select('id, name, mode, questions')
    .in('id', session.olympiadIds)

  if (error) {
    return NextResponse.json({ error: 'Could not load olympiads.' }, { status: 500 })
  }

  return NextResponse.json({ olympiads: data || [] })
}
