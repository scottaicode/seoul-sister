/**
 * Proactive content guard — a closed-world check on every message Yuri decides
 * to send first, BEFORE it is recorded as 'speak' (Oct 9 2026).
 *
 * WHY: the render review found drafts that were fluent, warm, and wrong in the
 * way only this surface can be: telling a subscriber how her "four nights on
 * the AtoBarrier" are going when nothing she ever said confirms she bought it,
 * and slipping a routine change ("add the BHA back tonight alongside Differin")
 * into a message that has no conflict-check tool behind it. Self-review by the
 * writing model does not catch its own premise. So:
 *
 *   1. A DIFFERENT model (MODELS.primary) reads the draft TWICE, under two
 *      different framings (literal inventory; skeptical recipient), against the
 *      person's own words and recorded decisions, and lists: products named;
 *      usage claims (including premises hidden in questions) with a verbatim
 *      quote and the quote's stance; other asserted facts about them (events,
 *      outcomes, symptom changes) with quotes; promises; pressure; medical
 *      reassurance; contradicted decisions; routine changes.
 *   2. Deterministic enforcement (enforceGuard, pure) blocks unless the reader
 *      said pass AND every usage claim and asserted fact carries a quote that
 *      is really in their messages, whose stance establishes current use and is
 *      not negated in its own sentence AND no promise/pressure/reassurance/
 *      contradiction/change AND every known shelf product the draft names was
 *      accounted for. Any block from either read wins; a missing or unparseable
 *      verdict, or a failed call, blocks (fail closed).
 *
 * WHAT IT CANNOT DO (honest limit): the deterministic half verifies what the
 * readers report; it cannot see a claim that BOTH readers fail to list, except
 * a named shelf product. Its coverage of hidden premises, life facts and
 * promises is as good as the readers' extraction, checked twice. Nothing here
 * enumerates banned phrases in the draft (the attacker picks the verb).
 */

import { getAnthropicClient, callAnthropicWithRetry, MODELS } from '@/lib/anthropic'
import { logAIUsage } from '@/lib/ai-usage-logger'

export interface GuardEvidence {
  /** The person's own messages, verbatim (never Yuri's). */
  userMessages: string[]
  /** Decisions / commitments / preferences on record, as plain lines. */
  recordedDecisions: string[]
  /** Active plan / protocol text, if any. */
  plan: string | null
  /** Product names on record for them (shelf, routine). Used to catch a verifier that OMITS a product. */
  knownProducts?: string[]
  /**
   * Statements verified true at the source that the message MAY make (e.g. the
   * price from src/lib/pricing.ts). Anything about the plan/service beyond these
   * is a promise and blocks.
   */
  verifiedStatements?: string[]
}

export interface VerifierOutput {
  products_mentioned?: string[]
  using_claims?: Array<{
    product?: string
    /**
     * The reader's call on the DRAFT's words: does it state or presuppose
     * current use? Only an explicit false exempts a listed mention (a question
     * asking whether, "since you put X away"); missing counts as true.
     */
    message_asserts_current_use?: boolean
    user_quote?: string
    /** How the quote relates to CURRENT use; only 'establishes_current_use' supports a claim. */
    quote_stance?: string
  }>
  /** Anything stated or presupposed about the person beyond products: life events, outcomes, symptom changes. */
  asserted_facts?: Array<{ fact?: string; user_quote?: string; source?: string }>
  /** Plan / pricing / capability / service promises. Never allowed in a proactive note. */
  promises?: string[]
  /** Scarcity, urgency, or pressure. Never allowed. */
  pressure?: string[]
  /** Telling them a symptom or lesion is fine / harmless / nothing to worry about. Never allowed. */
  medical_reassurance?: string[]
  contradicted_decisions?: string[]
  routine_changes?: string[]
  verdict?: string
  reason?: string
}

export interface GuardResult {
  pass: boolean
  reasons: string[]
  verifier: VerifierOutput | null
}

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/\s+/g, ' ')
    .trim()

/**
 * Pure enforcement. Exported for tests: this is the half that must bind even
 * when the verifier is wrong or lenient.
 */
// Category words carry no identity ("cream", "serum"); a product is recognised
// by its distinctive words ("AtoBarrier365", "Differin").
const GENERIC = new Set(['cream', 'serum', 'toner', 'cleanser', 'moisturizer', 'moisturiser', 'sunscreen', 'essence', 'daily', 'facial', 'barrier', 'gentle', 'water', 'lotion', 'mask', 'sheet', 'balm', 'pads', 'advanced', 'repair', 'skin', 'with', 'and', 'for', 'the'])

/** Known products whose distinctive name appears in the message text. */
const distinctive = (s: string) => norm(s).split(/[^a-z0-9]+/).filter((w) => w.length >= 5 && !GENERIC.has(w))
/** "AtoBarrier" in prose matches "AtoBarrier365" on the shelf, and vice versa. */
const overlaps = (a: string[], b: string[]) => a.some((x) => b.some((y) => x.startsWith(y) || y.startsWith(x)))

export function knownProductsInMessage(message: string, known: string[] = []): string[] {
  const words = distinctive(message)
  return known.filter((name) => overlaps(distinctive(name), words))
}

/**
 * Stance words that turn a usage quote into its opposite. This is not a list of
 * banned OUTPUTS (the attacker picks the verb in the draft); it inspects the
 * person's OWN words around a quote offered as evidence, where a negation means
 * the evidence does not say what the claim needs.
 */
const NEGATION = /\b(not|never|no longer|stopped|stop|quit|don'?t|didn'?t|haven'?t|hasn'?t|won'?t|can'?t|gave up|ran out|got rid of|threw (?:it )?out)\b/

/**
 * A quote is evidence only if it appears in the corpus as whole words. Short
 * quotes are allowed ("Iowa" is a complete answer to "where do you live?") but
 * must match on word boundaries, so "rash" cannot be found inside "brash".
 */
export function inCorpus(corpus: string, quote: string): boolean {
  if (quote.length < 3) return false
  const escaped = quote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^\\p{L}\\p{N}])${escaped}($|[^\\p{L}\\p{N}])`, 'u').test(corpus)
}

/** True when the quote, or the words just before it in their message, negate it. */
export function negatedInContext(corpus: string, quote: string): boolean {
  let i = corpus.indexOf(quote)
  while (i !== -1) {
    // Same sentence only: from the last sentence break before the quote (at most
    // 40 chars back) through the quote itself.
    const before = corpus.slice(Math.max(0, i - 40), i)
    const sentenceStart = Math.max(before.lastIndexOf('.'), before.lastIndexOf('!'), before.lastIndexOf('?'), before.lastIndexOf('\n'))
    const window = `${before.slice(sentenceStart + 1)}${quote}`
    if (NEGATION.test(window)) return true
    i = corpus.indexOf(quote, i + 1)
  }
  return false
}

export function enforceGuard(v: VerifierOutput | null, evidence: GuardEvidence, message = ''): GuardResult {
  if (!v) return { pass: false, reasons: ['verifier returned no parseable verdict (fail closed)'], verifier: null }
  const reasons: string[] = []
  const corpus = norm(evidence.userMessages.join('\n'))

  // Closed-world on the verifier itself: a product we know they have on record
  // that the message names must appear in the verifier's accounting. An
  // omitted product is how a lenient "pass" would slip a false premise through.
  const accounted = distinctive([...(v.products_mentioned ?? []), ...(v.using_claims ?? []).map((c) => c.product ?? '')].join(' | '))
  for (const p of knownProductsInMessage(message, evidence.knownProducts)) {
    if (!overlaps(distinctive(p), accounted)) reasons.push(`names "${p}" but the check did not account for it`)
  }

  for (const c of v.using_claims ?? []) {
    // Listed but explicitly not asserted by the draft (asks whether / says stopped).
    if (c.message_asserts_current_use === false) continue
    const product = c.product?.trim() || 'unnamed product'
    const quote = c.user_quote?.trim() ?? ''
    if (!quote) {
      reasons.push(`treats "${product}" as something they use, but nothing they said confirms it`)
    } else if (norm(quote).length < 6 || !inCorpus(corpus, norm(quote))) {
      reasons.push(`the quote offered for "${product}" is not in their messages`)
    } else if (c.quote_stance !== 'establishes_current_use') {
      reasons.push(`the quote for "${product}" does not establish current use (${c.quote_stance ?? 'stance missing'})`)
    } else if (negatedInContext(corpus, norm(quote))) {
      // A quote can appear verbatim and still say the opposite: "using the
      // AtoBarrier" is a substring of "I stopped using the AtoBarrier".
      reasons.push(`the quote for "${product}" sits in a negated or stopped context in their message`)
    }
  }
  // Facts about the agreed plan may be evidenced by the record; facts about the
  // person only by their own words. Usage claims above are user-words only.
  const recordCorpus = norm([...evidence.recordedDecisions, evidence.plan ?? ''].join('\n'))
  for (const f of v.asserted_facts ?? []) {
    const fact = f.fact?.trim() || 'a fact about them'
    const quote = f.user_quote?.trim() ?? ''
    const source = f.source === 'record' ? recordCorpus : corpus
    if (!quote || !inCorpus(source, norm(quote))) {
      reasons.push(`asserts something about them they never said: ${fact}`)
    }
  }
  for (const p of v.promises ?? []) if (p?.trim()) reasons.push(`makes a plan/pricing/capability promise: ${p.trim()}`)
  for (const p of v.pressure ?? []) if (p?.trim()) reasons.push(`applies pressure or urgency: ${p.trim()}`)
  for (const m of v.medical_reassurance ?? []) if (m?.trim()) reasons.push(`offers medical reassurance: ${m.trim()}`)
  for (const d of v.contradicted_decisions ?? []) if (d?.trim()) reasons.push(`contradicts a recorded decision: ${d.trim()}`)
  for (const ch of v.routine_changes ?? []) if (ch?.trim()) reasons.push(`introduces a routine change with no conflict check: ${ch.trim()}`)
  if (v.verdict !== 'pass') reasons.push(`verifier verdict: ${v.verdict ?? 'missing'}${v.reason ? ` (${v.reason})` : ''}`)

  return { pass: reasons.length === 0, reasons, verifier: v }
}

/** Any block wins; reasons are de-duplicated. Exported for tests. */
export function combineReads(reads: GuardResult[]): GuardResult {
  const blocked = reads.filter((r) => !r.pass)
  if (blocked.length === 0) return reads[0]
  return { pass: false, reasons: [...new Set(blocked.flatMap((r) => r.reasons))], verifier: blocked[0].verifier }
}

export function parseVerifier(text: string): VerifierOutput | null {
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) return null
  try {
    const v = JSON.parse(cleaned.slice(start, end + 1)) as VerifierOutput
    return typeof v === 'object' && v ? v : null
  } catch {
    return null
  }
}

const OUTPUT_SPEC = `Fill every list (empty arrays are fine):
0. products_mentioned: EVERY product or brand the message names, for any reason.
1. using_claims: EVERY product the message treats as something the person currently has, owns, is using, or is "on". This includes claims made through a question's PREMISE: "How's the X treating you?" or "Has X stopped stinging?" presuppose current use and ARE claims. A question that genuinely asks WHETHER ("Did X arrive yet?", "Are you still using X?") is not, and a product the message says they stopped, parked, or put away is not (that is the opposite of a usage claim). If you are unsure whether a mention is a claim, list it with message_asserts_current_use true or false: true when the message's words state or presuppose they use it NOW, false when it only asks whether, says they stopped, or recommends. For each claim, give user_quote: a VERBATIM quote copied exactly from THEIR OWN MESSAGES, and quote_stance: "establishes_current_use" only if that quote says they have or currently use it; otherwise "past_or_stopped", "intent_only" (they said they would buy it), "negative" (it broke them out, they disliked it), or "other". An advisor's recommendation or saved plan is never ownership; leave user_quote empty.
2. asserted_facts: anything else the message states or presupposes about the person or their life: where they live, their skin, events (a wedding, a trip, a new job), outcomes ("your skin has improved"), symptom changes ("glad the redness calmed down"), feelings. For each give user_quote: VERBATIM words that establish it, copied from THEIR OWN MESSAGES, or, for a fact about the plan you two agreed (what it is, when it started), copied from RECORDED DECISIONS or ACTIVE PLAN, with source "user" or "record". Empty if nothing establishes it. A conclusion the advisor drew (e.g. "dry cheeks" when they said "a mix") is not established.
3. promises: a NEW promise about the plan, price, service, features, or a deliverable or service level ("your plan includes...", "I'll review your photos weekly", "you'll hear from me every Monday"), EXCEPT a statement listed under VERIFIED STATEMENTS below. Offering to work something out together when they reply, or mentioning a promise already made, is not a new promise.
4. pressure: urging them to act or buy now, scarcity, deadlines, or fear of missing out. A plain fact about timing (the weather is changing this month) is not pressure.
5. medical_reassurance: any statement that a symptom, spot, mole, or reaction is fine, harmless, or nothing to worry about.
6. contradicted_decisions: any recorded decision or plan step the message goes against.
7. routine_changes: any change the message tells or nudges them to make: adding, removing, swapping, or replacing a product; changing how often or on which nights something is used; stacking actives; starting or restarting an active. Holding off on BUYING something is not a routine change; asking a question is not a change.
verdict: "pass" only if every using_claim and asserted_fact has a quote that establishes it and lists 3-7 are all empty; otherwise "block".

Return STRICT JSON only:
{"products_mentioned": [], "using_claims": [{"product": "", "message_asserts_current_use": true, "user_quote": "", "quote_stance": ""}], "asserted_facts": [{"fact": "", "user_quote": "", "source": "user" | "record"}], "promises": [], "pressure": [], "medical_reassurance": [], "contradicted_decisions": [], "routine_changes": [], "verdict": "pass" | "block", "reason": "<one sentence>"}`

/**
 * Two genuinely different framings for the two reads (Oct 10 2026): the same
 * prompt twice tends to make the same mistake twice. Reader A inventories
 * claims literally; reader B hunts for the single most misleading thing a
 * skeptical recipient would object to. Same output contract, any block wins.
 */
const VERIFIER_SYSTEM_A = `You check a short message an AI skincare advisor wants to send a person unprompted. You did not write it. Inventory, literally and closed-world, everything it states or presupposes, and match each claim to the evidence. If the evidence below does not establish it, it is not established.

${OUTPUT_SPEC}`

const VERIFIER_SYSTEM_B = `You are the recipient's skeptical friend reading a note an AI skincare advisor is about to send them unprompted. Assume the advisor may have filled gaps in its memory with plausible guesses. Read it as the recipient would, and find every place it would make them think "I never said that", "that isn't true", "that's not what we agreed", or "is this a sales pitch?". Hidden premises inside questions count. Then report what you found using exactly this contract, checking every claim against their own words below:

${OUTPUT_SPEC}`

export async function checkProactiveDraft(params: {
  message: string
  subject: string | null
  evidence: GuardEvidence
  userId?: string
}): Promise<GuardResult> {
  const { message, subject, evidence } = params
  const facts = `THE MESSAGE${subject ? ` (subject: "${subject}")` : ''}:
"""
${message}
"""

THEIR OWN MESSAGES (verbatim, oldest first; the ONLY valid source for ownership quotes):
${evidence.userMessages.length ? evidence.userMessages.map((m) => `- ${m}`).join('\n') : '(none on record)'}

RECORDED DECISIONS / COMMITMENTS:
${evidence.recordedDecisions.length ? evidence.recordedDecisions.map((d) => `- ${d}`).join('\n') : '(none)'}

ACTIVE PLAN:
${evidence.plan ?? '(none)'}

VERIFIED STATEMENTS (true at the source; the message may say these):
${evidence.verifiedStatements?.length ? evidence.verifiedStatements.map((s) => `- ${s}`).join('\n') : '(none)'}`

  // Two independent reads; ANY block wins (temperature is not accepted on this
  // model, so variance is handled by agreement, not sampling settings). Observed Oct 10:
  // the same draft ("made the AtoBarrier365 your nightly base") was blocked by
  // one verifier call and passed by another. A guard whose verdict depends on
  // which call you got is not a guard, so a pass needs both readers to agree.
  try {
    const readOnce = async (system: string): Promise<GuardResult> => {
      const response = await callAnthropicWithRetry(() =>
        getAnthropicClient().messages.create({
          // A DIFFERENT model from the writer (MODELS.chat): the point is a second reader.
          model: MODELS.primary,
          max_tokens: 1600,
          system,
          messages: [{ role: 'user', content: facts }],
        })
      )
      void logAIUsage({
        feature: 'proactive_content_guard',
        model: MODELS.primary,
        inputTokens: response.usage.input_tokens,
        outputTokens: response.usage.output_tokens,
        userId: params.userId,
      })
      const text = response.content
        .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
        .map((b) => b.text)
        .join('')
      return enforceGuard(parseVerifier(text), evidence, `${subject ?? ''}\n${message}`)
    }
    return combineReads(await Promise.all([readOnce(VERIFIER_SYSTEM_A), readOnce(VERIFIER_SYSTEM_B)]))
  } catch (err) {
    console.error('[proactive] content guard call failed:', err)
    return { pass: false, reasons: [`guard call failed (fail closed): ${err instanceof Error ? err.message : String(err)}`], verifier: null }
  }
}
