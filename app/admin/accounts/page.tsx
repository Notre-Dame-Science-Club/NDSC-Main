'use client'
import { Suspense, useCallback, useEffect, useMemo, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { Download, RefreshCw, Users, UserCheck, UserRound, GraduationCap, Hourglass, School } from 'lucide-react'
import BulkAddPanel from '@/components/admin/BulkAddPanel'
import SelectiveView from '@/components/admin/accounts/SelectiveView'
import GroupFilterPanel from '@/components/admin/accounts/GroupFilterPanel'
import Sender from '@/components/admin/accounts/Sender'
import { EMPTY_GROUP, filterGroup, type GroupFilter } from '@/lib/bulkRecipients'
import {
  computeStats, filterAccounts, accountsToCsv, exportFileName, CSV_COLUMNS, DEFAULT_CSV_COLUMNS,
  EMPTY_FILTER, NO_BATCH, type Account, type AccountFilter, type TypeFilter,
} from '@/lib/accountStats'

const card = { background: 'var(--bg2)', borderColor: 'var(--border)' }
const heading = { fontFamily: 'inherit', color: 'var(--blue)' }
const field = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }
const ghostBtn = { background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }

function downloadCsv(name: string, csv: string) {
  const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }) // BOM so Excel reads UTF-8 names
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = name
  a.click()
  URL.revokeObjectURL(url)
}

function Stat({ icon, label, value, hint }: { icon: React.ReactNode; label: string; value: number; hint?: string }) {
  return (
    <div className="p-4 rounded-xl border" style={card}>
      <div className="flex items-center gap-2 text-xs mb-2" style={{ color: 'var(--muted)' }}>{icon}{label}</div>
      <div className="text-2xl font-bold" style={{ color: 'var(--white)' }}>{value.toLocaleString()}</div>
      {hint && <div className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>{hint}</div>}
    </div>
  )
}

function Overview() {
  const [accounts, setAccounts] = useState<Account[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [filter, setFilter] = useState<AccountFilter>(EMPTY_FILTER)
  const [columns, setColumns] = useState<string[]>(DEFAULT_CSV_COLUMNS)

  const load = useCallback(async () => {
    setLoading(true); setError('')
    try {
      const res = await fetch('/api/admin/accounts')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load accounts')
      setAccounts(data.accounts || [])
    } catch (e: any) {
      setError(e.message || 'Could not load accounts')
    } finally { setLoading(false) }
  }, [])
  useEffect(() => { load() }, [load])

  const stats = useMemo(() => computeStats(accounts), [accounts])
  const filtered = useMemo(() => filterAccounts(accounts, filter), [accounts, filter])
  const t = stats.totals

  const collegeLabel = (f: AccountFilter) => stats.byCollege.find(c => `key:${c.key}` === f.college)?.label
  const download = (f: AccountFilter, rows = filterAccounts(accounts, f)) =>
    downloadCsv(exportFileName(f, collegeLabel(f)), accountsToCsv(rows, columns))

  const set = (patch: Partial<AccountFilter>) => setFilter(f => ({ ...f, ...patch }))
  const toggleBatch = (b: string) =>
    set({ batches: filter.batches.includes(b) ? filter.batches.filter(x => x !== b) : [...filter.batches, b] })
  const toggleColumn = (k: string) =>
    setColumns(cs => (cs.includes(k) ? cs.filter(x => x !== k) : [...cs, k]))

  if (loading) return <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading accounts…</p>
  if (error) return <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>

  const th = 'text-left px-4 py-2.5 font-medium'
  const num = 'px-4 py-2.5 text-right tabular-nums'

  return (
    <div className="space-y-8">
      <div className="flex justify-end">
        <button onClick={load} className="flex items-center gap-1.5 px-3 py-1.5 rounded text-xs font-bold" style={ghostBtn}>
          <RefreshCw size={12} /> Refresh
        </button>
      </div>

      {/* Headline numbers */}
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
        <Stat icon={<Users size={14} />} label="All accounts" value={t.total} />
        <Stat icon={<UserCheck size={14} />} label="Club members" value={t.members} />
        <Stat icon={<UserRound size={14} />} label="Website users" value={t.users} hint="everyone who is not a member" />
        <Stat icon={<GraduationCap size={14} />} label="From Notre Dame College" value={t.ndc} hint={`${t.ndcNotMembers} not members yet`} />
        <Stat icon={<School size={14} />} label="Other colleges" value={t.otherColleges} hint={t.noCollege ? `+ ${t.noCollege} with no college given` : undefined} />
        <Stat icon={<Hourglass size={14} />} label="Pending applications" value={t.pending} hint={t.rejected ? `${t.rejected} rejected` : undefined} />
      </div>

      {/* Export builder */}
      <section className="p-4 rounded-xl border" style={card}>
        <h2 className="text-sm font-bold mb-1" style={{ color: 'var(--white)' }}>Download CSV</h2>
        <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
          Combine any filters. Leave a filter on “any” to ignore it, e.g. a batch from every college, or one college across all batches.
        </p>

        <div className="grid md:grid-cols-2 gap-4 mb-4">
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>Account type</label>
            <select value={filter.type} onChange={e => set({ type: e.target.value as TypeFilter })}
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={field}>
              <option value="all">Everyone</option>
              <option value="member">Club members</option>
              <option value="user">Website users (not members)</option>
              <option value="pending">Pending membership applications</option>
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: 'var(--muted)' }}>College</label>
            <select value={filter.college} onChange={e => set({ college: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm border outline-none" style={field}>
              <option value="any">Any college</option>
              <option value="not-ndc">Every college except Notre Dame</option>
              {stats.byCollege.map(c => (
                <option key={c.key} value={`key:${c.key}`}>{c.label} ({c.total})</option>
              ))}
            </select>
          </div>
        </div>

        <div className="mb-4">
          <div className="flex items-center justify-between mb-1.5">
            <label className="text-xs font-medium" style={{ color: 'var(--muted)' }}>
              Batch {filter.batches.length === 0 ? '(any)' : `(${filter.batches.length} selected)`}
            </label>
            {filter.batches.length > 0 && (
              <button onClick={() => set({ batches: [] })} className="text-xs underline" style={{ color: 'var(--blue)' }}>clear</button>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {stats.byBatch.map(b => {
              const on = filter.batches.includes(b.batch)
              return (
                <button key={b.batch} onClick={() => toggleBatch(b.batch)}
                  className="px-2.5 py-1 rounded-full text-xs border"
                  style={on ? { background: 'var(--blue)', color: '#000', borderColor: 'var(--blue)' } : { ...field }}>
                  {b.batch} <span style={{ opacity: 0.7 }}>· {b.total}</span>
                </button>
              )
            })}
          </div>
        </div>

        <details className="mb-4">
          <summary className="text-xs cursor-pointer" style={{ color: 'var(--muted)' }}>
            Columns in the file ({columns.length} of {CSV_COLUMNS.length})
          </summary>
          <div className="flex flex-wrap gap-x-4 gap-y-2 mt-2">
            {CSV_COLUMNS.map(c => (
              <label key={c.key} className="flex items-center gap-1.5 text-xs cursor-pointer" style={{ color: 'var(--white)' }}>
                <input type="checkbox" checked={columns.includes(c.key)} onChange={() => toggleColumn(c.key)} />
                {c.label}
              </label>
            ))}
          </div>
        </details>

        <div className="flex items-center gap-3 flex-wrap">
          <button onClick={() => download(filter, filtered)} disabled={filtered.length === 0 || columns.length === 0}
            className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ background: 'var(--blue)', color: '#000' }}>
            <Download size={14} /> Download {filtered.length.toLocaleString()} account{filtered.length === 1 ? '' : 's'}
          </button>
          <button onClick={() => setFilter(EMPTY_FILTER)} className="text-xs underline" style={{ color: 'var(--muted)' }}>Reset filters</button>
        </div>
      </section>

      {/* By batch */}
      <section>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--white)' }}>Accounts by batch</h2>
        <div className="rounded-xl border overflow-x-auto" style={card}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(var(--blue-rgb), 0.05)', color: 'var(--muted)' }}>
                <th className={th}>Batch</th><th className={th + ' text-right'}>Total</th><th className={th + ' text-right'}>Members</th>
                <th className={th + ' text-right'}>Website users</th><th className={th + ' text-right'}>NDC</th>
                <th className={th + ' text-right'}>Other colleges</th><th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {stats.byBatch.map(b => (
                <tr key={b.batch} style={{ borderBottom: '1px solid var(--surface-alt)', color: 'var(--white)' }}>
                  <td className="px-4 py-2.5">{b.batch}</td>
                  <td className={num}>{b.total}</td><td className={num}>{b.members}</td><td className={num}>{b.users}</td>
                  <td className={num}>{b.ndc}</td><td className={num}>{b.otherColleges}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button title="Download this batch, all colleges" className="text-xs underline mr-3" style={{ color: 'var(--blue)' }}
                      onClick={() => download({ ...EMPTY_FILTER, batches: [b.batch] })}>CSV</button>
                    <button title="Set as filter" className="text-xs underline" style={{ color: 'var(--muted)' }}
                      onClick={() => set({ batches: [b.batch] })}>filter</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* By college */}
      <section>
        <h2 className="text-sm font-bold mb-1" style={{ color: 'var(--white)' }}>Accounts by college</h2>
        <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
          Spellings are merged: “NDC”, “notredame college”, “Notre Dame College, Dhaka” and similar all count as Notre Dame College.
        </p>
        <div className="rounded-xl border overflow-x-auto" style={card}>
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid var(--border)', background: 'rgba(var(--blue-rgb), 0.05)', color: 'var(--muted)' }}>
                <th className={th}>College</th><th className={th + ' text-right'}>Total</th><th className={th + ' text-right'}>Members</th>
                <th className={th + ' text-right'}>Website users</th><th className={th + ' text-right'}>Batches</th><th className={th}></th>
              </tr>
            </thead>
            <tbody>
              {stats.byCollege.map(c => (
                <tr key={c.key || 'none'} style={{ borderBottom: '1px solid var(--surface-alt)', color: 'var(--white)' }}>
                  <td className="px-4 py-2.5">{c.label}</td>
                  <td className={num}>{c.total}</td><td className={num}>{c.members}</td><td className={num}>{c.users}</td><td className={num}>{c.batches}</td>
                  <td className="px-4 py-2.5 text-right whitespace-nowrap">
                    <button title="Download this college, all batches" className="text-xs underline mr-3" style={{ color: 'var(--blue)' }}
                      onClick={() => download({ ...EMPTY_FILTER, college: `key:${c.key}` })}>CSV</button>
                    <button title="Set as filter" className="text-xs underline" style={{ color: 'var(--muted)' }}
                      onClick={() => set({ college: `key:${c.key}` })}>filter</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  )
}

type Tab = 'overview' | 'select' | 'send' | 'notify' | 'bulk'
const TABS: { key: Tab; label: string }[] = [
  { key: 'overview', label: 'General info' }, { key: 'select', label: 'Selective view' },
  { key: 'send', label: 'Bulk sending' }, { key: 'notify', label: 'Group notify' }, { key: 'bulk', label: 'Bulk add' },
]

function ManageAccounts() {
  const router = useRouter()
  const params = useSearchParams()
  const raw = params.get('tab')
  const tab: Tab = TABS.some(t => t.key === raw) ? (raw as Tab) : 'overview'
  const [refreshKey, setRefreshKey] = useState(0)

  // Accounts are loaded once for the three tabs that pick people, and shared between them.
  const needsAccounts = tab === 'select' || tab === 'send' || tab === 'notify'
  const [accounts, setAccounts] = useState<Account[] | null>(null)
  const [accError, setAccError] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [selFilter, setSelFilter] = useState<GroupFilter>(EMPTY_GROUP)
  const [groupFilter, setGroupFilter] = useState<GroupFilter>(EMPTY_GROUP)

  const loadAccounts = useCallback(async () => {
    setAccError('')
    try {
      const res = await fetch('/api/admin/accounts')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Could not load accounts')
      setAccounts(data.accounts || [])
    } catch (e: any) { setAccError(e.message || 'Could not load accounts') }
  }, [])
  useEffect(() => { if (needsAccounts && accounts === null) loadAccounts() }, [needsAccounts, accounts, loadAccounts])

  const go = (t: Tab) => router.replace(t === 'overview' ? '/admin/accounts' : `/admin/accounts?tab=${t}`)
  const tabStyle = (on: boolean) => ({
    padding: '8px 16px', fontSize: 14, fontWeight: 700, borderBottom: `2px solid ${on ? 'var(--blue)' : 'transparent'}`,
    color: on ? 'var(--blue)' : 'var(--muted)', whiteSpace: 'nowrap' as const,
  })

  const selectedAccounts = useMemo(() => (accounts || []).filter(a => selected.has(a.id)), [accounts, selected])
  const groupAccounts = useMemo(() => filterGroup(accounts || [], groupFilter), [accounts, groupFilter])

  let body: React.ReactNode
  if (tab === 'overview') body = <Overview key={refreshKey} />
  else if (tab === 'bulk') body = <BulkAddPanel onCreated={() => { setRefreshKey(k => k + 1); setAccounts(null) }} />
  else if (accError) body = <p className="text-sm" style={{ color: 'var(--danger)' }}>{accError}</p>
  else if (!accounts) body = <p className="text-sm" style={{ color: 'var(--muted)' }}>Loading accounts…</p>
  else if (tab === 'select') {
    body = <SelectiveView accounts={accounts} filter={selFilter} setFilter={setSelFilter} selected={selected} setSelected={setSelected} onSend={() => go('send')} />
  } else if (tab === 'send') {
    body = (
      <div>
        <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
          Sends to the accounts you ticked in <button className="underline" style={{ color: 'var(--blue)' }} onClick={() => go('select')}>Selective view</button>
          {' '}and/or to numbers and Gmail addresses you add below.
        </p>
        <Sender accounts={selectedAccounts} who={`${selectedAccounts.length} selected account${selectedAccounts.length === 1 ? '' : 's'}`} />
      </div>
    )
  } else {
    body = (
      <div className="space-y-4">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Tell a whole group something: pick any mix of batch, college, department, account type…, write the message, and send. Add outside numbers or Gmail addresses if needed.
        </p>
        <GroupFilterPanel accounts={accounts} filter={groupFilter} onChange={setGroupFilter} />
        <Sender accounts={groupAccounts} who={`${groupAccounts.length.toLocaleString()} account${groupAccounts.length === 1 ? '' : 's'} match the filters above`} />
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold mb-2" style={heading}>Manage Accounts</h1>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          See who is on the site, pick people, message them in bulk or by group, export what you need, or add people in bulk.
        </p>
      </div>
      <div className="flex gap-2 mb-6 border-b overflow-x-auto" style={{ borderColor: 'var(--border)' }}>
        {TABS.map(t => (
          <button key={t.key} style={tabStyle(tab === t.key)} onClick={() => go(t.key)}>
            {t.label}{t.key === 'send' && selected.size > 0 ? ` (${selected.size})` : ''}
          </button>
        ))}
      </div>
      {body}
    </div>
  )
}

export default function ManageAccountsPage() {
  return <Suspense fallback={null}><ManageAccounts /></Suspense>
}
