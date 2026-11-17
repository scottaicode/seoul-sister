/**
 * Parse the JSON a model was asked to return and nothing else.
 *
 * Why this exists (Nov 16 2026): the setup-chat extractor returned a complete,
 * valid JSON object followed by a sentence of commentary on a turn where the
 * member corrected a medical fact ("I have had skin cancer many times"), and
 * `JSON.parse` on the whole text threw. The caller treated that as "nothing to
 * extract", so the profile kept "no skin cancer" until the next message.
 * Replayed on that transcript, 1 run in 5 did it.
 *
 * So: try the whole text; if that fails, take the first complete JSON OBJECT
 * in it (string-aware brace matching) and parse that. Objects only: every
 * caller asks for one, and a second-model review found that taking the first
 * bracket of any kind read "Note [1]: {...}" as the array [1], which the
 * callers then treated as an object with no fields: the same silent loss,
 * with no error this time. A value that is cut off still throws, which is
 * right: half a record is not a record.
 */
export function parseModelJson(raw: string): unknown {
  const text = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try {
    return JSON.parse(text)
  } catch (whole) {
    for (let from = text.indexOf('{'); from >= 0; from = text.indexOf('{', from + 1)) {
      const candidate = balancedObjectAt(text, from)
      if (candidate === null) continue
      try {
        const value: unknown = JSON.parse(candidate)
        if (value !== null && typeof value === 'object' && !Array.isArray(value)) return value
      } catch {
        // Not JSON from this brace (prose like "{see below}"); try the next one.
      }
    }
    throw whole
  }
}

/** The balanced `{...}` starting at `start`, or null when it never closes. */
function balancedObjectAt(text: string, start: number): string | null {
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}
