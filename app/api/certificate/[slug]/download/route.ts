import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { apiError, apiNotFound } from '@/lib/api/response'
import { verifyCertificateDownloadToken } from '@/lib/crypto'
import { renderCertificatePdf } from '@/lib/certificate'

// GET /api/certificate/[slug]/download?token=...
//
// No Authorization header needed by design — a plain <a>/new-tab open or
// an <iframe src> can't carry one — so this route trusts only the
// short-lived signed token minted by /me. The token proves "this
// specific recipient, this specific batch, right now" and nothing more;
// it's never stored, logged, or reusable past its ~2 minute expiry. If a
// token has expired, the page that opened this URL should just call /me
// again for a fresh one rather than surfacing an error.

export async function GET(req: NextRequest, ctx: { params: Promise<{ slug: string }> }) {
  const { slug } = await ctx.params
  const token = new URL(req.url).searchParams.get('token') || ''
  if (!token) return apiError('Missing download token.', 401)

  const verified = verifyCertificateDownloadToken(token)
  if (!verified) return apiError('This link has expired. Please go back and try again.', 401)

  const { data: recipient, error: rErr } = await supabaseAdmin
    .from('certificate_recipients')
    .select('id, full_name, certificate_id')
    .eq('id', verified.recipientId)
    .maybeSingle()
  if (rErr) return apiError(rErr, 400)
  if (!recipient) return apiNotFound('Recipient not found.')

  const { data: certificate, error: cErr } = await supabaseAdmin
    .from('certificates')
    .select('*')
    .eq('id', recipient.certificate_id)
    .maybeSingle()
  if (cErr) return apiError(cErr, 400)
  // The token only encodes the recipient, so also make sure it actually
  // belongs to the batch this URL's slug names, and that the batch is
  // still active and ready.
  if (!certificate || certificate.slug !== slug) return apiNotFound('Certificate not found.')
  if (!certificate.is_active) return apiError('This certificate is no longer available.', 403)
  if (!certificate.template_pdf_url) return apiError('Certificate not ready yet.', 400)

  try {
    const bytes = await renderCertificatePdf(certificate.template_pdf_url, recipient.full_name, {
      nameXPct: certificate.name_x_pct,
      nameYPct: certificate.name_y_pct,
      namePage: certificate.name_page,
      fontSize: certificate.font_size,
      fontColor: certificate.font_color,
      align: certificate.align,
    })
    const safeName = recipient.full_name.replace(/[^a-zA-Z0-9 _-]/g, '').trim() || 'certificate'
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `inline; filename="${certificate.slug}-${safeName}.pdf"`,
        'Cache-Control': 'private, no-store',
      },
    })
  } catch (err: any) {
    return apiError(err?.message || 'Could not render your certificate.', 400)
  }
}
