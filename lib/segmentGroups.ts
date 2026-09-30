// Segment groups: "at most one registration per group". Pure helpers (unit-tested).
// Groups live in form_graphs.settings.segment_groups; membership in
// form_nodes.behavior.segment_group_id. A node inherits from its nearest ancestor
// that has a VALID assignment; stale ids (group deleted) are ignored.
export type SegmentGroup = { id: string; name: string; description?: string }
export type GNode = { id: string; parent_id: string | null; is_terminal?: boolean; enabled?: boolean; behavior?: any }

export const ALL_GROUP_KEY = '__all__'

export function resolveGroupId(
  nodeId: string,
  nodesById: Map<string, GNode>,
  groups: SegmentGroup[] | null | undefined,
): string | null {
  const valid = new Set((groups || []).map(g => g.id))
  let cur: string | null = nodeId, guard = 0
  while (cur && guard++ < 200) {
    const n = nodesById.get(cur)
    if (!n) return null
    const gid = n.behavior?.segment_group_id
    if (gid && valid.has(gid)) return gid
    cur = n.parent_id
  }
  return null
}

/** Key stored in registration_slots.group_key. */
export function groupKeyFor(
  nodeId: string,
  nodesById: Map<string, GNode>,
  groups: SegmentGroup[] | null | undefined,
  disableMultiSegmentEnroll: boolean,
): string | null {
  if (disableMultiSegmentEnroll) return ALL_GROUP_KEY
  return resolveGroupId(nodeId, nodesById, groups)
}

/** Registrable terminals at/below nodeId: is_terminal, or no enabled children. Disabled nodes are skipped. */
export function terminalsOf(nodeId: string, nodes: GNode[]): string[] {
  const kids = new Map<string, GNode[]>()
  for (const n of nodes) if (n.parent_id) (kids.get(n.parent_id) || kids.set(n.parent_id, []).get(n.parent_id)!).push(n)
  const out: string[] = []
  const walk = (id: string) => {
    const self = nodes.find(n => n.id === id)
    if (!self || self.enabled === false) return
    const enabledKids = (kids.get(id) || []).filter(k => k.enabled !== false)
    if (self.is_terminal || !enabledKids.length) out.push(id)
    else enabledKids.forEach(k => walk(k.id))
  }
  walk(nodeId)
  return out
}

/**
 * group_key for EVERY node in a graph: { [nodeId]: groupKey | null }.
 * Feeds the recompute_slot_groups() SQL function (db/37) so registrations that
 * already exist pick up a group the admin defines or changes later.
 */
export function buildGroupMapping(
  nodes: GNode[],
  groups: SegmentGroup[] | null | undefined,
  disableMultiSegmentEnroll: boolean,
): Record<string, string | null> {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const out: Record<string, string | null> = {}
  for (const n of nodes) out[n.id] = groupKeyFor(n.id, byId, groups, disableMultiSegmentEnroll)
  return out
}

/**
 * For the public picker: which enabled terminals under `nodeId` are LOCKED for a
 * person who already holds slots, and why. `heldGroupKeys` maps group_key -> label of
 * the segment they hold in it; `heldTerminals` maps terminal id -> true.
 * Purely advisory (the server enforces the real rule at completion).
 */
export function lockedTerminals(
  nodeId: string,
  nodes: GNode[],
  groups: SegmentGroup[] | null | undefined,
  disableMultiSegmentEnroll: boolean,
  held: { groupKeys: Record<string, string>; terminals: Record<string, string> },
): Record<string, { reason: 'same_segment' | 'same_group'; heldLabel: string; groupName: string | null }> {
  const byId = new Map(nodes.map(n => [n.id, n]))
  const out: Record<string, { reason: 'same_segment' | 'same_group'; heldLabel: string; groupName: string | null }> = {}
  for (const t of terminalsOf(nodeId, nodes)) {
    if (held.terminals[t]) { out[t] = { reason: 'same_segment', heldLabel: held.terminals[t], groupName: null }; continue }
    const key = groupKeyFor(t, byId, groups, disableMultiSegmentEnroll)
    if (key && held.groupKeys[key]) {
      const groupName = key === ALL_GROUP_KEY ? null : ((groups || []).find(g => g.id === key)?.name ?? null)
      out[t] = { reason: 'same_group', heldLabel: held.groupKeys[key], groupName }
    }
  }
  return out
}
