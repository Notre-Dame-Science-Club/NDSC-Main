import type { SelectHTMLAttributes } from 'react'

export interface SelectOption {
  value: string
  label: string
}

export type SelectProps = Omit<SelectHTMLAttributes<HTMLSelectElement>, 'className'> & {
  className?: string
  options: SelectOption[]
  placeholder?: string
}

/** Select sibling of Input.tsx — same visual language. */
export default function Select({ className = '', style, options, placeholder, ...rest }: SelectProps) {
  return (
    <select
      className={`w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors ${className}`}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border)',
        color: 'var(--white)',
        ...style,
      }}
      {...rest}
    >
      {placeholder && <option value="">{placeholder}</option>}
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>
          {opt.label}
        </option>
      ))}
    </select>
  )
}
