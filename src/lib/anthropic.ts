import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('Missing ANTHROPIC_API_KEY environment variable')
    }
    client = adaptClientForModels(new Anthropic({ apiKey }))
  }
  return client
}

/**
 * Make request params valid for the model they target. Only Claude Sonnet 5.5
 * needs this; every other model's params pass through untouched.
 * Ported from LGAAS utils/ai-config.js adaptParamsForModel (verified live there
 * on 45 Sonnet contexts, Oct 7 2026). Sonnet 5.5 differs from Sonnet 4.5:
 * - Omitting `thinking` no longer means "no thinking": it runs adaptive
 *   thinking at effort HIGH, which can spend a small max_tokens on thinking
 *   and return no text. `{type:'disabled'}` is a 400.
 * - So a request that asked for no thinking gets adaptive thinking at effort
 *   LOW, not `between_tools` (5.5's thinking-off). Measured Oct 19 2026 on a
 *   real conversation (scripts/ab-decision-memory-thinking.ts): decision
 *   memory caught a Fitzpatrick I->II correction 3/3 on Sonnet 4.5, 1/3 on 5.5
 *   with thinking off, 3/3 on 5.5 adaptive-low, at about the same output size.
 *   An explicit `effort` in the request is kept.
 * - `budget_tokens` thinking is a 400 → adaptive.
 * - Non-default `temperature`/`top_p`/`top_k` are a 400 → dropped.
 * Forced tool_choice (`any`/`tool`) also 400s on Sonnet 5.5. No background
 * call site uses it; it is left alone on purpose so a forced call fails loudly
 * rather than being silently relaxed to `auto`.
 * Idempotent.
 */
export function adaptParamsForModel<P extends { model?: string }>(params: P): P {
  // Keyed on the model ID, not on MODELS.background, so rolling back with
  // AI_BACKGROUND_MODEL sends that model its own (4.5-shaped) params untouched.
  if (!params || params.model !== SONNET_55) return params
  const out: Record<string, unknown> = { ...params }
  delete out.temperature
  delete out.top_p
  delete out.top_k
  const t = out.thinking as { type?: string } | undefined
  if (!t || t.type === 'disabled' || t.type === 'enabled') {
    out.thinking = { type: 'adaptive' }
    const oc = (out.output_config as Record<string, unknown> | undefined) ?? {}
    if (oc.effort === undefined) out.output_config = { ...oc, effort: 'low' }
  }
  return out as P
}

/**
 * Apply adaptParamsForModel at the single choke point every server call goes
 * through, so no call site (present or future) can send 4.5-shaped params to
 * Sonnet 5.5. Also surfaces refusals: Sonnet 5.5 can decline with HTTP 200 and
 * stop_reason 'refusal', usually with no text block — never mistake that for
 * empty output.
 */
function adaptClientForModels(c: Anthropic): Anthropic {
  const messages = c.messages as unknown as {
    create: (params: { model?: string }, options?: unknown) => Promise<unknown>
    stream: (params: { model?: string }, options?: unknown) => unknown
  }
  const create = messages.create.bind(c.messages)
  const stream = messages.stream.bind(c.messages)
  messages.create = (params, options) => {
    const p = create(adaptParamsForModel(params), options)
    // Observe on a SIDE branch and return the SDK's own promise unchanged.
    // Returning `p.then(...)` instead hands back a native Promise, which drops
    // APIPromise.withResponse() — and MessageStream calls
    // `messages.create(...).withResponse()`, so every messages.stream() call
    // (all three Yuri chat surfaces) threw. Caught by a Fable 5.1 review on
    // Oct 19 2026, proven against the real SDK; tests/anthropic-client-real-sdk
    // now executes both paths. Streaming creates resolve to a stream with no
    // stop_reason, so the checks below simply don't fire for them.
    void p.then(
      (res: unknown) => {
        const r = res as { stop_reason?: string; model?: string; stop_details?: { category?: string } }
        if (r && r.stop_reason === 'refusal') {
          console.warn(`[AI-REFUSAL] model=${r.model} category=${r.stop_details?.category ?? 'unknown'}`)
        }
        // A response cut off at max_tokens looks like a success. Make it loud.
        if (r && r.stop_reason === 'max_tokens') {
          console.warn(`[AI-TRUNCATED] model=${r.model} max_tokens=${(params as { max_tokens?: number }).max_tokens} — output was cut off`)
        }
      },
      () => undefined // the caller handles the rejection; don't double-report it
    )
    return p
  }
  messages.stream = (params, options) => stream(adaptParamsForModel(params), options)
  return c
}

const SONNET_55 = 'claude-sonnet-5-5'

export const MODELS = {
  // One-shot analysis surfaces (scan, skin score, dupes, routine generation,
  // lead email, SEO guardian, nudges...). Low volume; not yet re-tested on 5.5.
  primary: 'claude-opus-4-8' as const,
  // The three conversational Yuri surfaces: widget, authenticated advisor,
  // onboarding. Moved Oct 7 2026 after a measured A/B on real sessions
  // (scripts/ab-model-widget-multiturn.ts): -36%/-41% per conversation, and a
  // blind Fable 5.1 judge preferred 5.5 on 16 of 20 widget turns (1 for 4.8).
  chat: 'claude-opus-5-5' as const,
  // Background extraction (memory summaries, decisions, titles, pipeline).
  // Sonnet 4.5 was deprecated Sep 30 2026 and retires Nov 30 2026 (Anthropic's
  // model-deprecations page, checked Oct 19 2026). Every Sonnet 5.5 request is
  // translated by adaptParamsForModel (thinking off -> between_tools) or small
  // extractors return no text. Kill switch: set AI_BACKGROUND_MODEL to
  // 'claude-sonnet-4-5-20250929' to roll back without a deploy (only until it
  // retires).
  background: (process.env.AI_BACKGROUND_MODEL || SONNET_55) as string,
} as const

/**
 * All text in a response, in order. Use this instead of `content[0].text`:
 * a Sonnet 5.5 response can carry no text block at all (a refusal) or put a
 * thinking block first, and `content[0]` then throws or reads the wrong block.
 */
export function responseText(res: { content: Array<{ type: string; text?: string }> }): string {
  return res.content
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
}

/**
 * Opus 5.5 cannot disable thinking; effort is the only cost/latency control and
 * its default is 'medium'. Measured: 'medium' thinking consumed the entire 20%
 * per-token price cut and added ~6s/turn; 'low' kept quality (judge) and cut
 * cost. Thinking tokens count toward max_tokens, so chat ceilings were raised.
 */
export const CHAT_EFFORT = 'low' as const

// ---------------------------------------------------------------------------
// Retry wrapper for transient Anthropic API failures
// ---------------------------------------------------------------------------

const RETRYABLE_STATUS_CODES = new Set([429, 529, 503, 502])
const RETRYABLE_ERROR_PATTERNS = [
  'Connection error',
  'overloaded',
  'ECONNRESET',
  'socket hang up',
  'ETIMEDOUT',
]

function isRetryableError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const err = error as { status?: number; message?: string }
    if (err.status && RETRYABLE_STATUS_CODES.has(err.status)) return true
    if (err.message && RETRYABLE_ERROR_PATTERNS.some((p) => err.message!.includes(p))) return true
  }
  return false
}

/**
 * Call an Anthropic API function with retry logic.
 * Retries on transient failures (529 overloaded, 502/503 gateway errors,
 * connection resets) with exponential backoff (2s, 4s, 8s).
 * Does NOT retry client errors (400, 401, 403, 404).
 */
export async function callAnthropicWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: unknown) {
      if (isRetryableError(error) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
        console.warn(
          `[anthropic] Attempt ${attempt}/${maxRetries} failed (${(error as Error).message || (error as { status?: number }).status}), retrying in ${delay}ms...`
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
  // Unreachable — final attempt either returns or throws
  throw new Error('[anthropic] Retry loop exhausted without result')
}

/** Exposed for streaming retry loops in advisor.ts and widget */
export { isRetryableError }
