import { isPollutedIngredientName } from '@/lib/pipeline/ingredient-parser'

/**
 * Read an ingredient list a Yuri tool call sent, STRICTLY.
 *
 * Oct 6 2026: Yuri sent a subscriber's two label lists to update_user_product as
 * comma-separated STRINGS. The tool accepted only arrays, stored nothing, and
 * returned success, so Yuri told her "I've got real INCI on both saved now" over
 * two empty rows.
 *
 * The first fix ran strings through the catalog parser. A second-model review
 * showed that was worse in other shapes: a newline-separated label became ONE
 * stored "ingredient", and a comma list with one stray ";" silently lost names,
 * both saved as `label_scan` and shown to Yuri as examined. So this reader does
 * not repair anything. It accepts a clean list and rejects everything else as
 * `unreadable`, which the caller turns into an error so Yuri resends a proper
 * array. A wrong list that looks checked is worse than no list.
 *
 * Accepted: an array of strings, or a string split ONLY on ", " (comma + space,
 * so "1,2-Hexanediol" and "(20,000ppm)" stay whole). Every element must look
 * like one ingredient name; if any does not, the whole list is rejected. A
 * string must yield at least two names ("I could not read the label" is not a
 * list). Absent, null, "", and [] mean "no list sent" and are not errors.
 */
export function readIngredientInput(raw: unknown): { list?: string[]; unreadable: boolean } {
  if (raw === undefined || raw === null) return { unreadable: false }
  let items: unknown[]
  if (typeof raw === 'string') {
    const body = raw.trim().replace(/^(ingredients|inci|full ingredients? list)\s*:\s*/i, '').replace(/\.$/, '')
    if (body === '') return { unreadable: false }
    items = body.split(/,\s+/)
    if (items.length < 2) return { unreadable: true }
  } else if (Array.isArray(raw)) {
    if (raw.length === 0) return { unreadable: false }
    items = raw
  } else {
    return { unreadable: true }
  }
  const list: string[] = []
  for (const item of items) {
    if (typeof item !== 'string') return { unreadable: true }
    const name = item.trim()
    if (!looksLikeOneIngredient(name)) return { unreadable: true }
    list.push(name)
  }
  return { list, unreadable: false }
}

/** One INCI name: no separators, no sentence, no list folded inside it. */
function looksLikeOneIngredient(name: string): boolean {
  if (name === '') return false
  if (/[\n\r;|•*:]/.test(name)) return false // line breaks, other separators, footnotes, "May contain:"
  if (/\.\s/.test(name)) return false // a sentence or "1. Water"
  if (/^and\s/i.test(name)) return false // "..., and Niacinamide"
  // A comma followed by a letter outside parentheses is two names in one.
  if (/,\s*[A-Za-z]/.test(name.replace(/\([^)]*\)/g, ''))) return false
  return !isPollutedIngredientName(name)
}
