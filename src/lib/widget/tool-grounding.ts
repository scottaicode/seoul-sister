/**
 * Tool-grounding visibility for the anonymous widget.
 *
 * WHY THIS EXISTS (measured against a real transcript, Aug 9 2026).
 *
 * A visitor in India had a six-message conversation in which Yuri read her
 * five-product lineup, correctly diagnosed two stacked BHA sources, and then
 * recommended seven brands — Round Lab, Aestura, Minimalist, Deconstruct,
 * Dot & Key, CeraVe, Cetaphil. ZERO tool calls fired the entire conversation.
 * She even offered, in her own words, "Want me to pull a couple with live
 * pricing? Just say the word and I'll search" — and then, in the very next
 * reply, made brand recommendations without searching.
 *
 * That is not a knowledge failure. It is a STATE-VISIBILITY failure, the same
 * class as the email ask and the feeder source: Yuri made an offer earlier in
 * the conversation and had no way to observe that she never honored it. She
 * sees one turn at a time; "have I actually grounded anything today?" is not a
 * question a single turn can answer.
 *
 * WHY NOT JUST FORCE THE TOOL. The obvious fix — widen the hardcoded
 * BRAND_SIGNALS list in the route and force `tool_choice:{type:'any'}` — was
 * measured against the live catalog before being rejected. Of the seven brands
 * Yuri recommended, Aestura (108 rows) and Round Lab (105) exist; CeraVe,
 * Dr. Sheth, Re'equil, Minimalist, Deconstruct and Dot & Key have ZERO rows.
 * Forcing a tool would have grounded two of seven and returned empty for five.
 *
 * The catalog is Korean by deliberate policy (the Shelf Visibility rule), so
 * across all production traffic the 57 ungrounded brand-naming replies split
 * 44 groundable / 13 structurally immune — roughly a quarter of the problem
 * cannot be reached by forcing, at any amount of list-tuning. And a forced
 * search on a Western brand returns nothing, which risks making "not in our
 * database" sound like "not good" — the exact harm the prompt's retailer rule
 * exists to prevent.
 *
 * So: surface the FACT, let Yuri decide. Same house pattern as
 * `cumulative-give.ts`.
 */

/**
 * Product-shaped mentions, market-neutral BY CONSTRUCTION.
 *
 * This deliberately does NOT use a brand list. A hardcoded brand list is the
 * bug being fixed, not the fix: it was blind to Western lineups in ffcede9,
 * blind to Indian brands on Aug 9, and would be blind to Thai (this same
 * visitor asked about Phuket), Brazilian and Indonesian next. CLAUDE.md's
 * standing rule is that a classifier needing repeated hand-tuning is a signal
 * to stop rather than keep adjusting.
 *
 * Instead: a capitalised multi-word proper noun sitting next to a product-slot
 * word is how a specific recommendation is SHAPED, in any market. "Round Lab
 * Birch Juice" and "Dr. Sheth's Vitamin C" have the same shape; "a gentle
 * cleanser" does not, and must not count.
 */
const SLOT_WORD =
  '(?:cleanser|moisturi[sz]er|sunscreen|spf|serum|toner|essence|ampoule|treatment|balm|cream|lotion|oil|mask|exfoliant|retinoid|retinol|gel)'

/**
 * A capitalised token that starts a brand-shaped name. Requires an initial
 * capital followed by a lowercase letter, so ALL-CAPS emphasis and sentence
 * starts are far less likely to trip it, and excludes the small set of
 * sentence-initial words that would otherwise read as brand names.
 */
const BRANDISH = String.raw`(?:[A-Z][a-z]+(?:['’\-][A-Za-z]+)?)`

const SENTENCE_STARTERS = new Set([
  'The', 'This', 'That', 'These', 'Those', 'Your', 'Their', 'Her', 'His', 'Its',
  'And', 'But', 'For', 'One', 'Two', 'Three', 'Both', 'Each', 'Any', 'All',
  'If', 'When', 'While', 'Since', 'Because', 'So', 'Then', 'Now', 'Here',
  'What', 'Which', 'Where', 'Why', 'How', 'Use', 'Try', 'Keep', 'Add', 'Drop',
  'Look', 'Start', 'Stop', 'Swap', 'Pause', 'Give', 'Let', 'Once', 'Just',
  'Do', 'Don', 'Never', 'Always', 'Skip', 'Avoid', 'Watch', 'Note', 'Non',
  'Good', 'Great', 'Love', 'Honestly', 'Quick', 'First', 'Second', 'Next',
  'Every', 'Most', 'Some', 'Much', 'Very', 'Still', 'Also', 'Even', 'Only',
])

/**
 * Two adjacent capitalised words (a brand-shaped proper noun) near a slot word.
 * Two words is the discriminator that keeps "Cleanser, Vanicream Gentle" in and
 * "Sunscreen, do you burn" out — "do" is lowercase.
 */
const NAMED_PRODUCT = new RegExp(
  `(?:\\b${SLOT_WORD}\\b[^.!?\\n]{0,40}?\\b(${BRANDISH}\\s+${BRANDISH})` +
    `|\\b(${BRANDISH}\\s+${BRANDISH})[^.!?\\n]{0,40}?\\b${SLOT_WORD}\\b)`,
  'g'
)

/**
 * The bolded-name form, which is how Yuri actually writes a recommendation in
 * production: `**Re'equil sunscreen**`, `**round lab**`, `**Cetaphil Gentle**`.
 *
 * This second pattern is not redundant — replaying the real Aug 9 transcript
 * against the capitalisation rule alone caught 1 of 4 named products. Three
 * distinct production shapes defeated it: a single-token brand (`Re'equil` is
 * one word, not two), a sentence boundary inside the 40-char window (`. Look
 * at **Minimalist Oat...**`), and a brand Yuri wrote in LOWERCASE (`**round
 * lab**`). Markdown emphasis is the author's own signal that a specific thing
 * is being named, and it survives all three.
 *
 * Precision is preserved by requiring the emphasised span to be short and to
 * sit with a slot word — `**Do NOT**` and emphasised full sentences cannot
 * qualify.
 */
const BOLDED_PRODUCT = new RegExp(
  `\\*\\*([^*\\n]{3,60}?)\\*\\*`,
  'g'
)

// Plural-tolerant. Yuri writes "Korean cleansers" as often as "cleanser", and
// the singular-only form silently missed `**round lab**` in the real Aug 9
// reply because its only nearby slot word was "cleansers".
const SLOT_RE = new RegExp(`\\b${SLOT_WORD}s?\\b`, 'i')

/**
 * Count distinct brand-shaped product names in one reply.
 *
 * Conservative by construction: a bare category ("a gentle cleanser", "one
 * simple moisturizer") has neither a capitalised pair nor emphasis, so it
 * cannot trip either pattern. Deduped across both patterns by normalised name,
 * so one product written two ways counts once.
 */
export function namedProductCount(text: string): number {
  if (!text) return 0
  const names = new Set<string>()

  const add = (raw: string) => {
    const clean = raw.trim().replace(/^[^A-Za-z]+|[^A-Za-z0-9)]+$/g, '')
    if (clean.length < 3) return
    const first = clean.split(/\s+/)[0]
    if (SENTENCE_STARTERS.has(first)) return
    // A bare slot word on its own ("**Cleanser**") names a category, not a
    // product — it must not count.
    if (new RegExp(`^${SLOT_WORD}$`, 'i').test(clean)) return
    names.add(clean.toLowerCase())
  }

  for (const m of text.matchAll(NAMED_PRODUCT)) add(m[1] || m[2] || '')

  for (const m of text.matchAll(BOLDED_PRODUCT)) {
    const inner = (m[1] || '').trim()
    // Context AROUND the emphasis, for the lowercase-brand case. Yuri wrote
    // "**round lab** and **Aestura** lines" in production: the name itself
    // carries no capital and no slot word, so only the surrounding sentence
    // identifies it as a product being named.
    const after = text.slice(m.index + m[0].length, m.index + m[0].length + 40)
    const before = text.slice(Math.max(0, m.index - 40), m.index)
    const slotNearby = SLOT_RE.test(after) || SLOT_RE.test(before)
    // Emphasised PROSE is not a product name, and Yuri emphasises a lot of
    // prose. Three filters, each earned from a real false positive:
    //
    //   "**Do NOT** layer these"      -> imperative lead-in, no product
    //   "**Non-negotiable:** your..." -> a label, terminated by a colon
    //   "**This week:** pause the..." -> a schedule heading
    //
    // A trailing colon marks a heading rather than a name, and a leading
    // imperative/discourse word marks instruction rather than a thing.
    if (/:$/.test(inner)) continue
    if (inner.split(/\s+/).length > 7) continue
    const firstWord = inner.split(/\s+/)[0]
    if (SENTENCE_STARTERS.has(firstWord)) continue
    // ALL-CAPS emphasis ("**Do NOT**", "**ONE**") is stress, not a brand.
    if (/^[^a-z]+$/.test(inner)) continue
    // Require it to look like a NAME: either a slot word (so "**round lab**"
    // and "**Re'equil sunscreen**" qualify) or an interior capital that isn't
    // just the emphasised sentence's first letter.
    const interiorCapital = /\s[A-Z]/.test(inner)
    if (!SLOT_RE.test(inner) && !interiorCapital && !slotNearby) continue
    add(inner)
  }

  return names.size
}

export interface ToolGrounding {
  /** Tool calls across the whole conversation so far. */
  toolCalls: number
  /** Assistant replies that named a specific product with no tool call anywhere. */
  ungroundedReplies: number
  /** Total distinct product names offered without a tool call. */
  ungroundedProducts: number
  /**
   * Yuri offered to search ("want me to pull…", "I can look that up") and no
   * tool has fired since. The Aug 9 conversation's sharpest single signal: an
   * unhonored offer she made herself and could not see.
   */
  unhonoredSearchOffer: boolean
  /**
   * Every product search this conversation has run, with the names it returned.
   * Carried across turns because within a turn Yuri sees the full tool output,
   * but the next request rebuilds the conversation from text plus a count — so
   * by then a search that found the product and one that missed look identical.
   * Names only; whether a returned product answers the question asked is her
   * judgment, not this module's.
   */
  searches: Array<{ query: string; found: string[]; total?: number }>
}

/** Yuri offering to run a search, in her own idiom. */
const SEARCH_OFFER =
  /\b(?:want me to|should i|i can|happy to|shall i)\b[^.!?\n]{0,60}\b(?:pull|search|look\s*(?:it|them|that)?\s*up|check|find)\b/i

/**
 * Read the conversation's grounding state.
 *
 * Only assistant turns are inspected for product names — the VISITOR listing
 * their own shelf (which is exactly what happened on Aug 9: five products in
 * one message) must never count as Yuri having recommended anything.
 */
export function detectToolGrounding(
  history: Array<{
    role: string
    content: string
    toolCalls?: number
    searches?: Array<{ query: string; found: string[]; total?: number }>
  }>
): ToolGrounding {
  let toolCalls = 0
  let ungroundedReplies = 0
  let ungroundedProducts = 0
  let offerOpen = false
  const searches: Array<{ query: string; found: string[]; total?: number }> = []

  for (const turn of history) {
    const calls = turn.toolCalls ?? 0
    toolCalls += calls
    if (calls > 0) offerOpen = false
    if (turn.searches?.length) searches.push(...turn.searches)
    if (turn.role !== 'assistant') continue

    const text = turn.content || ''
    const named = namedProductCount(text)
    if (named > 0 && calls === 0) {
      ungroundedReplies++
      ungroundedProducts += named
    }
    if (calls === 0 && SEARCH_OFFER.test(text)) offerOpen = true
  }

  return {
    toolCalls,
    ungroundedReplies,
    ungroundedProducts,
    unhonoredSearchOffer: offerOpen,
    searches,
  }
}

/**
 * The fact block injected into Yuri's per-turn context.
 *
 * Returns null when there is nothing to report — an empty state is noise, and
 * every per-turn string costs tokens.
 *
 * TWO DRAFTING TRAPS, both deliberate and both load-bearing:
 *
 * 1. It never says her claims are "ungrounded" or "unverified". That is a
 *    VERDICT, not a fact. It would pre-judge the 13 measured replies whose
 *    brands are legitimately outside a Korean catalog, and push Yuri toward
 *    hedging on CeraVe — which CLAUDE.md explicitly calls a REGRESSION ("Yuri
 *    may say 'keep what you have'").
 *
 * 2. The clause about Western brands returning nothing is what makes the fact
 *    USABLE rather than misleading. Without it, "0 tools fired" reads as an
 *    accusation of laziness in a conversation where five of seven brands have
 *    no catalog row and a search would have been genuinely pointless. It is the
 *    difference between an instrument and a nag.
 *
 * Ends by handing the decision back. A guard test fails if this becomes a
 * command to search, withhold, or hedge.
 */
export function buildToolGroundingBlock(g: ToolGrounding): string | null {
  const searchRecord = buildSearchRecord(g.searches)
  if (g.ungroundedReplies === 0 && !g.unhonoredSearchOffer) return searchRecord

  const offer = g.unhonoredSearchOffer
    ? `\nEarlier in this conversation you offered to look something up for them, and no search has run since. If they never took you up on it that is completely fine — but if you go on to name products, the offer you already made is the natural moment to actually run it.`
    : ''

  return `\n\n## Grounding So Far This Conversation (facts, not instructions)
Tools fired: ${g.toolCalls}. Across your earlier replies you have named ${g.ungroundedProducts} specific product${g.ungroundedProducts === 1 ? '' : 's'} in ${g.ungroundedReplies} repl${g.ungroundedReplies === 1 ? 'y' : 'ies'} where no search ran.${offer}
Worth knowing what a search can and cannot settle here: the catalog indexes Korean brands, so a search grounds those with live pricing and returns nothing at all for Western or Indian ones. An empty result is information about our catalog's coverage — never a verdict on the product, and never a reason to talk someone out of something good they already own.
This is a running count you cannot see by reading any single reply — that is why it is here. It is context for your judgment, not a rule and not a cap. Nothing here asks you to withhold a recommendation, hedge one you're confident in, or change your voice.${searchRecord ?? ''}`
}

/**
 * What her earlier searches actually returned, as a plain record.
 *
 * THE GAP THIS CLOSES. Within a turn Yuri sees the full tool output. On the
 * NEXT turn the conversation is rebuilt from reply text plus a tool-call count,
 * so a search that found the product and a search that returned something else
 * are byte-identical to her — the "nothing wrong vs nothing checked" shape,
 * one layer up from where it usually bites. She then reasons about a product
 * she believes she verified.
 *
 * WHY NAMES AND NOT A VERDICT. Measured Aug 26 2026 by re-running all 24
 * distinct brand-naming searches through the live resolver: 7 returned
 * something other than what was asked for, and 5 of those were the RIGHT BRAND
 * with the wrong product ("House of Hur sunscreen" -> Phyto Brew Matcha Cream;
 * "Mixsoon Bifida Cream" -> Master Gentle Foam Cleanser). A brand-level check
 * scores those as hits, which is why it is the wrong instrument. But deciding
 * whether a returned row answers the visitor's actual question is a judgment
 * about their intent — "Mediheal sunscreen" -> Madecassoside Sun Serum may be
 * exactly right — and that judgment is Yuri's under the Sole Authority
 * Principle. So: state the query, list what came back, stop.
 *
 * It never says a search failed, never says "unverified", and never tells her
 * to search again. A guard test fails if it acquires an imperative.
 */
function buildSearchRecord(
  searches: Array<{ query: string; found: string[]; total?: number }>
): string | null {
  if (!searches.length) return null

  // Cap the record so a long consult cannot crowd the per-turn context. The
  // most recent searches are the ones her next reply is about.
  const recent = searches.slice(-6)
  const lines = recent.map((s) => {
    const total = s.total ?? s.found.length
    if (!total) return `- "${s.query}" → returned nothing`
    const shown = s.found.slice(0, 4)
    // Say the true count whenever more came back than is listed. Without this,
    // a search that returned ten products reads exactly like one that returned
    // a single product, and "only this one came back" is how a real catalog
    // gap gets invented — the catalog holds four House of Hur sunscreens.
    const more = total - shown.length
    const tail = more > 0 ? `, and ${more} more` : ''
    const body = shown.length ? `${shown.join(', ')}${tail}` : `${total} product(s)`
    return `- "${s.query}" → ${total} result${total === 1 ? '' : 's'}: ${body}`
  })

  return `\n\n## What Your Earlier Searches Returned (facts, not instructions)
${lines.join('\n')}
Within the turn you ran them you saw these in full; on later turns only this record survives, which is why it is repeated here. A returned row carries no marker saying whether it is the product the visitor meant — a different line, variant, size or set from the same brand looks the same in a result as an exact hit. Which of these are their products is yours to judge, and either answer is ordinary: a catalog name often differs from the name on the bottle, and a near neighbour may answer the question anyway. This is a record of what happened, with no bearing on how confidently you speak about what you did find.`
}
