import type { ButtonHTMLAttributes, ReactNode } from 'react'

export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
export type ButtonSize = 'sm' | 'md' | 'lg'

export interface ButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'className'> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  children: ReactNode
  className?: string
}

const base =
  'inline-flex items-center justify-center gap-2 rounded-lg font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60'

const sizeCls: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs',
  md: 'px-4 py-2.5 text-sm',
  lg: 'px-5 py-3 text-base',
}

// Inline styles (not Tailwind classes) for the variant colors, since they're
// theme-variable-driven (var(--blue) etc.) rather than static Tailwind
// utilities — matches how every existing admin page does color.
const variantStyle: Record<ButtonVariant, React.CSSProperties> = {
  primary: { background: 'var(--blue)', color: '#000' },
  secondary: {
    background: 'rgba(255,255,255,0.06)',
    color: 'var(--white)',
    border: '1px solid var(--border)',
  },
  danger: { background: '#ff4757', color: '#fff' },
  ghost: { background: 'transparent', color: 'var(--muted)' },
}

/**
 * Shared button matching the visual language already used across
 * app/admin/*\/page.tsx (Orbitron-adjacent bold labels, CSS-variable-driven
 * colors, rounded-lg). Use `variant="danger"` for destructive actions like
 * delete, `variant="secondary"` for cancel/close.
 */
export default function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  disabled,
  children,
  className = '',
  style,
  ...rest
}: ButtonProps) {
  return (
    <button
      className={`${base} ${sizeCls[size]} ${className}`}
      style={{ ...variantStyle[variant], ...style }}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? 'Please wait…' : children}
    </button>
  )
}
