// Shared data model for the "Extra Custom Fields" form builder.
//
// A form is an ordered list of FormBlock. Two kinds:
//  - kind: 'field'   -> collects an answer from the registrant (text, dropdown, file, etc.)
//  - kind: 'content' -> pure layout/presentation, collects nothing (header, paragraph, image,
//                        link/button, video embed, divider, spacer)
//
// This is stored verbatim in form_configs.extra_fields (jsonb, opaque to the DB) — no schema
// change was needed to introduce content blocks alongside field blocks.
//
// Older configs saved before this builder existed used a flatter shape with no `kind`/`id`
// (`{ key, label, description, type, required, options }`, always a field). normalizeBlocks()
// below upgrades that shape on read so existing forms keep working unchanged.

export type FieldBlockType =
  | 'text' | 'textarea' | 'number' | 'dropdown' | 'multiple_choice' | 'checkboxes'
  | 'date' | 'time' | 'photo' | 'file'

export type ContentBlockType =
  | 'header' | 'paragraph' | 'image' | 'link_button' | 'video' | 'divider' | 'spacer'

export type FormBlock = {
  id: string
  kind: 'field' | 'content'
  type: FieldBlockType | ContentBlockType
  // field-only
  label?: string
  description?: string
  required?: boolean
  options?: string[]
  allow_other?: boolean
  max_file_size_mb?: number
  max_files?: number
  // Stable answer key for non-built-in fields — what the value is stored
  // under in custom_answers on the registration row. Admin-editable, but
  // defaults to a sanitized version of the label.
  key?: string
  // content-only
  text?: string                 // header / paragraph body text
  heading_size?: 'lg' | 'md'    // header only
  image_url?: string
  image_alt?: string
  link_url?: string
  link_label?: string
  video_url?: string
  height_px?: number             // spacer only
  // built-in fields (segment form_field_schema only) — set automatically for
  // the 7 default fields; admin can clear `is_builtin` by deleting the field.
  // `db_column: 'top_level'` means the answer also writes to a dedicated
  // activity_registrations column; `jsonb` means only custom_answers.
  is_builtin?: BuiltinFieldKey
  db_column?: 'top_level' | 'jsonb'
  // field-only
  placeholder?: string
}

export const uid = () => Math.random().toString(36).slice(2, 9)

export const FIELD_BLOCK_TYPES: { type: FieldBlockType; label: string }[] = [
  { type: 'text', label: 'Short text' },
  { type: 'textarea', label: 'Long text' },
  { type: 'number', label: 'Number' },
  { type: 'dropdown', label: 'Dropdown' },
  { type: 'multiple_choice', label: 'Multiple choice' },
  { type: 'checkboxes', label: 'Checkboxes' },
  { type: 'date', label: 'Date' },
  { type: 'time', label: 'Time' },
  { type: 'photo', label: 'Photo upload' },
  { type: 'file', label: 'File upload' },
]

export const CONTENT_BLOCK_TYPES: { type: ContentBlockType; label: string }[] = [
  { type: 'header', label: 'Header' },
  { type: 'paragraph', label: 'Text block' },
  { type: 'image', label: 'Image' },
  { type: 'link_button', label: 'Link / button' },
  { type: 'video', label: 'Video embed' },
  { type: 'divider', label: 'Divider' },
  { type: 'spacer', label: 'Padding / spacer' },
]

const FIELD_TYPE_SET = new Set(FIELD_BLOCK_TYPES.map(f => f.type))
export const isFieldBlockType = (t: string): t is FieldBlockType => FIELD_TYPE_SET.has(t as FieldBlockType)

export function blankBlock(type: FieldBlockType | ContentBlockType): FormBlock {
  const base = { id: uid() }
  if (isFieldBlockType(type)) {
    return {
      ...base, kind: 'field', type,
      label: '', description: '', required: false,
      options: (type === 'dropdown' || type === 'multiple_choice' || type === 'checkboxes') ? [] : undefined,
    }
  }
  switch (type) {
    case 'header': return { ...base, kind: 'content', type, text: 'Section header', heading_size: 'md' }
    case 'paragraph': return { ...base, kind: 'content', type, text: '' }
    case 'image': return { ...base, kind: 'content', type, image_url: '', image_alt: '' }
    case 'link_button': return { ...base, kind: 'content', type, link_label: 'Learn more', link_url: '' }
    case 'video': return { ...base, kind: 'content', type, video_url: '' }
    case 'spacer': return { ...base, kind: 'content', type, height_px: 24 }
    case 'divider':
    default: return { ...base, kind: 'content', type }
  }
}

// Built-in field key values — match the top-level columns on
// activity_registrations so the server can write a field's answer directly to
// the matching column when the field is marked `is_builtin`. Adding a new key
// here means adding a matching column on activity_registrations.
export type BuiltinFieldKey =
  | 'full_name' | 'phone' | 'email' | 'college'
  | 'college_roll' | 'hsc_session' | 'division'

// The 7 default fields pre-loaded into every new segment's form_field_schema.
// Used as a single source of truth so:
//   1. The admin segment editor has a "new segment" default that matches the
//      server's hard-minimum requirements.
//   2. /admin/forms (which is now only theme/cover/contact) no longer needs its
//      own hard-coded PRIMARY_FIELD_KEYS list.
//   3. The migration script above can reference the same shape.
//
// Admin can still delete any of these in the UI; the server enforces the
// minimum (full_name, phone, email, college_roll) regardless.
export function builtinFieldDefs(): FormBlock[] {
  return [
    { id: 'full_name', kind: 'field', type: 'text', label: 'Full Name', description: '', required: true, is_builtin: 'full_name', db_column: 'top_level' },
    { id: 'phone', kind: 'field', type: 'text', label: 'Phone Number', description: '', required: true, is_builtin: 'phone', db_column: 'top_level' },
    { id: 'email', kind: 'field', type: 'text', label: 'Email Address', description: '', required: true, is_builtin: 'email', db_column: 'top_level' },
    { id: 'college', kind: 'field', type: 'text', label: 'College', description: '', required: false, placeholder: 'Notre Dame College', is_builtin: 'college', db_column: 'top_level' },
    { id: 'college_roll', kind: 'field', type: 'text', label: 'College Roll', description: '', required: true, is_builtin: 'college_roll', db_column: 'top_level' },
    { id: 'hsc_session', kind: 'field', type: 'text', label: 'HSC Session', description: '', required: false, placeholder: 'e.g. 2024-25', is_builtin: 'hsc_session', db_column: 'top_level' },
    { id: 'division', kind: 'field', type: 'text', label: 'Division', description: '', required: false, placeholder: 'e.g. Dhaka', is_builtin: 'division', db_column: 'top_level' },
  ]
}

// Server-side hard minimum — the server will reject a registration if any of
// these are missing from the payload, even if the segment's form_field_schema
// doesn't include them. This is the backstop for accidental admin deletion.
export const HARD_MINIMUM_KEYS: BuiltinFieldKey[] = ['full_name', 'phone', 'email', 'college_roll']

/** Upgrades stored data (old flat field-only shape, or already-new blocks) into FormBlock[]. */
export function normalizeBlocks(raw: any): FormBlock[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item: any): FormBlock => {
    if (item && item.kind) return { ...item, id: item.id || item.key || uid() }
    return {
      id: item?.key || uid(),
      kind: 'field',
      type: item?.type || 'text',
      label: item?.label || '',
      description: item?.description || '',
      required: !!item?.required,
      options: item?.options || [],
      allow_other: item?.allow_other,
      max_file_size_mb: item?.max_file_size_mb,
      max_files: item?.max_files,
    }
  })
}
