/**
 * AI Usage Logger — Fire-and-forget cost tracking for all Claude API calls.
 *
 * Adapted from LGAAS utils/ai-usage-logger.js pattern.
 * Logs every API call to ss_ai_usage for cost visibility and optimization.
 *
 * Usage:
 *   import { logAIUsage } from '@/lib/ai-usage-logger'
 *   // After any Claude API call:
 *   void logAIUsage({
 *     feature: 'yuri_chat',
 *     model: 'claude-opus-4-7',
 *     inputTokens: response.usage.input_tokens,
 *     outputTokens: response.usage.output_tokens,
 *     userId: user.id,          // optional
 *     conversationId: convId,   // optional
 *     cached: true,             // optional
 *   })
 */

import { getServiceClient } from './supabase'
import { estimateCost } from './ai-config'

export type AIFeature =
  | 'yuri_chat'
  | 'widget_chat'
  | 'scan_analysis'
  | 'glass_skin_score'
  | 'shelf_scan'
  | 'routine_generation'
  | 'dupe_finder_ai'
  | 'onboarding_extraction'
  | 'title_generation'
  | 'summary_generation'
  | 'decision_extraction'
  | 'widget_memory'
  | 'content_generation'
  | 'ingredient_enrichment'
  | 'product_extraction'
  | 'reddit_sentiment'
  | 'voice_cleanup'

interface AIUsageParams {
  feature: AIFeature
  model: string
  inputTokens: number
  outputTokens: number
  cacheReadTokens?: number
  cacheCreationTokens?: number
  userId?: string | null
  conversationId?: string | null
  cached?: boolean
}

/**
 * Log an AI API call. Fire-and-forget — never throws, never blocks.
 *
 * Logs errors via console.error (visible in Vercel function logs) so
 * silent breakage doesn't go unnoticed. cf. v10.3.4: an empty catch in
 * mergeDecisionMemory hid three months of decision memory failures.
 */
export async function logAIUsage(params: AIUsageParams): Promise<void> {
  try {
    const cost = estimateCost(params.model, params.inputTokens, params.outputTokens)

    const db = getServiceClient()
    const { error } = await db.from('ss_ai_usage').insert({
      feature: params.feature,
      model: params.model,
      tokens_in: params.inputTokens,
      tokens_out: params.outputTokens,
      cache_read_tokens: params.cacheReadTokens ?? 0,
      cache_creation_tokens: params.cacheCreationTokens ?? 0,
      cost_usd: Math.round(cost * 1_000_000) / 1_000_000, // 6 decimal places
      user_id: params.userId ?? null,
      conversation_id: params.conversationId ?? null,
      cached: params.cached ?? false,
    })
    if (error) {
      console.error('[logAIUsage] insert failed:', error)
    }
  } catch (err) {
    console.error('[logAIUsage] threw:', err)
  }
}
