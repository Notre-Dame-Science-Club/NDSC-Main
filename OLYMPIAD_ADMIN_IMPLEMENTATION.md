# Olympiad Admin Refactor Implementation

**Implementation Date:** 2026-09-24  
**Status:** Ready to implement

## Changes Required

### 1. Type Definition Update

In `app/admin/olympiads/page.tsx`, find the Olympiad type (around line 30) and add:

```typescript
  parent_activity_session_id?: string | null
```

After line 50 (`organizer_password?: string`).

### 2. State Additions

After line 90 (`const [linkInfo, setLinkInfo] = ...`), add:

```typescript
  // For the form graph and parent activity pickers
  const [formGraphs, setFormGraphs] = useState<{ id: string; title: string; owner_id: string }[]>([])
  const [activitySessions, setActivitySessions] = useState<{ id: string; title: string; slug: string }[]>([])
  const [attachedFormGraph, setAttachedFormGraph] = useState<{ id: string; title: string } | null>(null)
  const [creatingFormGraph, setCreatingFormGraph] = useState(false)
```

### 3. Load Function Enhancement

Replace the `load()` function (around line 99) with:

```typescript
  const load = async () => {
    setLoading(true)
    const res = await fetch('/api/admin/olympiads')
    if (res.ok) setOlympiads(await res.json() || [])
    else setPageError('Failed to load olympiads.')
    try {
      const linkRes = await fetch('/api/admin/online-categories')
      if (linkRes.ok) {
        const links = await linkRes.json()
        setLinkInfo(Object.fromEntries((links || []).map((l: any) => [l.olympiad_id, l])))
      }
    } catch { /* non-critical — falls back to treating everything as standalone */ }

    // Load form graphs and activity sessions for pickers
    try {
      const [graphsRes, sessionsRes] = await Promise.all([
        fetch('/api/admin/form-graphs').then(r => r.json()),
        fetch('/api/admin/activity-sessions').then(r => r.json()),
      ])
      if (graphsRes?.graphs) {
        setFormGraphs(graphsRes.graphs
          .filter((g: any) => g.owner_kind === 'olympiad')
          .map((g: any) => ({ id: g.id, title: g.title, owner_id: g.owner_id })))
      }
      if (Array.isArray(sessionsRes)) {
        setActivitySessions(sessionsRes.map((s: any) => ({ id: s.id, title: s.title, slug: s.slug })))
      }
    } catch { /* non-critical */ }

    setLoading(false)
  }
```

### 4. Add Form Graph Helpers

After the `load()` function, add these new functions:

```typescript
  // Load attached form graph when editing an olympiad
  const loadAttachedFormGraph = async (olympiadId: string) => {
    try {
      const res = await fetch('/api/admin/form-graphs')
      const data = await res.json()
      if (data?.graphs) {
        const attached = data.graphs.find((g: any) => 
          g.owner_kind === 'olympiad' && g.owner_id === olympiadId
        )
        setAttachedFormGraph(attached ? { id: attached.id, title: attached.title } : null)
      }
    } catch {
      setAttachedFormGraph(null)
    }
  }

  // Create a form graph for this olympiad
  const createFormGraph = async (olympiadId: string, olympiadName: string) => {
    setCreatingFormGraph(true)
    try {
      const res = await fetch('/api/admin/form-graphs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          owner_kind: 'olympiad',
          owner_id: olympiadId,
          title: `${olympiadName} Registration & Exam`,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || 'Failed to create form graph.')
      setAttachedFormGraph({ id: data.graph.id, title: data.graph.title })
      // Refresh form graphs list
      const graphsRes = await fetch('/api/admin/form-graphs').then(r => r.json())
      if (graphsRes?.graphs) {
        setFormGraphs(graphsRes.graphs
          .filter((g: any) => g.owner_kind === 'olympiad')
          .map((g: any) => ({ id: g.id, title: g.title, owner_id: g.owner_id })))
      }
    } catch (e: any) {
      alert(e.message || 'Failed to create form graph.')
    } finally {
      setCreatingFormGraph(false)
    }
  }

  // Detach (delete) the form graph for this olympiad
  const detachFormGraph = async (graphId: string) => {
    if (!confirm('Delete this form graph? All questions and fields will be permanently removed.')) return
    try {
      const res = await fetch(`/api/admin/form-graphs/${graphId}`, { method: 'DELETE' })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || 'Failed to delete.')
      }
      setAttachedFormGraph(null)
      // Refresh form graphs list
      const graphsRes = await fetch('/api/admin/form-graphs').then(r => r.json())
      if (graphsRes?.graphs) {
        setFormGraphs(graphsRes.graphs
          .filter((g: any) => g.owner_kind === 'olympiad')
          .map((g: any) => ({ id: g.id, title: g.title, owner_id: g.owner_id })))
      }
    } catch (e: any) {
      alert(e.message || 'Failed to delete form graph.')
    }
  }
```

### 5. Update Save Function

In the `save()` function (around line 201), add to the payload:

```typescript
      parent_activity_session_id: (editing as any).parent_activity_session_id || null,
```

After line 233 (`subject_assignment_mode: ...`).

### 6. Trigger Form Graph Load on Edit

Find where `setEditing(olympiad)` is called (in the olympiad list view), and add:

```typescript
if (olympiad.id) loadAttachedFormGraph(olympiad.id)
```

Right after setting editing state.

### 7. Add UI Section to Editing Modal

In the editing modal (around line 478, after the "BASIC INFO" section closes), add this new section:

```typescript
          {/* Form & Content Linking */}
          <div className="rounded-xl p-5 space-y-4" style={s}>
            <p className="text-xs font-bold tracking-widest" style={{ color: 'var(--blue)' }}>FORM & CONTENT LINKING</p>
            
            {/* Attached Form Graph */}
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>
                Registration & Exam Form
              </label>
              {attachedFormGraph ? (
                <div className="flex items-center gap-2 p-3 rounded-lg border" style={{ ...inputStyle, borderColor: 'rgba(var(--cat-teal-rgb), 0.3)' }}>
                  <Workflow size={14} style={{ color: 'var(--cat-teal)' }} />
                  <span className="flex-1 text-sm" style={{ color: 'var(--white)' }}>{attachedFormGraph.title}</span>
                  <Link href={`/admin/form-builder/${attachedFormGraph.id}`} target="_blank"
                    className="text-xs px-2 py-1 rounded" style={{ background: 'rgba(var(--blue-rgb), 0.12)', color: 'var(--blue)' }}>
                    Open →
                  </Link>
                  <button onClick={() => detachFormGraph(attachedFormGraph.id)}
                    className="text-xs px-2 py-1 rounded" style={{ color: 'var(--danger-soft)' }}>
                    Delete
                  </button>
                </div>
              ) : editing.id ? (
                <button onClick={() => createFormGraph(editing.id!, editing.name || 'Olympiad')}
                  disabled={creatingFormGraph}
                  className="w-full px-3 py-2 rounded-lg text-sm border flex items-center justify-center gap-2"
                  style={{ ...inputStyle, borderColor: 'rgba(var(--blue-rgb), 0.3)', color: 'var(--blue)' }}>
                  <Plus size={14} />
                  {creatingFormGraph ? 'Creating...' : 'Create Form Graph'}
                </button>
              ) : (
                <div className="px-3 py-2 rounded-lg text-xs border" style={{ ...inputStyle, opacity: 0.5 }}>
                  Save this olympiad first, then create its form graph
                </div>
              )}
              <p className="text-xs mt-1" style={{ color: 'var(--border-soft)' }}>
                The flowchart-style registration and exam form for this olympiad. Leave unattached for purely informational entries.
              </p>
            </div>

            {/* Parent Activity Picker */}
            <div>
              <label className="block text-xs mb-1" style={{ color: 'var(--muted)' }}>
                Parent Activity (for informational entries)
              </label>
              <select className={inputClass} style={inputStyle}
                value={(editing as any).parent_activity_session_id || ''}
                onChange={e => setEditing(p => ({ ...p, parent_activity_session_id: e.target.value || null }))}>
                <option value="">— No parent activity —</option>
                {activitySessions.map(a => (
                  <option key={a.id} value={a.id}>{a.title}</option>
                ))}
              </select>
              <p className="text-xs mt-1" style={{ color: 'var(--border-soft)' }}>
                When set, this olympiad appears on the /olympiad listing but shows "Register for [activity]" CTA instead of its own form.
              </p>
            </div>
          </div>
```

### 8. Import Additions

At the top of the file (around line 4), add `Workflow` and `Plus` to the lucide-react imports:

```typescript
import { Plus, Trash2, Edit2, ChevronDown, ChevronUp, Eye, EyeOff, X, Megaphone, ArrowRight, Image as ImageIcon, FileText, Clock, ClipboardList, Link2, Lightbulb, BookOpen, CheckCircle2, Download, Workflow } from 'lucide-react'
```

(Add `Plus` if not already there, `Workflow` is already imported per line 4 of current file).

## Testing After Implementation

1. **Create Olympiad** - Save basic info first
2. **Attach Form** - Click "Create Form Graph" button
3. **Edit Form** - Click "Open →" to access Form Builder
4. **Detach Form** - Click "Delete" and confirm
5. **Parent Activity** - Select an activity from dropdown
6. **Save** - Confirm `parent_activity_session_id` persists

## Files Modified

- `app/admin/olympiads/page.tsx` (main implementation)
- No database changes (form graphs use existing owner_kind/owner_id pattern)
- No API route changes needed

---

**Next:** Implement public `/olympiad` page CTA logic for `parent_activity_session_id`
