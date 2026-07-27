/**
 * AI-assistant referrer detection (July 27 2026).
 *
 * Seoul Sister earns heavy AI-assistant citation volume (525 Bing Copilot
 * citations in one week, 33-66% citation share on commercial K-beauty queries),
 * but visitors arriving from those citations carry NO utm and NO ?from=, so
 * every one of them was tagged 'landing'. The single highest-performing
 * discovery channel was structurally invisible in first-party data — we could
 * not answer "did an AI-cited reader actually talk to Yuri?", which is exactly
 * the question the SEO Guardian's dated bets need graded.
 *
 * This maps a referrer hostname to a channel label. It is deliberately a
 * FACT-CLASSIFIER, not a judgment: it reports where a visitor came from so
 * Yuri and the learning loop can see it. It never changes what Yuri says.
 *
 * LIMITS (stated because a metric that overclaims is worse than none):
 *   - document.referrer is empty for many AI surfaces — in-app webviews,
 *     stripped/no-referrer policies, copy-pasted links. Those still fall
 *     through to 'landing'.
 *   - This RAISES the attribution floor; it is not a census. Treat the counts
 *     as "at least this many", never as the true total.
 */

/** Hostname fragment → channel label. Order matters: first match wins. */
const AI_REFERRERS: Array<[fragment: string, label: string]> = [
  ['chatgpt.com', 'chatgpt'],
  ['chat.openai.com', 'chatgpt'],
  ['openai.com', 'chatgpt'],
  ['copilot.microsoft.com', 'copilot'],
  ['bing.com', 'bing'],
  ['perplexity.ai', 'perplexity'],
  ['claude.ai', 'claude'],
  ['gemini.google.com', 'gemini'],
  ['bard.google.com', 'gemini'],
  ['you.com', 'you'],
  ['poe.com', 'poe'],
  ['duckduckgo.com', 'duckduckgo'],
]

/**
 * Returns a channel label for an AI-assistant/search referrer, or null when the
 * referrer is absent, same-origin, or unrecognized (caller keeps its default).
 */
export function detectAiReferrer(referrer: string | null | undefined): string | null {
  if (!referrer) return null

  let host: string
  try {
    host = new URL(referrer).hostname.toLowerCase()
  } catch {
    return null
  }

  // Same-origin navigation is not a discovery channel.
  if (host.endsWith('seoulsister.com')) return null

  for (const [fragment, label] of AI_REFERRERS) {
    if (host === fragment || host.endsWith(`.${fragment}`) || host === `www.${fragment}`) {
      return label
    }
  }

  return null
}
