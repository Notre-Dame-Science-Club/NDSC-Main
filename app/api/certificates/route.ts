import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiOk } from '@/lib/api/response'

// GET  /api/certificates       -> list every batch, newest first, with recipient counts
// POST /api/certificates       -> create a new (template-less, recipient-less) batch

export async function GET(_req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const { data, error } = await supabaseAdmin
    .from('certificates')
    .select('*, certificate_recipients(count)')
    .order('created_at', { ascending: false })
  if (error) return apiError(error, 400)

  const withCounts = (data || []).map((row: any) => {
    // Supabase/PostgREST returns an embedded aggregate as [{ count }] —
    // handled defensively here in case that ever comes back as a bare
    // object instead, so the list doesn't silently show 0 for everyone.
    const raw = row.certificate_recipients
    const recipient_count = Array.isArray(raw) ? raw[0]?.count ?? 0 : raw?.count ?? 0
    return { ...row, recipient_count, certificate_recipients: undefined }
  })

  return apiOk(withCounts)
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => null)
  const title = (body?.title || '').trim()
  const slug = (body?.slug || '').trim().toLowerCase()

  if (!title) return apiError('A title is required.', 400)
  if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
    return apiError('Slug must be lowercase letters, numbers, and hyphens only.', 400)
  }

  const { data: existing } = await supabaseAdmin
    .from('certificates')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()
  if (existing) return apiError('That slug is already in use. Please choose another.', 409)

  const { data, error } = await supabaseAdmin
    .from('certificates')
    .insert({ title, slug })
    .select()
    .single()
  if (error) return apiError(error, 400)

  return apiOk(data, { status: 201 })
}
