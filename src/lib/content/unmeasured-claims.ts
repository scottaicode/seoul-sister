/**
 * Sentences that present a number or a "users report" claim as something
 * Seoul Sister measured (Nov 14 2026).
 *
 * The ingredient guides (`ss_ingredients.rich_content`) and some blog posts
 * were written by a model that was handed our 47 launch estimates as if they
 * were data. It wrote sentences such as "Seoul Sister users with sensitive skin
 * report 79% effectiveness for hyperpigmentation" and "Seoul Sister data shows
 * 92% effectiveness for redness". Nobody reported or measured that. Those
 * sentences sit in the page body, the meta description and the FAQ data search
 * engines quote, and Yuri's ingredient tool hands the same text to her.
 *
 * This drops such sentences where the text is READ, so it also covers a guide
 * regenerated tomorrow and a post the blog system re-sends. It is not a
 * substitute for correcting the stored text; that is still owed.
 *
 * The shapes below are deliberately narrow. "Avobenzone loses up to 50%
 * effectiveness within an hour", "30% more effective" and "most users notice a
 * change in 4-6 weeks" are ordinary statements and are kept.
 *
 * No imports, so the test runs this file as it is.
 */
// Each entry is a shape, with the sentence it was written for. A sentence that
// only COUNTS products in our catalog ("Seoul Sister data shows it appears in
// 19 products") or cites a study ("1-2% of users may react") is not a claim
// about what we measured and is kept.
const SS = /\bSeoul Sister(?:['’]s)?\b/i
const CLAIM_SHAPES: Array<(s: string) => boolean> = [
  // "Seoul Sister users report ...", "rated 5.0/5 by Seoul Sister users"
  (s) => /\bSeoul Sister(?:['’]s)?\s+(?:users?|community|members?|subscribers?)\b/i.test(s) && /\b(report|reports|reported|reporting|rate|rated|ratings?|say|found|experience|experienced|saw|see)\b/i.test(s),
  // "Seoul Sister data shows 92% ...", "Seoul Sister's database ... user ratings average ..."
  (s) => SS.test(s) && /\b(data|database)\b/i.test(s) && (/%/.test(s) || /\beffective(ness)?\b/i.test(s) || /\buser ratings?\b/i.test(s)),
  (s) => /\bcommunity effectiveness\b/i.test(s),
  (s) => /\beffectiveness (?:data|scores?|ratings?)\b/i.test(s),
  (s) => /\buser reports?\s+(?:showing|show|shows|of|indicate|indicating)\b/i.test(s) || /\baccording to user reports\b/i.test(s),
  // "92% effectiveness for redness", "84-88% effectiveness across skin types", "(68% effectiveness)"
  (s) => /\d+(?:\s*[-–]\s*\d+)?%\s*(?:effective|effectiveness)(?:\s+(?:for|on|in|across|and|with|among)\b|\s*\))/i.test(s),
  // "scores 86% effective", "is most effective for normal skin (84%)"
  (s) => /\bscores?\s+\d+%/i.test(s),
  (s) => /\beffective for [a-z ,-]+\(\d+%\)/i.test(s),
]

export function isUnmeasuredClaim(sentence: string): boolean {
  return CLAIM_SHAPES.some((shape) => shape(sentence))
}

// A full stop after one of these is not the end of a sentence. Splitting there
// left "9 NAD Bio Lifting-sil Essence (4.9/5) demonstrating..." on a live page
// (after "Numbuzin's No.") and "Jart+ Cicapair..." (after "Dr.").
const ABBREVIATION = /(?:^|[\s(])(?:No|Dr|Mr|Mrs|Ms|St|vs|etc|approx|e\.g|i\.e)\.$/i

/** Sentences of one block of text. Dots inside links, numbers and abbreviations are not boundaries. */
export function sentencesOf(block: string): string[] {
  const pieces = block.trim().split(/(?<=[.!?]["”')\]]?)\s+(?=["“(\[*_]*[A-Z0-9])/)
  const out: string[] = []
  for (const piece of pieces) {
    if (out.length && ABBREVIATION.test(out[out.length - 1])) out[out.length - 1] += ' ' + piece
    else out.push(piece)
  }
  return out
}

/**
 * The text with such sentences removed. Paragraph breaks are kept.
 */
export function withoutUnmeasuredClaims(text: string | null | undefined): string {
  if (!text) return ''
  return text
    .split(/(\n+)/)
    .map((block) => {
      if (/^\n+$/.test(block) || !block.trim()) return block
      const lead = block.match(/^\s*/)?.[0] ?? ''
      const kept = sentencesOf(block).filter((sentence) => !isUnmeasuredClaim(sentence))
      return kept.length ? lead + kept.join(' ') : ''
    })
    .join('')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** How many sentences would be dropped, for measuring before trusting it. */
export function unmeasuredClaimsIn(text: string | null | undefined): string[] {
  if (!text) return []
  return text
    .split(/\n+/)
    .flatMap((block) => (block.trim() ? sentencesOf(block) : []))
    .filter((s) => s && isUnmeasuredClaim(s))
}

/** The shape of an ingredient guide as stored in `ss_ingredients.rich_content`. */
interface GuideLike {
  overview?: string
  how_it_works?: string
  history_origin?: string
  skin_types?: Record<string, string>
  usage_tips?: string[]
  faq?: Array<{ question: string; answer: string }>
}

/**
 * A guide with unmeasured claims removed from every text field. A tip or an
 * FAQ answer left empty is dropped, so nothing renders as a heading over
 * nothing. Unknown fields pass through untouched.
 */
export function cleanGuide<T extends GuideLike>(guide: T | null | undefined): T | null {
  if (!guide) return null
  const out: T = { ...guide }
  if (typeof guide.overview === 'string') out.overview = withoutUnmeasuredClaims(guide.overview)
  if (typeof guide.how_it_works === 'string') out.how_it_works = withoutUnmeasuredClaims(guide.how_it_works)
  if (typeof guide.history_origin === 'string') out.history_origin = withoutUnmeasuredClaims(guide.history_origin)
  if (guide.skin_types && typeof guide.skin_types === 'object') {
    out.skin_types = Object.fromEntries(
      Object.entries(guide.skin_types)
        .map(([type, text]) => [type, typeof text === 'string' ? withoutUnmeasuredClaims(text) : text])
        .filter(([, text]) => text)
    )
  }
  if (Array.isArray(guide.usage_tips)) {
    out.usage_tips = guide.usage_tips.map((tip) => (typeof tip === 'string' ? withoutUnmeasuredClaims(tip) : tip)).filter(Boolean)
  }
  if (Array.isArray(guide.faq)) {
    out.faq = guide.faq
      .map((item) => ({ ...item, answer: typeof item?.answer === 'string' ? withoutUnmeasuredClaims(item.answer) : item?.answer }))
      .filter((item) => item.answer)
  }
  return out
}

/**
 * The pairings (ingredient, concern, skin type) worth stating as a common use.
 * The four estimates below this line are the cautions: tea tree oil (0.58),
 * retinol (0.62), salicylic acid (0.65) and vitamin C (0.68), each for
 * SENSITIVE skin. Shown without their number they read as endorsements, so
 * they are not shown. Everything from 0.70 up is ordinary guidance (niacinamide
 * for redness in sensitive skin, centella for acne in oily skin).
 */
export const COMMON_USE_FLOOR = 0.7

export function commonUses<T extends { effectiveness_score: number }>(rows: readonly T[] | null | undefined): T[] {
  return (rows ?? []).filter((row) => typeof row.effectiveness_score === 'number' && row.effectiveness_score >= COMMON_USE_FLOOR)
}
