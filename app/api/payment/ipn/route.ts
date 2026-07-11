import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'

// SSLCommerz calls this URL server-to-server once a payment completes,
// regardless of whether the customer's browser ever makes it back to our
// success/fail/cancel pages — this is what makes payment status reliable
// even if the user closes their browser mid-transaction.
//
// Critically: we never trust the IPN POST body directly (it could in
// principle be spoofed by anyone who knows our IPN URL) — we take the
// val_id it gives us and call SSLCommerz's own Validation API to confirm
// the transaction is real before updating anything in our database.

export const dynamic = 'force-dynamic'

export async function POST(req: NextRequest) {
  const formData = await req.formData().catch(() => null)
  if (!formData) return apiError('Invalid IPN payload.', 400)

  const valId = formData.get('val_id')?.toString()
  const tranId = formData.get('tran_id')?.toString()

  if (!valId || !tranId) {
    return apiError('Missing val_id or tran_id.', 400)
  }

  const storeId = process.env.SSLCOMMERZ_STORE_ID || 'testbox'
  const storePassword = process.env.SSLCOMMERZ_STORE_PASSWORD || 'qwerty'
  const isLive = process.env.SSLCOMMERZ_IS_LIVE === 'true'
  const apiBase = isLive ? 'https://securepay.sslcommerz.com' : 'https://sandbox.sslcommerz.com'

  let validation: any
  try {
    const valRes = await fetch(
      `${apiBase}/validator/api/validationserverAPI.php?val_id=${encodeURIComponent(valId)}&store_id=${storeId}&store_passwd=${storePassword}&format=json`
    )
    validation = await valRes.json()
  } catch (e: any) {
    return apiError('Could not reach validation API.', 502)
  }

  const rawIpn = Object.fromEntries(formData.entries())
  const isValid = validation.status === 'VALID' || validation.status === 'VALIDATED'

  const { data: tx } = await supabaseAdmin
    .from('payment_transactions')
    .select('*')
    .eq('tran_id', tranId)
    .single()

  if (!tx) {
    return apiError('Unknown transaction.', 404)
  }

  // Defense in depth: confirm the validated amount actually matches what we
  // expected to charge — a mismatch here would mean something is wrong
  // even if SSLCommerz says the transaction is otherwise valid.
  const amountMatches = isValid && Math.abs(parseFloat(validation.amount) - parseFloat(tx.amount)) < 0.01

  await supabaseAdmin
    .from('payment_transactions')
    .update({
      status: isValid && amountMatches ? 'valid' : 'failed',
      raw_ipn: rawIpn,
      raw_validation: validation,
      validated_at: new Date().toISOString(),
    })
    .eq('tran_id', tranId)

  if (tx.activity_registration_id) {
    await supabaseAdmin
      .from('activity_registrations')
      .update({
        payment_status: isValid && amountMatches ? 'paid' : 'failed',
        payment_tran_id: tranId,
        payment_validated_at: new Date().toISOString(),
      })
      .eq('id', tx.activity_registration_id)
  }

  return apiOk({ received: true, valid: isValid && amountMatches })
}
