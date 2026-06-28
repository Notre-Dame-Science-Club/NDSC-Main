import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest, NextResponse } from 'next/server'

// Starts an SSLCommerz payment session for an activity registration that
// requires payment. Returns the hosted GatewayPageURL for the client to
// redirect to — SSLCommerz's own page handles card/bKash/Nagad/etc, we never
// touch card details ourselves.
//
// Env vars (sandbox defaults match SSLCommerz's publicly documented test
// credentials, so this works out of the box before a real store is set up):
//   SSLCOMMERZ_STORE_ID       (default: 'testbox')
//   SSLCOMMERZ_STORE_PASSWORD (default: 'qwerty')
//   SSLCOMMERZ_IS_LIVE        ('true' for production, anything else = sandbox)
//   NEXT_PUBLIC_SITE_URL      (used to build the success/fail/cancel/ipn callback URLs)

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.registration_id) {
    return NextResponse.json({ error: 'registration_id is required.' }, { status: 400 })
  }

  const { data: registration, error: regError } = await supabaseAdmin
    .from('activity_registrations')
    .select('*')
    .eq('id', body.registration_id)
    .single()

  if (regError || !registration) {
    return NextResponse.json({ error: 'Registration not found.' }, { status: 404 })
  }
  if (registration.payment_status === 'paid') {
    return NextResponse.json({ error: 'This registration has already been paid for.' }, { status: 400 })
  }
  if (!registration.payment_amount) {
    return NextResponse.json({ error: 'No payment amount set for this registration.' }, { status: 400 })
  }

  const storeId = process.env.SSLCOMMERZ_STORE_ID || 'testbox'
  const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD || 'qwerty'
  const isLive = process.env.SSLCOMMERZ_IS_LIVE === 'true'
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || `https://${req.headers.get('host')}`
  const apiBase = isLive ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com'

  const tranId = `NDSC-${registration.id}-${Date.now()}`

  // Log the transaction up front so the IPN handler always has a row to
  // validate against, even if the customer never returns to the browser.
  await supabaseAdmin.from('payment_transactions').insert({
    tran_id: tranId,
    activity_registration_id: registration.id,
    amount: registration.payment_amount,
    currency: 'BDT',
    status: 'pending',
  })

  const params = new URLSearchParams({
    store_id: storeId,
    store_passwd: storePassword,
    total_amount: String(registration.payment_amount),
    currency: 'BDT',
    tran_id: tranId,
    success_url: `${baseUrl}/api/payment/success?tran_id=${tranId}`,
    fail_url: `${baseUrl}/api/payment/fail?tran_id=${tranId}`,
    cancel_url: `${baseUrl}/api/payment/cancel?tran_id=${tranId}`,
    ipn_url: `${baseUrl}/api/payment/ipn`,
    cus_name: registration.full_name,
    cus_email: registration.email,
    cus_add1: registration.college || 'Dhaka',
    cus_city: 'Dhaka',
    cus_state: 'Dhaka',
    cus_postcode: '1000',
    cus_country: 'Bangladesh',
    cus_phone: registration.phone,
    shipping_method: 'NO',
    product_name: 'NDSC Activity Registration',
    product_category: 'Event Registration',
    product_profile: 'general',
  })

  try {
    const res = await fetch(`${apiBase}/gwprocess/v4/api.php`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: params.toString(),
    })
    const data = await res.json()

    if (data.status !== 'SUCCESS' || !data.GatewayPageURL) {
      return NextResponse.json({ error: data.failedreason || 'Could not start payment session.' }, { status: 400 })
    }

    return NextResponse.json({ gatewayUrl: data.GatewayPageURL, tran_id: tranId })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || 'Could not reach the payment gateway.' }, { status: 502 })
  }
}
