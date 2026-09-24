import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'
import { encrypt, decrypt, maskApiKey } from '@/lib/crypto'
import { verifyBrevoApiKey } from '@/lib/email/brevo'

// GET /api/admin/emailing/accounts — list all accounts with masked API keys
export async function GET() {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { data: accounts, error } = await supabaseAdmin
    .from('email_accounts')
    .select('*')
    .order('created_at', { ascending: false })

  if (error) return apiError(error)

  // Mask API keys before sending
  const masked = accounts.map(acc => ({
    ...acc,
    api_key_masked: maskApiKey(acc.api_key_encrypted),
    api_key_encrypted: undefined, // Don't send encrypted key to client
  }))

  return apiOk({ accounts: masked })
}

// POST /api/admin/emailing/accounts — create a new account
export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => ({}))
  const { label, gmail_address, sender_name, sender_email, api_key, daily_limit } = body

  if (!label || !sender_name || !sender_email || !api_key) {
    return apiError('Missing required fields: label, sender_name, sender_email, api_key')
  }

  // Verify the API key with Brevo
  const verification = await verifyBrevoApiKey(api_key)
  if (!verification.ok) {
    return apiError(verification.error || 'Invalid Brevo API key', 400)
  }

  // Encrypt the API key
  const encrypted = encrypt(api_key)

  const { data, error } = await supabaseAdmin
    .from('email_accounts')
    .insert({
      label,
      gmail_address: gmail_address || null,
      sender_name,
      sender_email,
      api_key_encrypted: encrypted,
      daily_limit: daily_limit || 300,
    })
    .select()
    .single()

  if (error) return apiError(error)

  return apiOk({
    account: {
      ...data,
      api_key_masked: maskApiKey(encrypted),
      api_key_encrypted: undefined,
    },
  })
}

// PATCH /api/admin/emailing/accounts — update an account
export async function PATCH(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => ({}))
  const { id, label, daily_limit, is_active, api_key } = body

  if (!id) return apiError('Missing account id')

  const updates: any = {}
  if (label !== undefined) updates.label = label
  if (daily_limit !== undefined) updates.daily_limit = daily_limit
  if (is_active !== undefined) updates.is_active = is_active

  // If API key is being updated, verify and re-encrypt it
  if (api_key) {
    const verification = await verifyBrevoApiKey(api_key)
    if (!verification.ok) {
      return apiError(verification.error || 'Invalid Brevo API key', 400)
    }
    updates.api_key_encrypted = encrypt(api_key)
  }

  const { data, error } = await supabaseAdmin
    .from('email_accounts')
    .update(updates)
    .eq('id', id)
    .select()
    .single()

  if (error) return apiError(error)

  return apiOk({
    account: {
      ...data,
      api_key_masked: maskApiKey(data.api_key_encrypted),
      api_key_encrypted: undefined,
    },
  })
}

// DELETE /api/admin/emailing/accounts — delete an account
export async function DELETE(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { searchParams } = new URL(req.url)
  const id = searchParams.get('id')

  if (!id) return apiError('Missing account id')

  const { error } = await supabaseAdmin.from('email_accounts').delete().eq('id', id)

  if (error) return apiError(error)

  return apiOk({ success: true })
}
