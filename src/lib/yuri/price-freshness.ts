/**
 * Price freshness — how old a quoted price actually is.
 *
 * WHY THIS EXISTS (measured against a real transcript, Aug 15 2026).
 *
 * A woman on the Spanish Mediterranean coast had a 9-message consult at genuine
 * purchase intent. Yuri quoted her six prices. Checked live the same day:
 *
 *   Arencia   $18.81 quoted -> $24.00 live   (she'd pay 28% MORE than quoted)
 *   Jumiso    $24.05 quoted -> $19.00 live   (we overquoted by 27%)
 *   AHC       $31.25 quoted -> $29.60 live
 *   Dr.G      $35.23 quoted -> DELISTED      (her #1 recommendation)
 *   FaceShop  $11.28 quoted -> DELISTED
 *
 * Every one was presented as a current fact. The prices were ~130 days old
 * because the Olive Young refresher had silently failed every night since Jul 6.
 *
 * THE STRUCTURAL BUG, which is the interesting part. `compare_prices` has
 * carried full staleness honesty since v10.3.8 — `age_days`, `is_stale`, a
 * `freshness` block with an explicit note. ALL THREE of her tool calls were
 * `search_products`, which selected only `price_usd` and the retailer name. The
 * instrument was built on the path visitors do not take. Same class as the email
 * ask, the cumulative give, and tool grounding: not bad judgment by Yuri, a
 * FACT she was never given.
 *
 * WHY A FACT AND NOT A RULE. The obvious fix — "if age > N days, add a
 * disclaimer" — was rejected on measurement. When this was written 99.2% of all
 * price rows were stale past 14 days, so a threshold rule would staple a caveat
 * to essentially every price Yuri ever quotes. That is not honesty, it is noise,
 * and CLAUDE.md is explicit that a more hedged, disclaimer-heavy Yuri is a
 * REGRESSION. It would also read to a prospect deciding on $24.99/mo as "this
 * company's data is broken."
 *
 * WHAT A SECOND-MODEL REVIEW CUT FROM THIS FILE, and why it matters.
 * The first draft told Yuri that stale prices "drift more often HIGH than low,
 * so an out-of-date number usually errs in the shopper's favour." It was true of
 * the sample (6 of 8 popular products were discounted below our stored price)
 * and it was CUT anyway, because n=8 is not a catalog-wide fact and Yuri would
 * faithfully relay it as "you'll probably pay less than I said" — a
 * probabilistic promise we cannot keep, and one that doubles as an excuse for
 * bad data. Cutting an UNVERIFIED claim is not the hedging regression the
 * project rule forbids; that rule protects confident TRUE advice. This is the
 * `fitzpatrick_source` discipline applied to pricing: a value whose provenance
 * we cannot name is not a fact. If the direction of drift turns out to matter,
 * measure it across the whole catalog and reinstate it with a real denominator.
 *
 * A NOTE ON TIMING. The underlying refresher was repaired the same day (a
 * fetch-only price path; the ~4,900-row catalog now cycles in ~12 days instead
 * of ~4 months, and the ~115 most-reviewed products refresh on the first run).
 * So the 99.2%-stale condition is temporary. This module is deliberately written
 * to stay correct AFTER the data is healthy: when prices are fresh it returns
 * null and costs nothing. It reports what is true, not what was true on the day
 * it was written.
 */

/**
 * Age past which a price is worth mentioning as possibly moved.
 *
 * 21 days, chosen to match `POPULAR_STALE_DAYS` in the refresher: that is the
 * cadence on which the products Yuri actually cites are re-verified, so a price
 * older than that is one the pipeline itself considers due. Tying the two
 * numbers together means the note fires exactly when the data is genuinely
 * behind, rather than at an independently-invented threshold that would drift
 * out of step with the refresh cycle.
 */
const NOTEWORTHY_DAYS = 21

/**
 * Age past which "may have moved" understates it. Beyond roughly two months a
 * K-beauty price has usually seen at least one promotional cycle.
 */
const LONG_STALE_DAYS = 60

export interface PriceFreshness {
  /** Prices we showed Yuri that carry a readable age. */
  priced: number
  /** How many are past NOTEWORTHY_DAYS. */
  stale: number
  /** Age of the oldest quoted price, in days. */
  oldestDays: number
  /** True when the oldest is past LONG_STALE_DAYS. */
  longStale: boolean
}

/** Days between `iso` and now, or null when there is no timestamp to read. */
export function ageInDays(iso: string | null | undefined, now: number = Date.now()): number | null {
  if (!iso) return null
  const t = new Date(iso).getTime()
  if (!Number.isFinite(t)) return null
  // A future timestamp is a clock/data problem, not a fresh price. Clamp to 0
  // rather than returning a negative age that would read as "fresher than now".
  return Math.max(0, Math.floor((now - t) / 86_400_000))
}

/**
 * Summarise the freshness of every price about to be shown to Yuri.
 *
 * Rows with no `last_checked` are counted as unpriced rather than assumed fresh:
 * an unknown age is exactly the thing we must not silently treat as current.
 */
export function summarisePriceFreshness(
  rows: Array<{ last_checked?: string | null }>,
  now: number = Date.now()
): PriceFreshness {
  let priced = 0
  let stale = 0
  let oldestDays = 0

  for (const row of rows) {
    const age = ageInDays(row.last_checked, now)
    if (age == null) continue
    priced++
    if (age > NOTEWORTHY_DAYS) stale++
    if (age > oldestDays) oldestDays = age
  }

  return { priced, stale, oldestDays, longStale: oldestDays > LONG_STALE_DAYS }
}

/**
 * The fact block injected into Yuri's per-turn context.
 *
 * Returns null when there is nothing worth saying — a fresh catalog must cost
 * zero tokens and zero behaviour change. That is what keeps this module honest
 * once the refresher is healthy.
 *
 * THREE DRAFTING TRAPS, each deliberate:
 *
 * 1. It never tells her to add a disclaimer, hedge, or withhold a price. A rule
 *    like that would fire on nearly every price in the catalog and produce the
 *    disclaimer-heavy advisor CLAUDE.md explicitly forbids. It states an age.
 *
 * 2. It never says the price is WRONG, and never predicts which DIRECTION it
 *    moved. We know one thing — when we last looked — and the block says only
 *    that. Everything beyond it was cut in review (see the header).
 *
 * 3. It never claims a refresh cadence. "Our prices update daily" is the single
 *    most dangerous sentence that could appear here: it contains no command
 *    words, would pass a naive guard test, and is a fabricated guarantee Yuri
 *    would repeat with total confidence. The guard test attacks that shape
 *    directly rather than banning imperative vocabulary.
 */
export function buildPriceFreshnessBlock(f: PriceFreshness): string | null {
  if (f.stale === 0) return null

  const scale = f.longStale
    ? `The oldest is about ${f.oldestDays} days old — long enough that it has likely seen at least one promotional cycle since we looked.`
    : `The oldest is about ${f.oldestDays} days old.`

  return `\n\n## Price Freshness (facts, not instructions)
${f.priced === 1 ? 'The price' : `${f.stale} of the ${f.priced} prices`} in front of you ${f.stale === 1 ? 'was' : 'were'} last verified more than ${NOTEWORTHY_DAYS} days ago. ${scale} These are real prices we genuinely recorded, not guesses — but they are what the retailer charged when we last checked, not a live quote from this moment. Which way a given price has moved since, or whether it has moved at all, is not something we know.
This is context for your judgment, not a rule and not a cap. Nothing here asks you to add a caveat to every number, hedge a recommendation you're confident in, or stop quoting prices — a price with its age attached is more useful to someone than no price at all. You already handle this instinct well when you can see the age; it is here because a single tool result does not make it visible.`
}
