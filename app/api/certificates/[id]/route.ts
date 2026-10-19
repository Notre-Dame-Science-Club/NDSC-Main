import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiNotFound, apiOk } from '@/lib/api/response'

type Ctx = { params: Promise<{ id: string }> }

const ALIGN_VALUES = ['left', 'center', 'right']

export async function GET(_req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params

  const [{ data: certificate, error }, { data: recipients, error: rErr }] = await Promise.all([
    supabaseAdmin.from('certificates').select('*').eq('id', id).maybeSingle(),
    supabaseAdmin
      .from('certificate_recipients')
      .select('*')
      .eq('certificate_id', id)
      .order('created_at', { ascending: false }),
  ])
  if (error) return apiError(error, 400)
  if (!certificate) return apiNotFound('Certificate batch not found.')
  if (rErr) return apiError(rErr, 400)

  return apiOk({ ...certificate, recipients: recipients || [] })
}

export async function PATCH(req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params

  const body = await req.json().catch(() => null)
  if (!body) return apiError('Invalid request body.', 400)

  const update: Record<string, any> = {}

  if (body.title !== undefined) {
    const title = String(body.title).trim()
    if (!title) return apiError('Title cannot be empty.', 400)
    update.title = title
  }

  if (body.slug !== undefined) {
    const slug = String(body.slug).trim().toLowerCase()
    if (!slug || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) {
      return apiError('Slug must be lowercase letters, numbers, and hyphens only.', 400)
    }
    const { data: existing } = await supabaseAdmin
      .from('certificates')
      .select('id')
      .eq('slug', slug)
      .neq('id', id)
      .maybeSingle()
    if (existing) return apiError('That slug is already in use. Please choose another.', 409)
    update.slug = slug
  }

  if (body.template_pdf_url !== undefined) update.template_pdf_url = body.template_pdf_url || null

  if (body.name_x_pct !== undefined) update.name_x_pct = clampPct(body.name_x_pct)
  if (body.name_y_pct !== undefined) update.name_y_pct = clampPct(body.name_y_pct)
  if (body.name_page !== undefined) update.name_page = Math.max(0, Number(body.name_page) || 0)
  if (body.font_size !== undefined) update.font_size = Math.max(1, Number(body.font_size) || 32)
  if (body.font_color !== undefined) update.font_color = String(body.font_color || '#111111')
  if (body.align !== undefined) {
    if (!ALIGN_VALUES.includes(body.align)) return apiError('Invalid alignment.', 400)
    update.align = body.align
  }
  if (body.is_active !== undefined) update.is_active = !!body.is_active

  if (Object.keys(update).length === 0) return apiError('Nothing to update.', 400)
  update.updated_at = new Date().toISOString()

  const { data, error } = await supabaseAdmin
    .from('certificates')
    .update(update)
    .eq('id', id)
    .select()
    .single()
  if (error) return apiError(error, 400)
  if (!data) return apiNotFound('Certificate batch not found.')

  return apiOk(data)
}

export async function DELETE(_req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params

  const { error } = await supabaseAdmin.from('certificates').delete().eq('id', id)
  if (error) return apiError(error, 400)

  return apiOk({ deleted: true })
}

function clampPct(value: any): number {
  const n = Number(value)
  if (!Number.isFinite(n)) return 50
  return Math.min(100, Math.max(0, n))
}
