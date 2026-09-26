'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Loader2, Trash2, Check, ChevronDown, ChevronRight, Image as ImageIcon, Eye, EyeOff, Info, Plus } from 'lucide-react'
import FormBlocksBuilder, { FieldValidationEditor } from '@/components/admin/FormBlocksBuilder'
import ContactPersonsEditor from '@/components/admin/ContactPersonsEditor'
import { FormBlock, normalizeBlocks, builtinFieldDefs } from '@/lib/formBlocks'
import { THEME_PRESETS, FONT_OPTIONS, COVER_RATIO_OPTIONS } from '@/lib/appearancePresets'
import type { FormNode, FormGraph } from '@/lib/formGraph'
import { FORM_NODE_KIND_LABEL } from '@/lib/formGraph'

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'
const inputStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }

// Node editor — one page per form_node. Three panels:
//   1. Fields: edit the FormBlock list (reuses the existing FormBlocksBuilder).
//   2. Appearance: per-node title, subtitle, cover, theme, font, contact persons.
//   3. Behavior: team info, payment, schedule, project name, terminal flag.
//
// Save writes the whole node back in one PUT. The diagram view's auto-save
// of positions still runs in the background — they don't conflict because
// positions and field/appearance/behavior are different columns.

export default function NodeEditorPage() {
  const params = useParams()
  const router = useRouter()
  const graphId = params.graphId as string
  const nodeId = params.nodeId as string

  const [graph, setGraph] = useState<FormGraph | null>(null)
  const [node, setNode] = useState<FormNode | null>(null)
  const [otherNodes, setOtherNodes] = useState<{ id: string; label: string }[]>([])
  // The parent activity/olympiad's own title/description/cover image, for
  // the "Auto-pull from the event" toggles below and their live preview.
  const [owner, setOwner] = useState<{ title: string | null; description: string | null; cover_image_url: string | null; subjects?: { id: string; name: string }[] } | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showAnswerKey, setShowAnswerKey] = useState<Record<string, boolean>>({})
  // For the "linked olympiad" picker below — every olympiad in the system,
  // so the admin can select one instead of pasting a raw UUID.
  const [olympiadOptions, setOlympiadOptions] = useState<{ id: string; name: string }[]>([])
  const [creatingOlympiad, setCreatingOlympiad] = useState(false)
  // Map olympiad_id → exam_graph_id for the "Add exam questions" link below
  const [olympiadGraphMap, setOlympiadGraphMap] = useState<Record<string, string>>({})

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/form-graphs/${graphId}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load graph.')
        setGraph(data.graph)
        setOwner(data.owner || null)
        const found = (data.nodes || []).find((n: FormNode) => n.id === nodeId)
        if (!found) throw new Error('Node not found in this graph.')
        setNode({
          ...found,
          fields: normalizeBlocks(found.fields),
          appearance: found.appearance || {},
          behavior: found.behavior || {},
        })
        // otherNodes: every other node in the graph, so link_button
        // blocks can pick a target_node_id. Excludes the current node
        // to avoid self-loops in the picker.
        setOtherNodes((data.nodes || [])
          .filter((n: FormNode) => n.id !== nodeId)
          .map((n: FormNode) => ({ id: n.id, label: n.label })))
      } catch (e: any) {
        setError(e.message || 'Failed to load.')
      } finally {
        setLoading(false)
      }
    })()
    // Fetch all olympiads and build a map from olympiad_id → its form_graph id
    fetch('/api/admin/olympiads')
      .then(r => r.json())
      .then((rows: any[]) => {
        if (Array.isArray(rows)) {
          setOlympiadOptions(rows.map(o => ({ id: o.id, name: o.name })))
        }
      })
      .catch(() => { /* picker just falls back to showing nothing to choose */ })
    fetch('/api/admin/form-graphs')
      .then(r => r.json())
      .then((data: any) => {
        const graphs = data.graphs || []
        const map: Record<string, string> = {}
        for (const g of graphs) {
          if (g.owner_kind === 'olympiad') map[g.owner_id] = g.id
        }
        setOlympiadGraphMap(map)
      })
      .catch(() => {})
  }, [graphId, nodeId])

  const createAndLinkOlympiad = async () => {
    if (!node) return
    setCreatingOlympiad(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/form-nodes/${node.id}/link-olympiad`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create olympiad.')

      // Update the node's behavior with the new olympiad link
      setNode(prev => prev ? {
        ...prev,
        behavior: { ...(prev.behavior || {}), linked_olympiad_id: data.olympiad.id }
      } : prev)

      // Add the new olympiad to the picker list
      setOlympiadOptions(prev => [...prev, { id: data.olympiad.id, name: data.olympiad.name }])

      // Add the olympiad → graph mapping for the link below
      if (data.exam_graph_id) {
        setOlympiadGraphMap(prev => ({ ...prev, [data.olympiad.id]: data.exam_graph_id }))
      }
    } catch (e: any) {
      setError(e.message || 'Failed to create olympiad.')
      // Uncheck the box on error
      patchBehavior({ linked_olympiad_id: null })
    } finally {
      setCreatingOlympiad(false)
    }
  }

  const patch = (changes: Partial<FormNode>) => {
    setNode(prev => prev ? { ...prev, ...changes } : prev)
  }
  const patchAppearance = (changes: Record<string, any>) => {
    setNode(prev => prev ? { ...prev, appearance: { ...(prev.appearance || {}), ...changes } } : prev)
  }
  const patchBehavior = (changes: Record<string, any>) => {
    setNode(prev => prev ? { ...prev, behavior: { ...(prev.behavior || {}), ...changes } } : prev)
  }

  const save = async () => {
    if (!node) return
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch(`/api/admin/form-nodes/${node.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          label: node.label,
          enabled: node.enabled,
          is_terminal: node.is_terminal,
          fields: node.fields,
          appearance: node.appearance,
          behavior: node.behavior,
          display_order: node.display_order,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save.')
      setNode(data.node)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) {
      setError(e.message || 'Failed to save.')
    } finally {
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!node) return
    setError('')
    try {
      const res = await fetch(`/api/admin/form-nodes/${node.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete.')
      router.push(`/admin/form-builder/${graphId}`)
    } catch (e: any) {
      setError(e.message || 'Failed to delete.')
    }
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center" style={{ color: 'var(--muted)' }}>
        <Loader2 size={16} className="animate-spin" /> Loading node…
      </div>
    )
  }
  if (error || !node) {
    return <p className="text-sm p-3 rounded-lg" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)' }}>{error || 'Node not found.'}</p>
  }

  return (
    <div>
      <Link href={`/admin/form-builder/${graphId}`} className="inline-flex items-center gap-2 text-xs mb-2" style={{ color: 'var(--muted)' }}>
        <ArrowLeft size={12} /> Back to diagram
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-1">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-wider" style={{ color: 'var(--muted)' }}>
            {FORM_NODE_KIND_LABEL[node.kind]} · {graph?.title}
          </p>
          <input value={node.label} onChange={e => patch({ label: e.target.value })}
            className="text-2xl font-black bg-transparent outline-none w-full mt-0.5"
            style={{ fontFamily: 'inherit', color: 'var(--blue)' }} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0 flex-wrap">
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={node.enabled} onChange={e => patch({ enabled: e.target.checked })} />
            Enabled
          </label>
          <label className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--muted)' }} title="If on, submitting this node ends the flow.">
            <input type="checkbox" checked={node.is_terminal} onChange={e => patch({ is_terminal: e.target.checked })} />
            Terminal
          </label>
          <button onClick={save} disabled={saving}
            className="px-3 py-1.5 rounded text-sm font-bold flex items-center gap-1.5"
            style={{ background: saved ? 'var(--cat-teal)' : 'var(--blue)', color: '#000' }}>
            {saving ? <><Loader2 size={12} className="animate-spin" /> Saving…</> : saved ? <><Check size={12} strokeWidth={3} /> Saved</> : <><Save size={12} /> Save</>}
          </button>
          {node.parent_id && (
            <button onClick={() => setConfirmDelete(true)}
              className="p-1.5 rounded" style={{ color: 'var(--danger-soft)' }} title="Delete node">
              <Trash2 size={14} />
            </button>
          )}
        </div>
      </div>

      <p className="text-xs mb-6" style={{ color: 'var(--muted)' }}>
        This is one form in the graph. Visitors see it on a single page and submit to advance to its child forms.
      </p>

      {error && <p className="text-sm p-3 rounded-lg mb-4" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)' }}>{error}</p>}

      <div className="space-y-3">
        <Section title={`Fields (${node.fields.length})`} defaultOpen>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            What people see and answer on this form. Reorder with the up/down arrows. For the olympiad question fields (MCQ, multi-select, short answer), the correct answer is shown to admins only — visitors see only the question.
          </p>
          <FormBlocksBuilder blocks={node.fields} onChange={blocks => patch({ fields: blocks })} otherNodes={otherNodes} subjects={owner?.subjects} />

          {graph?.owner_kind === 'olympiad' && node.kind !== 'preset_common_details' && node.kind !== 'preset_team_info' && node.fields.some(f => f.kind === 'field') && (
            <div className="mt-4 rounded-lg p-3 text-xs" style={{ background: 'rgba(var(--accent2-rgb), 0.08)', color: 'var(--accent2)', border: '1px solid rgba(var(--accent2-rgb), 0.3)' }}>
              <p className="font-semibold flex items-center gap-1.5"><Info size={12} /> Olympiad question fields</p>
              <p className="mt-1">For exam fields, the <strong>label</strong> is the question text, and the <strong>key</strong> is what the answer is stored under. Marks and correct answers (for MCQ/multi-select) are configured below each field.</p>
              <p className="mt-1">ALL field types on this node (except those on Common Details or Team Info nodes) are treated as exam questions that the organizer can review and grade.</p>
            </div>
          )}

          {node.kind === 'preset_common_details' && node.fields.length === 0 && (
            <button onClick={() => patch({ fields: builtinFieldDefs(graph?.owner_kind) })}
              className="mt-3 px-3 py-1.5 rounded text-xs font-bold"
              style={{ background: 'rgba(var(--cat-teal-rgb), 0.12)', color: 'var(--cat-teal)', border: '1px solid rgba(var(--cat-teal-rgb), 0.3)' }}>
              + Seed with the {graph?.owner_kind === 'olympiad' ? '8' : '7'} default identity fields
            </button>
          )}
        </Section>

        <Section title="Appearance" defaultOpen>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            How this form looks. Anything left blank inherits the graph default. The graph default inherits from the global form_configs.
          </p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Field label="Title shown at the top of this form">
              <input value={node.appearance.title || ''} onChange={e => patchAppearance({ title: e.target.value })}
                disabled={!!node.appearance.auto_pull_title}
                placeholder={owner?.title || 'Inherits from the graph'} className={`${inputCls} disabled:opacity-40`} style={inputStyle} />
              <label className="flex items-center gap-2 text-xs mt-1.5 cursor-pointer" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={!!node.appearance.auto_pull_title}
                  onChange={e => patchAppearance({ auto_pull_title: e.target.checked })} />
                Auto-pull from the event's title instead{owner?.title ? ` ("${owner.title}")` : ''}
              </label>
            </Field>
            <Field label="Subtitle / description">
              <input value={node.appearance.subtitle || ''} onChange={e => patchAppearance({ subtitle: e.target.value })}
                disabled={!!node.appearance.auto_pull_description}
                className={`${inputCls} disabled:opacity-40`} style={inputStyle} />
              <label className="flex items-center gap-2 text-xs mt-1.5 cursor-pointer" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={!!node.appearance.auto_pull_description}
                  onChange={e => patchAppearance({ auto_pull_description: e.target.checked })} />
                Auto-pull from the event's description instead
              </label>
            </Field>
            <Field label="Cover photo URL">
              <input value={node.appearance.cover_photo_url || ''} onChange={e => patchAppearance({ cover_photo_url: e.target.value })}
                disabled={!!node.appearance.auto_pull_cover}
                placeholder="https://..." className={`${inputCls} disabled:opacity-40`} style={inputStyle} />
              <label className="flex items-center gap-2 text-xs mt-1.5 cursor-pointer" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={!!node.appearance.auto_pull_cover}
                  onChange={e => patchAppearance({ auto_pull_cover: e.target.checked })} />
                Auto-pull from the event's cover image instead
              </label>
              {(node.appearance.auto_pull_cover ? owner?.cover_image_url : node.appearance.cover_photo_url) && (
                <img src={(node.appearance.auto_pull_cover ? owner?.cover_image_url : node.appearance.cover_photo_url) || ''} alt=""
                  className="mt-2 rounded-lg w-full h-24 object-cover" />
              )}
            </Field>
            <Field label="Cover aspect ratio">
              <select value={node.appearance.cover_aspect_ratio || 'auto'} onChange={e => patchAppearance({ cover_aspect_ratio: e.target.value })}
                className={inputCls} style={inputStyle}>
                {COVER_RATIO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Cover width">
              <div className="flex items-center gap-2">
                <input type="range" min={20} max={100} step={5} value={node.appearance.cover_width_pct ?? 100}
                  onChange={e => patchAppearance({ cover_width_pct: Number(e.target.value) })} className="flex-1" />
                <span className="text-xs w-10 text-right" style={{ color: 'var(--muted)' }}>{node.appearance.cover_width_pct ?? 100}%</span>
              </div>
              <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                Below 100%, the cover image is centered with the form's own background showing on either side.
              </p>
            </Field>
            <Field label="Accent color / theme">
              <div className="flex flex-wrap gap-2">
                {THEME_PRESETS.map(t => (
                  <button key={t.value} type="button" onClick={() => patchAppearance({ bg_theme: t.value })}
                    className="w-8 h-8 rounded-full border-2 flex items-center justify-center"
                    style={{ background: t.swatch, borderColor: node.appearance.bg_theme === t.value ? '#fff' : 'transparent' }}
                    title={t.label}>
                    {node.appearance.bg_theme === t.value && <Check size={11} style={{ color: '#000' }} strokeWidth={3} />}
                  </button>
                ))}
                <input type="color" value={node.appearance.bg_theme?.startsWith('#') ? node.appearance.bg_theme : '#00d4ff'}
                  onChange={e => patchAppearance({ bg_theme: e.target.value })}
                  className="w-8 h-8 rounded-full cursor-pointer" style={{ padding: 0, background: 'none', border: '1px solid var(--border)' }}
                  title="Custom color" />
              </div>
            </Field>
            <Field label="Font">
              <select value={node.appearance.font_family || 'default'} onChange={e => patchAppearance({ font_family: e.target.value })}
                className={inputCls} style={inputStyle}>
                {FONT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </Field>
            <Field label="Page background color">
              <input type="color" value={node.appearance.bg_color || '#0b0f19'}
                onChange={e => patchAppearance({ bg_color: e.target.value })}
                className="w-9 h-9 rounded cursor-pointer" style={{ padding: 0, background: 'none', border: '1px solid var(--border)' }} />
            </Field>
            <Field label="Page background image URL">
              <input value={node.appearance.bg_image_url || ''} onChange={e => patchAppearance({ bg_image_url: e.target.value })}
                placeholder="Optional" className={inputCls} style={inputStyle} />
            </Field>
          </div>
          <div className="mt-4">
            <Field label="Contact persons shown at the bottom">
              <ContactPersonsEditor
                value={node.appearance.contact_persons || []}
                onChange={cp => patchAppearance({ contact_persons: cp })}
                idPrefix={`n-${node.id}`}
              />
            </Field>
          </div>
          <div className="mt-4">
            <Field label='Children-picker heading (e.g. "Choose segment", "Pick your track")'>
              <input
                value={node.appearance.children_heading || ''}
                onChange={e => patchAppearance({ children_heading: e.target.value || undefined })}
                disabled={!!node.appearance.hide_children_heading}
                placeholder='Leave blank to use the default ("CONTINUE TO" / "CHOOSE ONE")'
                className={`${inputCls} disabled:opacity-40`}
                style={inputStyle}
              />
              <label className="flex items-center gap-2 text-xs mt-1.5 cursor-pointer" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={!!node.appearance.hide_children_heading}
                  onChange={e => patchAppearance({ hide_children_heading: e.target.checked })} />
                Don't show any heading here
              </label>
              <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                Shown above the list of child-form cards under this form. Leave blank to fall back to the default, or check the box above to show nothing at all.
              </p>
            </Field>
          </div>
        </Section>

        <Section title="Behavior" defaultOpen>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            What this form does beyond collecting answers: team info, payment, schedule, project name, olympiad timer.
          </p>

          {graph?.owner_kind === 'activity' && node.parent_id === null && (
            <div className="rounded-lg p-3 mb-3" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--white)' }}>
                <input type="checkbox" checked={!!node.behavior.disable_multi_segment_enroll}
                  onChange={e => patchBehavior({ disable_multi_segment_enroll: e.target.checked || undefined })} />
                Disable multiple segment enrollment
              </label>
              <p className="text-[11px] mt-1.5" style={{ color: 'var(--muted)' }}>
                When on, a person can register for this event only once, no matter how many
                segments it has — reaching any one segment's finish line blocks every other
                segment too. Registrants also won't be offered "Register for another segment"
                on the registration page or their dashboard. Leave off (the default) to let
                someone register separately for each segment.
              </p>
            </div>
          )}

          <Field label="Schedule (date / time / room) — shown above the form">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input type="date" value={node.behavior.schedule?.date || ''} onChange={e => patchBehavior({ schedule: { ...(node.behavior.schedule || {}), date: e.target.value } })}
                className={inputCls} style={inputStyle} />
              <input placeholder="Time" value={node.behavior.schedule?.time || ''} onChange={e => patchBehavior({ schedule: { ...(node.behavior.schedule || {}), time: e.target.value } })}
                className={inputCls} style={inputStyle} />
              <input placeholder="Room" value={node.behavior.schedule?.room || ''} onChange={e => patchBehavior({ schedule: { ...(node.behavior.schedule || {}), room: e.target.value } })}
                className={inputCls} style={inputStyle} />
            </div>
          </Field>

          <div className="rounded-lg p-3 my-2" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--white)' }}>
              <input type="checkbox" checked={!!node.behavior.require_team}
                onChange={e => patchBehavior({ require_team: e.target.checked ? { min: 0, max: 5, optional: false, password_required: true } : undefined })} />
              This is a team event
            </label>
            {node.behavior.require_team && (
              <div className="mt-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <Field label="Min team size"><input type="number" min={0} value={node.behavior.require_team.min ?? 0} onChange={e => patchBehavior({ require_team: { ...(node.behavior.require_team || {}), min: Number(e.target.value) } })} className={inputCls} style={inputStyle} /></Field>
                  <Field label="Max team size"><input type="number" min={1} value={node.behavior.require_team.max ?? 5} onChange={e => patchBehavior({ require_team: { ...(node.behavior.require_team || {}), max: Number(e.target.value) } })} className={inputCls} style={inputStyle} /></Field>
                  <Field label="Password required">
                    <select value={node.behavior.require_team.password_required ? 'yes' : 'no'} onChange={e => patchBehavior({ require_team: { ...(node.behavior.require_team || {}), password_required: e.target.value === 'yes' } })}
                      className={inputCls} style={inputStyle}>
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </Field>
                  <label className="col-span-1 sm:col-span-3 flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                    <input type="checkbox" checked={!!node.behavior.require_team.optional} onChange={e => patchBehavior({ require_team: { ...(node.behavior.require_team || {}), optional: e.target.checked } })} />
                    Allow registering alone (team optional)
                  </label>
                </div>
                {/* Task 2: per-member fields editor. Reuses the same
                    FormBlocksBuilder the main form uses, so admins get
                    identical type pickers (text/textarea/number/date/
                    dropdown/multiple_choice/checkboxes/...) and option
                    editors. The blocks are flattened on save to the
                    v2 storage shape {key, label, type, required,
                    options?}. The `custom_answers` payload the public
                    TeamMembersEditor writes matches these keys. */}
                {/* Format-validation for the 4 fixed identity inputs
                    every team member has (name/phone/email/roll) — these
                    aren't FormBlocks themselves (they're hardcoded inputs
                    in TeamMembersEditor), so they get their own small
                    editor rather than living in the FormBlocksBuilder
                    below, which is only for the EXTRA per-member fields.
                    Setting a rule on College roll here fully replaces
                    the old NDC-only 8-digit default, including turning
                    it off. */}
                <div>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--accent2)' }}>VALIDATE MEMBER IDENTITY FIELDS</p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {(['full_name', 'phone', 'email', 'college_roll'] as const).map(key => {
                      const mfv = (node.behavior.require_team as any)?.member_field_validation || {}
                      const label = key === 'college_roll' ? 'College roll' : key.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase())
                      return (
                        <Field key={key} label={label}>
                          <FieldValidationEditor
                            value={mfv[key]}
                            onChange={v => patchBehavior({
                              require_team: {
                                ...(node.behavior.require_team || {}),
                                member_field_validation: { ...mfv, [key]: v },
                              },
                            })}
                          />
                          {key === 'college_roll' && !mfv.college_roll?.enabled && (
                            <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
                              Currently using the default: Notre Dame College members need exactly 8 digits; others just need digits only. Turn this on to override or disable that.
                            </p>
                          )}
                        </Field>
                      )
                    })}
                  </div>
                </div>
                <div>
                  <p className="text-xs font-semibold mb-1.5" style={{ color: 'var(--accent2)' }}>INFO COLLECTED PER TEAM MEMBER</p>
                  <FormBlocksBuilder
                    fieldsOnly
                    blocks={normalizeBlocks((node.behavior.require_team as any).fields || [])}
                    onChange={blocks => {
                      // Map the FormBlock[] the builder gives us into the
                      // slim shape v1/v2 wire together (key/label/type/
                      // required/options). Drop blocks that have no key
                      // (content blocks) and any builtins — there are no
                      // builtins for per-member fields.
                      const slim = blocks
                        .map((b: any) => {
                          if (b.kind !== 'field') return null
                          if (b.is_builtin) return null
                          const out: any = {
                            key: b.key || b.id,
                            // Preserve exactly what the admin typed, including
                            // an empty string while they're clearing the box.
                            // Falling back to b.id here (the field's random
                            // internal id, e.g. "wlyd") used to overwrite the
                            // label the instant it went empty, making it look
                            // like random text kept "reappearing" on delete.
                            label: b.label ?? '',
                            type: b.type,
                            required: !!b.required,
                          }
                          if (Array.isArray(b.options) && b.options.length) out.options = b.options
                          if (b.description) out.description = b.description
                          if (b.validation) out.validation = b.validation
                          return out
                        })
                        .filter(Boolean)
                      patchBehavior({ require_team: { ...(node.behavior.require_team || {}), fields: slim } })
                    }}
                    otherNodes={otherNodes}
                  />
                </div>
              </div>
            )}
          </div>

          <div className="rounded-lg p-3 my-2" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--white)' }}>
              <input type="checkbox" checked={!!node.behavior.requires_payment}
                onChange={e => patchBehavior({ requires_payment: e.target.checked ? { amount: 0, label: 'Registration fee' } : undefined })} />
              Requires payment
            </label>
            {node.behavior.requires_payment && (
              <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-2">
                <Field label="Amount (BDT)"><input type="number" min={0} value={node.behavior.requires_payment.amount || 0} onChange={e => patchBehavior({ requires_payment: { ...(node.behavior.requires_payment || {}), amount: Number(e.target.value) } })} className={inputCls} style={inputStyle} /></Field>
                <Field label="Label"><input value={node.behavior.requires_payment.label || ''} onChange={e => patchBehavior({ requires_payment: { ...(node.behavior.requires_payment || {}), label: e.target.value } })} className={inputCls} style={inputStyle} /></Field>
              </div>
            )}
          </div>

          <div className="rounded-lg p-3 my-2" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--white)' }}>
              <input type="checkbox" checked={!!node.behavior.project_name?.enabled}
                onChange={e => patchBehavior({ project_name: { ...(node.behavior.project_name || {}), enabled: e.target.checked } })} />
              Has a project name field
            </label>
            {node.behavior.project_name?.enabled && (
              <div className="mt-3">
                <Field label="Project name field label">
                  <input value={node.behavior.project_name?.label || 'Project Name'}
                    onChange={e => patchBehavior({ project_name: { ...(node.behavior.project_name || {}), label: e.target.value } })}
                    className={inputCls} style={inputStyle} />
                </Field>
              </div>
            )}
          </div>

          {/* Submission — lightweight mini-form (video links, file uploads) with own
              schedule, completely independent from Olympiad. A leaf can have submission
              fields without an olympiad (pure project submission), or an olympiad without
              submission fields (live MCQ exam), or both, or neither. */}
          <div className="rounded-lg p-3 my-2" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <label className="flex items-center gap-2 text-sm cursor-pointer mb-3" style={{ color: 'var(--white)' }}>
              <input type="checkbox" checked={!!node.behavior.submission?.enabled}
                onChange={e => patchBehavior({ submission: e.target.checked ? { enabled: true, fields: [], who: 'leader' } : undefined })} />
              Enable Submission (file uploads, text responses, etc.)
            </label>
            {node.behavior.submission?.enabled && (
              <div className="space-y-3">
                <Field label="Submission title (optional)">
                  <input value={node.behavior.submission?.title || ''}
                    onChange={e => patchBehavior({ submission: { ...node.behavior.submission, title: e.target.value } })}
                    placeholder="e.g. Upload your project video"
                    className={inputCls} style={inputStyle} />
                </Field>
                <div className="grid grid-cols-2 gap-2">
                  <Field label="Opens at (ISO timestamp)">
                    <input type="datetime-local" value={node.behavior.submission?.opens_at || ''}
                      onChange={e => patchBehavior({ submission: { ...node.behavior.submission, opens_at: e.target.value || null } })}
                      className={inputCls} style={inputStyle} />
                  </Field>
                  <Field label="Closes at (ISO timestamp)">
                    <input type="datetime-local" value={node.behavior.submission?.closes_at || ''}
                      onChange={e => patchBehavior({ submission: { ...node.behavior.submission, closes_at: e.target.value || null } })}
                      className={inputCls} style={inputStyle} />
                  </Field>
                </div>
                <Field label="Who can submit?">
                  <select value={node.behavior.submission?.who || 'leader'}
                    onChange={e => patchBehavior({ submission: { ...node.behavior.submission, who: e.target.value as 'leader' | 'any_member' } })}
                    className={inputCls} style={inputStyle}>
                    <option value="leader">Team leader only</option>
                    <option value="any_member">Any team member</option>
                  </select>
                </Field>
                <p className="text-xs font-bold mt-4 mb-2" style={{ color: 'var(--accent2)' }}>Submission fields</p>
                {(node.behavior.submission?.fields || []).map((field: any, idx: number) => (
                  <div key={field.id} className="p-3 rounded-lg mb-2 space-y-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="flex gap-2 items-start">
                      <div className="flex-1 space-y-2">
                        <input placeholder="Field title (e.g. Answer Sheet, Project Video)" value={field.title}
                          onChange={e => patchBehavior({
                            submission: {
                              ...node.behavior.submission,
                              fields: (node.behavior.submission?.fields || []).map((f: any, i: number) =>
                                i === idx ? { ...f, title: e.target.value } : f
                              )
                            }
                          })}
                          className={inputCls} style={inputStyle} />
                        <input placeholder="Description (e.g. Upload your answer sheet as PDF, max 6 pages)" value={field.description || ''}
                          onChange={e => patchBehavior({
                            submission: {
                              ...node.behavior.submission,
                              fields: (node.behavior.submission?.fields || []).map((f: any, i: number) =>
                                i === idx ? { ...f, description: e.target.value } : f
                              )
                            }
                          })}
                          className={inputCls} style={inputStyle} />
                      </div>
                      <button onClick={() => patchBehavior({
                        submission: {
                          ...node.behavior.submission,
                          fields: (node.behavior.submission?.fields || []).filter((_: any, i: number) => i !== idx)
                        }
                      })} style={{ color: 'var(--danger-soft)', marginTop: '4px' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Field type</label>
                        <select value={field.field_type}
                          onChange={e => patchBehavior({
                            submission: {
                              ...node.behavior.submission,
                              fields: (node.behavior.submission?.fields || []).map((f: any, i: number) =>
                                i === idx ? { ...f, field_type: e.target.value as any } : f
                              )
                            }
                          })}
                          className={inputCls} style={inputStyle}>
                          <option value="text">Short text</option>
                          <option value="textarea">Long text / paragraph</option>
                          <option value="file">File upload</option>
                        </select>
                      </div>
                      {field.field_type === 'file' && (
                        <>
                          <div>
                            <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Allowed file types (comma-separated)</label>
                            <input placeholder="pdf,jpg,png,mp4" value={(field.file_types || []).join(',')}
                              onChange={e => patchBehavior({
                                submission: {
                                  ...node.behavior.submission,
                                  fields: (node.behavior.submission?.fields || []).map((f: any, i: number) =>
                                    i === idx ? { ...f, file_types: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : f
                                  )
                                }
                              })}
                              className={inputCls} style={inputStyle} />
                          </div>
                          <div>
                            <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Max file size (MB)</label>
                            <input type="number" placeholder="5" value={field.max_file_size_mb || ''}
                              onChange={e => patchBehavior({
                                submission: {
                                  ...node.behavior.submission,
                                  fields: (node.behavior.submission?.fields || []).map((f: any, i: number) =>
                                    i === idx ? { ...f, max_file_size_mb: Number(e.target.value) } : f
                                  )
                                }
                              })}
                              className={inputCls} style={inputStyle} />
                          </div>
                          <div>
                            <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Max number of files</label>
                            <input type="number" placeholder="1" value={field.max_files || ''}
                              onChange={e => patchBehavior({
                                submission: {
                                  ...node.behavior.submission,
                                  fields: (node.behavior.submission?.fields || []).map((f: any, i: number) =>
                                    i === idx ? { ...f, max_files: Number(e.target.value) } : f
                                  )
                                }
                              })}
                              className={inputCls} style={inputStyle} />
                          </div>
                        </>
                      )}
                    </div>
                    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                      <input type="checkbox" checked={field.required}
                        onChange={e => patchBehavior({
                          submission: {
                            ...node.behavior.submission,
                            fields: (node.behavior.submission?.fields || []).map((f: any, i: number) =>
                              i === idx ? { ...f, required: e.target.checked } : f
                            )
                          }
                        })} />
                      Required
                    </label>
                  </div>
                ))}
                <button onClick={() => patchBehavior({
                  submission: {
                    ...node.behavior.submission,
                    fields: [
                      ...(node.behavior.submission?.fields || []),
                      { id: Math.random().toString(36).slice(2, 9), title: '', description: '', field_type: 'text', required: false }
                    ]
                  }
                })}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm"
                  style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
                  <Plus size={14} /> Add submission field
                </button>
              </div>
            )}
          </div>

          {/* Olympiad — real scheduled exam (MCQ, timer, subjects, relay). Points to
              an olympiad row that already exists. Admin explicitly creates the olympiad
              separately and links it here. Completely independent from Submission. */}
          <div className="rounded-lg p-3 my-2" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
            <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--white)' }}>
              <input type="checkbox" checked={!!node.behavior.linked_olympiad_id}
                disabled={creatingOlympiad}
                onChange={e => {
                  if (e.target.checked) {
                    // If there are no olympiads in the system, auto-create one
                    if (olympiadOptions.length === 0) {
                      createAndLinkOlympiad()
                    } else {
                      // Otherwise, set to the first available olympiad
                      patchBehavior({ linked_olympiad_id: olympiadOptions[0]?.id || '' })
                    }
                  } else {
                    // Unchecking clears the link
                    patchBehavior({ linked_olympiad_id: null })
                  }
                }} />
              Link this leaf to an Olympiad (real exam)
              {creatingOlympiad && <Loader2 size={12} className="animate-spin" style={{ color: 'var(--muted)' }} />}
            </label>
            {node.behavior.linked_olympiad_id && (
              <div className="mt-3">
                <Field label="Olympiad">
                  <select
                    value={node.behavior.linked_olympiad_id || ''}
                    onChange={e => patchBehavior({ linked_olympiad_id: e.target.value || null })}
                    className={inputCls} style={inputStyle}
                  >
                    <option value="">— none —</option>
                    {node.behavior.linked_olympiad_id && !olympiadOptions.some(o => o.id === node.behavior.linked_olympiad_id) && (
                      <option value={node.behavior.linked_olympiad_id}>Unknown olympiad ({node.behavior.linked_olympiad_id})</option>
                    )}
                    {olympiadOptions.map(o => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </select>
                  <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                    The activity dashboard fetches this olympiad's questions + relay state through this link.
                  </p>
                </Field>
                {olympiadGraphMap[node.behavior.linked_olympiad_id] && (
                  <a href={`/admin/form-builder/${olympiadGraphMap[node.behavior.linked_olympiad_id]}`}
                    className="inline-flex items-center gap-1.5 mt-2 text-xs px-2 py-1 rounded"
                    style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}
                    target="_blank" rel="noopener noreferrer">
                    <Plus size={12} /> Add exam questions for this Olympiad
                  </a>
                )}
              </div>
            )}
          </div>

          <div className="rounded-lg p-3 my-2" style={{ background: 'rgba(var(--accent2-rgb), 0.05)', border: '1px solid rgba(var(--accent2-rgb), 0.2)' }}>
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--accent2)' }}>Olympiad / exam options</p>
            <Field label="Override the graph's default timer (minutes)">
              <input type="number" min={1} value={node.behavior.timer_override_minutes || ''}
                onChange={e => patchBehavior({ timer_override_minutes: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="Leave blank to use graph default" className={inputCls} style={inputStyle} />
            </Field>
            <label className="flex items-center gap-2 text-sm my-2 cursor-pointer" style={{ color: 'var(--white)' }}>
              <input type="checkbox" checked={!!node.behavior.show_progress_bar} onChange={e => patchBehavior({ show_progress_bar: e.target.checked })} />
              Show progress bar at the top
            </label>
          </div>
        </Section>
      </div>

      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.8)' }} onClick={() => setConfirmDelete(false)}>
          <div className="w-full max-w-sm rounded-2xl p-6" style={{ background: 'var(--surface-deep)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-2" style={{ color: 'var(--white)' }}>Delete this form?</h3>
            <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
              This removes "{node.label}" and any child forms attached to it. This cannot be undone.
            </p>
            <div className="flex gap-2 justify-end">
              <button onClick={() => setConfirmDelete(false)} className="px-3 py-1.5 rounded text-sm" style={{ background: 'var(--bg2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>Cancel</button>
              <button onClick={remove} className="px-3 py-1.5 rounded text-sm font-bold" style={{ background: 'var(--danger-soft)', color: '#000' }}>Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function Section({ title, children, defaultOpen = false }: { title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div className="rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
      <button onClick={() => setOpen(v => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-bold"
        style={{ background: 'var(--surface)', color: 'var(--muted)', fontFamily: 'inherit' }}>
        {title}
        {open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
      </button>
      {open && <div className="p-4 space-y-3" style={{ background: 'var(--bg2)' }}>{children}</div>}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>{label}</label>
      {children}
    </div>
  )
}
