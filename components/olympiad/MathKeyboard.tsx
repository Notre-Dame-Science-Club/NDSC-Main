'use client'
import { X } from 'lucide-react'

// Each symbol either inserts plain unicode (renders everywhere, no math
// engine needed) or a LaTeX snippet wrapped in $...$ (rendered live by
// <MathText> wherever the question/description/option is shown). `back`
// is how many characters to step the cursor back from the end of the
// inserted snippet — used to land inside {} placeholders.
type Sym = { label: string; insert: string; back?: number; title?: string }
type Category = { label: string; symbols: Sym[] }

export const MATH_CATEGORIES: Category[] = [
  {
    label: 'Basic',
    symbols: [
      { label: '√', insert: '$\\sqrt{}$', back: 2, title: 'Square root' },
      { label: 'xⁿ', insert: '$x^{}$', back: 2, title: 'Exponent' },
      { label: 'xₙ', insert: '$x_{}$', back: 2, title: 'Subscript' },
      { label: 'a⁄b', insert: '$\\frac{}{}$', back: 4, title: 'Fraction' },
      { label: '×', insert: '×' },
      { label: '÷', insert: '÷' },
      { label: '±', insert: '±' },
      { label: '·', insert: '·' },
      { label: '≠', insert: '≠' },
      { label: '≤', insert: '≤' },
      { label: '≥', insert: '≥' },
      { label: '≈', insert: '≈' },
      { label: '∞', insert: '∞' },
      { label: 'π', insert: 'π' },
      { label: '°', insert: '°' },
      { label: '|x|', insert: '$|x|$', back: 2, title: 'Absolute value' },
    ],
  },
  {
    label: 'Greek',
    symbols: ['α', 'β', 'γ', 'δ', 'ε', 'θ', 'λ', 'μ', 'ρ', 'σ', 'φ', 'ψ', 'ω', 'Δ', 'Σ', 'Ω'].map(g => ({ label: g, insert: g })),
  },
  {
    label: 'Calculus',
    symbols: [
      { label: '∫', insert: '$\\int_{}^{}$', back: 5, title: 'Integral' },
      { label: '∑', insert: '$\\sum_{}^{}$', back: 5, title: 'Summation' },
      { label: '∏', insert: '$\\prod_{}^{}$', back: 5, title: 'Product' },
      { label: 'lim', insert: '$\\lim_{x \\to }$', back: 2, title: 'Limit' },
      { label: 'd⁄dx', insert: '$\\frac{d}{dx}$', title: 'Derivative' },
      { label: '∂', insert: '∂' },
      { label: '∇', insert: '∇' },
      { label: 'vec', insert: '$\\vec{}$', back: 2, title: 'Vector' },
      { label: '→', insert: '→' },
      { label: '∈', insert: '∈' },
      { label: '∉', insert: '∉' },
      { label: '⊂', insert: '⊂' },
      { label: '∪', insert: '∪' },
      { label: '∩', insert: '∩' },
      { label: '∅', insert: '∅' },
    ],
  },
  {
    label: 'Sets & Logic',
    symbols: [
      { label: '∀', insert: '∀' },
      { label: '∃', insert: '∃' },
      { label: '¬', insert: '¬' },
      { label: '∧', insert: '∧' },
      { label: '∨', insert: '∨' },
      { label: '⇒', insert: '⇒' },
      { label: '⇔', insert: '⇔' },
      { label: 'ℝ', insert: 'ℝ' },
      { label: 'ℕ', insert: 'ℕ' },
      { label: 'ℤ', insert: 'ℤ' },
      { label: 'ℚ', insert: 'ℚ' },
      { label: '√[n]', insert: '$\\sqrt[n]{}$', back: 2, title: 'nth root' },
    ],
  },
]

export default function MathKeyboardPanel({ onInsert, onClose }: { onInsert: (snippet: string, back?: number) => void; onClose: () => void }) {
  return (
    <div
      className="absolute right-0 top-full mt-1.5 z-30 w-72 rounded-xl border p-3 shadow-xl"
      style={{ background: 'var(--surface-deep)', borderColor: 'var(--border)' }}
      onMouseDown={e => e.stopPropagation()}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-[11px] font-bold tracking-wide" style={{ color: 'var(--blue)' }}>EQUATION KEYBOARD</p>
        <button type="button" onClick={onClose} style={{ color: 'var(--border-soft)' }}><X size={13} /></button>
      </div>
      <div className="space-y-2.5 max-h-64 overflow-y-auto pr-0.5">
        {MATH_CATEGORIES.map(cat => (
          <div key={cat.label}>
            <p className="text-[10px] mb-1" style={{ color: 'var(--border-soft)' }}>{cat.label}</p>
            <div className="grid grid-cols-8 gap-1">
              {cat.symbols.map(sym => (
                <button
                  key={sym.label}
                  type="button"
                  title={sym.title || sym.label}
                  onClick={() => onInsert(sym.insert, sym.back)}
                  className="h-7 rounded text-xs flex items-center justify-center hover:brightness-125 transition"
                  style={{ background: 'var(--surface-alt)', border: '1px solid var(--border)', color: 'var(--white-soft)' }}
                >
                  {sym.label}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
      <p className="text-[10px] mt-2 pt-2 border-t" style={{ color: 'var(--border-soft)', borderColor: 'var(--border)' }}>
        Tip: wrap any custom LaTeX yourself with <code>$...$</code>, e.g. <code>{'$x^2+1$'}</code>.
      </p>
    </div>
  )
}
