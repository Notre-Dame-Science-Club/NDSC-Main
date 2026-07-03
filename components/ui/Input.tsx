import type { InputHTMLAttributes } from 'react'

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  className?: string
}

/**
 * Shared text input matching the inline-styled `<input>` repeated across
 * every admin form (dark bg, `var(--border)` border, focus ring to
 * `var(--blue)`). Works for any `type` (text, email, password, number, ...).
 */
export default function Input({ className = '', style, ...rest }: InputProps) {
  return (
    <input
      className={`w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors ${className}`}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border)',
        color: 'var(--white)',
        ...style,
      }}
      onFocus={(e) => {
        e.currentTarget.style.borderColor = 'var(--blue)'
      }}
      onBlur={(e) => {
        e.currentTarget.style.borderColor = 'var(--border)'
      }}
      {...rest}
    />
  )
}
