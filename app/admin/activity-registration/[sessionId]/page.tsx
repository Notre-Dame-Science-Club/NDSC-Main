'use client'
import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { Plus, Trash2, ChevronRight, ChevronDown, ArrowLeft, Users, CreditCard, Link2, Calendar, X } from 'lucide-react'

const uid = () => Math.random().toString(36).slice(2, 9)

type FieldType = 'text' | 'textarea' | 'number' | 'photo'
type CustomField = { key: string; label: string; description?: string; type: FieldType; required: boolean }

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
}

const s = { background: '#050d1a', borderColor: '#0f2a4a' }
const h = { fontFamily: "'Orbitron', sans-serif", color: '#00d4ff' }
const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'
const inputStyle = { background: '#0a1628', borderColor: '#0f2a4a', color: '#e8f4ff' }

const BLANK_FIELD = (): CustomField => ({ key: uid(), label: '', description: '', type: 'text', required: false })

export default function ActivityRegistrationBuilder() {
  const params = useParams()
  const sessionId = params.sessionId as string

  const [session, setSession] = useState<any>(null)
  const [categories, setCategories] = useState<Category[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set())

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
                <button onClick={() => toggleExpand(cat.id)} style={{ color: '#6a8faf' }}>
                  {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                </button>
                <span className="text-sm font-semibold flex-1" style={{ color: '#e8f4ff' }}>{cat.name}</span>
                {leaf && (
                  <div className="flex items-center gap-1.5">
                    {cat.requires_team && <Users size={13} style={{ color: '#a78bfa' }} title="Team registration" />}
                    {cat.requires_payment && <CreditCard size={13} style={{ color: '#ffb347' }} title="Requires payment" />}
                    {cat.is_online_submission && <Link2 size={13} style={{ color: '#00d4ff' }} title="Linked to Olympiad" />}
                    {cat.schedule_date && <Calendar size={13} style={{ color: '#34d399' }} title="Has schedule" />}
                    <span className="text-xs px-2 py-0.5 rounded-full" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>Leaf — registration form</span>
                  </div>
                )}
                <button onClick={() => setEditingId(editingId === cat.id ? null : cat.id)}
                  className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
                  {editingId === cat.id ? 'Close' : 'Edit'}
                </button>
                <button onClick={() => addCategory(cat.id)}
                  className="text-xs px-2 py-1 rounded flex items-center gap-1" style={{ background: 'rgba(52,211,153,0.1)', color: '#34d399' }}>
                  <Plus size={11} /> Sub
                </button>
                <button onClick={() => deleteCategory(cat.id)} style={{ color: '#ff7070' }}>
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

  if (loading) return <p style={{ color: '#6a8faf' }}>Loading...</p>

  return (
    <div>
      <div className="flex items-center gap-3 mb-6">
        <Link href="/admin/activities" className="p-2 rounded-lg" style={{ background: '#050d1a', color: '#6a8faf' }}>
          <ArrowLeft size={16} />
        </Link>
        <div>
          <h1 className="text-2xl font-bold" style={h}>Registration Builder</h1>
          <p className="text-sm" style={{ color: '#6a8faf' }}>{session?.title || 'Activity Session'}</p>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded-lg text-sm" style={{ background: 'rgba(255,80,80,0.1)', color: '#ff7070', border: '1px solid rgba(255,80,80,0.3)' }}>
          {error}
        </div>
      )}

      <div className="mb-4 p-4 rounded-xl text-sm" style={{ background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)', color: '#6a8faf' }}>
        Build as many layers as this event needs (e.g. Offline/Online → Class → Subject).
        Registration only happens at the bottom-most category in each branch — that's where you
        configure fields, team settings, payment, and online-submission linking.
      </div>

      {renderTree(null, 0)}

      <button onClick={() => addCategory(null)}
        className="mt-3 flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold"
        style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}>
        <Plus size={15} /> Add Top-Level Category
      </button>

      {categories.length === 0 && (
        <p className="mt-4 text-sm" style={{ color: '#3d5a78' }}>
          No categories yet. Start with something like "Offline" / "Online", or just one category
          if this event doesn't need sub-segments — registration works even with a single
          top-level leaf category.
        </p>
      )}
    </div>
  )
}

function CategoryEditor({ category, isLeaf, onSave }: { category: Category; isLeaf: boolean; onSave: (patch: Partial<Category>) => void }) {
  const [name, setName] = useState(category.name)
  const [description, setDescription] = useState(category.description || '')
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
  const [saving, setSaving] = useState(false)

  const fieldTypeOptions: { value: FieldType; label: string }[] = [
    { value: 'text', label: 'Short text' },
    { value: 'textarea', label: 'Long text' },
    { value: 'number', label: 'Number' },
    { value: 'photo', label: 'Photo upload' },
  ]

  const addField = (setter: typeof setCustomFields) => setter(prev => [...prev, BLANK_FIELD()])
  const removeField = (setter: typeof setCustomFields, key: string) => setter(prev => prev.filter(f => f.key !== key))
  const patchField = (setter: typeof setCustomFields, key: string, patch: Partial<CustomField>) =>
    setter(prev => prev.map(f => f.key === key ? { ...f, ...patch } : f))

  const save = async () => {
    setSaving(true)
    await onSave({
      name, description,
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
    })
    setSaving(false)
  }

  const FieldListEditor = ({ fields, setter, title }: { fields: CustomField[]; setter: typeof setCustomFields; title: string }) => (
    <div className="space-y-2">
      <p className="text-xs font-bold" style={{ color: '#6a8faf' }}>{title}</p>
      {fields.map(f => (
        <div key={f.key} className="p-3 rounded-lg space-y-2" style={{ background: '#0a1628' }}>
          <div className="flex gap-2">
            <input placeholder="Field title (e.g. Submit your NDC ID card photo)" value={f.label}
              onChange={e => patchField(setter, f.key, { label: e.target.value })}
              className={inputCls} style={inputStyle} />
            <select value={f.type} onChange={e => patchField(setter, f.key, { type: e.target.value as FieldType })}
              className="px-2 py-2 rounded-lg text-sm border outline-none" style={inputStyle}>
              {fieldTypeOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
            </select>
            <button onClick={() => removeField(setter, f.key)} style={{ color: '#ff7070' }}><Trash2 size={14} /></button>
          </div>
          <input placeholder="Description shown under the field title (optional)" value={f.description || ''}
            onChange={e => patchField(setter, f.key, { description: e.target.value })}
            className={inputCls} style={inputStyle} />
          <label className="flex items-center gap-2 text-xs" style={{ color: '#6a8faf' }}>
            <input type="checkbox" checked={f.required} onChange={e => patchField(setter, f.key, { required: e.target.checked })} />
            Required
          </label>
        </div>
      ))}
      <button onClick={() => addField(setter)} className="text-xs px-3 py-1.5 rounded flex items-center gap-1"
        style={{ background: 'rgba(0,212,255,0.1)', color: '#00d4ff' }}>
        <Plus size={11} /> Add field
      </button>
    </div>
  )

  return (
    <div className="p-4 border-t space-y-4" style={{ borderColor: '#0f2a4a' }}>
      <div>
        <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Name</label>
        <input value={name} onChange={e => setName(e.target.value)} className={inputCls} style={inputStyle} />
      </div>
      <div>
        <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Description (optional, shown to students)</label>
        <textarea rows={2} value={description} onChange={e => setDescription(e.target.value)} className={inputCls + ' resize-none'} style={inputStyle} />
      </div>

      {isLeaf && (
        <>
          <hr style={{ borderColor: '#0f2a4a' }} />
          <FieldListEditor fields={customFields} setter={setCustomFields} title="EXTRA REGISTRATION FIELDS (besides name, phone, email, college, roll, HSC session)" />

          <hr style={{ borderColor: '#0f2a4a' }} />
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: '#a78bfa' }}>
              <input type="checkbox" checked={requiresTeam} onChange={e => setRequiresTeam(e.target.checked)} />
              <Users size={14} /> This is a team registration
            </label>
            {requiresTeam && (
              <div className="space-y-3 pl-6">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Min team size</label>
                    <input type="number" value={teamMin} onChange={e => setTeamMin(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                  <div>
                    <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Max team size</label>
                    <input type="number" value={teamMax} onChange={e => setTeamMax(e.target.value)} className={inputCls} style={inputStyle} />
                  </div>
                </div>
                <FieldListEditor fields={teamFields} setter={setTeamFields} title="INFO COLLECTED PER TEAM MEMBER" />
                <p className="text-xs" style={{ color: '#3d5a78' }}>
                  The team leader sets a password for each member during registration — every
                  member gets an email with their info and password so they can log in to their own dashboard.
                </p>
              </div>
            )}
          </div>

          <hr style={{ borderColor: '#0f2a4a' }} />
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-2" style={{ color: '#ffb347' }}>
              <input type="checkbox" checked={requiresPayment} onChange={e => setRequiresPayment(e.target.checked)} />
              <CreditCard size={14} /> Requires payment
            </label>
            {requiresPayment && (
              <div className="grid grid-cols-2 gap-3 pl-6">
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Amount (BDT)</label>
                  <input type="number" value={paymentAmount} onChange={e => setPaymentAmount(e.target.value)} className={inputCls} style={inputStyle} />
                </div>
                <div>
                  <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Payment label</label>
                  <input placeholder="e.g. Registration fee" value={paymentLabel} onChange={e => setPaymentLabel(e.target.value)} className={inputCls} style={inputStyle} />
                </div>
              </div>
            )}
          </div>

          <hr style={{ borderColor: '#0f2a4a' }} />
          <div>
            <label className="flex items-center gap-2 text-sm font-semibold mb-1" style={{ color: '#00d4ff' }}>
              <input type="checkbox" checked={isOnlineSubmission} onChange={e => setIsOnlineSubmission(e.target.checked)} />
              <Link2 size={14} /> This is an online-submission round
            </label>
            <p className="text-xs pl-6" style={{ color: '#3d5a78' }}>
              {category.linked_olympiad_id
                ? 'Already linked to an Olympiad — registrants for this category go straight into that Olympiad\'s registration + dashboard + submission flow.'
                : 'Saving with this on will automatically create a linked Olympiad behind the scenes — registrants here will be sent into that Olympiad\'s flow instead of a separate form.'}
            </p>
          </div>

          <hr style={{ borderColor: '#0f2a4a' }} />
          <div>
            <p className="text-xs font-bold mb-2 flex items-center gap-1.5" style={{ color: '#34d399' }}>
              <Calendar size={13} /> SCHEDULE (shown as a reminder on the registrant's dashboard)
            </p>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Date</label>
                <input type="date" value={scheduleDate} onChange={e => setScheduleDate(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Time</label>
                <input placeholder="10:00 AM - 12:00 PM" value={scheduleTime} onChange={e => setScheduleTime(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
              <div>
                <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>Room / Venue</label>
                <input value={scheduleRoom} onChange={e => setScheduleRoom(e.target.value)} className={inputCls} style={inputStyle} />
              </div>
            </div>
          </div>

          <hr style={{ borderColor: '#0f2a4a' }} />
          <div>
            <label className="block text-xs mb-1" style={{ color: '#6a8faf' }}>
              Self-edit window (hours after registering — leave blank for no time limit)
            </label>
            <input type="number" placeholder="e.g. 48" value={editWindowHours} onChange={e => setEditWindowHours(e.target.value)} className={inputCls} style={inputStyle} />
          </div>
        </>
      )}

      <button onClick={save} disabled={saving}
        className="px-5 py-2 rounded-lg text-sm font-bold disabled:opacity-50"
        style={{ background: '#00d4ff', color: '#000' }}>
        {saving ? 'Saving...' : 'Save Changes'}
      </button>
    </div>
  )
}
