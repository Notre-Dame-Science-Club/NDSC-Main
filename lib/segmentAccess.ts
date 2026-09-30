// Pure decision helpers for segment access (unit-tested).
export type Window = { opens_at?: string | null; closes_at?: string | null }
export function checkWindow(now: Date, w: Window): 'ok' | 'not_open' | 'closed' {
  if (w.opens_at && now < new Date(w.opens_at)) return 'not_open'
  if (w.closes_at && now > new Date(w.closes_at)) return 'closed'
  return 'ok'
}
export function paymentSettled(status: string | null | undefined): boolean {
  return !status || status === 'paid' || status === 'not_required'
}
/** Terminal node of a registration: explicit column, else last id on the path. */
export function terminalOf(reg: { terminal_node_id?: string | null; submitted_node_ids?: any }): string | null {
  if (reg.terminal_node_id) return reg.terminal_node_id
  const p = Array.isArray(reg.submitted_node_ids) ? reg.submitted_node_ids : []
  return p.length ? p[p.length - 1] : null
}
