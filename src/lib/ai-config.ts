/**
 * Centralized AI Model Configuration
 *
 * Single source of truth for all Claude API calls across Seoul Sister.
 * Adapted from LGAAS utils/ai-config.js pattern.
 *
 * Every file that calls Claude should import from here instead of
 * hardcoding model IDs. Model upgrades affect everywhere instantly.
 */

export interface AIContext {
  model: string
  maxTokens: number
  caching: boolean
  streaming: boolean
  costNote: string
}

/**
 * All AI contexts used across Seoul Sister.
 * Grouped by priority: user-facing (Opus) vs background (Sonnet).
 */
export const AI_CONTEXTS = {
  // ---------------------------------------------------------------
  // User-facing (Claude Opus 4.6) — quality is paramount
  // ---------------------------------------------------------------
  YURI_CHAT: {
    model: 'claude-opus-4-6',
    maxTokens: 2048,
    caching: true,
    streaming: true,
    costNote: 'Primary Yuri conversation. ~$0.02-0.05 per message.',
  },
  WIDGET_CHAT: {
    model: 'claude-opus-4-6',
    maxTokens: 600,
    caching: true,
    streaming: false, // streams via manual loop, not SDK streaming
    costNote: 'Anonymous widget. Shorter responses, 300 max for anon.',
  },
  SCAN_ANALYSIS: {
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    caching: false,
    streaming: false,
    costNote: 'Vision analysis of product labels. ~$0.03-0.08 per scan.',
  },
  GLASS_SKIN_SCORE: {
    model: 'claude-opus-4-6',
    maxTokens: 2048,
    caching: false,
    streaming: false,
    costNote: 'Vision analysis of selfies. ~$0.03-0.06 per score.',
  },
  SHELF_SCAN: {
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    caching: false,
    streaming: false,
    costNote: 'Vision analysis of product shelves. ~$0.05-0.10 per scan.',
  },
  ROUTINE_GENERATION: {
    model: 'claude-opus-4-6',
    maxTokens: 2048,
    caching: false,
    streaming: false,
    costNote: 'AI routine building. ~$0.03-0.06 per generation.',
  },
  DUPE_FINDER_AI: {
    model: 'claude-opus-4-6',
    maxTokens: 2048,
    caching: false,
    streaming: false,
    costNote: 'AI-powered dupe analysis. ~$0.02-0.04 per query.',
  },

  // ---------------------------------------------------------------
  // Background processing (Claude Sonnet 4.5) — cost efficiency
  // ---------------------------------------------------------------
  ONBOARDING_EXTRACTION: {
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 800,
    caching: true,
    streaming: false,
    costNote: 'Extract skin profile from onboarding chat. ~$0.005 per extraction.',
  },
  TITLE_GENERATION: {
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 50,
    caching: false,
    streaming: false,
    costNote: 'Auto-generate conversation titles. ~$0.001 per title.',
  },
  SUMMARY_GENERATION: {
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 800,
    caching: false,
    streaming: false,
    costNote: 'Conversation summaries for cross-session memory. ~$0.003 per summary.',
  },
  DECISION_EXTRACTION: {
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 800,
    caching: false,
    streaming: false,
    costNote: 'Extract decisions/preferences from conversations. ~$0.003 per extraction.',
  },
  WIDGET_MEMORY: {
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 400,
    caching: false,
    streaming: false,
    costNote: 'Generate cross-session memory for anonymous visitors. ~$0.002 per generation.',
  },
  CONTENT_GENERATION: {
    model: 'claude-opus-4-6',
    maxTokens: 4096,
    caching: false,
    streaming: false,
    costNote: 'Blog post generation. ~$0.10-0.20 per post. Disabled in cron.',
  },
  INGREDIENT_ENRICHMENT: {
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 300,
    caching: false,
    streaming: false,
    costNote: 'Enrich new ingredients during pipeline. ~$0.001 per ingredient.',
  },
  PRODUCT_EXTRACTION: {
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 500,
    caching: false,
    streaming: false,
    costNote: 'Extract product data from scraped listings. ~$0.002 per product.',
  },
  REDDIT_SENTIMENT: {
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 200,
    caching: false,
    streaming: false,
    costNote: 'Sentiment analysis for Reddit mentions. ~$0.001 per post.',
  },
  VOICE_CLEANUP: {
    model: 'claude-sonnet-4-5-20250929',
    maxTokens: 400,
    caching: false,
    streaming: false,
    costNote: 'Humanize AI-heavy text. Only triggered when AI score > 80. ~$0.002.',
  },
} as const satisfies Record<string, AIContext>

export type AIContextKey = keyof typeof AI_CONTEXTS

/**
 * Get the AI context configuration for a specific use case.
 */
export function getAIContext(key: AIContextKey): AIContext {
  return AI_CONTEXTS[key]
}

/**
 * Compute estimated cost for a Claude API call.
 * Returns cost in USD.
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number
): number {
  // Pricing as of April 2026
  const pricing: Record<string, { input: number; output: number }> = {
    'claude-opus-4-6': { input: 15 / 1_000_000, output: 75 / 1_000_000 },
    'claude-sonnet-4-5-20250929': { input: 3 / 1_000_000, output: 15 / 1_000_000 },
    'claude-haiku-4-5-20251001': { input: 0.8 / 1_000_000, output: 4 / 1_000_000 },
  }

  const rate = pricing[model] ?? pricing['claude-opus-4-6']
  return inputTokens * rate.input + outputTokens * rate.output
}
