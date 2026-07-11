/**
 * /api/admin/fix-urls — One-time URL migration endpoint
 *
 * সব table এর সব URL column scan করে broken URLs গুলো fix করে।
 * POST করলে dry-run=false দিয়ে actually fix হবে, নাহলে শুধু report করবে।
 */
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { normalizeUploadUrl, normalizeUploadUrls } from '@/lib/uploadUrl'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiOk } from '@/lib/api/response'

function needsFix(url: string | null | undefined): boolean {
  if (!url) return false
  return (
    url.includes('uploads.ndscbd.net/uploads/') ||
    url.includes('ndscbd.net/uploads/') ||
    url.includes('arnob.ndscbd.net/')
  )
}

function needsFixArray(urls: string[] | null | undefined): boolean {
  if (!Array.isArray(urls)) return false
  return urls.some(needsFix)
}

export async function POST(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized

  const body = await req.json().catch(() => ({}))
  const dryRun = body.dry_run !== false  // default: dry run

  const report: Record<string, { scanned: number; fixed: number; errors: string[] }> = {}

  // ── 1. activity_sessions ────────────────────────────────────────────────
  {
    const tbl = 'activity_sessions'
    report[tbl] = { scanned: 0, fixed: 0, errors: [] }

    const { data: rows, error } = await supabaseAdmin
      .from(tbl)
      .select('id, cover_image_url, pdf_url, gallery_urls')

    if (error) { report[tbl].errors.push(error.message) }
    else {
      report[tbl].scanned = rows?.length ?? 0
      for (const row of rows ?? []) {
        const coverFix  = needsFix(row.cover_image_url)
        const pdfFix    = needsFix(row.pdf_url)
        const galleryFix = needsFixArray(row.gallery_urls)

        if (coverFix || pdfFix || galleryFix) {
          report[tbl].fixed++
          if (!dryRun) {
            const update: any = {}
            if (coverFix)   update.cover_image_url = normalizeUploadUrl(row.cover_image_url)
            if (pdfFix)     update.pdf_url         = normalizeUploadUrl(row.pdf_url)
            if (galleryFix) update.gallery_urls    = normalizeUploadUrls(row.gallery_urls)

            const { error: upErr } = await supabaseAdmin
              .from(tbl).update(update).eq('id', row.id)
            if (upErr) report[tbl].errors.push(`id=${row.id}: ${upErr.message}`)
          }
        }
      }
    }
  }

  // ── 2. executives ───────────────────────────────────────────────────────
  {
    const tbl = 'executives'
    report[tbl] = { scanned: 0, fixed: 0, errors: [] }

    const { data: rows, error } = await supabaseAdmin
      .from(tbl).select('id, photo_url')

    if (error) { report[tbl].errors.push(error.message) }
    else {
      report[tbl].scanned = rows?.length ?? 0
      for (const row of rows ?? []) {
        if (needsFix(row.photo_url)) {
          report[tbl].fixed++
          if (!dryRun) {
            const { error: upErr } = await supabaseAdmin
              .from(tbl)
              .update({ photo_url: normalizeUploadUrl(row.photo_url) })
              .eq('id', row.id)
            if (upErr) report[tbl].errors.push(`id=${row.id}: ${upErr.message}`)
          }
        }
      }
    }
  }

  // ── 3. publications ─────────────────────────────────────────────────────
  {
    const tbl = 'publications'
    report[tbl] = { scanned: 0, fixed: 0, errors: [] }

    const { data: rows, error } = await supabaseAdmin
      .from(tbl).select('id, cover_image_url, pdf_url')

    if (error) { report[tbl].errors.push(error.message) }
    else {
      report[tbl].scanned = rows?.length ?? 0
      for (const row of rows ?? []) {
        const coverFix = needsFix(row.cover_image_url)
        const pdfFix   = needsFix(row.pdf_url)

        if (coverFix || pdfFix) {
          report[tbl].fixed++
          if (!dryRun) {
            const update: any = {}
            if (coverFix) update.cover_image_url = normalizeUploadUrl(row.cover_image_url)
            if (pdfFix)   update.pdf_url         = normalizeUploadUrl(row.pdf_url)

            const { error: upErr } = await supabaseAdmin
              .from(tbl).update(update).eq('id', row.id)
            if (upErr) report[tbl].errors.push(`id=${row.id}: ${upErr.message}`)
          }
        }
      }
    }
  }

  // ── 4. science_media (youtube mostly, but check anyway) ─────────────────
  {
    const tbl = 'science_media'
    report[tbl] = { scanned: 0, fixed: 0, errors: [] }

    const { data: rows, error } = await supabaseAdmin
      .from(tbl).select('id, thumbnail_url')

    if (error) {
      // Table might not exist — skip silently
      delete report[tbl]
    } else {
      report[tbl].scanned = rows?.length ?? 0
      for (const row of rows ?? []) {
        if (needsFix(row.thumbnail_url)) {
          report[tbl].fixed++
          if (!dryRun) {
            const { error: upErr } = await supabaseAdmin
              .from(tbl)
              .update({ thumbnail_url: normalizeUploadUrl(row.thumbnail_url) })
              .eq('id', row.id)
            if (upErr) report[tbl].errors.push(`id=${row.id}: ${upErr.message}`)
          }
        }
      }
    }
  }

  const totalFixed = Object.values(report).reduce((s, r) => s + r.fixed, 0)

  return apiOk({
    dry_run: dryRun,
    message: dryRun
      ? `DRY RUN: Would fix ${totalFixed} records. Send { dry_run: false } to actually apply.`
      : `Fixed ${totalFixed} records across all tables.`,
    report,
  })
}

// GET — just show current status (dry run)
export async function GET(req: NextRequest) {
  const unauthorized = await requireAdmin()
  if (unauthorized) return unauthorized
  // Reuse POST logic as dry run
  const fakeReq = new NextRequest(req.url, {
    method: 'POST',
    body: JSON.stringify({ dry_run: true }),
    headers: { 'Content-Type': 'application/json', cookie: req.headers.get('cookie') ?? '' },
  })
  return POST(fakeReq)
}
