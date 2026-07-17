// form_configs has exactly one column for contact info: `contact_persons`
// (jsonb). It holds either a plain array of manually-entered contacts, or
// `{ use_ec_page: true, ec_ids: [...] }` when the admin chose to pull
// contacts from the Executive Committee page instead of typing them in.
//
// The admin editor (app/admin/forms) and the public register page both find
// it easier to work with `use_ec_page` / `ec_ids` as flat top-level fields
// alongside `contact_persons` rather than switching on the shape of a union
// type everywhere they touch it. This module is the one place that
// translates between the two shapes, so routes can stay simple and never
// send a stray `use_ec_page` / `ec_ids` key directly at Postgres (there is
// no such column — that previously surfaced as "Could not find the
// 'ec_ids' column of 'form_configs' in the schema cache").

export const FORM_CONFIG_COLUMNS = [
  'id', 'form_key', 'title', 'subtitle', 'cover_photo_url', 'bg_theme',
  'primary_fields', 'extra_fields', 'contact_persons',
  'bg_color', 'bg_image_url', 'font_family', 'cover_aspect_ratio',
  'auto_pull_title', 'auto_pull_description', 'auto_pull_cover',
  'updated_at',
] as const

/** DB row -> flat shape the admin/public UIs expect (adds use_ec_page/ec_ids, contact_persons always an array). */
export function unpackFormConfigRow<T extends { contact_persons?: any }>(row: T) {
  const cp = row?.contact_persons
  const usesEc = !!cp && !Array.isArray(cp) && (cp as any).use_ec_page === true
  return {
    ...row,
    contact_persons: usesEc ? [] : (Array.isArray(cp) ? cp : []),
    use_ec_page: usesEc,
    ec_ids: usesEc ? ((cp as any).ec_ids || []) : [],
  }
}

/** Incoming request body (flat shape) -> a column-safe object for upsert into form_configs. */
export function packFormConfigBody(body: Record<string, any>) {
  const packed: Record<string, any> = {}
  for (const col of FORM_CONFIG_COLUMNS) {
    if (col === 'contact_persons') continue // handled below
    if (body[col] !== undefined) packed[col] = body[col]
  }
  packed.contact_persons = body.use_ec_page
    ? { use_ec_page: true, ec_ids: Array.isArray(body.ec_ids) ? body.ec_ids : [] }
    : (Array.isArray(body.contact_persons) ? body.contact_persons : [])
  return packed
}
