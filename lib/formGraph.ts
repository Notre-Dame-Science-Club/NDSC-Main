// Shared types + helpers for the unified flowchart form system.
//
// The system has two tables:
//
//   form_graphs — one per "form owner" (an activity session, an olympiad, or
//                 a freestanding global config). Holds graph-level settings
//                 (anti-cheat mode, default timer, default appearance).
//
//   form_nodes  — one per form in the graph. Tree via parent_id. A node is
//                 a single form (think one Google Forms "page"): it has
//                 fields, appearance, and behavior (team, payment, schedule).
//
// The public FormRunner walks the tree: render the root, on submit show
// children, click one to enter it, etc. Admin's React Flow canvas in
// /admin/form-builder/[graphId] edits this same shape (positions on the
// canvas live in `position`, free-form x/y).
//
// We reuse lib/formBlocks.ts for the field model. The only new shape here
// is the graph/node container.

import type { FormBlock } from './formBlocks'

export type OwnerKind = 'activity' | 'olympiad'

/** Anti-cheat modes for the public runner. v1 only has 'timer_no_copy'. */
export type AntiCheatMode = 'none' | 'timer_no_copy'

/** "Quick-start" templates. The starter node is auto-created; presets are
 *  one-click inserts from the diagram toolbar. `blank` = empty form. */
export type FormNodeKind =
  | 'starter'
  | 'blank'
  | 'preset_common_details'
  | 'preset_olympiad_questions'
  | 'preset_team_info'

/** Per-node appearance — same shape as the legacy form_configs appearance
 *  columns (title, subtitle, cover, theme, font, cover_aspect_ratio, bg
 *  color/image, contact_persons). Lives per-node so a registration can have
 *  different styling per page (e.g. a "Thank you" page with celebration
 *  colors). All optional — the runner falls back to the graph-level
 *  default_appearance and then to the site default. */
export type FormNodeAppearance = {
  title?: string
  subtitle?: string
  cover_photo_url?: string
  bg_theme?: string
  bg_color?: string
  bg_image_url?: string
  font_family?: string
  cover_aspect_ratio?: string
  contact_persons?: any
}

/** Per-node behavior — encapsulates the things that used to live as
 *  top-level columns on activity_reg_categories and olympiads. Everything
 *  is optional; an empty object means "no special behavior". */
export type FormNodeBehavior = {
  // For activity registration nodes:
  require_team?: {
    min?: number
    max?: number
    optional?: boolean
    fields?: any[]        // team_member_fields, same shape as old form_configs
    password_required?: boolean
  }
  requires_payment?: {
    amount: number
    label?: string
  }
  is_online_submission?: boolean
  schedule?: { date?: string; time?: string; room?: string }
  project_name?: { enabled: boolean; label?: string }
  submission_config?: any[]      // activity_submissions.answers shape
  submission_who?: 'leader' | 'any_member'
  // For olympiad question nodes:
  timer_override_minutes?: number
  // Display:
  show_progress_bar?: boolean
  hide_next_button?: boolean
  // Free-form bag for admin extensions:
  [k: string]: any
}

/** Graph-level settings. `default_appearance` is what nodes inherit when
 *  their own appearance is empty; `anti_cheat` controls whether the runner
 *  wraps the page in <AntiCheatProvider />. */
export type FormGraphSettings = {
  anti_cheat?: AntiCheatMode
  timer_minutes?: number        // default timer for olympiad question nodes
  default_appearance?: FormNodeAppearance
  [k: string]: any
}

export type FormGraph = {
  id: string
  owner_kind: OwnerKind
  owner_id: string
  root_node_id: string | null
  title: string
  settings: FormGraphSettings
  created_at?: string
  updated_at?: string
}

export type FormNode = {
  id: string
  graph_id: string
  parent_id: string | null
  position: { x: number; y: number }
  label: string
  kind: FormNodeKind
  enabled: boolean
  is_terminal: boolean
  fields: FormBlock[]
  appearance: FormNodeAppearance
  behavior: FormNodeBehavior
  display_order: number
  created_at?: string
  updated_at?: string
}

/** DB column set we accept/emit for form_nodes. Anything else is dropped
 *  (we use `position`, `fields`, `appearance`, `behavior` as JSONB; no
 *  schema shape for them in this validator — they pass through). */
export const FORM_NODE_COLUMNS = [
  'id', 'graph_id', 'parent_id', 'position', 'label', 'kind',
  'enabled', 'is_terminal', 'fields', 'appearance', 'behavior', 'display_order',
  'created_at', 'updated_at',
] as const

export const FORM_GRAPH_COLUMNS = [
  'id', 'owner_kind', 'owner_id', 'root_node_id', 'title', 'settings',
  'created_at', 'updated_at',
] as const

/** Strip unknown keys, fill defaults. */
export function packFormNodeBody(body: Record<string, any>) {
  const out: Record<string, any> = {}
  for (const col of FORM_NODE_COLUMNS) {
    if (body[col] !== undefined) out[col] = body[col]
  }
  if (typeof out.position !== 'object' || out.position === null) out.position = { x: 0, y: 0 }
  if (!Array.isArray(out.fields)) out.fields = []
  if (typeof out.appearance !== 'object' || out.appearance === null) out.appearance = {}
  if (typeof out.behavior !== 'object' || out.behavior === null) out.behavior = {}
  if (typeof out.label !== 'string') out.label = 'Untitled form'
  if (typeof out.kind !== 'string') out.kind = 'blank'
  if (typeof out.enabled !== 'boolean') out.enabled = true
  if (typeof out.is_terminal !== 'boolean') out.is_terminal = false
  if (typeof out.display_order !== 'number') out.display_order = 0
  return out
}

export function packFormGraphBody(body: Record<string, any>) {
  const out: Record<string, any> = {}
  for (const col of FORM_GRAPH_COLUMNS) {
    if (body[col] !== undefined) out[col] = body[col]
  }
  if (typeof out.settings !== 'object' || out.settings === null) out.settings = {}
  if (typeof out.title !== 'string') out.title = 'Untitled form graph'
  return out
}

/** UI label for each node kind — used in the diagram and node editor. */
export const FORM_NODE_KIND_LABEL: Record<FormNodeKind, string> = {
  starter: 'Starter (root)',
  blank: 'Blank form',
  preset_common_details: 'Common details',
  preset_olympiad_questions: 'Olympiad questions',
  preset_team_info: 'Team info',
}

export const FORM_NODE_KIND_BADGE: Record<FormNodeKind, string> = {
  starter: 'ROOT',
  blank: 'BLANK',
  preset_common_details: 'COMMON',
  preset_olympiad_questions: 'QUESTIONS',
  preset_team_info: 'TEAM',
}
