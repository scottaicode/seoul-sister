/**
 * The ss_ai_usage row for one onboarding model call.
 *
 * Neither onboarding call was ever logged (0 rows all-time as of Oct 17 2026),
 * so onboarding cost was missing from the per-user numbers pricing is decided
 * on. `model` is the constant the request was SENT with (MODELS.*), never the
 * API's echoed `message.model`: estimateCost keys on the exact string and
 * silently falls back to Opus 4.8 rates for anything it does not know, and the
 * other chat surfaces all log the sent constant.
 */
export interface UsageLike {
  input_tokens: number
  output_tokens: number
  cache_read_input_tokens?: number | null
  cache_creation_input_tokens?: number | null
}

export function onboardingUsageRow(
  feature: 'yuri_onboarding' | 'onboarding_extraction',
  model: string,
  usage: UsageLike,
  userId?: string,
  conversationId?: string
) {
  const cacheRead = usage.cache_read_input_tokens ?? 0
  return {
    feature,
    model,
    inputTokens: usage.input_tokens,
    outputTokens: usage.output_tokens,
    cacheReadTokens: cacheRead,
    cacheCreationTokens: usage.cache_creation_input_tokens ?? 0,
    userId: userId ?? null,
    conversationId: conversationId ?? null,
    cached: cacheRead > 0,
  }
}
