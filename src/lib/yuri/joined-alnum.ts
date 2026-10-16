/**
 * Word-number seams in product search terms ("atobarrier365" -> ["atobarrier", "365"]).
 *
 * THE DEFECT (Oct 6 2026, production). A subscriber pasted the Olive Young link
 * for AESTURA AtoBarrier 365 Cream. Yuri searched "AtoBarrier365 Cream" three
 * times and told her "it isn't surfacing in our catalog... a catalog gap on our
 * end". The catalog stores "Atobarrier 365 Cream" (verified). `%atobarrier365%`
 * cannot match "atobarrier 365", so the precise strategies missed, the loose one
 * returned other Aestura creams, and her product was saved as a custom entry.
 * Joined forms of Heartleaf 77, Derma 365, PHA 30 and Molecule 300 failed the
 * same way. The reverse (spaced query, joined catalog name) already worked.
 *
 * Bounded to 3+ letters against 2+ digits so short codes stay exact: "b5",
 * "c20", "10ml" are untouched. Line numbers ("No.9") never reach here: dots are
 * flattened first and the digit is carried separately.
 *
 * Callers pass an already-normalized (lowercased, stemmed) term.
 */
export function joinedAlnumParts(term: string): string[] {
  return term.split(/(?<=[a-z]{3})(?=\d{2})|(?<=\d{2})(?=[a-z]{3})/)
}

/**
 * True when the term's parts appear in order, adjacent, optionally separated by
 * space/dot/hyphen.
 *
 * A number must end where the catalog's number ends: "pdrn10" must NOT match
 * "PDRN 100". Without that boundary a review (Oct 16 2026) showed "Anua PDRN10
 * toner" resolving to the PDRN 100 toner as `all_terms`, which write paths
 * accept. The leading edge is bounded too ("atobarrier365" is not inside
 * "xatobarrier 365"). A trailing word is left open so stems still work.
 */
export function joinedAlnumMatches(haystack: string, term: string): boolean {
  const parts = joinedAlnumParts(term)
  if (parts.length < 2) return false
  const escaped = parts.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  const isDigits = (p: string) => /^\d/.test(p)
  const lead = isDigits(parts[0]) ? '(?<!\\d)' : '(?<![a-z])'
  const tail = isDigits(parts[parts.length - 1]) ? '(?!\\d)' : ''
  return new RegExp(lead + escaped.join('[\\s.\\-]*') + tail).test(haystack)
}

/** ILIKE body: the term with `%` at its word/number seams. */
export function joinedAlnumIlike(term: string): string {
  return joinedAlnumParts(term).join('%')
}
