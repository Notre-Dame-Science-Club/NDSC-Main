/**
 * Turns a title into a URL-safe slug, suffixed with the current timestamp
 * so slugs stay unique even when two records share a title.
 */
export function makeSlug(title: string): string {
  const base = title
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return `${base}-${Date.now()}`;
}
