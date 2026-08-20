import type { ExecutionStatus } from './bet-grader'

// ---------------------------------------------------------------------------
// Execution verification — "did we actually do it?", answered BEFORE "did it
// work?".
//
// Why this exists: on Aug 19 2026 the BoJ Aqua-Fresh bet was found to be HALF
// shipped — the metadata rewrite was live (verified by fetching the page and
// reading its <title>), while the on-page "full INCI section" it promised did
// not exist. Grading that as a `miss` would have blamed the strategist for the
// content pipeline's omission, and the remediations are opposite: one hardens a
// generator that behaved correctly, the other chases work that never shipped.
//
// `ss_content_posts.updated_at` is NOT usable as evidence — 40 of 47 posts
// share a single 2026-08-03 timestamp from a bulk migration. The live page is
// the only trustworthy witness.
// ---------------------------------------------------------------------------

const SITE = 'https://www.seoulsister.com'

export interface ExecutionCheck {
  status: ExecutionStatus
  evidence: string
}

/**
 * Terms in an action that describe on-page structure we can look for.
 *
 * A naive /['"]...['"]/ treats CONTRACTIONS and POSSESSIVES as quote-openers.
 * Measured Aug 20 2026: "Don't bury the ingredients: add a scannable
 * 'Ingredients list' section" extracted `t bury the ingredients: add a
 * scannable ` — garbage that matches no page, producing a false
 * `not_executed` that silently drops the bet from grading entirely.
 *
 * So: double quotes always count; a single quote opens a marker only when it
 * follows whitespace/start and closes before whitespace/punctuation/end. Any
 * candidate that does not begin and end with an alphanumeric is discarded as
 * an extraction artifact rather than trusted as a marker.
 */
export function extractMarkers(action: string): string[] {
  const markers: string[] = []
  for (const m of action.matchAll(/"([^"]{4,60})"/g)) markers.push(m[1])
  for (const m of action.matchAll(/(?:^|[\s(\[])'([^']{4,60})'(?=[\s.,;:!?)\]]|$)/g)) markers.push(m[1])
  // Curly quotes, which strategist prose regularly contains.
  for (const m of action.matchAll(/[\u2018\u201C]([^\u2019\u201D]{4,60})[\u2019\u201D]/g)) markers.push(m[1])
  return markers.filter((t) => /^[A-Za-z0-9]/.test(t) && /[A-Za-z0-9?]$/.test(t.trim()))
}

export function stripHtml(html: string): string {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    // The live site emits BOTH &#39; and &#x27; for apostrophes (verified on a
    // real page). Missing &#x27; makes a genuinely-present marker fail to
    // match — a false `not_executed` on shipped work.
    .replace(/&#0*39;|&#x0*27;/gi, "'")
    .replace(/&#8217;|&#x2019;|&rsquo;/gi, '\u2019')
    .replace(/&quot;|&#0*34;|&#x0*22;/gi, '"')
    .replace(/&nbsp;|&#160;|&#xa0;/gi, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
}

/**
 * Fetch the live page and look for evidence the bet's action shipped.
 *
 * Deliberately conservative: this returns `unverified` rather than
 * `not_executed` whenever it cannot form an opinion. A false `not_executed`
 * silently removes a bet from grading; a false `executed` lets an unshipped bet
 * produce a hit/miss. Both are worse than an honest abstention, so anything
 * ambiguous abstains — and `unverified` never produces a `hit` downstream
 * without its provenance travelling alongside it.
 */
export async function verifyExecution(
  targetPage: string | null,
  action: string,
  actionType: string
): Promise<ExecutionCheck> {
  if (!targetPage) {
    return { status: 'unverified', evidence: 'bet names no target page (new-content bet — check URL presence in GSC instead)' }
  }

  let html: string
  try {
    const res = await fetch(`${SITE}${targetPage}`, {
      headers: { 'user-agent': 'SeoulSisterBetGrader/1.0' },
      signal: AbortSignal.timeout(20_000),
    })
    if (res.status === 404) {
      return { status: 'not_executed', evidence: `page 404s at ${targetPage}` }
    }
    if (!res.ok) {
      return { status: 'unverified', evidence: `fetch returned HTTP ${res.status} — cannot inspect` }
    }
    html = await res.text()
  } catch (err) {
    // A network failure is NOT evidence of non-execution.
    return {
      status: 'unverified',
      evidence: `fetch failed (${err instanceof Error ? err.message : 'unknown'}) — cannot inspect`,
    }
  }

  const norm = (t: string) => t.toLowerCase().replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"')
  const text = norm(stripHtml(html))
  const title = html.match(/<title>([^<]*)<\/title>/i)?.[1] ?? ''
  const metaDesc = html.match(/name="description"\s+content="([^"]*)"/i)?.[1] ?? ''

  const markers = extractMarkers(action)
  const found = markers.filter((m) => text.includes(norm(m)))

  if (markers.length > 0) {
    if (found.length === markers.length) {
      return { status: 'executed', evidence: `all ${markers.length} named element(s) present on live page` }
    }
    if (found.length > 0) {
      return {
        status: 'partially_executed',
        evidence: `${found.length}/${markers.length} named elements present (found: ${found.join(', ')})`,
      }
    }
    return {
      status: 'not_executed',
      evidence: `none of the named elements present on the live page (looked for: ${markers.join(', ')})`,
    }
  }

  // No quoted markers to test. Metadata bets are still checkable: a rewritten
  // title/description is directly observable.
  if (actionType === 'metadata') {
    if (title || metaDesc) {
      return {
        status: 'unverified',
        evidence: `metadata present (title: "${title.slice(0, 70)}") but the bet named no exact string to match against`,
      }
    }
  }

  return { status: 'unverified', evidence: 'no testable marker in the action text' }
}
