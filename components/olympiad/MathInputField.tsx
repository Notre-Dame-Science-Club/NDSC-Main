'use client'
import { useRef, useState } from 'react'
import { Sigma } from 'lucide-react'
import MathKeyboardPanel from './MathKeyboard'

type Props = {
  value: string
  onChange: (v: string) => void
  multiline?: boolean
  rows?: number
  placeholder?: string
  className?: string
  style?: React.CSSProperties
}

// A drop-in replacement for a plain <input>/<textarea> that adds a small
// "Σ" button on the right which opens a Desmos-style equation keyboard.
// Symbols are inserted at the current cursor position.
export default function MathInputField({ value, onChange, multiline, rows = 2, placeholder, className, style }: Props) {
  const ref = useRef<HTMLTextAreaElement | HTMLInputElement | null>(null)
  const [open, setOpen] = useState(false)

  const insert = (snippet: string, back = 0) => {
    const el = ref.current
    const start = el?.selectionStart ?? value.length
    const end = el?.selectionEnd ?? value.length
    const next = value.slice(0, start) + snippet + value.slice(end)
    onChange(next)
    requestAnimationFrame(() => {
      if (!el) return
      const pos = start + snippet.length - back
      el.focus()
      el.setSelectionRange(pos, pos)
    })
  }

  return (
    <div className="relative">
      <div className="flex gap-1.5 items-start">
        {multiline ? (
          <textarea
            ref={ref as React.RefObject<HTMLTextAreaElement>}
            rows={rows}
            className={className}
            style={style}
            value={value}
            placeholder={placeholder}
            onChange={e => onChange(e.target.value)}
          />
        ) : (
          <input
            ref={ref as React.RefObject<HTMLInputElement>}
            className={className}
            style={style}
            value={value}
            placeholder={placeholder}
            onChange={e => onChange(e.target.value)}
          />
        )}
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          title="Insert equation / math symbol"
          className="flex-shrink-0 w-8 h-8 rounded-lg flex items-center justify-center border"
          style={{
            background: open ? 'rgba(var(--blue-rgb), 0.2)' : 'rgba(var(--blue-rgb), 0.08)',
            borderColor: 'rgba(var(--blue-rgb), 0.3)',
            color: 'var(--blue)',
          }}
        >
          <Sigma size={14} />
        </button>
      </div>
      {open && (
        <MathKeyboardPanel
          onInsert={(snippet, back) => insert(snippet, back)}
          onClose={() => setOpen(false)}
        />
      )}
    </div>
  )
}
