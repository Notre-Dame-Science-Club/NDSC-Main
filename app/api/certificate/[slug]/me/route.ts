import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, apiOk } from '@/lib/api/response'
import { signCertificateDownloadToken } from '@/lib/crypto'

// GET /api/certificate/[slug]/me
//
// The recipient-facing eligibility check. Same Bearer-token auth pattern
// as /api/member-membership-slip. Never reveals anything about who else
// is or isn't on the list — a non-match and a not-ready/inactive batch
// each get their own honest, narrow message, but the response never
// exposes the recipient table itself.
//
// NOTE: lives under the singular /api/certificate/[slug]/... (not
// /api/certificates/[slug]/...) so this dynamic segment doesn't collide
// with the admin routes' /api/certificates/[id]/... segment — Next.js
// requires every dynamic route at the same directory position to share
// one parameter name, and "id" (admin, by id) and "slug" (public, by
// slug) can't both live under /api/certificates/.

const DOWNLOAD_TOKEN_TTL_MS = 2 * 60 * 1000 // ~2 minutes

async function getMemberFromRequest(req: NextRequest) {
  const authHeader = req.headers.get('authorization') || ''
  const token = authHeader.replace(/^Bearer\s+/i, '')
  if (!token) return null
  const { data, error } = await supabaseAdmin.auth.getUser(token)
  if (error || !data.user) return null
  return data.user
}

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const user = await getMemberFromRequest(req)
  if (!user || !user.email) return apiError('Unauthorized. Please log in again.', 401)

  const { slug } = await ctx.params

  const { data: certificate, error } = await supabaseAdmin
    .from('certificates')
    .select('id, title, slug, template_pdf_url, is_active')
    .eq('slug', slug)
    .maybeSingle()
  if (error) return apiError(error, 400)
  if (!certificate) return apiOk({ eligible: false, status: 'not_found' })

  if (!certificate.is_active) {
    return apiOk({ eligible: false, status: 'inactive', certificateTitle: certificate.title })
  }
  if (!certificate.template_pdf_url) {
    return apiOk({ eligible: false, status: 'not_ready', certificateTitle: certificate.title })
  }

  const email = user.email.trim().toLowerCase()
  const { data: recipient, error: rErr } = await supabaseAdmin
    .from('certificate_recipients')
    .select('id, full_name')
    .eq('certificate_id', certificate.id)
    .eq('email', email)
    .maybeSingle()
  if (rErr) return apiError(rErr, 400)

  if (!recipient) {
    return apiOk({ eligible: false, status: 'not_on_list', certificateTitle: certificate.title })
  }

  const expiresAt = Date.now() + DOWNLOAD_TOKEN_TTL_MS
  const token = signCertificateDownloadToken(recipient.id, expiresAt)
  const downloadUrl = `/api/certificate/${encodeURIComponent(certificate.slug)}/download?token=${encodeURIComponent(token)}`

  return apiOk({
    eligible: true,
    full_name: recipient.full_name,
    certificateTitle: certificate.title,
    downloadUrl,
  })
}
