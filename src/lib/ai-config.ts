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
  // User-facing — conversational surfaces on Claude Opus 5.5 (MODELS.chat,
  // effort low); one-shot analysis on Claude Opus 4.8 (MODELS.primary)
  // ---------------------------------------------------------------
  YURI_CHAT: {
    model: 'claude-opus-5-5',
    maxTokens: 8000,
    caching: true,
    streaming: true,
    costNote: 'Primary Yuri conversation (MODELS.chat). Measured Oct 2026: ~$0.27-0.34/msg on Opus 4.8 before the v11.39.0 cache + model change; re-measure from ss_ai_usage.',
  },
  WIDGET_CHAT: {
    model: 'claude-opus-5-5',
    maxTokens: 6000,
    caching: true,
    streaming: false, // streams via manual loop, not SDK streaming
    costNote: 'Anonymous widget (MODELS.chat). Visible length is set by the prompt; 6000 is a ceiling that includes thinking.',
  },
  SCAN_ANALYSIS: {
    model: 'claude-opus-4-8',
    maxTokens: 4096,
    caching: false,
    streaming: false,
    costNote: 'Vision analysis of product labels. ~$0.03-0.08 per scan.',
  },
  GLASS_SKIN_SCORE: {
    model: 'claude-opus-4-8',
    maxTokens: 2048,
    caching: false,
    streaming: false,
    costNote: 'Vision analysis of selfies. ~$0.03-0.06 per score.',
  },
  SHELF_SCAN: {
    model: 'claude-opus-4-8',
    maxTokens: 4096,
    caching: false,
    streaming: false,
    costNote: 'Vision analysis of product shelves. ~$0.05-0.10 per scan.',
  },
  ROUTINE_GENERATION: {
    model: 'claude-opus-4-8',
    maxTokens: 2048,
    caching: false,
    streaming: false,
    costNote: 'AI routine building. ~$0.03-0.06 per generation.',
  },
  DUPE_FINDER_AI: {
    model: 'claude-opus-4-8',
    maxTokens: 2048,
    caching: false,
    streaming: false,
    costNote: 'AI-powered dupe analysis. ~$0.02-0.04 per query.',
  },
  /**
   * v10.8.0 Path B — Products as Yuri's shortlist.
   * Generates 2-3 sentence Yuri-voice reasoning for whether a specific product
   * fits or conflicts with the subscriber's active treatment phase + decision
   * memory + allergens. Cached in ss_product_curation_reasoning per state-hash.
   *
   * Opus 4.8 chosen over Sonnet 4.5 per Principle 1 + Scott's May 22 decision:
   * voice consistency with /yuri chat matters more than the ~$0.10/sub/month
   * delta. Cost projection in PATH-B-PRODUCTS-AS-YURIS-SHORTLIST.md.
   */
  PRODUCT_CURATION_REASONING: {
    model: 'claude-opus-4-8',
    maxTokens: 400,
    caching: false,
    streaming: false,
    costNote: 'Per-product reasoning for /browse skip toggle. ~$0.011-0.016 per generation, 80%+ cache hit rate.',
  },
  PROACTIVE_NUDGE: {
    // v10.10.0 — the nudge message IS Yuri speaking to the subscriber about her
    // skin. User-facing => Opus 4.8 (Principle 1). Deliberately NOT Sonnet, even
    // though LGAAS generates its nudge emails with Sonnet — LGAAS's nudges are
    // lower-stakes re-engagement for trial members of someone else's business;
    // Seoul Sister's nudge is Yuri's own voice to a paying sub. Do not "optimize"
    // this back to Sonnet. See PROACTIVE-NUDGE-BLUEPRINT.md.
    model: 'claude-opus-4-8',
    maxTokens: 350,
    caching: false,
    streaming: false,
    costNote: 'Proactive nudge copy in Yuri voice. ~$0.01-0.02 per nudge, capped at 3/user with multi-day spacing.',
  },
  SEO_GUARDIAN: {
    // v11.11.0 — weekly SEO strategist over Search Console data. Internal
    // audience (owner email), but this is judgment-heavy strategic work whose
    // bets get GRADED against real GSC outcomes weeks later — the PROACTIVE_NUDGE
    // reasoning applies: quality over cost for graded judgment. Weekly cadence
    // makes Opus cost trivial (~$0.30-0.60/run). Do not "optimize" to Sonnet.
    model: 'claude-opus-4-8',
    maxTokens: 6000,
    caching: false,
    streaming: false,
    costNote: 'Weekly SEO strategy report + dated bets. ~$0.30-0.60 per run, 1 run/week.',
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
    maxTokens: 2000,
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
    model: 'claude-opus-4-8',
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
 *
 * Cache token pricing (Anthropic prompt caching):
 *   - cache-read tokens bill at 10% of the base input rate
 *   - cache-creation (write) tokens bill at 125% of the base input rate
 * `inputTokens` should be the NON-cached input tokens only (the SDK reports
 * cache-read/cache-creation separately from `input_tokens`). Passing cache
 * tokens is optional and backward-compatible — older 3-arg callers compute
 * the uncached cost exactly as before.
 *
 * NOTE (June 2026): Prior to this fix the Yuri streaming path logged
 * inputTokens:0 and a char-length output estimate, so ss_ai_usage.cost_usd
 * understated true spend by ~2-4x (input is the dominant cost per turn).
 * Real per-round usage is now captured from stream.finalMessage().usage.
 */
export function estimateCost(
  model: string,
  inputTokens: number,
  outputTokens: number,
  cacheReadTokens = 0,
  cacheCreationTokens = 0
): number {
  // Per-MTok rates (Anthropic pricing, verified Oct 2026). Cache rates are
  // listed per model, not derived: Opus 5.5 reads cache at 0.05x input ($0.20),
  // where the 4.x family reads at 0.1x — a flat multiplier would overstate 5.5
  // cache reads 2x in ss_ai_usage. 5-minute cache writes are 1.25x input.
  const M = 1_000_000
  const pricing: Record<string, { input: number; output: number; cacheRead: number; cacheWrite: number }> = {
    'claude-opus-5-5': { input: 4 / M, output: 20 / M, cacheRead: 0.2 / M, cacheWrite: 5 / M },
    'claude-opus-4-8': { input: 5 / M, output: 25 / M, cacheRead: 0.5 / M, cacheWrite: 6.25 / M },
    'claude-opus-4-7': { input: 5 / M, output: 25 / M, cacheRead: 0.5 / M, cacheWrite: 6.25 / M },
    'claude-sonnet-4-5-20250929': { input: 3 / M, output: 15 / M, cacheRead: 0.3 / M, cacheWrite: 3.75 / M },
    'claude-haiku-4-5-20251001': { input: 1 / M, output: 5 / M, cacheRead: 0.1 / M, cacheWrite: 1.25 / M },
  }

  const rate = pricing[model] ?? pricing['claude-opus-4-8']
  return (
    inputTokens * rate.input +
    outputTokens * rate.output +
    cacheReadTokens * rate.cacheRead +
    cacheCreationTokens * rate.cacheWrite
  )
}
