/**
 * v10.8.21 — Backfill water_resistant for the 672 sunscreens.
 *
 * Investigation (May 28 2026): Bailey hit the new tinted filter combined with
 * PA++++ + water_resistant and got 0 results. Root cause was data sparsity, not
 * a code bug: 502 of 672 sunscreens have water_resistant=NULL, only 22 marked
 * true. Same Phase-9-extraction-incompleteness pattern as the tinted gap.
 *
 * Strategy: STRICT heuristic regex on name + description. Water-resistant is a
 * NARROW category (most K-beauty sunscreens are NOT water-resistant; they're
 * daily-wear). Critical distinction during research:
 *   - "Waterproof" / "Water resistant" / "Sweatproof" → TRUE (the real signal)
 *   - "Waterful" / "Waterfull" / "Watery" / "Aqua" / "Water-based" → texture/
 *     hydration claims, NOT water resistance. Excluded.
 *
 * Phase 9 extraction apparently didn't separate these cases — many "Aqua /
 * Waterful" tone-up sunscreens were left NULL rather than marked false. This
 * backfill writes the false case explicitly so the filter behaves correctly.
 *
 * Idempotent + deterministic. Re-runs are free.
 *
 * Run dry first:  npx tsx --tsconfig tsconfig.json scripts/backfill-water-resistant-sunscreen.ts
 *   to apply:     npx tsx --tsconfig tsconfig.json scripts/backfill-water-resistant-sunscreen.ts --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const APPLY = process.argv.includes('--apply')

// Tight regex: only the STRONG water-resistance markers. Avoids false positives
// from "waterful", "watery", "aqua", "water-based" which are texture/hydration
// claims, not durability claims.
//   \bwater[\s-]?(proof|resistant|resist)\b — "waterproof", "water-proof",
//                                              "water resistant", "water-resistant",
//                                              "water resist", "water-resist"
//   \bsweat[\s-]?(proof|resistant|resist)\b — sweatproof variants
//   \bresist(s|ant)?\s+(sweat|water)\b — "resist sweat", "resists water",
//                                         "resistant to water" (caught Chrono Beauty,
//                                         which says "designed to resist sweat and friction")
//   \bsurf(ing)?\b — surfing/surf-rated sticks (always water-resistant)
//   Korean: 방수 (waterproof), 워터프루프
const WR_RE = /\bwater[\s-]?(proof|resistant|resist)\b|\bsweat[\s-]?(proof|resistant|resist)\b|\bresist(s|ant)?\s+(sweat|water)\b|\bsurf(ing)?\b|방수|워터프루프/i

// Secondary signal: when "water" or "sweat" appears together with activity
// markers — "outdoor activities", "swimming", "beach", "long-lasting".
// We only treat this as a positive signal when paired with one of these
// activity contexts AND the name doesn't carry a "watery/aqua/waterful"
// texture-only signal.
const ACTIVITY_RE = /\b(swim|swimming|beach|outdoor|sport|active|exercise|athletic)\b/i
const WATER_CONTEXT_RE = /\b(water|sweat)\b/i

// Strong exclusions: these patterns are texture/hydration claims, NOT
// water-resistance claims. Common in K-beauty naming.
const TEXTURE_ONLY_RE = /\b(waterful|waterfull|watery|aqua|water[\s-]?based|water[\s-]?(splash|drop|fit|fresh|holding))\b/i

interface Row { id: string; name_en: string | null; description_en: string | null; water_resistant: boolean | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pageAll(db: any): Promise<Row[]> {
  const all: Row[] = []
  let from = 0
  for (;;) {
    const { data, error } = await db
      .from('ss_products')
      .select('id, name_en, description_en, water_resistant')
      .eq('category', 'sunscreen')
      .range(from, from + 999)
    if (error || !data || data.length === 0) break
    all.push(...(data as unknown as Row[]))
    from += 1000
    if (data.length < 1000) break
  }
  return all
}

function classify(name: string, desc: string): boolean {
  const combined = `${name} ${desc}`
  // 1) Strong direct signal wins absolutely.
  if (WR_RE.test(combined)) return true
  // 2) Activity context + water/sweat mention (only if not texture-only naming)
  if (TEXTURE_ONLY_RE.test(name)) return false
  if (ACTIVITY_RE.test(combined) && WATER_CONTEXT_RE.test(combined)) return true
  return false
}

async function main() {
  const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  const rows = await pageAll(db)
  console.log(`Total sunscreens: ${rows.length}`)

  let trueCount = 0
  let falseCount = 0
  const writes: { id: string; water_resistant: boolean }[] = []
  const trueExamples: string[] = []
  const flippedFalseExamples: string[] = []
  const skipped: string[] = []

  for (const r of rows) {
    const isWR = classify(r.name_en || '', r.description_en || '')
    if (isWR) {
      trueCount++
      if (trueExamples.length < 12) trueExamples.push(r.name_en || '(unknown)')
    } else {
      falseCount++
    }
    if (r.water_resistant !== isWR) {
      writes.push({ id: r.id, water_resistant: isWR })
      // If the heuristic flips a previously-true row to false, that's worth
      // surfacing — could be a false-negative. Inspect a few samples.
      if (r.water_resistant === true && !isWR && flippedFalseExamples.length < 8) {
        flippedFalseExamples.push(r.name_en || '(unknown)')
      }
    } else {
      skipped.push(r.id)
    }
  }

  console.log(`\nClassification:`)
  console.log(`  TRUE (water-resistant): ${trueCount}`)
  console.log(`  FALSE (not water-resistant): ${falseCount}`)
  console.log(`\nWater-resistant examples (sanity check):`)
  for (const e of trueExamples) console.log(`  + ${e}`)
  if (flippedFalseExamples.length) {
    console.log(`\n⚠ Previously-TRUE rows the new heuristic flips to FALSE:`)
    for (const e of flippedFalseExamples) console.log(`  - ${e}`)
    console.log(`  (Inspect: are these genuinely not water-resistant, or false negatives?)`)
  }
  console.log(`\nWrites needed: ${writes.length} | unchanged: ${skipped.length}`)

  if (!APPLY) {
    console.log('\n(dry run — pass --apply to write)')
    return
  }

  // Batch write by value (PostgREST can update .in() chunks of 100)
  let wrote = 0
  for (const target of [true, false]) {
    const ids = writes.filter((w) => w.water_resistant === target).map((w) => w.id)
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      const { error } = await db.from('ss_products').update({ water_resistant: target }).in('id', chunk)
      if (error) {
        console.error(`  chunk error (${target}, ${i}):`, error.message)
        break
      }
      wrote += chunk.length
    }
  }
  console.log(`\nWrote ${wrote} updates.`)
}
main().catch((e) => console.error('script err', (e as Error).message))
