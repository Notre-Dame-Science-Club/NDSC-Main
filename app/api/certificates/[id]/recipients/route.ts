import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiNotFound, apiOk } from '@/lib/api/response'

type Ctx = { params: Promise<{ id: string }> }

// Bulk add recipients from the admin's already-parsed/validated CSV or
// paste rows. Upserts on (certificate_id, email) so re-uploading the same
// CSV twice just no-ops the duplicates instead of failing the whole batch.

export async function POST(req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params

  const { data: certificate } = await supabaseAdmin
    .from('certificates')
    .select('id')
    .eq('id', id)
    .maybeSingle()
  if (!certificate) return apiNotFound('Certificate batch not found.')

  const body = await req.json().catch(() => null)
  const recipients = body?.recipients
  if (!Array.isArray(recipients) || recipients.length === 0) {
    return apiError('At least one recipient is required.', 400)
  }

  // De-dupe on email (keeping the last occurrence) before upserting: a
  // single INSERT ... ON CONFLICT statement errors ("ON CONFLICT DO
  // UPDATE command cannot affect row a second time") if the same
  // conflict target appears twice in one batch. The admin UI's CSV
  // validator already screens this out, but this route has its own
  // callers/shape, so it needs to be safe on its own.
  const byEmail = new Map<string, { certificate_id: string; email: string; full_name: string }>()
  for (const r of recipients) {
    const email = String(r?.email || '').trim().toLowerCase()
    const full_name = String(r?.full_name || '').trim()
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) continue
    if (!full_name) continue
    byEmail.set(email, { certificate_id: id, email, full_name })
  }
  const rows = Array.from(byEmail.values())

  if (rows.length === 0) return apiError('No valid recipient rows were provided.', 400)

  const { data, error } = await supabaseAdmin
    .from('certificate_recipients')
    .upsert(rows, { onConflict: 'certificate_id,email' })
    .select()
  if (error) return apiError(error, 400)

  return apiOk({ added: data?.length ?? 0, recipients: data })
}
