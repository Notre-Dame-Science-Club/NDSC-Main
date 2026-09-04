import { supabaseAdmin } from '@/lib/supabase'

import { apiError, apiOk } from '@/lib/api/response'

// Public, no params — used by the /olympiad page to show one card per
// "primary field" (a top-level activity_reg_categories row, parent_id =
// null) whose subtree contains at least one LEAF that is:
//   - is_online_submission = true
//   - registration_open !== false, all the way up its own ancestor chain
//   - belongs to a session that is published, is_upcoming, and has
//     registration_enabled = true
//
// This is what makes "Olympiad" stop being a separate system: there is no
// olympiad-specific list here at all, it's purely derived from the same
// activity_reg_categories tree the Activity registration flow already uses.
export async function GET() {
  const { data: sessions, error: sessionError } = await supabaseAdmin
    .from('activity_sessions')
    .select('id, title, slug, description, cover_image_url')
    .eq('is_published', true)
    .eq('is_upcoming', true)
    .eq('registration_enabled', true)

  if (sessionError) return apiError(sessionError, 400)
  if (!sessions || sessions.length === 0) return apiOk([])

  const sessionIds = sessions.map(s => s.id)
  const { data: categories, error: catError } = await supabaseAdmin
    .from('activity_reg_categories')
    .select('id, activity_session_id, parent_id, name, description, is_online_submission, registration_open, display_order')
    .in('activity_session_id', sessionIds)
    .order('display_order', { ascending: true })

  if (catError) return apiError(catError, 400)

  const all = categories || []
  const byId = new Map(all.map(c => [c.id, c]))

  // A node is "blocked" if it (or any ancestor) has registration_open === false.
  const isOpenChain = (cat: any): boolean => {
    let node: any = cat
    while (node) {
      if (node.registration_open === false) return false
      node = node.parent_id ? byId.get(node.parent_id) : null
    }
    return true
  }

  const isLeaf = (cat: any) => !all.some(c => c.parent_id === cat.id)

  // Does this category's subtree contain a qualifying online leaf?
  const hasOnlineLeaf = (cat: any): boolean => {
    if (isLeaf(cat)) return cat.is_online_submission && isOpenChain(cat)
    return all.filter(c => c.parent_id === cat.id).some(hasOnlineLeaf)
  }

  const topLevel = all.filter(c => !c.parent_id)
  const sessionById = new Map(sessions.map(s => [s.id, s]))

  const cards = topLevel
    .filter(hasOnlineLeaf)
    .map(c => {
      const session = sessionById.get(c.activity_session_id)
      return {
        category_id: c.id,
        name: c.name,
        description: c.description,
        session_id: c.activity_session_id,
        session_slug: session?.slug,
        session_title: session?.title,
        cover_image_url: session?.cover_image_url || null,
      }
    })
    .filter(c => c.session_slug)

  return apiOk(cards)
}
