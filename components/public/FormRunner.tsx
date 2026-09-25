'use client'
import { useCallback, useEffect, useMemo, useState, type ReactNode, type CSSProperties } from 'react'
import { CheckCircle, Loader2, AlertTriangle, ChevronRight, ChevronLeft, Circle, CreditCard } from 'lucide-react'
import FieldsRenderer from '@/components/FieldsRenderer'
import AntiCheatProvider from '@/components/olympiad/AntiCheatProvider'
import TeamMembersEditor, { defaultTeamMembers, type TeamMemberDraft } from '@/components/public/TeamMembersEditor'
import { supabase } from '@/lib/supabase'
import type { FormGraph, FormNode, FormNodeAppearance } from '@/lib/formGraph'

// The public form runner. Renders the user's path down the graph as a
// single growing column:
//
//   [ Starter ]  <- collapsed, done
//   [ Common details ]  <- collapsed, done
//   [ For NDC ]  <- active: fields + next-step cards, expanding in
//
// There is NO separate "submit -> full screen picker" step. If the active
// node has children, its next-step cards render directly underneath its
// own fields; clicking one submits the active node's answers and grows
// the chosen child in below (CSS grid-rows accordion, no extra libs).
// Only a true leaf node (no enabled children) gets a real "Submit" button
// that finalizes the registration.
//
// On submit:
//   - If we're on the root node, the API creates a registration row and
//     returns the next_node_id (or marks done).
//   - Otherwise, the API updates the existing registration with the new
//     answers and returns the next_node_id.
//
// Anti-cheat (timer + no-copy) is mounted automatically when the current
// (active) node is an olympiad question node and the graph has anti_cheat
// enabled.

export type FormRunnerProps = {
  graph: FormGraph
  nodes: FormNode[]
  // If we already have a registration id (i.e. the user is resuming
  // mid-flow), the runner picks up from the node they were on. The parent
  // page reads this from localStorage / URL.
  initialRegistrationId?: string | null
  initialCurrentNodeId?: string | null
  // The accent color for the theme. Falls back to blue.
  accent?: string
  // Event context — passed through to the FieldsRenderer for unique-check
  // / "already registered" surfacing. activity-only.
  sessionId?: string
  eventSlug?: string
  // The parent activity/olympiad's own title/description/cover image, for
  // nodes with an auto-pull appearance flag turned on (see
  // FormNodeAppearance in lib/formGraph.ts).
  owner?: FormRunnerOwner | null
  // Where to send the user once they're done (a "Thank you" page or
  // their dashboard).
  onDone?: (result: { registration_id: string; is_olympiad: boolean }) => void
}

const BLANK_BUILTINS = { full_name: '', phone: '', email: '', college: 'Notre Dame College', college_roll: '', hsc_session: '', division: '', batch: '' }

// Same key the legacy v1 register page (app/activities/[slug]/register/page.tsx)
// writes on a successful submit, so a returning anonymous (non-member) user's
// common info carries over into this newer form-graph flow too, whichever
// one they used first. Bug fix: this flow previously only pre-filled
// identity fields for logged-in members (via the Supabase profile lookup
// below) — an anonymous user registering for a second segment of the same
// event got a completely blank form and had to retype name/phone/email/etc.
// every single time.
const PRIMARY_INFO_KEY = 'ndsc_primary_info'

export type FormRunnerOwner = { title?: string | null; description?: string | null; cover_image_url?: string | null }

function resolveAppearance(node: FormNode, graph: FormGraph, owner?: FormRunnerOwner | null): FormNodeAppearance {
  // Node-level appearance wins; fall back to graph default; fall back to {}.
  const resolved = { ...(graph.settings?.default_appearance || {}), ...(node.appearance || {}) } as FormNodeAppearance
  // Auto-pull: swap in the parent event/olympiad's own title/description/
  // cover image when the admin has opted in, instead of whatever's
  // (possibly blank) in this node's own appearance fields.
  if (owner) {
    if (resolved.auto_pull_title) resolved.title = owner.title || resolved.title
    if (resolved.auto_pull_description) resolved.subtitle = owner.description || resolved.subtitle
    if (resolved.auto_pull_cover) resolved.cover_photo_url = owner.cover_image_url || resolved.cover_photo_url
  }
  return resolved
}

// The cover banner at the top of a form card. `cover_aspect_ratio` had an
// admin dropdown (lib/appearancePresets.ts's COVER_RATIO_OPTIONS) that
// never actually reached the public runner — this always rendered a fixed
// 3:1 crop regardless of what was picked. Now it's wired through, and
// `cover_width_pct` lets the image sit narrower than the card (centered)
// instead of always full-bleed.
function CoverImage({ appearance }: { appearance: FormNodeAppearance }) {
  const src = appearance.cover_photo_url || appearance.bg_image_url || ''
  const widthPct = appearance.cover_width_pct ?? 100
  const ratio = appearance.cover_aspect_ratio
  // No ratio configured at all (existing forms, never touched) keeps the
  // original fixed 3:1 crop so nothing changes for them. "auto" means
  // "native as uploaded" — no forced crop, natural aspect. Anything else
  // is a specific ratio (16/9, 4/3, 1/1, 21/9) cropped to fill.
  const style: CSSProperties = ratio === 'auto'
    ? { width: `${widthPct}%`, height: 'auto', objectFit: 'contain' }
    : { width: `${widthPct}%`, aspectRatio: ratio || '3/1', objectFit: 'cover' }
  return (
    <div className="w-full flex justify-center">
      <img src={src} alt="" style={style} />
    </div>
  )
}

function resolveTimerSeconds(node: FormNode, graph: FormGraph): number | null {
  if (graph.settings?.anti_cheat !== 'timer_no_copy') return null
  if (node.kind !== 'preset_olympiad_questions' && node.kind !== 'starter') return null
  const mins = (node.behavior as any)?.timer_override_minutes ?? graph.settings?.timer_minutes ?? 60
  return Math.max(0, Math.floor(mins * 60))
}

// Estimates how many steps deep the form goes *from* a given node, following
// the longest chain of enabled children down to a leaf. The graph can branch
// (a node may have several next-step options), so this isn't a fixed number
// until the user actually picks a path — we recompute it fresh every time the
// active node changes, which means the progress bar's total can shift as the
// visitor makes choices (e.g. picking a branch that's shorter/longer than a
// sibling would have been). That's expected and matches how the graph works;
// it still reads as steady forward progress since `current` always grows by
// exactly 1 per step.
function longestChainLength(id: string, allNodes: FormNode[], guard = 0): number {
  if (guard > 300) return 1
  const kids = allNodes
    .filter(n => n.parent_id === id && n.enabled)
    .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  if (!kids.length) return 1
  return 1 + Math.max(...kids.map(k => longestChainLength(k.id, allNodes, guard + 1)))
}

// A slim "Step X of Y" progress bar shown above the active step. Only
// rendered when the admin has opted in for the current node (there's a
// per-node "Show progress bar at the top" toggle in the form builder) and
// the form actually has depth beyond the current step — a single-page form
// has nothing to show progress *of*.
function StepProgressBar({ current, total, accent }: { current: number; total: number; accent: string }) {
  const pct = Math.max(4, Math.min(100, Math.round((current / total) * 100)))
  return (
    <div className="mb-3.5">
      <div className="flex items-center justify-between mb-1.5">
        <span className="text-[11px] font-bold tracking-wider" style={{ color: 'var(--muted)' }}>
          STEP {current} OF {total}
        </span>
        <span className="text-[11px] font-bold" style={{ color: accent }}>{pct}%</span>
      </div>
      <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.07)' }}>
        <div
          className="h-full rounded-full"
          style={{
            width: `${pct}%`,
            background: accent,
            boxShadow: `0 0 8px ${accentRgba(accent, 0.55)}`,
            transition: 'width 0.5s cubic-bezier(0.22,1,0.36,1)',
          }}
        />
      </div>
    </div>
  )
}

// Turns an accent color (either `var(--blue)`-style, which has a matching
// `--blue-rgb` triplet defined in globals.css, or a plain hex string from a
// per-event theme override) into an rgba() expression at the given alpha.
// Avoids relying on color-mix(), which doesn't render consistently
// everywhere and silently drops the whole declaration when it fails to
// parse — that was the cause of the flat/broken button look last time.
function accentRgba(accent: string, alpha: number): string {
  const v = (accent || '').trim()
  const varMatch = v.match(/^var\((--[\w-]+)\)$/)
  if (varMatch) return `rgba(var(${varMatch[1]}-rgb), ${alpha})`
  const hexMatch = v.match(/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/)
  if (hexMatch) {
    let hex = hexMatch[1]
    if (hex.length === 3) hex = hex.split('').map(c => c + c).join('')
    const r = parseInt(hex.slice(0, 2), 16), g = parseInt(hex.slice(2, 4), 16), b = parseInt(hex.slice(4, 6), 16)
    return `rgba(${r}, ${g}, ${b}, ${alpha})`
  }
  return `rgba(0, 212, 255, ${alpha})` // fallback — matches the site default blue
}

// CSS-only "grow in" accordion — a grid row animated from 0fr to 1fr plus
// a fade, so newly-appended steps expand into place instead of just
// popping in. No animation library needed.
function GrowIn({ children, className = '' }: { children: ReactNode; className?: string }) {
  const [shown, setShown] = useState(false)
  useEffect(() => {
    const raf = requestAnimationFrame(() => setShown(true))
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div
      className={className}
      style={{
        display: 'grid',
        gridTemplateRows: shown ? '1fr' : '0fr',
        opacity: shown ? 1 : 0,
        transform: shown ? 'translateY(0)' : 'translateY(-6px)',
        transition: 'grid-template-rows 0.5s cubic-bezier(0.22,1,0.36,1), opacity 0.4s ease, transform 0.4s ease',
      }}
    >
      <div style={{ overflow: 'hidden', minWidth: 0 }}>{children}</div>
    </div>
  )
}

export default function FormRunner({
  graph, nodes, initialRegistrationId, initialCurrentNodeId, accent = 'var(--blue)',
  sessionId, eventSlug, owner, onDone,
}: FormRunnerProps) {
  const nodesById = useMemo(() => {
    const m: Record<string, FormNode> = {}
    for (const n of nodes) m[n.id] = n
    return m
  }, [nodes])

  const rootId = graph.root_node_id || (nodes.find(n => n.parent_id === null)?.id ?? nodes[0]?.id ?? '')

  // Walk parent_id up to the root so we can reconstruct the full ancestor
  // chain — used both for the initial path and (defensively) anywhere we
  // need "everything above this node".
  const ancestorChain = useCallback((id: string): string[] => {
    const chain: string[] = []
    let cur: string | undefined = id
    let guard = 0
    while (cur && guard++ < 200) {
      chain.unshift(cur)
      cur = nodesById[cur]?.parent_id || undefined
    }
    return chain
  }, [nodesById])

  const [path, setPath] = useState<string[]>(() => {
    const start = initialCurrentNodeId || rootId
    return start ? ancestorChain(start) : []
  })
  const [submittedIds, setSubmittedIds] = useState<Set<string>>(new Set())
  const [registrationId, setRegistrationId] = useState<string | null>(initialRegistrationId || null)
  const [form, setForm] = useState<Record<string, any>>(() => {
    // Anonymous-user prefill (see PRIMARY_INFO_KEY comment above). Lazy
    // initializer so it only runs once, on first mount, client-side.
    if (typeof window === 'undefined') return { ...BLANK_BUILTINS }
    try {
      const saved = window.localStorage.getItem(PRIMARY_INFO_KEY)
      if (saved) return { ...BLANK_BUILTINS, ...JSON.parse(saved) }
    } catch { /* ignore — localStorage may be unavailable / bad JSON */ }
    return { ...BLANK_BUILTINS }
  })
  const [custom, setCustom] = useState<Record<string, any>>({})
  const [teamMembers, setTeamMembers] = useState<TeamMemberDraft[]>([])
  // Snapshot of each visited node's custom/team answers, so that going
  // back to re-check or edit an earlier step (see goToStep below) shows
  // what was actually typed there instead of a blank form.
  const [answersByNode, setAnswersByNode] = useState<Record<string, { custom: Record<string, any>; team: TeamMemberDraft[]; teamName: string }>>({})
  // Task 1: top-level team name. Only meaningful when the active node
  // has require_team set, but we keep it in state across nodes so a
  // leader who's already typed a team name doesn't lose it if the flow
  // (e.g. admin review screen) bounces them. The TeamMembersEditor
  // decides whether to actually render the input based on whether the
  // parent supplied an onTeamNameChange callback.
  const [teamName, setTeamName] = useState<string>('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [duplicateRegId, setDuplicateRegId] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  // Whether the active node's fields currently all pass their own
  // format-validation rules (FormBlock.validation — see
  // lib/formBlocks.ts). Previously a rule like "roll must be 8 digits"
  // only surfaced after a round trip to the server, as a generic banner at
  // the top of the form — easy to miss, and gave no clue which field was
  // wrong. Now FieldsRenderer checks live and we block the submit locally
  // instead, forcing every violation to show up right under its field.
  const [fieldsValid, setFieldsValid] = useState(true)
  const [teamValid, setTeamValid] = useState(true)
  const [forceShowErrors, setForceShowErrors] = useState(false)

  // Resume hydration. Bug fix: resuming mid-flow (page refresh, closed
  // tab, or coming back later via the resume keys the parent page stores)
  // previously only restored WHICH node to land on (`initialCurrentNodeId`)
  // and the registration id — never the actual values already saved for
  // that registration. `answersByNode` only helps for nodes revisited via
  // the in-page "back" button; it's plain React state, so a hard refresh
  // wipes it just like everything else. The person landed back on their
  // in-progress node with every field blank, even fields they (or an
  // earlier node) had already filled in and that were already safely
  // persisted server-side. Fetching the registration once on mount and
  // folding its saved values into `form`/`custom`/`teamMembers` fixes that
  // without touching anything about how submits themselves work.
  useEffect(() => {
    if (!initialRegistrationId) return
    let cancelled = false
    const endpoint = graph.owner_kind === 'olympiad'
      ? `/api/olympiad-register?id=${initialRegistrationId}`
      : `/api/activity-register?id=${initialRegistrationId}`
    fetch(endpoint)
      .then(r => r.json())
      .then(d => {
        if (cancelled || !d?.registration) return
        const reg = d.registration
        setForm(f => ({
          ...f,
          full_name: f.full_name || reg.full_name || '',
          phone: f.phone || reg.phone || '',
          email: f.email || reg.email || '',
          college: f.college || reg.college || '',
          college_roll: f.college_roll || reg.college_roll || '',
          hsc_session: f.hsc_session || reg.hsc_session || '',
          division: f.division || reg.division || '',
          batch: f.batch || reg.batch || '',
        }))
        // custom_answers accumulates across every node the person has
        // already passed (see form-graph/submit/route.ts), so this may
        // include keys that don't belong to the currently-active node —
        // harmless, FieldsRenderer only reads the keys its own node's
        // fields actually ask for.
        if (reg.custom_answers) setCustom(c => ({ ...reg.custom_answers, ...c }))
        if (Array.isArray(reg.team_members) && reg.team_members.length) {
          setTeamMembers(tm => (tm.length ? tm : reg.team_members))
        }
        if (reg.team_name) setTeamName(t => t || reg.team_name)
      })
      .catch(() => { /* non-critical — worst case, resume starts blank like before */ })
    return () => { cancelled = true }
    // Intentionally only depends on the id we resumed with — this should
    // run once, not re-fetch every time local state changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialRegistrationId])

  // If the person filling this out is a logged-in member, tie the
  // registration to their account (member_id column on
  // activity_registrations) so it actually shows up in their dashboard's
  // "My Registrations" and the server-truth already-registered checks
  // elsewhere in the app. Previously nothing here ever looked this up,
  // so every registration submitted through the form-graph flow had
  // member_id = null regardless of who was logged in — the dashboard's
  // registration list (and anything built on top of it) silently never
  // matched activities registered this way.
  const [memberId, setMemberId] = useState<string | null>(null)
  useEffect(() => {
    let cancelled = false
    supabase.auth.getUser().then(async ({ data }) => {
      if (cancelled) return
      const uid = data.user?.id || null
      setMemberId(uid)
      if (!uid) return
      // Prefill from the member's own account so they don't have to retype
      // identity details the site already has for them — in particular
      // `batch`, which previously had no builtin field to bind to here at
      // all, so it was always asked (or silently dropped) instead of just
      // carrying over from their profile.
      const { data: m } = await supabase
        .from('members')
        .select('full_name, phone, email, college_roll, batch')
        .eq('id', uid)
        .maybeSingle()
      if (cancelled || !m) return
      setForm(f => ({
        ...f,
        full_name: f.full_name || m.full_name || '',
        phone: f.phone || m.phone || '',
        email: f.email || m.email || '',
        college_roll: f.college_roll || m.college_roll || '',
        batch: f.batch || m.batch || '',
      }))
    }).catch(() => { /* not logged in / session hiccup — submit as anonymous */ })
    return () => { cancelled = true }
  }, [])

  const childrenOf = useCallback((id: string) => {
    return nodes
      .filter(n => n.parent_id === id && n.enabled)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  }, [nodes])

  const activeId = path[path.length - 1] || null
  const activeNode = activeId ? nodesById[activeId] : null
  // The node the person is currently on. Passed down so the live
  // "already registered" check (activity-unique-check) can scope itself
  // to this exact node — matched against OTHER registrations' own last-
  // submitted node — instead of just the top-level segment. That old
  // scoping treated every subsegment under one segment as one shared
  // "already registered" bucket; scoping by the actual current node
  // means it only warns when someone's re-entering identity fields for
  // the SAME terminal they (or someone else) already finished.
  const segmentNodeId = activeId

  // When the active node changes and that node requires a team, ensure
  // the teamMembers state has at least `min` rows pre-filled. Mirrors
  // v1's "open with min slots pre-rendered" UX so a user landing on a
  // required-team event doesn't see an empty editor that they have to
  // click "Add" on repeatedly. Re-runs only when activeId shifts.
  useEffect(() => {
    if (!activeNode) return
    const cfg = activeNode.behavior?.require_team
    if (!cfg) return
    const pwReq = cfg.password_required !== false
    const min = cfg.optional ? 0 : (cfg.min ?? 1)
    setTeamMembers(prev => {
      if (prev.length >= min) return prev
      const need = min - prev.length
      const extra: TeamMemberDraft[] = Array.from({ length: need }, () => ({
        id: Math.random().toString(36).slice(2, 9),
        full_name: '', email: '', phone: '', college_roll: '',
        password: pwReq ? '' : undefined,
        custom_answers: {},
      }))
      return [...prev, ...extra]
    })
  }, [activeNode?.id]) // eslint-disable-line react-hooks/exhaustive-deps

  // A node without a team section, or without any free-typed fields,
  // never fires TeamMembersEditor/FieldsRenderer's onValidityChange — so
  // without this, a "false" left over from a previous node's unresolved
  // rule violation would wrongly keep blocking submit forever. Both
  // components re-validate for real immediately after this on mount.
  useEffect(() => {
    setFieldsValid(true)
    setTeamValid(true)
  }, [activeNode?.id])

  // Advance from the active node toward `childId` (or, for a leaf node,
  // finalize). Submits the active node's answers first (unless it was
  // already submitted, e.g. a jump via a content-block link button), then
  // — on success — either shows the "done" state or grows the next node
  // in below.
  const advance = useCallback(async (childId: string | null) => {
    if (!activeNode) return
    setError('')
    setDuplicateRegId(null)

    if (!fieldsValid || !teamValid) {
      // Don't even hit the network — surface every rule violation inline,
      // under its own field, right away.
      setForceShowErrors(true)
      setError('Please fix the highlighted field(s) below before continuing.')
      return
    }

    const finish = async (data: any) => {
      setRegistrationId(data.registration_id || registrationId)
      // Phase 3: payment redirect. When the submit just stamped
      // payment_status='pending' on a new registration, we have to send
      // the user to SSLCommerz before we can call onDone. Mirrors v1's
      // /activities/[slug]/register flow at
      // app/activities/[slug]/register/page.tsx:497-506. A failed init
      // falls through to the normal "done" state — the row is still
      // registered, just unpaid, and the dashboard's pay button will
      // surface it again.
      if (data.requires_payment_init && data.registration_id && data.done) {
        try {
          const payRes = await fetch('/api/payment/init', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ registration_id: data.registration_id }),
          })
          const payData = await payRes.json().catch(() => ({}))
          if (payRes.ok && payData.gatewayUrl) {
            window.location.href = payData.gatewayUrl
            return
          }
        } catch {
          /* fall through to dashboard — registration is still valid */
        }
      }
      if (data.done || !data.next_node_id) {
        setDone(true)
        onDone?.({ registration_id: data.registration_id, is_olympiad: !!data.is_olympiad })
        return
      }
      const next = childId || data.next_node_id
      // Stash what was just submitted so a later "back" restores it
      // instead of showing a blank form, then load whatever's already
      // saved for the next node (blank if it's never been visited).
      setAnswersByNode(prev => ({ ...prev, [activeNode.id]: { custom, team: teamMembers, teamName } }))
      const saved = answersByNode[next]
      setPath(p => [...p, next])
      setCustom(saved?.custom || {})
      setTeamMembers(saved?.team || [])
      setTeamName(saved?.teamName || '')
      setForceShowErrors(false)
    }

    if (submittedIds.has(activeNode.id) || (activeNode.id === rootId && registrationId)) {
      // Already persisted (e.g. a link-button jump, or the root node
      // whose one-time "create the registration" submit already
      // happened — the API can never accept a second root submit once
      // registrationId exists, whether that's because goToStep cleared
      // this node out of submittedIds when stepping back to it, or
      // because we resumed mid-flow with an initialRegistrationId and
      // never actually re-submitted the root this session). Just move
      // on to whichever child/segment was picked.
      if (childId) {
        setAnswersByNode(prev => ({ ...prev, [activeNode.id]: { custom, team: teamMembers, teamName } }))
        const saved = answersByNode[childId]
        setPath(p => [...p, childId])
        setCustom(saved?.custom || {})
        setTeamMembers(saved?.team || [])
        setTeamName(saved?.teamName || '')
        setForceShowErrors(false)
      }
      return
    }

    setSubmitting(true)
    try {
      const res = await fetch('/api/public/form-graph/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph_id: graph.id,
          node_id: activeNode.id,
          registration_id: registrationId,
          form: { ...form, team_name: teamName },
          custom_answers: custom,
          team_members: teamMembers,
          member_id: memberId,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        if (data.existing_registration_id) setDuplicateRegId(data.existing_registration_id)
        throw new Error(data.error || 'Submit failed.')
      }
      setSubmittedIds(s => new Set(s).add(activeNode.id))
      await finish(data)
    } catch (e: any) {
      setError(e.message || 'Submit failed.')
    } finally {
      setSubmitting(false)
    }
  }, [activeNode, graph.id, form, custom, teamMembers, teamName, registrationId, submittedIds, onDone, memberId, answersByNode, fieldsValid, teamValid, rootId])

  // Anti-cheat timer auto-submit. When the timer hits 0, the provider
  // calls onExpire, which we wire to the same advance handler — it acts
  // like a leaf-node submit.
  const handleAutoExpire = useCallback(() => {
    if (submitting || done) return
    setError('Time is up — submitting your answers automatically.')
    advance(null)
  }, [advance, submitting, done])

  // A content-block link_button with a target_node_id jumps straight to
  // that node without submitting the active node first (matches the old
  // behavior — used for "skip ahead" style buttons).
  const jumpTo = useCallback((id: string) => {
    setPath(p => [...p, id])
    setCustom({})
    setTeamMembers([])
    setForceShowErrors(false)
  }, [])

  // Step back to an earlier, already-visited node — either the "Back"
  // button (one step) or clicking one of the collapsed completed steps
  // (jump straight to it). Restores whatever was typed there, and clears
  // the nodes being left behind from submittedIds so that if the visitor
  // edits an answer and moves forward again, it actually gets re-sent to
  // the server (the submit endpoint merges rather than overwrites, so a
  // resubmit of unchanged answers is harmless).
  const goToStep = useCallback((targetId: string) => {
    const idx = path.indexOf(targetId)
    if (idx === -1 || idx === path.length - 1) return
    if (activeNode) {
      setAnswersByNode(prev => ({ ...prev, [activeNode.id]: { custom, team: teamMembers, teamName } }))
    }
    const left = path.slice(idx)
    setPath(path.slice(0, idx + 1))
    const saved = answersByNode[targetId]
    setCustom(saved?.custom || {})
    setTeamMembers(saved?.team || [])
    setTeamName(saved?.teamName || '')
    setSubmittedIds(s => {
      const next = new Set(s)
      for (const id of left) next.delete(id)
      return next
    })
    setError('')
    setDuplicateRegId(null)
    setForceShowErrors(false)
  }, [path, activeNode, custom, teamMembers, teamName, answersByNode])

  if (!activeNode) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <AlertTriangle size={24} className="mx-auto mb-2" style={{ color: 'var(--warning)' }} />
        <p className="font-semibold" style={{ color: 'var(--white)' }}>This form isn't set up yet.</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Ask the organizer to add at least one form to the graph.</p>
      </div>
    )
  }

  const appearance = resolveAppearance(activeNode, graph, owner)
  const timerSeconds = resolveTimerSeconds(activeNode, graph)
  const directChildren = childrenOf(activeNode.id)
  const hasFields = (activeNode.fields || []).length > 0
  const hasChildren = directChildren.length > 0

  const currentStep = path.length
  const totalSteps = (path.length - 1) + longestChainLength(activeNode.id, nodes)
  const showProgress = !done && !!activeNode.behavior?.show_progress_bar && totalSteps > 1

  const body = (
    <div className="flex flex-col gap-3">
      {showProgress && <StepProgressBar current={currentStep} total={totalSteps} accent={accent} />}
      {path.slice(0, -1).map(id => {
        const n = nodesById[id]
        if (!n) return null
        const a = resolveAppearance(n, graph, owner)
        return (
          <GrowIn key={id}>
            <button type="button" onClick={() => goToStep(id)} disabled={submitting}
              className="w-full text-left rounded-xl px-4 py-3 flex items-center gap-2.5 transition-colors disabled:opacity-60"
              style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid var(--border)' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = accentRgba(accent, 0.5) }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}
              title="Go back to this step">
              <CheckCircle size={15} style={{ color: 'var(--cat-teal)' }} className="shrink-0" />
              <span className="text-sm font-semibold truncate flex-1" style={{ color: 'var(--muted)' }}>
                {a.title || n.label}
              </span>
              <span className="text-[11px] font-semibold shrink-0" style={{ color: accent }}>Edit</span>
            </button>
          </GrowIn>
        )
      })}

      <GrowIn key={activeNode.id}>
        <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: `1px solid ${done ? 'rgba(var(--cat-teal-rgb), 0.4)' : 'var(--border)'}` }}>
          {(appearance.cover_photo_url || appearance.bg_image_url) && (
            <CoverImage appearance={appearance} />
          )}
          <div className="p-5 sm:p-6">
            {done ? (
              <div className="text-center py-4">
                <CheckCircle size={40} className="mx-auto mb-3" style={{ color: 'var(--cat-teal)' }} />
                <h2 className="text-xl font-black mb-1" style={{ color: 'var(--white)' }}>You're all set!</h2>
                <p className="text-sm" style={{ color: 'var(--muted)' }}>Your registration has been submitted.</p>
                {eventSlug && registrationId && (
                  <a href={`/activities/${eventSlug}/dashboard?reg=${registrationId}`}
                    className="inline-flex items-center justify-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold mt-4"
                    style={{ background: 'var(--cat-teal)', color: '#000' }}>
                    Open my dashboard
                  </a>
                )}
              </div>
            ) : (
              <>
                {path.length > 1 && (
                  <button type="button" onClick={() => goToStep(path[path.length - 2])} disabled={submitting}
                    className="inline-flex items-center gap-1 text-xs font-semibold mb-3 disabled:opacity-50"
                    style={{ color: 'var(--muted)' }}>
                    <ChevronLeft size={13} /> Back
                  </button>
                )}
                {appearance.title && (
                  <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--white)' }}>{appearance.title}</h1>
                )}
                {appearance.subtitle && (
                  <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{appearance.subtitle}</p>
                )}

                {renderContentBlocks(activeNode, jumpTo)}

                {hasFields && (
                  <div className={hasChildren ? 'mt-3' : ''}>
                    <FieldsRenderer
                      schema={activeNode.fields || []}
                      form={form}
                      onFormChange={setForm}
                      customAnswers={custom}
                      onCustomAnswersChange={setCustom}
                      accent={accent}
                      sessionId={sessionId}
                      segmentNodeId={segmentNodeId}
                      eventSlug={eventSlug}
                      onValidityChange={setFieldsValid}
                      forceShowErrors={forceShowErrors}
                    />
                  </div>
                )}

                {/* Team-member editor — only when the active node's
                    behavior.require_team is set. Phase 2 wired this up
                    so a v2 form-graph flow has the same team-data
                    contract v1 had (per-member name/email/college_roll/
                    password, optional per-member fields, min/max bounds).
                    The wire shape is identical to v1's
                    team_members array, so the v2 submit API can call
                    the same validateAndPrepareTeam helper that v1 uses
                    — see /api/public/form-graph/submit/route.ts. */}
                {activeNode.behavior?.require_team && graph.owner_kind !== 'olympiad' && (
                  <TeamMembersEditor
                    value={teamMembers}
                    onChange={setTeamMembers}
                    accent={accent}
                    teamName={teamName}
                    onTeamNameChange={setTeamName}
                    onValidityChange={setTeamValid}
                    forceShowErrors={forceShowErrors}
                    config={{
                      require_team: true,
                      optional: activeNode.behavior.require_team.optional,
                      min: activeNode.behavior.require_team.min,
                      max: activeNode.behavior.require_team.max,
                      password_required: activeNode.behavior.require_team.password_required !== false,
                      fields: activeNode.behavior.require_team.fields,
                      member_field_validation: activeNode.behavior.require_team.member_field_validation,
                    }}
                  />
                )}

                {/* Moved below the fields (and, when this node branches
                    instead of submitting, right above the child cards) so
                    it sits next to what it's actually about — a field
                    format issue like "Roll must be exactly 8 digits" or a
                    duplicate-registration warning — rather than at the
                    top of the page where it was disconnected from both
                    the offending field and the button that triggered it. */}
                {error && (
                  <div className="text-sm p-2.5 rounded-lg mt-3"
                    style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)', border: '1px solid rgba(var(--danger-rgb), 0.3)' }}>
                    <p>{error}</p>
                    {duplicateRegId && eventSlug && (
                      <a href={`/activities/${eventSlug}/dashboard?reg=${duplicateRegId}`}
                        className="inline-flex items-center gap-1 mt-1.5 font-semibold underline">
                        Open my existing registration
                      </a>
                    )}
                  </div>
                )}

                {hasChildren ? (
                  <div className="mt-5">
                    {!activeNode.appearance?.hide_children_heading && (
                      <p className="text-xs font-bold tracking-wider mb-2" style={{ color: 'var(--muted)' }}>
                        {activeNode.appearance?.children_heading?.trim()
                          || (hasFields ? 'CONTINUE TO' : 'CHOOSE ONE')}
                      </p>
                    )}
                    <div className="grid sm:grid-cols-2 gap-2.5">
                      {directChildren.map(c => {
                        const ca = resolveAppearance(c, graph, owner)
                        return (
                          <button key={c.id} type="button" disabled={submitting} onClick={() => advance(c.id)}
                            className="group text-left rounded-lg p-4 transition-all duration-200 disabled:opacity-50 hover:-translate-y-0.5"
                            style={{
                              background: 'var(--bg2)',
                              border: '1px solid var(--border)',
                              boxShadow: '0 1px 2px rgba(0,0,0,0.15)',
                            }}
                            onMouseEnter={e => { e.currentTarget.style.borderColor = accentRgba(accent, 0.5) }}
                            onMouseLeave={e => { e.currentTarget.style.borderColor = 'var(--border)' }}>
                            <p className="font-semibold flex items-center gap-1.5" style={{ color: 'var(--white)' }}>
                              <Circle size={6} fill={accent} style={{ color: accent }} className="shrink-0" />
                              {ca.title || c.label}
                            </p>
                            {ca.subtitle && <p className="text-xs mt-1 ml-3" style={{ color: 'var(--muted)' }}>{ca.subtitle}</p>}
                            <p className="text-xs mt-2 ml-3 flex items-center gap-1 font-semibold" style={{ color: accent }}>
                              {submitting ? 'Saving…' : 'Continue'} <ChevronRight size={12} className="transition-transform group-hover:translate-x-0.5" />
                            </p>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    {/* Phase 3: payment hint. Mirror v1's fee banner at
                        app/activities/[slug]/register/page.tsx:779-783
                        — show the amount only when the active node
                        declares one, so the registrant knows they're
                        about to be redirected to the gateway. */}
                    {(activeNode.behavior as any)?.requires_payment?.amount ? (
                      <div className="mb-3 p-3 rounded-lg text-sm flex items-center gap-1.5"
                        style={{ background: 'rgba(var(--warning-rgb), 0.08)', color: 'var(--warning)' }}>
                        <CreditCard size={14} />
                        {(activeNode.behavior as any).requires_payment.label || 'Registration fee'}: ৳{(activeNode.behavior as any).requires_payment.amount}
                        {' '}— you'll be redirected to pay after submitting.
                      </div>
                    ) : null}
                    <div className="flex items-center gap-2 mt-5">
                    <button type="button" onClick={() => advance(null)} disabled={submitting}
                      className="px-6 py-3 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50 transition-all duration-200 hover:brightness-110 hover:-translate-y-0.5 active:translate-y-0 active:brightness-95"
                      style={{
                        background: accent,
                        color: '#08131f',
                        border: `1px solid ${accentRgba(accent, 0.5)}`,
                        boxShadow: `0 1px 2px rgba(0,0,0,0.25), 0 8px 20px -6px ${accentRgba(accent, 0.55)}, inset 0 1px 0 rgba(255,255,255,0.35)`,
                        letterSpacing: '0.01em',
                      }}>
                      {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : <>Submit <ChevronRight size={14} /></>}
                    </button>
                    {activeNode.is_terminal && (
                      <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded" style={{ background: 'rgba(var(--cat-teal-rgb), 0.12)', color: 'var(--cat-teal)' }}>
                        FINAL STEP
                      </span>
                    )}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </GrowIn>
    </div>
  )

  if (timerSeconds != null && !done) {
    return (
      <AntiCheatProvider initialSeconds={timerSeconds} onExpire={handleAutoExpire}>
        {body}
      </AntiCheatProvider>
    )
  }
  return body
}

// Renders the non-field content blocks (header, paragraph, image,
// link_button, video, divider, spacer) within a node. link_button
// blocks that have a `target_node_id` become in-form navigation
// buttons — clicking them jumps to the target node without submitting
// the form. link_button without a target falls back to opening
// `link_url` in a new tab.
function renderContentBlocks(node: FormNode, navigate: (id: string) => void) {
  const blocks = (node.fields || []).filter(f => f.kind === 'content' || !f.kind)
  if (!blocks.length) return null
  return (
    <div className="space-y-3 mb-3">
      {blocks.map((b, i) => {
        if (b.type === 'header') {
          const cls = b.heading_size === 'lg' ? 'text-xl font-black' : 'text-base font-bold'
          return <h2 key={i} className={cls} style={{ color: 'var(--white)' }}>{b.text}</h2>
        }
        if (b.type === 'paragraph') {
          return <p key={i} className="text-sm whitespace-pre-wrap" style={{ color: 'var(--muted)' }}>{b.text}</p>
        }
        if (b.type === 'image') {
          // Previously this had no width or centering class at all, so it
          // rendered at its natural pixel size and sat flush left inside
          // the form — exactly "doesn't take up full space" / "not
          // centered". Now it always centers, and defaults to the form's
          // full width unless the admin dials it down via width_pct.
          const w = (b as any).width_pct ?? 100
          return b.image_url ? (
            <div key={i} className="w-full flex justify-center">
              <img src={b.image_url} alt={b.image_alt || ''} className="rounded-lg"
                style={{ width: `${w}%`, maxWidth: '100%', height: 'auto' }} />
            </div>
          ) : null
        }
        if (b.type === 'link_button') {
          const label = b.link_label || 'Continue'
          if ((b as any).target_node_id) {
            return (
              <button key={i} type="button" onClick={() => navigate((b as any).target_node_id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold transition-all hover:-translate-y-0.5"
                style={{ background: 'var(--blue)', color: '#000' }}>
                {label} <ChevronRight size={14} />
              </button>
            )
          }
          if (b.link_url) {
            return (
              <a key={i} href={b.link_url} target="_blank" rel="noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold"
                style={{ background: 'var(--blue)', color: '#000' }}>
                {label}
              </a>
            )
          }
          return null
        }
        if (b.type === 'video') {
          return b.video_url ? (
            <div key={i} className="aspect-video rounded-lg overflow-hidden">
              <iframe src={b.video_url} className="w-full h-full" allowFullScreen title="" />
            </div>
          ) : null
        }
        if (b.type === 'divider') {
          return <hr key={i} style={{ borderColor: 'var(--border)' }} />
        }
        if (b.type === 'spacer') {
          return <div key={i} style={{ height: b.height_px || 24 }} />
        }
        return null
      })}
    </div>
  )
}
