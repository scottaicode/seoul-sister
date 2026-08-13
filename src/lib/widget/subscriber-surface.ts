/**
 * Subscriber surface — what the paid side of Seoul Sister actually IS.
 *
 * THE PROBLEM THIS SOLVES (found Aug 13 2026, visitor 1ce3b6ce).
 * A woman in her fifties with rosacea talked to Yuri for 53 minutes. Yuri named
 * the subscriber side five times, and it was the SAME capability every time —
 * "a mode that scans your lineup ingredient-by-ingredient." A good feature, and
 * for this particular visitor close to the least relevant one on the shelf.
 *
 * She was starting azelaic acid. Yuri told her to give it 2-3 weeks and watch
 * for tingle-versus-flush. Seoul Sister genuinely does check back at exactly
 * that kind of moment, unprompted — `ss_user_nudges` holds real ones ("Sunday's
 * here, so I'm keeping my word and checking in like I said I would"), 4 of 9
 * acted on. For someone managing a lifelong condition, "I'll still be here in
 * two weeks asking how it went" is a far better answer to *why subscribe* than
 * an ingredient scanner. It was never said, because Yuri had no idea it exists.
 *
 * Counted in the widget prompt before this module: "remember"/memory 14
 * mentions, conflict-checking 4, "specialist" 4 — but the six specialists are
 * NEVER NAMED, and proactive check-ins, weather-adaptive alerts, cycle
 * awareness and progress tracking appear ZERO times. Yuri kept reaching for the
 * ingredient scan because it was essentially the only concrete thing she'd been
 * told about. That is not a judgment failure; it is a missing fact.
 *
 * Same class as the email ask, the cumulative give, tool grounding and the
 * final-message fact: she was asked to represent something she could not see.
 *
 * WHAT THIS IS NOT, AND MUST NEVER BECOME:
 *   - a script ("mention the specialists in your closing message")
 *   - a ranking, a rotation, or a "you already used that one, try another"
 *   - a trigger tied to turn number, topic, or sentiment
 *   - a sales instruction of any kind
 * It is a menu of things that are TRUE. Which one fits the person in front of
 * her — and whether ANY of them belongs in a given reply — is Yuri's judgment,
 * every turn. A visitor who needs none of this should hear none of it.
 *
 * EVERY CLAIM BELOW WAS VERIFIED AGAINST THE CODEBASE AND LIVE DATA before
 * being written here. A fact block that promises a capability we do not ship
 * would be worse than the silence it replaces — it converts a trust asset into
 * a liability the moment someone pays and finds out. Verified Aug 13 2026:
 *   - six specialists, named, in `src/lib/yuri/specialists.ts`
 *   - proactive check-ins: `ss_user_nudges`, 9 rows, 4 acted on, real messages
 *   - cross-session memory: `decision_memory` + `durable_corrections`
 *   - weather + cycle: `get_current_weather` tool, cycle-phase logic
 *   - conflict-checking a SAVED shelf: `check_ingredient_conflicts`
 *   - progress tracking: `ss_glass_skin_scores`, 13 rows
 * If a capability is ever removed, remove it here in the same commit.
 */

/**
 * The block injected into the per-turn (UNCACHED) context.
 *
 * Deliberately static — it takes no arguments and inspects nothing about the
 * conversation. An earlier draft scored which capability "fit best" and
 * injected that one; it was discarded before shipping. Choosing what this
 * person needs is precisely Yuri's job, and a keyword classifier doing it would
 * be the Yuri Sole Authority Principle violated inside her own prompt — the
 * same anti-pattern as the seasonal recommender Bailey killed seven times.
 *
 * Cost is ~200 tokens on turns where it may never be used. That is the correct
 * trade: the alternative is Yuri representing the product from a sample of one
 * feature, which is what actually happened.
 */
export function buildSubscriberSurfaceBlock(): string {
  return `

## What the Subscriber Side Actually Is (facts, not a script)
You have been naming the subscriber side using whichever capability came to mind, and in practice that has meant the ingredient-scan almost every time. It is a real feature and it is far from the only one, so here is the actual shelf. Nothing here is aspirational — every item ships today.

- **Six specialists you route to by name**: Ingredient Analyst, Routine Architect, Sensitivity Guardian, Authenticity Investigator, Budget Optimizer, Trend Scout. Naming the one that fits their problem is more concrete than "specialists."
- **You check back on your own, without being asked.** When someone starts a new active, is mid-recovery, or leaves a loop open, you follow up at the moment it matters — days or weeks later, unprompted. This is live and subscribers receive it.
- **You remember across sessions**: their shelf, what burned them, what you ruled out and why, and the corrections they have made to you. Next month starts where this left off instead of at zero.
- **You adjust to their conditions**: their real weather and UV, their climate, and cycle phase where relevant.
- **You check conflicts against their whole saved lineup** — the products they actually own, including ones outside the Korean catalog — rather than one list pasted into a chat.
- **You track whether it is working** over months, so "is this helping?" has an answer built from their own history rather than a guess.

Use this the way you would use any other fact about their situation: pick what genuinely fits the person in front of you, if anything does. A cautious first-timer, someone with a chronic condition, a counterfeit-worried shopper and a budget beginner are each moved by a different one of these, and the honest match is worth more than the impressive-sounding one.

Two things to avoid. Do not recite this as a list or stack several in one reply — a feature rundown reads as an ad and costs you the trust that makes any of it matter. And do not manufacture a reason to mention any of it: when nothing here is relevant to what they just asked, saying nothing is the right call. This changes what you can accurately say is on offer; it changes nothing about when, or whether, to say it.`
}
