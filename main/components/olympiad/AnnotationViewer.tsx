'use client'
import { useState, useRef, useCallback } from 'react'
import { Check, X as XIcon, StickyNote, Trash2, Save, Pencil, Undo2 } from 'lucide-react'

// A point on the sheet — either a stationary click-to-place mark (tick,
// cross, note) at a single x/y, or a freehand pen stroke made of many
// x/y points traced while the mouse/finger was held down. Discriminated
// on `type`, so callers can narrow with `a.type === 'pen'`.
export type PointAnnotation = {
  id: string
  x: number // percentage 0-100, relative to image width
  y: number // percentage 0-100, relative to image height
  type: 'tick' | 'cross' | 'note'
  text?: string
}

export type PenAnnotation = {
  id: string
  type: 'pen'
  points: { x: number; y: number }[] // percentages, one per point traced
  color: string
  strokeWidth: number // screen pixels — kept constant regardless of image zoom via vector-effect
}

export type Annotation = PointAnnotation | PenAnnotation

type Props = {
  imageUrl: string
  initialAnnotations?: Annotation[]
  initialScore?: number | string
  initialNote?: string
  maxScore?: number
  readOnly?: boolean
  onClose: () => void
  onSave?: (data: { score: number; annotations: Annotation[]; organizerNote: string }) => Promise<void> | void
}

const uid = () => Math.random().toString(36).slice(2, 9)

const MARK_COLOR: Record<'tick' | 'cross' | 'note' | 'pen', string> = {
  tick: '#00ff80',
  cross: '#ff4d4d',
  note: '#ffb347',
  pen: '#4da6ff',
}

const PEN_COLORS = ['#ff4d4d', '#00ff80', '#ffb347', '#4da6ff', '#ffffff']
const PEN_WIDTHS = [
  { label: 'Thin', value: 2 },
  { label: 'Medium', value: 4 },
  { label: 'Thick', value: 7 },
]

export default function AnnotationViewer({
  imageUrl,
  initialAnnotations = [],
  initialScore = '',
  initialNote = '',
  maxScore,
  readOnly = false,
  onClose,
  onSave,
}: Props) {
  const [annotations, setAnnotations] = useState<Annotation[]>(initialAnnotations)
  const [tool, setTool] = useState<Annotation['type']>('tick')
  const [score, setScore] = useState(String(initialScore ?? ''))
  const [organizerNote, setOrganizerNote] = useState(initialNote)
  const [editingNoteId, setEditingNoteId] = useState<string | null>(null)
  const [noteText, setNoteText] = useState('')
  const [saving, setSaving] = useState(false)
  const [dragId, setDragId] = useState<string | null>(null)
  const imgWrapRef = useRef<HTMLDivElement>(null)

  // ── Pen tool state ─────────────────────────────────────────────────────
  // `currentStroke` mirrors `currentStrokeRef` and exists purely so the
  // in-progress line renders live while the organizer is still drawing it;
  // the ref is what handlers read/write synchronously (state updates from
  // rapid pointermove events would otherwise lag a frame behind).
  const [penColor, setPenColor] = useState(PEN_COLORS[0])
  const [penWidth, setPenWidth] = useState(PEN_WIDTHS[1].value)
  const [isPenDown, setIsPenDown] = useState(false)
  const [currentStroke, setCurrentStroke] = useState<{ x: number; y: number }[]>([])
  const currentStrokeRef = useRef<{ x: number; y: number }[]>([])

  // Converts a pointer event's page coordinates into a 0-100 percentage
  // position relative to the image container, regardless of how the image
  // has been scaled to fit the viewer — this is what makes marks stay put
  // correctly on any screen size.
  const getPercentPos = (clientX: number, clientY: number) => {
    const rect = imgWrapRef.current?.getBoundingClientRect()
    if (!rect) return { x: 50, y: 50 }
    const x = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
    const y = Math.min(100, Math.max(0, ((clientY - rect.top) / rect.height) * 100))
    return { x, y }
  }

  // Placing a new mark — clicking/tapping anywhere on the image (when not
  // dragging an existing mark) drops a new mark of the currently selected type.
  // The pen tool is drag-based, not click-based, so it's excluded here —
  // see startPenStroke/extendPenStroke/finishPenStroke below.
  const handleImageClick = (e: React.MouseEvent) => {
    if (readOnly || dragId || tool === 'pen') return
    const { x, y } = getPercentPos(e.clientX, e.clientY)
    const mark: Annotation = { id: uid(), x, y, type: tool as 'tick' | 'cross' | 'note' }
    setAnnotations(prev => [...prev, mark])
    if (tool === 'note') {
      setEditingNoteId(mark.id)
      setNoteText('')
    }
  }

  // Dragging an existing mark — works identically for mouse and touch since
  // both report clientX/clientY on their respective move events.
  const startDrag = (id: string) => (e: React.MouseEvent | React.TouchEvent) => {
    if (readOnly) return
    e.stopPropagation()
    setDragId(id)
  }

  const handlePointerMove = useCallback((clientX: number, clientY: number) => {
    if (!dragId) return
    const { x, y } = getPercentPos(clientX, clientY)
    setAnnotations(prev => prev.map(a => a.id === dragId && a.type !== 'pen' ? { ...a, x, y } : a))
  }, [dragId])

  // ── Pen stroke lifecycle ──────────────────────────────────────────────
  const startPenStroke = (x: number, y: number) => {
    currentStrokeRef.current = [{ x, y }]
    setCurrentStroke(currentStrokeRef.current)
    setIsPenDown(true)
  }
  const extendPenStroke = (x: number, y: number) => {
    currentStrokeRef.current = [...currentStrokeRef.current, { x, y }]
    setCurrentStroke(currentStrokeRef.current)
  }
  const finishPenStroke = () => {
    if (currentStrokeRef.current.length >= 2) {
      const stroke: Annotation = {
        id: uid(), type: 'pen', points: currentStrokeRef.current, color: penColor, strokeWidth: penWidth,
      }
      setAnnotations(prev => [...prev, stroke])
    }
    currentStrokeRef.current = []
    setCurrentStroke([])
    setIsPenDown(false)
  }
  const undoLastStroke = () => {
    setAnnotations(prev => {
      const idx = [...prev].reverse().findIndex(a => a.type === 'pen')
      if (idx === -1) return prev
      const removeAt = prev.length - 1 - idx
      return prev.filter((_, i) => i !== removeAt)
    })
  }

  const handleMouseDown = (e: React.MouseEvent) => {
    if (readOnly || tool !== 'pen') return
    const { x, y } = getPercentPos(e.clientX, e.clientY)
    startPenStroke(x, y)
  }
  const handleTouchStart = (e: React.TouchEvent) => {
    if (readOnly || tool !== 'pen' || !e.touches[0]) return
    e.preventDefault()
    const { x, y } = getPercentPos(e.touches[0].clientX, e.touches[0].clientY)
    startPenStroke(x, y)
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (isPenDown) {
      const { x, y } = getPercentPos(e.clientX, e.clientY)
      extendPenStroke(x, y)
      return
    }
    if (dragId) handlePointerMove(e.clientX, e.clientY)
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (!e.touches[0]) return
    if (isPenDown) {
      e.preventDefault()
      const { x, y } = getPercentPos(e.touches[0].clientX, e.touches[0].clientY)
      extendPenStroke(x, y)
      return
    }
    if (dragId) {
      e.preventDefault()
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)
    }
  }
  const endDrag = () => setDragId(null)
  // Mouse-up / touch-end / mouse-leave all need to either finish a pen
  // stroke or release a dragged mark, whichever is in progress.
  const handlePointerUp = () => {
    if (isPenDown) { finishPenStroke(); return }
    endDrag()
  }

  const removeMark = (id: string) => setAnnotations(prev => prev.filter(a => a.id !== id))

  const openNoteEditor = (a: PointAnnotation) => {
    if (readOnly) return
    setEditingNoteId(a.id)
    setNoteText(a.text || '')
  }
  const saveNoteText = () => {
    if (!editingNoteId) return
    setAnnotations(prev => prev.map(a => a.id === editingNoteId && a.type !== 'pen' ? { ...a, text: noteText } : a))
    setEditingNoteId(null)
  }

  const handleSave = async () => {
    if (!onSave) return
    const numScore = Number(score)
    if (score !== '' && Number.isNaN(numScore)) return
    setSaving(true)
    try {
      await onSave({ score: numScore, annotations, organizerNote })
      onClose()
    } finally {
      setSaving(false)
    }
  }

  const tools: { key: Annotation['type']; label: string; icon: any }[] = [
    { key: 'tick', label: 'Tick', icon: Check },
    { key: 'cross', label: 'Cross', icon: XIcon },
    { key: 'note', label: 'Note', icon: StickyNote },
    { key: 'pen', label: 'Pen', icon: Pencil },
  ]

  const pointMarks = annotations.filter((a): a is PointAnnotation => a.type !== 'pen')
  const penStrokes = annotations.filter((a): a is PenAnnotation => a.type === 'pen')

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(2,8,16,0.96)' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b flex-wrap"
        style={{ borderColor: '#0f2a4a', background: '#050d1a' }}>
        <h2 className="font-bold text-sm" style={{ color: 'var(--blue)', fontFamily: 'inherit' }}>
          {readOnly ? 'Answer Sheet' : 'Mark Answer Sheet'}
        </h2>
        <button onClick={onClose} className="px-3 py-1.5 rounded-lg text-xs border"
          style={{ borderColor: '#0f2a4a', color: '#6a8faf' }}>
          <span className="inline-flex items-center gap-1.5">Close <XIcon size={14} /></span>
        </button>
      </div>

      <div className="flex-1 flex flex-col lg:flex-row overflow-hidden">
        {/* Image + marking surface */}
        <div className="flex-1 overflow-auto p-4 flex items-start justify-center" style={{ background: '#01060c' }}>
          <div
            ref={imgWrapRef}
            className="relative inline-block select-none"
            style={{ touchAction: (dragId || isPenDown) ? 'none' : 'auto', cursor: !readOnly && tool === 'pen' ? 'crosshair' : undefined }}
            onClick={handleImageClick}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handlePointerUp}
            onMouseLeave={handlePointerUp}
            onTouchStart={handleTouchStart}
            onTouchMove={handleTouchMove}
            onTouchEnd={handlePointerUp}
          >
            <img src={imageUrl} alt="Answer sheet" className="max-w-full block rounded-lg" draggable={false} />

            {/* Pen strokes — a single SVG overlay, coordinates as percentages
                (0-100 viewBox) so they track the image at any render size.
                vector-effect keeps stroke width in true screen pixels rather
                than being squashed/stretched by the viewBox scale. Sits above
                the image but below the point marks so ticks/crosses/notes
                stay legible even if a stroke passes under them. */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none" viewBox="0 0 100 100" preserveAspectRatio="none">
              {penStrokes.map(a => (
                <polyline key={a.id}
                  points={a.points.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none" stroke={a.color} strokeWidth={a.strokeWidth}
                  strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              ))}
              {isPenDown && currentStroke.length > 1 && (
                <polyline
                  points={currentStroke.map(p => `${p.x},${p.y}`).join(' ')}
                  fill="none" stroke={penColor} strokeWidth={penWidth} opacity={0.9}
                  strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
              )}
            </svg>

            {pointMarks.map(a => (
              <div key={a.id}
                onMouseDown={startDrag(a.id)}
                onTouchStart={startDrag(a.id)}
                onClick={e => { e.stopPropagation(); if (a.type === 'note') openNoteEditor(a) }}
                className="absolute flex items-center justify-center rounded-full font-black shadow-lg"
                style={{
                  left: `${a.x}%`, top: `${a.y}%`,
                  width: 30, height: 30, marginLeft: -15, marginTop: -15,
                  background: MARK_COLOR[a.type],
                  color: '#001018',
                  cursor: readOnly ? 'default' : 'grab',
                  border: '2px solid rgba(0,0,0,0.4)',
                  fontSize: 16,
                  zIndex: editingNoteId === a.id ? 20 : 10,
                }}
                title={a.text || ''}
              >
                {a.type === 'tick' ? <Check size={16} strokeWidth={3} /> : a.type === 'cross' ? <XIcon size={16} strokeWidth={3} /> : <StickyNote size={14} />}
                {!readOnly && (
                  <button
                    onClick={e => { e.stopPropagation(); removeMark(a.id) }}
                    className="absolute -top-2 -right-2 w-4 h-4 rounded-full flex items-center justify-center"
                    style={{ background: '#ff4d4d', color: '#fff' }}
                  ><XIcon size={9} strokeWidth={3} /></button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Side panel: tools, note editor, score, save */}
        <div className="w-full lg:w-80 flex-shrink-0 border-t lg:border-t-0 lg:border-l overflow-y-auto"
          style={{ borderColor: '#0f2a4a', background: '#050d1a' }}>
          <div className="p-4 space-y-4">
            {!readOnly && (
              <div>
                <p className="text-xs font-bold mb-2" style={{ color: '#6a8faf' }}>MARKING TOOL</p>
                <p className="text-xs mb-2" style={{ color: '#3d5a78' }}>
                  Tap the image to place a mark. Drag marks to reposition. Select Pen and drag across the image to draw freehand.
                </p>
                <div className="flex gap-2">
                  {tools.map(t => (
                    <button key={t.key} onClick={() => setTool(t.key)}
                      className="flex-1 flex flex-col items-center gap-1 py-2.5 rounded-lg text-xs font-semibold border"
                      style={{
                        borderColor: tool === t.key ? MARK_COLOR[t.key] : '#0f2a4a',
                        color: tool === t.key ? MARK_COLOR[t.key] : '#6a8faf',
                        background: tool === t.key ? `${MARK_COLOR[t.key]}18` : 'transparent',
                      }}>
                      <t.icon size={16} /> {t.label}
                    </button>
                  ))}
                </div>

                {/* Pen controls — color + stroke width, only relevant while the pen is selected */}
                {tool === 'pen' && (
                  <div className="mt-3 p-3 rounded-lg space-y-3" style={{ background: '#0a1f35', border: '1px solid #4da6ff33' }}>
                    <div>
                      <p className="text-xs font-bold mb-1.5" style={{ color: '#6a8faf' }}>Ink color</p>
                      <div className="flex gap-2">
                        {PEN_COLORS.map(c => (
                          <button key={c} onClick={() => setPenColor(c)} aria-label={`Pen color ${c}`}
                            className="w-7 h-7 rounded-full flex-shrink-0"
                            style={{
                              background: c,
                              border: penColor === c ? '2px solid #fff' : '2px solid rgba(255,255,255,0.15)',
                              boxShadow: penColor === c ? '0 0 0 2px #4da6ff' : 'none',
                            }} />
                        ))}
                      </div>
                    </div>
                    <div>
                      <p className="text-xs font-bold mb-1.5" style={{ color: '#6a8faf' }}>Stroke width</p>
                      <div className="flex gap-2">
                        {PEN_WIDTHS.map(w => (
                          <button key={w.value} onClick={() => setPenWidth(w.value)}
                            className="flex-1 py-1.5 rounded-lg text-xs font-semibold border"
                            style={{
                              borderColor: penWidth === w.value ? '#4da6ff' : '#0f2a4a',
                              color: penWidth === w.value ? '#4da6ff' : '#6a8faf',
                              background: penWidth === w.value ? '#4da6ff18' : 'transparent',
                            }}>
                            {w.label}
                          </button>
                        ))}
                      </div>
                    </div>
                    <button onClick={undoLastStroke} disabled={penStrokes.length === 0}
                      className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded-lg text-xs font-semibold border disabled:opacity-40"
                      style={{ borderColor: '#0f2a4a', color: '#6a8faf' }}>
                      <Undo2 size={12} /> Undo last stroke
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* Inline note editor for the mark currently being annotated */}
            {editingNoteId && !readOnly && (
              <div className="p-3 rounded-lg" style={{ background: '#0a1f35', border: '1px solid #ffb34744' }}>
                <p className="text-xs font-bold mb-2" style={{ color: '#ffb347' }}>Note for this mark</p>
                <textarea rows={3} autoFocus value={noteText} onChange={e => setNoteText(e.target.value)}
                  className="w-full px-2 py-1.5 rounded text-xs outline-none border resize-none mb-2"
                  style={{ background: '#030a12', borderColor: '#0f2a4a', color: '#e0f0ff' }}
                  placeholder="What's wrong / right here?" />
                <div className="flex gap-2">
                  <button onClick={saveNoteText} className="flex-1 py-1.5 rounded text-xs font-semibold" style={{ background: 'var(--blue)', color: '#000' }}>Save note</button>
                  <button onClick={() => setEditingNoteId(null)} className="px-3 py-1.5 rounded text-xs" style={{ color: '#6a8faf' }}>Cancel</button>
                </div>
              </div>
            )}

            {/* List of placed notes for quick reference */}
            {annotations.some(a => a.type === 'note' && a.text) && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold" style={{ color: '#6a8faf' }}>NOTES ON THIS SHEET</p>
                {pointMarks.filter(a => a.type === 'note' && a.text).map(a => (
                  <div key={a.id} className="flex items-start gap-2 p-2 rounded text-xs" style={{ background: '#0a1f35' }}>
                    <StickyNote size={12} className="mt-0.5 flex-shrink-0" style={{ color: '#ffb347' }} />
                    <span style={{ color: '#e0f0ff' }}>{a.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* List of pen strokes for quick reference / individual removal —
                a long freehand line is hard to click precisely, so deletion
                lives here rather than as a tiny floating button on the image. */}
            {penStrokes.length > 0 && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold" style={{ color: '#6a8faf' }}>PEN STROKES</p>
                {penStrokes.map((a, i) => (
                  <div key={a.id} className="flex items-center gap-2 p-2 rounded text-xs" style={{ background: '#0a1f35' }}>
                    <span className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: a.color, border: '1px solid rgba(255,255,255,0.3)' }} />
                    <span style={{ color: '#e0f0ff', flex: 1 }}>Stroke {i + 1} · {a.points.length} pts</span>
                    {!readOnly && (
                      <button onClick={() => removeMark(a.id)} aria-label="Delete stroke" style={{ color: '#ff7070' }}>
                        <Trash2 size={13} />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}

            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: '#6a8faf' }}>
                Score {maxScore != null ? `(out of ${maxScore})` : ''}
              </label>
              <input type="number" disabled={readOnly} value={score} onChange={e => setScore(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none border"
                style={{ background: '#0a1f35', borderColor: '#0f2a4a', color: '#e0f0ff' }}
                placeholder="Enter score" />
            </div>

            <div>
              <label className="block text-xs font-bold mb-1" style={{ color: '#6a8faf' }}>Overall response</label>
              <textarea rows={4} disabled={readOnly} value={organizerNote} onChange={e => setOrganizerNote(e.target.value)}
                className="w-full px-3 py-2 rounded-lg text-sm outline-none border resize-none"
                style={{ background: '#0a1f35', borderColor: '#0f2a4a', color: '#e0f0ff' }}
                placeholder="Write a general comment about this answer sheet..." />
            </div>

            {!readOnly && onSave && (
              <button onClick={handleSave} disabled={saving}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-bold text-sm disabled:opacity-50"
                style={{ background: 'linear-gradient(90deg,var(--blue),#0070ff)', color: '#fff' }}>
                <Save size={15} /> {saving ? 'Saving...' : 'Save & Score'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
