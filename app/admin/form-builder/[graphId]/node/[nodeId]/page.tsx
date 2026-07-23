'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { ArrowLeft, Save, Loader2, Trash2, Check, ChevronDown, ChevronRight, Image as ImageIcon, Eye, EyeOff, Info } from 'lucide-react'
import FormBlocksBuilder from '@/components/admin/FormBlocksBuilder'
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
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showAnswerKey, setShowAnswerKey] = useState<Record<string, boolean>>({})

  useEffect(() => {
    (async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/admin/form-graphs/${graphId}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.error || 'Failed to load graph.')
        setGraph(data.graph)
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
  }, [graphId, nodeId])

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

      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="min-w-0">
          <p className="text-[10px] font-bold tracking-wider" style={{ color: 'var(--muted)' }}>
            {FORM_NODE_KIND_LABEL[node.kind]} · {graph?.title}
          </p>
          <input value={node.label} onChange={e => patch({ label: e.target.value })}
            className="text-2xl font-black bg-transparent outline-none w-full mt-0.5"
            style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }} />
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
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
          <FormBlocksBuilder blocks={node.fields} onChange={blocks => patch({ fields: blocks })} otherNodes={otherNodes} />

          {node.fields.some(f => f.type === 'mcq' || f.type === 'checkbox' || f.type === 'short_answer') && (
            <div className="mt-4 rounded-lg p-3 text-xs" style={{ background: 'rgba(var(--accent2-rgb), 0.08)', color: 'var(--accent2)', border: '1px solid rgba(var(--accent2-rgb), 0.3)' }}>
              <p className="font-semibold flex items-center gap-1.5"><Info size={12} /> Olympiad question fields</p>
              <p className="mt-1">For these fields, the <strong>label</strong> is the question text, and the <strong>key</strong> is what the answer is stored under in the registration row. Marks and correct answers are below each field.</p>
              <p className="mt-1">When this node has <code>kind = preset_olympiad_questions</code> and is a child of the root, the runner starts the timer when the visitor lands on this form.</p>
            </div>
          )}

          {node.kind === 'preset_common_details' && node.fields.length === 0 && (
            <button onClick={() => patch({ fields: builtinFieldDefs() })}
              className="mt-3 px-3 py-1.5 rounded text-xs font-bold"
              style={{ background: 'rgba(var(--cat-teal-rgb), 0.12)', color: 'var(--cat-teal)', border: '1px solid rgba(var(--cat-teal-rgb), 0.3)' }}>
              + Seed with the 7 default identity fields
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
                placeholder="Inherits from the graph" className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Subtitle / description">
              <input value={node.appearance.subtitle || ''} onChange={e => patchAppearance({ subtitle: e.target.value })}
                className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Cover photo URL">
              <input value={node.appearance.cover_photo_url || ''} onChange={e => patchAppearance({ cover_photo_url: e.target.value })}
                placeholder="https://..." className={inputCls} style={inputStyle} />
            </Field>
            <Field label="Cover aspect ratio">
              <select value={node.appearance.cover_aspect_ratio || 'auto'} onChange={e => patchAppearance({ cover_aspect_ratio: e.target.value })}
                className={inputCls} style={inputStyle}>
                {COVER_RATIO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
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
                <input type="color" value={node.appearance.bg_theme?.startsWith('#') ? node.appearance.bg_theme : 'var(--blue)'}
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
        </Section>

        <Section title="Behavior" defaultOpen>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            What this form does beyond collecting answers: team info, payment, schedule, project name, olympiad timer.
          </p>

          <Field label="Schedule (date / time / room) — shown above the form">
            <div className="grid grid-cols-3 gap-2">
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
              <div className="mt-3 grid grid-cols-3 gap-2">
                <Field label="Min team size"><input type="number" min={0} value={node.behavior.require_team.min ?? 0} onChange={e => patchBehavior({ require_team: { ...(node.behavior.require_team || {}), min: Number(e.target.value) } })} className={inputCls} style={inputStyle} /></Field>
                <Field label="Max team size"><input type="number" min={1} value={node.behavior.require_team.max ?? 5} onChange={e => patchBehavior({ require_team: { ...(node.behavior.require_team || {}), max: Number(e.target.value) } })} className={inputCls} style={inputStyle} /></Field>
                <Field label="Password required">
                  <select value={node.behavior.require_team.password_required ? 'yes' : 'no'} onChange={e => patchBehavior({ require_team: { ...(node.behavior.require_team || {}), password_required: e.target.value === 'yes' } })}
                    className={inputCls} style={inputStyle}>
                    <option value="yes">Yes</option>
                    <option value="no">No</option>
                  </select>
                </Field>
                <label className="col-span-3 flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                  <input type="checkbox" checked={!!node.behavior.require_team.optional} onChange={e => patchBehavior({ require_team: { ...(node.behavior.require_team || {}), optional: e.target.checked } })} />
                  Allow registering alone (team optional)
                </label>
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
              <div className="mt-3 grid grid-cols-2 gap-2">
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

          <label className="flex items-center gap-2 text-sm my-2 cursor-pointer" style={{ color: 'var(--white)' }}>
            <input type="checkbox" checked={!!node.behavior.is_online_submission} onChange={e => patchBehavior({ is_online_submission: e.target.checked })} />
            This form includes an online round (link shown in user dashboard)
          </label>

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
        style={{ background: 'var(--surface)', color: 'var(--muted)', fontFamily: "'Orbitron', sans-serif" }}>
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
