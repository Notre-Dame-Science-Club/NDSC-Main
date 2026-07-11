'use client'
import { useState, useRef, useCallback } from 'react'
import { Check, X as XIcon, StickyNote, Trash2, Save } from 'lucide-react'

export type Annotation = {
  id: string
  x: number // percentage 0-100, relative to image width
  y: number // percentage 0-100, relative to image height
  type: 'tick' | 'cross' | 'note'
  text?: string
}

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

const MARK_COLOR: Record<Annotation['type'], string> = {
  tick: '#00ff80',
  cross: '#ff4d4d',
  note: '#ffb347',
}

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
  const handleImageClick = (e: React.MouseEvent) => {
    if (readOnly || dragId) return
    const { x, y } = getPercentPos(e.clientX, e.clientY)
    const mark: Annotation = { id: uid(), x, y, type: tool }
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
    setAnnotations(prev => prev.map(a => a.id === dragId ? { ...a, x, y } : a))
  }, [dragId])

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragId) handlePointerMove(e.clientX, e.clientY)
  }
  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragId && e.touches[0]) {
      e.preventDefault()
      handlePointerMove(e.touches[0].clientX, e.touches[0].clientY)
    }
  }
  const endDrag = () => setDragId(null)

  const removeMark = (id: string) => setAnnotations(prev => prev.filter(a => a.id !== id))

  const openNoteEditor = (a: Annotation) => {
    if (readOnly) return
    setEditingNoteId(a.id)
    setNoteText(a.text || '')
  }
  const saveNoteText = () => {
    if (!editingNoteId) return
    setAnnotations(prev => prev.map(a => a.id === editingNoteId ? { ...a, text: noteText } : a))
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
  ]

  return (
    <div className="fixed inset-0 z-50 flex flex-col" style={{ background: 'rgba(2,8,16,0.96)' }}>
      {/* Header */}
      <div className="flex items-center justify-between gap-4 px-4 py-3 border-b flex-wrap"
        style={{ borderColor: '#0f2a4a', background: '#050d1a' }}>
        <h2 className="font-bold text-sm" style={{ color: '#00d4ff', fontFamily: 'Orbitron, monospace' }}>
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
            style={{ touchAction: dragId ? 'none' : 'auto' }}
            onClick={handleImageClick}
            onMouseMove={handleMouseMove}
            onMouseUp={endDrag}
            onMouseLeave={endDrag}
            onTouchMove={handleTouchMove}
            onTouchEnd={endDrag}
          >
            <img src={imageUrl} alt="Answer sheet" className="max-w-full block rounded-lg" draggable={false} />
            {annotations.map(a => (
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
                <p className="text-xs mb-2" style={{ color: '#3d5a78' }}>Tap the image to place a mark. Drag marks to reposition.</p>
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
                  <button onClick={saveNoteText} className="flex-1 py-1.5 rounded text-xs font-semibold" style={{ background: '#00d4ff', color: '#000' }}>Save note</button>
                  <button onClick={() => setEditingNoteId(null)} className="px-3 py-1.5 rounded text-xs" style={{ color: '#6a8faf' }}>Cancel</button>
                </div>
              </div>
            )}

            {/* List of placed notes for quick reference */}
            {annotations.some(a => a.type === 'note' && a.text) && (
              <div className="space-y-1.5">
                <p className="text-xs font-bold" style={{ color: '#6a8faf' }}>NOTES ON THIS SHEET</p>
                {annotations.filter(a => a.type === 'note' && a.text).map(a => (
                  <div key={a.id} className="flex items-start gap-2 p-2 rounded text-xs" style={{ background: '#0a1f35' }}>
                    <StickyNote size={12} className="mt-0.5 flex-shrink-0" style={{ color: '#ffb347' }} />
                    <span style={{ color: '#e0f0ff' }}>{a.text}</span>
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
                style={{ background: 'linear-gradient(90deg,#00d4ff,#0070ff)', color: '#fff' }}>
                <Save size={15} /> {saving ? 'Saving...' : 'Save & Score'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
