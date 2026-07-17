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
  // content-only
  text?: string                 // header / paragraph body text
  heading_size?: 'lg' | 'md'    // header only
  image_url?: string
  image_alt?: string
  link_url?: string
  link_label?: string
  video_url?: string
  height_px?: number             // spacer only
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
