/**
 * Splits rendered article HTML at a heading boundary so a CTA can be rendered
 * BETWEEN two halves as a real React node — never injected into the HTML string.
 *
 * Why this exists (Aug 18 2026): the blog's only Yuri entry points rendered
 * AFTER the entire article body (median ~1,775 words). Blog traffic converts to
 * captured leads better than any other source, so a visitor had to finish a
 * ~2,000-word post before being offered the product.
 *
 * Why split rather than inject: the article HTML has already been through
 * `marked` AND `linkIngredients`. Injecting a marker string into it would mean
 * (a) a second pass over untrusted-shaped HTML, (b) risk of landing inside a
 * tag or an ingredient anchor, and (c) the CTA losing its React identity.
 * Splitting on a tag BOUNDARY and rendering two sibling divs keeps the prose
 * styles, the ingredient links, and hydration all intact.
 *
 * Boundary choice: the SECOND <h2>. Measured across all 46 published posts —
 * every post has >= 5 h2s (median 7), and this lands the CTA at a median 124
 * words / 6% into the article, never past 17%. The first <h2> is often at
 * index 0 (intro lives in the excerpt), which would put the CTA above any
 * content at all.
 */

/** Index of the Nth (1-based) top-level `<h2` tag start, or -1. */
function nthH2Index(html: string, n: number): number {
  const re = /<h2[\s>]/gi
  let m: RegExpExecArray | null
  let count = 0
  while ((m = re.exec(html)) !== null) {
    count++
    if (count === n) return m.index
  }
  return -1
}

export interface ArticleSplit {
  /** HTML before the insertion point. Never empty when `didSplit` is true. */
  head: string
  /** HTML after the insertion point. Never empty when `didSplit` is true. */
  tail: string
  /**
   * False when no safe boundary was found — callers MUST then render `head`
   * alone (it holds the full document) and skip the mid-article CTA. A split
   * that silently dropped `tail` would delete the article, so the flag is the
   * difference between "no CTA slot" and "no article".
   */
  didSplit: boolean
}

/**
 * Split article HTML for a mid-article insertion.
 *
 * Degrades safely: any post without a usable second <h2> returns the whole
 * document as `head` with `didSplit: false`. No content is ever lost.
 */
export function splitArticleForCta(html: string): ArticleSplit {
  if (!html) return { head: '', tail: '', didSplit: false }

  const idx = nthH2Index(html, 2)
  // Require real content on BOTH sides. A boundary at 0 would render the CTA
  // above the article; a boundary at the very end would render it on top of
  // the existing end-of-post CTA.
  if (idx <= 0 || idx >= html.length - 1) {
    return { head: html, tail: '', didSplit: false }
  }

  return { head: html.slice(0, idx), tail: html.slice(idx), didSplit: true }
}
