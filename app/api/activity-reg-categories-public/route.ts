import { supabaseAdmin } from '@/lib/supabase'
import { NextRequest } from 'next/server'
import { apiError, apiOk } from '@/lib/api/response'

// Public route — the multi-layer category picker on the registration page
// fetches the tree through here. Safety check: only returns categories for
// a session that is actually upcoming AND has registration_enabled = true;
// otherwise a stale/disabled session's category tree (and any leaf field
// definitions) could be probed even after registration closed.
export async function GET(req: NextRequest) {
  const slug = req.nextUrl.searchParams.get('slug')
  if (!slug) return apiError('slug is required.', 400)

  const { data: session, error: sessionError } = await supabaseAdmin
    .from('activity_sessions')
    .select('id, title, slug, description, cover_image_url, is_upcoming, registration_enabled, registration_note, image_display_mode, reg_status, reg_deadline')
    .eq('slug', slug)
    .eq('is_published', true)
    .single()

  if (sessionError || !session) {
    return apiError('Activity not found.', 404)
  }
  if (!session.is_upcoming || !session.registration_enabled) {
    return apiError('Registration is not open for this activity.', 403)
  }

  const { data: categories, error: catError } = await supabaseAdmin
    .from('activity_reg_categories')
    .select('*')
    .eq('activity_session_id', session.id)
    .order('display_order', { ascending: true })

  if (catError) return apiError(catError, 400)

  // Drop any category whose registration is closed, AND every descendant
  // under it (closing a primary field closes everything nested inside it
  // too, even if a sub-category was individually left "open").
  const all = categories || []
  const closedIds = new Set(all.filter((c: any) => c.registration_open === false).map((c: any) => c.id))
  let changed = true
  while (changed) {
    changed = false
    for (const c of all) {
      if (!closedIds.has(c.id) && c.parent_id && closedIds.has(c.parent_id)) { closedIds.add(c.id); changed = true }
    }
  }
  const visible = all.filter((c: any) => !closedIds.has(c.id))

  // Normalize the new per-category fields onto a clean public shape. The
  // public event page only needs: id, parent_id, name, description, icon,
  // bg_image_url, is_segment, display_order, schedule_*, requires_team,
  // requires_payment, is_online_submission, registration_open, and
  // form_field_schema (drives the register page). The legacy custom_fields
  // shape is left on the row too, for backward compat with the legacy
  // single-tree register flow when no is_segment rows exist.
  return apiOk({ session, categories: visible })
}
