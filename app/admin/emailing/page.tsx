'use client'
import { useEffect, useState } from 'react'
import { Mail, Plus, Trash2, Edit2, Send, Clock, CheckCircle, XCircle, AlertCircle } from 'lucide-react'

type EmailAccount = {
  id: string
  label: string
  gmail_address?: string
  sender_name: string
  sender_email: string
  api_key_masked: string
  daily_limit: number
  sent_today: number
  is_active: boolean
}

type Campaign = {
  id: string
  name: string
  subject: string
  audience_source: 'members' | 'users' | 'both'
  status: string
  total_recipients: number
  sent_count: number
  failed_count: number
  scheduled_at?: string
  sent_at?: string
  created_at: string
}

type Recipient = {
  id: string
  email: string
  name?: string
  source: string
  status: string
  error?: string
  sent_at?: string
}

type EmailAudienceFilters = {
  batches?: string[]
  departments?: string[]
  verified_only?: boolean
  organizers_only?: boolean
  executives_only?: boolean
  college?: 'any' | 'notre_dame_only' | 'excluding_notre_dame'
  active_only?: boolean
  custom_ids?: string[]
  custom_emails?: string[]
  activity_session_ids?: string[]
  category_ids?: string[]
  form_node_ids?: string[]
  submitted_only?: boolean
  olympiad_ids?: string[]
}

type EventSession = { id: string; title: string; date?: string }
type EventOlympiad = { id: string; name: string; is_child: boolean; parent_title?: string | null }
type EventCategory = { id: string; name: string; parent_id?: string | null }

const DEPARTMENTS = ['Administration', 'Project', 'Publication', 'ICT', 'LWS', 'Quiz', 'R&D']

const s = { background: 'var(--bg2)', borderColor: 'var(--border)' }
const h = { fontFamily: 'inherit', color: 'var(--blue)' }

export default function AdminEmailingPage() {
  const [activeTab, setActiveTab] = useState<'accounts' | 'new' | 'history'>('accounts')

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold mb-1" style={h}>Mass Emailing</h1>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>Manage Brevo accounts and campaigns</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6" style={{ borderBottom: '1px solid var(--border)' }}>
        {[
          { key: 'accounts', label: 'Accounts' },
          { key: 'new', label: 'New Campaign' },
          { key: 'history', label: 'History' },
        ].map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key as any)}
            className="px-4 py-2 text-sm transition-colors"
            style={{
              color: activeTab === tab.key ? 'var(--blue)' : 'var(--muted)',
              borderBottom: activeTab === tab.key ? '2px solid var(--blue)' : '2px solid transparent',
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'accounts' && <AccountsTab />}
      {activeTab === 'new' && <NewCampaignTab />}
      {activeTab === 'history' && <HistoryTab />}
    </div>
  )
}

function AccountsTab() {
  const [accounts, setAccounts] = useState<EmailAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [formData, setFormData] = useState({
    label: '',
    gmail_address: '',
    sender_name: '',
    sender_email: '',
    api_key: '',
    daily_limit: 300,
  })
  const [saving, setSaving] = useState(false)

  const load = async () => {
    try {
      const res = await fetch('/api/admin/emailing/accounts')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load accounts')
      setAccounts(data.accounts || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const handleSave = async () => {
    setError('')
    setSaving(true)
    try {
      const url = editingId ? '/api/admin/emailing/accounts' : '/api/admin/emailing/accounts'
      const method = editingId ? 'PATCH' : 'POST'
      const body = editingId ? { id: editingId, ...formData } : formData

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to save account')

      setShowForm(false)
      setEditingId(null)
      setFormData({ label: '', gmail_address: '', sender_name: '', sender_email: '', api_key: '', daily_limit: 300 })
      load()
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this account? This cannot be undone.')) return
    try {
      const res = await fetch(`/api/admin/emailing/accounts?id=${id}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to delete account')
      load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  const toggleActive = async (acc: EmailAccount) => {
    try {
      const res = await fetch('/api/admin/emailing/accounts', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: acc.id, is_active: !acc.is_active }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to update account')
      load()
    } catch (err: any) {
      setError(err.message)
    }
  }

  if (loading) return <div style={{ color: 'var(--muted)' }}>Loading accounts...</div>
  if (error) return <div style={{ color: 'var(--danger)' }}>{error}</div>

  return (
    <div>
      <div className="flex justify-between items-center mb-4">
        <p className="text-sm" style={{ color: 'var(--muted)' }}>{accounts.length} account(s)</p>
        <button
          onClick={() => { setShowForm(true); setEditingId(null); setFormData({ label: '', gmail_address: '', sender_name: '', sender_email: '', api_key: '', daily_limit: 300 }) }}
          className="px-3 py-1.5 text-sm rounded-lg flex items-center gap-2"
          style={{ background: 'var(--blue)', color: 'var(--white)' }}
        >
          <Plus size={16} /> Add Account
        </button>
      </div>

      {showForm && (
        <div className="p-4 rounded-lg mb-4" style={s}>
          <h3 className="font-semibold mb-3" style={h}>{editingId ? 'Edit Account' : 'Add Account'}</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Label (e.g. Gmail #1 – Outreach)"
              value={formData.label}
              onChange={e => setFormData({ ...formData, label: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--white)' }}
            />
            <input
              type="email"
              placeholder="Gmail address (informational)"
              value={formData.gmail_address}
              onChange={e => setFormData({ ...formData, gmail_address: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--white)' }}
            />
            <input
              type="text"
              placeholder="Sender name"
              value={formData.sender_name}
              onChange={e => setFormData({ ...formData, sender_name: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--white)' }}
            />
            <input
              type="email"
              placeholder="Sender email (must be verified in Brevo)"
              value={formData.sender_email}
              onChange={e => setFormData({ ...formData, sender_email: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--white)' }}
            />
            <input
              type="password"
              placeholder="Brevo API key"
              value={formData.api_key}
              onChange={e => setFormData({ ...formData, api_key: e.target.value })}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--white)' }}
            />
            <input
              type="number"
              placeholder="Daily limit"
              value={formData.daily_limit}
              onChange={e => setFormData({ ...formData, daily_limit: parseInt(e.target.value) })}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--white)' }}
            />
          </div>
          {error && <p className="text-sm mt-2" style={{ color: 'var(--danger)' }}>{error}</p>}
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-sm rounded-lg"
              style={{ background: 'var(--blue)', color: 'var(--white)' }}
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            <button
              onClick={() => { setShowForm(false); setEditingId(null); setError('') }}
              className="px-3 py-1.5 text-sm rounded-lg"
              style={{ background: 'var(--bg3)', color: 'var(--muted)' }}
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      <div className="grid gap-4">
        {accounts.map(acc => (
          <div key={acc.id} className="p-4 rounded-lg" style={s}>
            <div className="flex justify-between items-start mb-3">
              <div>
                <h3 className="font-semibold mb-1" style={{ color: 'var(--white)' }}>{acc.label}</h3>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {acc.sender_name} &lt;{acc.sender_email}&gt;
                  {acc.gmail_address && ` • Gmail: ${acc.gmail_address}`}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>API Key: {acc.api_key_masked}</p>
              </div>
              <div className="flex gap-2">
                <button
                  onClick={() => toggleActive(acc)}
                  className="px-2 py-1 text-xs rounded"
                  style={{
                    background: acc.is_active ? 'rgba(var(--success-rgb), 0.1)' : 'rgba(128,128,128,0.1)',
                    color: acc.is_active ? 'var(--success)' : 'var(--muted)',
                  }}
                >
                  {acc.is_active ? 'Active' : 'Inactive'}
                </button>
                <button onClick={() => handleDelete(acc.id)} style={{ color: 'var(--danger)' }}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
            <div className="relative pt-2">
              <div className="h-2 rounded-full overflow-hidden" style={{ background: 'var(--bg3)' }}>
                <div
                  className="h-full transition-all"
                  style={{
                    width: `${Math.min(100, (acc.sent_today / acc.daily_limit) * 100)}%`,
                    background: acc.sent_today >= acc.daily_limit ? 'var(--danger)' : 'var(--blue)',
                  }}
                />
              </div>
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                {acc.sent_today} / {acc.daily_limit} sent today
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function NewCampaignTab() {
  const [name, setName] = useState('')
  const [subject, setSubject] = useState('')
  const [bodyHtml, setBodyHtml] = useState('')
  const [audienceSource, setAudienceSource] = useState<'members' | 'users' | 'both'>('members')
  const [filters, setFilters] = useState<EmailAudienceFilters>({})
  const [previewCount, setPreviewCount] = useState<number | null>(null)
  const [scheduledAt, setScheduledAt] = useState('')
  const [sendNow, setSendNow] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState('')

  const [availableBatches, setAvailableBatches] = useState<string[]>([])

  // Specific recipients (typed-in emails, OR'd in regardless of source/filters)
  const [emailInput, setEmailInput] = useState('')

  // Event / olympiad participants
  const [eventSessions, setEventSessions] = useState<EventSession[]>([])
  const [eventOlympiads, setEventOlympiads] = useState<EventOlympiad[]>([])
  const [sessionCategories, setSessionCategories] = useState<EventCategory[]>([])
  const [sessionSegments, setSessionSegments] = useState<{ id: string; name: string }[]>([])
  const [categoriesLoading, setCategoriesLoading] = useState(false)

  useEffect(() => {
    // Load distinct batches
    fetch('/api/admin/members').then(res => res.json()).then(data => {
      const batches = new Set<string>()
      data.members?.forEach((m: any) => { if (m.batch) batches.add(m.batch) })
      setAvailableBatches(Array.from(batches).sort())
    })
    // Load activity sessions + olympiads for the participants picker
    fetch('/api/admin/emailing/event-options').then(res => res.json()).then(data => {
      setEventSessions(data.sessions || [])
      setEventOlympiads(data.olympiads || [])
    })
  }, [])

  useEffect(() => {
    // When the chosen activity session(s) change to exactly one, load its
    // categories/segments so the admin can narrow to a single submission bucket.
    const ids = filters.activity_session_ids || []
    if (ids.length !== 1) {
      setSessionCategories([])
      setSessionSegments([])
      return
    }
    setCategoriesLoading(true)
    fetch(`/api/admin/emailing/event-options?sessionId=${ids[0]}`)
      .then(res => res.json())
      .then(data => {
        setSessionCategories(data.categories || [])
        setSessionSegments(data.segments || [])
      })
      .finally(() => setCategoriesLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(filters.activity_session_ids)])

  useEffect(() => {
    // Debounced preview
    const timer = setTimeout(() => {
      fetch('/api/admin/emailing/audience-preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ audience_source: audienceSource, audience_filters: filters }),
      })
        .then(res => res.json())
        .then(data => setPreviewCount(data.count || 0))
        .catch(() => setPreviewCount(null))
    }, 500)
    return () => clearTimeout(timer)
  }, [audienceSource, filters])

  const handleSubmit = async () => {
    setError('')
    setSuccess('')
    setSaving(true)
    try {
      const res = await fetch('/api/admin/emailing/campaigns', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          subject,
          body_html: bodyHtml,
          audience_source: audienceSource,
          audience_filters: filters,
          scheduled_at: sendNow ? undefined : scheduledAt,
          send_now: sendNow,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create campaign')
      setSuccess(sendNow ? 'Campaign started!' : 'Campaign scheduled!')
      setName('')
      setSubject('')
      setBodyHtml('')
      setFilters({})
    } catch (err: any) {
      setError(err.message)
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="space-y-4">
        <div className="p-4 rounded-lg" style={s}>
          <h3 className="font-semibold mb-3" style={h}>Campaign Details</h3>
          <div className="space-y-3">
            <input
              type="text"
              placeholder="Campaign name (internal)"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--white)' }}
            />
            <input
              type="text"
              placeholder="Email subject"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--white)' }}
            />
            <textarea
              placeholder="Email body (HTML)"
              value={bodyHtml}
              onChange={e => setBodyHtml(e.target.value)}
              rows={8}
              className="w-full px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--white)' }}
            />
          </div>
        </div>

        <div className="p-4 rounded-lg" style={s}>
          <h3 className="font-semibold mb-3" style={h}>Audience</h3>
          <div className="space-y-3">
            <div>
              <label className="text-sm mb-1 block" style={{ color: 'var(--muted)' }}>Source</label>
              <select
                value={audienceSource}
                onChange={e => setAudienceSource(e.target.value as any)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--white)' }}
              >
                <option value="members">Members only</option>
                <option value="users">Non-member users only</option>
                <option value="both">Both members and users</option>
              </select>
            </div>

            {(audienceSource === 'members' || audienceSource === 'both') && (
              <>
                <div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.verified_only || false}
                      onChange={e => setFilters({ ...filters, verified_only: e.target.checked })}
                    />
                    <span style={{ color: 'var(--muted)' }}>Verified members only</span>
                  </label>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.organizers_only || false}
                      onChange={e => setFilters({ ...filters, organizers_only: e.target.checked })}
                    />
                    <span style={{ color: 'var(--muted)' }}>Organizers only</span>
                  </label>
                </div>
                <div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.executives_only || false}
                      onChange={e => setFilters({ ...filters, executives_only: e.target.checked })}
                    />
                    <span style={{ color: 'var(--muted)' }}>Executives only</span>
                  </label>
                </div>
                <div>
                  <label className="text-sm mb-1 block" style={{ color: 'var(--muted)' }}>Departments</label>
                  <div className="flex flex-wrap gap-2">
                    {DEPARTMENTS.map(dept => (
                      <label key={dept} className="flex items-center gap-1 text-xs">
                        <input
                          type="checkbox"
                          checked={(filters.departments || []).includes(dept)}
                          onChange={e => {
                            const current = filters.departments || []
                            setFilters({
                              ...filters,
                              departments: e.target.checked ? [...current, dept] : current.filter(d => d !== dept),
                            })
                          }}
                        />
                        <span style={{ color: 'var(--muted)' }}>{dept}</span>
                      </label>
                    ))}
                  </div>
                </div>
              </>
            )}

            {(audienceSource === 'users' || audienceSource === 'both') && (
              <>
                <div>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={filters.active_only || false}
                      onChange={e => setFilters({ ...filters, active_only: e.target.checked })}
                    />
                    <span style={{ color: 'var(--muted)' }}>Active users only</span>
                  </label>
                </div>
                <div>
                  <label className="text-sm mb-1 block" style={{ color: 'var(--muted)' }}>College</label>
                  <select
                    value={filters.college || 'any'}
                    onChange={e => setFilters({ ...filters, college: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg text-sm"
                    style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--white)' }}
                  >
                    <option value="any">Any college</option>
                    <option value="notre_dame_only">Notre Dame only</option>
                    <option value="excluding_notre_dame">Excluding Notre Dame</option>
                  </select>
                </div>
              </>
            )}

            <div>
              <label className="text-sm mb-1 block" style={{ color: 'var(--muted)' }}>Batches</label>
              <div className="flex flex-wrap gap-2">
                {availableBatches.slice(0, 10).map(batch => (
                  <label key={batch} className="flex items-center gap-1 text-xs">
                    <input
                      type="checkbox"
                      checked={(filters.batches || []).includes(batch)}
                      onChange={e => {
                        const current = filters.batches || []
                        setFilters({
                          ...filters,
                          batches: e.target.checked ? [...current, batch] : current.filter(b => b !== batch),
                        })
                      }}
                    />
                    <span style={{ color: 'var(--muted)' }}>{batch}</span>
                  </label>
                ))}
              </div>
            </div>

            {previewCount !== null && (
              <p className="text-sm font-semibold" style={{ color: 'var(--blue)' }}>
                {previewCount} recipient{previewCount !== 1 ? 's' : ''} match
              </p>
            )}
          </div>
        </div>

        <div className="p-4 rounded-lg" style={s}>
          <h3 className="font-semibold mb-3" style={h}>Specific Recipients</h3>
          <p className="text-xs mb-2" style={{ color: 'var(--muted)' }}>
            Add one or a few exact email addresses — these are included in addition to whatever's matched above.
          </p>
          <div className="flex gap-2 mb-2">
            <input
              type="email"
              placeholder="name@example.com"
              value={emailInput}
              onChange={e => setEmailInput(e.target.value)}
              onKeyDown={e => {
                if (e.key === 'Enter' || e.key === ',') {
                  e.preventDefault()
                  const email = emailInput.trim().replace(/,$/, '')
                  if (email && !(filters.custom_emails || []).includes(email)) {
                    setFilters({ ...filters, custom_emails: [...(filters.custom_emails || []), email] })
                  }
                  setEmailInput('')
                }
              }}
              className="flex-1 px-3 py-2 rounded-lg text-sm"
              style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--white)' }}
            />
            <button
              onClick={() => {
                const email = emailInput.trim().replace(/,$/, '')
                if (email && !(filters.custom_emails || []).includes(email)) {
                  setFilters({ ...filters, custom_emails: [...(filters.custom_emails || []), email] })
                }
                setEmailInput('')
              }}
              className="px-3 py-2 text-sm rounded-lg"
              style={{ background: 'var(--bg3)', color: 'var(--muted)' }}
            >
              Add
            </button>
          </div>
          {(filters.custom_emails || []).length > 0 && (
            <div className="flex flex-wrap gap-2">
              {(filters.custom_emails || []).map(email => (
                <span
                  key={email}
                  className="px-2 py-1 text-xs rounded flex items-center gap-2"
                  style={{ background: 'var(--bg3)', color: 'var(--white)' }}
                >
                  {email}
                  <button
                    onClick={() => setFilters({ ...filters, custom_emails: (filters.custom_emails || []).filter(e => e !== email) })}
                    style={{ color: 'var(--danger)' }}
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        <div className="p-4 rounded-lg" style={s}>
          <h3 className="font-semibold mb-3" style={h}>Event &amp; Olympiad Participants</h3>
          <p className="text-xs mb-3" style={{ color: 'var(--muted)' }}>
            Pull in everyone registered for an activity event, a specific category/submission within it, or an olympiad
            (standalone or a "child" olympiad linked to an activity) — included in addition to everything else above.
          </p>

          <div className="mb-3">
            <label className="text-sm mb-1 block" style={{ color: 'var(--muted)' }}>Activity events</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 rounded-lg" style={{ background: 'var(--bg3)' }}>
              {eventSessions.map(sess => (
                <label key={sess.id} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={(filters.activity_session_ids || []).includes(sess.id)}
                    onChange={e => {
                      const current = filters.activity_session_ids || []
                      setFilters({
                        ...filters,
                        activity_session_ids: e.target.checked ? [...current, sess.id] : current.filter(id => id !== sess.id),
                        // Selecting a different set of sessions invalidates any
                        // category/segment picked for the previous session.
                        category_ids: [],
                        form_node_ids: [],
                      })
                    }}
                  />
                  <span style={{ color: 'var(--muted)' }}>{sess.title}</span>
                </label>
              ))}
              {eventSessions.length === 0 && <span className="text-xs" style={{ color: 'var(--muted)' }}>No activity events found</span>}
            </div>
          </div>

          {(filters.activity_session_ids || []).length === 1 && (sessionCategories.length > 0 || sessionSegments.length > 0 || categoriesLoading) && (
            <div className="mb-3">
              <label className="text-sm mb-1 block" style={{ color: 'var(--muted)' }}>
                Narrow to a category / submission (optional — leave empty for everyone in the event)
              </label>
              {categoriesLoading ? (
                <p className="text-xs" style={{ color: 'var(--muted)' }}>Loading…</p>
              ) : (
                <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 rounded-lg" style={{ background: 'var(--bg3)' }}>
                  {sessionCategories.map(cat => (
                    <label key={cat.id} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={(filters.category_ids || []).includes(cat.id)}
                        onChange={e => {
                          const current = filters.category_ids || []
                          setFilters({
                            ...filters,
                            category_ids: e.target.checked ? [...current, cat.id] : current.filter(id => id !== cat.id),
                          })
                        }}
                      />
                      <span style={{ color: 'var(--muted)' }}>{cat.name}</span>
                    </label>
                  ))}
                  {sessionSegments.map(seg => (
                    <label key={seg.id} className="flex items-center gap-1 text-xs">
                      <input
                        type="checkbox"
                        checked={(filters.form_node_ids || []).includes(seg.id)}
                        onChange={e => {
                          const current = filters.form_node_ids || []
                          setFilters({
                            ...filters,
                            form_node_ids: e.target.checked ? [...current, seg.id] : current.filter(id => id !== seg.id),
                          })
                        }}
                      />
                      <span style={{ color: 'var(--muted)' }}>{seg.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          )}

          {((filters.activity_session_ids || []).length > 0 || (filters.category_ids || []).length > 0 || (filters.form_node_ids || []).length > 0) && (
            <div className="mb-3">
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={filters.submitted_only || false}
                  onChange={e => setFilters({ ...filters, submitted_only: e.target.checked })}
                />
                <span style={{ color: 'var(--muted)' }}>Only those who actually submitted (not just registered)</span>
              </label>
            </div>
          )}

          <div>
            <label className="text-sm mb-1 block" style={{ color: 'var(--muted)' }}>Olympiads</label>
            <div className="flex flex-wrap gap-2 max-h-32 overflow-y-auto p-2 rounded-lg" style={{ background: 'var(--bg3)' }}>
              {eventOlympiads.map(oly => (
                <label key={oly.id} className="flex items-center gap-1 text-xs">
                  <input
                    type="checkbox"
                    checked={(filters.olympiad_ids || []).includes(oly.id)}
                    onChange={e => {
                      const current = filters.olympiad_ids || []
                      setFilters({
                        ...filters,
                        olympiad_ids: e.target.checked ? [...current, oly.id] : current.filter(id => id !== oly.id),
                      })
                    }}
                  />
                  <span style={{ color: 'var(--muted)' }}>
                    {oly.name}{oly.is_child ? ` (child of ${oly.parent_title || 'an activity'})` : ''}
                  </span>
                </label>
              ))}
              {eventOlympiads.length === 0 && <span className="text-xs" style={{ color: 'var(--muted)' }}>No olympiads found</span>}
            </div>
          </div>
        </div>

        <div className="p-4 rounded-lg" style={s}>
          <h3 className="font-semibold mb-3" style={h}>Schedule</h3>
          <div className="space-y-3">
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={sendNow} onChange={() => setSendNow(true)} />
              <span style={{ color: 'var(--muted)' }}>Send now</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input type="radio" checked={!sendNow} onChange={() => setSendNow(false)} />
              <span style={{ color: 'var(--muted)' }}>Schedule for later</span>
            </label>
            {!sendNow && (
              <input
                type="datetime-local"
                value={scheduledAt}
                onChange={e => setScheduledAt(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm"
                style={{ background: 'var(--bg3)', border: '1px solid var(--border)', color: 'var(--white)' }}
              />
            )}
          </div>
        </div>

        {error && <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>}
        {success && <p className="text-sm" style={{ color: 'var(--success)' }}>{success}</p>}

        <button
          onClick={handleSubmit}
          disabled={saving || !name || !subject || !bodyHtml || previewCount === 0}
          className="px-4 py-2 rounded-lg flex items-center gap-2"
          style={{ background: 'var(--blue)', color: 'var(--white)' }}
        >
          <Send size={16} />
          {saving ? 'Creating...' : sendNow ? 'Create & Send Now' : 'Schedule Campaign'}
        </button>
      </div>
    </div>
  )
}

function HistoryTab() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [selectedCampaign, setSelectedCampaign] = useState<Campaign | null>(null)
  const [recipients, setRecipients] = useState<Recipient[]>([])

  const load = async () => {
    try {
      const res = await fetch('/api/admin/emailing/campaigns')
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load campaigns')
      setCampaigns(data.campaigns || [])
    } catch (err: any) {
      setError(err.message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { load() }, [])

  const loadCampaignDetail = async (id: string) => {
    try {
      const res = await fetch(`/api/admin/emailing/campaigns/${id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to load campaign')
      setSelectedCampaign(data.campaign)
      setRecipients(data.recipients || [])
    } catch (err: any) {
      setError(err.message)
    }
  }

  const statusBadge = (status: string) => {
    const colors: Record<string, { bg: string; color: string }> = {
      draft: { bg: 'rgba(128,128,128,0.1)', color: 'var(--muted)' },
      scheduled: { bg: 'rgba(255,165,0,0.1)', color: 'var(--warning)' },
      sending: { bg: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' },
      sent: { bg: 'rgba(var(--success-rgb), 0.1)', color: 'var(--success)' },
      partially_sent: { bg: 'rgba(255,165,0,0.1)', color: 'var(--warning)' },
      failed: { bg: 'rgba(var(--danger-rgb), 0.1)', color: 'var(--danger)' },
      cancelled: { bg: 'rgba(128,128,128,0.1)', color: 'var(--muted)' },
    }
    const c = colors[status] || colors.draft
    return (
      <span className="px-2 py-0.5 text-xs rounded" style={{ background: c.bg, color: c.color }}>
        {status}
      </span>
    )
  }

  if (loading) return <div style={{ color: 'var(--muted)' }}>Loading campaigns...</div>
  if (error) return <div style={{ color: 'var(--danger)' }}>{error}</div>

  if (selectedCampaign) {
    return (
      <div>
        <button
          onClick={() => setSelectedCampaign(null)}
          className="text-sm mb-4"
          style={{ color: 'var(--blue)' }}
        >
          ← Back to history
        </button>

        <div className="p-4 rounded-lg mb-4" style={s}>
          <div className="flex justify-between items-start mb-2">
            <h3 className="font-semibold" style={{ color: 'var(--white)' }}>{selectedCampaign.name}</h3>
            {statusBadge(selectedCampaign.status)}
          </div>
          <p className="text-sm mb-2" style={{ color: 'var(--muted)' }}>Subject: {selectedCampaign.subject}</p>
          <p className="text-sm" style={{ color: 'var(--muted)' }}>
            {selectedCampaign.sent_count} / {selectedCampaign.total_recipients} sent
            {selectedCampaign.failed_count > 0 && ` • ${selectedCampaign.failed_count} failed`}
          </p>
        </div>

        <h4 className="font-semibold mb-2" style={h}>Recipients</h4>
        <div className="space-y-2">
          {recipients.map(r => (
            <div key={r.id} className="p-3 rounded-lg flex justify-between items-center" style={s}>
              <div>
                <p className="text-sm" style={{ color: 'var(--white)' }}>{r.email}</p>
                <p className="text-xs" style={{ color: 'var(--muted)' }}>
                  {r.name} • {r.source}
                </p>
                {r.error && <p className="text-xs mt-1" style={{ color: 'var(--danger)' }}>{r.error}</p>}
              </div>
              <div>
                {r.status === 'sent' && <CheckCircle size={16} style={{ color: 'var(--success)' }} />}
                {r.status === 'failed' && <XCircle size={16} style={{ color: 'var(--danger)' }} />}
                {r.status === 'pending' && <Clock size={16} style={{ color: 'var(--muted)' }} />}
              </div>
            </div>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div>
      <p className="text-sm mb-4" style={{ color: 'var(--muted)' }}>{campaigns.length} campaign(s)</p>
      <div className="space-y-3">
        {campaigns.map(c => (
          <div
            key={c.id}
            onClick={() => loadCampaignDetail(c.id)}
            className="p-4 rounded-lg cursor-pointer hover:opacity-80 transition-opacity"
            style={s}
          >
            <div className="flex justify-between items-start mb-2">
              <h3 className="font-semibold" style={{ color: 'var(--white)' }}>{c.name}</h3>
              {statusBadge(c.status)}
            </div>
            <p className="text-sm mb-1" style={{ color: 'var(--muted)' }}>
              {c.subject} • {c.audience_source}
            </p>
            <p className="text-xs" style={{ color: 'var(--muted)' }}>
              {c.sent_count} / {c.total_recipients} sent
              {c.failed_count > 0 && ` • ${c.failed_count} failed`}
            </p>
            {c.scheduled_at && (
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Scheduled: {new Date(c.scheduled_at).toLocaleString()}
              </p>
            )}
            {c.sent_at && (
              <p className="text-xs mt-1" style={{ color: 'var(--muted)' }}>
                Sent: {new Date(c.sent_at).toLocaleString()}
              </p>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}
