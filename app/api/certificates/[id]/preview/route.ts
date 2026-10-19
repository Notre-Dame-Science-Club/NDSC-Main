import { NextRequest } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiError, apiNotFound } from '@/lib/api/response'
import { renderCertificatePdf } from '@/lib/certificate'

type Ctx = { params: Promise<{ id: string }> }

// Stamps a placeholder name onto the batch's current template + placement
// and returns the PDF inline, for the admin's "preview with a sample
// name" button. Same renderCertificatePdf() call as the real download —
// this route only differs in whose name it stamps.

export async function GET(req: NextRequest, ctx: Ctx) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  const { id } = await ctx.params

  const { data: certificate, error } = await supabaseAdmin
    .from('certificates')
    .select('*')
    .eq('id', id)
    .maybeSingle()
  if (error) return apiError(error, 400)
  if (!certificate) return apiNotFound('Certificate batch not found.')
  if (!certificate.template_pdf_url) return apiError('Upload a template first.', 400)

  const sampleName = new URL(req.url).searchParams.get('name') || 'Jane Doe'

  try {
    const bytes = await renderCertificatePdf(certificate.template_pdf_url, sampleName, {
      nameXPct: certificate.name_x_pct,
      nameYPct: certificate.name_y_pct,
      namePage: certificate.name_page,
      fontSize: certificate.font_size,
      fontColor: certificate.font_color,
      align: certificate.align,
    })
    return new Response(Buffer.from(bytes), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': 'inline; filename="preview.pdf"',
        'Cache-Control': 'no-store',
      },
    })
  } catch (err: any) {
    return apiError(err?.message || 'Could not render the preview.', 400)
  }
}
