/**
 * Sanitize a search term for interpolation into a PostgREST `.or()` filter
 * string (e.g. `name_en.ilike.%${term}%`).
 *
 * Two escape layers are needed:
 * - `,` `(` `)` are PostgREST filter metacharacters — left in place they let
 *   crafted input inject extra OR conditions (and break legit searches like
 *   "snail, mucin"). Replaced with spaces.
 * - `%` `_` `\` are SQL LIKE wildcards — escaped so they match literally.
 */
export function sanitizeSearchTerm(input: string): string {
  return input
    .replace(/[,()]/g, ' ')
    .replace(/\\/g, '\\\\')
    .replace(/%/g, '\\%')
    .replace(/_/g, '\\_')
    .replace(/\s+/g, ' ')
    .trim()
}
