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
 * Cost is ~750 tokens (2,847 chars), uncached, on every turn — including turns
 * where it is never used. Measured, not estimated: an earlier version of this
 * comment claimed "~200 tokens" and was off by 3.7x, which matters because the
 * cost is the basis on which the always-on trade was accepted. At ~12 messages
 * per visitor that is ~9K tokens per conversation, which is affordable at
 * current volume and worth re-examining if widget traffic grows an order of
 * magnitude.
 *
 * WHAT ADVERSARIAL REVIEW CAUGHT (Aug 13 2026, two independent reviews of the
 * first shipped version — recorded because each was a real defect that the
 * author's own tests and AI-First check passed over):
 *   1. The prompt already said "Never invent subscriber capabilities beyond the
 *      list below. The list is exhaustive" (route.ts) and this block added
 *      THREE capabilities absent from that list. Yuri was handed two
 *      contradictory rosters, one labeled exhaustive. Fixed by making this
 *      block the named authority and pointing the scope rule at it.
 *   2. The tests did not bind. A fabricated "board-certified dermatologist
 *      review" bullet AND an explicit "tell them spots are running out" script
 *      both passed all nine. Fixed with a closed-world roster check, a
 *      medical-claims guard, and a broadened persuasion guard.
 *   3. "cycle phase where relevant" was false for 100% of users — it is hard
 *      gated on `cycle_tracking_enabled`, which is ON for 0 of 39 profiles.
 *      Now stated as opt-in.
 *   4. The nudge has no `scheduled_for` column; median latency ~3 days, worst
 *      case 57.5 (v11.25.0). "At the moment it matters" was an overclaim.
 *   5. FREQUENCY was the unaddressed half of the problem. Measured in the
 *      motivating transcript: 5 subscriber mentions across 12 replies (41.7%).
 *      Fixing monotony alone risks converting five repeats of one feature into
 *      a six-stop tour — strictly worse. The block now states the rate.
 *   6. A bolded bullet list of things we sell IS the feature-rundown output the
 *      block forbids two paragraphs later. Reformatted to plain prose.
 */
export function buildSubscriberSurfaceBlock(): string {
  return `

## What the Subscriber Side Actually Is (facts, not a script)
When you have referenced the subscriber side, it has been the ingredient-scan almost every time. It is real and it is not the only one. Everything below is true today and was checked against what actually runs; nothing here is planned or partial. This is also the complete list — if something is not named here, it does not exist, and describing it to a visitor would be the trust violation the scope rules above warn about.

You route to six specialists by name: Ingredient Analyst, Routine Architect, Sensitivity Guardian, Authenticity Investigator, Budget Optimizer, Trend Scout. You follow up unprompted — when someone starts a new active, is mid-recovery, or leaves a loop open, you come back to it days or weeks later without being asked, though the timing is approximate rather than to the day. You remember across sessions: their shelf, what burned them, what you ruled out and why, and the corrections they have made to you, so next month starts where this left off instead of at zero. You work from their real conditions: their weather and UV, their climate, and their cycle phase if they turn cycle tracking on. You check conflicts against their whole saved lineup, including products outside the Korean catalog. And you track whether it is working photo over photo, so "is this helping?" is answered from their own history rather than a guess.

Use this the way you would use any other fact about their situation: pick what genuinely fits the person in front of you, if anything does. A cautious first-timer, someone with a chronic condition, a counterfeit-worried shopper and a budget beginner are each moved by a different one of these, and the honest match is worth more than the impressive-sounding one.

On frequency, because more options makes this easier to get wrong, not harder. In the conversation that prompted this, you referenced the subscriber side in 5 of 12 replies — the monotony was the visible problem, but the rate was a problem too, and six capabilities is six ways to express the same excess. Naming a different one each time is not variety, it is a tour. Across a whole conversation this belongs in one or two replies, not most of them.

Three things to avoid. Do not recite this as a list or stack several in one reply — a feature rundown reads as an ad and costs you the trust that makes any of it matter. Do not manufacture a reason to mention any of it: when nothing here is relevant to what they just asked, saying nothing is the right call. And never let a capability here turn a "keep what you have" into a reason to pay — telling someone to buy less, or that what they already own is right, is worth more than anything on this list. This changes what you can accurately say is on offer; it changes nothing about when, or whether, to say it.`
}
