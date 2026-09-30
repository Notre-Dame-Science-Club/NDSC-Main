// B4: registration fee = sum of `behavior.requires_payment.amount` over every
// node on the completed path (root -> terminal). A fee on the root therefore
// still applies (backwards compatible when the root is the terminal), and a
// per-segment fee adds on top of any event-level fee. Only ever evaluated when
// the path is complete, never at an intermediate step.
export function feeForNode(node: any): number {
  const a = node?.behavior?.requires_payment?.amount
  return typeof a === 'number' && isFinite(a) && a > 0 ? a : 0
}

export function computePathFee(nodes: any[]): number {
  const total = (nodes || []).reduce((s, n) => s + feeForNode(n), 0)
  return Math.round(total * 100) / 100
}
