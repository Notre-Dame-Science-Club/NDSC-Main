'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, ChevronRight, ChevronDown, ArrowLeft, Users, CreditCard, Link2, Calendar, X, Zap, Upload, Microscope, FileText, Images, Youtube, ImageIcon, Lock, Check, Sparkles, Save, Download, Workflow } from 'lucide-react'
import MathInputField from '@/components/olympiad/MathInputField'
import { FormBlock, normalizeBlocks, builtinFieldDefs } from '@/lib/formBlocks'
import FieldsEditor from '@/components/admin/FieldsEditor'
import ContactPersonsEditor from '@/components/admin/ContactPersonsEditor'
import { FormGraphBuilderForOwner } from '@/components/admin/FormGraphBuilder'
import { THEME_PRESETS, FONT_OPTIONS, COVER_RATIO_OPTIONS } from '@/lib/appearancePresets'
import { resolveAccent, resolveFont } from '@/lib/appearance'

const uid = () => Math.random().toString(36).slice(2, 9)

// Removed unused v1 types (Category, CustomField, SubmissionField, etc.)
// The v2 system uses FormBlock from lib/formBlocks.ts instead

const s = { background: 'var(--bg2)', borderColor: 'var(--border)' }
const h = { fontFamily: 'inherit', color: 'var(--blue)' }
const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'
const inputStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }

export default function ActivityRegistrationBuilder() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [session, setSession] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [tab, setTab] = useState<'appearance' | 'files' | 'flow' | 'registrants' | 'updates'>('appearance')

  const load = async () => {
    try {
      const res = await fetch('/api/admin/activity-sessions')
      const allSessions = await res.json().catch(() => [])
      const found = Array.isArray(allSessions) ? allSessions.find((x: any) => x.id === sessionId) : null
      setSession(found || null)
    } catch {
      setError('Network error while loading.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [sessionId])

  // Registration is the main workflow once it's on; otherwise start on Appearance
  useEffect(() => {
    if (session) setTab(session.registration_enabled ? 'flow' : 'appearance')
  }, [session?.id, session?.registration_enabled])

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
        <button onClick={() => setTab('flow')} className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={tab === 'flow' ? { background: 'rgba(var(--blue-rgb), 0.15)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.4)' } : { background: 'var(--surface-deep)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
          <span className="inline-flex items-center gap-1.5"><Workflow size={13} /> Form Builder</span>
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

      {tab === 'flow' ? (
        <div>
          <div className="mb-5 p-4 rounded-xl text-sm" style={{ background: 'rgba(var(--blue-rgb), 0.05)', border: '1px solid rgba(var(--blue-rgb), 0.2)', color: 'var(--muted)' }}>
            This is the public registration form for this event — a tree of forms with
            branching, presets, and multi-step flows. It's what visitors see when they hit
            "Register Now" on the event page. Add the first form below if you haven't yet.
          </div>
          <FormGraphBuilderForOwner ownerKind="activity" ownerId={sessionId} />
        </div>
      ) : tab === 'registrants' && session?.registration_enabled ? (
        <RegistrantsPanel sessionId={sessionId} />
      ) : tab === 'appearance' ? (
        <AppearancePanel sessionId={sessionId} session={session} onSaved={setSession} />
      ) : tab === 'files' ? (
        <FilesPanel sessionId={sessionId} session={session} onSaved={setSession} />
      ) : tab === 'updates' ? (
        <UpdatesPanel sessionId={sessionId} />
      ) : (
        <div className="rounded-xl p-6 text-sm text-center" style={{ background: 'var(--surface-deep)', border: '1px solid var(--border)', color: 'var(--border-soft)' }}>
          Select a tab above to get started.
        </div>
      )}
    </div>
  )
}

// Remove all v1-related components (Category, SegmentsSection, etc.)

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
    // Segment chip filter — restrict to a single top-level bucket.
    // `segment_id` is precomputed server-side as the top-level ancestor
    // of wherever the registration actually landed, whether that's a v1
    // category several levels deep or a v2 leaf under a subsegment several
    // levels deep — so this one comparison correctly covers descendants
    // for both systems without needing per-row tree walking here.
    if (segmentFilter !== 'all' && r.segment_id !== segmentFilter) return false
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return r.full_name?.toLowerCase().includes(q) || r.phone?.includes(q) || r.email?.toLowerCase().includes(q) || r.breadcrumb.join(' ').toLowerCase().includes(q) || (r.team_name || '').toLowerCase().includes(q)
  })

  const exportCsv = () => {
    const customKeys = [...new Set(filtered.flatMap(r => Object.keys(r.custom_answers || {})))]
    // Build the union of per-member custom answer keys so the team columns
    // can show every possible member answer, even if a category was edited
    // mid-stream and not every team has values for every key.
    const teamMemberCustomKeys = [...new Set(
      filtered.flatMap(r => (r.team_members || []).flatMap((m: any) => Object.keys(m?.custom_answers || {})))
    )]
    const memberHeaders = ['Member Name', 'Member Email', 'Member Phone', 'Member College Roll', ...teamMemberCustomKeys.map(k => `Member: ${k}`)]
    const headers = ['Name', 'Team Name', 'Phone', 'Email', 'College', 'Roll', 'HSC Session', 'Project Name', 'Category', 'Team Size', 'Payment Status', 'Registered At', ...customKeys, 'Team Members', ...memberHeaders]
    const escape = (v: any) => `"${String(v ?? '').replace(/"/g, '""')}"`
    const rows = filtered.flatMap(r => {
      const base = [
        r.full_name, r.team_name || '', r.phone, r.email, r.college, r.college_roll, r.hsc_session, r.project_name,
        r.breadcrumb.join(' > '), r.team_size, r.payment_status, new Date(r.created_at).toISOString(),
        ...customKeys.map(k => Array.isArray(r.custom_answers?.[k]) ? r.custom_answers[k].join('; ') : (r.custom_answers?.[k] ?? '')),
        (r.team_members || []).map((m: any) => `${m.full_name} <${m.email || m.college_roll}>`).join('; '),
      ]
      // One row per team member so the per-member phone + custom_answers
      // land in their own columns. A registration with 0 team members
      // still gets a base row so the row count matches `filtered.length`.
      const members = (r.team_members || [])
      if (!members.length) return [base]
      return members.map((m: any) => [
        ...base,
        m.full_name, m.email, m.phone, m.college_roll,
        ...teamMemberCustomKeys.map(k => Array.isArray(m?.custom_answers?.[k]) ? m.custom_answers[k].join('; ') : (m?.custom_answers?.[k] ?? '')),
      ])
    })
    const csv = [headers.map(escape).join(','), ...rows.map(row => row.map(escape).join(','))].join('\n')
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
          <a href={`/api/admin/activity-sessions/${sessionId}/registrations.csv`}
            className="text-xs px-3 py-1.5 rounded-lg flex-shrink-0 flex items-center gap-1.5"
            style={{ background: 'rgba(var(--cat-teal-rgb), 0.1)', color: 'var(--cat-teal)', border: '1px solid rgba(var(--cat-teal-rgb), 0.25)' }}
            title="Server-built CSV with the full registration set, including the v2 form-graph path and team columns.">
            <Download size={12} /> All rows CSV
          </a>
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
            const count = registrations.filter(r => r.segment_id === seg.id).length
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
                {/* Task 1: surface the team_name as a separate chip next to
                    the leader's name when this is a team event. Falls
                    back gracefully (no chip) for solo / non-team events
                    where team_name is null. */}
                {r.team_name && (
                  <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(var(--accent2-rgb), 0.18)', color: 'var(--accent2)' }}>
                    “{r.team_name}”
                  </span>
                )}
                {r.team_size > 1 && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(var(--accent2-rgb), 0.13)', color: 'var(--accent2)' }}>Team of {r.team_size}</span>}
                {r.is_online_category && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(var(--blue-rgb), 0.13)', color: 'var(--blue)' }}>Online</span>}
                {/* v2 rows that haven't reached a terminal node yet — started
                    a form-graph path but didn't finish it. v1 rows are
                    always complete the moment they exist, so this only
                    ever shows for the new form-graph system. */}
                {r.is_terminal === false && <span className="text-xs px-1.5 py-0.5 rounded" style={{ background: 'rgba(var(--warning-rgb), 0.13)', color: 'var(--warning)' }}>Incomplete</span>}
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
        // Render custom_answers in form_field_schema order, so the admin
        // sees the answers laid out exactly like the registrant did.
        // Falls back to insertion order if no schema is available.
        //
        // Bug fix: `viewingSegment` only knows the top-level segment
        // node's own fields — for v2 (form-graph) registrations that
        // dropped any field asked on the root/common-details node or on
        // an intermediate node below the segment. `viewing.field_schema`
        // (added server-side in activity-registrations-list) is built by
        // walking this specific registration's actual root→leaf path, so
        // it covers every field regardless of which step collected it.
        const viewingSegment = segments.find(s => s.id === viewing.segment_id)
        const fieldSchema: any[] = viewing.field_schema?.length ? viewing.field_schema : (viewingSegment?.form_field_schema || [])
        const orderedKeys: string[] = []
        if (fieldSchema.length) {
          for (const f of fieldSchema) {
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
              {/* Task 1: team_name is the leader-given team identity.
                  Render only when present — solo / non-team events leave
                  it null, and we don't want a "Team name: " line for
                  those. */}
              {viewing.team_name && <p>Team: <span style={{ color: 'var(--accent2)' }}>“{viewing.team_name}”</span></p>}
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
                  const field = fieldSchema.find((f: any) => (f.key || f.id) === k)
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
            {(viewing.team_members || []).length > 0 && (() => {
              // Task 8: per-member rich display. For v1 categories we have
              // team_member_fields (the schema) so we render custom_answers
              // in the order the admin configured. For v2 form-graph
              // registrations viewingSegment is undefined, so we fall back
              // to insertion order — still readable, just not in field
              // order. password_hash is never rendered, even when present
              // (defense-in-depth: the API doesn't return it but we strip
              // it again here in case someone adds a future path that
              // leaks it).
              const teamFieldSchema: any[] = viewing.team_field_schema?.length ? viewing.team_field_schema : (viewingSegment?.team_member_fields || [])
              const safeMembers = (viewing.team_members || []).map((m: any) => {
                if (!m || typeof m !== 'object') return m
                const { password_hash, passwordHash, ...rest } = m
                return rest
              })
              return (
                <div className="pt-2 border-t" style={{ borderColor: 'var(--border)' }}>
                  <p className="text-xs font-bold mb-1" style={{ color: 'var(--accent2)' }}>TEAM MEMBERS</p>
                  {safeMembers.map((m: any, i: number) => {
                    const orderedKeys: string[] = []
                    if (teamFieldSchema.length && m.custom_answers) {
                      for (const f of teamFieldSchema) {
                        const k = f.key || f.id
                        if (k && k in m.custom_answers) orderedKeys.push(k)
                      }
                      for (const k of Object.keys(m.custom_answers)) {
                        if (!orderedKeys.includes(k)) orderedKeys.push(k)
                      }
                    } else if (m.custom_answers) {
                      orderedKeys.push(...Object.keys(m.custom_answers))
                    }
                    return (
                      <div key={i} className="mb-2 pb-2" style={{ borderBottom: i < safeMembers.length - 1 ? '1px solid var(--border)' : 'none' }}>
                        <p className="text-xs font-semibold" style={{ color: 'var(--white-soft)' }}>
                          {i + 1}. {m.full_name || '(no name)'}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--muted)' }}>
                          {m.email || m.college_roll}
                          {m.phone ? ` · ${m.phone}` : ''}
                          {m.college_roll ? ` · Roll ${m.college_roll}` : ''}
                        </p>
                        {orderedKeys.length > 0 && (
                          <div className="mt-1 pl-2 space-y-0.5">
                            {orderedKeys.map((k: string) => {
                              const f = teamFieldSchema.find((sf: any) => (sf.key || sf.id) === k)
                              const label = f?.label || k
                              const v = m.custom_answers?.[k]
                              return (
                                <p key={k} className="text-xs" style={{ color: 'var(--border-soft)' }}>
                                  {label}: {Array.isArray(v) ? v.join(', ') : (v === null || v === undefined || v === '' ? '—' : String(v))}
                                </p>
                              )
                            })}
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              )
            })()}
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
          <h3 className="text-lg font-black mb-1" style={{ fontFamily: previewFont !== 'inherit' ? previewFont : 'inherit', color: 'var(--white)' }}>{previewTitle || '(no title)'}</h3>
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
              value={appearance?.form_bg_theme?.startsWith('#') ? appearance.form_bg_theme : '#00d4ff'}
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
