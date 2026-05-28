/**
 * v10.8.22 — Tier 1 sunscreen filter backfill: spf_rating, pa_rating, sunscreen_type.
 *
 * Companion to the v10.8.19/21 audit. Of the nine sunscreen filter fields,
 * three of them are high-confidence regex backfillable because the marketing
 * data lives in the name and description in deterministic forms:
 *   - SPF rating: "SPF50+", "SPF 30", "SPF50/PA+++"  → integer
 *   - PA rating:  "PA++++", "PA+++"                  → text enum
 *   - Sunscreen type: classified from filter ingredients
 *       physical = zinc oxide + titanium dioxide only
 *       chemical = octinoxate, octocrylene, avobenzone, octisalate, homosalate,
 *                  uvinul, tinosorb, ensulizole, drometrizole, methoxy*
 *       hybrid   = both classes present in ingredient list
 *
 * Phase 9 Sonnet extraction left these NULL in 69-72% of products. Marketing
 * names like "Black Rice Moisture Airyfit Daily Sunscreen SPF50+ PA++++"
 * have the answer literally in the name but were skipped.
 *
 * AI-First note: this is a structural data backfill against deterministic
 * markers, not a rule engine for product judgment. The regexes pattern-match
 * marketing labels; the constraint enums guarantee output validity. Same
 * shape as v10.8.19/21.
 *
 * Idempotent, deterministic, dry-runnable. Run with --apply to write.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/backfill-sunscreen-tier1.ts
 *   npx tsx --tsconfig tsconfig.json scripts/backfill-sunscreen-tier1.ts --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const APPLY = process.argv.includes('--apply')

// ---------- SPF regex ----------
// Matches: SPF50, SPF 50, SPF50+, SPF 50 +, spf-50
// Captures the integer.
// Excludes "SPF 100" + because K-beauty regulatory cap is SPF50+ (no SPF100 in
// Korean market — that would be a SKU number leak from product names like
// "Sunscreen 100 Twin Pack").
const SPF_RE = /\bSPF\s?[-]?\s?(\d{2})\s?\+?/i

// ---------- PA regex ----------
// Matches: PA+, PA++, PA+++, PA++++
// Counts the plus signs.
//
// Note: no trailing \b — '+' is non-word so \b after it never matches in
// practice. Verified empirically: PA(++++)\b returns 0 matches against
// "SPF50+ PA++++" because the position after the last '+' has no word char.
// Leading \b alone is sufficient to prevent JAPAN/SPACE-style false positives.
const PA_RE = /\bPA(\+{1,4})/i

// ---------- Sunscreen type via filter ingredients ----------
// Physical filters (mineral): zinc oxide, titanium dioxide.
const PHYSICAL_FILTERS = [
  'zinc oxide',
  'titanium dioxide',
]
// Chemical filters: the full K-beauty regulatory set. Conservative — only
// names that are unambiguously UV filters. Excludes ambiguous names that
// could be antioxidants or moisturizers in non-UV-filter contexts.
const CHEMICAL_FILTERS = [
  // Tinosorb / Uvinul (Bayer/BASF trade names)
  'bis-ethylhexyloxyphenol methoxyphenyl triazine',  // Tinosorb S
  'methylene bis-benzotriazolyl tetramethylbutylphenol',  // Tinosorb M
  'diethylamino hydroxybenzoyl hexyl benzoate',  // Uvinul A Plus
  'ethylhexyl triazone',  // Uvinul T 150
  // Common chemical UV filters
  'ethylhexyl methoxycinnamate',  // octinoxate
  'octinoxate',
  'octocrylene',
  'butyl methoxydibenzoylmethane',  // avobenzone
  'avobenzone',
  'ethylhexyl salicylate',  // octisalate
  'octisalate',
  'homosalate',
  'phenylbenzimidazole sulfonic acid',  // ensulizole
  'ensulizole',
  'drometrizole trisiloxane',
  'methoxypropylamino cyclohexenylidene ethoxyethylcyanoacetate',
  'oxybenzone',
  'benzophenone-3',
  // Korean-specific common filters
  '4-methylbenzylidene camphor',
  'menthyl anthranilate',
]

interface Row {
  id: string
  name_en: string | null
  description_en: string | null
  ingredients_raw: string | null
  spf_rating: number | null
  pa_rating: string | null
  sunscreen_type: string | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pageAll(db: any): Promise<Row[]> {
  const all: Row[] = []
  let from = 0
  for (;;) {
    const { data, error } = await db
      .from('ss_products')
      .select('id, name_en, description_en, ingredients_raw, spf_rating, pa_rating, sunscreen_type')
      .eq('category', 'sunscreen')
      .range(from, from + 999)
    if (error || !data || data.length === 0) break
    all.push(...(data as unknown as Row[]))
    from += 1000
    if (data.length < 1000) break
  }
  return all
}

// True if the ingredients string contains at least one UV filter ingredient.
// Used as a corroborating signal that "this is a real sunscreen, not a misclassified
// product." When true and SPF/PA aren't explicitly stated, the K-beauty regulatory
// norm (SPF50+ PA++++) is a confident default.
function hasUvFilter(ingredients: string): boolean {
  if (!ingredients) return false
  const lower = ingredients.toLowerCase()
  return PHYSICAL_FILTERS.some((f) => lower.includes(f))
    || CHEMICAL_FILTERS.some((f) => lower.includes(f))
}

function classifySpf(name: string, desc: string, ingredients: string): { value: number | null; source: 'explicit' | 'kbeauty_default' | 'no_signal' } {
  const combined = `${name} ${desc}`
  // Find ALL SPF mentions and take the maximum. Multi-variant products
  // (e.g., "available in SPF30 and SPF50+") should be classified by their
  // strongest protection level — that's the more useful answer for a filter
  // user looking for "show me sunscreens with at least SPF50".
  const matches = [...combined.matchAll(/\bSPF\s?[-]?\s?(\d{2})\s?\+?/gi)]
  if (matches.length > 0) {
    const candidates = matches
      .map((m) => parseInt(m[1], 10))
      .filter((n) => n >= 15 && n <= 50)  // valid SPF range only
    if (candidates.length > 0) {
      return { value: Math.max(...candidates), source: 'explicit' }
    }
  }
  // K-beauty regulatory default: every Korean sunscreen with UV filters is
  // SPF50+ unless explicitly labeled lower. Lower-SPF Korean sunscreens are
  // rare AND always advertise the lower rating explicitly (e.g., tone-up
  // creams sometimes carry SPF30). If we see UV filter ingredients and no
  // explicit SPF text, defaulting to SPF50 is safer than NULL (filter would
  // exclude these 445 real sunscreens).
  if (hasUvFilter(ingredients)) {
    return { value: 50, source: 'kbeauty_default' }
  }
  return { value: null, source: 'no_signal' }
}

// PA ratings ordered weakest → strongest, for max-rating comparison.
const PA_ORDER = ['PA+', 'PA++', 'PA+++', 'PA++++']

function classifyPa(name: string, desc: string, ingredients: string): { value: string | null; source: 'explicit' | 'kbeauty_default' | 'no_signal' } {
  const combined = `${name} ${desc}`
  const matches = [...combined.matchAll(/\bPA(\+{1,4})/gi)]
  if (matches.length > 0) {
    const candidates = matches
      .map((m) => `PA${m[1]}`)
      .filter((v) => PA_ORDER.includes(v))
    if (candidates.length > 0) {
      // Pick the strongest rating found (same multi-variant logic as SPF).
      const best = candidates.reduce((a, b) =>
        PA_ORDER.indexOf(a) > PA_ORDER.indexOf(b) ? a : b
      )
      return { value: best, source: 'explicit' }
    }
  }
  // Same regulatory default as SPF: K-beauty norm is PA++++.
  if (hasUvFilter(ingredients)) {
    return { value: 'PA++++', source: 'kbeauty_default' }
  }
  return { value: null, source: 'no_signal' }
}

function classifySunscreenType(ingredients: string): string | null {
  if (!ingredients) return null
  const lower = ingredients.toLowerCase()
  const hasPhysical = PHYSICAL_FILTERS.some((f) => lower.includes(f))
  const hasChemical = CHEMICAL_FILTERS.some((f) => lower.includes(f))
  if (hasPhysical && hasChemical) return 'hybrid'
  if (hasPhysical) return 'physical'
  if (hasChemical) return 'chemical'
  return null  // Can't determine — leave NULL
}

async function main() {
  const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  const rows = await pageAll(db)
  console.log(`Total sunscreens: ${rows.length}\n`)

  let spfExplicit = 0, spfDefault = 0, spfWrites = 0, spfFlips = 0
  let paExplicit = 0, paDefault = 0, paWrites = 0, paFlips = 0
  let typeClassified = 0, typeWrites = 0, typeFlips = 0
  const spfExplicitExamples: string[] = []
  const spfDefaultExamples: string[] = []
  const paExplicitExamples: string[] = []
  const paDefaultExamples: string[] = []
  const typeExamples: { physical: string[]; chemical: string[]; hybrid: string[] } = {
    physical: [], chemical: [], hybrid: [],
  }
  const flipWarnings: string[] = []

  const writes: Array<{
    id: string
    spf_rating?: number | null
    pa_rating?: string | null
    sunscreen_type?: string | null
  }> = []

  for (const r of rows) {
    const name = r.name_en || ''
    const desc = r.description_en || ''
    const ing = r.ingredients_raw || ''
    const update: { id: string; spf_rating?: number | null; pa_rating?: string | null; sunscreen_type?: string | null } = { id: r.id }
    let touched = false

    // SPF
    const spfResult = classifySpf(name, desc, ing)
    if (spfResult.value !== null) {
      if (spfResult.source === 'explicit') {
        spfExplicit++
        if (spfExplicitExamples.length < 5) spfExplicitExamples.push(`SPF${spfResult.value}: ${name}`)
      } else {
        spfDefault++
        if (spfDefaultExamples.length < 5) spfDefaultExamples.push(`SPF${spfResult.value} (default): ${name}`)
      }
      if (r.spf_rating !== spfResult.value) {
        update.spf_rating = spfResult.value
        touched = true
        spfWrites++
        if (r.spf_rating !== null && r.spf_rating !== spfResult.value) {
          spfFlips++
          if (flipWarnings.length < 10) {
            flipWarnings.push(`SPF ${r.spf_rating}→${spfResult.value} (${spfResult.source}): ${name}`)
          }
        }
      }
    }

    // PA
    const paResult = classifyPa(name, desc, ing)
    if (paResult.value !== null) {
      if (paResult.source === 'explicit') {
        paExplicit++
        if (paExplicitExamples.length < 5) paExplicitExamples.push(`${paResult.value}: ${name}`)
      } else {
        paDefault++
        if (paDefaultExamples.length < 5) paDefaultExamples.push(`${paResult.value} (default): ${name}`)
      }
      if (r.pa_rating !== paResult.value) {
        update.pa_rating = paResult.value
        touched = true
        paWrites++
        if (r.pa_rating !== null && r.pa_rating !== paResult.value) {
          paFlips++
          if (flipWarnings.length < 10) {
            flipWarnings.push(`PA ${r.pa_rating}→${paResult.value} (${paResult.source}): ${name}`)
          }
        }
      }
    }

    // Sunscreen type — requires ingredients
    if (ing) {
      const newType = classifySunscreenType(ing)
      if (newType !== null) {
        typeClassified++
        if (typeExamples[newType as 'physical' | 'chemical' | 'hybrid'].length < 4) {
          typeExamples[newType as 'physical' | 'chemical' | 'hybrid'].push(name)
        }
        if (r.sunscreen_type !== newType) {
          update.sunscreen_type = newType
          touched = true
          typeWrites++
          if (r.sunscreen_type !== null && r.sunscreen_type !== newType) {
            typeFlips++
            if (flipWarnings.length < 10) {
              flipWarnings.push(`Type ${r.sunscreen_type}→${newType}: ${name}`)
            }
          }
        }
      }
    }

    if (touched) writes.push(update)
  }

  console.log(`─── SPF rating ────────────────────────────────`)
  console.log(`  Explicit text match: ${spfExplicit}`)
  console.log(`  K-beauty regulatory default (has UV filter, no explicit SPF): ${spfDefault}`)
  console.log(`  Total classified: ${spfExplicit + spfDefault} / ${rows.length}`)
  console.log(`  Writes: ${spfWrites} (flips: ${spfFlips})`)
  console.log(`  Explicit samples:`)
  for (const e of spfExplicitExamples) console.log(`    + ${e}`)
  console.log(`  Default samples:`)
  for (const e of spfDefaultExamples) console.log(`    + ${e}`)

  console.log(`\n─── PA rating ─────────────────────────────────`)
  console.log(`  Explicit text match: ${paExplicit}`)
  console.log(`  K-beauty regulatory default: ${paDefault}`)
  console.log(`  Total classified: ${paExplicit + paDefault} / ${rows.length}`)
  console.log(`  Writes: ${paWrites} (flips: ${paFlips})`)
  console.log(`  Explicit samples:`)
  for (const e of paExplicitExamples) console.log(`    + ${e}`)
  console.log(`  Default samples:`)
  for (const e of paDefaultExamples) console.log(`    + ${e}`)

  console.log(`\n─── Sunscreen type ────────────────────────────`)
  console.log(`  Classified: ${typeClassified} / ${rows.length}`)
  console.log(`  Writes: ${typeWrites} (flips: ${typeFlips})`)
  console.log(`  Physical samples:`)
  for (const e of typeExamples.physical) console.log(`    + ${e}`)
  console.log(`  Chemical samples:`)
  for (const e of typeExamples.chemical) console.log(`    + ${e}`)
  console.log(`  Hybrid samples:`)
  for (const e of typeExamples.hybrid) console.log(`    + ${e}`)

  if (flipWarnings.length > 0) {
    console.log(`\n⚠ Flips (heuristic overrides previous value):`)
    for (const w of flipWarnings) console.log(`    - ${w}`)
    console.log(`  (Inspect: which one is more accurate?)`)
  }

  console.log(`\nTotal rows with writes needed: ${writes.length}`)

  if (!APPLY) {
    console.log('\n(dry run — pass --apply to write)')
    return
  }

  // Write column-by-column to keep updates simple and PostgREST-friendly.
  // Each row's update may touch 1-3 columns. We do them one row at a time
  // because mixed updates across multiple columns don't chunk cleanly.
  let wrote = 0
  for (let i = 0; i < writes.length; i++) {
    const w = writes[i]
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { id, ...payload } = w
    const { error } = await db.from('ss_products').update(payload).eq('id', id)
    if (error) {
      console.error(`  row ${i} update error:`, error.message)
      break
    }
    wrote++
    if (wrote % 100 === 0) console.log(`  …${wrote}/${writes.length}`)
  }
  console.log(`\nWrote ${wrote} updates.`)
}
main().catch((e) => console.error('script err', (e as Error).message))
