'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, ChevronRight, ChevronDown, ArrowLeft, Users, CreditCard, Link2, Calendar, X, Zap, Upload, Microscope, FileText, Images, Youtube, ImageIcon, Lock, Check, Sparkles, Save } from 'lucide-react'
import MathInputField from '@/components/olympiad/MathInputField'
import { FormBlock, normalizeBlocks, builtinFieldDefs } from '@/lib/formBlocks'
import FieldsEditor from '@/components/admin/FieldsEditor'
import ContactPersonsEditor from '@/components/admin/ContactPersonsEditor'
import { THEME_PRESETS, FONT_OPTIONS, COVER_RATIO_OPTIONS } from '@/lib/appearancePresets'
import { resolveAccent, resolveFont } from '@/lib/appearance'

const uid = () => Math.random().toString(36).slice(2, 9)

type FieldType = 'text' | 'textarea' | 'number' | 'photo' | 'file' | 'dropdown' | 'multiple_choice' | 'checkboxes' | 'date' | 'time'
type CustomField = { key: string; label: string; description?: string; type: FieldType; required: boolean; options?: string[]; allow_other?: boolean; max_file_size_mb?: number; max_files?: number; unique_field?: boolean }
type SubmissionField = {
  id: string; title: string; description?: string
  field_type: 'text' | 'textarea' | 'file'; required: boolean
  file_types?: string[]; max_file_size_mb?: number; max_files?: number
}

type Category = {
  id: string
  activity_session_id: string
  parent_id: string | null
  name: string
  description: string | null
  display_order: number
  custom_fields: CustomField[]
  form_field_schema: FormBlock[]
  is_segment: boolean
  icon: string | null
  bg_image_url: string | null
  requires_team: boolean
  team_size_min: number | null
  team_size_max: number | null
  team_member_fields: CustomField[]
  requires_payment: boolean
  payment_amount: number | null
  payment_label: string | null
  is_online_submission: boolean
  linked_olympiad_id: string | null
  linked_olympiad?: { id: string; exam_type: 'photo_only' | 'live_only' | 'mixed'; relay_mode: boolean; relay_type: string | null } | null
  schedule_date: string | null
  schedule_time: string | null
  schedule_room: string | null
  edit_window_hours: number | null
  registration_open: boolean
  submission_config: SubmissionField[]
  submission_who: 'leader' | 'any_member'
  project_name_enabled: boolean
  project_name_label: string | null
}

const deriveOnlineType = (o?: Category['linked_olympiad']): string => {
  if (!o) return 'full_quiz'
  if (o.relay_mode) return 'science_relay'
  if (o.exam_type === 'photo_only') return 'pure_submission'
  if (o.exam_type === 'live_only') return 'full_quiz'
  return 'mixed'
}

const s = { background: 'var(--bg2)', borderColor: 'var(--border)' }
const h = { fontFamily: "'Orbitron', sans-serif", color: 'var(--blue)' }
const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'
const inputStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }

const BLANK_FIELD = (): CustomField => ({ key: uid(), label: '', description: '', type: 'text', required: false })
const BLANK_SUBMISSION_FIELD = (): SubmissionField => ({ id: uid(), title: '', description: '', field_type: 'text', required: true })

export default function ActivityRegistrationBuilder() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [session, setSession] = useState<any>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<'builder' | 'registrants' | 'appearance' | 'files' | 'updates'>('appearance')

  const load = async () => {
    try {
      const [allSessions, catRes] = await Promise.all([
        fetch('/api/admin/activity-sessions').then(r => r.json()).catch(() => []),
        fetch(`/api/admin/activity-reg-categories?sessionId=${sessionId}`),
      ])
      const found = Array.isArray(allSessions) ? allSessions.find((x: any) => x.id === sessionId) : null
      setSession(found || null)

      const catData = await catRes.json()
      if (!catRes.ok) { setError(catData.error || 'Could not load categories.'); return }
      setCategories(catData.categories || [])
    } catch {
      setError('Network error while loading.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [sessionId])

  // Registration is the main workflow once it's on; otherwise start on
  // Appearance since Builder/Registrants have nothing to show yet.
  useEffect(() => {
    if (session) setTab(session.registration_enabled ? 'builder' : 'appearance')
  }, [session?.id, session?.registration_enabled])

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const isLeaf = (catId: string) => !categories.some(c => c.parent_id === catId)

  const addCategory = async (parentId: string | null, explicitName?: string) => {
    setError('')
    const name = explicitName ?? prompt(parentId ? 'Name for this sub-category / track:' : 'Name for this category / track:')
    if (!name?.trim()) return null
    try {
      const res = await fetch('/api/admin/activity-reg-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_session_id: sessionId, parent_id: parentId, name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not add category.'); return null }
      setCategories(prev => [...prev, data.category])
      if (parentId) setExpandedIds(prev => new Set(prev).add(parentId))
      return data.category
    } catch {
      setError('Network error while adding.')
      return null
    }
  }

  // "I don't need multiple tracks" path: creates a single top-level category behind the
  // scenes (no name prompt — registration form fields don't need a category label when
  // there's only one) and drops the admin straight into its field editor.
  const quickStartSimpleForm = async () => {
    const created = await addCategory(null, session?.title || 'Registration')
    if (created) setEditingId(created.id)
  }

  // Create a new top-level segment. The category row has `is_segment = true` and
  // starts with the 7 built-in fields pre-seeded into form_field_schema so the
  // admin lands on a working form immediately.
  const addSegment = async () => {
    const name = prompt('Name for this segment (e.g. "Quiz", "Workshop"):')
    if (!name?.trim()) return
    setError('')
    try {
      const res = await fetch('/api/admin/activity-reg-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          activity_session_id: sessionId,
          parent_id: null,
          name: name.trim(),
          is_segment: true,
          form_field_schema: builtinFieldDefs(),
          registration_open: true,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not add segment.'); return }
      setCategories(prev => [...prev, data.category])
      setEditingId(data.category.id)
    } catch {
      setError('Network error while adding segment.')
    }
  }

  const updateCategory = async (id: string, patch: Partial<Category> & { online_type?: string }) => {
    setError('')
    try {
      const res = await fetch('/api/admin/activity-reg-categories', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, ...patch }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not update category.'); return }
      setCategories(prev => prev.map(c => c.id === id ? data.category : c))
    } catch {
      setError('Network error while updating.')
    }
  }

  const deleteCategory = async (id: string) => {
    if (!confirm('Delete this category and all its sub-categories? This cannot be undone.')) return
    setError('')
    try {
      const res = await fetch('/api/admin/activity-reg-categories', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not delete category.'); return }
      load() // simplest correct way to reflect cascade-deleted descendants too
    } catch {
      setError('Network error while deleting.')
    }
  }

  const renderTree = (parentId: string | null, depth: number) => {
    const children = categories
      .filter(c => c.parent_id === parentId)
      .sort((a, b) => a.display_order - b.display_order)

    if (children.length === 0 && parentId !== null) return null

    return (
      <div style={{ marginLeft: depth > 0 ? 24 : 0 }} className="space-y-2">
        {children.map(cat => {
          const leaf = isLeaf(cat.id)
          const expanded = expandedIds.has(cat.id)
          return (
            <div key={cat.id} className="rounded-xl border" style={s}>
              <div className="flex items-center gap-2 p-3">
                <button onClick={() => toggleExpand(cat.id)} style={{ color: 'var(--muted)' }}>
                  {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
                <span className="text-sm font-semibold flex-1" style={{ color: 'var(--white)' }}>{cat.name}</span>
                {leaf && (
                  <div className="flex items-center gap-1.5">
                    {cat.requires_team && <span title="Team registration"><Users size={13} style={{ color: 'var(--accent2)' }} /></span>}
                    {cat.requires_payment && <span title="Requires payment"><CreditCard size={13} style={{ color: 'var(--warning)' }} /></span>}
                    {cat.is_online_submission && <span title="Linked to Olympiad"><Link2 size={13} style={{ color: 'var(--blue)' }} /></span>}
                    {cat.schedule_date && <span title="Has schedule"><Calendar size={13} style={{ color: 'var(--cat-teal)' }} /></span>}
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>Leaf — registration form</span>
                  </div>
                )}
                <button onClick={() => setEditingId(editingId === cat.id ? null : cat.id)}
                  className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>
                  {editingId === cat.id ? 'Close' : 'Edit'}
                </button>
                <button onClick={() => addCategory(cat.id)}
                  className="text-xs px-2 py-1 rounded flex items-center gap-1" style={{ background: 'rgba(var(--cat-teal-rgb), 0.1)', color: 'var(--cat-teal)' }}>
                  <Plus size={11} /> Sub
                </button>
                <button onClick={() => deleteCategory(cat.id)} style={{ color: 'var(--danger-soft)' }}>
                  <Trash2 size={14} />
                </button>
              </div>

              {editingId === cat.id && (
                <CategoryEditor category={cat} isLeaf={leaf} onSave={patch => updateCategory(cat.id, patch)} />
              )}

              {expanded && renderTree(cat.id, depth + 1)}
            </div>
          )
        })}
      </div>
    )
  }

  if (loading) return <p style={{ color: 'var(--muted)' }}>Loading...</p>

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/activities" className="p-2 rounded-lg" style={{ background: 'var(--bg2)', color: 'var(--muted)' }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={h}>Manage Activity</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{session?.title || 'Activity Session'}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)', border: '1px solid rgba(var(--danger-rgb), 0.3)' }}>
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-4 flex-wrap">
        <button onClick={() => setTab('appearance')} className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={tab === 'appearance' ? { background: 'rgba(var(--blue-rgb), 0.15)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.4)' } : { background: 'var(--surface-deep)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
          Appearance
        </button>
        <button onClick={() => setTab('files')} className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={tab === 'files' ? { background: 'rgba(var(--blue-rgb), 0.15)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.4)' } : { background: 'var(--surface-deep)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
          Files
        </button>
        <button onClick={() => session?.registration_enabled && setTab('builder')}
          disabled={!session?.registration_enabled}
          title={!session?.registration_enabled ? 'Turn on "Registration" for this session (Activities admin) to unlock this' : ''}
          className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          style={tab === 'builder' ? { background: 'rgba(var(--blue-rgb), 0.15)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.4)' } : { background: 'var(--surface-deep)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
          <span className="inline-flex items-center gap-1.5">Registration{!session?.registration_enabled && <Lock size={11} />}</span>
        </button>
        <button onClick={() => session?.registration_enabled && setTab('registrants')}
          disabled={!session?.registration_enabled}
          title={!session?.registration_enabled ? 'Turn on "Registration" for this session (Activities admin) to unlock this' : ''}
          className="px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-40 disabled:cursor-not-allowed"
          style={tab === 'registrants' ? { background: 'rgba(var(--blue-rgb), 0.15)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.4)' } : { background: 'var(--surface-deep)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
          <span className="inline-flex items-center gap-1.5">Registrants{!session?.registration_enabled && <Lock size={11} />}</span>
        </button>
        <button onClick={() => setTab('updates')} className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={tab === 'updates' ? { background: 'rgba(var(--blue-rgb), 0.15)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.4)' } : { background: 'var(--surface-deep)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
          Updates
        </button>
      </div>

      {tab === 'registrants' && session?.registration_enabled ? (
        <RegistrantsPanel sessionId={sessionId} />
      ) : tab === 'appearance' ? (
        <AppearancePanel sessionId={sessionId} session={session} onSaved={setSession} />
      ) : tab === 'files' ? (
        <FilesPanel sessionId={sessionId} session={session} onSaved={setSession} />
      ) : tab === 'updates' ? (
        <UpdatesPanel sessionId={sessionId} />
      ) : tab === 'builder' && session?.registration_enabled ? (
      <>
      <div className="mb-5 p-4 rounded-xl text-sm" style={{ background: 'rgba(var(--blue-rgb), 0.05)', border: '1px solid rgba(var(--blue-rgb), 0.2)', color: 'var(--muted)' }}>
        Each <span style={{ color: 'var(--blue)' }}>segment</span> below is a top-level
        registration option for this event. They appear as cards on the public
        event page, each with its own Register button and its own custom form.
        Add a few segments if your event has different parallel tracks (e.g. Quiz
        + Workshop), or one if it's a single registration form.
      </div>

      {/* Segments — top-level registration targets. Each is a public card on the event page. */}
      <SegmentsSection
        segments={categories.filter(c => c.parent_id === null && c.is_segment)}
        onAdd={addSegment}
        onPatch={(id, patch) => updateCategory(id, patch)}
        onDelete={deleteCategory}
        editingId={editingId}
        setEditingId={setEditingId}
      />

      {categories.some(c => !(c.parent_id === null && c.is_segment)) && (
        <div className="mt-8 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <p className="text-xs font-bold mb-3" style={{ color: 'var(--muted)' }}>
            Legacy / nested categories (not shown as public cards)
          </p>
          {renderTree(null, 0)}
        </div>
      )}

      {categories.filter(c => c.parent_id === null && c.is_segment).length === 0 && (
        <div className="mt-5 space-y-3">
          <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>
            Don't want separate segments? You can use a single registration form for this event.
          </p>
          <button onClick={quickStartSimpleForm}
            className="w-full text-left flex items-center gap-3 p-4 rounded-xl border"
            style={{ background: 'var(--surface-deep)', borderColor: 'var(--border)' }}>
            <div className="p-2 rounded-lg" style={{ background: 'rgba(var(--cat-teal-rgb), 0.12)' }}><Plus size={16} style={{ color: 'var(--cat-teal)' }} /></div>
            <div>
              <p className="text-sm font-semibold" style={{ color: 'var(--white)' }}>Single registration form (legacy)</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--border-soft)' }}>One top-level category, no segment cards on the public page. The category tree below is used instead.</p>
            </div>
          </button>
        </div>
      )}
      </>
      ) : (
        <div className="rounded-xl p-6 text-sm text-center" style={{ background: 'var(--surface-deep)', border: '1px solid var(--border)', color: 'var(--border-soft)' }}>
          Turn on "Registration" for this session in Activities admin to unlock this tab.
        </div>
      )}
    </div>
  )
}

function RegistrantsPanel({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(true)
  const [registrations, setRegistrations] = useState<any[]>([])
  const [segments, setSegments] = useState<any[]>([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [segmentFilter, setSegmentFilter] = useState<string>('all')
  const [viewing, setViewing] = useState<any | null>(null)

  useEffect(() => {
    fetch(`/api/admin/activity-registrations-list?sessionId=${sessionId}`)
      .then(r => r.json())
      .then(d => {
        if (d.error) setError(d.error)
        else {
          setRegistrations(d.registrations || [])
          setSegments(d.segments || [])
        }
      })
      .catch(() => setError('Could not load registrants.'))
      .finally(() => setLoading(false))
  }, [sessionId])

  const filtered = registrations.filter(r => {
    // Segment chip filter — restrict to a single top-level is_segment row
    // (plus its children, so sub-categories stay under the same chip).
    if (segmentFilter !== 'all') {
      if (r.category_id !== segmentFilter) {
        // Allow descendants of the selected segment to also match — the
        // chip represents "this whole segment, including its sub-categories".
        const cat = (segments.find(s => s.id === segmentFilter) as any)
        // No descendant data here, so we only match exact id; sub-categories
        // are unusual for is_segment rows anyway.
        if (!cat) return false
      }
    }
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return r.full_name?.toLowerCase().includes(q) || r.phone?.includes(q) || r.email?.toLowerCase().includes(q) || r.breadcrumb.join(' ').toLowerCase().includes(q)
  })

  const exportCsv = () => {
    const customKeys = [...new Set(filtered.flatMap(r => Object.keys(r.custom_answers || {})))]
    const headers = ['Name', 'Phone', 'Email', 'College', 'Roll', 'HSC Session', 'Project Name', 'Category', 'Team Size', 'Payment Status', 'Registered At', ...customKeys, 'Team Members']
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = filtered.map(r => [
      r.full_name, r.phone, r.email, r.college, r.college_roll, r.hsc_session, r.project_name,
      r.breadcrumb.join(' > '), r.team_size, r.payment_status, new Date(r.created_at).toISOString(),
      ...customKeys.map(k => Array.isArray(r.custom_answers?.[k]) ? r.custom_answers[k].join('; ') : (r.custom_answers?.[k] ?? '')),
      (r.team_members || []).map((m: any) => `${m.full_name} <${m.email || m.college_roll}>`).join('; '),
    ].map(escape).join(','))
    const csv = [headers.map(escape).join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `registrants-${sessionId}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  if (loading) return <p className="text-sm" style={{ color: 'var(--border-soft)' }}>Loading registrants…</p>
  if (error) return <p className="text-sm" style={{ color: 'var(--danger-soft)' }}>{error}</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-3 gap-3 flex-wrap">
        <input placeholder="Search by name, phone, email, or category…" value={search} onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none border w-full max-w-sm"
          style={{ background: 'var(--surface-alt)', borderColor: 'var(--border)', color: 'var(--white-soft)' }} />
        <div className="flex items-center gap-3 ml-auto">
          <span className="text-xs whitespace-nowrap" style={{ color: 'var(--border-soft)' }}>{filtered.length} of {registrations.length} registrant(s)</span>
          <button onClick={exportCsv} disabled={filtered.length === 0} className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0 flex items-center gap-1.5 disabled:opacity-40"
            style={{ background: 'rgba(var(--accent2-rgb), 0.1)', color: 'var(--accent2)', border: '1px solid rgba(var(--accent2-rgb), 0.25)' }}>
            <Upload size={12} style={{ transform: 'rotate(180deg)' }} /> Export CSV
          </button>
        </div>
      </div>

      {/* Segment filter chips — only shown when the event has segments */}
      {segments.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-3">
          <button onClick={() => setSegmentFilter('all')}
            className="text-xs px-3 py-1.5 rounded-full transition-colors"
            style={segmentFilter === 'all'
              ? { background: 'var(--blue)', color: '#000', fontWeight: 600 }
              : { background: 'var(--surface-deep)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
            All
          </button>
          {segments.map(seg => {
            const count = registrations.filter(r => r.category_id === seg.id).length
            const active = segmentFilter === seg.id
            return (
              <button key={seg.id} onClick={() => setSegmentFilter(seg.id)}
                className="text-xs px-3 py-1.5 rounded-full transition-colors inline-flex items-center gap-1.5"
                style={active
                  ? { background: 'rgba(var(--blue-rgb), 0.18)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.4)', fontWeight: 600 }
                  : { background: 'var(--surface-deep)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
                {seg.name}
                <span className="text-[10px] px-1 rounded" style={{ background: active ? 'rgba(var(--blue-rgb), 0.3)' : 'var(--surface)', color: active ? 'var(--blue)' : 'var(--border-soft)' }}>
                  {count}
                </span>
              </button>
            )
          })}
        </div>
      )}

      {filtered.length === 0 && (
        <p className="text-sm py-8 text-center" style={{ color: 'var(--border-soft)' }}>
          {registrations.length === 0 ? 'No one has registered for this event yet.' : 'No registrants match your search.'}
        </p>
      )}

      <div className="space-y-2">
        {filtered.map(r => (
          <div key={r.id} className="rounded-xl border p-3 flex items-center gap-3" style={{ background: 'var(--surface-deep)', borderColor: 'var(--border)' }}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-sm font-semibold" style={{ color: 'var(--white)' }}>{r.full_name}</span>
                {r.team_size > 1 && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(var(--accent2-rgb), 0.13)', color: 'var(--accent2)' }}>Team of {r.team_size}</span>}
                {r.is_online_category && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(var(--blue-rgb), 0.13)', color: 'var(--blue)' }}>Online</span>}
                {r.payment_status && r.payment_status !== 'not_required' && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{
                    background: r.payment_status === 'paid' ? '#34d39922' : r.payment_status === 'failed' ? 'rgba(var(--danger-soft-rgb), 0.13)' : 'rgba(var(--warning-rgb), 0.13)',
                    color: r.payment_status === 'paid' ? 'var(--cat-teal)' : r.payment_status === 'failed' ? 'var(--danger-soft)' : 'var(--warning)',
                  }}>{r.payment_status}</span>
                )}
              </div>
              <p className="text-xs mt-0.5 truncate" style={{ color: 'var(--muted)' }}>{r.breadcrumb.join(' → ')}</p>
              <p className="text-xs mt-0.5" style={{ color: 'var(--border-soft)' }}>{r.phone} · {r.email} · {r.college}{r.college_roll ? ` · Roll ${r.college_roll}` : ''}</p>
            </div>
            <button onClick={() => setViewing(r)} className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0"
              style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.2)' }}>
              View
            </button>
          </div>
        ))}
      </div>

      {viewing && (() => {
        // Render custom_answers in the segment's form_field_schema order, so
        // the admin sees the answers laid out exactly like the registrant
        // did. Falls back to insertion order if no schema is available.
        const viewingSegment = segments.find(s => s.id === viewing.category_id)
        const orderedKeys: string[] = []
        if (viewingSegment?.form_field_schema?.length) {
          for (const f of viewingSegment.form_field_schema) {
            const k = f.key || f.id
            if (k && !f.is_builtin && viewing.custom_answers && k in viewing.custom_answers) orderedKeys.push(k)
          }
        }
        if (viewing.custom_answers) {
          for (const k of Object.keys(viewing.custom_answers)) {
            if (!orderedKeys.includes(k)) orderedKeys.push(k)
          }
        }
        return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }} onClick={() => setViewing(null)}>
          <div className="max-w-md w-full rounded-2xl p-5 space-y-2 max-h-[80vh] overflow-y-auto" style={{ background: 'var(--surface-deep)', border: '1px solid var(--border)' }} onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-1">
              <h3 className="font-bold" style={{ color: 'var(--white)' }}>{viewing.full_name}</h3>
              <button onClick={() => setViewing(null)} style={{ color: 'var(--muted)' }}><X size={16} /></button>
            </div>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>{viewing.breadcrumb.join(' → ')}</p>
            <div className="text-sm pt-2 space-y-1" style={{ color: 'var(--white-soft)' }}>
              <p>Phone: {viewing.phone}</p>
              <p>Email: {viewing.email}</p>
              <p>College: {viewing.college} {viewing.college_roll && `(Roll ${viewing.college_roll})`}</p>
              {viewing.hsc_session && <p>HSC Session: {viewing.hsc_session}</p>}
              {viewing.project_name && <p>Project: {viewing.project_name}</p>}
              <p>Registered: {new Date(viewing.created_at).toLocaleString()}</p>
              {viewing.payment_status && <p>Payment: {viewing.payment_status}</p>}
            </div>
            {orderedKeys.length > 0 && (
              <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-bold mb-1" style={{ color: 'var(--accent2)' }}>SUBMITTED FIELDS</p>
                {orderedKeys.map((k: string) => {
                  // Look up the schema's display label, falling back to the
                  // raw key for legacy custom_answers with no schema.
                  const field = viewingSegment?.form_field_schema?.find((f: any) => (f.key || f.id) === k)
                  const label = field?.label || k
                  const v = viewing.custom_answers?.[k]
                  return (
                    <p key={k} className="text-xs" style={{ color: 'var(--muted)' }}>
                      {label}: {Array.isArray(v) ? v.join(', ') : String(v)}
                    </p>
                  )
                })}
              </div>
            )}
            {(viewing.team_members || []).length > 0 && (
              <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                <p className="text-xs font-bold mb-1" style={{ color: 'var(--accent2)' }}>TEAM MEMBERS</p>
                {viewing.team_members.map((m: any, i: number) => (
                  <p key={i} className="text-xs" style={{ color: 'var(--muted)' }}>{m.full_name} — {m.email || m.college_roll}</p>
                ))}
              </div>
            )}
            {viewing.is_online_category && (
              <p className="text-xs pt-2" style={{ color: 'var(--border-soft)' }}>
                Submission/exam content for this registrant is on the Olympiad admin page, not here.
              </p>
            )}
          </div>
        </div>
        )
      })()}
    </div>
  )
}

// Per-session appearance editor. The full editor used to live at
// /admin/forms?key=activity_register:<sessionId>, but that page also
// hosted a FormBlocksBuilder — the same field editor the per-segment
// system already has on the Registration tab. The two were redundant, so
// per-session appearance was moved onto the new
// activity_session_form_appearance table and edited here. The /admin/forms
// page is still used for the global `activity_register`, `olympiad_register`,
// and `membership` form configs.
function AppearancePanel({ sessionId, session, onSaved }: { sessionId: string; session: any; onSaved: (s: any) => void }) {
  const [appearance, setAppearance] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    fetch(`/api/admin/activity-session-appearance?session_id=${sessionId}`)
      .then(r => r.json())
      .then(d => setAppearance(d.appearance || {}))
      .catch(() => setAppearance({}))
      .finally(() => setLoading(false))
  }, [sessionId])

  const patch = (field: string, value: any) => setAppearance((prev: any) => ({ ...(prev || {}), [field]: value }))

  const save = async () => {
    setSaving(true); setError(''); setSaved(false)
    try {
      const res = await fetch('/api/admin/activity-session-appearance', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ session_id: sessionId, ...(appearance || {}) }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error)
      setAppearance(data.appearance)
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (e: any) { setError(e.message || 'Save failed.') }
    finally { setSaving(false) }
  }

  if (loading) return <p className="text-sm" style={{ color: 'var(--border-soft)' }}>Loading appearance…</p>

  // Live preview values — apply auto-pull rules so the preview matches
  // what the public register page will show.
  const previewTitle = appearance?.form_auto_pull_title ? session?.title : (appearance?.form_title || session?.title)
  const previewCover = appearance?.form_auto_pull_cover ? session?.cover_image_url : (appearance?.form_cover_photo_url || session?.cover_image_url)
  const previewAccent = resolveAccent(appearance?.form_bg_theme)
  const previewFont = resolveFont(appearance?.form_font_family)

  return (
    <div className="space-y-4">
      {/* Live preview — same fields the public register page reads */}
      <div className="rounded-xl p-4" style={{ background: 'var(--surface-deep)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-bold mb-2" style={{ color: 'var(--muted)' }}>PREVIEW (what the public form will look like)</p>
        <div className="rounded-lg p-4" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
          <h3 className="text-lg font-black mb-1" style={{ fontFamily: previewFont !== 'inherit' ? previewFont : "'Orbitron', sans-serif", color: 'var(--white)' }}>{previewTitle || '(no title)'}</h3>
          {previewCover && (
            <div className="rounded overflow-hidden mb-2" style={{ border: '1px solid var(--border)' }}>
              <img src={previewCover} alt="cover preview" className="w-full max-h-32 object-cover" />
            </div>
          )}
          <div className="flex gap-2 items-center text-xs" style={{ color: 'var(--border-soft)' }}>
            <span className="px-2 py-1 rounded" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>accent: {appearance?.form_bg_theme || 'default'}</span>
            <span className="px-2 py-1 rounded" style={{ background: 'var(--surface)', color: 'var(--muted)' }}>font: {appearance?.form_font_family || 'default'}</span>
            {appearance?.form_bg_color && <span className="px-2 py-1 rounded flex items-center gap-1" style={{ background: 'var(--surface)', color: 'var(--muted)' }}>
              <span className="w-3 h-3 rounded-sm" style={{ background: appearance.form_bg_color }} /> bg: {appearance.form_bg_color}
            </span>}
          </div>
        </div>
      </div>

      {/* Editor */}
      <div className="rounded-xl p-5 space-y-4" style={{ background: 'var(--surface-deep)', border: '1px solid var(--border)' }}>
        <p className="text-sm" style={{ color: 'var(--muted)' }}>
          Title, description, cover image, background, font, and contact persons for this event's
          registration form. The form fields themselves (name, phone, email, etc.) are configured
          per-segment on the Registration tab — not here.
        </p>

        <Field label="Title shown at the top of the form (leave blank to use the event title)">
          <input className={inputCls} style={inputStyle}
            disabled={!!appearance?.form_auto_pull_title}
            value={appearance?.form_title || ''}
            onChange={e => patch('form_title', e.target.value)} />
          <label className="flex items-center gap-2 text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={!!appearance?.form_auto_pull_title}
              onChange={e => patch('form_auto_pull_title', e.target.checked)} />
            Auto-pull from the event's title instead
          </label>
        </Field>

        <Field label="Subtitle / description shown under the title">
          <input className={inputCls} style={inputStyle}
            disabled={!!appearance?.form_auto_pull_description}
            value={appearance?.form_subtitle || ''}
            onChange={e => patch('form_subtitle', e.target.value)} />
          <label className="flex items-center gap-2 text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={!!appearance?.form_auto_pull_description}
              onChange={e => patch('form_auto_pull_description', e.target.checked)} />
            Auto-pull from the event's description instead
          </label>
        </Field>

        <Field label="Cover photo URL (leave blank to use the event's cover image)">
          <input className={inputCls} style={inputStyle}
            disabled={!!appearance?.form_auto_pull_cover}
            value={appearance?.form_cover_photo_url || ''}
            onChange={e => patch('form_cover_photo_url', e.target.value)} />
          <label className="flex items-center gap-2 text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={!!appearance?.form_auto_pull_cover}
              onChange={e => patch('form_auto_pull_cover', e.target.checked)} />
            Auto-pull from the event's cover image instead
          </label>
          {appearance?.form_cover_photo_url && !appearance?.form_auto_pull_cover && (
            <img src={appearance.form_cover_photo_url} alt="" className="mt-2 rounded-lg w-full h-24"
              style={{ objectFit: appearance?.form_cover_aspect_ratio === 'auto' ? 'contain' : 'cover' }} />
          )}
          <div className="mt-2">
            <label className="text-xs block mb-1" style={{ color: 'var(--border-soft)' }}>Render cover at</label>
            <select className={inputCls} style={inputStyle}
              value={appearance?.form_cover_aspect_ratio || 'auto'}
              onChange={e => patch('form_cover_aspect_ratio', e.target.value)}>
              {COVER_RATIO_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
          </div>
        </Field>

        <Field label="Accent color (asterisks, buttons, focus rings)">
          <div className="flex flex-wrap gap-2">
            {THEME_PRESETS.map(t => (
              <button key={t.value} type="button" onClick={() => patch('form_bg_theme', t.value === 'default' ? null : t.value)}
                className="w-9 h-9 rounded-full border-2 flex items-center justify-center"
                style={{ background: t.swatch, borderColor: (appearance?.form_bg_theme || 'default') === t.value ? '#fff' : 'transparent' }}
                title={t.label}>
                {((appearance?.form_bg_theme || 'default') === t.value) && <Check size={13} style={{ color: '#000' }} strokeWidth={3} />}
              </button>
            ))}
            <input type="color"
              value={appearance?.form_bg_theme?.startsWith('#') ? appearance.form_bg_theme : '#3b82f6'}
              onChange={e => patch('form_bg_theme', e.target.value)}
              className="w-9 h-9 rounded-full border-2 cursor-pointer"
              style={{ borderColor: appearance?.form_bg_theme?.startsWith('#') ? '#fff' : 'transparent', padding: 0, background: 'none' }}
              title="Custom color" />
          </div>
          <p className="text-xs mt-1" style={{ color: 'var(--border-soft)' }}>
            Current accent: <span className="font-mono">{previewAccent}</span>
          </p>
        </Field>

        <Field label="Page background">
          <div className="flex gap-2 items-center">
            <input type="color" value={appearance?.form_bg_color || '#0b0f19'}
              onChange={e => patch('form_bg_color', e.target.value)}
              className="w-9 h-9 rounded cursor-pointer" style={{ padding: 0, background: 'none', border: '1px solid var(--border)' }}
              title="Background color" />
            <input className={inputCls} style={inputStyle}
              value={appearance?.form_bg_image_url || ''}
              placeholder="Optional background image URL (tiled/cover behind the whole form)"
              onChange={e => patch('form_bg_image_url', e.target.value)} />
          </div>
        </Field>

        <Field label="Font">
          <select className={inputCls} style={inputStyle}
            value={appearance?.form_font_family || 'default'}
            onChange={e => patch('form_font_family', e.target.value)}>
            {FONT_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </Field>

        <Field label="Contact persons (shown at the bottom of the form)">
          <p className="text-xs mb-3" style={{ color: 'var(--border-soft)' }}>
            Add contact info for people students can reach out to, or pull from the Executive Committee page.
          </p>
          <ContactPersonsEditor
            value={appearance?.form_contact_persons || []}
            onChange={next => patch('form_contact_persons', next)}
            idPrefix={`appearance-${sessionId}`}
          />
        </Field>

        {error && <p className="text-sm p-3 rounded-lg" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)' }}>{error}</p>}

        <button onClick={save} disabled={saving}
          className="px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50 flex items-center gap-2"
          style={{ background: saved ? 'var(--cat-teal)' : 'var(--blue)', color: '#000' }}>
          <Save size={14} />
          {saving ? 'Saving…' : saved ? 'Saved' : 'Save Appearance'}
        </button>
      </div>
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs mb-1 font-medium" style={{ color: 'var(--muted)' }}>{label}</label>
      {children}
    </div>
  )
}

async function uploadSessionFile(file: File, folder: string): Promise<string> {
  const fd = new FormData()
  fd.append('file', file)
  fd.append('folder', folder)
  const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
  const data = await res.json()
  if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed')
  return data.url
}

// File management — cover image, gallery, PDF, and YouTube link for this
// session. These are the same fields the Activities admin list edits, kept
// here too so file uploads live alongside the rest of the per-event setup.
function FilesPanel({ sessionId, session, onSaved }: { sessionId: string; session: any; onSaved: (s: any) => void }) {
  const [coverUrl, setCoverUrl] = useState(session?.cover_image_url || '')
  const [pdfUrl, setPdfUrl] = useState(session?.pdf_url || '')
  const [youtubeUrl, setYoutubeUrl] = useState(session?.youtube_url || '')
  const [galleryUrls, setGalleryUrls] = useState<string[]>(session?.gallery_urls || [])
  const [uploading, setUploading] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    setCoverUrl(session?.cover_image_url || '')
    setPdfUrl(session?.pdf_url || '')
    setYoutubeUrl(session?.youtube_url || '')
    setGalleryUrls(session?.gallery_urls || [])
  }, [session?.id])

  const handleSingleUpload = async (e: React.ChangeEvent<HTMLInputElement>, field: 'cover' | 'pdf', folder: string) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(field)
    setError('')
    try {
      const url = await uploadSessionFile(file, folder)
      if (field === 'cover') setCoverUrl(url); else setPdfUrl(url)
    } catch (ex: any) {
      setError(ex.message || 'Upload failed.')
    } finally {
      setUploading('')
      e.target.value = ''
    }
  }

  const handleGalleryUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return
    setUploading('gallery')
    setError('')
    try {
      const urls = await Promise.all(files.map(f => uploadSessionFile(f, 'gallery')))
      setGalleryUrls(prev => [...prev, ...urls])
    } catch (ex: any) {
      setError(ex.message || 'Upload failed.')
    } finally {
      setUploading('')
      e.target.value = ''
    }
  }

  const save = async () => {
    setSaving(true)
    setError('')
    setSaved(false)
    try {
      const res = await fetch('/api/admin/activity-sessions', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: sessionId,
          cover_image_url: coverUrl,
          pdf_url: pdfUrl,
          youtube_url: youtubeUrl,
          gallery_urls: galleryUrls,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not save files.'); return }
      onSaved(data)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setError('Network error while saving.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="rounded-xl p-5 space-y-5" style={{ background: 'var(--surface-deep)', border: '1px solid var(--border)' }}>
      <p className="text-sm" style={{ color: 'var(--muted)' }}>
        Cover image, gallery, PDF, and YouTube link shown on this event's public page. These are
        separate from the registration form's own cover (set under Appearance).
      </p>

      {error && (
        <div className="p-3 rounded-lg text-sm" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)', border: '1px solid rgba(var(--danger-rgb), 0.3)' }}>
          {error}
        </div>
      )}

      <div>
        <label className="flex items-center gap-1.5 text-xs font-bold mb-2" style={{ color: 'var(--blue)' }}>
          <ImageIcon size={13} /> COVER IMAGE
        </label>
        <div className="flex items-center gap-3">
          {coverUrl && <img src={coverUrl} alt="Cover" className="h-14 w-24 object-cover rounded-lg" style={{ border: '1px solid var(--border)' }} />}
          <label className="text-xs px-3 py-2 rounded-lg cursor-pointer" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
            {uploading === 'cover' ? 'Uploading…' : coverUrl ? 'Replace image' : 'Upload image'}
            <input type="file" accept="image/*" className="hidden" onChange={e => handleSingleUpload(e, 'cover', 'covers')} />
          </label>
          {coverUrl && (
            <button onClick={() => setCoverUrl('')} className="text-xs" style={{ color: 'var(--danger-soft)' }}>Remove</button>
          )}
        </div>
      </div>

      <hr style={{ borderColor: 'var(--border)' }} />

      <div>
        <label className="flex items-center gap-1.5 text-xs font-bold mb-2" style={{ color: 'var(--cat-teal)' }}>
          <Images size={13} /> GALLERY
        </label>
        {galleryUrls.length > 0 && (
          <div className="flex flex-wrap gap-2 mb-2">
            {galleryUrls.map((url, i) => (
              <div key={i} className="relative">
                <img src={url} alt={`Gallery ${i + 1}`} className="h-16 w-16 object-cover rounded-lg" style={{ border: '1px solid var(--border)' }} />
                <button onClick={() => setGalleryUrls(prev => prev.filter((_, j) => j !== i))}
                  className="absolute -top-1.5 -right-1.5 rounded-full p-0.5" style={{ background: 'var(--danger-soft)', color: '#000' }}>
                  <X size={11} />
                </button>
              </div>
            ))}
          </div>
        )}
        <label className="inline-block text-xs px-3 py-2 rounded-lg cursor-pointer" style={{ background: 'rgba(var(--cat-teal-rgb), 0.1)', color: 'var(--cat-teal)', border: '1px solid rgba(var(--cat-teal-rgb), 0.3)' }}>
          {uploading === 'gallery' ? 'Uploading…' : 'Add gallery images'}
          <input type="file" accept="image/*" multiple className="hidden" onChange={handleGalleryUpload} />
        </label>
      </div>

      <hr style={{ borderColor: 'var(--border)' }} />

      <div>
        <label className="flex items-center gap-1.5 text-xs font-bold mb-2" style={{ color: 'var(--warning)' }}>
          <FileText size={13} /> PDF DOCUMENT
        </label>
        <div className="flex items-center gap-3">
          {pdfUrl && <a href={pdfUrl} target="_blank" rel="noreferrer" className="text-xs underline" style={{ color: 'var(--warning)' }}>View current PDF</a>}
          <label className="text-xs px-3 py-2 rounded-lg cursor-pointer" style={{ background: 'rgba(var(--warning-rgb), 0.1)', color: 'var(--warning)', border: '1px solid rgba(var(--warning-rgb), 0.3)' }}>
            {uploading === 'pdf' ? 'Uploading…' : pdfUrl ? 'Replace PDF' : 'Upload PDF'}
            <input type="file" accept=".pdf" className="hidden" onChange={e => handleSingleUpload(e, 'pdf', 'pdfs')} />
          </label>
          {pdfUrl && (
            <button onClick={() => setPdfUrl('')} className="text-xs" style={{ color: 'var(--danger-soft)' }}>Remove</button>
          )}
        </div>
      </div>

      <hr style={{ borderColor: 'var(--border)' }} />

      <div>
        <label className="flex items-center gap-1.5 text-xs font-bold mb-2" style={{ color: 'var(--danger-soft)' }}>
          <Youtube size={13} /> YOUTUBE LINK
        </label>
        <input value={youtubeUrl} onChange={e => setYoutubeUrl(e.target.value)} placeholder="https://youtube.com/watch?v=..."
          className={inputCls} style={inputStyle} />
      </div>

      <button onClick={save} disabled={saving || !!uploading}
        className="px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
        style={{ background: 'var(--blue)', color: '#000' }}>
        {saving ? 'Saving...' : saved ? <span className="inline-flex items-center gap-1.5">Saved <Check size={14} /></span> : 'Save Changes'}
      </button>
    </div>
  )
}

// Per-event updates/announcements admin can post — shown newest-first on
// the user-facing "My Events" dashboard for anyone registered here (1.7).
function UpdatesPanel({ sessionId }: { sessionId: string }) {
  const [updates, setUpdates] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [link, setLink] = useState('')
  const [posting, setPosting] = useState(false)

  const load = () => {
    fetch(`/api/admin/activity-updates?sessionId=${sessionId}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setUpdates(d.updates || []) })
      .catch(() => setError('Could not load updates.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => { load() }, [sessionId])

  const post = async () => {
    if (!title.trim()) return
    setPosting(true)
    setError('')
    try {
      const res = await fetch('/api/admin/activity-updates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_session_id: sessionId, title, body, link_url: link }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not post update.'); return }
      setUpdates(prev => [data.update, ...prev])
      setTitle(''); setBody(''); setLink('')
    } catch {
      setError('Network error while posting.')
    } finally {
      setPosting(false)
    }
  }

  const remove = async (id: string) => {
    if (!confirm('Delete this update?')) return
    await fetch('/api/admin/activity-updates', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id }),
    })
    setUpdates(prev => prev.filter(u => u.id !== id))
  }

  if (loading) return <p className="text-sm" style={{ color: 'var(--border-soft)' }}>Loading updates…</p>

  return (
    <div>
      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)', border: '1px solid rgba(var(--danger-rgb), 0.3)' }}>
          {error}
        </div>
      )}
      <div className="rounded-xl p-4 mb-5 space-y-2" style={{ background: 'var(--surface-deep)', border: '1px solid var(--border)' }}>
        <p className="text-xs font-bold" style={{ color: 'var(--muted)' }}>POST AN UPDATE</p>
        <input placeholder="Title (e.g. Venue changed)" value={title} onChange={e => setTitle(e.target.value)}
          className={inputCls} style={inputStyle} />
        <textarea placeholder="Details (optional)" value={body} onChange={e => setBody(e.target.value)}
          rows={2} className={inputCls} style={inputStyle} />
        <input placeholder="Link (optional)" value={link} onChange={e => setLink(e.target.value)}
          className={inputCls} style={inputStyle} />
        <button onClick={post} disabled={posting || !title.trim()}
          className="text-xs px-4 py-2 rounded-lg font-semibold disabled:opacity-40"
          style={{ background: 'rgba(var(--blue-rgb), 0.15)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.4)' }}>
          {posting ? 'Posting…' : 'Post update'}
        </button>
      </div>

      {updates.length === 0 ? (
        <p className="text-sm" style={{ color: 'var(--border-soft)' }}>No updates posted yet for this event.</p>
      ) : (
        <div className="space-y-2">
          {updates.map(u => (
            <div key={u.id} className="rounded-xl border p-3" style={{ background: 'var(--surface-deep)', borderColor: 'var(--border)' }}>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold" style={{ color: 'var(--white)' }}>{u.title}</p>
                <button onClick={() => remove(u.id)} style={{ color: 'var(--danger-soft)' }}><Trash2 size={13} /></button>
              </div>
              {u.body && <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>{u.body}</p>}
              {u.link_url && <a href={u.link_url} target="_blank" rel="noreferrer" className="text-xs mt-1 inline-block" style={{ color: 'var(--blue)' }}>{u.link_url}</a>}
              <p className="text-xs mt-1" style={{ color: 'var(--border-soft)' }}>{new Date(u.created_at).toLocaleString()}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function CategoryEditor({ category, isLeaf, onSave }: { category: Category; isLeaf: boolean; onSave: (patch: Partial<Category> & { online_type?: string }) => void }) {
  const [name, setName] = useState(category.name)
  const [description, setDescription] = useState(category.description || '')
  const [registrationOpen, setRegistrationOpen] = useState(category.registration_open !== false)
  const [customFields, setCustomFields] = useState<CustomField[]>(category.custom_fields || [])
  const [requiresTeam, setRequiresTeam] = useState(category.requires_team)
  const [teamMin, setTeamMin] = useState(category.team_size_min?.toString() || '')
  const [teamMax, setTeamMax] = useState(category.team_size_max?.toString() || '')
  const [teamFields, setTeamFields] = useState<CustomField[]>(category.team_member_fields || [])
  const [requiresPayment, setRequiresPayment] = useState(category.requires_payment)
  const [paymentAmount, setPaymentAmount] = useState(category.payment_amount?.toString() || '')
  const [paymentLabel, setPaymentLabel] = useState(category.payment_label || '')
  const [isOnlineSubmission, setIsOnlineSubmission] = useState(category.is_online_submission)
  const [onlineType, setOnlineType] = useState(deriveOnlineType(category.linked_olympiad))
  const [scheduleDate, setScheduleDate] = useState(category.schedule_date || '')
  const [scheduleTime, setScheduleTime] = useState(category.schedule_time || '')
  const [scheduleRoom, setScheduleRoom] = useState(category.schedule_room || '')
  const [editWindowHours, setEditWindowHours] = useState(category.edit_window_hours?.toString() || '')
  const [submissionConfig, setSubmissionConfig] = useState<SubmissionField[]>(category.submission_config || [])
  const [submissionWho, setSubmissionWho] = useState<'leader' | 'any_member'>(category.submission_who || 'leader')
  const [projectNameEnabled, setProjectNameEnabled] = useState(category.project_name_enabled || false)
  const [projectNameLabel, setProjectNameLabel] = useState(category.project_name_label || 'Project Name')
  const [saving, setSaving] = useState(false)

  const fieldTypeOptions: { value: FieldType; label: string }[] = [
    { value: 'text', label: 'Short text' },
    { value: 'textarea', label: 'Long text' },
    { value: 'number', label: 'Number' },
    { value: 'dropdown', label: 'Dropdown' },
    { value: 'multiple_choice', label: 'Multiple choice' },
    { value: 'checkboxes', label: 'Checkboxes' },
    { value: 'date', label: 'Date' },
    { value: 'time', label: 'Time' },
    { value: 'photo', label: 'Photo upload' },
    { value: 'file', label: 'File upload' },
  ]

  const addField = (setter: typeof setCustomFields) => setter(prev => [...prev, BLANK_FIELD()])
  const removeField = (setter: typeof setCustomFields, key: string) => setter(prev => prev.filter(f => f.key !== key))
  const patchField = (setter: typeof setCustomFields, key: string, patch: Partial<CustomField>) =>
    setter(prev => prev.map(f => f.key === key ? { ...f, ...patch } : f))

  // Options are edited one-per-row (like the olympiad MCQ builder) so option text
  // can freely contain commas/spaces instead of being split from one joined string.
  const addOption = (setter: typeof setCustomFields, key: string) =>
    setter(prev => prev.map(f => f.key === key ? { ...f, options: [...(f.options || []), ''] } : f))
  const updateOption = (setter: typeof setCustomFields, key: string, index: number, text: string) =>
    setter(prev => prev.map(f => f.key === key ? { ...f, options: (f.options || []).map((o, i) => i === index ? text : o) } : f))
  const removeOption = (setter: typeof setCustomFields, key: string, index: number) =>
    setter(prev => prev.map(f => f.key === key ? { ...f, options: (f.options || []).filter((_, i) => i !== index) } : f))

  const save = async () => {
    setSaving(true)
    await onSave({
      name, description,
      registration_open: registrationOpen,
      custom_fields: customFields,
      requires_team: requiresTeam,
      team_size_min: teamMin ? Number(teamMin) : null,
      team_size_max: teamMax ? Number(teamMax) : null,
      team_member_fields: teamFields,
      requires_payment: requiresPayment,
      payment_amount: paymentAmount ? Number(paymentAmount) : null,
      payment_label: paymentLabel || null,
      is_online_submission: isOnlineSubmission,
      online_type: isOnlineSubmission ? onlineType : undefined,
      schedule_date: scheduleDate || null,
      schedule_time: scheduleTime || null,
      schedule_room: scheduleRoom || null,
      edit_window_hours: editWindowHours ? Number(editWindowHours) : null,
      submission_config: submissionConfig,
      submission_who: submissionWho,
      project_name_enabled: projectNameEnabled,
      project_name_label: projectNameLabel || null,
    })
    setSaving(false)
  }

  return (
    <div className="p-4 border-t space-y-4" style={{ borderColor: 'var(--border)' }}>
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Name</label>
        <input value={name} onChange={e => setName(e.target.value)} className={inputCls} style={inputStyle} />
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Description (optional, shown to students)</label>
        <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className={inputCls + ' resize-none'} style={inputStyle} />
      </div>
      <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: registrationOpen ? 'var(--cat-teal)' : 'var(--danger-soft)' }}>
        <input type="checkbox" checked={registrationOpen} onChange={e => setRegistrationOpen(e.target.checked)} />
        {registrationOpen ? 'Accepting new registrants' : 'Closed to new registrants'}
      </label>
      <p className="text-xs" style={{ color: 'var(--border-soft)' }}>
        {isLeaf
          ? 'Turn off to stop new people from registering here, without hiding it or deleting anything (existing registrants are unaffected).'
          : 'Closing this also closes every category nested under it, even if they\'re individually marked as open.'}
      </p>

      {isLeaf && (
        <>
          <hr style={{ borderColor: 'var(--border)' }} />
          <LegacyFieldListEditor fields={customFields} onChange={setCustomFields} title="EXTRA REGISTRATION FIELDS (besides name, phone, email, college, roll, HSC session)" />

          <hr style={{ borderColor: 'var(--border)' }} />
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: 'var(--accent2)' }}>
              <input type="checkbox" checked={requiresTeam} onChange={e => setRequiresTeam(e.target.checked)} />
              <Users size={14} /> This is a team registration
            </label>
            {requiresTeam && (
              <div className="space-y-3 pl-6">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Min team size</label>
                    <input type="number" value={teamMin} onChange={e => setTeamMin(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Max team size</label>
                    <input type="number" value={teamMax} onChange={e => setTeamMax(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                </div>
                <LegacyFieldListEditor fields={teamFields} onChange={setTeamFields} title="INFO COLLECTED PER TEAM MEMBER" />
                <p className="text-xs" style={{ color: 'var(--border-soft)' }}>
                  The team leader sets a password for each member during registration — every
                  member gets an email with their info and password so they can log in to their own dashboard.
                </p>
              </div>
            )}
          </div>

          <hr style={{ borderColor: 'var(--border)' }} />
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: 'var(--warning)' }}>
              <input type="checkbox" checked={requiresPayment} onChange={e => setRequiresPayment(e.target.checked)} />
              <CreditCard size={14} /> Requires payment
            </label>
            {requiresPayment && (
              <div className="grid grid-cols-2 gap-3 pl-6">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Amount (BDT)</label>
                  <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Payment label</label>
                  <input placeholder="e.g. Registration fee" value={paymentLabel} onChange={e => setPaymentLabel(e.target.value)} className={inputCls} style={inputStyle} />
                </div>
              </div>
            )}
          </div>

          <hr style={{ borderColor: 'var(--border)' }} />
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-1" style={{ color: 'var(--blue)' }}>
              <input type="checkbox" checked={isOnlineSubmission} onChange={e => setIsOnlineSubmission(e.target.checked)} />
              <Link2 size={14} /> This is an online-submission / exam round
            </label>
            <p className="text-xs pl-6 mb-2" style={{ color: 'var(--border-soft)' }}>
              {category.linked_olympiad_id
                ? 'Already linked to an Olympiad — registrants access exam/submission from their dashboard.'
                : 'Saving with this on will automatically create a linked Olympiad behind the scenes.'}
            </p>
            {category.linked_olympiad_id && (
              <div className="pl-6 space-y-2">
                <div>
                  <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Online Type</label>
                  <select value={onlineType} onChange={e => setOnlineType(e.target.value)}
                    className="px-2 py-2 rounded-lg text-sm border outline-none w-full max-w-xs" style={inputStyle}>
                    <option value="pure_submission">Pure Submission — students just upload their work</option>
                    <option value="full_quiz">Full Quiz System — fully online, timed exam</option>
                    <option value="mixed">Mixed — students can do both</option>
                    <option value="science_relay">Science Relay — team members take turns</option>
                  </select>
                </div>
                <Link href={`/admin/olympiads?edit=${category.linked_olympiad_id}&back_session=${category.activity_session_id}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: 'rgba(var(--blue-rgb), 0.12)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
                  <Zap size={13} /> Configure questions, scheduling & relay details →
                </Link>
                <p className="text-xs mt-1" style={{ color: 'var(--border-soft)' }}>Add questions, subject assignment, relay sequencing, and scheduling there.</p>
              </div>
            )}
          </div>

          {isOnlineSubmission && (
            <>
              <hr style={{ borderColor: 'var(--border)' }} />
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: 'var(--blue)' }}>
                  <Upload size={13} className="inline mr-1.5 -mt-0.5" /> SUBMISSION FIELDS (what the student uploads / fills when they hit &quot;Submit Now&quot;)
                </p>
                <p className="text-xs mb-3" style={{ color: 'var(--border-soft)' }}>
                  Leave empty if this is a live MCQ exam (no file submission). Add fields for project uploads, answer sheets, videos, etc.
                </p>
                {submissionConfig.map((field, idx) => (
                  <div key={field.id} className="p-3 rounded-lg mb-2 space-y-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                    <div className="flex gap-2 items-start">
                      <div className="flex-1 space-y-2">
                        <input placeholder="Field title (e.g. Answer Sheet, Project Video)" value={field.title}
                          onChange={e => setSubmissionConfig(prev => prev.map((f, i) => i === idx ? { ...f, title: e.target.value } : f))}
                          className={inputCls} style={inputStyle} />
                        <input placeholder="Description (e.g. Upload your answer sheet as PDF, max 6 pages)" value={field.description || ''}
                          onChange={e => setSubmissionConfig(prev => prev.map((f, i) => i === idx ? { ...f, description: e.target.value } : f))}
                          className={inputCls} style={inputStyle} />
                      </div>
                      <button onClick={() => setSubmissionConfig(prev => prev.filter((_, i) => i !== idx))} style={{ color: 'var(--danger-soft)', marginTop: '4px' }}>
                        <Trash2 size={14} />
                      </button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Field type</label>
                        <select value={field.field_type}
                          onChange={e => setSubmissionConfig(prev => prev.map((f, i) => i === idx ? { ...f, field_type: e.target.value as any } : f))}
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
                              onChange={e => setSubmissionConfig(prev => prev.map((f, i) => i === idx ? { ...f, file_types: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : f))}
                              className={inputCls} style={inputStyle} />
                          </div>
                          <div>
                            <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Max file size (MB)</label>
                            <input type="number" placeholder="5" value={field.max_file_size_mb || ''}
                              onChange={e => setSubmissionConfig(prev => prev.map((f, i) => i === idx ? { ...f, max_file_size_mb: Number(e.target.value) } : f))}
                              className={inputCls} style={inputStyle} />
                          </div>
                          <div>
                            <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Max number of files</label>
                            <input type="number" placeholder="1" value={field.max_files || ''}
                              onChange={e => setSubmissionConfig(prev => prev.map((f, i) => i === idx ? { ...f, max_files: Number(e.target.value) } : f))}
                              className={inputCls} style={inputStyle} />
                          </div>
                        </>
                      )}
                    </div>
                    <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                      <input type="checkbox" checked={field.required}
                        onChange={e => setSubmissionConfig(prev => prev.map((f, i) => i === idx ? { ...f, required: e.target.checked } : f))} />
                      Required field
                    </label>
                  </div>
                ))}
                <button onClick={() => setSubmissionConfig(prev => [...prev, BLANK_SUBMISSION_FIELD()])}
                  className="text-xs px-3 py-1.5 rounded flex items-center gap-1 mt-1"
                  style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>
                  <Plus size={11} /> Add submission field
                </button>

                {submissionConfig.length > 0 && (
                  <div className="mt-3">
                    <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Who can submit?</label>
                    <select value={submissionWho} onChange={e => setSubmissionWho(e.target.value as any)}
                      className={inputCls} style={inputStyle}>
                      <option value="leader">Team leader only</option>
                      <option value="any_member">Any team member</option>
                    </select>
                  </div>
                )}
              </div>
            </>
          )}

          <hr style={{ borderColor: 'var(--border)' }} />
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: 'var(--accent2)' }}>
              <input type="checkbox" checked={projectNameEnabled} onChange={e => setProjectNameEnabled(e.target.checked)} />
              <Microscope size={14} /> Collect a project name during registration
            </label>
            {projectNameEnabled && (
              <div className="pl-6">
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Field label shown to student</label>
                <input value={projectNameLabel} onChange={e => setProjectNameLabel(e.target.value)}
                  placeholder="Project Name" className={inputCls} style={inputStyle} />
              </div>
            )}
          </div>

          <hr style={{ borderColor: 'var(--border)' }} />
          <div>
            <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: 'var(--cat-teal)' }}>
              <Calendar size={13} /> SCHEDULE (shown as a reminder on the registrant's dashboard)
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Date</label>
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Time</label>
                <input placeholder="10:00 AM - 12:00 PM" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Room / Venue</label>
                <input value={scheduleRoom} onChange={e => setScheduleRoom(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
            </div>
          </div>

          <hr style={{ borderColor: 'var(--border)' }} />
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>
              Self-edit window (hours after registering — leave blank for no time limit)
            </label>
            <input type="number" placeholder="e.g. 48" value={editWindowHours} onChange={e => setEditWindowHours(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
        </>
      )}

      <button onClick={save} disabled={saving}
        className="px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
        style={{ background: 'var(--blue)', color: '#000' }}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}

// Segments section — the new top-level building block. Each segment is a public
// card on the event page, with its own icon, bg image, and form_field_schema.
function SegmentsSection({
  segments, onAdd, onPatch, onDelete, editingId, setEditingId,
}: {
  segments: Category[]
  onAdd: () => void
  onPatch: (id: string, patch: Partial<Category> & { online_type?: string }) => void
  onDelete: (id: string) => void
  editingId: string | null
  setEditingId: (id: string | null) => void
}) {
  return (
    <div className="space-y-3">
      {segments.length === 0 ? (
        <div className="p-8 rounded-xl border-2 border-dashed text-center" style={{ borderColor: 'rgba(var(--blue-rgb), 0.3)', background: 'rgba(var(--blue-rgb), 0.04)' }}>
          <Sparkles size={20} style={{ color: 'var(--blue)' }} className="mx-auto mb-2" />
          <p className="text-sm font-semibold mb-1" style={{ color: 'var(--white)' }}>No segments yet</p>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            Add your first segment to start collecting registrations for this event.
          </p>
          <button onClick={onAdd}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-bold"
            style={{ background: 'var(--blue)', color: '#000' }}>
            <Plus size={14} /> Add segment
          </button>
        </div>
      ) : (
        <>
          {segments.map(seg => (
            <div key={seg.id} className="rounded-xl border" style={{ background: 'var(--bg2)', borderColor: 'var(--border)' }}>
              <div className="flex items-center gap-2 p-3">
                <span className="text-sm font-semibold flex-1" style={{ color: 'var(--white)' }}>{seg.name}</span>
                <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>Segment</span>
                {seg.requires_team && <Users size={13} style={{ color: 'var(--accent2)' }} />}
                {seg.requires_payment && <CreditCard size={13} style={{ color: 'var(--warning)' }} />}
                {seg.is_online_submission && <Link2 size={13} style={{ color: 'var(--blue)' }} />}
                <button onClick={() => setEditingId(editingId === seg.id ? null : seg.id)}
                  className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>
                  {editingId === seg.id ? 'Close' : 'Edit'}
                </button>
                <button onClick={() => onDelete(seg.id)} style={{ color: 'var(--danger-soft)' }}>
                  <Trash2 size={14} />
                </button>
              </div>
              {editingId === seg.id && (
                <SegmentEditor segment={seg} onSave={patch => onPatch(seg.id, patch)} />
              )}
            </div>
          ))}
          <button onClick={onAdd}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
            style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
            <Plus size={14} /> Add another segment
          </button>
        </>
      )}
    </div>
  )
}

// Editor for one segment. Reuses the same shape as the legacy CategoryEditor
// (team/payment/online/schedule/submission_config/project_name) but lives at the
// top level and adds:
//   - icon (text name) and bg_image_url (upload)
//   - form_field_schema editor (the new Google Forms–style unified field list)
function SegmentEditor({ segment, onSave }: { segment: Category; onSave: (patch: Partial<Category> & { online_type?: string }) => void }) {
  const [name, setName] = useState(segment.name)
  const [description, setDescription] = useState(segment.description || '')
  const [icon, setIcon] = useState(segment.icon || '')
  const [bgImageUrl, setBgImageUrl] = useState(segment.bg_image_url || '')
  const [registrationOpen, setRegistrationOpen] = useState(segment.registration_open !== false)
  const [formFieldSchema, setFormFieldSchema] = useState<FormBlock[]>(segment.form_field_schema || [])
  const [requiresTeam, setRequiresTeam] = useState(segment.requires_team)
  const [teamMin, setTeamMin] = useState(segment.team_size_min?.toString() || '')
  const [teamMax, setTeamMax] = useState(segment.team_size_max?.toString() || '')
  const [teamFields, setTeamFields] = useState<CustomField[]>(segment.team_member_fields || [])
  const [requiresPayment, setRequiresPayment] = useState(segment.requires_payment)
  const [paymentAmount, setPaymentAmount] = useState(segment.payment_amount?.toString() || '')
  const [paymentLabel, setPaymentLabel] = useState(segment.payment_label || '')
  const [isOnlineSubmission, setIsOnlineSubmission] = useState(segment.is_online_submission)
  const [onlineType, setOnlineType] = useState(deriveOnlineType(segment.linked_olympiad))
  const [scheduleDate, setScheduleDate] = useState(segment.schedule_date || '')
  const [scheduleTime, setScheduleTime] = useState(segment.schedule_time || '')
  const [scheduleRoom, setScheduleRoom] = useState(segment.schedule_room || '')
  const [editWindowHours, setEditWindowHours] = useState(segment.edit_window_hours?.toString() || '')
  const [submissionConfig, setSubmissionConfig] = useState<SubmissionField[]>(segment.submission_config || [])
  const [submissionWho, setSubmissionWho] = useState<'leader' | 'any_member'>(segment.submission_who || 'leader')
  const [projectNameEnabled, setProjectNameEnabled] = useState(segment.project_name_enabled || false)
  const [projectNameLabel, setProjectNameLabel] = useState(segment.project_name_label || 'Project Name')
  const [saving, setSaving] = useState(false)
  const [bgUploading, setBgUploading] = useState(false)
  const [bgError, setBgError] = useState('')

  const handleBgUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setBgUploading(true)
    setBgError('')
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/admin/upload', { method: 'POST', body: fd })
      const data = await res.json()
      if (!res.ok || !data.url) throw new Error(data.error || 'Upload failed')
      setBgImageUrl(data.url)
    } catch (ex: any) { setBgError(ex.message || 'Upload failed') }
    finally { setBgUploading(false); e.target.value = '' }
  }

  const save = async () => {
    setSaving(true)
    await onSave({
      name, description, icon: icon || null, bg_image_url: bgImageUrl || null,
      registration_open: registrationOpen,
      form_field_schema: formFieldSchema,
      requires_team: requiresTeam,
      team_size_min: teamMin ? Number(teamMin) : null,
      team_size_max: teamMax ? Number(teamMax) : null,
      team_member_fields: teamFields,
      requires_payment: requiresPayment,
      payment_amount: paymentAmount ? Number(paymentAmount) : null,
      payment_label: paymentLabel || null,
      is_online_submission: isOnlineSubmission,
      online_type: isOnlineSubmission ? onlineType : undefined,
      schedule_date: scheduleDate || null,
      schedule_time: scheduleTime || null,
      schedule_room: scheduleRoom || null,
      edit_window_hours: editWindowHours ? Number(editWindowHours) : null,
      submission_config: submissionConfig,
      submission_who: submissionWho,
      project_name_enabled: projectNameEnabled,
      project_name_label: projectNameLabel || null,
    })
    setSaving(false)
  }

  return (
    <div className="p-4 border-t space-y-4" style={{ borderColor: 'var(--border)' }}>
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Segment name</label>
        <input value={name} onChange={e => setName(e.target.value)} className={inputCls} style={inputStyle} />
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Description (shown on the public segment card)</label>
        <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className={inputCls + ' resize-none'} style={inputStyle} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Icon (Lucide name or emoji)</label>
          <input value={icon} onChange={e => setIcon(e.target.value)} placeholder="e.g. flask, trophy, or 🔬"
            className={inputCls} style={inputStyle} />
        </div>
        <div>
          <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Background image (optional)</label>
          <div className="flex items-center gap-2">
            {bgImageUrl && <img src={bgImageUrl} alt="" className="h-9 w-14 object-cover rounded" style={{ border: '1px solid var(--border)' }} />}
            <label className="text-xs px-3 py-1.5 rounded cursor-pointer whitespace-nowrap"
              style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
              {bgUploading ? 'Uploading…' : bgImageUrl ? 'Replace' : 'Upload'}
              <input type="file" accept="image/*" className="hidden" onChange={handleBgUpload} />
            </label>
            {bgImageUrl && (
              <button onClick={() => setBgImageUrl('')} className="text-xs" style={{ color: 'var(--danger-soft)' }}>Remove</button>
            )}
          </div>
          {bgError && <p className="text-xs mt-1" style={{ color: 'var(--danger-soft)' }}>{bgError}</p>}
        </div>
      </div>

      <label className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: registrationOpen ? 'var(--cat-teal)' : 'var(--danger-soft)' }}>
        <input type="checkbox" checked={registrationOpen} onChange={e => setRegistrationOpen(e.target.checked)} />
        {registrationOpen ? 'Accepting new registrants' : 'Closed to new registrants'}
      </label>

      <hr style={{ borderColor: 'var(--border)' }} />

      {/* The unified field editor — full Google Forms–style control over
          what registrants fill in for this segment. Built-in fields are
          pre-loaded but can be deleted (with a warning). */}
      <FieldsEditor
        blocks={formFieldSchema}
        onChange={setFormFieldSchema}
        label="Registration Form Fields"
        description="The fields students see when registering for this segment. The 7 built-in fields (name, phone, email, college, roll, HSC session, division) are pre-loaded but you can edit, reorder, or delete any of them."
      />

      <hr style={{ borderColor: 'var(--border)' }} />

      {/* Team registration */}
      <div>
        <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: 'var(--accent2)' }}>
          <input type="checkbox" checked={requiresTeam} onChange={e => setRequiresTeam(e.target.checked)} />
          <Users size={14} /> Team registration
        </label>
        {requiresTeam && (
          <div className="space-y-3 pl-6">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Min team size</label>
                <input type="number" value={teamMin} onChange={e => setTeamMin(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Max team size</label>
                <input type="number" value={teamMax} onChange={e => setTeamMax(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
            </div>
            <LegacyFieldListEditor fields={teamFields} onChange={setTeamFields} title="INFO COLLECTED PER TEAM MEMBER" />
          </div>
        )}
      </div>

      <hr style={{ borderColor: 'var(--border)' }} />

      {/* Payment */}
      <div>
        <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: 'var(--warning)' }}>
          <input type="checkbox" checked={requiresPayment} onChange={e => setRequiresPayment(e.target.checked)} />
          <CreditCard size={14} /> Requires payment
        </label>
        {requiresPayment && (
          <div className="grid grid-cols-2 gap-3 pl-6">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Amount (BDT)</label>
              <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Payment label</label>
              <input placeholder="e.g. Registration fee" value={paymentLabel} onChange={e => setPaymentLabel(e.target.value)} className={inputCls} style={inputStyle} />
            </div>
          </div>
        )}
      </div>

      <hr style={{ borderColor: 'var(--border)' }} />

      {/* Online submission (links to Olympiad) */}
      <div>
        <label className="flex items-center gap-2 text-sm font-semibold mb-1" style={{ color: 'var(--blue)' }}>
          <input type="checkbox" checked={isOnlineSubmission} onChange={e => setIsOnlineSubmission(e.target.checked)} />
          <Link2 size={14} /> Online-submission / exam round
        </label>
        <p className="text-xs pl-6 mb-2" style={{ color: 'var(--border-soft)' }}>
          {segment.linked_olympiad_id
            ? 'Already linked to an Olympiad — registrants access exam/submission from their dashboard.'
            : 'Saving with this on will auto-create a linked Olympiad.'}
        </p>
        {segment.linked_olympiad_id && (
          <div className="pl-6 space-y-2">
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Online Type</label>
              <select value={onlineType} onChange={e => setOnlineType(e.target.value)}
                className="px-2 py-2 rounded-lg text-sm border outline-none w-full max-w-xs" style={inputStyle}>
                <option value="pure_submission">Pure Submission</option>
                <option value="full_quiz">Full Quiz System</option>
                <option value="mixed">Mixed</option>
                <option value="science_relay">Science Relay</option>
              </select>
            </div>
            <Link href={`/admin/olympiads?edit=${segment.linked_olympiad_id}&back_session=${segment.activity_session_id}`}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold"
              style={{ background: 'rgba(var(--blue-rgb), 0.12)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
              <Zap size={13} /> Configure questions, scheduling & relay →
            </Link>
          </div>
        )}
      </div>

      {isOnlineSubmission && (
        <>
          <hr style={{ borderColor: 'var(--border)' }} />
          <div>
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--blue)' }}>
              <Upload size={13} className="inline mr-1.5 -mt-0.5" /> SUBMISSION FIELDS
            </p>
            <p className="text-xs mb-3" style={{ color: 'var(--border-soft)' }}>
              Leave empty for live MCQ exams. Add fields for project uploads, answer sheets, videos.
            </p>
            {submissionConfig.map((field, idx) => (
              <div key={field.id} className="p-3 rounded-lg mb-2 space-y-2" style={{ background: 'var(--surface)', border: '1px solid var(--border)' }}>
                <div className="flex gap-2 items-start">
                  <div className="flex-1 space-y-2">
                    <input placeholder="Field title" value={field.title}
                      onChange={e => setSubmissionConfig(prev => prev.map((f, i) => i === idx ? { ...f, title: e.target.value } : f))}
                      className={inputCls} style={inputStyle} />
                    <input placeholder="Description" value={field.description || ''}
                      onChange={e => setSubmissionConfig(prev => prev.map((f, i) => i === idx ? { ...f, description: e.target.value } : f))}
                      className={inputCls} style={inputStyle} />
                  </div>
                  <button onClick={() => setSubmissionConfig(prev => prev.filter((_, i) => i !== idx))} style={{ color: 'var(--danger-soft)', marginTop: '4px' }}>
                    <Trash2 size={14} />
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Field type</label>
                    <select value={field.field_type}
                      onChange={e => setSubmissionConfig(prev => prev.map((f, i) => i === idx ? { ...f, field_type: e.target.value as any } : f))}
                      className={inputCls} style={inputStyle}>
                      <option value="text">Short text</option>
                      <option value="textarea">Long text</option>
                      <option value="file">File upload</option>
                    </select>
                  </div>
                  {field.field_type === 'file' && (
                    <>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Allowed file types (comma-separated)</label>
                        <input placeholder="pdf,jpg,png,mp4" value={(field.file_types || []).join(',')}
                          onChange={e => setSubmissionConfig(prev => prev.map((f, i) => i === idx ? { ...f, file_types: e.target.value.split(',').map(s => s.trim()).filter(Boolean) } : f))}
                          className={inputCls} style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Max file size (MB)</label>
                        <input type="number" placeholder="5" value={field.max_file_size_mb || ''}
                          onChange={e => setSubmissionConfig(prev => prev.map((f, i) => i === idx ? { ...f, max_file_size_mb: Number(e.target.value) } : f))}
                          className={inputCls} style={inputStyle} />
                      </div>
                      <div>
                        <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Max files</label>
                        <input type="number" placeholder="1" value={field.max_files || ''}
                          onChange={e => setSubmissionConfig(prev => prev.map((f, i) => i === idx ? { ...f, max_files: Number(e.target.value) } : f))}
                          className={inputCls} style={inputStyle} />
                      </div>
                    </>
                  )}
                </div>
                <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
                  <input type="checkbox" checked={field.required}
                    onChange={e => setSubmissionConfig(prev => prev.map((f, i) => i === idx ? { ...f, required: e.target.checked } : f))} />
                  Required
                </label>
              </div>
            ))}
            <button onClick={() => setSubmissionConfig(prev => [...prev, BLANK_SUBMISSION_FIELD()])}
              className="text-xs px-3 py-1.5 rounded flex items-center gap-1 mt-1"
              style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>
              <Plus size={11} /> Add submission field
            </button>
            {submissionConfig.length > 0 && (
              <div className="mt-3">
                <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Who can submit?</label>
                <select value={submissionWho} onChange={e => setSubmissionWho(e.target.value as any)}
                  className={inputCls} style={inputStyle}>
                  <option value="leader">Team leader only</option>
                  <option value="any_member">Any team member</option>
                </select>
              </div>
            )}
          </div>
        </>
      )}

      <hr style={{ borderColor: 'var(--border)' }} />

      <div>
        <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: 'var(--accent2)' }}>
          <input type="checkbox" checked={projectNameEnabled} onChange={e => setProjectNameEnabled(e.target.checked)} />
          <Microscope size={14} /> Collect a project name
        </label>
        {projectNameEnabled && (
          <div className="pl-6">
            <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Field label</label>
            <input value={projectNameLabel} onChange={e => setProjectNameLabel(e.target.value)}
              placeholder="Project Name" className={inputCls} style={inputStyle} />
          </div>
        )}
      </div>

      <hr style={{ borderColor: 'var(--border)' }} />

      <div>
        <p className="text-xs font-bold mb-2" style={{ color: 'var(--cat-teal)' }}>
          <Calendar size={13} className="inline mr-1.5 -mt-0.5" /> SCHEDULE
        </p>
        <div className="grid grid-cols-3 gap-3">
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Date</label>
            <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Time</label>
            <input placeholder="10:00 AM - 12:00 PM" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
          <div>
            <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>Room / Venue</label>
            <input value={scheduleRoom} onChange={e => setScheduleRoom(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
        </div>
      </div>

      <hr style={{ borderColor: 'var(--border)' }} />

      <div>
        <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>
          Self-edit window (hours after registering — blank for no time limit)
        </label>
        <input type="number" placeholder="e.g. 48" value={editWindowHours} onChange={e => setEditWindowHours(e.target.value)} className={inputCls} style={inputStyle} />
      </div>

      <button onClick={save} disabled={saving}
        className="px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
        style={{ background: 'var(--blue)', color: '#000' }}>
        {saving ? 'Saving...' : 'Save Segment'}
      </button>
    </div>
  )
}

// Module-level shared field-list editor for the legacy per-category custom_fields
// (and per-segment team_member_fields) shape. Used by both CategoryEditor and
// SegmentEditor. Kept here rather than inside CategoryEditor so the segment
// editor can reuse it without hoisting.
const LEGACY_FIELD_TYPE_OPTIONS: { value: FieldType; label: string }[] = [
  { value: 'text', label: 'Short text' },
  { value: 'textarea', label: 'Long text' },
  { value: 'number', label: 'Number' },
  { value: 'dropdown', label: 'Dropdown' },
  { value: 'multiple_choice', label: 'Multiple choice' },
  { value: 'checkboxes', label: 'Checkboxes' },
  { value: 'date', label: 'Date' },
  { value: 'time', label: 'Time' },
  { value: 'photo', label: 'Photo upload' },
  { value: 'file', label: 'File upload' },
]

function LegacyFieldListEditor({ fields, onChange, title }: { fields: CustomField[]; onChange: (next: CustomField[]) => void; title: string }) {
  const patchField = (key: string, p: Partial<CustomField>) => onChange(fields.map(f => f.key === key ? { ...f, ...p } : f))
  const removeField = (key: string) => onChange(fields.filter(f => f.key !== key))
  const addField = () => onChange([...fields, BLANK_FIELD()])
  const addOption = (key: string) => patchField(key, { options: [...(fields.find(f => f.key === key)?.options || []), ''] })
  const updateOption = (key: string, idx: number, text: string) => {
    const f = fields.find(f => f.key === key); if (!f) return
    const opts = (f.options || []).map((o, i) => i === idx ? text : o)
    patchField(key, { options: opts })
  }
  const removeOption = (key: string, idx: number) => {
    const f = fields.find(f => f.key === key); if (!f) return
    const opts = (f.options || []).filter((_, i) => i !== idx)
    patchField(key, { options: opts })
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-bold" style={{ color: 'var(--muted)' }}>{title}</p>
      {fields.map(f => (
        <div key={f.key} className="p-3 rounded-lg space-y-2" style={{ background: 'var(--surface)' }}>
          <div className="flex gap-2">
            <input placeholder="Field title (e.g. Submit your NDC ID card photo)" value={f.label}
              onChange={e => patchField(f.key, { label: e.target.value })}
              className={inputCls} style={inputStyle} />
            <select value={f.type} onChange={e => patchField(f.key, { type: e.target.value as FieldType })}
              className="px-2 py-2 rounded-lg text-sm border outline-none" style={inputStyle}>
              {LEGACY_FIELD_TYPE_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={() => removeField(f.key)} style={{ color: 'var(--danger-soft)' }}><Trash2 size={14} /></button>
          </div>
          <input placeholder="Description shown under the field title (optional)" value={f.description || ''}
            onChange={e => patchField(f.key, { description: e.target.value })}
            className={inputCls} style={inputStyle} />
          {(f.type === 'dropdown' || f.type === 'multiple_choice' || f.type === 'checkboxes') && (
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>
                {f.type === 'dropdown' ? 'Options shown in the dropdown' : 'Choices registrants can pick from'}
              </label>
              <div className="space-y-1.5">
                {(f.options || []).map((opt, oi) => (
                  <div key={oi} className="flex items-center gap-2">
                    <MathInputField value={opt} onChange={v => updateOption(f.key, oi, v)}
                      placeholder="Option text" className={inputCls} style={{ ...inputStyle, padding: '6px 10px' }} />
                    <button onClick={() => removeOption(f.key, oi)} style={{ color: 'var(--danger-soft)' }}><X size={14} /></button>
                  </div>
                ))}
              </div>
              <button onClick={() => addOption(f.key)} className="text-xs flex items-center gap-1 mt-1.5" style={{ color: 'var(--blue)' }}>
                <Plus size={11} /> Add option
              </button>
              {f.type === 'dropdown' && (
                <label className="flex items-center gap-2 text-xs mt-1.5" style={{ color: 'var(--muted)' }}>
                  <input type="checkbox" checked={!!f.allow_other} onChange={e => patchField(f.key, { allow_other: e.target.checked })} />
                  Let registrants type their own option (adds an &quot;Other&quot; choice)
                </label>
              )}
            </div>
          )}
          {(f.type === 'photo' || f.type === 'file') && (
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2">
                <label className="text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>Max file size (MB)</label>
                <input type="number" min={1} placeholder="5" value={f.max_file_size_mb ?? ''}
                  onChange={e => patchField(f.key, { max_file_size_mb: e.target.value ? Number(e.target.value) : undefined })}
                  className={inputCls} style={{ ...inputStyle, maxWidth: 100 }} />
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>Max files</label>
                <input type="number" min={1} placeholder="1" value={f.max_files ?? ''}
                  onChange={e => patchField(f.key, { max_files: e.target.value ? Number(e.target.value) : undefined })}
                  className={inputCls} style={{ ...inputStyle, maxWidth: 100 }} />
              </div>
            </div>
          )}
          <div className="flex items-center gap-4 flex-wrap">
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
              <input type="checkbox" checked={f.required} onChange={e => patchField(f.key, { required: e.target.checked })} />
              Required
            </label>
            <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }} title="If two registrants submit the same value for this field, the second submission is rejected as a duplicate.">
              <input type="checkbox" checked={!!f.unique_field} onChange={e => patchField(f.key, { unique_field: e.target.checked })} />
              Unique field (no duplicates across this event)
            </label>
          </div>
        </div>
      ))}
      <button onClick={addField} className="text-xs px-3 py-1.5 rounded flex items-center gap-1"
        style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>
        <Plus size={11} /> Add field
      </button>
    </div>
  )
}
