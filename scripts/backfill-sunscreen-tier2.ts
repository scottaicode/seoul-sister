/**
 * v10.8.23 — Tier 2 sunscreen filter backfill: white_cast, finish, under_makeup.
 *
 * Companion to v10.8.22 Tier 1. These three fields have meaningful real-world
 * classifications but are 49-68% NULL in the catalog. Backfilling them
 * unblocks Bailey-class queries like "tinted + matte + under_makeup" which
 * currently return ~0 results not because no products exist but because the
 * data is missing.
 *
 * Strategy: signal-priority heuristic regex against name + description.
 * Phase 9 left the 302 most-common rows fully NULL — those got skipped. We
 * fill them from textual markers, with sensible K-beauty defaults when the
 * description names a known product TYPE (tone-up, cushion, BB) but doesn't
 * explicitly describe finish/cast.
 *
 * AI-First note: same shape as Tier 1. Pattern-match marketing language for
 * fields with bounded enum values. Constraints enforce output validity. Not
 * a recommendation engine, not a quality judgment.
 *
 * Idempotent, deterministic, dry-runnable. Run with --apply to write.
 *
 *   npx tsx --tsconfig tsconfig.json scripts/backfill-sunscreen-tier2.ts
 *   npx tsx --tsconfig tsconfig.json scripts/backfill-sunscreen-tier2.ts --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const APPLY = process.argv.includes('--apply')

// ────────────────────────────────────────────────────────────────────
// FINISH classification
// ────────────────────────────────────────────────────────────────────
// Constraint enum: matte | dewy | natural | satin
//
// Priority cascade (highest specificity first):
//   1. Explicit finish word ("matte finish", "dewy finish")
//   2. Strong texture/feel signal that implies finish
//      - matte: sebum control, oil control, shine-free, "no shine",
//               powder, blur, mattifying, "controls sebum"
//      - dewy: glow, radiant, luminous, "lit-from-within"
//      - satin: rare; only if explicit
//   3. Default for tone-up / brightening / tinted products: natural
//
// "Pore Zero Oil Control Sun Stick" → matte (oil control signal)
// "Brightening UV Sunscreen Gel" → natural (brightening default)
// "Sunday No Sebum" → matte (no sebum = oil control)
// Match "blur", "blurring", "blurred", "blur finish" — "blur" alone is a strong
// matte signal in K-beauty (pore-blurring claims are matte category).
const MATTE_RE = /\b(matte|sebum[\s-]?control|no[\s-]?sebum|oil[\s-]?control|shine[\s-]?free|no[\s-]?shine|mattif(y|ying)|powder|blur\w*|pore[\s-]?zero|pore[\s-]?blur|controls?\s+sebum)\b/i
const DEWY_RE = /\b(dewy|glow(ing|y)?|luminous|radian(t|ce)|lit[\s-]from[\s-]within|wet[\s-]?dewy|moist[\s-]?glow|water(y|ful))\b/i
const SATIN_RE = /\bsatin\b/i
const NATURAL_DEFAULT_RE = /\b(tone[\s-]?up|brighten(ing)?|tinted|tint\b|cushion|cc[\s-]?cream|bb[\s-]?cream|color[\s-]?correct|tone[\s-]?correct|natural[\s-]?finish|natural\b)\b/i

function classifyFinish(name: string, desc: string, sunscreenType: string | null): { value: string | null; source: 'explicit' | 'inferred' | 'default' | 'no_signal' } {
  const combined = `${name} ${desc}`
  // Priority: matte > dewy > satin > natural-default.
  // Pick the FIRST strong signal; multi-signal products lean to the more
  // distinctive classification (matte trumps natural).
  if (SATIN_RE.test(combined)) return { value: 'satin', source: 'explicit' }
  if (MATTE_RE.test(combined)) return { value: 'matte', source: combined.match(/\bmatte\b/i) ? 'explicit' : 'inferred' }
  if (DEWY_RE.test(combined)) return { value: 'dewy', source: combined.match(/\bdewy\b/i) ? 'explicit' : 'inferred' }
  if (NATURAL_DEFAULT_RE.test(combined)) return { value: 'natural', source: 'default' }
  // Last-resort default: any sunscreen with UV filter ingredients that lacks
  // an explicit finish word is overwhelmingly a "natural finish" daily sunscreen
  // (K-beauty's largest finish bucket — 167 explicit classifications already).
  // This is a weaker default than the toner-up/cushion case but still defensible
  // for daily-wear sunscreens. Anything without UV filters (the residual 17)
  // genuinely shouldn't be classified.
  if (sunscreenType !== null) return { value: 'natural', source: 'default' }
  return { value: null, source: 'no_signal' }
}

// ────────────────────────────────────────────────────────────────────
// WHITE_CAST classification
// ────────────────────────────────────────────────────────────────────
// Constraint enum: none | minimal | moderate | heavy
//
// Strong direct signals (priority):
//   1. "no white cast" / "invisible" / "clear" / "without white residue" → none
//   2. "minimal white cast" / "subtle" → minimal
//   3. "heavy" or known heavy-cast mineral formula → moderate/heavy
//   4. Tinted products → none (tint cancels cast)
//   5. Physical/mineral sunscreen with no explicit "no cast" claim → moderate
//      (mineral sunscreens classically have moderate cast unless specifically
//       reformulated; safer default than 'none')
const NO_CAST_RE = /\b(no[\s-]?white[\s-]?cast|without[\s-]?(any[\s-]?)?white|invisible(\s+(finish|on[\s-]?skin))?|clear[\s-]?(finish|application)|no[\s-]?(white[\s-]?)?residue|cast[\s-]?free|true[\s-]?clear)\b/i
const MINIMAL_CAST_RE = /\b(minimal[\s-]?(white[\s-]?cast)?|subtle[\s-]?(white[\s-]?)?cast|light[\s-]?white[\s-]?cast)\b/i
const HEAVY_CAST_RE = /\b(heavy[\s-]?white[\s-]?cast|noticeable[\s-]?white|chalky)\b/i

// Tinted detection (already accurate via is_tinted column from v10.8.19,
// but we still want the text heuristic here for redundancy).
const TINT_RE = /\btint(ed)?\b|\btone[\s-]?up\b|\bBB\b|\bCC\b|\bcushion\b|톤업|틴트/i

function classifyWhiteCast(name: string, desc: string, sunscreenType: string | null): { value: string | null; source: 'explicit' | 'inferred' | 'default' | 'no_signal' } {
  const combined = `${name} ${desc}`
  if (NO_CAST_RE.test(combined)) return { value: 'none', source: 'explicit' }
  if (MINIMAL_CAST_RE.test(combined)) return { value: 'minimal', source: 'explicit' }
  if (HEAVY_CAST_RE.test(combined)) return { value: 'heavy', source: 'explicit' }
  // Tinted formulations cancel cast.
  if (TINT_RE.test(combined)) return { value: 'none', source: 'inferred' }
  // Physical/mineral sunscreens classically have moderate cast unless
  // explicitly reformulated to avoid it. Reasonable default.
  if (sunscreenType === 'physical') return { value: 'moderate', source: 'default' }
  // Chemical/hybrid sunscreens default to minimal — most K-beauty chemicals
  // are explicitly engineered for cast-free wear, which is one of the
  // category's main marketing points.
  if (sunscreenType === 'chemical' || sunscreenType === 'hybrid') {
    return { value: 'minimal', source: 'default' }
  }
  return { value: null, source: 'no_signal' }
}

// ────────────────────────────────────────────────────────────────────
// UNDER_MAKEUP classification
// ────────────────────────────────────────────────────────────────────
// Boolean. Strong yes signals (priority):
//   1. Explicit "under makeup" / "makeup primer" / "makeup base" → true
//   2. "non-greasy" / "doesn't pill" / "primer" → true
//   3. Cushion / BB / CC / tone-up replace makeup → true
//   4. Stick formats marketed for touch-ups (over makeup) → true
//   5. Water-resistant + outdoor / sport markers + no makeup mention → false
//   6. Heavy mineral, "moderate cast" / "for sports" → false
const UNDER_MAKEUP_YES_RE = /\b(under[\s-]?makeup|makeup[\s-]?(primer|base)|primer|makeup[\s-]?ready|over[\s-]?makeup|touch[\s-]?up|reapply(\s+over)?|skin[\s-]?fit|tone[\s-]?up|cushion|BB[\s-]?cream|CC[\s-]?cream|foundation|non[\s-]?greasy|won['’]?t[\s-]?pill|doesn['’]?t[\s-]?pill|no[\s-]?pilling)\b/i
const SPORTY_NO_RE = /\b(beach|sport|surf|sweatproof|water[\s-]?sports|outdoor[\s-]?activities|athletic)\b/i

function classifyUnderMakeup(name: string, desc: string, sunscreenType: string | null): { value: boolean | null; source: 'explicit' | 'inferred' | 'default' | 'no_signal' } {
  const combined = `${name} ${desc}`
  // True signals: any positive marker → true
  if (UNDER_MAKEUP_YES_RE.test(combined)) {
    const explicit = /\b(under[\s-]?makeup|makeup[\s-]?(primer|base)|primer)\b/i.test(combined)
    return { value: true, source: explicit ? 'explicit' : 'inferred' }
  }
  // False signals: sport/outdoor markers with no makeup mention
  if (SPORTY_NO_RE.test(combined)) return { value: false, source: 'inferred' }
  // Default for daily-wear sunscreens (chemical/hybrid with no other signal):
  // K-beauty daily sunscreens are designed for everyday wear, which is
  // implicitly "under makeup" for most users. This is a confident default.
  if (sunscreenType === 'chemical' || sunscreenType === 'hybrid') {
    return { value: true, source: 'default' }
  }
  // Physical sunscreens default to true unless sport-marked above.
  // K-beauty physical sunscreens are still daily-wear-oriented (Korean
  // beauty culture leans toward daily reapplication, not beach use).
  if (sunscreenType === 'physical') {
    return { value: true, source: 'default' }
  }
  return { value: null, source: 'no_signal' }
}

interface Row {
  id: string
  name_en: string | null
  description_en: string | null
  sunscreen_type: string | null
  white_cast: string | null
  finish: string | null
  under_makeup: boolean | null
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pageAll(db: any): Promise<Row[]> {
  const all: Row[] = []
  let from = 0
  for (;;) {
    const { data, error } = await db
      .from('ss_products')
      .select('id, name_en, description_en, sunscreen_type, white_cast, finish, under_makeup')
      .eq('category', 'sunscreen')
      .range(from, from + 999)
    if (error || !data || data.length === 0) break
    all.push(...(data as unknown as Row[]))
    from += 1000
    if (data.length < 1000) break
  }
  return all
}

interface SourceCount { explicit: number; inferred: number; default: number; no_signal: number }
function emptyCount(): SourceCount { return { explicit: 0, inferred: 0, default: 0, no_signal: 0 } }

async function main() {
  const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  const rows = await pageAll(db)
  console.log(`Total sunscreens: ${rows.length}\n`)

  const finishSources = emptyCount()
  const castSources = emptyCount()
  const makeupSources = emptyCount()
  const dist = {
    finish: { matte: 0, dewy: 0, natural: 0, satin: 0 },
    cast: { none: 0, minimal: 0, moderate: 0, heavy: 0 },
    makeup: { true: 0, false: 0 },
  }
  let finishWrites = 0, finishFlips = 0
  let castWrites = 0, castFlips = 0
  let makeupWrites = 0, makeupFlips = 0
  const flipWarnings: string[] = []
  const finishExamples: Record<string, string[]> = { matte: [], dewy: [], natural: [], satin: [] }
  const castExamples: Record<string, string[]> = { none: [], minimal: [], moderate: [], heavy: [] }

  const writes: Array<{ id: string; finish?: string | null; white_cast?: string | null; under_makeup?: boolean | null }> = []

  for (const r of rows) {
    const name = r.name_en || ''
    const desc = r.description_en || ''
    const update: { id: string; finish?: string | null; white_cast?: string | null; under_makeup?: boolean | null } = { id: r.id }
    let touched = false

    const fin = classifyFinish(name, desc, r.sunscreen_type)
    if (fin.value !== null) {
      finishSources[fin.source as keyof SourceCount]++
      dist.finish[fin.value as keyof typeof dist.finish]++
      if (finishExamples[fin.value].length < 3) finishExamples[fin.value].push(`${fin.value} (${fin.source}): ${name}`)
      if (r.finish !== fin.value) {
        update.finish = fin.value
        touched = true
        finishWrites++
        if (r.finish !== null && r.finish !== fin.value) {
          finishFlips++
          if (flipWarnings.length < 12) flipWarnings.push(`Finish ${r.finish}→${fin.value} (${fin.source}): ${name}`)
        }
      }
    } else {
      finishSources.no_signal++
    }

    const cast = classifyWhiteCast(name, desc, r.sunscreen_type)
    if (cast.value !== null) {
      castSources[cast.source as keyof SourceCount]++
      dist.cast[cast.value as keyof typeof dist.cast]++
      if (castExamples[cast.value].length < 3) castExamples[cast.value].push(`${cast.value} (${cast.source}): ${name}`)
      if (r.white_cast !== cast.value) {
        update.white_cast = cast.value
        touched = true
        castWrites++
        if (r.white_cast !== null && r.white_cast !== cast.value) {
          castFlips++
          if (flipWarnings.length < 12) flipWarnings.push(`Cast ${r.white_cast}→${cast.value} (${cast.source}): ${name}`)
        }
      }
    } else {
      castSources.no_signal++
    }

    const um = classifyUnderMakeup(name, desc, r.sunscreen_type)
    if (um.value !== null) {
      makeupSources[um.source as keyof SourceCount]++
      dist.makeup[String(um.value) as 'true' | 'false']++
      if (r.under_makeup !== um.value) {
        update.under_makeup = um.value
        touched = true
        makeupWrites++
        if (r.under_makeup !== null && r.under_makeup !== um.value) {
          makeupFlips++
          if (flipWarnings.length < 12) flipWarnings.push(`UnderMakeup ${r.under_makeup}→${um.value} (${um.source}): ${name}`)
        }
      }
    } else {
      makeupSources.no_signal++
    }

    if (touched) writes.push(update)
  }

  function printSection(label: string, sources: SourceCount, writes: number, flips: number, total: number, exampleObj?: Record<string, string[]>) {
    console.log(`─── ${label} ───────────────────`)
    const classified = sources.explicit + sources.inferred + sources.default
    console.log(`  Explicit text: ${sources.explicit}`)
    console.log(`  Inferred from related signal: ${sources.inferred}`)
    console.log(`  Sensible default: ${sources.default}`)
    console.log(`  No signal (stays NULL): ${sources.no_signal}`)
    console.log(`  Total classified: ${classified} / ${total}`)
    console.log(`  Writes: ${writes} (flips: ${flips})`)
    if (exampleObj) {
      for (const k of Object.keys(exampleObj)) {
        if (exampleObj[k].length === 0) continue
        console.log(`  ${k}:`)
        for (const e of exampleObj[k]) console.log(`    + ${e}`)
      }
    }
  }

  printSection('FINISH', finishSources, finishWrites, finishFlips, rows.length, finishExamples)
  console.log(`  Distribution: matte=${dist.finish.matte} dewy=${dist.finish.dewy} natural=${dist.finish.natural} satin=${dist.finish.satin}`)
  console.log()
  printSection('WHITE_CAST', castSources, castWrites, castFlips, rows.length, castExamples)
  console.log(`  Distribution: none=${dist.cast.none} minimal=${dist.cast.minimal} moderate=${dist.cast.moderate} heavy=${dist.cast.heavy}`)
  console.log()
  printSection('UNDER_MAKEUP', makeupSources, makeupWrites, makeupFlips, rows.length)
  console.log(`  Distribution: true=${dist.makeup.true} false=${dist.makeup.false}`)

  if (flipWarnings.length > 0) {
    console.log(`\n⚠ Flips (heuristic overrides previous value):`)
    for (const w of flipWarnings) console.log(`    - ${w}`)
    console.log(`  (Inspect: which is more accurate?)`)
  }

  console.log(`\nTotal rows with writes needed: ${writes.length}`)

  if (!APPLY) {
    console.log('\n(dry run — pass --apply to write)')
    return
  }

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
