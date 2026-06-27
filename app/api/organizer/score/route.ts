import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { getOrganizerSession } from '@/lib/organizerAuth'

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const session = await getOrganizerSession()
  if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { regId, score, annotations, organizer_note } = await req.json().catch(() => ({}))

  if (!regId || typeof regId !== 'string') {
    return NextResponse.json({ error: 'regId is required.' }, { status: 400 })
  }
  if (score === undefined || score === null || Number.isNaN(Number(score))) {
    return NextResponse.json({ error: 'A valid numeric score is required.' }, { status: 400 })
  }

  // Confirm this registration belongs to an olympiad the organizer is authorized for
  const { data: reg, error: regError } = await supabaseAdmin
    .from('olympiad_registrations')
    .select('id, olympiad_id')
    .eq('id', regId)
    .single()

  if (regError || !reg) {
    return NextResponse.json({ error: 'Registration not found.' }, { status: 404 })
  }
  if (!session.olympiadIds.includes(reg.olympiad_id)) {
    return NextResponse.json({ error: 'Forbidden.' }, { status: 403 })
  }

  const updatePayload: Record<string, any> = {
    final_score: Number(score),
    review_status: 'reviewed',
  }
  // Tick/cross/note overlay data on the answer sheet image, and the
  // organizer's overall written comment on the sheet (separate from the
  // per-mark notes that live inside each annotation object).
  if (annotations !== undefined) updatePayload.annotations = annotations
  if (organizer_note !== undefined) updatePayload.organizer_note = organizer_note

  const { error: updateError } = await supabaseAdmin
    .from('olympiad_registrations')
    .update(updatePayload)
    .eq('id', regId)

  if (updateError) {
    return NextResponse.json({ error: 'Could not save score.' }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
