/**
 * Convert a string to a URL-safe slug.
 * Used for ingredient pages, blog posts, and any URL-friendly identifiers.
 */
export function toSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 200)
}
