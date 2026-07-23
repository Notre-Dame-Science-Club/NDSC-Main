'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Plus, Trash2, Workflow, Loader2, RefreshCw, Calendar, Trophy } from 'lucide-react'

type Graph = {
  id: string
  owner_kind: 'activity' | 'olympiad'
  owner_id: string
  owner_title: string
  title: string
  node_count: number
  root_node_id: string | null
  updated_at?: string
  created_at?: string
}

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'
const inputStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }

// The top-level form-graph admin page. Lists every form graph in the
// system — one per activity session + one per olympiad — and lets the
// admin create a new graph from any activity session or olympiad. Each
// graph links to its diagram view.
//
// The "create" modal lets the admin pick from activity sessions that
// don't have a graph yet, olympiads that don't have one yet, or type a
// freeform kind. (For now we keep it scoped to existing owners; the
// diagram creates the starter node when it's first opened.)
export default function FormBuilderListPage() {
  const [graphs, setGraphs] = useState<Graph[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showCreate, setShowCreate] = useState(false)
  const [activities, setActivities] = useState<{ id: string; title: string }[]>([])
  const [olympiads, setOlympiads] = useState<{ id: string; name: string }[]>([])
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/admin/form-graphs')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load.')
      setGraphs(data.graphs || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  // Load candidates when the create modal opens. We only show owners that
  // don't already have a graph, so admins can't create duplicates.
  const openCreate = async () => {
    setShowCreate(true)
    setCreateError('')
    try {
      const [aRes, oRes] = await Promise.all([
        fetch('/api/admin/activity-sessions').then(r => r.json()).catch(() => []),
        fetch('/api/admin/olympiads').then(r => r.json()).then(d => Array.isArray(d) ? d : (d.olympiads || [])).catch(() => []),
      ])
      const acts = Array.isArray(aRes) ? aRes : (aRes.sessions || [])
      setActivities(acts.map((a: any) => ({ id: a.id, title: a.title })))
      setOlympiads(oRes.map((o: any) => ({ id: o.id, name: o.name })))
    } catch { /* modal can still work without a candidate list */ }
  }

  const createFor = async (ownerKind: 'activity' | 'olympiad', ownerId: string) => {
    setCreating(true)
    setCreateError('')
    try {
      const res = await fetch('/api/admin/form-graphs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ owner_kind: ownerKind, owner_id: ownerId }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create.')
      setShowCreate(false)
      window.location.href = `/admin/form-builder/${data.graph.id}`
    } catch (e: any) {
      setCreateError(e.message || 'Failed to create.')
    } finally {
      setCreating(false)
    }
  }

  const del = async (id: string) => {
    if (!confirm('Delete this form graph and all its nodes? This cannot be undone.')) return
    try {
      const res = await fetch('/api/admin/form-graphs', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || 'Delete failed.')
      }
      setGraphs(prev => prev.filter(g => g.id !== id))
    } catch (e: any) {
      alert(e.message || 'Delete failed.')
    }
  }

  const existingOwnerIds = new Set(graphs.map(g => `${g.owner_kind}:${g.owner_id}`))
  const availableActivities = activities.filter(a => !existingOwnerIds.has(`activity:${a.id}`))
  const availableOlympiads = olympiads.filter(o => !existingOwnerIds.has(`olympiad:${o.id}`))

  return (
    <div>
      <Link href="/admin" className="inline-flex items-center gap-2 text-sm mb-6" style={{ color: 'var(--muted)' }}>
        <ArrowLeft size={14} /> Admin Panel
      </Link>

      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-black flex items-center gap-2" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }}>
            <Workflow size={22} /> Form Builder
          </h1>
          <p className="text-sm mt-1" style={{ color: 'var(--muted)' }}>
            Flowchart-style form graphs for activities and olympiads. Each graph is a tree of forms — drag to arrange, click to edit.
          </p>
        </div>
        <div className="flex gap-2">
          <button onClick={load} className="px-3 py-2 rounded-lg text-sm flex items-center gap-1.5"
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', color: 'var(--muted)' }}>
            <RefreshCw size={13} /> Refresh
          </button>
          <button onClick={openCreate}
            className="px-4 py-2 rounded-lg text-sm font-bold flex items-center gap-1.5"
            style={{ background: 'var(--blue)', color: '#000' }}>
            <Plus size={14} /> New form graph
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm p-3 rounded-lg mb-4" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)' }}>
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex items-center gap-2 py-12 justify-center" style={{ color: 'var(--muted)' }}>
          <Loader2 size={16} className="animate-spin" /> Loading…
        </div>
      ) : graphs.length === 0 ? (
        <div className="rounded-xl p-10 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Workflow size={32} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
          <p className="font-semibold mb-1" style={{ color: 'var(--white)' }}>No form graphs yet</p>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
            Create one from an existing activity session or olympiad to get started.
          </p>
          <button onClick={openCreate}
            className="px-4 py-2 rounded-lg text-sm font-bold inline-flex items-center gap-1.5"
            style={{ background: 'var(--blue)', color: '#000' }}>
            <Plus size={14} /> Create your first form graph
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {graphs.map(g => (
            <div key={g.id} className="rounded-xl p-4 flex items-center gap-4" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
              <div className="flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center"
                style={{
                  background: g.owner_kind === 'activity' ? 'rgba(var(--blue-rgb), 0.12)' : 'rgba(var(--accent2-rgb), 0.12)',
                  color: g.owner_kind === 'activity' ? 'var(--blue)' : 'var(--accent2)',
                }}>
                {g.owner_kind === 'activity' ? <Calendar size={18} /> : <Trophy size={18} />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-semibold text-sm truncate" style={{ color: 'var(--white)' }}>{g.title}</p>
                <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
                  {g.owner_kind === 'activity' ? 'Activity' : 'Olympiad'} ·
                  {' '}{g.owner_title} ·
                  {' '}{g.node_count} {g.node_count === 1 ? 'node' : 'nodes'}
                  {g.updated_at && ` · updated ${new Date(g.updated_at).toLocaleDateString('en-BD', { month: 'short', day: 'numeric' })}`}
                </p>
              </div>
              <Link href={`/admin/form-builder/${g.id}`}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold"
                style={{ background: 'rgba(var(--blue-rgb), 0.12)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
                Open diagram →
              </Link>
              <button onClick={() => del(g.id)} className="p-1.5 rounded" style={{ color: 'var(--danger-soft)' }} title="Delete graph">
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      {showCreate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.8)' }} onClick={() => !creating && setShowCreate(false)}>
          <div className="w-full max-w-lg rounded-2xl p-6 max-h-[80vh] overflow-y-auto"
            style={{ background: 'var(--surface-deep)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <h3 className="text-base font-bold mb-1" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }}>
              New form graph
            </h3>
            <p className="text-xs mb-4" style={{ color: 'var(--muted)' }}>
              Pick an activity session or olympiad to attach the graph to. You can edit fields, appearance, and behavior in the diagram.
            </p>

            {createError && (
              <p className="text-sm p-2 rounded mb-3" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)' }}>
                {createError}
              </p>
            )}

            <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
              <Calendar size={12} /> ACTIVITIES
            </p>
            <div className="space-y-1 mb-4 max-h-48 overflow-y-auto">
              {availableActivities.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>All activity sessions already have a graph.</p>
              ) : availableActivities.map(a => (
                <button key={a.id} onClick={() => createFor('activity', a.id)} disabled={creating}
                  className="w-full text-left p-2.5 rounded text-sm transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--white)' }}>
                  {a.title}
                </button>
              ))}
            </div>

            <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
              <Trophy size={12} /> OLYMPIADS
            </p>
            <div className="space-y-1 max-h-48 overflow-y-auto">
              {availableOlympiads.length === 0 ? (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>All olympiads already have a graph.</p>
              ) : availableOlympiads.map(o => (
                <button key={o.id} onClick={() => createFor('olympiad', o.id)} disabled={creating}
                  className="w-full text-left p-2.5 rounded text-sm transition-all hover:opacity-80 disabled:opacity-50"
                  style={{ background: 'var(--bg2)', border: '1px solid var(--border)', color: 'var(--white)' }}>
                  {o.name}
                </button>
              ))}
            </div>

            <button onClick={() => setShowCreate(false)} disabled={creating}
              className="mt-4 px-3 py-1.5 rounded text-xs w-full"
              style={{ background: 'var(--bg2)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
