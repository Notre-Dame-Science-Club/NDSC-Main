'use client'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import {
  ReactFlow, ReactFlowProvider, Background, Controls, MiniMap,
  useNodesState, useEdgesState, addEdge, Handle, Position,
  type Node as RFNode, type Edge as RFEdge, type Connection,
  type NodeProps,
} from '@xyflow/react'
import '@xyflow/react/dist/style.css'
import {
  ArrowLeft, Plus, Save, Loader2, Power, PowerOff,
  FileText, Trophy, Users, Box, Workflow, Pencil, Trash2,
} from 'lucide-react'
import type { FormNode, FormGraph } from '@/lib/formGraph'
import { FORM_NODE_KIND_LABEL, FORM_NODE_KIND_BADGE } from '@/lib/formGraph'

// The full flowchart-style form builder — a tree of forms rendered as
// draggable React Flow boxes wired by parent_id. Shared by:
//   - the standalone /admin/form-builder/[graphId] page (graph-first entry)
//   - the "Form Builder" tab on the activity-session admin page
//   - the "Form Builder" tab on the olympiad admin page
// The latter two use <FormGraphBuilderForOwner> which resolves (or lazily
// creates) the graph for that owner and then renders this same diagram.

const KIND_COLOR: Record<string, { bg: string; fg: string; border: string }> = {
  starter:                { bg: 'rgba(var(--blue-rgb), 0.15)',     fg: 'var(--blue)',     border: 'rgba(var(--blue-rgb), 0.4)' },
  blank:                  { bg: 'var(--bg2)',                     fg: 'var(--muted)',    border: 'var(--border)' },
  preset_common_details:  { bg: 'rgba(var(--cat-teal-rgb), 0.15)',fg: 'var(--cat-teal)', border: 'rgba(var(--cat-teal-rgb), 0.4)' },
  preset_olympiad_questions: { bg: 'rgba(var(--accent2-rgb), 0.15)', fg: 'var(--accent2)', border: 'rgba(var(--accent2-rgb), 0.4)' },
  preset_team_info:       { bg: 'rgba(var(--warning-rgb), 0.15)', fg: 'var(--warning)',  border: 'rgba(var(--warning-rgb), 0.4)' },
}

type FlowNodeData = { node: FormNode; isRoot: boolean } & Record<string, unknown>

function FlowNodeCard({ data, selected }: NodeProps) {
  const { node, isRoot } = data as FlowNodeData
  const c = KIND_COLOR[node.kind] || KIND_COLOR.blank
  const disabled = !node.enabled
  const fieldCount = node.fields?.length || 0
  return (
    <div
      className="rounded-xl p-3 min-w-[200px] max-w-[260px] shadow-lg transition-all"
      style={{
        background: 'var(--surface)',
        border: `2px solid ${selected ? 'var(--blue)' : (disabled ? 'var(--border)' : c.border)}`,
        opacity: disabled ? 0.55 : 1,
        cursor: 'grab',
      }}>
      <Handle type="target" position={Position.Top} style={{ background: 'var(--muted)', width: 8, height: 8 }} />
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <span className="text-[10px] font-bold tracking-wider px-1.5 py-0.5 rounded"
          style={{ background: c.bg, color: c.fg, border: `1px solid ${c.border}` }}>
          {FORM_NODE_KIND_BADGE[node.kind] || node.kind.toUpperCase()}
        </span>
        {isRoot && <span className="text-[10px] font-bold" style={{ color: 'var(--muted)' }}>ROOT</span>}
      </div>
      <p className="text-sm font-bold truncate" style={{ color: 'var(--white)' }}>{node.label}</p>
      <p className="text-[11px] mt-1" style={{ color: 'var(--muted)' }}>
        {fieldCount === 0 ? 'Empty form' : `${fieldCount} field${fieldCount === 1 ? '' : 's'}`}
        {node.is_terminal && ' · terminal'}
        {disabled && ' · disabled'}
      </p>
      <Handle type="source" position={Position.Bottom} style={{ background: 'var(--muted)', width: 8, height: 8 }} />
    </div>
  )
}

const nodeTypes = { form: FlowNodeCard }

function DiagramInner({ graphId, showBackLink = true }: { graphId: string; showBackLink?: boolean }) {
  const [graph, setGraph] = useState<FormGraph | null>(null)
  const [nodes, setNodes] = useState<FormNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null)
  const [savingLayout, setSavingLayout] = useState(false)
  const [actionError, setActionError] = useState('')
  const saveTimer = useRef<any>(null)

  const [rfNodes, setRfNodes, onRfNodesChange] = useNodesState<RFNode>([])
  const [rfEdges, setRfEdges, onRfEdgesChange] = useEdgesState<RFEdge>([])

  const load = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await fetch(`/api/admin/form-graphs/${graphId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load.')
      setGraph(data.graph)
      setNodes(data.nodes || [])
    } catch (e: any) {
      setError(e.message || 'Failed to load.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [graphId])

  useEffect(() => {
    if (!nodes.length) {
      setRfNodes([])
      setRfEdges([])
      return
    }
    const rfnodes: RFNode[] = nodes.map(n => ({
      id: n.id,
      type: 'form',
      position: n.position || { x: 100, y: 100 },
      data: { node: n, isRoot: n.parent_id === null } as any,
    }))
    const edges: RFEdge[] = nodes
      .filter(n => n.parent_id)
      .map(n => ({
        id: `${n.parent_id}->${n.id}`,
        source: n.parent_id!,
        target: n.id,
        type: 'smoothstep',
        animated: false,
        style: { stroke: 'var(--muted)', strokeWidth: 1.5 },
      }))
    setRfNodes(rfnodes)
    setRfEdges(edges)
  }, [nodes])

  useEffect(() => {
    if (loading) return
    if (saveTimer.current) clearTimeout(saveTimer.current)
    saveTimer.current = setTimeout(async () => {
      setSavingLayout(true)
      try {
        const node_positions: Record<string, { x: number; y: number }> = {}
        for (const n of rfNodes) node_positions[n.id] = { x: n.position.x, y: n.position.y }
        const res = await fetch(`/api/admin/form-graphs/${graphId}`, {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ node_positions }),
        })
        if (!res.ok) {
          const data = await res.json().catch(() => ({}))
          setActionError(data.error || 'Failed to save layout.')
        }
      } catch (e: any) {
        setActionError(e.message || 'Failed to save layout.')
      } finally {
        setSavingLayout(false)
      }
    }, 800)
    return () => { if (saveTimer.current) clearTimeout(saveTimer.current) }
  }, [rfNodes, graphId, loading])

  const onConnect = useCallback(async (conn: Connection) => {
    if (!conn.source || !conn.target) return
    if (conn.source === conn.target) return
    setRfEdges(eds => addEdge({ ...conn, type: 'smoothstep', style: { stroke: 'var(--muted)', strokeWidth: 1.5 } } as any, eds))
    setActionError('')
    try {
      const res = await fetch(`/api/admin/form-nodes/${conn.target}/reparent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ parent_id: conn.source }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Re-parent failed.')
      if (data.node) {
        setNodes(prev => prev.map(n => n.id === data.node.id ? data.node : n))
      }
    } catch (e: any) {
      setRfEdges(eds => eds.filter(e => !(e.source === conn.source && e.target === conn.target)))
      setActionError(e.message || 'Re-parent failed.')
    }
  }, [])

  const onSelectionChange = useCallback((sel: { nodes: any[]; edges: any[] }) => {
    setSelectedNodeId(sel.nodes?.[0]?.id || null)
  }, [])

  // Toolbar actions
  const addNode = async (kind: 'blank' | 'preset_common_details' | 'preset_olympiad_questions' | 'preset_team_info') => {
    setActionError('')
    if (!graph) return
    if (!graph.root_node_id && kind !== 'preset_common_details' && kind !== 'blank') {
      setActionError('Add the root node first. Click anywhere on the canvas and use "Add blank" or "Common details".')
      return
    }
    // Drop the new node near the currently-selected node, or near the root
    // if nothing is selected, or at a sensible default.
    let parentId: string | null = selectedNodeId
    if (!parentId) parentId = graph.root_node_id
    // A null parentId is only a problem once the graph already has a root —
    // that's the caller forgetting to select where to attach. Before a root
    // exists, null is the correct signal to the API to create one.
    if (!parentId && graph.root_node_id) {
      setActionError('Select a node on the canvas to attach the new form to.')
      return
    }
    const at = (() => {
      if (selectedNodeId) {
        const sel = rfNodes.find(n => n.id === selectedNodeId)
        if (sel) return { x: sel.position.x + 260, y: sel.position.y + 80 }
      }
      const root = rfNodes.find(n => n.id === graph.root_node_id)
      if (root) return { x: root.position.x + 260, y: root.position.y + 80 }
      return { x: 200, y: 200 }
    })()
    try {
      const res = await fetch(`/api/admin/form-graphs/${graphId}/nodes`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ kind, parent_id: parentId, at }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to add node.')
      setNodes(prev => [...prev, data.node])
      setSelectedNodeId(data.node.id)
    } catch (e: any) {
      setActionError(e.message || 'Failed to add node.')
    }
  }

  const toggleEnabled = async (n: FormNode) => {
    setActionError('')
    try {
      const res = await fetch(`/api/admin/form-nodes/${n.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ enabled: !n.enabled }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed.')
      setNodes(prev => prev.map(x => x.id === n.id ? data.node : x))
    } catch (e: any) {
      setActionError(e.message || 'Failed.')
    }
  }

  const removeNode = async (n: FormNode) => {
    if (!confirm(`Delete "${n.label}" and all its child forms?`)) return
    setActionError('')
    try {
      const res = await fetch(`/api/admin/form-nodes/${n.id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed.')
      setNodes(prev => prev.filter(x => x.id !== n.id && !data.deleted?.includes(x.id)))
      load()
    } catch (e: any) {
      setActionError(e.message || 'Failed.')
    }
  }

  const selectedNode = useMemo(() => nodes.find(n => n.id === selectedNodeId) || null, [nodes, selectedNodeId])

  if (loading) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center" style={{ color: 'var(--muted)' }}>
        <Loader2 size={16} className="animate-spin" /> Loading diagram…
      </div>
    )
  }
  if (error) {
    return <p className="text-sm p-3 rounded-lg" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)' }}>{error}</p>
  }
  if (!graph) return null

  if (nodes.length === 0) {
    return (
      <div>
        <Header graph={graph} savingLayout={savingLayout} showBackLink={showBackLink} />
        {actionError && <ErrorBanner msg={actionError} />}
        <div className="rounded-xl p-10 text-center mt-6" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <Workflow size={32} className="mx-auto mb-3" style={{ color: 'var(--muted)' }} />
          <p className="font-semibold mb-1" style={{ color: 'var(--white)' }}>This graph is empty</p>
          <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>
            Add the first form to start the flow. The first one becomes the root that everyone sees.
          </p>
          <div className="flex gap-2 justify-center flex-wrap">
            <button onClick={() => addNode('preset_common_details')}
              className="px-3 py-1.5 rounded text-xs font-bold" style={{ background: 'var(--cat-teal)', color: '#000' }}>
              + Common details
            </button>
            <button onClick={() => addNode('blank')}
              className="px-3 py-1.5 rounded text-xs font-bold" style={{ background: 'var(--blue)', color: '#000' }}>
              + Blank form
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div>
      <Header graph={graph} savingLayout={savingLayout} showBackLink={showBackLink} />

      {actionError && <ErrorBanner msg={actionError} />}

      <Toolbar onAdd={addNode} hasRoot={!!graph.root_node_id} />

      <div className="mt-4 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)', height: 'calc(100vh - 280px)', minHeight: 500 }}>
        <ReactFlow
          nodes={rfNodes}
          edges={rfEdges}
          nodeTypes={nodeTypes}
          onNodesChange={onRfNodesChange}
          onEdgesChange={onRfEdgesChange}
          onConnect={onConnect}
          onSelectionChange={onSelectionChange as any}
          fitView
          proOptions={{ hideAttribution: true }}
          defaultEdgeOptions={{ type: 'smoothstep' }}
        >
          <Background color="var(--border)" gap={20} />
          <Controls position="bottom-right" showInteractive={false}
            style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 8 }} />
          <MiniMap position="bottom-left" pannable zoomable
            style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}
            nodeColor={(n: any) => {
              const kind = n.data?.node?.kind
              const c = KIND_COLOR[kind]
              if (!c) return 'var(--muted)'
              return c.fg === 'var(--blue)' ? '#00d4ff'
                : c.fg === 'var(--cat-teal)' ? '#00ff80'
                : c.fg === 'var(--accent2)' ? '#a78bfa'
                : c.fg === 'var(--warning)' ? '#ffb347'
                : '#6a8faf'
            }}
          />
        </ReactFlow>
      </div>

      {selectedNode && (
        <div className="mt-3 rounded-xl p-4 flex items-center gap-3" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
          <div className="flex-1 min-w-0">
            <p className="text-[10px] font-bold tracking-wider mb-0.5" style={{ color: 'var(--muted)' }}>
              {FORM_NODE_KIND_LABEL[selectedNode.kind]}
            </p>
            <p className="font-semibold text-sm truncate" style={{ color: 'var(--white)' }}>{selectedNode.label}</p>
          </div>
          <button onClick={() => toggleEnabled(selectedNode)}
            className="px-2.5 py-1.5 rounded text-xs flex items-center gap-1"
            style={{
              background: selectedNode.enabled ? 'rgba(var(--cat-teal-rgb), 0.1)' : 'var(--bg2)',
              color: selectedNode.enabled ? 'var(--cat-teal)' : 'var(--muted)',
              border: `1px solid ${selectedNode.enabled ? 'rgba(var(--cat-teal-rgb), 0.3)' : 'var(--border)'}`,
            }}>
            {selectedNode.enabled ? <><Power size={12} /> Enabled</> : <><PowerOff size={12} /> Disabled</>}
          </button>
          <Link href={`/admin/form-builder/${graphId}/node/${selectedNode.id}`}
            className="px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5"
            style={{ background: 'var(--blue)', color: '#000' }}>
            <Pencil size={12} /> Edit
          </Link>
          <button onClick={() => removeNode(selectedNode)}
            className="p-1.5 rounded" style={{ color: 'var(--danger-soft)' }} title="Delete">
            <Trash2 size={14} />
          </button>
        </div>
      )}

      {!selectedNode && (
        <p className="text-xs mt-3" style={{ color: 'var(--muted)' }}>
          Click a node on the canvas to edit it. Drag to reposition (auto-saves). Drag from a node's bottom dot to another node's top dot to re-parent it under the new parent.
        </p>
      )}
    </div>
  )
}

function Header({ graph, savingLayout, showBackLink }: { graph: FormGraph; savingLayout: boolean; showBackLink: boolean }) {
  return (
    <div className="flex items-center justify-between mb-4">
      <div>
        {showBackLink && (
          <Link href="/admin/form-builder" className="inline-flex items-center gap-2 text-xs mb-2" style={{ color: 'var(--muted)' }}>
            <ArrowLeft size={12} /> All form graphs
          </Link>
        )}
        <h1 className="text-xl font-black flex items-center gap-2" style={{ fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }}>
          {graph.title}
        </h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--muted)' }}>
          {graph.owner_kind === 'activity' ? 'Activity' : 'Olympiad'} form graph · {graph.root_node_id ? 'has root' : 'no root yet'}
        </p>
      </div>
      <div className="text-xs flex items-center gap-1.5" style={{ color: 'var(--muted)' }}>
        {savingLayout ? <><Loader2 size={12} className="animate-spin" /> Saving layout…</> : <><Save size={12} /> Layout auto-saves</>}
      </div>
    </div>
  )
}

function ErrorBanner({ msg }: { msg: string }) {
  return (
    <p className="text-sm p-2 rounded-lg mb-3" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)' }}>
      {msg}
    </p>
  )
}

function Toolbar({ onAdd, hasRoot }: { onAdd: (kind: any) => void; hasRoot: boolean }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <p className="text-xs font-bold tracking-wider" style={{ color: 'var(--muted)' }}>ADD:</p>
      <button onClick={() => onAdd('preset_common_details')}
        className="px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5"
        style={{ background: 'rgba(var(--cat-teal-rgb), 0.12)', color: 'var(--cat-teal)', border: '1px solid rgba(var(--cat-teal-rgb), 0.3)' }}>
        <FileText size={12} /> Common details
      </button>
      <button onClick={() => onAdd('preset_olympiad_questions')}
        className="px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5"
        style={{ background: 'rgba(var(--accent2-rgb), 0.12)', color: 'var(--accent2)', border: '1px solid rgba(var(--accent2-rgb), 0.3)' }}>
        <Trophy size={12} /> Olympiad questions
      </button>
      <button onClick={() => onAdd('preset_team_info')}
        className="px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5"
        style={{ background: 'rgba(var(--warning-rgb), 0.12)', color: 'var(--warning)', border: '1px solid rgba(var(--warning-rgb), 0.3)' }}>
        <Users size={12} /> Team info
      </button>
      <button onClick={() => onAdd('blank')}
        className="px-3 py-1.5 rounded text-xs font-bold flex items-center gap-1.5"
        style={{ background: 'rgba(var(--blue-rgb), 0.12)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
        <Box size={12} /> Blank form
      </button>
    </div>
  )
}

/** Graph-first entry point: caller already knows the graphId. */
export function FormGraphBuilder({ graphId, showBackLink = true }: { graphId: string; showBackLink?: boolean }) {
  return (
    <ReactFlowProvider>
      <DiagramInner graphId={graphId} showBackLink={showBackLink} />
    </ReactFlowProvider>
  )
}

/**
 * Owner-first entry point for embedding the builder as a tab on the
 * activity-session or olympiad admin pages. Resolves the graph for this
 * owner via the idempotent create-or-fetch endpoint (POST returns the
 * existing graph if one's already there, or creates an empty one), then
 * renders the same diagram. The empty-graph state's "+ Common details" /
 * "+ Blank form" buttons handle creating the actual root node.
 */
export function FormGraphBuilderForOwner({ ownerKind, ownerId }: { ownerKind: 'activity' | 'olympiad'; ownerId: string }) {
  const [graphId, setGraphId] = useState<string | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    setGraphId(null)
    setError('')
    fetch('/api/admin/form-graphs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ owner_kind: ownerKind, owner_id: ownerId }),
    })
      .then(r => r.json())
      .then(data => {
        if (cancelled) return
        if (!data.graph) throw new Error(data.error || 'Failed to load form builder.')
        setGraphId(data.graph.id)
      })
      .catch(e => { if (!cancelled) setError(e.message || 'Failed to load form builder.') })
    return () => { cancelled = true }
  }, [ownerKind, ownerId])

  if (error) {
    return <p className="text-sm p-3 rounded-lg" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)' }}>{error}</p>
  }
  if (!graphId) {
    return (
      <div className="flex items-center gap-2 py-12 justify-center" style={{ color: 'var(--muted)' }}>
        <Loader2 size={16} className="animate-spin" /> Loading form builder…
      </div>
    )
  }
  return <FormGraphBuilder graphId={graphId} showBackLink={false} />
}
