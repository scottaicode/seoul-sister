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

/**
 * Anchor/jump-target ids named in an action, e.g. `#best-serum-for-pie`.
 *
 * A generator reproduces an id byte-for-byte while the surrounding prose is
 * rewritten freely, so an id is the one marker species immune to the paraphrase
 * drift that made verbatim phrase-matching unreliable.
 */
export function extractAnchorIds(action: string): string[] {
  return [...action.matchAll(/#([a-z0-9][a-z0-9-]{2,60})\b/gi)].map((m) => m[1].toLowerCase())
}

/**
 * Ids actually present in the live HTML. Read from RAW html on purpose:
 * `stripHtml` discards attributes, which is why shipped anchors were invisible
 * to this verifier.
 */
export function liveAnchorIds(html: string): Set<string> {
  const ids = new Set<string>()
  for (const m of html.matchAll(/\bid=["']([^"']{1,80})["']/gi)) ids.add(m[1].toLowerCase())
  return ids
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

  // An internal-linking bet CHANGES one page and names another as its ranking
  // target. `targetPage` is the ranking target, so fetching it inspects the
  // wrong document: measured Aug 25 2026, the Aug 5 `pie-to-pih-internal-links`
  // bet (add links ON the PIE post) carries markers 'fade post-acne dark spots'
  // and 'post-inflammatory hyperpigmentation' that appear on the PIH page 18x
  // and 6x as ordinary topic text — it would have graded `executed` on evidence
  // from a page the action never touched. Abstain rather than inspect the
  // wrong document.
  if (actionType === 'internal_links') {
    return {
      status: 'unverified',
      evidence:
        'internal-link bet: the page that CHANGES is not the ranking target this verifier fetches — cannot confirm from the target page',
    }
  }

  const markers = extractMarkers(action)
  const anchorIds = extractAnchorIds(action)
  const liveIds = liveAnchorIds(html)

  // Anchor ids are the strongest execution evidence available and were
  // previously invisible: `stripHtml` deletes attributes, so the shipped
  // `#best-serum-for-pie` anchors on the PIE post could never be seen. They
  // survive paraphrase (a generator reproduces an id exactly, while prose
  // drifts), so an id hit is real evidence where a prose hit may be topic
  // vocabulary.
  const foundIds = anchorIds.filter((id) => liveIds.has(id))
  const found = markers.filter((m) => text.includes(norm(m)))
  const totalNamed = markers.length + anchorIds.length
  const totalFound = found.length + foundIds.length

  if (totalNamed > 0) {
    const desc = [...found, ...foundIds.map((i) => `#${i}`)].join(', ')
    if (totalFound === totalNamed) {
      return { status: 'executed', evidence: `all ${totalNamed} named element(s) present on live page` }
    }
    if (totalFound > 0) {
      return {
        status: 'partially_executed',
        evidence: `${totalFound}/${totalNamed} named elements present (found: ${desc})`,
      }
    }
    // ZERO matches is NOT evidence of non-execution.
    //
    // Earned Aug 25 2026. The Jul 26 `pih-into-pie-post` bet named "PIH vs PIE";
    // the live page ships that exact section as "PIE vs PIH: Which One Do You
    // Actually Have?". Verbatim matching missed it and returned `not_executed`,
    // which gate 1 treats as terminal AND which seo-guardian.ts explicitly tells
    // the strategist to re-propose — producing a 4th bet on an already-finished
    // page and nearly costing a duplicate work order.
    //
    // The tempting repair — word-order-tolerant token matching — was MEASURED
    // and REJECTED: 24 separate 8-word windows on the live PIE page contain both
    // "PIH" and "PIE" as ordinary topic vocabulary, so it would have returned
    // `executed` against the PRE-EDIT page too. A false `executed` is strictly
    // worse than a false `not_executed`: it is the only status that reaches a
    // hit/miss, and it stamps the write-once `execution_first_seen` (`??`, never
    // overwritten), permanently corrupting gate 2b.
    //
    // Markers are extracted from PROSE THE STRATEGIST WROTE to describe intent
    // — sometimes a literal string, sometimes a concept ('Best for your
    // concern' was never meant to appear on the page). No matching policy can
    // recover a distinction the data does not carry, so the honest state is
    // abstention. `not_executed` is reserved for positive evidence (a 404).
    return {
      status: 'unverified',
      evidence: `named phrases not found verbatim (looked for: ${[...markers, ...anchorIds.map((i) => `#${i}`)].join(', ')}) — cannot distinguish a paraphrase from non-execution`,
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
