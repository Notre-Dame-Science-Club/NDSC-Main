// A 'photo'/'file' question's answer can be a single URL string (legacy /
// single-file questions) or an array of URLs (multi-file questions, see
// FieldsRenderer.handleFile). Every place that renders one of these needs
// to handle both shapes — this is the one place that does the normalizing.
export function toAnswerUrls(value: unknown): string[] {
  if (value == null) return []
  if (Array.isArray(value)) {
    return value.filter((v): v is string => typeof v === 'string' && v.length > 0)
  }
  if (typeof value === 'string' && value.length > 0) return [value]
  return []
}
