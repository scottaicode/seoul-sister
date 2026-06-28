/**
 * Builds the VISITOR's opening question to seed a Yuri conversation when a blog
 * reader clicks an "Ask Yuri" CTA. This is the user's first message — NOT a Yuri
 * script. It removes the re-type-from-scratch wall that was leaking the engaged
 * blog-reader cohort (GA4 Jun 24-28: readers land, read, bounce before Yuri).
 *
 * Yuri reasons and responds freely from here (AI-First — she owns the answer).
 * We only phrase a natural opener tied to what the reader just read, so the
 * conversation starts warm and contextual.
 */

interface BlogContext {
  title?: string | null
  category?: string | null
  primaryKeyword?: string | null
}

export function buildBlogPrefill({ title, category, primaryKeyword }: BlogContext): string {
  const topic = (primaryKeyword || '').trim()
  const cat = (category || '').toLowerCase()

  // Prefer the specific keyword (e.g. "hydrating toner") when present.
  if (topic) {
    return `I just read your guide on ${topic} — can you help me figure out what's right for my skin?`
  }

  // Otherwise fall back to a category-shaped opener.
  if (cat.includes('routine') || cat.includes('guide'))
    return `I just read one of your routine guides — can you help me build one for my skin type?`
  if (cat.includes('ingredient'))
    return `I just read one of your ingredient breakdowns — can you tell me if it's right for my skin?`
  if (cat.includes('sunscreen') || cat.includes('sun'))
    return `I just read your sunscreen guide — can you help me pick the right K-beauty SPF for my skin?`
  if (cat.includes('acne'))
    return `I just read your article on acne — can you help me figure out what to actually use?`
  if (cat.includes('trend'))
    return `I just read your trend report — what's worth trying for my skin right now?`

  // Last resort: reference the post title if we have it, else a generic opener.
  if (title && title.trim())
    return `I just read your article "${title.trim()}" — can you help me apply it to my own skin?`
  return `I just read one of your articles — can you help me figure out what's right for my skin?`
}
