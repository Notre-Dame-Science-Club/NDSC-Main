// Re-keys registration_slots.group_key after an admin changes segment groups
// (define / rename / delete a group, assign a segment, move a segment, toggle
// "disable multiple segment enroll"). Without this, people who registered BEFORE the
// change would not be covered by the new group. Best-effort and non-destructive:
// nothing is ever deleted, and it never throws (a missing SQL function = no-op).
import { supabaseAdmin } from '@/lib/supabase'
import { buildGroupMapping } from '@/lib/segmentGroups'

export type RecomputeResult = { updated: number; skipped: number; conflicts: any[] } | null

export async function recomputeSlotGroups(graphId: string | null | undefined): Promise<RecomputeResult> {
  if (!graphId) return null
  try {
    const { data: graph } = await supabaseAdmin
      .from('form_graphs').select('id, owner_kind, owner_id, settings').eq('id', graphId).maybeSingle()
    if (!graph || graph.owner_kind !== 'activity') return null
    const { data: nodes } = await supabaseAdmin
      .from('form_nodes').select('id, parent_id, is_terminal, enabled, behavior').eq('graph_id', graphId)
    const list = (nodes || []) as any[]
    const root = list.find(n => n.parent_id === null)
    const groups = Array.isArray((graph as any).settings?.segment_groups) ? (graph as any).settings.segment_groups : []
    const mapping = buildGroupMapping(list, groups, !!root?.behavior?.disable_multi_segment_enroll)
    const { data, error } = await supabaseAdmin.rpc('recompute_slot_groups', {
      p_session_id: (graph as any).owner_id,
      p_mapping: mapping,
    })
    if (error) { console.warn('recompute_slot_groups failed (is db/37 applied?)', (error as any).message); return null }
    return data as RecomputeResult
  } catch (e) {
    console.warn('recomputeSlotGroups error', e)
    return null
  }
}
