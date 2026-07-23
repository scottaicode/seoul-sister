/**
 * Value density — how much the VISITOR has front-loaded this conversation.
 *
 * The problem this solves: the email offer is meant to land "at the value
 * moment," and the Conversation State block already tells Yuri the turn number.
 * But turn number is a poor proxy for value delivered. A visitor who pastes a
 * full self-diagnosis + their entire product shelf in two messages reaches the
 * value peak at message 3-4 — long before the slow-burn consult the turn
 * counter implicitly assumes. In a real July 23 2026 conversation exactly this
 * happened: the highest-intent stranger of the day laid out a structured
 * self-read and an 11-item shelf, got a genuine diagnosis by message 4, and
 * left — the value moment had already passed while the turn count still looked
 * "early," so no clean email offer was made and the lead was lost.
 *
 * This module is the instrument for that. It reads the VISITOR's own messages
 * and reports, as a FACT, when they have supplied the kind of rich context that
 * means the value moment may already be here regardless of a low turn number.
 *
 * What this is NOT, and must never become:
 *   - a trigger ("value is high, so ASK NOW") — it states an observation only
 *   - a classifier of Yuri's intent or of whether she already asked
 *   - a score, a threshold verdict, or a cap on anything
 * It observes what the visitor gave and reports it. Whether that means the
 * moment to offer the email has arrived — and how to phrase it — is Yuri's
 * judgment, every turn. A false positive costs at most one slightly-early note
 * she is free to disregard; it can never suppress or shape an answer.
 *
 * Only the visitor's own turns are read. Yuri restating a routine, or a demo
 * transcript, must never count as the visitor having front-loaded context.
 */

/** The kinds of rich context a visitor can front-load. Neutral descriptions. */
export type VisitorContextSignal =
  | 'product_inventory' // pasted a list of products they own / are buying
  | 'self_diagnosis' // a structured description of their own skin
  | 'purchase_intent' // asked what to buy / whether to buy / what else they need

/** Human-readable phrasing, used verbatim in the injected fact. */
const SIGNAL_LABEL: Record<VisitorContextSignal, string> = {
  product_inventory: 'listed multiple products they own or have on the way',
  self_diagnosis: 'given a detailed self-assessment of their own skin',
  purchase_intent: 'asked what to actually buy or whether to buy more',
}

/**
 * Detection is deliberately conservative and STRUCTURAL — it looks for the
 * shape of front-loaded context (an enumerated list; a multi-line self-read;
 * an explicit buy question), not for topic keywords. Merely mentioning a
 * product name or asking a general question must not count.
 */

// A product inventory: 3+ enumerated items (numbered or bulleted lines), OR
// several brand-like "Word Word ..." product lines in one message.
const ENUMERATED_LINE = /^\s*(?:\d+[.)]|[-*•])\s+\S/gm
// Two or more brand/product-style capitalised multi-word lines.
const PRODUCT_LINE = /^\s*[A-Z][A-Za-z0-9]+(?:\s+[A-Za-z0-9%+]+){2,}\s*$/gm

// A self-diagnosis: several descriptive lines about their own skin, signalled
// by first/second-person skin language across multiple lines.
const SKIN_SELF_LANGUAGE =
  /\b(?:my skin|your skin appears|combination|dehydrated|oily|sensitive|acne-prone|breakout-prone|congestion|sebaceous|pores|redness|dark circles)\b/gi

// Explicit purchase intent.
const BUY_QUESTION =
  /\b(?:should i (?:buy|get|add|purchase)|what (?:else )?(?:should|do) i (?:buy|get|need)|anything else (?:to (?:buy|get)|i need)|worth (?:buying|getting)|do i need)\b/i

function countMatches(text: string, re: RegExp): number {
  const m = text.match(re)
  return m ? m.length : 0
}

/**
 * Which context signals appear in a SINGLE visitor message.
 * Exported for testing; callers should use detectValueDensity().
 */
export function detectSignalsInMessage(text: string): Set<VisitorContextSignal> {
  const found = new Set<VisitorContextSignal>()
  if (!text) return found

  const enumerated = countMatches(text, ENUMERATED_LINE)
  const productLines = countMatches(text, PRODUCT_LINE)
  if (enumerated >= 3 || productLines >= 3) {
    found.add('product_inventory')
  }

  // Self-diagnosis: rich skin self-description spread across several lines, not
  // a one-liner. Require both the language density AND some vertical structure
  // so a single "my skin is oily" sentence does not trip it.
  const skinMentions = countMatches(text, SKIN_SELF_LANGUAGE)
  const lineCount = text.split('\n').filter((l) => l.trim().length > 0).length
  if (skinMentions >= 3 && lineCount >= 3) {
    found.add('self_diagnosis')
  }

  if (BUY_QUESTION.test(text)) {
    found.add('purchase_intent')
  }

  return found
}

export interface ValueDensity {
  signals: VisitorContextSignal[]
  /** Human phrasing of what the visitor front-loaded, for prompt injection. */
  labels: string[]
}

/**
 * Aggregate across every VISITOR turn so far in this conversation, including
 * the current message. Assistant turns are never read.
 */
export function detectValueDensity(
  history: Array<{ role: string; content: string }>,
  currentMessage: string
): ValueDensity {
  const all = new Set<VisitorContextSignal>()
  for (const turn of history) {
    if (turn.role !== 'user') continue
    for (const s of detectSignalsInMessage(turn.content || '')) all.add(s)
  }
  for (const s of detectSignalsInMessage(currentMessage || '')) all.add(s)

  const signals = Array.from(all)
  return {
    signals,
    labels: signals.map((s) => SIGNAL_LABEL[s]),
  }
}

/**
 * The fact line injected into Yuri's per-turn Conversation State.
 *
 * Returns null when the visitor hasn't front-loaded anything substantial — an
 * empty state is noise and every per-turn string costs tokens.
 *
 * Ends by handing the decision back. It names NO action: it does not say to
 * ask, when to ask, or how. The intervention is visibility; the response is
 * hers.
 */
export function buildValueDensityFact(density: ValueDensity): string | null {
  if (density.signals.length === 0) return null

  const list = density.labels.join(', and ')
  return `- Value already delivered: this visitor has ${list} — that is a lot of context for this early in the conversation, which usually means the real value has landed sooner than the message count alone would suggest. (An observation about where you are, not an instruction to do anything.)`
}
