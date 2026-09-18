import type { ReactNode } from 'react'

export interface FieldProps {
  label: string
  htmlFor?: string
  required?: boolean
  error?: string | null
  children: ReactNode
}

/**
 * Label + control + optional error wrapper, matching the `<Field>` helper
 * duplicated locally in app/admin/activities/page.tsx and similar pages.
 * Wrap any input/select/textarea in this instead of hand-rolling a label.
 */
export default function Field({ label, htmlFor, required, error, children }: FieldProps) {
  return (
    <div className="mb-4">
      <label
        htmlFor={htmlFor}
        className="block text-xs mb-1.5 font-medium uppercase tracking-wider"
        style={{ color: 'var(--muted)' }}
      >
        {label}
        {required && <span style={{ color: '#ff4757' }}> *</span>}
      </label>
      {children}
      {error && (
        <p className="mt-1 text-xs" style={{ color: '#ff7070' }}>
          {error}
        </p>
      )}
    </div>
  )
}
