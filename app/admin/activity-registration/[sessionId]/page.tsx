'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, ChevronRight, ChevronDown, ArrowLeft, Users, CreditCard, Link2, Calendar, X } from 'lucide-react'

const uid = () => Math.random().toString(36).slice(2, 9)

type FieldType = 'text' | 'textarea' | 'number' | 'photo' | 'file' | 'dropdown' | 'date' | 'time'
type CustomField = { key: string; label: string; description?: string; type: FieldType; required: boolean; options?: string[]; max_file_size_mb?: number }
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
  requires_team: boolean
  team_size_min: number | null
  team_size_max: number | null
  team_member_fields: CustomField[]
  requires_payment: boolean
  payment_amount: number | null
  payment_label: string | null
  is_online_submission: boolean
  linked_olympiad_id: string | null
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
  const [tab, setTab] = useState<'builder' | 'registrants'>('builder')

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

  const toggleExpand = (id: string) => {
    setExpandedIds(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const isLeaf = (catId: string) => !categories.some(c => c.parent_id === catId)

  const addCategory = async (parentId: string | null) => {
    setError('')
    const name = prompt(parentId ? 'Name for this sub-category:' : 'Name for this top-level category:')
    if (!name?.trim()) return
    try {
      const res = await fetch('/api/admin/activity-reg-categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activity_session_id: sessionId, parent_id: parentId, name: name.trim() }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Could not add category.'); return }
      setCategories(prev => [...prev, data.category])
      if (parentId) setExpandedIds(prev => new Set(prev).add(parentId))
    } catch {
      setError('Network error while adding.')
    }
  }

  const updateCategory = async (id: string, patch: Partial<Category>) => {
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
          <h1 className="text-2xl font-bold" style={h}>Registration Builder</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>{session?.title || 'Activity Session'}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger-soft)', border: '1px solid rgba(var(--danger-rgb), 0.3)' }}>
          {error}
        </div>
      )}

      <div className="flex gap-2 mb-4">
        <button onClick={() => setTab('builder')} className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={tab === 'builder' ? { background: 'rgba(var(--blue-rgb), 0.15)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.4)' } : { background: 'var(--surface-deep)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
          Builder
        </button>
        <button onClick={() => setTab('registrants')} className="px-4 py-2 rounded-lg text-sm font-semibold"
          style={tab === 'registrants' ? { background: 'rgba(var(--blue-rgb), 0.15)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.4)' } : { background: 'var(--surface-deep)', color: 'var(--muted)', border: '1px solid var(--border)' }}>
          Registrants
        </button>
      </div>

      {tab === 'registrants' ? (
        <RegistrantsPanel sessionId={sessionId} />
      ) : (
      <>
      <div className="mb-4 p-4 rounded-xl text-sm" style={{ background: 'rgba(var(--blue-rgb), 0.05)', border: '1px solid rgba(var(--blue-rgb), 0.2)', color: 'var(--muted)' }}>
        Build as many layers as this event needs (e.g. Offline/Online → Class → Subject).
        Registration only happens at the bottom-most category in each branch — that's where you
        configure fields, team settings, payment, and online-submission linking.
      </div>

      {renderTree(null, 0)}

      <button onClick={() => addCategory(null)}
        className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
        style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
        <Plus size={15} /> Add Top-Level Category
      </button>

      {categories.length === 0 && (
        <p className="mt-4 text-sm" style={{ color: 'var(--border-soft)' }}>
          No categories yet. Start with something like "Offline" / "Online", or just one category
          if this event doesn't need sub-segments — registration works even with a single
          top-level leaf category.
        </p>
      )}
      </>
      )}
    </div>
  )
}

function RegistrantsPanel({ sessionId }: { sessionId: string }) {
  const [loading, setLoading] = useState(true)
  const [registrations, setRegistrations] = useState<any[]>([])
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [viewing, setViewing] = useState<any | null>(null)

  useEffect(() => {
    fetch(`/api/admin/activity-registrations-list?sessionId=${sessionId}`)
      .then(r => r.json())
      .then(d => { if (d.error) setError(d.error); else setRegistrations(d.registrations || []) })
      .catch(() => setError('Could not load registrants.'))
      .finally(() => setLoading(false))
  }, [sessionId])

  const filtered = registrations.filter(r => {
    if (!search.trim()) return true
    const q = search.toLowerCase()
    return r.full_name?.toLowerCase().includes(q) || r.phone?.includes(q) || r.email?.toLowerCase().includes(q) || r.breadcrumb.join(' ').toLowerCase().includes(q)
  })

  if (loading) return <p className="text-sm" style={{ color: 'var(--border-soft)' }}>Loading registrants…</p>
  if (error) return <p className="text-sm" style={{ color: 'var(--danger-soft)' }}>{error}</p>

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <input placeholder="Search by name, phone, email, or category…" value={search} onChange={e => setSearch(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none border w-full max-w-sm"
          style={{ background: 'var(--surface-alt)', borderColor: 'var(--border)', color: 'var(--white-soft)' }} />
        <span className="text-xs ml-3 whitespace-nowrap" style={{ color: 'var(--border-soft)' }}>{filtered.length} of {registrations.length} registrant(s)</span>
      </div>

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

      {viewing && (
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
              <p>Registered: {new Date(viewing.created_at).toLocaleString()}</p>
              {viewing.payment_status && <p>Payment: {viewing.payment_status}</p>}
            </div>
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
      )}
    </div>
  )
}

function CategoryEditor({ category, isLeaf, onSave }: { category: Category; isLeaf: boolean; onSave: (patch: Partial<Category>) => void }) {
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
    { value: 'date', label: 'Date' },
    { value: 'time', label: 'Time' },
    { value: 'photo', label: 'Photo upload' },
    { value: 'file', label: 'File upload' },
  ]

  const addField = (setter: typeof setCustomFields) => setter(prev => [...prev, BLANK_FIELD()])
  const removeField = (setter: typeof setCustomFields, key: string) => setter(prev => prev.filter(f => f.key !== key))
  const patchField = (setter: typeof setCustomFields, key: string, patch: Partial<CustomField>) =>
    setter(prev => prev.map(f => f.key === key ? { ...f, ...patch } : f))

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

  const FieldListEditor = ({ fields, setter, title }: { fields: CustomField[]; setter: typeof setCustomFields; title: string }) => (
    <div className="space-y-2">
      <p className="text-xs font-bold" style={{ color: 'var(--muted)' }}>{title}</p>
      {fields.map(f => (
        <div key={f.key} className="p-3 rounded-lg space-y-2" style={{ background: 'var(--surface)' }}>
          <div className="flex gap-2">
            <input placeholder="Field title (e.g. Submit your NDC ID card photo)" value={f.label}
              onChange={e => patchField(setter, f.key, { label: e.target.value })}
              className={inputCls} style={inputStyle} />
            <select value={f.type} onChange={e => patchField(setter, f.key, { type: e.target.value as FieldType })}
              className="px-2 py-2 rounded-lg text-sm border outline-none" style={inputStyle}>
              {fieldTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={() => removeField(setter, f.key)} style={{ color: 'var(--danger-soft)' }}><Trash2 size={14} /></button>
          </div>
          <input placeholder="Description shown under the field title (optional)" value={f.description || ''}
            onChange={e => patchField(setter, f.key, { description: e.target.value })}
            className={inputCls} style={inputStyle} />
          {f.type === 'dropdown' && (
            <div>
              <input placeholder="Options, comma-separated (e.g. Physics, Chemistry, Biology)"
                value={(f.options || []).join(', ')}
                onChange={e => patchField(setter, f.key, { options: e.target.value.split(',').map(o => o.trim()).filter(Boolean) })}
                className={inputCls} style={inputStyle} />
              <p className="text-xs mt-1" style={{ color: 'var(--border-soft)' }}>This is what shows up in the dropdown on the registration form.</p>
            </div>
          )}
          {(f.type === 'photo' || f.type === 'file') && (
            <div className="flex items-center gap-2">
              <label className="text-xs whitespace-nowrap" style={{ color: 'var(--muted)' }}>Max file size (MB)</label>
              <input type="number" min={1} placeholder="5" value={f.max_file_size_mb ?? ''}
                onChange={e => patchField(setter, f.key, { max_file_size_mb: e.target.value ? Number(e.target.value) : undefined })}
                className={inputCls} style={{ ...inputStyle, maxWidth: 100 }} />
            </div>
          )}
          <label className="flex items-center gap-2 text-xs" style={{ color: 'var(--muted)' }}>
            <input type="checkbox" checked={f.required} onChange={e => patchField(setter, f.key, { required: e.target.checked })} />
            Required
          </label>
        </div>
      ))}
      <button onClick={() => addField(setter)} className="text-xs px-3 py-1.5 rounded flex items-center gap-1"
        style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>
        <Plus size={11} /> Add field
      </button>
    </div>
  )

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
          <FieldListEditor fields={customFields} setter={setCustomFields} title="EXTRA REGISTRATION FIELDS (besides name, phone, email, college, roll, HSC session)" />

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
                <FieldListEditor fields={teamFields} setter={setTeamFields} title="INFO COLLECTED PER TEAM MEMBER" />
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
              <div className="pl-6">
                <Link href={`/admin/olympiads?edit=${category.linked_olympiad_id}&back_session=${category.activity_session_id}`}
                  className="inline-flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-bold"
                  style={{ background: 'rgba(var(--blue-rgb), 0.12)', color: 'var(--blue)', border: '1px solid rgba(var(--blue-rgb), 0.3)' }}>
                  ⚡ Configure Olympiad (exam type, questions, scheduling, relay) →
                </Link>
                <p className="text-xs mt-1" style={{ color: 'var(--border-soft)' }}>Set up exam type, questions, relay mode, subject assignment, and scheduling there.</p>
              </div>
            )}
          </div>

          {isOnlineSubmission && (
            <>
              <hr style={{ borderColor: 'var(--border)' }} />
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: 'var(--blue)' }}>
                  📤 SUBMISSION FIELDS (what the student uploads / fills when they hit &quot;Submit Now&quot;)
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
              🔬 Collect a project name during registration
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
