'use client'
import { useEffect, useState } from 'react'
import { Plus, Trash2 } from 'lucide-react'

// Editor for the `form_contact_persons` field on activity_session_form_appearance
// (and `contact_persons` on form_configs). The stored shape is either:
//   - a plain array of manual entries: [{ name, post, phone, email, whatsapp, facebook }]
//   - { use_ec_page: true, ec_ids: [...] }  (pulled from the Executive Committee page)
//
// Reused by:
//   - app/admin/forms/page.tsx                     (global form configs)
//   - app/admin/activity-registration/[sessionId]  (per-session appearance)
//
// The EC members list is fetched once on mount; if the admin has "use EC page"
// checked, contacts are read from the EC list, filtered to ec_ids.

export type FormContactPerson = { name: string; post: string; phone: string; email: string; whatsapp: string; facebook: string }
type EcMember = { id: string; full_name: string; position: string; email?: string | null; whatsapp?: string | null; facebook_url?: string | null }

export const BLANK_CONTACT = (): FormContactPerson => ({ name: '', post: '', phone: '', email: '', whatsapp: '', facebook: '' })

const inputCls = 'w-full px-3 py-2 rounded-lg text-sm outline-none border'
const inputStyle = { background: 'var(--surface)', borderColor: 'var(--border)', color: 'var(--white)' }

// `value` is the raw union shape stored in the DB. `onChange` receives the
// new value in the same shape. `id` is an optional DOM id for accessibility.
export default function ContactPersonsEditor({
  value,
  onChange,
  idPrefix = 'cp',
}: {
  value: FormContactPerson[] | { use_ec_page?: boolean; ec_ids?: string[] }
  onChange: (next: FormContactPerson[] | { use_ec_page: true; ec_ids: string[] }) => void
  idPrefix?: string
}) {
  const useEc = !Array.isArray(value) && (value as any)?.use_ec_page === true
  const ecIds: string[] = !Array.isArray(value) && Array.isArray((value as any)?.ec_ids) ? (value as any).ec_ids : []
  const manual: FormContactPerson[] = Array.isArray(value) ? value : []

  const [ecMembers, setEcMembers] = useState<EcMember[]>([])
  useEffect(() => {
    fetch('/api/executives').then(r => r.json()).then(d => setEcMembers(Array.isArray(d) ? d : [])).catch(() => {})
  }, [])

  const toggleUseEc = (checked: boolean) => {
    if (checked) onChange({ use_ec_page: true, ec_ids: ecIds })
    else onChange(manual)
  }

  const toggleEcId = (ecId: string, checked: boolean) => {
    const next = checked ? [...ecIds, ecId] : ecIds.filter(id => id !== ecId)
    onChange({ use_ec_page: true, ec_ids: next })
  }

  const updateManual = (idx: number, patch: Partial<FormContactPerson>) => {
    const next = manual.map((c, i) => i === idx ? { ...c, ...patch } : c)
    onChange(next)
  }
  const addManual = () => onChange([...manual, BLANK_CONTACT()])
  const removeManual = (idx: number) => onChange(manual.filter((_, i) => i !== idx))

  return (
    <div>
      <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer" style={{ color: 'var(--blue)' }}>
        <input type="checkbox" checked={useEc} onChange={e => toggleUseEc(e.target.checked)} />
        Pull contacts from the EC page instead of typing manually
      </label>

      {useEc ? (
        <div className="space-y-2">
          {ecMembers.length === 0 ? (
            <p className="text-xs" style={{ color: 'var(--border-soft)' }}>No EC members found yet — add them on the Executives admin page first.</p>
          ) : ecMembers.map(ec => {
            const isSelected = ecIds.includes(ec.id)
            return (
              <label key={ec.id} className="flex items-center gap-2 p-2.5 rounded-lg text-sm cursor-pointer"
                style={{ background: isSelected ? 'rgba(var(--blue-rgb), 0.08)' : 'var(--bg2)', border: `1px solid ${isSelected ? 'rgba(var(--blue-rgb), 0.3)' : 'var(--border)'}` }}>
                <input type="checkbox" checked={isSelected} onChange={e => toggleEcId(ec.id, e.target.checked)} />
                <span style={{ color: 'var(--white)' }}>{ec.full_name}</span>
                <span className="text-xs" style={{ color: 'var(--muted)' }}>— {ec.position}</span>
              </label>
            )
          })}
        </div>
      ) : (
        <>
          {manual.map((cp, idx) => (
            <div key={idx} className="p-3 rounded-lg mb-2 space-y-2" style={{ background: 'var(--bg2)', border: '1px solid var(--border)' }}>
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs font-semibold" style={{ color: 'var(--muted)' }}>Contact {idx + 1}</span>
                <button type="button" onClick={() => removeManual(idx)} style={{ color: 'var(--danger-soft)' }}><Trash2 size={13} /></button>
              </div>
              <div className="grid grid-cols-2 gap-2">
                {(['name','post','phone','email','whatsapp','facebook'] as const).map(field => (
                  <input key={field} id={`${idPrefix}-${idx}-${field}`}
                    placeholder={field.charAt(0).toUpperCase() + field.slice(1)}
                    value={cp[field]} onChange={e => updateManual(idx, { [field]: e.target.value })}
                    className={inputCls} style={inputStyle} />
                ))}
              </div>
            </div>
          ))}
          <button type="button" onClick={addManual}
            className="text-xs px-3 py-1.5 rounded flex items-center gap-1"
            style={{ background: 'rgba(var(--blue-rgb), 0.1)', color: 'var(--blue)' }}>
            <Plus size={11} /> Add contact person
          </button>
        </>
      )}
    </div>
  )
}
