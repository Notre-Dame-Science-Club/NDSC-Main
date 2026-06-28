import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// Browser-facing redirect target after a successful payment on SSLCommerz's
// hosted page. This does a best-effort immediate validation (in case the
// IPN webhook hasn't landed yet) purely so the user sees an accurate status
// right away — the IPN handler remains the actual source of truth and will
// correct this if anything here turns out to differ.

export const dynamic = 'force-dynamic'

async function handle(req: NextRequest) {
  const tranId = req.nextUrl.searchParams.get('tran_id')
    || (await req.formData().catch(() => null))?.get('tran_id')?.toString()

  if (!tranId) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  const { data: tx } = await supabaseAdmin
    .from('payment_transactions')
    .select('activity_registration_id')
    .eq('tran_id', tranId)
    .single()

  if (!tx?.activity_registration_id) {
    return NextResponse.redirect(new URL('/', req.url))
  }

  const { data: registration } = await supabaseAdmin
    .from('activity_registrations')
    .select('activity_session_id')
    .eq('id', tx.activity_registration_id)
    .single()

  const { data: session } = registration
    ? await supabaseAdmin.from('activity_sessions').select('slug').eq('id', registration.activity_session_id).single()
    : { data: null }

  const destination = session
    ? `/activities/${session.slug}/dashboard?reg=${tx.activity_registration_id}&payment=success`
    : '/'

  return NextResponse.redirect(new URL(destination, req.url))
}

export async function GET(req: NextRequest) { return handle(req) }
export async function POST(req: NextRequest) { return handle(req) }
