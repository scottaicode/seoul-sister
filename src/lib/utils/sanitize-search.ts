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

/**
 * A `%term%` ILIKE pattern as a double-quoted PostgREST value, for use inside
 * `.or()`: `name_en.ilike.${quotedIlikePattern(q)}`.
 *
 * Quoting is what makes a "." safe: unquoted, `no.9` is read as filter syntax
 * and silently returns nothing. Inside the quotes PostgREST consumes one level
 * of backslashes, so the LIKE escapes from `sanitizeSearchTerm` are doubled;
 * left single, `100%` reached Postgres as a live wildcard (measured Nov 13
 * 2026: 112 rows where the literal search has 0).
 */
export function quotedIlikePattern(input: string): string {
  const term = sanitizeSearchTerm(input).replace(/"/g, '').replace(/\\/g, '\\\\')
  return `"%${term}%"`
}
