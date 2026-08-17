/**
 * Cumulative give — what Yuri has ALREADY handed this visitor.
 *
 * See WIDGET-CUMULATIVE-GIVE-BLUEPRINT.md for the full rationale.
 *
 * The problem this solves: the preview's gate ("the complete build is subscriber
 * work") is a CUMULATIVE boundary, but Yuri only ever sees one turn at a time.
 * In a real 14-message test she delivered a full AM/PM routine, a weekly
 * rotation, a shelf audit, three priced picks, and a conflict-check — no single
 * reply crossed the line, but the sum was the entire subscriber deliverable. She
 * was asked to hold a boundary she had no instrument to measure.
 *
 * This module is that instrument. It reads Yuri's OWN ALREADY-SENT replies and
 * reports which artifacts of the complete build have appeared. The result is
 * injected as a FACT into her next turn's context.
 *
 * What this is NOT, and must never become:
 *   - a content filter (nothing here blocks, truncates, or rewrites output)
 *   - a hard cap (no "after N artifacts, refuse")
 *   - a check on drafts before sending (it only ever looks backwards)
 * It observes and reports. What to do about it is Yuri's judgment, every time.
 * A false positive costs at most a slightly conservative note she is free to
 * disregard — it can never suppress an answer.
 */

/** The artifacts the system prompt's gate names as "the complete build". */
export type GiveArtifact =
  | 'am_pm_routine'
  | 'weekly_schedule'
  | 'slot_picks'
  | 'lineup_conflict_check'
  | 'shelf_audit'

export const GIVE_ARTIFACT_COUNT = 5

/** Human-readable phrasing, used verbatim in the injected fact. */
const ARTIFACT_LABEL: Record<GiveArtifact, string> = {
  am_pm_routine: 'a full AM/PM routine',
  weekly_schedule: 'a weekly rotation or multi-week introduction schedule',
  slot_picks: 'specific product picks for multiple routine slots',
  lineup_conflict_check: 'a conflict-check of their existing lineup',
  shelf_audit: 'a keep/cut/add audit of their shelf',
}

/**
 * Detection notes: these patterns are deliberately conservative — they look for
 * the STRUCTURAL shape of a delivered artifact (an AM block AND a PM block; a
 * per-night rotation; explicit keep-vs-cut framing), not for topic keywords.
 * Merely discussing sunscreen must not count as delivering a routine.
 */

// A routine is delivered when BOTH halves of the day are laid out as steps.
const AM_BLOCK = /\b(?:AM|morning)\b[^\n]{0,80}(?::|—|-|→)/i
const PM_BLOCK = /\b(?:PM|night|evening|nightly)\b[^\n]{0,80}(?::|—|-|→)/i
// Step sequencing: "cleanse → toner → sunscreen"
const STEP_ARROWS = /(?:→|->)[^\n]*(?:→|->)/

// A schedule: named nights, or explicit weekly frequency, or a staged rollout.
const NIGHT_ROTATION = /\bnight\s*(?:a|b|c|1|2|3)\b/i
const WEEKLY_FREQUENCY = /\b\d\s*(?:x|times)\s*(?:\/|\s*per\s*|a\s*)?(?:wk|week)\b/i
const STAGED_ROLLOUT = /\b(?:two\s+weeks?|2\s*weeks?)\s+apart\b|\bone\s+(?:new\s+)?active\s+at\s+a\s+time\b/i

// Picks for slots: multiple distinct priced/named recommendations.
const PRICE_TOKEN = /\$\d/g

// A recommendation is not always priced. Western/drugstore picks never are —
// our price feeds are Korean, so a Target/Ulta lineup carries zero `$` tokens.
//
// WHY THIS EXISTS (measured against two real transcripts, Aug 8 2026). A cold
// 20-year-old from Bailey's TikTok was handed a Korean reset lineup, then a
// COMPLETE second lineup rebuilt for Target/Ulta, then a THIRD revision of that
// lineup re-textured for clog-prone skin — three full builds across four turns.
// The instrument scored her 1/5 and never injected the block once, because the
// two rebuilds that constitute the over-give contained no dollar signs. The
// same day, Suzy — whose conversation was correctly calibrated — scored 3/5 and
// got the block from her third message onward. The instrument ranked the two
// conversations exactly backwards.
//
// The blind spot sits precisely where the Western Shelf rule sends Yuri: a
// Korean recommendation was instrumented and the identical Western one was
// invisible. Two correct policies interacting to produce a measurement hole.
//
// So detect the SLOT, not the price tag. A routine slot is named in the
// recommendation's own structure ("**Cleanser, Vanicream...**", "Moisturizer —
// CeraVe..."), which is how Yuri actually writes a lineup. Conservative by
// construction: it requires the slot word to introduce a named product, so
// discussing sunscreen in prose cannot trip it.
const SLOT_WORD =
  '(?:cleanser|moisturi[sz]er|sunscreen|spf|serum|toner|essence|ampoule|treatment|balm|cream|lotion|oil|mask|exfoliant|retinoid|retinol)'

// A slot heading that introduces a product: the slot word, a separator, then an
// actual BRAND. Requiring a brand is what separates a delivered lineup from
// prose — "gentle cleanser, one simple moisturizer, daily sunscreen" is generic
// advice about categories, while "Cleanser, Vanicream Gentle Facial Cleanser"
// hands over a specific thing to go buy. A first pass matched any capitalised
// word after the separator and fired on "sunscreen, do you burn" and "cleanser,
// one simple moisturizer" — noise that would teach Yuri to discount the block.
//
// The brand list is the cost of that precision, and it is the honest tradeoff:
// a lineup of brands we've never seen goes uncounted (a false negative, which
// costs one missing note) rather than prose counting as a build (a false
// positive, which costs the instrument's credibility). Brands are drawn from
// what Yuri actually recommends — the Korean catalog's frequent names plus the
// Western drugstore set the Western Shelf rule explicitly permits.
const KNOWN_BRANDS = [
  // Western / drugstore — the set that was invisible before this fix
  'cerave', 'vanicream', 'la roche-posay', 'la roche posay', 'cicaplast',
  'anthelios', 'cetaphil', 'byoma', 'naturium', 'prequel', 'eucerin',
  'aveeno', 'neutrogena', 'differin', 'paula\'s choice', 'the ordinary',
  'panoxyl', 'cocokind', 'good molecules', 'first aid beauty',
  // Korean — frequent catalog names
  'cosrx', 'skin1004', 'beauty of joseon', 'anua', 'round lab', 'torriden',
  'laneige', 'innisfree', 'medicube', 'numbuzin', 'some by mi', 'aestura',
  'real barrier', 'dr. jart', 'dr jart', 'etude', 'missha', 'sulwhasoo',
  'thank you farmer', 'skin&lab', 'skin & lab', 'celimax', 'goodal',
  'illiyoon', 'purito', 'isntree', 'mixsoon', 'tirtir', 'abib', 'haruharu',
  'benton', 'klairs', 'pyunkang yul', 'hanyul', 'aromatica', 'melixir',
  'beplain', 'i\'m from', 'axis-y', 'mediheal', 'physiogel', 'arencia',
  'aprilskin', 'april skin', 'heimish', 'banila co', 'sioris', 'peach & lily',
]

const BRAND_ALTERNATION = KNOWN_BRANDS
  .map((b) => b.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|')

// "Cleanser, Vanicream ...", "Moisturizer — CeraVe ...", "Sunscreen: SKIN1004 ..."
const SLOT_WITH_PRODUCT = new RegExp(
  `\\b${SLOT_WORD}\\b\\s*(?:,|:|—|–|-|=)\\s*\\*{0,2}(?:the\\s+|a\\s+)?(?:${BRAND_ALTERNATION})\\b`,
  'gi'
)

/**
 * A PRESCRIPTIVE SEQUENCE: a routine handed over as an arrow chain.
 *
 * WHY THIS EXISTS (measured Aug 17 2026, session 3132e3ee). A visitor in Seoul
 * listed ~11 products she ALREADY OWNED and asked whether they work together.
 * Yuri delivered a full AM sequence, a full PM retinol sequence with buffering,
 * an off-nights routine, a 2x/week ramp, and a stop-repurchasing list — the
 * subscriber deliverable — and `lineupBuilds` stayed at **0** the whole time.
 *
 * `SLOT_WITH_PRODUCT` above requires a slot word, a SEPARATOR, then a brand
 * ("Cleanser: CeraVe"). Yuri's actual delivery shape was an arrow chain:
 *
 *     cleanse → Sulwhasoo water → IOPE retinol → AESTURA smoothing cream
 *
 * Arrows chain products with no separator, so nothing matched. The instrument
 * assumed over-giving means RECOMMENDING things to buy; this visitor owned
 * everything, so Yuri never built a lineup, she REORGANIZED one — the same
 * deliverable in a shape the counter could not see. Measured across the corpus:
 * this shape appears in 5 of 19 deep conversations (26%), including one with
 * five separate sequence deliveries. Not a one-off.
 *
 * NO BRAND LIST, deliberately. `KNOWN_BRANDS` failed here twice over — the
 * shape didn't match, and IOPE isn't even in the list. That list is a
 * documented fragility (it was blind to Western brands until Aug 8, blind to
 * Indian ones after, and would be blind to Thai next). Here the visitor's own
 * products capitalise themselves, so the signal is market-neutral by
 * construction and needs no maintenance as new markets appear.
 *
 * The stop-list enumerates the NEUTRAL words (a closed set of skincare
 * acronyms, step nouns and sentence-openers), never the "bad" thing — per
 * CLAUDE.md, ban the shape, not yesterday's vocabulary.
 *
 * DISCUSSING vs DELIVERING falls out of capitalisation. Order-of-operations
 * prose uses lowercase categories ("toner → serum → cream": zero brand-like
 * caps, no fire). A delivered schedule names actual products ("cleanse →
 * Sulwhasoo water → IOPE retinol": fires). Requiring TWO distinct capitalised
 * tokens on one line is what separates a handed-over routine from a sentence
 * that happens to contain an arrow.
 *
 * Measured precision: fires on 23 of 307 assistant replies (7.5%), and the
 * triggering lines are overwhelmingly genuine routine deliveries.
 */
const SEQUENCE_STOP_WORDS = new Set([
  // Skincare acronyms and units that are legitimately capitalised
  'AM', 'PM', 'SPF', 'UV', 'BHA', 'AHA', 'PHA', 'LED', 'HA', 'PA', 'TXA', 'INCI',
  // Step/category nouns — a routine step is not a product name
  'Vitamin', 'Water', 'Retinol', 'Retinal', 'Cleanse', 'Cleanser', 'Toner',
  'Serum', 'Cream', 'Essence', 'Ampoule', 'Sunscreen', 'Moisturizer',
  'Moisturiser', 'Oil', 'Mask', 'Balm', 'Lotion', 'Exfoliant', 'Niacinamide',
  // Time words
  'Night', 'Nights', 'Morning', 'Day', 'Days', 'Week', 'Weeks', 'Daily',
  // Sentence-openers and discourse words that carry a capital by position only
  'Start', 'Then', 'Next', 'Wait', 'Off', 'Apply', 'Use', 'Add', 'No', 'The',
  'If', 'Your', 'This', 'That', 'And', 'But', 'Skip', 'Keep', 'When', 'Here',
  'Just', 'Only', 'Both', 'Most', 'Also', 'Even', 'Once', 'During', 'After',
  'Before', 'Nothing', 'Buffer', 'Ramp', 'Burn', 'Anything', 'Let', 'Want',
  'Done', 'Never', 'Move', 'Cleaner', 'You', 'Honestly', 'Finish', 'Swap',
])

/** A capitalised token that looks like a product or brand name. */
const SEQUENCE_BRANDISH = /\b([A-Z][a-z]{2,}|[A-Z]{3,})\b/g

/**
 * True when any single line is a chain of 2+ arrows naming 2+ distinct
 * product-like tokens — i.e. a routine delivered, not an order discussed.
 */
function hasPrescriptiveSequence(text: string): boolean {
  for (const line of text.split('\n')) {
    const arrows = (line.match(/→|->/g) || []).length
    if (arrows < 2) continue
    const named = new Set<string>()
    for (const m of line.matchAll(SEQUENCE_BRANDISH)) {
      if (!SEQUENCE_STOP_WORDS.has(m[1])) named.add(m[1].toLowerCase())
    }
    if (named.size >= 2) return true
  }
  return false
}

// Conflict checking across their lineup.
const CONFLICT_LANGUAGE =
  /\b(?:same job|do(?:ing)? the same|redundant|duplicat|don'?t (?:need|use) both|collide|stack(?:ing)? (?:two|both)|overlap)\b/i

// Keep / cut / add scorecard.
const KEEP_CUT_ADD =
  /\b(?:keep(?:ers?)?\s*(?:as-is)?\b[^\n]{0,40}\b(?:cut|drop|add)|cut back|keep\/cut\/add|scorecard)\b/i

/** Count distinct `$nn` price mentions in one reply. */
function pricedPickCount(text: string): number {
  const matches = text.match(PRICE_TOKEN)
  return matches ? matches.length : 0
}

/**
 * Count DISTINCT routine slots that were filled with a named product in one
 * reply. Deduped by slot, so "CeraVe Moisturizing Cream or La Roche-Posay
 * Cicaplast" under one Moisturizer heading counts once — offering two options
 * for one slot is a choice, not two slots of a build.
 */
export function namedSlotPickCount(text: string): number {
  if (!text) return 0
  const slots = new Set<string>()
  for (const m of text.matchAll(SLOT_WITH_PRODUCT)) {
    const slotWord = m[0].match(new RegExp(SLOT_WORD, 'i'))
    if (slotWord) slots.add(slotWord[0].toLowerCase())
  }
  return slots.size
}

/**
 * Which artifacts appear in a SINGLE assistant reply.
 * Exported for testing; callers should use detectCumulativeGive().
 */
export function detectArtifactsInReply(text: string): Set<GiveArtifact> {
  const found = new Set<GiveArtifact>()
  if (!text) return found

  // Full routine: both halves of the day laid out, or explicit step sequencing
  // present alongside at least one labelled half.
  const hasAm = AM_BLOCK.test(text)
  const hasPm = PM_BLOCK.test(text)
  if ((hasAm && hasPm) || ((hasAm || hasPm) && STEP_ARROWS.test(text))) {
    found.add('am_pm_routine')
  }

  if (NIGHT_ROTATION.test(text) || WEEKLY_FREQUENCY.test(text) || STAGED_ROLLOUT.test(text)) {
    found.add('weekly_schedule')
  }

  // Picks for multiple slots — priced OR named. Two priced mentions was the
  // original signal and stays; it misses every unpriced (Western) lineup, so
  // two distinct slots filled with named products counts equally. Same
  // threshold, so a single pick for their #1 gap — which the policy explicitly
  // permits — still does not trip it.
  //
  // A PRESCRIPTIVE SEQUENCE counts equally. Both signals above look for picks
  // being RECOMMENDED — priced mentions, or slot headings naming a brand. A
  // visitor who already owns everything gets the same deliverable with neither:
  // her own products, sequenced into a routine. That shape ("cleanse →
  // Sulwhasoo water → IOPE retinol") was invisible until Aug 17 2026, and it
  // appears in 26% of deep conversations. Ownership is irrelevant to the gate,
  // which was always defined by the ARTIFACT handed over, not by whether money
  // moves.
  if (
    pricedPickCount(text) >= 2 ||
    namedSlotPickCount(text) >= 2 ||
    hasPrescriptiveSequence(text)
  ) {
    found.add('slot_picks')
  }

  if (CONFLICT_LANGUAGE.test(text)) {
    found.add('lineup_conflict_check')
  }

  if (KEEP_CUT_ADD.test(text)) {
    found.add('shelf_audit')
  }

  return found
}

export interface CumulativeGive {
  artifacts: GiveArtifact[]
  count: number
  /** Human phrasing of what's been delivered, for prompt injection. */
  labels: string[]
  /**
   * How many separate replies delivered a multi-slot lineup.
   *
   * The artifact set is a set: building the lineup once and rebuilding it twice
   * more collapse to the same single `slot_picks` entry, so the artifact count
   * cannot express repetition. Repetition is exactly how the Aug 8 over-give
   * happened — the visitor asked one question three ways ("what products" →
   * "what about Target" → "what about clogging") and each reframe read as a new
   * question and got a fresh full lineup. No single reply was wrong and no
   * artifact count moved.
   */
  lineupBuilds: number
}

/**
 * Aggregate across every assistant reply so far in this conversation.
 * Only assistant turns are read — the visitor describing their own routine
 * must never count as Yuri having delivered one.
 */
export function detectCumulativeGive(
  history: Array<{ role: string; content: string }>
): CumulativeGive {
  const all = new Set<GiveArtifact>()
  let lineupBuilds = 0
  for (const turn of history) {
    if (turn.role !== 'assistant') continue
    const found = detectArtifactsInReply(turn.content || '')
    for (const a of found) all.add(a)
    // Count the reply as a lineup build every time, not just the first — this
    // is the one measure that survives the artifact set's dedup.
    if (found.has('slot_picks')) lineupBuilds++
  }
  const artifacts = Array.from(all)
  return {
    artifacts,
    count: artifacts.length,
    labels: artifacts.map((a) => ARTIFACT_LABEL[a]),
    lineupBuilds,
  }
}

/**
 * The fact block injected into Yuri's per-turn context.
 *
 * Returns null when nothing substantial has been given yet — an empty state is
 * noise, and every string added to the per-turn context costs tokens.
 *
 * Deliberately ends by handing the decision back. No instruction to refuse,
 * deflect, or upsell appears anywhere in it: the intervention is visibility,
 * and the response is hers.
 */
export function buildCumulativeGiveBlock(give: CumulativeGive): string | null {
  // Fires once ONE lineup exists, not two.
  //
  // THE OFF-BY-ONE THIS FIXES (measured against the real Aug 8 2026 transcript,
  // session d3b442fb). A cold 20-year-old from Bailey's TikTok received three
  // complete lineups: a Korean reset, then the whole thing rebuilt for
  // Target/Ulta, then a third revision re-textured for clog-prone skin.
  //
  // Replaying her transcript through this function: at the moment Yuri wrote
  // the SECOND lineup, `lineupBuilds` was 1 and `count` was 1, so the old
  // `< 2 && < 2` gate returned null and she wrote it with no visibility at all.
  // The note only appeared before the THIRD. The counter reports builds already
  // SENT, but the note exists to inform the build she is ABOUT TO WRITE — so
  // requiring two sent means the warning always arrives one build late, which
  // is precisely one build too late.
  //
  // The moment a lineup exists is the moment a rebuild request becomes likely
  // ("what about Target?", "anything lighter?"). That is when she needs to see
  // it, and it is why the give/gate held on paper while the cow walked out the
  // door in production.
  if (give.count < 2 && give.lineupBuilds < 1) return null

  const list = give.labels.join(', ')
  const mostOfIt = give.count >= 4

  // A rebuild is a REPEAT, not a new question. This is the distinction the gate
  // never drew: the gate is defined by ARTIFACT ("a complete AM/PM routine is
  // subscriber work"), but the real leak is REPETITION. Every single one of her
  // three replies looked compliant in isolation — a different store genuinely
  // reads as a different question from inside one turn. Naming the pattern is
  // what a single turn cannot supply.
  // The rebuild note is gated on a lineup ACTUALLY having been built.
  //
  // THE BUG THIS FIXES (found Aug 17 2026 by replaying session 3132e3ee). The
  // outer gate is `count < 2 && lineupBuilds < 1`, an AND — so the block fires
  // on artifact count alone. With `lineupBuilds: 0` the ternary still fell to
  // its else-branch and told Yuri "You have already built them one complete
  // multi-slot lineup." She had built none. That false sentence was injected
  // into FIVE consecutive turns of a real conversation.
  //
  // A block whose entire authority is being factual cannot afford one invented
  // fact — it teaches the model to discount everything else in the same block,
  // including the true counts. Silence is correct when there is nothing to say.
  const rebuilt =
    give.lineupBuilds === 0
      ? ''
      : give.lineupBuilds >= 2
      ? `\nYou have built them a complete multi-slot lineup ${give.lineupBuilds} separate times in this conversation. Often that is the visitor asking one question several ways — a different store, a different texture, a different budget — and each reframe reads as a brand-new question. Re-specifying the whole lineup each time is a judgment call worth making deliberately rather than by reflex; answering just the part they actually asked about is usually the better answer anyway, and it is the more useful one.`
      : `\nYou have already built them one complete multi-slot lineup. If their next message asks for that same lineup somewhere else — a different retailer, a lower budget, a lighter texture, "can I get this at Target?" — that is the same build again, not a new question, however much it reads like one in the moment. The genuinely more useful answer is usually the translation rule plus the one pick that actually changes ("same three jobs: gentle cleanser, repair moisturizer, sunscreen — at Target the repair balm is the one worth hunting for"), which respects what they asked and hands them something they can reuse. Re-specifying every slot a second time is the judgment call worth making deliberately rather than by reflex.`

  return `\n\n## What You've Already Given This Visitor (facts, not instructions)
Across your earlier replies in this conversation you have already delivered ${give.count} of the ${GIVE_ARTIFACT_COUNT} things the complete build is made of: ${list}.${
    mostOfIt
      ? ' That is most of the subscriber deliverable, already handed over.'
      : ''
  }${rebuilt}
This is a cumulative count you cannot see by reading any single reply — that is why it is here. It is context for your judgment, not a rule and not a cap: sometimes the honest answer to their question genuinely needs another piece of the build, and you are the one who decides that. Nothing here asks you to withhold help, change your voice, or start selling.`
}
