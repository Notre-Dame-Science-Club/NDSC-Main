'use client'
import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { segmentAuthHeaders } from '@/lib/clientAuthHeaders'
import { isNDCName } from '@/lib/college'
import { validateCollegeRoll } from '@/lib/validation'

/**
 * Small "enter / change your college roll" control, used by the dashboard's Secondary
 * Details card and by the prompt shown to Notre Dame College students who haven't added
 * their roll yet. It saves straight to /api/member-profile, which re-validates everything
 * (the checks here are only so people get instant feedback) and rejects a roll that already
 * belongs to another Notre Dame College account.
 */
export default function CollegeRollField({
  institution,
  initialValue,
  onSaved,
  onCancel,
  autoFocus,
  saveLabel = 'Save',
}: {
  institution?: string | null
  initialValue?: string | null
  /** Called with the saved roll once the server has accepted it. */
  onSaved: (roll: string) => void
  onCancel?: () => void
  autoFocus?: boolean
  saveLabel?: string
}) {
  const [value, setValue] = useState(initialValue ?? '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  // Same rule as lib/validation.ts: NDC rolls are exactly 8 digits; other colleges just digits.
  const ndc = !String(institution ?? '').trim() || isNDCName(institution)

  const save = async () => {
    const roll = value.trim()
    const problem = validateCollegeRoll(institution, roll)
    if (problem) { setError(problem); return }
    setSaving(true)
    setError('')
    try {
      const res = await fetch('/api/member-profile', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json', ...(await segmentAuthHeaders()) },
        body: JSON.stringify({ college_roll: roll }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(data.error || 'Could not save your roll. Please try again.')
      onSaved(roll)
    } catch (e: any) {
      setError(e.message || 'Something went wrong.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <div className="flex gap-2">
        <input
          value={value}
          onChange={e => { setValue(e.target.value.replace(/\D/g, '').slice(0, ndc ? 8 : 20)); if (error) setError('') }}
          onKeyDown={e => { if (e.key === 'Enter') save() }}
          inputMode="numeric"
          autoComplete="off"
          autoFocus={autoFocus}
          aria-label="College roll"
          aria-invalid={!!error}
          placeholder={ndc ? '8-digit roll, e.g. 24010123' : 'College roll'}
          className="flex-1 min-w-0 px-3 py-2 rounded-lg text-sm outline-none border"
          style={{ background: 'rgba(255,255,255,0.04)', borderColor: error ? 'var(--danger-soft)' : 'var(--border)', color: 'var(--white)', fontVariantNumeric: 'tabular-nums' }}
        />
        <button
          onClick={save}
          disabled={saving || !value.trim()}
          className="px-4 py-2 rounded-lg text-sm font-bold text-black disabled:opacity-50 flex items-center justify-center gap-1.5 flex-shrink-0"
          style={{ background: 'var(--blue)' }}
        >
          {saving ? <Loader2 size={14} className="animate-spin" /> : null}
          {saving ? 'Saving…' : saveLabel}
        </button>
        {onCancel && (
          <button onClick={onCancel} disabled={saving} className="px-3 py-2 rounded-lg text-sm flex-shrink-0" style={{ color: 'var(--muted)' }}>
            Cancel
          </button>
        )}
      </div>
      {error && <p role="alert" className="text-xs mt-2" style={{ color: 'var(--danger-soft)' }}>{error}</p>}
    </div>
  )
}
