// Auto-enroll: when someone is added to a team by EMAIL before they have an account,
// then later creates one (or already had one but a different email casing was typed),
// they should simply see themselves on that team. No verification step, by design:
// matching is by normalized e-mail (trim + lowercase), which is what registration_slots
// stores, so "Carol@X.com" typed by the leader matches carol@x.com on the account.
//
// Idempotent and best-effort: never throws, safe to call on every dashboard load.
import { supabaseAdmin } from '@/lib/supabase'
import { normalizeEmail } from '@/lib/identity'

export async function claimTeamRegistrations(memberId: string | null | undefined, email: string | null | undefined): Promise<string[]> {
  const e = normalizeEmail(email)
  if (!memberId || !e) return []
  try {
    // 1. Every complete registration that lists this e-mail as a TEAM MEMBER.
    //    Primary source: registration_slots (normalized, indexed). It also carries the
    //    session / terminal / group we need to record the member's own slot below.
    const found = new Map<string, { session: string; terminal: string; group: string | null } | null>()
    const { data: slotRows, error: slotErr } = await supabaseAdmin
      .from('registration_slots')
      .select('registration_id, activity_session_id, terminal_node_id, group_key')
      .eq('identity_kind', 'email').eq('identity_value', e).eq('role', 'team_member')
    if (!slotErr) {
      for (const r of (slotRows || []) as any[]) {
        found.set(r.registration_id, { session: r.activity_session_id, terminal: r.terminal_node_id, group: r.group_key ?? null })
      }
    }
    // Fallback for rows that have no slots (legacy / db/36 not applied): scan the jsonb.
    // jsonb containment is case-sensitive, so try the lower-cased form (and the form
    // the account holds, if different).
    const variants = new Set<string>([e])
    const { data: me } = await supabaseAdmin.from('members').select('email').eq('id', memberId).maybeSingle()
    const raw = (me?.email || '').trim()
    if (raw) variants.add(raw)
    for (const v of variants) {
      const { data: rows } = await supabaseAdmin
        .from('activity_registrations').select('id')
        .contains('team_members', JSON.stringify([{ email: v }]))
        .not('completed_at', 'is', null)
      for (const r of (rows || []) as any[]) if (!found.has(r.id)) found.set(r.id, null)
    }
    if (!found.size) return []

    // 2. Skip registrations where this person is the leader, and ones already linked.
    const ids = [...found.keys()]
    const [{ data: regs }, { data: links }] = await Promise.all([
      supabaseAdmin.from('activity_registrations').select('id, member_id').in('id', ids),
      supabaseAdmin.from('team_member_links').select('registration_id').eq('member_id', memberId).in('registration_id', ids),
    ])
    const leaderOf = new Set(((regs || []) as any[]).filter(r => r.member_id === memberId).map(r => r.id))
    const linked = new Set(((links || []) as any[]).map(l => l.registration_id))
    const existing = new Set(((regs || []) as any[]).map(r => r.id))
    const fresh = ids.filter(id => existing.has(id) && !leaderOf.has(id) && !linked.has(id))
    if (!fresh.length) return []

    // 3. Link them (this is what makes the dashboard open for them).
    const { error: linkErr } = await supabaseAdmin.from('team_member_links').upsert(
      fresh.map(id => ({ registration_id: id, member_id: memberId, role: 'team_member', email_at_registration: e })),
      { onConflict: 'registration_id,member_id', ignoreDuplicates: true },
    )
    if (linkErr) { console.warn('claimTeamRegistrations: link error', linkErr.message); return [] }

    // 4. Best-effort: record the account itself as a slot holder too, so "one segment
    //    per group" also follows the account (not just the e-mail). A collision here just
    //    means the account already holds that group elsewhere; the link above stays.
    for (const id of fresh) {
      const s = found.get(id)
      if (!s) continue
      const { error } = await supabaseAdmin.from('registration_slots').insert({
        registration_id: id, activity_session_id: s.session, terminal_node_id: s.terminal,
        group_key: s.group, identity_kind: 'member', identity_value: memberId, role: 'team_member',
      })
      if (error && (error as any).code !== '23505') console.warn('claimTeamRegistrations: slot error', error.message)
    }
    return fresh
  } catch (err) {
    console.warn('claimTeamRegistrations error', err)
    return []
  }
}
