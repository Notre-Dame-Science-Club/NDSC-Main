# NDSC — Shared Infrastructure

This document describes the shared, reusable infrastructure added to the
codebase for the refactor. It is a **reference for consuming these exports**,
not a tutorial — read the doc comment in the source file for the "why" behind
any given design choice; this file is the "what" (exact names/signatures).

Nothing described here changes any existing page or API route's behavior.
Everything below is new, and adopting it in existing code is a separate,
later task.

**Addendum:** `Card`, `Table`, `EmptyState`, `ErrorMessage` (§7), the
`FormField` alias for `Field`, the `lg` Button size, and the
`requireAdmin`/`requireOrganizer`/`getMemberSession`/`ok`/`fail` naming
aliases (§4, §5) were added after the initial pass to close gaps against
the original task spec's exact file/export list. They're additive — nothing
pre-existing was renamed or removed.

---

## Table of contents

1. [tailwind.config.ts — new color tokens](#1-tailwindconfigts--new-color-tokens)
2. [lib/theme.ts — theme tokens & dark/light helpers](#2-libthemets--theme-tokens--darklight-helpers)
3. [types/ — shared TypeScript types](#3-types--shared-typescript-types)
4. [lib/auth.ts — server-side auth helpers](#4-libauthts--server-side-auth-helpers)
5. [lib/api/response.ts — route handler response helpers](#5-libapiresponsets--route-handler-response-helpers)
6. [hooks/useAdminResource.ts — generic admin CRUD hook](#6-hooksuseadminresourcets--generic-admin-crud-hook)
7. [components/ui/ — shared UI primitives](#7-componentsui--shared-ui-primitives)
8. [components/PdfViewer.tsx — consolidated PDF viewer](#8-componentspdfviewertsx--consolidated-pdf-viewer)
9. [Existing conventions this infrastructure follows](#9-existing-conventions-this-infrastructure-follows)

---

## 1. `tailwind.config.ts` — new color tokens

The existing `ndsc` color block was extended (not restructured) with four
tokens that were already in use as raw CSS variables in `app/globals.css`
but weren't yet exposed as Tailwind utilities:

```ts
theme.extend.colors.ndsc = {
  // ...existing: blue, blue2, bg, bg2, muted, border, accent (unchanged)
  white: "#e8f4ff",
  card: "#0a162899",
  accent2: "#a78bfa",
  glow: "#00d4ff55",
}
```

New utility classes available: `text-ndsc-white`, `bg-ndsc-card`,
`text-ndsc-accent2`, `shadow-ndsc-glow` (etc — any Tailwind utility that
takes a color).

**Caveat:** these are static dark-theme values. They do **not** respond to
the `[data-theme="light"]` override the way `var(--white)` / `var(--card)`
do. Use the CSS variables directly (`style={{ color: 'var(--white)' }}`) for
anything that must support light mode; use the new Tailwind tokens only for
elements that are intentionally dark-only (e.g. inside `app/admin`, which
doesn't currently support light mode anyway).

---

## 2. `lib/theme.ts` — theme tokens & dark/light helpers

Mirrors `app/globals.css`'s `:root` / `[data-theme="light"]` blocks and the
existing `ndsc-theme` localStorage toggle already implemented ad hoc in
`app/layout.tsx` and `app/page.tsx`.

```ts
type Theme = 'dark' | 'light'

const THEME_STORAGE_KEY: 'ndsc-theme'
const THEME_ATTR: 'data-theme'
const DEFAULT_THEME: Theme // 'dark'

interface ThemeColors {
  bg: string; bg2: string; blue: string; blue2: string; glow: string
  white: string; muted: string; card: string; border: string
  accent: string; accent2: string
}

const darkTheme: ThemeColors
const lightTheme: ThemeColors
function getThemeColors(theme: Theme): ThemeColors

const fonts: {
  orbitron: string // "'Orbitron', sans-serif"
  rajdhani: string
  mono: string
  jakarta: string
}

function getStoredTheme(): Theme        // safe on server, returns DEFAULT_THEME
function applyTheme(theme: Theme): void // sets <html data-theme>, persists to localStorage; no-op on server
function toggleTheme(): Theme           // flips + applies + persists, returns the new theme
```

**When to use this vs. CSS variables directly:** use `var(--blue)` etc. in
JSX styling as before — that's still correct and already theme-reactive. Use
`lib/theme.ts`'s constants when you need a color value in **JavaScript**
outside of inline styles (canvas/SVG chart colors, generating an email's
inline HTML, computing a contrasting color, etc), or when building a new
theme toggle button (use `toggleTheme()` instead of re-deriving the
localStorage/attribute logic).

---

## 3. `types/` — shared TypeScript types

New folder, four files plus a barrel. Import from `@/types` (barrel) unless
noted otherwise.

### `types/database.ts`

Row types for every table in `DATABASE_STRUCTURE.md`, kept in sync with it.
These describe **read shapes** (`select('*')` results), not form state.

Exports (all `interface`/`type`, no runtime code):

- `UUID`, `ISODateString` — string aliases for clarity at call sites.
- `AdminRow`, `AdminRole`
- `MemberRow`, `MemberDepartment`, `MemberAchievement`, `MemberShoutboxRow`
- `AnnouncementRow`, `AnnouncementTarget`
- `ExecutiveRow`, `ExecutivePanel`
- `PublicationRow`, `PublicationCategory`
- `ScienceMediaRow`
- `HomepageSettingRow`
- `ActivityTypeRow`, `ActivityVersionRow`, `ActivitySessionRow`
- `ActivityRegCategoryRow`, `CustomFieldDef`, `CustomFieldType`,
  `SubmissionConfigField`, `SubmissionFieldType`
- `ActivityRegistrationRow`, `ActivityTeamMember`, `ActivityPaymentStatus`
- `PaymentTransactionRow`, `PaymentTransactionStatus`
- `ActivitySubmissionRow`
- `RelayExamStateRow`, `RelayMemberSubmission`
- `TeamSubjectAssignmentRow`
- `OlympiadRow`, `OlympiadExamType`, `OlympiadQuestionDisplay`,
  `OlympiadRelayType`, `OlympiadSubjectAssignmentMode`, `QuestionType`,
  `RegistrationFieldDef`, `OlympiadQuestion`, `OlympiadSubject`
- `OlympiadRegistrationRow`, `OlympiadAnnotation`, `QuestionResult`
- `FormConfigRow`, `FormPrimaryField`, `FormContactPerson`

Fields documented as "legacy"/"unused" in `DATABASE_STRUCTURE.md` are marked
`@deprecated` in JSDoc and typed nullable/optional — reads won't break, but
don't write to them in new code.

### `types/auth.ts`

```ts
interface AdminSession { email: string; role: AdminRole }
interface OrganizerSession { olympiadIds: string[] }
interface MemberIdentity { id: string; email: string | undefined }
```

### `types/api.ts` — removed (2026-07-17 cleanup)

This file only existed to type the dead `lib/api-response.ts` duplicate
(see §5) and had no other importers anywhere in the app. Deleted along with
it. `types/index.ts`'s barrel export (`export * from './api'`) was updated
to drop the reference.

### `types/admin-resource.ts`

Config/return types for `hooks/useAdminResource.ts` — see §6 for the full
shapes (`AdminResourceRow`, `AdminResourceConfig<T>`,
`UseAdminResourceReturn<T>`).

### `types/index.ts`

Barrel: `export * from './database' | './auth' | './api' | './admin-resource'`.

---

## 4. `lib/auth.ts` — server-side auth helpers

**Server-only** (imports `next/headers`) — do not import from a Client
Component. Consolidates the `isAdmin()` cookie check that was copy-pasted
into ~20 `app/api/admin/*/route.ts` files, and the Bearer-token member check
duplicated in `member-profile`/`member-achievements`/`member-shoutbox`.

```ts
// Admin (admin_session cookie)
function getAdminSession(): Promise<AdminSession | null>
// Parses the cookie; returns null if missing or malformed. Never throws.

function isAdmin(): Promise<boolean>
// Matches existing routes' inline check: true iff the cookie is PRESENT
// (doesn't validate its contents). Use getAdminSession() if you need
// email/role, or want malformed cookies treated as "not an admin".

// Organizer (organizer_session cookie) — re-exported from lib/organizerAuth.ts
// so callers only need one import for all three auth systems.
function getOrganizerSession(): Promise<OrganizerSession | null>
type OrganizerSession = { olympiadIds: string[] }

// Member (Supabase Auth via Bearer token)
function getMemberFromRequest(req: NextRequest): Promise<MemberIdentity | null>
// Reads `Authorization: Bearer <token>`, validates via supabaseAdmin.auth.getUser().
// Returns { id, email } or null. Does NOT fetch the `members` table row —
// query that separately by `.id` if you need profile fields.
```

**Usage in a new admin route handler:**

```ts
import { isAdmin } from '@/lib/auth'
import { apiUnauthorized } from '@/lib/api/response'

export async function POST(req: NextRequest) {
  if (!(await isAdmin())) return apiUnauthorized()
  // ...
}
```

**Why three separate systems instead of one unified session?** They're
fundamentally different mechanisms: admin/organizer are simple httpOnly
cookies set by this app's own login routes; member auth is a real Supabase
Auth session that only persists in the browser (see the long comment in
`lib/supabase.ts`), so server routes see it as a Bearer token, not a cookie.
Unifying them into one `getSession()` would hide that difference and make it
easy to accidentally treat a member's token check as equivalent to an
admin's cookie check. Import all three from `lib/auth.ts` for a single entry
point without merging their semantics.

**Naming-compatibility aliases:** also exported are `requireAdmin` (=
`isAdmin`), `requireOrganizer` (= `getOrganizerSession`), and
`getMemberSession` (= `getMemberFromRequest`) — pure re-exports, identical
behavior, no wrapping. Use whichever name reads better at the call site.

---

## 5. `lib/api/response.ts` — route handler response helpers

> **Correction (2026-07-17 cleanup):** this section used to describe a file
> called `lib/api-response.ts` (root of `lib/`, paired with `types/api.ts`).
> Grepping the whole app found **zero** imports of either — every one of the
> ~68 call sites actually imports from **`lib/api/response.ts`** (inside the
> `lib/api/` folder, alongside `admin-auth.ts` and `session-cookie.ts`)
> instead. The unused pair was a dead duplicate implementation (different
> `apiOk` signature, never wired up) and has been deleted. This section now
> documents the real, live file.

Thin wrappers around `NextResponse.json` matching the **error shape**
essentially every existing route already uses by convention:
`{ error: string }` with an appropriate status.

```ts
function apiOk<T>(data: T, init?: { status?: number }): NextResponse<T>
function apiError(message: unknown, status = 400): NextResponse<{ error: string }>
function apiUnauthorized(message = 'Unauthorized'): NextResponse<{ error: string }>   // 401
function apiForbidden(message = 'Forbidden.'): NextResponse<{ error: string }>         // 403
function apiNotFound(message = 'Not found.'): NextResponse<{ error: string }>          // 404
function apiBadRequest(message = 'Invalid request.'): NextResponse<{ error: string }>  // 400
function apiServerError(message = 'Something went wrong. Please try again.'): NextResponse<{ error: string }> // 500
function fromSupabase<T>(result: { data: T; error: { message: string } | null }, status = 400): NextResponse
```

`apiError`'s `message` param accepts a string, a caught error, or a Supabase
`{ error }` result and normalizes it to a message — so routes can pass a
caught exception or a Supabase error object straight through without
extracting `.message` themselves first.

`fromSupabase(result)` is the shortest form for the common "just forward
whatever Supabase returned" case:

```ts
import { fromSupabase } from '@/lib/api/response'
return fromSupabase(await supabaseAdmin.from('activities').select())
```

**Important — success shapes are intentionally NOT standardized here.**
Existing endpoints return several different success shapes for essentially
the same "here's the row(s)" concept:

| Endpoint | Success shape |
|---|---|
| `GET /api/admin/activities` | bare array |
| `GET /api/admin/members` | `{ members: [...] }` |
| `PUT /api/admin/members` | `{ member: {...} }` |
| `POST /api/admin/activities` | bare row |
| `DELETE /api/admin/activities` | `{ success: true }` |

`apiOk(data)` just wraps `NextResponse.json(data, { status })` — use it
to return whatever shape matches your endpoint's sibling routes (e.g. match
the existing `{ members: [...] }` shape if you're adding a route next to
`app/api/admin/members`). Don't invent a new shape for an existing resource
family. For a **brand new** resource with no siblings to match, prefer
returning the row/array directly (bare), since that's what
`hooks/useAdminResource.ts`'s default extractors handle with zero
configuration.

---

## 6. `hooks/useAdminResource.ts` — generic admin CRUD hook

Client-side hook (`'use client'`) generalizing the load/create/update/delete
logic duplicated across every `app/admin/*/page.tsx`.

```ts
function useAdminResource<T extends AdminResourceRow>(
  config: AdminResourceConfig<T>
): UseAdminResourceReturn<T>

interface AdminResourceRow { id: string; [key: string]: unknown }

interface AdminResourceConfig<T> {
  endpoint: string                              // e.g. '/api/admin/publications'
  extractList?: (json: unknown) => T[]          // default: handles bare array or first array-valued property
  extractItem?: (json: unknown) => T            // default: handles bare row or first object-valued property with an `id`
  idLocation?: 'body' | 'query'                 // how PUT/DELETE send the id. Default: 'body' (matches most routes)
}

interface UseAdminResourceReturn<T> {
  items: T[]
  loading: boolean
  error: string | null
  reload: () => Promise<void>
  create: (payload: Partial<T>) => Promise<T | null>
  update: (payload: Partial<T> & { id: string }) => Promise<T | null>
  remove: (id: string) => Promise<boolean>
}
```

Behavior:
- Loads on mount via `reload()`.
- `create` POSTs `payload` as JSON, appends the created row to `items` on success.
- `update` PUTs `payload` (must include `id`) as JSON; sends `id` in the body
  by default, or as a `?id=` query param if `idLocation: 'query'`. Replaces
  the matching row in `items` on success.
- `remove` DELETEs; sends `{ id }` in the body by default, or `?id=` in the
  query if `idLocation: 'query'`. Removes the row from `items` on success.
- All three mutation methods set `error` (a string) on failure and return
  `null`/`false` — they never throw.

**Usage example:**

```tsx
'use client'
import { useAdminResource } from '@/hooks/useAdminResource'
import type { PublicationRow } from '@/types'

export default function AdminPublicationsPage() {
  const { items, loading, error, create, update, remove } =
    useAdminResource<PublicationRow>({ endpoint: '/api/admin/publications' })

  // items: PublicationRow[], already loaded on mount
  // await create({ title: 'New', category: 'wall_magazine', ... })
  // await update({ id, is_published: false })
  // await remove(id)
}
```

If an endpoint's GET wraps the array (e.g. `{ members: [...] }`), the
default `extractList` already finds it automatically (it looks for the first
array-valued property). Only pass `extractList`/`extractItem` explicitly if
an endpoint's shape is ambiguous (e.g. it has more than one array-valued
property).

---

## 7. `components/ui/` — shared UI primitives

Extracted from patterns duplicated locally across `app/admin/*/page.tsx`
(each admin page previously redefined its own `Modal`, `Field`, styled
`<input>`, etc). All use the existing CSS-variable-driven color system
(`var(--blue)`, `var(--muted)`, etc.) so they work with the existing
dark/light theme toggle without any extra wiring. Import from
`@/components/ui` (barrel) or the individual file.

```ts
// Button.tsx
type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost'
type ButtonSize = 'sm' | 'md' | 'lg'
interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant; size?: ButtonSize; loading?: boolean
}
function Button(props: ButtonProps): JSX.Element

// Field.tsx — label + control + error wrapper
interface FieldProps {
  label: string; htmlFor?: string; required?: boolean; error?: string | null
  children: ReactNode
}
function Field(props: FieldProps): JSX.Element
// FormField.tsx re-exports the above as `FormField` (+ `FormFieldProps`) —
// naming-compatibility alias, identical component, no behavior difference.

// Input.tsx / Textarea.tsx / Select.tsx — styled form controls
function Input(props: InputHTMLAttributes<HTMLInputElement>): JSX.Element
function Textarea(props: TextareaHTMLAttributes<HTMLTextAreaElement>): JSX.Element
interface SelectOption { value: string; label: string }
function Select(props: SelectHTMLAttributes<HTMLSelectElement> & {
  options: SelectOption[]; placeholder?: string
}): JSX.Element

// Modal.tsx — 'use client'; overlay + centered card + Escape-to-close
interface ModalProps { title: string; onClose: () => void; children: ReactNode; maxWidth?: string }
function Modal(props: ModalProps): JSX.Element

// Badge.tsx — status pill
type BadgeTone = 'success' | 'warning' | 'danger' | 'neutral' | 'info'
function Badge(props: { children: ReactNode; tone?: BadgeTone }): JSX.Element

// Spinner.tsx
function Spinner(props: { size?: number; label?: string }): JSX.Element

// Card.tsx — the `rounded-xl/2xl border` panel shell duplicated as a local
// `style={s}` object throughout app/admin/**/page.tsx (table wrappers,
// confirm dialogs, form sections, achievement rows)
type CardPadding = 'none' | 'sm' | 'md'
interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padding?: CardPadding; rounded?: 'lg' | 'xl' // 'lg' = rounded-xl (default), 'xl' = rounded-2xl
}
function Card(props: CardProps): JSX.Element

// Table.tsx — the `<table>` + styled thead/tbody + empty-row markup
// duplicated in app/admin/members, admin/olympiads, admin/executives
interface TableColumn<T> {
  key: string; header: string; render: (row: T) => ReactNode; className?: string
}
interface TableProps<T> { columns: TableColumn<T>[]; rows: T[]; rowKey: (row: T) => string; emptyMessage?: string }
function Table<T>(props: TableProps<T>): JSX.Element
// Wrap in <Card padding="none"> (or an `overflow-x-auto` div) for the
// existing scroll-on-mobile / clipped-corners behavior — Table itself only
// renders the <table>, not its wrapper.

// EmptyState.tsx — standalone "nothing here" panel (outside a <table>;
// Table.tsx already renders its own in-table empty row for that case)
function EmptyState(props: { message: string; icon?: ReactNode; action?: ReactNode }): JSX.Element

// ErrorMessage.tsx — the red banner `{error && <div className="mb-4 p-3
// rounded-lg text-sm" style={{ background: 'rgba(255,80,80,0.1)', ... }}>`
// block duplicated across app/admin/**/page.tsx. Caller still owns the
// `{error && ...}` conditional; this only renders the banner markup.
function ErrorMessage(props: { children: ReactNode }): JSX.Element
```

`Badge` deliberately does **not** hardcode a status→tone mapping (e.g.
`"pending"` → warning), because the same string means different things for
different fields (`"pending"` is a warning for `payment_status` but neutral
for a draft `review_status`). Callers choose the tone based on their
specific field's semantics.

---

## 8. `components/PdfViewer.tsx` — consolidated PDF viewer

**Dedup note:** the repo has three `PdfViewer.tsx` files:

- `app/activities/[slug]/PdfViewer.tsx`
- `app/admin/PdfViewer.tsx`
- `app/publication/PdfViewer.tsx`

The first two are **byte-for-byte identical** — a Google Docs viewer embed
with a cascading fallback (gdocs iframe → direct iframe → open/download
links). `components/PdfViewer.tsx` is that implementation, generalized:

```ts
interface PdfViewerProps {
  url: string
  height?: string // default '80vh', matches the originals
  labels?: {
    failedMessage?: string  // default: 'Inline viewer কাজ করছে না।'
    openInNewTab?: string   // default: 'নতুন Tab এ খুলুন'
    download?: string       // default: 'Download PDF'
    directTry?: string      // default: 'Direct Try'
  }
}
function PdfViewer(props: PdfViewerProps): JSX.Element
```

Default labels match the original Bengali copy exactly, so swapping either
duplicate's import for this one is a drop-in replacement with no visual
change: `import PdfViewer from '@/components/PdfViewer'`.

**`app/publication/PdfViewer.tsx` was intentionally NOT merged in.** It
renders a hardcoded Heyzine flip-book iframe pointed at a fixed URL
(`heyzine.com/flip-book/a9df397b9b.html`) and **ignores its `url` prop
entirely** — this looks like a bug (every publication would show the same
flip-book regardless of its actual `pdf_url`), but fixing `app/publication/`
is out of scope for this task (no `app/` edits beyond what's listed). Flag
it for whoever owns that page.

This task does not modify `app/activities/[slug]/PdfViewer.tsx`,
`app/admin/PdfViewer.tsx`, or `app/publication/PdfViewer.tsx` — migrating
existing call sites to the shared component is left for a follow-up.

---

## 9. Existing conventions this infrastructure follows

For anyone building on top of this, some codebase conventions that the
shared files above deliberately match rather than "fix" (fixing them is a
separate, larger task):

- **Auth is cookie-existence-based for admin/organizer**, not JWT-verified —
  `admin_session`/`organizer_session` are plain JSON in an httpOnly cookie.
  `lib/auth.ts`'s `isAdmin()` matches this (checks presence, not validity)
  to stay consistent with all existing route handlers; don't tighten it
  unilaterally in one new route, since that would make that route behave
  differently from its siblings for the same cookie.
- **Success response shapes vary per endpoint** (bare array vs. bare row vs.
  `{ resourceName: [...] }`) — see the table in §5. New endpoints should
  match their closest sibling's shape, not introduce a fourth pattern.
- **PUT/DELETE mostly take `id` in the JSON body**, not the URL path or a
  query string (e.g. `PUT /api/admin/activities` with `{ id, ...fields }` in
  the body, not `PUT /api/admin/activities/:id`). `useAdminResource`
  defaults to this; use `idLocation: 'query'` only for the routes that
  actually expect `?id=`.
- **Colors are CSS variables, not hardcoded hex**, styled via inline `style`
  props referencing `var(--blue)` etc. (defined in `app/globals.css`), which
  is how dark/light mode actually works in this app. The new
  `components/ui/*` primitives and `lib/theme.ts` follow this rather than
  hardcoding hex values, so they stay theme-reactive.
- **Bengali (bn) strings are mixed into English UI copy** ad hoc (e.g. PDF
  viewer fallback text, upload comments) rather than through an i18n
  library — there's no i18n system to plug into yet. `PdfViewer`'s
  `labels` prop is an escape hatch for this, not a general i18n solution.
