'use client'
import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Loader2, AlertTriangle } from 'lucide-react'
import FormRunner from '@/components/public/FormRunner'
import type { FormGraph, FormNode } from '@/lib/formGraph'

// Public registration page for the unified form-graph system. Resolves
// the form graph by owner (activity session or olympiad) and mounts the
// FormRunner. The page also persists the in-flight registration id to
// localStorage so a refresh doesn't lose progress.
//
// We also stash the current node id in the URL (`?node=<id>`) so the
// user can bookmark a deep-link back to wherever they were.

const regIdKey = (kind: string, id: string) => `ndsc_form_reg_${kind}_${id}`
const curNodeKey = (kind: string, id: string) => `ndsc_form_node_${kind}_${id}`

export default function PublicRegisterPage() {
  const params = useParams()
  const router = useRouter()
  const ownerKind = (params?.ownerKind as string) || ''
  const ownerId = (params?.ownerId as string) || ''

  const [graph, setGraph] = useState<FormGraph | null>(null)
  const [nodes, setNodes] = useState<FormNode[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [registrationId, setRegistrationId] = useState<string | null>(null)
  const [currentNodeId, setCurrentNodeId] = useState<string | null>(null)

  // Load the graph.
  useEffect(() => {
    if (!ownerKind || !ownerId) return
    let cancelled = false
    setLoading(true)
    setError('')
    fetch(`/api/public/form-graph?owner_kind=${ownerKind}&owner_id=${ownerId}`)
      .then(r => r.json().then(j => ({ ok: r.ok, j })))
      .then(({ ok, j }) => {
        if (cancelled) return
        if (!ok) throw new Error(j.error || 'Failed to load form.')
        setGraph(j.graph)
        setNodes(j.nodes || [])
        // Resume from localStorage if present.
        try {
          const rid = localStorage.getItem(regIdKey(ownerKind, ownerId))
          if (rid) setRegistrationId(rid)
          const cnid = localStorage.getItem(curNodeKey(ownerKind, ownerId))
          if (cnid) setCurrentNodeId(cnid)
        } catch { /* ignore — localStorage may be unavailable */ }
      })
      .catch((e: any) => !cancelled && setError(e.message || 'Failed to load form.'))
      .finally(() => !cancelled && setLoading(false))
    return () => { cancelled = true }
  }, [ownerKind, ownerId])

  // Persist registration / current-node id whenever they change so a
  // page refresh resumes cleanly.
  useEffect(() => {
    if (!ownerKind || !ownerId) return
    try {
      if (registrationId) localStorage.setItem(regIdKey(ownerKind, ownerId), registrationId)
      if (currentNodeId) localStorage.setItem(curNodeKey(ownerKind, ownerId), currentNodeId)
    } catch { /* ignore */ }
  }, [registrationId, currentNodeId, ownerKind, ownerId])

  // When the runner reports a node change, mirror it to the URL so
  // refresh keeps the same step.
  const handleDone = useCallback((result: { registration_id: string; is_olympiad: boolean }) => {
    // Clear the resume keys — the registration is final.
    try {
      localStorage.removeItem(regIdKey(ownerKind, ownerId))
      localStorage.removeItem(curNodeKey(ownerKind, ownerId))
    } catch { /* ignore */ }
    // Stay on the page; the runner renders the "done" view. (We could
    // route to a thank-you page in v2.)
    void result
  }, [ownerKind, ownerId])

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="flex items-center gap-2" style={{ color: 'var(--muted)' }}>
          <Loader2 size={18} className="animate-spin" /> Loading form…
        </div>
      </div>
    )
  }
  if (error) {
    return (
      <div className="min-h-screen p-6 flex items-center justify-center" style={{ background: 'var(--bg)' }}>
        <div className="max-w-md w-full">
          <Link href="/" className="text-xs flex items-center gap-1 mb-3" style={{ color: 'var(--muted)' }}>
            <ArrowLeft size={12} /> Home
          </Link>
          <div className="rounded-xl p-6 text-center" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
            <AlertTriangle size={28} className="mx-auto mb-2" style={{ color: 'var(--danger-soft)' }} />
            <p className="font-semibold" style={{ color: 'var(--white)' }}>{error}</p>
            <p className="text-sm mt-2" style={{ color: 'var(--muted)' }}>If you think this is a mistake, contact the organizer.</p>
          </div>
        </div>
      </div>
    )
  }
  if (!graph) return null

  const sessionId = ownerKind === 'activity' ? ownerId : undefined

  // Accent color: pull from the graph's default appearance, fall back to
  // the owner-kind's default. Olympiad gets violet (--accent2) so the
  // registration pages read as a different sector from activity
  // registration, which is blue. Admins can override via the graph's
  // default_appearance.bg_theme.
  const themeFromGraph = (graph.settings?.default_appearance as any)?.bg_theme as string | undefined
  const accent = (themeFromGraph && themeFromGraph !== 'default' && themeFromGraph !== 'navy')
    ? themeFromGraph
    : (ownerKind === 'olympiad' ? 'var(--accent2)' : 'var(--blue)')

  return (
    <div className="min-h-screen py-6 px-4" style={{ background: 'var(--bg)' }}>
      <div className="max-w-2xl mx-auto">
        <Link href="/" className="text-xs flex items-center gap-1 mb-4" style={{ color: 'var(--muted)' }}>
          <ArrowLeft size={12} /> Home
        </Link>
        <FormRunner
          graph={graph}
          nodes={nodes}
          initialRegistrationId={registrationId}
          initialCurrentNodeId={currentNodeId || undefined}
          accent={accent}
          sessionId={sessionId}
          eventSlug={undefined}
          onDone={handleDone}
        />
      </div>
    </div>
  )
}
