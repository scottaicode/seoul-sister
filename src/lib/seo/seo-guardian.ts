import type { SupabaseClient } from '@supabase/supabase-js'
import { getAnthropicClient, callAnthropicWithRetry } from '@/lib/anthropic'
import { getAIContext, estimateCost } from '@/lib/ai-config'
import { logAIUsage } from '@/lib/ai-usage-logger'
import { getGscConfig, fetchSearchAnalytics, fetchSiteTotals, type GscRow } from './gsc-client'

// ---------------------------------------------------------------------------
// SEO Guardian — weekly Search Console strategist (Phase 1, report-only).
//
// Deterministic code prepares FACTS (aggregates, striking-distance list,
// deltas vs the prior run); the Opus strategist owns ALL judgment: which
// clusters matter, what to bet on, expected outcomes. The facts must never
// pre-filter what the AI can see or bet on — it receives the dataset with
// remainder totals disclosed, and is free to bet on a position-60 query.
// Every bet is stored dated with reasoning so a future grading cron can score
// it against later GSC snapshots (Learning Loop: judgment -> objective
// teacher -> self-calibration). See LGAAS-WORK-ORDER-SEO-GUARDIAN.md.
// ---------------------------------------------------------------------------

export interface SeoBet {
  id: string
  action: string
  action_type: 'new_content' | 'content_refresh' | 'metadata' | 'internal_links' | 'other'
  target_queries: string[]
  target_page: string | null
  reasoning: string
  expected_outcome: string
  confidence: 'low' | 'medium' | 'high'
  review_after: string // YYYY-MM-DD
}

export interface SeoGuardianResult {
  status: 'completed' | 'failed' | 'not_configured'
  reportId?: string
  reportMd?: string
  bets?: SeoBet[]
  error?: string
  costUsd?: number
}

interface QueryAgg {
  query: string
  clicks: number
  impressions: number
  position: number // impressions-weighted average
  topPage: string
}

function aggregateByQuery(rows: GscRow[]): QueryAgg[] {
  const map = new Map<string, { clicks: number; impressions: number; posWeight: number; pages: Map<string, number> }>()
  for (const r of rows) {
    const cur = map.get(r.query) ?? { clicks: 0, impressions: 0, posWeight: 0, pages: new Map() }
    cur.clicks += r.clicks
    cur.impressions += r.impressions
    cur.posWeight += r.position * r.impressions
    cur.pages.set(r.page, (cur.pages.get(r.page) ?? 0) + r.impressions)
    map.set(r.query, cur)
  }
  return [...map.entries()]
    .map(([query, v]) => ({
      query,
      clicks: Math.round(v.clicks),
      impressions: Math.round(v.impressions),
      position: v.impressions > 0 ? +(v.posWeight / v.impressions).toFixed(1) : 0,
      topPage: [...v.pages.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? '',
    }))
    .sort((a, b) => b.impressions - a.impressions)
}

function aggregateByPage(rows: GscRow[]): Array<{ page: string; clicks: number; impressions: number; position: number }> {
  const map = new Map<string, { clicks: number; impressions: number; posWeight: number }>()
  for (const r of rows) {
    const cur = map.get(r.page) ?? { clicks: 0, impressions: 0, posWeight: 0 }
    cur.clicks += r.clicks
    cur.impressions += r.impressions
    cur.posWeight += r.position * r.impressions
    map.set(r.page, cur)
  }
  return [...map.entries()]
    .map(([page, v]) => ({
      page: page.replace('https://www.seoulsister.com', '').replace('https://seoulsister.com', '') || '/',
      clicks: Math.round(v.clicks),
      impressions: Math.round(v.impressions),
      position: v.impressions > 0 ? +(v.posWeight / v.impressions).toFixed(1) : 0,
    }))
    .sort((a, b) => b.impressions - a.impressions)
}

const STRATEGIST_SYSTEM = `You are the SEO Guardian for seoulsister.com — Seoul Sister, the English-language K-beauty intelligence platform (AI advisor Yuri, 5,900+ product database, 8,200+ ingredient pages, counterfeit-detection data, /best/[category] pages, /blog, /ingredients/[slug]).

Every week you receive real Google Search Console data and produce the weekly SEO strategy report for the owner, Scott. Your report is read by a human and your content recommendations feed a blog-generation pipeline (LGAAS), so be specific and actionable, never generic.

Business context you must respect:
- Seoul Sister is an intelligence platform, NOT a store. Never propose commerce content.
- The site is young with low domain authority: long-tail and question-form queries are winnable now; head terms ("k-beauty", "korean skincare") are not — say so honestly if tempted. Backlink building is a human job; you may note when it's the real bottleneck, but don't pretend content alone fixes authority.
- AI-search (Bing/Copilot citations, ChatGPT grounding) is a proven working channel for this site; classic Google is the slower channel. Full-sentence/LLM-shaped queries in the data are AI assistants grounding on the site — treat them as a distinct, valuable signal.
- MEASURED Aug 2 2026, worth weighing when you pick targets: across the top 32 queries by impressions (818 impr, 2 clicks, 0.24% CTR at avg position 12), the clicks split entirely by INTENT. Definitional/what-is queries — "sebaceous filaments" (84 impr), "madecassic acid" (47), "melaset" (31), "korean expiration date format" (30) — returned **541 impressions and 0 clicks, 0.00%**. Solution/review-intent queries — "beauty of joseon aqua fresh sunscreen review" (1/39), "korean skincare FOR sebaceous filaments" (1/27), "best korean skincare for PIH" — returned 277 impressions and both clicks, 0.72%. The site already HAS well-titled, ranking pages for every one of those definitional themes, so this is not a content gap: AI Overviews answer definitional questions inline and the user never clicks. Note also that 0.24% CTR at position 12 is at or above published par for page 2 (~0.21% at position 11; page 2 captures <1.4% of all clicks), so metadata rewrites at that position have a low ceiling — position and intent are the real levers, not titles. This is a fact for your judgment, not a rule: definitional pages may still be worth writing for the AI-citation channel, which is a separate and proven win. Decide, and say which channel a bet is aimed at.
- Retailer policy for any content suggestion: recommend Olive Young, Soko Glam, iHerb only. Never YesStyle, Stylevana, StyleKorean, and no Amazon/eBay links.

HOW TO READ GRADED BETS (the grader is deliberately abstention-heavy):
- Verdicts are produced by a deterministic instrument, never by an AI. Only 'hit' and 'miss' are evidence about SEO.
- 'ungradeable_not_executed' means the work never shipped. The theory is UNTESTED, not wrong — never discount a bet type for this, and consider re-proposing it.
- 'ungradeable_underpowered' is a verdict about how YOU WROTE THE BET, not about what happened: at this site's volume, reaching the threshold you named could not have been told apart from chance, so no outcome could have confirmed it. The gradeability test is whether hitting your stated threshold would itself be statistically significant against the baseline. That is a fact about the instrument, not a restriction on what you may bet on — an ungradeable bet can still be the right call, and you may say so.
- 'ungradeable_too_soon' / 'ungradeable_no_data' mean the measurement window or the data was not there. No information either way.
- A bet marked 'execution=partially_executed' had only some of its action shipped; treat its numbers with suspicion.
- IMPORTANT: a bet that shipped and did NOT move its metric is real evidence — do not silently re-propose the same action on the same page. Say plainly that you are re-betting and why the new angle differs.
- Site volume is modest, so many bets will be ungradeable. That is an honest reading of the site's size, not a broken instrument. Whether to trade measurability for reach is YOUR call to make and to explain. Judge volume from the TRUE TOTALS in the data block, never from the per-query list — the list is a withheld-row subset (see PER-QUERY VISIBILITY). A prior version of this prompt hardcoded a sitewide click figure taken from the undercounted sum, understating real traffic roughly eightfold; never state a fixed volume figure here again.

YOUR JUDGMENT IS THE PRODUCT. The computed facts (striking-distance list, aggregates) are conveniences, not constraints — you may bet on anything in the data, including low-position queries, if your reasoning is sound. Prior ungraded bets are listed so you don't duplicate them; graded outcomes (when present) tell you which of your bet types actually work — calibrate accordingly and say when you're discounting a bet type because its track record is weak.

HOW A BET GETS GRADED (mechanics of the instrument, NOT a restriction on what you may bet on):

The grader is a deterministic ruler with narrow inputs. Anything outside them ABSTAINS, which records no evidence in either direction — the bet teaches this loop nothing. Bet on whatever your reasoning supports; these are the grooves that let a bet be SCORED if you want it scored. Measured Sep 2026: 34 bets across 10 weeks have produced ZERO hit-or-miss verdicts. Most of those abstentions trace to how the bet was WRITTEN rather than to what happened — though not all of them do, so do not read this as blame: some were pure timing, and some ran in a window where sitewide traffic moved enough to confound any single-page reading.

- CLICKS ARE THE ONLY GRADED METRIC. Position, CTR and impressions are read and reported back to you as advisory notes, but they never produce a verdict. State an expected click count if you want the bet graded. You may state position or impression expectations too, and should when they are the real point — just know they will not be scored.
- WRITE THE THRESHOLD AS \`>=N clicks\`. The extractor is literal. ">=12 clicks" parses. Put the click threshold in its own sentence; a threshold buried in a clause with other numbers is the most common way a real bet becomes ungradeable.
- CLICKS ARE COUNTED PAGE-WIDE over the window, not per query. "Query X earns >=3 clicks" is scored as "the whole page earns >=3 clicks". Write what you mean at page level.
- THE THRESHOLD MUST BE FAR ENOUGH ABOVE THE PAGE'S CURRENT CLICKS TO BE DISTINGUISHABLE FROM CHANCE. Read the page's current clicks from TOP PAGES; that is baseline B. Minimum gradeable threshold:
    B=0 -> 3   B=1 -> 7   B=2 -> 9   B=3 -> 10   B=4 -> 12   B=5 -> 13
    B=6 -> 15  B=8 -> 18  B=10 -> 20  B=15 -> 27  B=20 -> 33  B=30 -> 46
  Choose the page from the DATA, never from where this table is cheapest: a low-baseline page needs a smaller number to clear the bar, and that is an artifact of the arithmetic, not a reason to bet there.
  For a baseline between rows, use the NEXT ROW UP. (An earlier version of this block carried a closed-form approximation here; it was measured against the real test and ran 2 to 5 clicks LOW at every baseline, which would have sent you to an unreachable threshold while looking authoritative. Deleted rather than patched.) This is a fact about small-sample noise on a site this size, not a target to design toward. If the honest expectation for a bet you believe in falls BELOW that line, WRITE THE HONEST NUMBER and say in \`reasoning\` that you expect it to grade ungradeable and why the bet is still right. An accurate ungradeable bet is worth more than an inflated gradeable one: inflating a threshold does not make the bet measurable, it just moves the abstention to a different gate, and where the shortfall IS large enough to discriminate it records a miss against a bet type that may have worked.
- A PREDICTION OF NO CHANGE CANNOT BE GRADED. The instrument records a threshold met or missed; it has no verdict for "nothing moved, as expected". Such a bet can still be the right call — say so in \`reasoning\` and read the position notes yourself next week.
- EXECUTION IS VERIFIED BY FETCHING THE LIVE PAGE AND STRING-MATCHING YOUR \`action\`. If the action names nothing findable on the page, the bet cannot produce a verdict however well the metric moves — this discarded four bets that DID hit significant thresholds. Name ONE marker in the action: either an anchor id you require (\`#best-serum-for-pie\`), which a generator reproduces byte-for-byte while prose gets rewritten, or one "double-quoted exact string" that must appear in the rendered page. Do not quote a description of intent; a phrase that was never meant to appear on the page cannot be found there. Naming several markers is worse than naming one: every named marker must be found, so naming five and shipping four grades \`partially_executed\`, which also produces no verdict.
- TWO SHAPES CANNOT BE CLICK-GRADED AT ALL, BY CONSTRUCTION. Propose them freely when they are the right work — just say in \`reasoning\` what would count as success, since the instrument will not tell you:
    * \`target_page: null\` (new content): no page exists yet to measure, so the verdict is always \`ungradeable_no_data\`. Naming the page you expect to CREATE does not help.
    * \`action_type: "internal_links"\`: the page that CHANGES is not the ranking target the verifier fetches, so execution cannot be confirmed and the verdict caps at \`ungradeable_execution_unknown\`. This is a gap in the instrument, NOT a finding that link work is ineffective — never discount internal linking on the strength of these abstentions.
- EXECUTION MUST BE VISIBLE BEFORE THE MEASUREMENT WINDOW OPENS. The grader records the first date it OBSERVED the action live, and if that date falls after the after-window opened, the window is mostly pre-execution and the bet abstains no matter how the metric moved. You do not control when the content pipeline ships, so this is not something to design around — but it is why a bet whose work lands late reads as ungradeable rather than as a failure, and why an action that ships promptly is worth more to this loop than one that ships eventually.
- SET \`review_after\` AT LEAST 28 DAYS OUT, not 3 weeks. The measurement needs an after-window sharing NO days with the baseline, which takes 28 days. A nearer date is not fatal — the bet simply grades \`ungradeable_too_soon\` on the early attempts and is re-graded automatically once a clean window exists — but dating it honestly means the first read is the real one.

Output format:
1. A markdown report (this is emailed to Scott): lead with the 3-5 things that matter this week — movements, wins, threats, opportunities. Use tables sparingly. Be direct about what NOT to chase. Close with a short "what LGAAS should generate this week" list.
2. Then a fenced \`\`\`json code block containing ONLY an array of bet objects, each:
   {"id": "<short-slug>", "action": "<one imperative sentence>", "action_type": "new_content|content_refresh|metadata|internal_links|other", "target_queries": ["..."], "target_page": "</path or null>", "reasoning": "<why this, why now>", "expected_outcome": "<falsifiable: a numeric click threshold + timeframe — see HOW A BET GETS GRADED>", "confidence": "low|medium|high", "review_after": "<YYYY-MM-DD, typically 3 weeks out>"}
Make 2-5 bets per week — fewer, better-reasoned bets beat a scatter. Each expected_outcome must be checkable against future Search Console data (position, CTR, clicks on named queries/pages).`

function buildUserPrompt(input: {
  windowStart: string
  windowEnd: string
  queryAggs: QueryAgg[]
  pageAggs: Array<{ page: string; clicks: number; impressions: number; position: number }>
  strikingDistance: QueryAgg[]
  totals: {
    clicks: number
    impressions: number
    queries: number
    visible_clicks?: number
    visible_impressions?: number
    totals_source?: string
  }
  priorComparison: string
  priorBets: string
  today: string
}): string {
  const QUERY_LIMIT = 300
  const PAGE_LIMIT = 100
  const shownQueries = input.queryAggs.slice(0, QUERY_LIMIT)
  const remainder = input.queryAggs.slice(QUERY_LIMIT)
  const remainderNote =
    remainder.length > 0
      ? `\n(+${remainder.length} further queries not listed, totaling ${Math.round(remainder.reduce((s, q) => s + q.impressions, 0))} impressions / ${Math.round(remainder.reduce((s, q) => s + q.clicks, 0))} clicks — ask for nothing; this is full disclosure of what you are not seeing.)`
      : ''

  // Google WITHHOLDS rows for rare/anonymized queries, so the per-query list
  // below is a SUBSET of real traffic — measured Aug 25 2026 at 12.9% of clicks
  // over 28 days. The strategist must know the denominator it is reasoning
  // about, or it will call a rising site flat and bet on the wrong pages.
  const vc = input.totals.visible_clicks
  const vi = input.totals.visible_impressions
  const coverageNote =
    typeof vc === 'number' && typeof vi === 'number' && input.totals.clicks > 0
      ? `\nPER-QUERY VISIBILITY: the ${input.totals.queries} queries listed below account for only ${vc} clicks / ${vi} impressions — ${Math.round((vc / input.totals.clicks) * 100)}% of site clicks. Google withholds rare/anonymized queries, so the rest of the traffic is REAL but has no query row you can see. Never describe site-wide health from the query list alone; use the true totals above for that, and the query rows only for per-page/per-query decisions.${input.totals.totals_source === 'summed_rows_FALLBACK' ? ' WARNING: the true-totals call FAILED this run, so the numbers above are the undercounted sum — treat them as a floor.' : ''}`
      : ''

  const fmtQ = (q: QueryAgg) => `${q.query} | ${q.clicks} clicks | ${q.impressions} impr | pos ${q.position} | ${q.topPage.replace('https://www.seoulsister.com', '').replace('https://seoulsister.com', '') || '/'}`

  return `Today is ${input.today}. GSC window: ${input.windowStart} to ${input.windowEnd} (28 days, data lags ~3 days).

TOTALS (whole site, true): ${input.totals.clicks} clicks, ${input.totals.impressions} impressions.${coverageNote}

VS PRIOR RUN:
${input.priorComparison}

PRIOR BETS (do not duplicate; graded outcomes included when available):
${input.priorBets}

COMPUTED STRIKING-DISTANCE LIST (position 4-20, sorted by impressions — a convenience, not a boundary):
${input.strikingDistance.slice(0, 60).map(fmtQ).join('\n')}

TOP QUERIES (query | clicks | impressions | avg position | top page):
${shownQueries.map(fmtQ).join('\n')}${remainderNote}

TOP PAGES (path | clicks | impressions | avg position):
${input.pageAggs.slice(0, PAGE_LIMIT).map((p) => `${p.page} | ${p.clicks} | ${p.impressions} | ${p.position}`).join('\n')}

Write this week's report and bets.`
}

/**
 * Week-over-week totals line for the strategist.
 *
 * MUST refuse to subtract across a units change. `totals.clicks` was the SUMMED
 * DIMENSIONED ROWS until 2026-08-24 (commit a378075) and the TRUE undimensioned
 * site total after it. Both are stored in the same `computed_facts.totals.clicks`
 * column, and the dimensioned sum is only ~13% of real clicks — so the first run
 * after the switch subtracted 73 (old units) from 674 (new units) and reported a
 * "genuine step-change, ~9x" that was entirely an instrument change. The Aug 30
 * report led with it, then used the phantom shock to argue that every bet graded
 * in that window was confounded — noise injected into the exact channel built to
 * keep noise out.
 *
 * `totals_source` is absent on every row written before the switch, so a missing
 * value means OLD units, never "assume it matches".
 *
 * The comparable pair across the boundary is visible_clicks (dimensioned both
 * sides), so when the sources differ we report THAT delta and say what we did,
 * rather than either inventing a delta or going silent.
 */
export function buildPriorComparison(
  totals: { clicks: number; impressions: number; visible_clicks?: number; visible_impressions?: number; totals_source?: string },
  lastRun: { window_start?: string; window_end?: string; computed_facts?: unknown } | null
): string {
  if (!lastRun) return 'No prior run — this is the baseline week.'
  const pt = (lastRun.computed_facts as {
    totals?: { clicks: number; impressions: number; queries: number; visible_clicks?: number; totals_source?: string }
  } | null)?.totals
  if (!pt) return 'No prior run — this is the baseline week.'

  const window = `Prior window ${lastRun.window_start}→${lastRun.window_end}`
  const nowSrc = totals.totals_source ?? 'summed_rows_FALLBACK'
  const priorSrc = pt.totals_source ?? 'summed_rows_FALLBACK'
  const sign = (n: number) => (n >= 0 ? '+' : '')

  if (nowSrc === priorSrc) {
    return `${window}: ${pt.clicks} clicks, ${pt.impressions} impressions, ${pt.queries} queries. Delta this window: ${sign(totals.clicks - pt.clicks)}${totals.clicks - pt.clicks} clicks, ${sign(totals.impressions - pt.impressions)}${totals.impressions - pt.impressions} impressions.`
  }

  // Units changed. Fall back to the one series measured the same way on both
  // sides; if that is unavailable, report NO delta rather than a false one.
  const nowVis = totals.visible_clicks
  const priorVis = pt.visible_clicks ?? pt.clicks
  const comparable =
    typeof nowVis === 'number'
      ? ` Comparable like-for-like (visible query rows, measured the same way both weeks): ${priorVis} → ${nowVis} clicks (${sign(nowVis - priorVis)}${nowVis - priorVis}).`
      : ' No like-for-like series is available across the change, so NO delta can be stated.'

  return `${window}: ${pt.clicks} clicks, ${pt.impressions} impressions, ${pt.queries} queries. MEASUREMENT CHANGED between these two runs (prior=${priorSrc}, this week=${nowSrc}), so the headline totals are NOT comparable and their difference is an artifact of the instrument, not traffic. Do NOT report a week-over-week change or a "surge"/"step-change" from those two numbers, and do NOT treat the difference as a sitewide shock when reasoning about bet confounding.${comparable}`
}

function parseBets(text: string): { reportMd: string; bets: SeoBet[]; parseError?: string } {
  // Take the LAST json fence — report prose may legitimately contain a json
  // example; the bets block is instructed to come last.
  const fences = [...text.matchAll(/```json\s*([\s\S]*?)```/g)]
  const fence = fences[fences.length - 1]
  if (!fence) return { reportMd: text.trim(), bets: [], parseError: 'no json fence found' }
  const reportMd = text.slice(0, fence.index).trim()
  try {
    const parsed = JSON.parse(fence[1]) as unknown
    if (!Array.isArray(parsed)) return { reportMd, bets: [], parseError: 'bets JSON is not an array' }
    // Envelope validation only — the reasoning inside is free text by design.
    // `id` is load-bearing (grades key on it — the whole learning loop), so a
    // missing/duplicate id is synthesized rather than dropping the bet.
    const bets = parsed
      .filter(
        (b): b is SeoBet =>
          typeof b === 'object' && b !== null &&
          typeof (b as SeoBet).action === 'string' &&
          typeof (b as SeoBet).reasoning === 'string' &&
          typeof (b as SeoBet).expected_outcome === 'string'
      )
      .map((b, i) => ({
        ...b,
        id: typeof b.id === 'string' && b.id.length > 0 ? b.id : `bet-${i + 1}`,
        confidence: b.confidence ?? 'medium',
        review_after: typeof b.review_after === 'string' ? b.review_after : '',
      }))
    return { reportMd, bets }
  } catch (err) {
    return { reportMd, bets: [], parseError: err instanceof Error ? err.message : 'JSON parse failed' }
  }
}

export async function runSeoGuardian(db: SupabaseClient): Promise<SeoGuardianResult> {
  const config = getGscConfig()

  if (!config) {
    console.warn(
      '[seo-guardian] GSC_CLIENT_EMAIL / GSC_PRIVATE_KEY not set — would have pulled 28d Search Console data and generated the weekly strategy report. See SEO-GUARDIAN-SETUP.md.'
    )
    const { error: ncError } = await db.from('ss_seo_reports').insert({
      window_start: new Date().toISOString().slice(0, 10),
      window_end: new Date().toISOString().slice(0, 10),
      status: 'not_configured',
      error: 'GSC service-account credentials not configured',
    })
    if (ncError) console.error('[seo-guardian] not_configured record insert failed:', ncError.message)
    return { status: 'not_configured' }
  }

  // GSC data lags ~3 days; 28-day window ending today-3d
  const end = new Date(Date.now() - 3 * 86400_000)
  const start = new Date(end.getTime() - 27 * 86400_000)
  const windowEnd = end.toISOString().slice(0, 10)
  const windowStart = start.toISOString().slice(0, 10)

  const rows = await fetchSearchAnalytics(config, windowStart, windowEnd)

  // Zero rows from an authorized property is the repo's named
  // "scraper-zero-result" bug class — make it loud, skip the Opus spend, and
  // leave a visible record instead of emailing a zeros report.
  if (rows.length === 0) {
    console.warn(`[seo-guardian] GSC returned 0 rows for ${windowStart}→${windowEnd} — wrong property, no Google presence, or API issue`)
    const { error: zrError } = await db.from('ss_seo_reports').insert({
      window_start: windowStart,
      window_end: windowEnd,
      status: 'completed',
      error: 'gsc_returned_zero_rows',
    })
    if (zrError) console.error('[seo-guardian] zero-rows record insert failed:', zrError.message)
    return { status: 'completed', bets: [] }
  }

  const queryAggs = aggregateByQuery(rows)
  const pageAggs = aggregateByPage(rows)
  const strikingDistance = queryAggs.filter((q) => q.position >= 4 && q.position <= 20)
  // Summed dimensioned rows — what the strategist can actually SEE per query.
  const visible = {
    clicks: Math.round(rows.reduce((s, r) => s + r.clicks, 0)),
    impressions: Math.round(rows.reduce((s, r) => s + r.impressions, 0)),
  }
  // TRUE site totals. Google withholds rare/anonymized query rows, so `visible`
  // is a floor, not the total — measured Aug 25 2026 at 12.9% of real clicks
  // over 28 days. `null` means the totals call failed; the report then says so
  // rather than presenting the undercount as fact.
  const siteTotals = await fetchSiteTotals(config, windowStart, windowEnd)
  const totals = {
    clicks: siteTotals?.clicks ?? visible.clicks,
    impressions: siteTotals?.impressions ?? visible.impressions,
    queries: queryAggs.length,
    visible_clicks: visible.clicks,
    visible_impressions: visible.impressions,
    totals_source: siteTotals ? ('gsc_undimensioned' as const) : ('summed_rows_FALLBACK' as const),
  }

  // Prior run: totals delta + outstanding bets (so the strategist sees its own
  // track record — the learning-loop feedback channel; grades appear once the
  // Phase 3 grader exists)
  const { data: prior } = await db
    .from('ss_seo_reports')
    .select('window_start, window_end, computed_facts, bets, grades, created_at')
    .eq('status', 'completed')
    .order('created_at', { ascending: false })
    // 12, not 3. A bet needs ~28 days before a non-overlapping window exists to
    // grade it against, but reports are WEEKLY — so at limit 3 every grade
    // aged out of the prompt before it was ever written, and the strategist saw
    // `ungraded` forever. The grades existed in the database and reached no
    // consumer: the loop's third question failing inside the fix for the same
    // failure. 12 weeks covers the grading latency with room to spare.
    .limit(12)

  const priorComparison = buildPriorComparison(totals, prior?.[0] ?? null)

  const priorBetLines: string[] = []
  for (const run of prior ?? []) {
    const bets = (run.bets as SeoBet[]) ?? []
    const grades =
      (run.grades as Record<
        string,
        {
          verdict: string
          notes?: string
          execution_status?: string
          powered?: boolean
          confounded_sitewide?: boolean
        }
      > | null) ?? null
    for (const b of bets) {
      const grade = grades?.[b.id]
      // A graded bet must carry its EXECUTION status and power alongside the
      // verdict. Without them "miss" is ambiguous between "the theory was
      // wrong" and "the work never shipped" — opposite remediations — and an
      // abstention would read as a failure. This is the whole feedback channel;
      // an unqualified verdict here is how the loop teaches from noise.
      let line = `- [${run.created_at?.slice(0, 10)}] ${b.action} (${b.confidence}) → expected: ${b.expected_outcome}`
      if (grade) {
        const bits = [`GRADED: ${grade.verdict}`]
        if (grade.execution_status) bits.push(`execution=${grade.execution_status}`)
        if (grade.powered === false) bits.push('NOT statistically powered — carries no evidence either way')
        if (grade.confounded_sitewide) bits.push('sitewide shock in window — confounded')
        line += ` | ${bits.join(' | ')}${grade.notes ? ` — ${grade.notes}` : ''}`
      } else {
        line += ' | ungraded'
      }
      priorBetLines.push(line)
    }
  }
  const priorBets = priorBetLines.length > 0 ? priorBetLines.join('\n') : 'None yet.'

  const userPrompt = buildUserPrompt({
    windowStart,
    windowEnd,
    queryAggs,
    pageAggs,
    strikingDistance,
    totals,
    priorComparison,
    priorBets,
    today: new Date().toISOString().slice(0, 10),
  })

  const client = getAnthropicClient()
  const ctx = getAIContext('SEO_GUARDIAN')
  const response = await callAnthropicWithRetry(
    () =>
      client.messages.create({
        model: ctx.model,
        max_tokens: ctx.maxTokens,
        system: STRATEGIST_SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      }),
    1
  )

  const block = response.content[0]
  if (!block || block.type !== 'text') {
    throw new Error('SEO strategist returned no text block')
  }

  const inputTokens = response.usage?.input_tokens ?? 0
  const outputTokens = response.usage?.output_tokens ?? 0
  void logAIUsage({ feature: 'seo_guardian', model: ctx.model, inputTokens, outputTokens })
  const costUsd = estimateCost(ctx.model, inputTokens, outputTokens)

  const { reportMd, bets, parseError } = parseBets(block.text)
  if (parseError) console.warn(`[seo-guardian] bets parse issue: ${parseError}`)

  const { data: inserted, error: insertError } = await db
    .from('ss_seo_reports')
    .insert({
      window_start: windowStart,
      window_end: windowEnd,
      // Full raw snapshot — required so Phase 3 can grade bets and any bet can
      // be audited against exactly what the strategist saw
      gsc_snapshot: { rows },
      computed_facts: { totals, strikingDistanceCount: strikingDistance.length, queryCount: queryAggs.length, pageCount: pageAggs.length },
      report_md: reportMd,
      bets,
      model_used: ctx.model,
      status: 'completed',
      error: parseError ?? null,
    })
    .select('id')
    .single()

  if (insertError) {
    console.error('[seo-guardian] report insert failed:', insertError.message)
  }

  return { status: 'completed', reportId: inserted?.id, reportMd, bets, costUsd }
}
