'use client'
import { useState } from 'react'
import FormBlocksBuilder from './FormBlocksBuilder'
import { FormBlock, normalizeBlocks, HARD_MINIMUM_KEYS, BuiltinFieldKey } from '@/lib/formBlocks'
import { AlertTriangle } from 'lucide-react'

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'
const inputStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }

// Wraps FormBlocksBuilder with a "Built-in" badge for the 7 default fields
// and a confirmation modal when admin tries to delete a built-in field —
// because deletion removes the answer from the top-level registration column
// (and the server still requires the hard minimum regardless of schema).
export default function FieldsEditor({
  blocks,
  onChange,
  label = 'Form Fields',
  description,
}: {
  blocks: FormBlock[]
  onChange: (blocks: FormBlock[]) => void
  label?: string
  description?: string
}) {
  const [pendingDelete, setPendingDelete] = useState<FormBlock | null>(null)

  const safeBlocks = normalizeBlocks(blocks)
  const hardMinSet = new Set<string>(HARD_MINIMUM_KEYS)

  // Wrap FormBlocksBuilder's delete to gate built-in field deletion through
  // the confirmation modal. The simplest way: add a tiny "delete attempt"
  // guard in front — but the easier route is to intercept via a custom
  // onChange that rejects built-in deletes unless confirmed.
  //
  // Approach: re-implement the remove step here, then forward onChange. We
  // duplicate just enough of the builder to add a confirmation prompt, but
  // we still render FormBlocksBuilder for everything else.

  const handleChange = (next: FormBlock[]) => {
    // Diff: was there a removal between blocks and next?
    const beforeIds = new Set(blocks.map(b => b.id))
    const afterIds = new Set(next.map(b => b.id))
    const removed = blocks.find(b => !afterIds.has(b.id))
    if (removed && (removed as any).is_builtin) {
      setPendingDelete(removed)
      return // do not commit; wait for confirmation
    }
    onChange(next)
  }

  const confirmDelete = () => {
    if (!pendingDelete) return
    onChange(blocks.filter(b => b.id !== pendingDelete.id))
    setPendingDelete(null)
  }

  return (
    <div className="space-y-3">
      <div>
        <p className="text-xs font-bold mb-1" style={{ color: 'var(--muted)' }}>{label}</p>
        {description && <p className="text-xs mb-2" style={{ color: 'var(--border-soft)' }}>{description}</p>}
        <div className="space-y-1.5">
          {safeBlocks.filter(b => (b as any).is_builtin).length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {safeBlocks.filter(b => (b as any).is_builtin).map(b => (
                <span key={b.id} className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(var(--accent2-rgb), 0.12)', color: 'var(--accent2)', border: '1px solid rgba(var(--accent2-rgb), 0.25)' }}>
                  built-in: {(b as any).is_builtin}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <FormBlocksBuilder blocks={safeBlocks} onChange={handleChange} />

      {pendingDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setPendingDelete(null)}>
          <div className="max-w-md w-full rounded-2xl p-5 space-y-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center gap-2">
              <AlertTriangle size={18} style={{ color: 'var(--warning)' }} />
              <h3 className="font-bold" style={{ color: 'var(--white)' }}>Delete built-in field?</h3>
            </div>
            <p className="text-sm" style={{ color: 'var(--muted)' }}>
              <span className="font-semibold" style={{ color: 'var(--white)' }}>{(pendingDelete as any).is_builtin}</span> is a
              built-in field — its answer also writes to a dedicated column on the
              registration record. Deleting it here will no longer show or store the
              answer in that column.
            </p>
            <p className="text-xs" style={{ color: 'var(--border-soft)' }}>
              The server still requires <span className="font-mono">full_name</span>, <span className="font-mono">phone</span>,
              <span className="font-mono"> email</span> and <span className="font-mono">college_roll</span> for every registration,
              so the form will fall back to collecting them automatically.
            </p>
            <div className="flex justify-end gap-2 pt-2">
              <button onClick={() => setPendingDelete(null)}
                className="px-3 py-1.5 rounded text-sm"
                style={{ background: 'var(--bg2)', color: 'var(--muted)' }}>
                Cancel
              </button>
              <button onClick={confirmDelete}
                className="px-3 py-1.5 rounded text-sm font-bold"
                style={{ background: 'var(--danger-soft)', color: '#000' }}>
                Delete anyway
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
