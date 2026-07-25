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
  // olympiad question types — added for the unified form graph system. The
  // public FieldsRenderer renders these too; mcq/checkbox carry their
  // options inline and store the chosen option id(s) under `key` in custom_answers.
  | 'mcq' | 'checkbox' | 'short_answer'

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
  // Olympiad question fields. mcq_options: [{ id, text }]. correct_option_id
  // / correct_option_ids are stripped by the public renderer (kept in the DB
  // so the admin doesn't lose them when the same graph is re-rendered).
  marks?: number
  mcq_options?: { id: string; text: string }[]
  correct_option_id?: string
  correct_option_ids?: string[]
  // content-only
  text?: string                 // header / paragraph body text
  heading_size?: 'lg' | 'md'    // header only
  image_url?: string
  image_alt?: string
  link_url?: string
  // link_button only: when set, clicking the button navigates the
  // public runner to this form_node within the same graph. Takes
  // precedence over link_url. Used for "go to sub-segment" flows.
  target_node_id?: string
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
  // When true, the server enforces uniqueness for this field's value across
  // all registrations in the same activity session. The public form does a
  // live lookup on blur and surfaces an "already registered" / "added by X"
  // notice before submit. Use sparingly (typically just for college_roll or
  // email). Multiple unique fields can coexist — each is checked
  // independently.
  unique_field?: boolean
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
  { type: 'mcq', label: 'MCQ (single answer)' },
  { type: 'checkbox', label: 'Multi-select MCQ' },
  { type: 'short_answer', label: 'Short answer' },
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
    if (type === 'mcq' || type === 'checkbox') {
      return {
        ...base, kind: 'field', type,
        label: '', description: '', required: true, marks: 1,
        mcq_options: [], key: '',
        correct_option_id: type === 'mcq' ? undefined : undefined,
        correct_option_ids: type === 'checkbox' ? [] : undefined,
      }
    }
    if (type === 'short_answer') {
      return { ...base, kind: 'field', type, label: '', description: '', required: true, marks: 1, key: '' }
    }
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

/** Upgrades stored data (old flat field-only shape, olympiad-question shape, or already-new blocks) into FormBlock[]. */
export function normalizeBlocks(raw: any): FormBlock[] {
  if (!Array.isArray(raw)) return []
  return raw.map((item: any): FormBlock => {
    if (item && item.kind) return { ...item, id: item.id || item.key || uid() }
    // Legacy olympiad question shape: { id, type: 'mcq'|'checkbox'|'short'|'photo', text, options: [{id,text}], correct_option_id(s), marks }
    if (item && (item.type === 'mcq' || item.type === 'checkbox' || item.type === 'short' || item.type === 'photo')) {
      const mappedType: FieldBlockType =
        item.type === 'mcq' ? 'mcq' :
        item.type === 'checkbox' ? 'checkbox' :
        item.type === 'short' ? 'short_answer' :
        'photo'
      return {
        id: item.id || uid(),
        kind: 'field',
        type: mappedType,
        label: item.text || '',
        description: item.description || '',
        required: item.required !== false,
        marks: item.marks || 1,
        key: item.id || '',
        mcq_options: (item.options || []).map((o: any) => typeof o === 'string' ? { id: o, text: o } : o),
        correct_option_id: item.correct_option_id,
        correct_option_ids: item.correct_option_ids,
        max_files: mappedType === 'photo' ? (item.max_files || 1) : undefined,
      }
    }
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
      unique_field: !!item?.unique_field,
    }
  })
}
