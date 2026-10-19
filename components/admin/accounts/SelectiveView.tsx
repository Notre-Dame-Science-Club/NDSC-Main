'use client'
import { useMemo, useState } from 'react'
import { filterGroup, type GroupFilter } from '@/lib/bulkRecipients'
import { canonicalCollege } from '@/lib/college'
import { kindOf, type Account } from '@/lib/accountStats'
import GroupFilterPanel from './GroupFilterPanel'
import { card, ghostBtn, primaryBtn } from './ui'

const KIND_LABEL = { member: 'Member', pending: 'Pending', rejected: 'Rejected', user: 'User' } as const
const PAGE = 100

/** Browse accounts with any filters, tick the ones you want (kept while you switch tabs), then send to them. */
export default function SelectiveView({ accounts, filter, setFilter, selected, setSelected, onSend }: {
  accounts: Account[]; filter: GroupFilter; setFilter: (f: GroupFilter) => void
  selected: Set<string>; setSelected: (s: Set<string>) => void; onSend: () => void
}) {
  const rows = useMemo(() => filterGroup(accounts, filter), [accounts, filter])
  const [shown, setShown] = useState(PAGE)
  const allOn = rows.length > 0 && rows.every(a => selected.has(a.id))
  const flip = (id: string) => { const n = new Set(selected); n.has(id) ? n.delete(id) : n.add(id); setSelected(n) }
  const selectAll = () => { const n = new Set(selected); rows.forEach(a => n.add(a.id)); setSelected(n) }
  const unselectShown = () => { const n = new Set(selected); rows.forEach(a => n.delete(a.id)); setSelected(n) }
  const th = 'text-left px-3 py-2 font-medium'

  return (
    <div className="space-y-4">
      <GroupFilterPanel accounts={accounts} filter={filter} onChange={f => { setFilter(f); setShown(PAGE) }} />

      <div className="flex items-center gap-3 flex-wrap">
        <span className="text-sm" style={{ color: 'var(--white)' }}><b>{rows.length.toLocaleString()}</b> match · <b>{selected.size.toLocaleString()}</b> selected</span>
        <button onClick={selectAll} disabled={!rows.length} className="px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50" style={ghostBtn}>Select all {rows.length.toLocaleString()} matching</button>
        <button onClick={unselectShown} disabled={!rows.length} className="px-3 py-1.5 rounded text-xs font-bold disabled:opacity-50" style={ghostBtn}>Unselect matching</button>
        <button onClick={() => setSelected(new Set())} disabled={!selected.size} className="text-xs underline disabled:opacity-50" style={{ color: 'var(--muted)' }}>Clear selection</button>
        <button onClick={onSend} disabled={!selected.size} className="ml-auto px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50" style={primaryBtn}>
          Send to {selected.size.toLocaleString()} selected →
        </button>
      </div>

      <div className="rounded-xl border overflow-x-auto" style={card}>
        <table className="w-full text-sm">
          <thead>
            <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(var(--blue-rgb), 0.05)', color: 'var(--muted)' }}>
              <th className={th}><input type="checkbox" checked={allOn} onChange={() => (allOn ? unselectShown() : selectAll())} title="Select / unselect everything matching" /></th>
              <th className={th}>Name</th><th className={th}>Phone</th><th className={th}>Email</th><th className={th}>College</th>
              <th className={th}>Batch</th><th className={th}>Dept</th><th className={th}>Type</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, shown).map(a => (
              <tr key={a.id} onClick={() => flip(a.id)} className="cursor-pointer"
                style={{ borderBottom: '1px solid var(--surface-alt)', color: 'var(--white)', background: selected.has(a.id) ? 'rgba(var(--blue-rgb), 0.08)' : undefined }}>
                <td className="px-3 py-2"><input type="checkbox" checked={selected.has(a.id)} onChange={() => flip(a.id)} onClick={e => e.stopPropagation()} /></td>
                <td className="px-3 py-2">{a.full_name || '—'}</td>
                <td className="px-3 py-2 whitespace-nowrap">{a.phone || <span style={{ color: 'var(--muted)' }}>—</span>}</td>
                <td className="px-3 py-2">{a.email || '—'}</td>
                <td className="px-3 py-2">{canonicalCollege(a.institution) || '—'}</td>
                <td className="px-3 py-2">{a.batch || '—'}</td>
                <td className="px-3 py-2">{a.department || '—'}</td>
                <td className="px-3 py-2">{KIND_LABEL[kindOf(a)]}</td>
              </tr>
            ))}
            {!rows.length && <tr><td colSpan={8} className="px-3 py-6 text-center" style={{ color: 'var(--muted)' }}>No accounts match these filters.</td></tr>}
          </tbody>
        </table>
        {rows.length > shown && (
          <div className="p-3 text-center"><button onClick={() => setShown(s => s + PAGE)} className="text-xs underline" style={{ color: 'var(--blue)' }}>Show {Math.min(PAGE, rows.length - shown)} more ({rows.length - shown} hidden)</button></div>
        )}
      </div>
    </div>
  )
}
