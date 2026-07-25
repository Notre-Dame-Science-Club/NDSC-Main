'use client'
import {
  Trash2, ChevronUp, ChevronDown, Heading, AlignLeft, Image as ImageIcon, Link2, Youtube,
  Minus, MoveVertical, Hash, ListChecks, CircleDot, CheckSquare, Calendar, Clock, Paperclip, Plus, X,
} from 'lucide-react'
import {
  FormBlock, FieldBlockType, ContentBlockType, FIELD_BLOCK_TYPES, CONTENT_BLOCK_TYPES,
  blankBlock, isFieldBlockType,
} from '@/lib/formBlocks'
import MathInputField from '@/components/olympiad/MathInputField'

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'
const inputStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }

const FIELD_ICONS: Record<FieldBlockType, any> = {
  text: AlignLeft, textarea: AlignLeft, number: Hash, dropdown: ListChecks,
  multiple_choice: CircleDot, checkboxes: CheckSquare, date: Calendar, time: Clock,
  photo: ImageIcon, file: Paperclip,
  mcq: CircleDot, checkbox: CheckSquare, short_answer: AlignLeft,
}
const CONTENT_ICONS: Record<ContentBlockType, any> = {
  header: Heading, paragraph: AlignLeft, image: ImageIcon, link_button: Link2,
  video: Youtube, divider: Minus, spacer: MoveVertical,
}

function iconFor(block: FormBlock) {
  return block.kind === 'field' ? FIELD_ICONS[block.type as FieldBlockType] : CONTENT_ICONS[block.type as ContentBlockType]
}
function labelFor(block: FormBlock) {
  const list = block.kind === 'field' ? FIELD_BLOCK_TYPES : CONTENT_BLOCK_TYPES
  return (list as any[]).find(t => t.type === block.type)?.label || block.type
}

export default function FormBlocksBuilder({ blocks, onChange, otherNodes }: { blocks: FormBlock[]; onChange: (blocks: FormBlock[]) => void; otherNodes?: { id: string; label: string }[] }) {
  const addBlock = (type: FieldBlockType | ContentBlockType) => onChange([...blocks, blankBlock(type)])
  const removeBlock = (id: string) => onChange(blocks.filter(b => b.id !== id))
  const patchBlock = (id: string, patch: Partial<FormBlock>) => onChange(blocks.map(b => b.id === id ? { ...b, ...patch } : b))
  const move = (idx: number, dir: -1 | 1) => {
    const to = idx + dir
    if (to < 0 || to >= blocks.length) return
    const next = [...blocks]
    ;[next[idx], next[to]] = [next[to], next[idx]]
    onChange(next)
  }

  return (
    <div className="space-y-4">
      {/* Palette */}
      <div className="grid sm:grid-cols-2 gap-3">
        <div>
          <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--border-soft)' }}>ADD CONTENT BLOCK</p>
          <div className="flex flex-wrap gap-1.5">
            {CONTENT_BLOCK_TYPES.map(t => {
              const Icon = CONTENT_ICONS[t.type]
              return (
                <button key={t.type} type="button" onClick={() => addBlock(t.type)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
                  style={{ background: 'rgba(var(--cat-teal-rgb), 0.1)', color: 'var(--cat-teal)', border: '1px solid rgba(var(--cat-teal-rgb), 0.25)' }}>
                  <Icon size={12} /> {t.label}
                </button>
              )
            })}
          </div>
        </div>
        <div>
          <p className="text-xs font-bold mb-1.5" style={{ color: 'var(--border-soft)' }}>ADD FORM FIELD</p>
          <div className="flex flex-wrap gap-1.5">
            {FIELD_BLOCK_TYPES.map(t => {
              const Icon = FIELD_ICONS[t.type]
              return (
                <button key={t.type} type="button" onClick={() => addBlock(t.type)}
                  className="flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-lg"
                  style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.25)' }}>
                  <Icon size={12} /> {t.label}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Block list */}
      {blocks.length === 0 && (
        <p className="text-xs" style={{ color: 'var(--border-soft)' }}>No blocks yet — add one above. Blocks render in this order on the public form.</p>
      )}
      <div className="space-y-2">
        {blocks.map((block, idx) => {
          const Icon = iconFor(block)
          return (
            <div key={block.id} className="rounded-lg border" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 px-3 py-2 border-b" style={{ borderColor: 'var(--border)' }}>
                <span className="flex items-center gap-1.5 text-xs font-semibold px-2 py-1 rounded"
                  style={{ background: block.kind === 'field' ? 'rgba(var(--blue-rgb), 0.12)' : 'rgba(var(--cat-teal-rgb), 0.12)', color: block.kind === 'field' ? 'var(--blue)' : 'var(--cat-teal)' }}>
                  {Icon && <Icon size={12} />} {labelFor(block)}
                </span>
                <div className="flex-1" />
                <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="disabled:opacity-30" style={{ color: 'var(--muted)' }}><ChevronUp size={15} /></button>
                <button type="button" onClick={() => move(idx, 1)} disabled={idx === blocks.length - 1} className="disabled:opacity-30" style={{ color: 'var(--muted)' }}><ChevronDown size={15} /></button>
                <button type="button" onClick={() => removeBlock(block.id)} style={{ color: 'var(--danger-soft)' }}><Trash2 size={14} /></button>
              </div>
              <div className="p-3 space-y-2">
                <BlockSettings block={block} onPatch={patch => patchBlock(block.id, patch)} otherNodes={otherNodes} />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function BlockSettings({ block, onPatch, otherNodes }: { block: FormBlock; onPatch: (patch: Partial<FormBlock>) => void; otherNodes?: { id: string; label: string }[] }) {
  if (block.kind === 'field') {
    return (
      <>
        <input placeholder={block.type === 'mcq' || block.type === 'checkbox' || block.type === 'short_answer' ? 'Question text *' : 'Field title *'}
          value={block.label || ''} onChange={e => onPatch({ label: e.target.value })} className={inputCls} style={inputStyle} />
        <input placeholder="Description / helper text (optional)" value={block.description || ''} onChange={e => onPatch({ description: e.target.value })} className={inputCls} style={inputStyle} />
        {(block.type === 'dropdown' || block.type === 'multiple_choice' || block.type === 'checkboxes') && (
          <>
            <div className="space-y-1.5">
              {(block.options || []).map((opt, oi) => (
                <div key={oi} className="flex items-center gap-2">
                  <MathInputField value={opt}
                    onChange={v => onPatch({ options: (block.options || []).map((o, i) => i === oi ? v : o) })}
                    placeholder="Option text" className={inputCls} style={{ ...inputStyle, padding: '6px 10px' }} />
                  <button type="button" onClick={() => onPatch({ options: (block.options || []).filter((_, i) => i !== oi) })}
                    style={{ color: 'var(--danger-soft)' }}><X size={14} /></button>
                </div>
              ))}
            </div>
            <button type="button" onClick={() => onPatch({ options: [...(block.options || []), ''] })}
              className="text-xs flex items-center gap-1" style={{ color: 'var(--blue)' }}>
              <Plus size={11} /> Add option
            </button>
            {block.type === 'dropdown' && (
              <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                <input type="checkbox" checked={!!block.allow_other} onChange={e => onPatch({ allow_other: e.target.checked })} />
                Let people type their own option ("Other…")
              </label>
            )}
          </>
        )}

        {/* Olympiad question field editors. mcq/checkbox render a list of
            options with a "correct" radio/checkbox next to each; the
            visitor never sees the correct answer. short_answer just has
            marks. The public renderer reads the same shape, so the same
            field is also used to render the question to the student. */}
        {(block.type === 'mcq' || block.type === 'checkbox') && (
          <OlympiadOptionsEditor block={block} onPatch={onPatch} />
        )}

        {(block.type === 'mcq' || block.type === 'checkbox' || block.type === 'short_answer') && (
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              <label className="text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>Marks</label>
              <input type="number" min={0} step={0.5} value={block.marks ?? 1}
                onChange={e => onPatch({ marks: e.target.value ? Number(e.target.value) : undefined })}
                className={inputCls} style={{ ...inputStyle, maxWidth: 80 }} />
            </div>
            <Field label="" labelStyle={{ display: 'none' }}>
              <input placeholder="Answer storage key (optional — auto from id)"
                value={block.key || ''} onChange={e => onPatch({ key: e.target.value })}
                className={inputCls} style={{ ...inputStyle, maxWidth: 280 }} />
            </Field>
          </div>
        )}

        {(block.type === 'photo' || block.type === 'file') && (
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2">
              <label className="text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>Max size (MB)</label>
              <input type="number" min={1} placeholder="5" value={block.max_file_size_mb ?? ''}
                onChange={e => onPatch({ max_file_size_mb: e.target.value ? Number(e.target.value) : undefined })}
                className={inputCls} style={{ ...inputStyle, maxWidth: 90 }} />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>Max files</label>
              <input type="number" min={1} placeholder="1" value={block.max_files ?? ''}
                onChange={e => onPatch({ max_files: e.target.value ? Number(e.target.value) : undefined })}
                className={inputCls} style={{ ...inputStyle, maxWidth: 90 }} />
            </div>
          </div>
        )}
        <div className="flex items-center gap-4 flex-wrap">
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={!!block.required} onChange={e => onPatch({ required: e.target.checked })} />
            Required
          </label>
          {block.type !== 'mcq' && block.type !== 'checkbox' && block.type !== 'short_answer' && (
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }} title="If two registrants submit the same value for this field, the second submission is rejected. The form will also show a live 'already registered' notice.">
              <input type="checkbox" checked={!!block.unique_field} onChange={e => onPatch({ unique_field: e.target.checked })} />
              Unique field (no duplicates across this event)
            </label>
          )}
        </div>
      </>
    )
  }

  switch (block.type) {
    case 'header':
      return (
        <>
          <input placeholder="Header text" value={block.text || ''} onChange={e => onPatch({ text: e.target.value })} className={inputCls} style={inputStyle} />
          <select value={block.heading_size || 'md'} onChange={e => onPatch({ heading_size: e.target.value as 'lg' | 'md' })} className={inputCls} style={inputStyle}>
            <option value="md">Medium</option>
            <option value="lg">Large</option>
          </select>
        </>
      )
    case 'paragraph':
      return <textarea rows={3} placeholder="Text shown to registrants" value={block.text || ''} onChange={e => onPatch({ text: e.target.value })} className={inputCls + ' resize-none'} style={inputStyle} />
    case 'image':
      return (
        <>
          <input placeholder="Image URL" value={block.image_url || ''} onChange={e => onPatch({ image_url: e.target.value })} className={inputCls} style={inputStyle} />
          <input placeholder="Alt text (optional)" value={block.image_alt || ''} onChange={e => onPatch({ image_alt: e.target.value })} className={inputCls} style={inputStyle} />
          {block.image_url && <img src={block.image_url} alt="" className="mt-1 rounded-lg w-full max-h-32 object-cover" />}
        </>
      )
    case 'link_button':
      return (
        <div className="space-y-1.5">
          <div className="flex gap-2">
            <input placeholder="Button label" value={block.link_label || ''} onChange={e => onPatch({ link_label: e.target.value })} className={inputCls} style={inputStyle} />
            <input placeholder="https://..." value={block.link_url || ''} onChange={e => onPatch({ link_url: e.target.value })} className={inputCls} style={inputStyle} />
          </div>
          {otherNodes && otherNodes.length > 0 && (
            <select
              value={(block as any).target_node_id || ''}
              onChange={e => onPatch({ target_node_id: e.target.value || undefined } as any)}
              className={inputCls} style={inputStyle}>
              <option value="">— No jump (use link_url above) —</option>
              {otherNodes.map(n => <option key={n.id} value={n.id}>→ Jump to: {n.label}</option>)}
            </select>
          )}
        </div>
      )
    case 'video':
      return (
        <>
          <input placeholder="Video URL (YouTube/Vimeo embed link)" value={block.video_url || ''} onChange={e => onPatch({ video_url: e.target.value })} className={inputCls} style={inputStyle} />
          <p className="text-xs" style={{ color: 'var(--border-soft)' }}>Use an embed URL, e.g. https://www.youtube.com/embed/VIDEO_ID</p>
        </>
      )
    case 'spacer':
      return (
        <div className="flex items-center gap-2">
          <label className="text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>Height (px)</label>
          <input type="number" min={4} max={200} value={block.height_px ?? 24} onChange={e => onPatch({ height_px: Number(e.target.value) || 24 })} className={inputCls} style={{ ...inputStyle, maxWidth: 90 }} />
        </div>
      )
    case 'divider':
      return <p className="text-xs" style={{ color: 'var(--border-soft)' }}>A plain horizontal divider — no settings needed.</p>
    default:
      return null
  }
}

// Editor for the mcq/checkbox option list. Each option has text and a
// "correct" flag. Options are stored as { id, text }[] on FormBlock.mcq_options
// (NOT the legacy `options: string[]` — that field is for dropdowns).
function OlympiadOptionsEditor({ block, onPatch }: { block: FormBlock; onPatch: (patch: Partial<FormBlock>) => void }) {
  const options = block.mcq_options || []
  const isMulti = block.type === 'checkbox'

  const uid = () => Math.random().toString(36).slice(2, 9)

  const update = (next: { id: string; text: string }[]) => onPatch({ mcq_options: next })
  const setText = (idx: number, text: string) =>
    update(options.map((o, i) => i === idx ? { ...o, text } : o))
  const remove = (idx: number) => update(options.filter((_, i) => i !== idx))
  const add = () => update([...options, { id: uid(), text: '' }])

  const isCorrect = (idx: number) => {
    if (isMulti) return (block.correct_option_ids || []).includes(options[idx]?.id)
    return block.correct_option_id === options[idx]?.id
  }
  const toggleCorrect = (idx: number) => {
    if (isMulti) {
      const current = block.correct_option_ids || []
      const id = options[idx]?.id
      const next = current.includes(id) ? current.filter(x => x !== id) : [...current, id]
      onPatch({ correct_option_ids: next })
    } else {
      onPatch({ correct_option_id: isCorrect(idx) ? undefined : options[idx]?.id })
    }
  }

  return (
    <div className="rounded-lg p-2.5 space-y-1.5" style={{ background: 'rgba(var(--accent2-rgb), 0.05)', border: '1px solid rgba(var(--accent2-rgb), 0.2)' }}>
      <p className="text-[10px] font-bold tracking-wider flex items-center gap-1.5" style={{ color: 'var(--accent2)' }}>
        OPTIONS &nbsp;·&nbsp; mark the correct one{isMulti ? 's' : ''}
      </p>
      {options.map((opt, oi) => (
        <div key={opt.id || oi} className="flex items-center gap-2">
          <input type={isMulti ? 'checkbox' : 'radio'} name={`correct-${block.id}`} checked={isCorrect(oi)}
            onChange={() => toggleCorrect(oi)} className="flex-shrink-0"
            style={{ accentColor: 'var(--accent2)' }} />
          <input value={opt.text} onChange={e => setText(oi, e.target.value)}
            placeholder={`Option ${oi + 1}`} className={inputCls} style={{ ...inputStyle, padding: '6px 10px' }} />
          <button type="button" onClick={() => remove(oi)} style={{ color: 'var(--danger-soft)' }}><X size={14} /></button>
        </div>
      ))}
      <button type="button" onClick={add}
        className="text-xs flex items-center gap-1" style={{ color: 'var(--accent2)' }}>
        <Plus size={11} /> Add option
      </button>
    </div>
  )
}

// Tiny local field-label helper used by the olympiad block settings (the
// shared components/ui Field would pull in too much; this is two lines).
function Field({ label, children, labelStyle }: { label: string; children: React.ReactNode; labelStyle?: React.CSSProperties }) {
  if (!label) return <>{children}</>
  return (
    <div>
      <label className="block text-xs mb-1" style={{ color: 'var(--muted)', ...labelStyle }}>{label}</label>
      {children}
    </div>
  )
}
