'use client'

import { useCallback, useState } from 'react'
import { Users, Plus, X } from 'lucide-react'

// Per-member editor for v2 (form-graph) registration flows. Renders an
// add/remove row of identity + per-team-extras for every team member
// collected on a node whose behavior.require_team is set.
//
// Tasks 1 & 2 of the audit added:
//   - a top-level team_name input near the team header (Task 1)
//   - a `phone` input on every member row (Task 2 — it was already in
//     the wire shape but never rendered)
//   - type-aware rendering of per-member extra fields (Task 2): dropdown,
//     multiple_choice, checkboxes, date, number, textarea all match the
//     same shape admins use on the main form via FormBlocksBuilder.
//
// The v1 inline editor in app/activities/[slug]/register/page.tsx shares
// the same per-member field set + the same body.team_members JSON shape;
// server-side validation + hashing goes through the shared
// lib/teamRegistration.validateAndPrepareTeam helper.

const uid = () => Math.random().toString(36).slice(2, 9)

export type TeamFieldDef = {
  key?: string
  label?: string
  type?: string
  required?: boolean
  description?: string
  /** For dropdown / multiple_choice / checkboxes — the choice list. */
  options?: string[]
}

export type TeamMemberDraft = {
  id: string
  full_name: string
  phone?: string
  email: string
  college_roll: string
  password?: string
  custom_answers?: Record<string, any>
}

export type TeamMembersEditorProps = {
  value: TeamMemberDraft[]
  onChange: (next: TeamMemberDraft[]) => void
  accent: string
  config: {
    /** Same shape as activity_reg_categories.requires_team for v1 paths. */
    require_team: boolean
    /** Whether the team is optional (0 members allowed). */
    optional?: boolean
    /** Lower bound on member count (not counting the leader). Defaults to 0 when optional, 1 otherwise. */
    min?: number | null
    /** Upper bound. Defaults to 99. */
    max?: number | null
    /** If false, password field is hidden and raw password is omitted from the wire payload. */
    password_required?: boolean
    /** Extra per-member fields — same shape as v1's team_member_fields. */
    fields?: TeamFieldDef[]
  }
  /** Task 1: team_name value (controlled). Optional — when undefined,
   *  the input is uncontrolled and the parent doesn't care. Always
   *  rendered for team events so a solo entrant in an optional team
   *  event can still name their "team of one". */
  teamName?: string
  onTeamNameChange?: (next: string) => void
}

function blankDraft(passwordRequired: boolean): TeamMemberDraft {
  return {
    id: uid(),
    full_name: '',
    phone: '',
    email: '',
    college_roll: '',
    password: passwordRequired ? '' : undefined,
    custom_answers: {},
  }
}

// Per-row label/description shared style — matches the form-fields
// styling on the v1 register page so neither feels heavier than the
// other.
const inputCls = 'w-full px-3 py-2.5 rounded-lg text-sm outline-none reg-input'
const inputStyle = { background: 'rgba(255,255,255,0.04)', border: '1px solid var(--border)', color: 'var(--white)' }
const labelCls = 'block text-sm font-medium mb-1'
const descCls = 'text-xs mb-1.5'

// Type-aware rendering of a single extra per-member field. Mirrors the
// main form's FieldsRenderer style. Falls back to a plain text input
// for unknown types — safe default, doesn't crash on admin mistakes.
function ExtraFieldInput({
  field, value, onChange, accent,
}: {
  field: TeamFieldDef
  value: any
  onChange: (v: any) => void
  accent: string
}) {
  const k = field.key || ''
  if (!k) return null
  const label = field.label || k
  const required = !!field.required
  const desc = field.description
  const opts = Array.isArray(field.options) ? field.options : []

  const labelEl = (
    <label className={labelCls} style={{ color: 'var(--white)' }}>
      {label}{required && <span style={{ color: accent }}> *</span>}
    </label>
  )
  const descEl = desc ? <p className={descCls} style={{ color: 'var(--muted)' }}>{desc}</p> : null

  const t = (field.type || 'text').toLowerCase()
  if (t === 'textarea') {
    return (
      <div>
        {labelEl}{descEl}
        <textarea value={value || ''} onChange={e => onChange(e.target.value)}
          rows={3}
          className={inputCls} style={inputStyle} />
      </div>
    )
  }
  if (t === 'number') {
    return (
      <div>
        {labelEl}{descEl}
        <input type="number" value={value || ''} onChange={e => onChange(e.target.value)}
          className={inputCls} style={inputStyle} />
      </div>
    )
  }
  if (t === 'date') {
    return (
      <div>
        {labelEl}{descEl}
        <input type="date" value={value || ''} onChange={e => onChange(e.target.value)}
          className={inputCls} style={inputStyle} />
      </div>
    )
  }
  if (t === 'dropdown' || t === 'select') {
    return (
      <div>
        {labelEl}{descEl}
        <select value={value || ''} onChange={e => onChange(e.target.value)}
          className={inputCls} style={inputStyle}>
          <option value="">Select…</option>
          {opts.map(o => <option key={o} value={o}>{o}</option>)}
        </select>
      </div>
    )
  }
  if (t === 'multiple_choice' || t === 'radio') {
    return (
      <div>
        {labelEl}{descEl}
        <div className="space-y-1.5">
          {opts.map(o => (
            <label key={o} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--white)' }}>
              <input type="radio" name={`${k}-${value?.id || 'new'}`} checked={value === o}
                onChange={() => onChange(o)} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }
  if (t === 'checkboxes') {
    // Multi-select. Stored as an array in custom_answers.
    const selected: string[] = Array.isArray(value) ? value : []
    return (
      <div>
        {labelEl}{descEl}
        <div className="space-y-1.5">
          {opts.map(o => (
            <label key={o} className="flex items-center gap-2 text-sm cursor-pointer" style={{ color: 'var(--white)' }}>
              <input type="checkbox" checked={selected.includes(o)}
                onChange={e => {
                  const next = e.target.checked
                    ? Array.from(new Set([...selected, o]))
                    : selected.filter(x => x !== o)
                  onChange(next)
                }} />
              <span>{o}</span>
            </label>
          ))}
        </div>
      </div>
    )
  }
  // Default: text input (covers 'text', 'email', 'tel', unknown types).
  // KNOWN GAP: file/photo upload per team member is intentionally not
  // supported here — would need a Supabase Storage-backed uploader and
  // a file-size/type limit pass-through. Out of scope for Tasks 1/2.
  return (
    <div>
      {labelEl}{descEl}
      <input type={t === 'email' ? 'email' : t === 'tel' ? 'tel' : 'text'}
        value={value || ''} onChange={e => onChange(e.target.value)}
        placeholder={label}
        className={inputCls} style={inputStyle} />
    </div>
  )
}

export default function TeamMembersEditor({ value, onChange, accent, config, teamName, onTeamNameChange }: TeamMembersEditorProps) {
  const passwordRequired = config.password_required !== false
  const min = config.optional ? 0 : (config.min ?? 1)
  const max = config.max ?? 99
  const fields = config.fields || []
  const teamNameRequired = config.require_team && !config.optional

  // Local "touched" toggles per member — used to apply red borders to
  // already-edited fields when they're required-but-empty. Without
  // local state, every empty required field would glow red the moment
  // the user clicked into the section, which is too aggressive.
  const [touched, setTouched] = useState<Record<string, Set<string>>>({})
  const [teamNameTouched, setTeamNameTouched] = useState(false)

  const setRow = useCallback((idx: number, patch: Partial<TeamMemberDraft>) => {
    onChange(value.map((m, i) => (i === idx ? { ...m, ...patch } : m)))
  }, [value, onChange])

  const setCustom = useCallback((idx: number, key: string, val: any) => {
    onChange(value.map((m, i) => {
      if (i !== idx) return m
      return { ...m, custom_answers: { ...(m.custom_answers || {}), [key]: val } }
    }))
  }, [value, onChange])

  const markTouched = useCallback((rowId: string, key: string) => {
    setTouched((t) => ({ ...t, [rowId]: new Set([...(t[rowId] || []), key]) }))
  }, [])

  const addRow = useCallback(() => {
    if (value.length >= max) return
    onChange([...value, blankDraft(passwordRequired)])
  }, [value, onChange, max, passwordRequired])

  const removeRow = useCallback((idx: number) => {
    if (value.length <= min) return
    onChange(value.filter((_, i) => i !== idx))
  }, [value, onChange, min])

  return (
    <div className="space-y-3 pt-2">
      <p className="text-sm font-bold flex items-center gap-2 mb-1" style={{ color: 'var(--accent2)' }}>
        <Users size={15} /> Team members ({value.length})
        {config.optional && (
          <span className="text-[10px] font-normal px-1.5 py-0.5 rounded" style={{ background: 'rgba(var(--accent2-rgb), 0.12)', color: 'var(--accent2)' }}>
            optional
          </span>
        )}
      </p>
      <p className="text-xs mb-1" style={{ color: 'var(--muted)' }}>
        {config.optional
          ? 'This event accepts both individuals and teams. Add 0 members to register alone, or add members below. Each member you add gets a username + password so they can sign in to view this event.'
          : 'You are the team leader. Add your team members below. Each member gets a username + password so they can sign in to view this event.'}
        {(min > 0 || max < 99) && (
          <> Between <strong>{min}</strong> and <strong>{max}</strong> member{max === 1 ? '' : 's'} (not counting yourself as leader).</>
        )}
      </p>

      {/* Task 1: Team Name. Available whenever require_team is set, even
          when the team is optional and members.length === 0. Required
          server-side only when !config.optional; the red border below
          mirrors that so the user can see what's blocking submit. */}
      {onTeamNameChange ? (
        <div className="space-y-1">
          <label className={labelCls} style={{ color: 'var(--white)' }}>
            Team name{teamNameRequired && <span style={{ color: accent }}> *</span>}
          </label>
          <input
            type="text"
            value={teamName || ''}
            onChange={e => onTeamNameChange(e.target.value)}
            onBlur={() => setTeamNameTouched(true)}
            placeholder="e.g. The Quantum Crew"
            className={inputCls}
            style={{
              ...inputStyle,
              ...(teamNameTouched && teamNameRequired && !(teamName || '').trim()
                ? { border: '1px solid var(--danger-soft)' }
                : {}),
            }}
          />
        </div>
      ) : null}

      <div className="space-y-3">
        {value.map((m, idx) => {
          const rowTouched = touched[m.id] || new Set<string>()
          return (
            <div key={m.id}
              className="p-3 rounded-lg space-y-2"
              style={{ background: 'rgba(var(--accent2-rgb), 0.05)', border: '1px solid rgba(var(--accent2-rgb), 0.2)' }}>
              <div className="flex justify-between items-center">
                <p className="text-xs font-semibold" style={{ color: 'var(--accent2)' }}>Member {idx + 1}</p>
                {value.length > min && (
                  <button type="button" onClick={() => removeRow(idx)} aria-label={`Remove member ${idx + 1}`}>
                    <X size={13} style={{ color: 'var(--danger-soft)' }} />
                  </button>
                )}
              </div>
              <input placeholder="Full name" value={m.full_name}
                onChange={(e) => setRow(idx, { full_name: e.target.value })}
                onBlur={() => markTouched(m.id, 'full_name')}
                className={inputCls} style={inputStyle} />
              <input placeholder="Phone" type="tel" value={m.phone || ''}
                onChange={(e) => setRow(idx, { phone: e.target.value })}
                onBlur={() => markTouched(m.id, 'phone')}
                className={inputCls} style={inputStyle} />
              <input placeholder="Email" type="email" value={m.email}
                onChange={(e) => setRow(idx, { email: e.target.value })}
                onBlur={() => markTouched(m.id, 'email')}
                className={inputCls} style={inputStyle} />
              <input placeholder="College roll" value={m.college_roll}
                onChange={(e) => setRow(idx, { college_roll: e.target.value })}
                onBlur={() => markTouched(m.id, 'college_roll')}
                className={inputCls} style={inputStyle} />
              {passwordRequired && (
                <input type="password" placeholder="Set a password for them (min 6 chars)" value={m.password || ''}
                  onChange={(e) => setRow(idx, { password: e.target.value })}
                  onBlur={() => markTouched(m.id, 'password')}
                  className={inputCls} style={inputStyle} />
              )}
              {fields.map((field) => {
                const k = field.key
                if (!k) return null
                return (
                  <ExtraFieldInput key={k}
                    field={field}
                    value={m.custom_answers?.[k]}
                    onChange={(v) => setCustom(idx, k, v)}
                    accent={accent}
                  />
                )
              })}
              {/* Validation summary for this row — only after the row
                  has been touched at least once, to avoid showing
                  "fill everything" before the user has tried. */}
              {(rowTouched.size > 0) && (
                <RowHints row={m} passwordRequired={passwordRequired} />
              )}
            </div>
          )
        })}
      </div>
      {value.length < max && (
        <button type="button" onClick={addRow}
          className="mt-2 flex items-center gap-1 text-xs px-3 py-1.5 rounded"
          style={{ background: 'rgba(var(--accent2-rgb), 0.1)', color: 'var(--accent2)' }}>
          <Plus size={12} /> Add team member
        </button>
      )}
    </div>
  )
}

// Tiny inline hints shown under each row when the user has touched at
// least one field. Only marks the missing-required pieces; does not
// show the password length rule (server-side check — give the user a
// softer experience by letting them submit and seeing the error).
function RowHints({ row, passwordRequired }: { row: TeamMemberDraft; passwordRequired: boolean }) {
  const missing: string[] = []
  if (!row.full_name?.trim()) missing.push('name')
  if (!row.email?.trim()) missing.push('email')
  if (!row.college_roll?.trim()) missing.push('college roll')
  if (passwordRequired && !row.password) missing.push('password')
  if (!missing.length) return null
  return (
    <p className="text-xs mt-1" style={{ color: 'var(--danger-soft)' }}>
      Still need: {missing.join(', ')}.
    </p>
  )
}

// Default value factory the parent can call to seed the teamMembers
// state on first render of a node that requires a team. Mirrors the
// v1 behavior of pre-filling the editor with N rows where N =
// behavior.require_team.min, so a required team event doesn't open
// with zero member slots.
export function defaultTeamMembers(config: TeamMembersEditorProps['config']): TeamMemberDraft[] {
  if (!config.require_team) return []
  const passwordRequired = config.password_required !== false
  const min = config.optional ? 0 : (config.min ?? 1)
  return Array.from({ length: min }, () => blankDraft(passwordRequired))
}