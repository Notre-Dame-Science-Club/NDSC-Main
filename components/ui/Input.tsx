import type { InputHTMLAttributes } from 'react'

export type InputProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  className?: string
}

/**
 * Shared text input matching the inline-styled `<input>` repeated across
 * every admin form (dark bg, `var(--border)` border, focus ring to
 * `var(--blue)`). Works for any `type` (text, email, password, number, ...).
 *
 * Focus state is now driven by CSS `:focus-visible` rather than a JS handler —
 * the previous version added focus listeners on every input which forced a
 * full re-render-style reflow on focus, and never reverted on unmount if the
 * field was still focused when removed.
 */
export default function Input({ className = '', style, ...rest }: InputProps) {
  return (
    <input
      className={`ndsc-input w-full rounded-lg px-3 py-2 text-sm outline-none transition-colors ${className}`}
      style={{
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid var(--border)',
        color: 'var(--white)',
        ...style,
      }}
      {...rest}
    />
  )
}
