'use client'
import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { CheckCircle, Loader2, Workflow, AlertTriangle, ChevronRight } from 'lucide-react'
import FieldsRenderer from '@/components/FieldsRenderer'
import AntiCheatProvider from '@/components/olympiad/AntiCheatProvider'
import type { FormGraph, FormNode, FormNodeAppearance } from '@/lib/formGraph'

// The public form runner. One screen at a time: shows the current node's
// fields + a Submit button. On submit:
//   - If we're on the root node, the API creates a registration row and
//     returns the next_node_id (or marks done).
//   - Otherwise, the API updates the existing registration with the new
//     answers and returns the next_node_id.
// If the current node has more than one enabled child, we show a small
// "Choose your next step" card with one link per child. (For v1 most
// graphs are linear, so this rarely fires.)
//
// Anti-cheat (timer + no-copy) is mounted automatically when the current
// node is an olympiad question node and the graph has anti_cheat enabled.

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
  // Where to send the user once they're done (a "Thank you" page or
  // their dashboard).
  onDone?: (result: { registration_id: string; is_olympiad: boolean }) => void
}

type FormState = {
  // Built-in field values (full_name, phone, etc.). These are the ones
  // that map to top-level columns on the registration row.
  builtins: Record<string, any>
  // Non-built-in field values, keyed by the field's `key` (or `id`).
  custom: Record<string, any>
  // Team members for activity-team nodes.
  teamMembers: any[]
}

const BLANK_BUILTINS = { full_name: '', phone: '', email: '', college: 'Notre Dame College', college_roll: '', hsc_session: '', division: '' }

function resolveAppearance(node: FormNode, graph: FormGraph): FormNodeAppearance {
  // Node-level appearance wins; fall back to graph default; fall back to {}.
  return { ...(graph.settings?.default_appearance || {}), ...(node.appearance || {}) } as FormNodeAppearance
}

function resolveTimerSeconds(node: FormNode, graph: FormGraph): number | null {
  if (graph.settings?.anti_cheat !== 'timer_no_copy') return null
  if (node.kind !== 'preset_olympiad_questions' && node.kind !== 'starter') return null
  // For starter nodes we still respect timer_override_minutes on the
  // node (some graphs put the timer at the root), but typically the
  // timer is on the questions node.
  const mins = (node.behavior as any)?.timer_override_minutes ?? graph.settings?.timer_minutes ?? 60
  return Math.max(0, Math.floor(mins * 60))
}

export default function FormRunner({
  graph, nodes, initialRegistrationId, initialCurrentNodeId, accent = 'var(--blue)',
  sessionId, eventSlug, onDone,
}: FormRunnerProps) {
  const [registrationId, setRegistrationId] = useState<string | null>(initialRegistrationId || null)
  // The current node the user is filling. Defaults to the graph's root
  // (or `initialCurrentNodeId` if resuming).
  const [currentNodeId, setCurrentNodeId] = useState<string>(
    initialCurrentNodeId || graph.root_node_id || (nodes.find(n => n.parent_id === null)?.id ?? nodes[0]?.id ?? '')
  )
  const [form, setForm] = useState<FormState>({ builtins: { ...BLANK_BUILTINS }, custom: {}, teamMembers: [] })
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)
  // Picker: shown after a non-terminal submit when the parent has more
  // than one enabled child. Each child is a clickable link.
  const [pendingChildren, setPendingChildren] = useState<FormNode[] | null>(null)

  const nodesById = useMemo(() => {
    const m: Record<string, FormNode> = {}
    for (const n of nodes) m[n.id] = n
    return m
  }, [nodes])

  const currentNode = nodesById[currentNodeId] || null
  const childrenOf = useCallback((id: string) => {
    return nodes
      .filter(n => n.parent_id === id && n.enabled)
      .sort((a, b) => (a.display_order ?? 0) - (b.display_order ?? 0))
  }, [nodes])

  const handleSubmit = useCallback(async () => {
    if (!currentNode) return
    setError('')
    setSubmitting(true)
    try {
      const res = await fetch('/api/public/form-graph/submit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          graph_id: graph.id,
          node_id: currentNode.id,
          registration_id: registrationId,
          form: form.builtins,
          custom_answers: form.custom,
          team_members: form.teamMembers,
        }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Submit failed.')
      setRegistrationId(data.registration_id || registrationId)
      if (data.done || !data.next_node_id) {
        setDone(true)
        onDone?.({ registration_id: data.registration_id, is_olympiad: !!data.is_olympiad })
        return
      }
      // Look ahead: if the next node has siblings (i.e. more than one
      // child of currentNode), show a picker. Otherwise jump straight in.
      const nextSiblings = childrenOf(currentNode.id)
      if (nextSiblings.length > 1) {
        setPendingChildren(nextSiblings)
      } else {
        setCurrentNodeId(nextSiblings[0].id)
      }
      // Reset the form for the next node (built-ins stay in case the
      // runner re-renders the same node somehow, but custom_answers reset).
      setForm(f => ({ ...f, custom: {}, teamMembers: [] }))
    } catch (e: any) {
      setError(e.message || 'Submit failed.')
    } finally {
      setSubmitting(false)
    }
  }, [currentNode, graph.id, form, registrationId, childrenOf, onDone])

  // Anti-cheat timer auto-submit. When the timer hits 0, the provider
  // calls onExpire, which we wire to the same submit handler — but
  // bypass the picker so it just finalizes.
  const handleAutoExpire = useCallback(() => {
    if (submitting || done) return
    setError('Time is up — submitting your answers automatically.')
    handleSubmit()
  }, [handleSubmit, submitting, done])

  const navigateToNode = useCallback((id: string) => {
    setCurrentNodeId(id)
    setForm(f => ({ ...f, custom: {}, teamMembers: [] }))
  }, [])

  if (!currentNode) {
    return (
      <div className="rounded-xl p-6 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <AlertTriangle size={24} className="mx-auto mb-2" style={{ color: 'var(--warning)' }} />
        <p className="font-semibold" style={{ color: 'var(--white)' }}>This form isn't set up yet.</p>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>Ask the organizer to add at least one form to the graph.</p>
      </div>
    )
  }

  if (done) {
    return (
      <div className="rounded-xl p-8 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
        <CheckCircle size={36} className="mx-auto mb-3" style={{ color: 'var(--cat-teal)' }} />
        <h1 className="text-2xl font-black mb-2" style={{ color: 'var(--white)' }}>You're all set!</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Your registration has been submitted. Your id is{' '}
          <code className="px-1.5 py-0.5 rounded text-xs" style={{ background: 'var(--bg2)', color: 'var(--blue)' }}>{registrationId}</code>.
        </p>
        {onDone && (
          <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>You can close this tab now.</p>
        )}
      </div>
    )
  }

  // Picker screen: when the just-submitted node has multiple children,
  // show one link per child. The user picks which one to fill next.
  if (pendingChildren) {
    return (
      <div className="space-y-3">
        <div className="rounded-xl p-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <h2 className="text-lg font-bold flex items-center gap-2 mb-1" style={{ color: 'var(--white)' }}>
            <Workflow size={16} style={{ color: accent }} /> Choose the next step
          </h2>
          <p className="text-xs" style={{ color: 'var(--muted)' }}>Your previous answer was saved. Pick one of the forms below to continue.</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-3">
          {pendingChildren.map(c => (
            <button key={c.id} onClick={() => { setCurrentNodeId(c.id); setPendingChildren(null) }}
              className="text-left rounded-xl p-4 transition-all hover:scale-[1.01]"
              style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <p className="font-semibold" style={{ color: 'var(--white)' }}>{c.appearance?.title || c.label}</p>
              {c.appearance?.subtitle && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{c.appearance.subtitle}</p>}
              <p className="text-xs mt-2 flex items-center gap-1" style={{ color: accent }}>Continue <ChevronRight size={12} /></p>
            </button>
          ))}
        </div>
      </div>
    )
  }

  const appearance = resolveAppearance(currentNode, graph)
  const timerSeconds = resolveTimerSeconds(currentNode, graph)
  const directChildren = childrenOf(currentNode.id)
  const hasFields = (currentNode.fields || []).length > 0
  // Picker mode: empty fields + has children. Render the children as
  // cards directly, no submit button. This is how intermediate
  // "choose a sub-segment" categories from the old system show up.
  const isPicker = !hasFields && directChildren.length > 0

  const body = (
    <div className="rounded-xl overflow-hidden" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
      {(appearance.cover_photo_url || appearance.bg_image_url) && (
        <div className="w-full aspect-[3/1] bg-cover bg-center"
          style={{ backgroundImage: `url('${appearance.cover_photo_url || appearance.bg_image_url}')` }} />
      )}
      <div className="p-5 sm:p-6">
        {appearance.title && (
          <h1 className="text-2xl font-black mb-1" style={{ color: 'var(--white)' }}>{appearance.title}</h1>
        )}
        {appearance.subtitle && (
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{appearance.subtitle}</p>
        )}

        {error && (
          <p className="text-sm p-2.5 rounded-lg mb-3"
            style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)', border: '1px solid rgba(var(--danger-rgb), 0.3)' }}>
            {error}
          </p>
        )}

        {/* Content blocks within the node. They render alongside
            fields and don't collect input. link_button blocks with a
            target_node_id turn into "continue" buttons that navigate
            to the target without submitting. */}
        {renderContentBlocks(currentNode, navigateToNode)}

        {isPicker ? (
          <div className="mt-3">
            <p className="text-xs font-bold tracking-wider mb-2" style={{ color: 'var(--muted)' }}>CHOOSE ONE</p>
            <div className="grid sm:grid-cols-2 gap-2.5">
              {directChildren.map(c => (
                <button key={c.id} onClick={() => navigateToNode(c.id)}
                  className="text-left rounded-xl p-4 transition-all hover:scale-[1.01]"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
                  <p className="font-semibold" style={{ color: 'var(--white)' }}>{c.appearance?.title || c.label}</p>
                  {c.appearance?.subtitle && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{c.appearance.subtitle}</p>}
                  <p className="text-xs mt-2 flex items-center gap-1" style={{ color: accent }}>Continue <ChevronRight size={12} /></p>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <>
            <FieldsRenderer
              schema={currentNode.fields || []}
              form={form.builtins}
              onFormChange={b => setForm(f => ({ ...f, builtins: b }))}
              customAnswers={form.custom}
              onCustomAnswersChange={c => setForm(f => ({ ...f, custom: c }))}
              accent={accent}
              sessionId={sessionId}
              eventSlug={eventSlug}
            />
            {hasFields && (
              <div className="flex items-center gap-2 mt-5">
                <button type="button" onClick={handleSubmit} disabled={submitting}
                  className="px-4 py-2.5 rounded-lg text-sm font-bold flex items-center gap-2 disabled:opacity-50"
                  style={{ background: accent, color: '#000' }}>
                  {submitting ? <><Loader2 size={14} className="animate-spin" /> Submitting…</> : <>Submit <ChevronRight size={14} /></>}
                </button>
                {currentNode.is_terminal && (
                  <span className="text-[10px] font-bold tracking-wider px-2 py-1 rounded" style={{ background: 'rgba(var(--cat-teal-rgb), 0.12)', color: 'var(--cat-teal)' }}>
                    FINAL STEP
                  </span>
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )

  if (timerSeconds != null) {
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
    <div className="space-y-3">
      {blocks.map((b, i) => {
        if (b.type === 'header') {
          const cls = b.heading_size === 'lg' ? 'text-xl font-black' : 'text-base font-bold'
          return <h2 key={i} className={cls} style={{ color: 'var(--white)' }}>{b.text}</h2>
        }
        if (b.type === 'paragraph') {
          return <p key={i} className="text-sm whitespace-pre-wrap" style={{ color: 'var(--muted)' }}>{b.text}</p>
        }
        if (b.type === 'image') {
          return b.image_url ? <img key={i} src={b.image_url} alt={b.image_alt || ''} className="rounded-lg max-h-48" /> : null
        }
        if (b.type === 'link_button') {
          const label = b.link_label || 'Continue'
          if ((b as any).target_node_id) {
            return (
              <button key={i} type="button" onClick={() => navigate((b as any).target_node_id)}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-bold"
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
