// Pure path-integrity logic for form-graph registrations (B3, B7).
// A draft registration may (a) move forward to a child of its last node,
// (b) re-submit a node it already passed, or (c) switch branch by submitting a
// child of any node already on its path. (b) and (c) truncate the path and
// report the nodes that fell off (`dropped`) so their answers can be removed.
// Anything else (an unrelated node) is rejected.

export type PathDecision =
  | { ok: true; newPath: string[]; dropped: string[] }
  | { ok: false; code: 'not_on_path' }

export function evaluateStep(args: {
  priorPath: string[] | null | undefined
  rootId: string | null | undefined
  node: { id: string; parent_id: string | null }
}): PathDecision {
  const prior = Array.isArray(args.priorPath) ? args.priorPath : []
  const revisit = prior.indexOf(args.node.id)
  let cut: number
  if (revisit >= 0) cut = revisit
  else if (prior.length === 0) {
    if (args.node.parent_id !== (args.rootId ?? null)) return { ok: false, code: 'not_on_path' }
    cut = 0
  } else {
    const p = args.node.parent_id ? prior.indexOf(args.node.parent_id) : -1
    if (p < 0) return { ok: false, code: 'not_on_path' }
    cut = p + 1
  }
  return { ok: true, newPath: [...prior.slice(0, cut), args.node.id], dropped: prior.slice(cut) }
}
