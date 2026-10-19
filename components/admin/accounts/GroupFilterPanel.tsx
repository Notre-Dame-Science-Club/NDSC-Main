'use client'
import { useMemo } from 'react'
import { computeStats, NO_BATCH, type Account, type AccountKind } from '@/lib/accountStats'
import { distinct, EMPTY_GROUP, type GroupFilter } from '@/lib/bulkRecipients'
import { card, chipOn, field } from './ui'

const TYPES: { kind: AccountKind; label: string }[] = [
  { kind: 'member', label: 'Club members' }, { kind: 'user', label: 'Website users' },
  { kind: 'pending', label: 'Pending applications' }, { kind: 'rejected', label: 'Rejected' },
]

function Chips({ title, options, selected, onToggle, onClear, hint }: {
  title: string; options: { value: string; label?: string; count: number }[]; selected: string[]
  onToggle: (v: string) => void; onClear: () => void; hint?: string
}) {
  if (!options.length) return null
  return (
    <div className="mb-4">
      <div className="flex items-center justify-between mb-1.5">
        <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
          {title} {selected.length ? `(${selected.length} selected)` : '(any)'}{hint ? <span style={{ opacity: .7 }}> · {hint}</span> : null}
        </label>
        {selected.length > 0 && <button onClick={onClear} className="text-xs underline" style={{ color: 'var(--blue)' }}>clear</button>}
      </div>
      <div className="flex flex-wrap gap-2 max-h-28 overflow-y-auto">
        {options.map(o => {
          const on = selected.includes(o.value)
          return (
            <button key={o.value} onClick={() => onToggle(o.value)} className="px-2.5 py-1 rounded-full text-xs border"
              style={on ? chipOn : field}>{o.label ?? o.value} <span style={{ opacity: .7 }}>· {o.count}</span></button>
          )
        })}
      </div>
    </div>
  )
}

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter(x => x !== v) : [...list, v])

/** Flexible "who" picker: any mix of type, college, batch, department, level, HSC session and free text. */
export default function GroupFilterPanel({ accounts, filter, onChange }: {
  accounts: Account[]; filter: GroupFilter; onChange: (f: GroupFilter) => void
}) {
  const stats = useMemo(() => computeStats(accounts), [accounts])
  const departments = useMemo(() => distinct(accounts, a => a.department), [accounts])
  const levels = useMemo(() => distinct(accounts, a => a.education_level), [accounts])
  const sessions = useMemo(() => distinct(accounts, a => a.hsc_session), [accounts])
  const set = (p: Partial<GroupFilter>) => onChange({ ...filter, ...p })

  // College chips either pick colleges to include or, in "everyone except" mode, colleges to leave out.
  const exclude = filter.excludeColleges.length > 0
  const collegeSel = exclude ? filter.excludeColleges : filter.colleges
  const setCollegeSel = (list: string[]) => set(exclude ? { excludeColleges: list, colleges: [] } : { colleges: list, excludeColleges: [] })
  const flip = () => set(exclude ? { colleges: filter.excludeColleges, excludeColleges: [] } : { excludeColleges: filter.colleges, colleges: [] })

  const active = JSON.stringify(filter) !== JSON.stringify(EMPTY_GROUP)

  return (
    <section className="p-4 rounded-xl border" style={card}>
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <input value={filter.search} onChange={e => set({ search: e.target.value })} placeholder="Search name, email, phone, college, roll…"
          className="flex-1 min-w-[200px] px-3 py-2 rounded-lg text-sm border outline-none" style={field} />
        {active && <button onClick={() => onChange(EMPTY_GROUP)} className="text-xs underline" style={{ color: 'var(--muted)' }}>Reset filters</button>}
      </div>

      <div className="mb-4">
        <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Account type {filter.types.length ? '' : '(everyone)'}</label>
        <div className="flex flex-wrap gap-2">
          {TYPES.map(t => (
            <button key={t.kind} className="px-2.5 py-1 rounded-full text-xs border" style={filter.types.includes(t.kind) ? chipOn : field}
              onClick={() => set({ types: filter.types.includes(t.kind) ? filter.types.filter(k => k !== t.kind) : [...filter.types, t.kind] })}>{t.label}</button>
          ))}
        </div>
      </div>

      <Chips title={exclude ? 'Everyone EXCEPT these colleges' : 'College'}
        options={stats.byCollege.map(c => ({ value: c.key, label: c.label, count: c.total }))}
        selected={collegeSel} onToggle={v => setCollegeSel(toggle(collegeSel, v))} onClear={() => setCollegeSel([])} />
      {(filter.colleges.length > 0 || exclude) && (
        <label className="flex items-center gap-2 text-xs -mt-2 mb-4 cursor-pointer" style={{ color: 'var(--muted)' }}>
          <input type="checkbox" checked={exclude} onChange={flip} /> Send to everyone except the colleges selected
        </label>
      )}
      <Chips title="Batch" options={stats.byBatch.map(b => ({ value: b.batch, label: b.batch === NO_BATCH ? '(no batch)' : b.batch, count: b.total }))}
        selected={filter.batches} onToggle={v => set({ batches: toggle(filter.batches, v) })} onClear={() => set({ batches: [] })} />
      <Chips title="Department" options={departments} selected={filter.departments}
        onToggle={v => set({ departments: toggle(filter.departments, v) })} onClear={() => set({ departments: [] })} />
      <Chips title="Education level" options={levels} selected={filter.levels}
        onToggle={v => set({ levels: toggle(filter.levels, v) })} onClear={() => set({ levels: [] })} />
      <Chips title="HSC session" options={sessions} selected={filter.sessions}
        onToggle={v => set({ sessions: toggle(filter.sessions, v) })} onClear={() => set({ sessions: [] })} />
    </section>
  )
}
