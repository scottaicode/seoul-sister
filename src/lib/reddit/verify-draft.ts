/**
 * Reddit draft fact-checker — the verification step the process never had.
 * ========================================================================
 *
 * WHY THIS EXISTS
 *
 * The Reddit process is human-in-the-loop at every decision: LGAAS surfaces
 * threads, Scott picks which to answer, drafts are AI-assisted, Scott verifies
 * and posts. Step 4 — verification — was the only step with no tooling. It
 * happened ad hoc in a chat window, which does not scale and is not repeatable.
 *
 * It is also the step that protects the moat. A Reddit comment is a public,
 * permanent, attributable claim made to someone who asked for help, in front of
 * a community that reads INCI lists for fun. One confidently wrong formulation
 * claim, publicly corrected by a knowledgeable stranger, costs more trust than
 * ten good comments earn. This already happened once on blog content: an
 * LGAAS-generated post fabricated a hyaluronic-acid claim about Sulwhasoo First
 * Care that the database contradicts. Review caught it; publish-blind would not.
 *
 * WHAT IT IS
 *
 * Pure, deterministic, $0. No AI call, no network beyond the DB reads, no
 * writes. Takes draft text, returns findings. The human decides.
 *
 * WHAT IT IS NOT
 *
 *  - It does NOT rewrite the draft. A checker that edits becomes a second
 *    author and the voice — which is the entire reason those comments earn
 *    600+ views — dies. It reports; Scott decides.
 *  - It does NOT pass silently. `findings: []` is meaningless on its own, so
 *    every result carries a `checked` census. "Nothing was wrong" and "nothing
 *    was checked" must never be the same output. That distinction has cost this
 *    repo eight defects in one day and six days of a dead cron.
 *  - It does NOT gate on ingredient conflicts (5 rows) or counterfeit markers
 *    (11 rows). Those tables are too thin to verify against; claims touching
 *    them are reported as unverifiable, never as passing.
 *
 * AI-First: this is deterministic plumbing — a fact lookup against the catalog.
 * There is no judgment here to delegate to a model, and the judgment that does
 * exist (what to do about a finding) stays with the human.
 */

import type { SupabaseClient } from '@supabase/supabase-js'
import { getServiceClient } from '@/lib/supabase'
import { resolveProductByNameStrict } from '@/lib/yuri/tools'
import { excludePollutedIngredientRows } from '@/lib/pipeline/ingredient-parser'

export type Severity = 'blocker' | 'warn' | 'info'

export type Rule =
  | 'ingredient_contradicted'
  | 'ingredient_unverifiable'
  | 'product_unresolved'
  | 'price_stale'
  | 'price_unverifiable'
  | 'retailer_steering'
  | 'retailer_counterfeit_smear'
  | 'marketplace_accusation'
  | 'unsourced_claim'
  | 'us_sunscreen_reformulation'
  | 'medical_referral_missing'
  | 'ai_tell'

export interface Finding {
  severity: Severity
  rule: Rule
  /** The exact span of the draft this is about, so the human can find it. */
  quote: string
  /** What the database or the standing policy actually says. */
  detail: string
  suggestion?: string
}

export interface VerifyResult {
  findings: Finding[]
  /**
   * The census. Proves the check RAN. A clean result with all-zero counts means
   * nothing was checkable — not that the draft is verified.
   */
  checked: {
    products_named: number
    products_resolved: number
    ingredient_claims: number
    price_claims: number
    policy_scans: number
  }
  /** True only when something was actually verified against the catalog. */
  verified_anything: boolean
}

/** Price staleness threshold. Matches the tool-layer honesty rule. */
export const PRICE_STALE_DAYS = 14

/**
 * Retailers we do not steer people toward, and the ONLY correct reason.
 *
 * They sell AUTHENTIC product. The concern is slow shipping (often weeks) and
 * weak refund recourse — never counterfeit risk. Saying otherwise is itself a
 * blocker, because it is both false and a legal/affiliate exposure. Verbatim
 * rule at src/lib/yuri/advisor.ts:111-113 and specialists.ts:108.
 */
const DISCOURAGED_RETAILERS = ['yesstyle', 'stylevana', 'stylekorean']
const RECOMMENDED_RETAILERS = ['olive young', 'soko glam', 'iherb']

/** Marketplaces that must never be accused of selling counterfeits. */
const MARKETPLACES = ['amazon', 'ebay', 'temu', 'wish']

/**
 * Korean sunscreens sold in US stores are REFORMULATED with FDA-approved
 * filters and test substantially weaker (Consumer Reports, verified Jul 10
 * 2026): Beauty of Joseon SPF 36 vs 19, Innisfree 48 vs 16, Round Lab 46 vs 16.
 * "Just buy it at Target" does not deliver the Korean-formula advantage.
 */
const US_SUNSCREEN_HINTS = [
  'target', 'ulta', 'cvs', 'walgreens', 'amazon',
]

/**
 * Claims with no primary source that keep resurfacing. The KTRI one traces only
 * to Alibaba-hosted SEO content.
 */
const UNSOURCED_PATTERNS: Array<{ re: RegExp; detail: string }> = [
  {
    re: /\bktri\b|68\s*%[^.]{0,40}(spf|sunscreen)|(\bspf\b[^.]{0,40}\b68\s*%)/i,
    detail:
      'The "KTRI 2022 / 68% of COSRX sunscreen failed SPF" statistic has no primary source — it traces only to Alibaba-hosted SEO content.',
  },
  {
    re: /commingl/i,
    detail:
      'Amazon ENDED commingled inventory in March 2026. Any argument resting on commingling is stale as of 2026.',
  },
]

/** Words that signal a medical situation needing a referral, not a product. */
const MEDICAL_FLAGS = [
  'mole', 'lesion', 'melanoma', 'bleeding', 'crusting',
  'spreading rash', 'infection', 'infected', 'pus',
  'eyelid swelling', 'swollen eye', 'eye swelling',
]

/** Phrases that satisfy the referral floor. */
const REFERRAL_PATTERNS =
  /\b(derm|dermatologist|doctor|physician|gp\b|urgent care|medical (advice|attention|professional)|get.{0,12}(it|that|this).{0,12}(looked at|checked)|see (a|your) (doctor|derm))/i

/**
 * Pull candidate product names out of prose.
 *
 * Real drafts name products inline — "Klairs Supple Preparation Unscented
 * Toner is great for this" — so this looks for runs of Capitalized tokens,
 * which is how brands and product names actually appear. Deliberately generous:
 * every candidate is then resolved against the catalog, and an unresolved one
 * is reported as "verify by hand", never as an error. Over-extraction costs a
 * lookup; under-extraction misses a false claim.
 */
export function extractProductCandidates(text: string): string[] {
  const stripped = text.replace(/`[^`]*`/g, ' ').replace(/https?:\/\/\S+/g, ' ')
  const out = new Set<string>()
  // 2-7 capitalized-ish tokens in a row (allows digits, %, &, hyphens).
  const re = /\b([A-Z][\w&%.-]*(?:\s+(?:[A-Z][\w&%.-]*|\d+[\w%.-]*)){1,6})/g
  let m: RegExpExecArray | null
  while ((m = re.exec(stripped)) !== null) {
    const candidate = m[1].trim().replace(/[.,;:!?]+$/, '')
    // A sentence-initial capital followed by ordinary words is prose, not a
    // product. Require at least two tokens that are NOT common English openers.
    const tokens = candidate.split(/\s+/)
    if (tokens.length < 2) continue
    if (SENTENCE_OPENERS.has(tokens[0].toLowerCase())) {
      tokens.shift()
      if (tokens.length < 2) continue
    }
    const rebuilt = tokens.join(' ')
    if (rebuilt.length < 6) continue
    out.add(rebuilt)
  }
  return [...out]
}

/**
 * Words that begin sentences and would otherwise anchor a false candidate
 * ("The Ordinary" is real, but "The thing I'd flag" is not a product).
 */
const SENTENCE_OPENERS = new Set([
  'the', 'this', 'that', 'these', 'those', 'if', 'when', 'what', 'your', 'my',
  'i', 'it', 'a', 'an', 'and', 'but', 'so', 'also', 'one', 'for', 'before',
  'after', 'given', 'seconding', 'agreeing', 'worth', 'just', 'ah', 'okay',
  'honestly', 'personally', 'first', 'second', 'third', 'both', 'either',
])

/**
 * Detect "X contains Y" / "X has no Y" style assertions.
 *
 * Returns the ingredient term and the surrounding sentence, so the caller can
 * pair it with whichever product was named in that sentence. Kept conservative:
 * only explicit containment verbs, because a looser net would flag every
 * mention of an ingredient as a claim about a product.
 */
export function extractIngredientClaims(
  text: string
): Array<{ sentence: string; ingredient: string; negated: boolean }> {
  const claims: Array<{ sentence: string; ingredient: string; negated: boolean }> = []
  const sentences = text.split(/(?<=[.!?])\s+|\n+/)
  const re =
    /\b(?:contains?|has|have|includes?|is formulated with|packed with|free of|without|no)\s+(?:any\s+)?([a-z][a-z0-9 ,'()-]{2,60}?)(?=[.,;!?]|\s+(?:and|but|which|so|because|that|to|in|for|at|on)\b|$)/gi
  for (const sentence of sentences) {
    let m: RegExpExecArray | null
    re.lastIndex = 0
    while ((m = re.exec(sentence)) !== null) {
      const verb = m[0].toLowerCase()
      const negated = /\b(free of|without|no)\b/.test(verb)
      const ingredient = m[1].trim().replace(/\s+/g, ' ')
      if (ingredient.length < 3) continue
      claims.push({ sentence: sentence.trim(), ingredient, negated })
    }
  }
  return claims
}

/** Detect explicit dollar amounts and the sentence they sit in. */
export function extractPriceClaims(
  text: string
): Array<{ sentence: string; amount: string }> {
  const out: Array<{ sentence: string; amount: string }> = []
  for (const sentence of text.split(/(?<=[.!?])\s+|\n+/)) {
    const m = sentence.match(/\$\s?\d+(?:\.\d{2})?/g)
    if (m) for (const amount of m) out.push({ sentence: sentence.trim(), amount })
  }
  return out
}

/** Trim a span for display in a finding. */
const clip = (s: string, n = 160) =>
  s.length <= n ? s : `${s.slice(0, n - 1).trimEnd()}…`

/**
 * Run the policy scans. Pure string work — no DB — so it is exhaustively
 * testable and cannot fail open on a query error.
 */
export function checkPolicy(text: string): Finding[] {
  const findings: Finding[] = []
  const lower = text.toLowerCase()
  const sentences = text.split(/(?<=[.!?])\s+|\n+/)

  for (const sentence of sentences) {
    const s = sentence.toLowerCase()

    // Counterfeit smear against a discouraged-but-authentic retailer.
    const namesDiscouraged = DISCOURAGED_RETAILERS.find((r) => s.includes(r))
    if (
      namesDiscouraged &&
      /\b(fake|counterfeit|dupe[sd]?\b.*fake|not authentic|inauthentic|knock ?off)\b/.test(s)
    ) {
      findings.push({
        severity: 'blocker',
        rule: 'retailer_counterfeit_smear',
        quote: clip(sentence),
        detail:
          `${namesDiscouraged} sells AUTHENTIC product. The standing rule discourages it for slow shipping and weak refund recourse — never for counterfeit risk. Implying fakes is false and an affiliate/legal exposure.`,
        suggestion:
          'Say it is authentic but you steer people elsewhere because shipping is slow and refunds are store-credit.',
      })
    } else if (
      namesDiscouraged &&
      /\b(get it (from|at)|buy (it )?(from|at)|order (it )?(from|at)|i'?d (get|buy|order)|recommend)\b/.test(s)
    ) {
      findings.push({
        severity: 'warn',
        rule: 'retailer_steering',
        quote: clip(sentence),
        detail:
          `Steering to ${namesDiscouraged}. Standing rule: recommend ${RECOMMENDED_RETAILERS.join(', ')} instead (shipping/refund quality, not authenticity).`,
      })
    }

    // Marketplace counterfeit accusation.
    const marketplace = MARKETPLACES.find((r) => s.includes(r))
    if (
      marketplace &&
      /\b(fake|counterfeit|knock ?off|not authentic|inauthentic)\b/.test(s)
    ) {
      findings.push({
        severity: 'warn',
        rule: 'marketplace_accusation',
        quote: clip(sentence),
        detail:
          `Naming ${marketplace} as a counterfeit channel. Counterfeit evidence in this domain is FAILED PROTECTION (a tested SPF 3.6 vs a claimed 45), never documented injury — and Amazon ended commingled inventory in March 2026.`,
        suggestion:
          'Talk about seller-level risk and what to check on the package, not the platform.',
      })
    }

    // US-reformulated Korean sunscreen.
    if (
      /\bsunscreen|\bspf\b|sun stick|suncream/.test(s) &&
      US_SUNSCREEN_HINTS.some((h) => s.includes(h))
    ) {
      findings.push({
        severity: 'info',
        rule: 'us_sunscreen_reformulation',
        quote: clip(sentence),
        detail:
          'Korean-brand sunscreens sold in US stores are REFORMULATED with FDA-approved filters and test substantially weaker (Consumer Reports, Jul 2026): Beauty of Joseon 36 vs 19, Innisfree 48 vs 16, Round Lab 46 vs 16. The documented advantage is protection, not texture.',
      })
    }
  }

  // Unsourced / stale claims, scanned across the whole draft.
  for (const { re, detail } of UNSOURCED_PATTERNS) {
    const m = text.match(re)
    if (m) {
      findings.push({
        severity: 'warn',
        rule: 'unsourced_claim',
        quote: clip(m[0]),
        detail,
      })
    }
  }

  // Medical referral floor.
  const flagged = MEDICAL_FLAGS.filter((f) => lower.includes(f))
  if (flagged.length > 0 && !REFERRAL_PATTERNS.test(text)) {
    findings.push({
      severity: 'blocker',
      rule: 'medical_referral_missing',
      quote: clip(flagged.join(', ')),
      detail:
        'The draft touches a medical presentation (lesion / infection / eye-area swelling) with no referral to a clinician. A changing, growing, bleeding, crusting or spreading finding is dermatologist territory — say so early, and never answer it with a product.',
      suggestion: 'Add an explicit "worth getting looked at by a derm" sentence.',
    })
  }

  // AI tell. Em-dashes are a standing owner rule for drafted copy.
  const emDash = text.match(/[^\s]*—[^\s]*/)
  if (emDash) {
    findings.push({
      severity: 'info',
      rule: 'ai_tell',
      quote: clip(emDash[0]),
      detail: 'Em-dash present. Standing rule: no em-dashes in drafted copy.',
      suggestion: 'Use a comma, a full stop, or parentheses.',
    })
  }

  return findings
}

/**
 * Verify a draft against the catalog and the standing rules.
 *
 * Every DB call checks `error` explicitly. A failed query must NOT read as a
 * clean check — that is the single most expensive bug class in this codebase,
 * and on a verification path it would be self-defeating.
 */
export async function verifyDraft(
  draft: string,
  dbOverride?: SupabaseClient
): Promise<VerifyResult> {
  const db = dbOverride ?? getServiceClient()
  const findings: Finding[] = []

  // Policy scans are pure and always run.
  const policyFindings = checkPolicy(draft)
  findings.push(...policyFindings)

  const candidates = extractProductCandidates(draft)
  const resolved = new Map<string, { id: string; name_en: string; brand_en: string }>()

  for (const candidate of candidates) {
    try {
      const match = await resolveProductByNameStrict(db, candidate)
      if (match) resolved.set(candidate, match)
    } catch {
      // A resolver failure must not silently look like "not in catalog".
      findings.push({
        severity: 'warn',
        rule: 'product_unresolved',
        quote: clip(candidate),
        detail: 'Product lookup FAILED (query error) — this name was not checked at all.',
      })
    }
  }

  // Unresolved names are a flag, never an error: ~40% of products people
  // legitimately discuss are outside a Korean catalog (the Western Shelf rule),
  // and the draft may be correctly recommending CeraVe.
  for (const candidate of candidates) {
    if (!resolved.has(candidate) && looksLikeProductName(candidate)) {
      findings.push({
        severity: 'info',
        rule: 'product_unresolved',
        quote: clip(candidate),
        detail:
          'Not found in the catalog. Fine if it is a non-Korean product or a name variant — but any factual claim about it is unverified here.',
      })
    }
  }

  // Ingredient claims: pair each with a product named in the same sentence.
  const ingredientClaims = extractIngredientClaims(draft)
  let checkedIngredientClaims = 0

  for (const claim of ingredientClaims) {
    // Pair the claim with a product named in the same sentence, else with the
    // most recently named product BEFORE it.
    //
    // Real prose splits these constantly — "Klairs Supple Preparation Unscented
    // Toner is great for this. It contains niacinamide." A same-sentence-only
    // rule silently skipped that claim and reported `0 verified`, which is
    // honest but useless: the check the human most needs is the one that did
    // not run. Scoped to the antecedent so a claim can never be attributed to a
    // product named later in the draft.
    const product =
      [...resolved.entries()].find(([name]) => claim.sentence.includes(name)) ??
      nearestPrecedingProduct(draft, claim.sentence, resolved)
    if (!product) continue

    const [, match] = product
    const { data, error } = await db
      .from('ss_product_ingredients')
      .select('ss_ingredients!inner(name_inci)')
      .eq('product_id', match.id)

    if (error) {
      findings.push({
        severity: 'warn',
        rule: 'ingredient_unverifiable',
        quote: clip(claim.sentence),
        detail: `Ingredient lookup FAILED for ${match.name_en} (${error.message}). NOT verified.`,
      })
      continue
    }

    const names = (data ?? [])
      .map((r) => {
        const ing = (r as Record<string, unknown>).ss_ingredients
        const one = Array.isArray(ing) ? ing[0] : ing
        return ((one as { name_inci?: string })?.name_inci ?? '').toLowerCase()
      })
      .filter(Boolean)

    if (names.length === 0) {
      findings.push({
        severity: 'warn',
        rule: 'ingredient_unverifiable',
        quote: clip(claim.sentence),
        detail: `${match.brand_en} ${match.name_en} has NO ingredient rows in the catalog, so this claim could not be checked. Absence of a match is not evidence.`,
      })
      continue
    }

    checkedIngredientClaims++
    const needle = claim.ingredient.toLowerCase()
    const present = names.some((n) => n.includes(needle) || needle.includes(n))

    if (claim.negated && present) {
      findings.push({
        severity: 'blocker',
        rule: 'ingredient_contradicted',
        quote: clip(claim.sentence),
        detail: `The catalog DOES list "${claim.ingredient}" in ${match.brand_en} ${match.name_en}. The draft says it does not.`,
      })
    } else if (!claim.negated && !present) {
      findings.push({
        severity: 'blocker',
        rule: 'ingredient_contradicted',
        quote: clip(claim.sentence),
        detail: `The catalog does NOT list "${claim.ingredient}" among the ${names.length} ingredients on record for ${match.brand_en} ${match.name_en}. This is the fabricated-claim class.`,
        suggestion: 'Drop the claim, or confirm it against the physical label.',
      })
    }
  }

  // Price claims.
  const priceClaims = extractPriceClaims(draft)
  for (const claim of priceClaims) {
    // Same antecedent rule as ingredient claims — "It runs about $22 there"
    // refers to the product named a sentence earlier.
    const product =
      [...resolved.entries()].find(([name]) => claim.sentence.includes(name)) ??
      nearestPrecedingProduct(draft, claim.sentence, resolved)
    if (!product) {
      findings.push({
        severity: 'info',
        rule: 'price_unverifiable',
        quote: clip(claim.sentence),
        detail: `Price ${claim.amount} is not tied to a product this checker could resolve, so it was not verified.`,
      })
      continue
    }
    const [, match] = product
    const { data, error } = await db
      .from('ss_product_prices')
      .select('price_usd, last_checked')
      .eq('product_id', match.id)
      .order('last_checked', { ascending: false })
      .limit(1)

    if (error) {
      findings.push({
        severity: 'warn',
        rule: 'price_unverifiable',
        quote: clip(claim.sentence),
        detail: `Price lookup FAILED for ${match.name_en} (${error.message}). NOT verified.`,
      })
      continue
    }
    const row = data?.[0] as { price_usd?: number; last_checked?: string } | undefined
    if (!row?.last_checked) {
      findings.push({
        severity: 'warn',
        rule: 'price_unverifiable',
        quote: clip(claim.sentence),
        detail: `No price on record for ${match.brand_en} ${match.name_en}.`,
      })
      continue
    }
    const ageDays = Math.floor(
      (Date.now() - new Date(row.last_checked).getTime()) / 86_400_000
    )
    if (ageDays > PRICE_STALE_DAYS) {
      findings.push({
        severity: 'warn',
        rule: 'price_stale',
        quote: clip(claim.sentence),
        detail: `Catalog price for ${match.brand_en} ${match.name_en} was last verified ${ageDays} days ago (${row.last_checked.slice(0, 10)}). Quoting it as current is a staleness risk.`,
        suggestion: 'Drop the number, or say "around $X, last time I checked".',
      })
    }
  }

  const checked = {
    products_named: candidates.length,
    products_resolved: resolved.size,
    ingredient_claims: checkedIngredientClaims,
    price_claims: priceClaims.length,
    policy_scans: 1,
  }

  return {
    findings,
    checked,
    // Policy scans always run, but they check the DRAFT, not the catalog.
    // "Verified something" means a real fact was compared against real data.
    verified_anything: checked.products_resolved > 0 || checked.ingredient_claims > 0,
  }
}

/**
 * The last resolved product named BEFORE this sentence starts.
 *
 * Handles the "It contains X" pattern, where the subject is a pronoun pointing
 * back at a product from an earlier sentence. Only looks backwards: attributing
 * a claim to a product mentioned LATER would invent a link the writer never
 * made. Returns undefined when no product precedes the claim, in which case the
 * claim is simply not checked (and the census says so) rather than guessed at.
 */
function nearestPrecedingProduct(
  draft: string,
  sentence: string,
  resolved: Map<string, { id: string; name_en: string; brand_en: string }>
): [string, { id: string; name_en: string; brand_en: string }] | undefined {
  const at = draft.indexOf(sentence)
  if (at === -1) return undefined
  const before = draft.slice(0, at)
  let best: [string, { id: string; name_en: string; brand_en: string }] | undefined
  let bestIdx = -1
  for (const entry of resolved.entries()) {
    const idx = before.lastIndexOf(entry[0])
    if (idx > bestIdx) {
      bestIdx = idx
      best = entry
    }
  }
  return bestIdx === -1 ? undefined : best
}

/**
 * A capitalized run is only worth reporting as an unresolved PRODUCT if it
 * plausibly names one. Without this, every "Korean Skincare" or "Vitamin C"
 * phrase becomes noise, and a checker people ignore protects nothing.
 */
function looksLikeProductName(candidate: string): boolean {
  const tokens = candidate.split(/\s+/)
  if (tokens.length < 2) return false
  const generic = new Set([
    'korean', 'skincare', 'skin', 'care', 'vitamin', 'acid', 'oil', 'water',
    'routine', 'barrier', 'glass', 'beauty', 'products', 'product', 'sunscreen',
  ])
  const meaningful = tokens.filter((t) => !generic.has(t.toLowerCase()))
  return meaningful.length >= 2
}

/** Convenience for the CLI and any future caller. */
export function formatFindings(result: VerifyResult): string {
  const order: Record<Severity, number> = { blocker: 0, warn: 1, info: 2 }
  const sorted = [...result.findings].sort(
    (a, b) => order[a.severity] - order[b.severity]
  )
  const lines: string[] = []
  const blockers = sorted.filter((f) => f.severity === 'blocker').length

  lines.push(
    `checked: ${result.checked.products_named} product name(s) found, ` +
      `${result.checked.products_resolved} resolved, ` +
      `${result.checked.ingredient_claims} ingredient claim(s) verified, ` +
      `${result.checked.price_claims} price claim(s) seen`
  )
  if (!result.verified_anything) {
    lines.push(
      'NOTE: nothing was verified against the catalog. A clean result here means ' +
        '"nothing checkable was found", NOT "the draft is verified".'
    )
  }
  lines.push('')

  if (sorted.length === 0) {
    lines.push('No findings.')
    return lines.join('\n')
  }

  for (const f of sorted) {
    lines.push(`[${f.severity.toUpperCase()}] ${f.rule}`)
    lines.push(`  quote:  ${f.quote}`)
    lines.push(`  detail: ${f.detail}`)
    if (f.suggestion) lines.push(`  try:    ${f.suggestion}`)
    lines.push('')
  }
  lines.push(
    blockers > 0
      ? `${blockers} blocker(s) — do not post as written.`
      : 'No blockers. Warnings are yours to judge.'
  )
  return lines.join('\n')
}
