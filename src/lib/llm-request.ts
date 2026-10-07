/**
 * Request-layout helpers shared by the three Yuri chat surfaces (widget,
 * authenticated advisor, onboarding). Pure functions — no I/O — so the tests
 * execute them instead of asserting on source text.
 *
 * Why this exists (Oct 7 2026, Opus 4.8 -> 5.5 migration):
 *
 * 1. CACHE LAYOUT. Prompt caching is a prefix match over tools -> system ->
 *    messages. Each surface used to send its per-turn facts (conversation
 *    state, clock, specialist) as a trailing SYSTEM block — which renders BEFORE
 *    the history, so the history cache could never be read on the next turn and
 *    every turn re-wrote the whole transcript. Measured on real widget sessions
 *    (scripts/ab-model-widget-multiturn.ts): history writes climbed 2K -> 9K
 *    tokens/turn; with the per-turn facts moved AFTER the newest user message
 *    as a mid-conversation system message, writes stay flat at ~1K.
 *
 * 2. NO FORCED TOOL USE. Opus 5.5 rejects tool_choice 'any' with a 400. Where a
 *    route's keyword heuristic used to force a search, it now states (truthfully)
 *    that a keyword check flagged the message. If the reply then names a product
 *    (any bolded or capitalised product name — including the visitor's OWN
 *    products, e.g. "keep your **CeraVe** cleanser") without any tool having run,
 *    the round is retried ONCE with a note that leaves the call to Yuri; she can
 *    simply answer again. A reply that names no product is never retried.
 *    Measured: fired on 4 of 16 real turns, led to a search on 1. Deliberately no
 *    own-vs-recommended classifier (the brand-list trap, WIDGET-GROUNDING-FIX.md).
 *    See nextRoundAction().
 *
 * 3. TOOL-LOOP PASSBACK. Opus 5.5 always thinks; its thinking blocks must be
 *    passed back UNCHANGED within a tool loop (editing an assistant turn
 *    invalidates them). So the assistant turn is the model's own content,
 *    verbatim — not a reconstruction of its tool_use blocks.
 */
import type Anthropic from '@anthropic-ai/sdk'

type MessageParam = Anthropic.Messages.MessageParam
type ContentBlockParam = Anthropic.Messages.ContentBlockParam

/**
 * Fact appended to the per-turn context when a route's product/price heuristic
 * fires. Describes the MESSAGE only, so it stays true on every tool round
 * (a "no search has run yet" fact would turn false after round 1).
 */
export const PRODUCT_TURN_FACT = `## This Message (fact)
A keyword check flagged this message as possibly about products, prices, trends, or weather. Seoul Sister's tools are where its catalog, price, trend, and weather data live.`

/**
 * Sent at most once, only when a flagged reply named specific products without
 * any tool having run. Hands the decision back: a lookup is the point only when
 * it could change or confirm what she said (the catalog is Korean-focused, and
 * an empty search on a Western brand is a fact about our catalog, not the product).
 */
export const SEARCH_RETRY_NOTE = `A first pass at this reply named specific products without any tool having run this turn. If a catalog or price lookup could change or confirm what you'd say about those products, check it before answering. If it couldn't (for example a brand our catalog doesn't carry), just answer.`

/**
 * Whole-term match for keyword heuristics. A substring test made 'anua' fire on
 * "january" and 'hera' on "therapy" (Fable 5.1 review, Oct 7 2026).
 */
export function mentionsTerm(text: string, term: string): boolean {
  const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return new RegExp(`(^|[^a-z0-9])${escaped}($|[^a-z0-9])`, 'i').test(text)
}

export type RoundAction = 'run_tools' | 'finalize' | 'retry_search' | 'fallback_model' | 'declined'

/**
 * What the tool loop does after a round. Pure, so the decision is tested by
 * execution. The loops also enforce a hard round cap (MAX_EXTRA_ROUNDS) so a
 * future edit that forgets to set a flag cannot loop on paid calls.
 */
export function nextRoundAction(s: {
  stopReason: string | null
  onFallbackModel: boolean
  toolUses: number
  productTurn: boolean
  round: number
  alreadyRetried: boolean
  draftNamesProducts: boolean
  retryEnabled: boolean
}): RoundAction {
  if (s.stopReason === 'refusal') return s.onFallbackModel ? 'declined' : 'fallback_model'
  if (s.toolUses > 0) return 'run_tools'
  if (s.retryEnabled && s.productTurn && s.round === 0 && !s.alreadyRetried && s.draftNamesProducts) return 'retry_search'
  return 'finalize'
}

/**
 * Kill switch for the one-time search retry (default ON). Measured on two real
 * 8-turn sessions (scripts/ab-model-widget-multiturn.ts, Oct 7 2026): it fired
 * on 4 of 16 turns and led to an actual search on 1; it costs roughly a third
 * of the migration's saving (-38% without it, -24% with it). Kept because an
 * ungrounded product claim is this app's most expensive failure class. Set
 * YURI_SEARCH_RETRY_ENABLED=false to turn it off without a deploy if production
 * rows show it re-answering without searching.
 */
export const SEARCH_RETRY_ENABLED = process.env.YURI_SEARCH_RETRY_ENABLED !== 'false'

/** Extra rounds a retry and a fallback can add on top of the tool-loop limit. */
export const MAX_EXTRA_ROUNDS = 2

/**
 * Shown when both the chat model and the fallback model decline. Honest about
 * what happened — never "trouble accessing the database", which a declined
 * request used to fall through to.
 */
export const DECLINED_REPLY = `I'm not able to take that one on. If it's a spot or a symptom that worries you, a dermatologist (피부과) is the right next stop. Anything about your skin, your routine, or a product, ask away.`

/**
 * Append the per-turn context as a mid-conversation system message AFTER the
 * newest user message. Valid placement on Opus 4.8 and 5.5 (no beta): it must
 * follow a user message and be last or followed by an assistant turn — which
 * holds across tool rounds ([..., user, system, assistant(tool_use), user(tool_result)]).
 */
export function withTrailingContext(messages: MessageParam[], context: string): MessageParam[] {
  const text = context.trim()
  if (!text) return messages
  return [...messages, { role: 'system', content: text }]
}

/**
 * Put the cache breakpoint on the newest user message. Use only where history
 * replays that message byte-identically next turn (the widget: plain strings).
 * The advisor tags history with timestamps but not the current message, so it
 * must NOT use this — see markPenultimateAssistant.
 */
export function markLastUserMessage(messages: MessageParam[]): MessageParam[] {
  let idx = -1
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') { idx = i; break }
  }
  if (idx < 0) return messages
  const m = messages[idx]
  const blocks: ContentBlockParam[] =
    typeof m.content === 'string' ? [{ type: 'text', text: m.content }] : [...m.content]
  if (blocks.length === 0) return messages
  const last = blocks[blocks.length - 1]
  if (last.type !== 'text' && last.type !== 'image') return messages
  blocks[blocks.length - 1] = { ...last, cache_control: { type: 'ephemeral' } }
  const out = [...messages]
  out[idx] = { role: 'user', content: blocks }
  return out
}

/**
 * The long-standing history breakpoint: the last assistant message before the
 * newest user message, when it is still plain text. Positions are counted
 * BEFORE any trailing system message is appended.
 */
export function markPenultimateAssistant(messages: MessageParam[]): MessageParam[] {
  return messages.map((msg, idx) => {
    if (msg.role === 'assistant' && typeof msg.content === 'string' && idx === messages.length - 2) {
      return { role: 'assistant' as const, content: [{ type: 'text' as const, text: msg.content, cache_control: { type: 'ephemeral' as const } }] }
    }
    return msg
  })
}

/**
 * The assistant turn to push back during a tool loop: the model's own content,
 * unchanged. Only a non-thinking model (the Opus 4.8 fallback) may fall back to
 * the event-reconstructed tool_use blocks if the final message could not be read.
 */
export function assistantTurnForToolRound(
  finalContent: Anthropic.Messages.ContentBlock[] | null,
  reconstructed: Array<{ id: string; name: string; input: string }>,
  thinkingModel: boolean
): ContentBlockParam[] {
  if (finalContent && finalContent.some((b) => b.type === 'tool_use')) {
    return finalContent as unknown as ContentBlockParam[]
  }
  // A thinking model's tool turn cannot be rebuilt from its tool_use blocks
  // alone (the missing thinking block makes the next round a 400). Fail loudly
  // into the caller's error path instead of sending an invalid turn.
  if (thinkingModel) {
    throw new Error('[llm-request] final message unavailable for a tool round on a thinking model')
  }
  return reconstructed.map((tb) => {
    let input: Record<string, unknown> = {}
    try { input = JSON.parse(tb.input || '{}') } catch { /* keep empty */ }
    return { type: 'tool_use' as const, id: tb.id, name: tb.name, input }
  })
}

/**
 * Add the one-time search request to the trailing system message (or append
 * one). Only messages AFTER the cache breakpoint change, so the cache is intact.
 */
export function withSearchRetry(messages: MessageParam[]): MessageParam[] {
  const out = [...messages]
  const last = out[out.length - 1]
  if (last && last.role === 'system' && typeof last.content === 'string') {
    out[out.length - 1] = { role: 'system', content: `${last.content}\n\n${SEARCH_RETRY_NOTE}` }
    return out
  }
  return [...out, { role: 'system', content: SEARCH_RETRY_NOTE }]
}
