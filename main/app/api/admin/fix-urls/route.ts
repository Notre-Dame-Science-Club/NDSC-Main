/**
 * /api/admin/fix-urls — One-time URL migration endpoint
 *
 * সব table এর সব URL column scan করে broken URLs গুলো fix করে।
 * POST করলে dry_run=false দিয়ে actually fix হবে, নাহলে শুধু report করবে।
 *
 * আগে table list টা hand-written ছিল (শুধু ৪টা table), তাই Olympiads /
 * Surveys / segment background এর broken URL কখনো fix হতো না। এখন এটা
 * table-driven — নতুন upload column যোগ হলে TARGETS এ এক লাইন add করলেই হবে।
 */
import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { normalizeUploadUrl, normalizeUploadUrls } from '@/lib/uploadUrl'
import { requireAdmin } from '@/lib/api/admin-auth'
import { apiOk } from '@/lib/api/response'

type Target = {
  table: string
  /** plain text columns holding a single URL */
  columns: string[]
  /** jsonb / text[] columns holding an array of URLs */
  arrayColumns?: string[]
}

const TARGETS: Target[] = [
  { table: 'activity_sessions', columns: ['cover_image_url', 'pdf_url'], arrayColumns: ['gallery_urls'] },
  { table: 'activity_reg_categories', columns: ['bg_image_url'] },
  { table: 'activity_session_form_appearance', columns: ['form_cover_photo_url', 'form_bg_image_url'] },
  { table: 'form_configs', columns: ['cover_photo_url', 'bg_image_url'] },
  { table: 'executives', columns: ['photo_url'] },
  { table: 'publications', columns: ['cover_image_url', 'pdf_url'] },
  { table: 'olympiads', columns: ['cover_image_url', 'pdf_url', 'theme_bg_image_url', 'theme_header_logo_url'] },
  { table: 'olympiad_registrations', columns: ['answer_sheet_url'] },
  { table: 'surveys', columns: ['cover_image_url'] },
  { table: 'members', columns: ['payment_slip_url'] },
  { table: 'science_media', columns: ['thumbnail_url'] },
]

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

  for (const { table, columns, arrayColumns = [] } of TARGETS) {
    report[table] = { scanned: 0, fixed: 0, errors: [] }

    const select = ['id', ...columns, ...arrayColumns].join(', ')
    const { data: rows, error } = await supabaseAdmin.from(table).select(select)

    if (error) {
      // Table/column may not exist in this environment — skip instead of
      // failing the whole run (the old code did this for science_media only).
      delete report[table]
      continue
    }

    report[table].scanned = rows?.length ?? 0

    for (const row of (rows ?? []) as any[]) {
      const update: Record<string, unknown> = {}

      for (const col of columns) {
        if (needsFix(row[col])) update[col] = normalizeUploadUrl(row[col])
      }
      for (const col of arrayColumns) {
        if (needsFixArray(row[col])) update[col] = normalizeUploadUrls(row[col])
      }

      if (Object.keys(update).length === 0) continue

      report[table].fixed++
      if (!dryRun) {
        const { error: upErr } = await supabaseAdmin.from(table).update(update).eq('id', row.id)
        if (upErr) report[table].errors.push(`id=${row.id}: ${upErr.message}`)
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
