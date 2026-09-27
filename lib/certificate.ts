// lib/certificate.ts
//
// Shared stamping engine for the certificates system. Both the admin
// "preview with a sample name" route and the recipient-facing download
// route call renderCertificatePdf() — one code path, two callers — so a
// preview is guaranteed to look exactly like the real thing.
//
// Placement (name_x_pct/name_y_pct) is stored as a percentage of the page,
// not raw points, specifically so it stays correct even if the admin
// replaces the template with a differently-sized PDF later: every render
// re-reads the current page's actual width/height and converts fresh.

import { PDFDocument, StandardFonts, rgb } from 'pdf-lib'

export type CertificateAlign = 'left' | 'center' | 'right'

export interface CertificatePlacement {
  nameXPct: number
  nameYPct: number
  namePage: number
  fontSize: number
  fontColor: string
  align: CertificateAlign
}

/** Parses a `#rrggbb` (or `#rgb`) string into pdf-lib's 0-1 rgb() color. Falls back to near-black. */
function parseHexColor(hex: string) {
  const cleaned = (hex || '').trim().replace(/^#/, '')
  const full =
    cleaned.length === 3
      ? cleaned.split('').map((c) => c + c).join('')
      : cleaned
  const match = /^([0-9a-fA-F]{6})$/.exec(full)
  if (!match) return rgb(0.07, 0.07, 0.07)
  const int = parseInt(match[1], 16)
  const r = ((int >> 16) & 255) / 255
  const g = ((int >> 8) & 255) / 255
  const b = (int & 255) / 255
  return rgb(r, g, b)
}

/**
 * Fetches the template PDF, stamps `name` at the stored placement on the
 * given page, and returns the finished PDF bytes. Throws on a fetch
 * failure or an out-of-range page index — callers turn that into a
 * user-facing apiError.
 */
export async function renderCertificatePdf(
  templateUrl: string,
  name: string,
  placement: CertificatePlacement
): Promise<Uint8Array> {
  const res = await fetch(templateUrl)
  if (!res.ok) {
    throw new Error(`Could not load the certificate template (${res.status}).`)
  }
  const templateBytes = await res.arrayBuffer()

  const pdfDoc = await PDFDocument.load(templateBytes)
  const pages = pdfDoc.getPages()
  if (pages.length === 0) {
    throw new Error('The template PDF has no pages.')
  }
  const pageIndex = Math.min(Math.max(placement.namePage || 0, 0), pages.length - 1)
  const page = pages[pageIndex]
  const { width, height } = page.getSize()

  const font = await pdfDoc.embedFont(StandardFonts.HelveticaBold)
  const fontSize = placement.fontSize || 32

  let textWidth: number
  try {
    textWidth = font.widthOfTextAtSize(name, fontSize)
  } catch {
    // pdf-lib's standard fonts only support WinAnsi (Latin) characters —
    // this is the most likely failure mode for a name typed in Bengali
    // or another non-Latin script, so give the admin/recipient something
    // more actionable than pdf-lib's internal encoding error.
    throw new Error(
      `"${name}" contains characters the certificate font can't render (only Latin/ASCII characters are supported).`
    )
  }

  const targetX = (Math.min(Math.max(placement.nameXPct, 0), 100) / 100) * width
  // Percentage is measured from the top of the page (how the admin's
  // preview/placement UI shows it), but pdf-lib draws from the bottom.
  const targetY = height - (Math.min(Math.max(placement.nameYPct, 0), 100) / 100) * height

  let x = targetX
  if (placement.align === 'center') x = targetX - textWidth / 2
  else if (placement.align === 'right') x = targetX - textWidth

  page.drawText(name, {
    x,
    y: targetY - fontSize / 2, // vertically center the glyph baseline on the target point
    size: fontSize,
    font,
    color: parseHexColor(placement.fontColor),
  })

  return pdfDoc.save()
}
