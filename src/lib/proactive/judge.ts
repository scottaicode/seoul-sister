/**
 * Yuri's proactive judgment call — shared by lead re-engagement and subscriber
 * check-ins (Yuri Wakes Up First, Oct 9 2026).
 *
 * One model call that returns Yuri's DECISION, not just copy: speak or stay
 * silent, why, how sure, and (only if speaking) what to say. Silence is a
 * first-class answer — the prompt never asks her to find something to say.
 *
 * Model: AI_CONTEXTS.YURI_PROACTIVE → MODELS.chat (Opus 5.5, Yuri's own model),
 * effort CHAT_EFFORT. 5.5 cannot take a forced tool_choice (400), so the
 * decision comes back as JSON in text and is parsed FAIL-SAFE: anything other
 * than an explicit, complete "speak" is silence. A parse error never sends.
 */

import { safeSlice } from '@/lib/utils/text-slice'
import { getAnthropicClient, callAnthropicWithRetry, CHAT_EFFORT, MODELS } from '@/lib/anthropic'
import { getAIContext } from '@/lib/ai-config'
import { logAIUsage } from '@/lib/ai-usage-logger'
import { scrubEmailVoice } from '@/lib/email/lead-email'

export interface ProactiveDecision {
  /** 'blocked' = Yuri chose to speak but the content guard refused the draft. */
  decision: 'speak' | 'silent' | 'failed' | 'blocked'
  signal: string | null
  reasoning: string | null
  confidence: number | null
  subject: string | null
  /** Plain text, paragraphs separated by blank lines. Rendered + escaped by the caller. */
  message: string | null
  /** What the CTA prefills into the conversation (?ask=). */
  suggestedAsk: string | null
  model: string
}

const MAX_ASK_CHARS = 220

/**
 * Parse the model's JSON. Exported for tests: the fail-safe direction (no
 * speak unless explicit and complete) is the property worth guarding.
 */
export function parseDecision(text: string, model: string): ProactiveDecision {
  const empty: ProactiveDecision = {
    decision: 'failed',
    signal: null,
    reasoning: null,
    confidence: null,
    subject: null,
    message: null,
    suggestedAsk: null,
    model,
  }
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
  const start = cleaned.indexOf('{')
  const end = cleaned.lastIndexOf('}')
  if (start === -1 || end <= start) return empty

  let parsed: {
    decision?: unknown
    signal?: unknown
    reasoning?: unknown
    confidence?: unknown
    subject?: unknown
    message?: unknown
    suggested_ask?: unknown
  }
  try {
    parsed = JSON.parse(cleaned.slice(start, end + 1))
  } catch {
    return empty
  }

  const str = (v: unknown) => (typeof v === 'string' && v.trim() ? v.trim() : null)
  const conf =
    typeof parsed.confidence === 'number' && parsed.confidence >= 0 && parsed.confidence <= 1
      ? parsed.confidence
      : null
  const base = {
    signal: (str(parsed.signal) ? safeSlice(str(parsed.signal)!, 80) : null),
    reasoning: str(parsed.reasoning),
    confidence: conf,
    model,
  }

  const message = str(parsed.message)
  const subject = str(parsed.subject)
  if (parsed.decision === 'speak' && message && subject) {
    const ask = str(parsed.suggested_ask)
    return {
      ...base,
      decision: 'speak',
      subject: scrubEmailVoice(subject),
      message: scrubEmailVoice(message),
      suggestedAsk: ask ? safeSlice(ask, MAX_ASK_CHARS) : null,
    }
  }
  if (parsed.decision === 'speak') {
    // Asked to speak but returned nothing sendable — record why, send nothing.
    return { ...empty, ...base, decision: 'failed', reasoning: `incomplete speak payload: ${base.reasoning ?? ''}`.trim() }
  }
  return { ...base, decision: 'silent', subject: null, message: null, suggestedAsk: null }
}

export async function runProactiveJudgment(params: {
  system: string
  facts: string
  feature: 'proactive_lead_reengage' | 'proactive_checkin'
  userId?: string
}): Promise<ProactiveDecision> {
  const ctx = getAIContext('YURI_PROACTIVE')
  const client = getAnthropicClient()

  const call = (model: string) =>
    callAnthropicWithRetry(() =>
      client.messages.create({
        model,
        max_tokens: ctx.maxTokens,
        system: params.system,
        messages: [{ role: 'user', content: params.facts }],
        ...(model === MODELS.chat ? { output_config: { effort: CHAT_EFFORT } } : {}),
      })
    )

  try {
    let model = ctx.model
    let response = await call(model)
    // Same refusal posture as the chat surfaces: one re-run on MODELS.primary.
    if (response.stop_reason === 'refusal') {
      model = MODELS.primary
      response = await call(model)
    }

    void logAIUsage({
      feature: params.feature,
      model,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
      userId: params.userId,
    })

    const text = response.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('')
    return parseDecision(text, model)
  } catch (err) {
    console.error(`[proactive] judgment call failed (${params.feature}):`, err)
    return {
      decision: 'failed',
      signal: null,
      reasoning: err instanceof Error ? safeSlice(err.message, 300) : 'unknown error',
      confidence: null,
      subject: null,
      message: null,
      suggestedAsk: null,
      model: ctx.model,
    }
  }
}
