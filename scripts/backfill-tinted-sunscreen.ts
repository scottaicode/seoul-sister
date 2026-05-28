/**
 * v10.8.19 — Backfill `is_tinted` for the 672 sunscreens in ss_products.
 *
 * Run AFTER applying migration 20260528000001_add_is_tinted_sunscreen.sql.
 *
 * Strategy: deterministic heuristic on name + description.
 *   TINTED if any of: "tinted" / "tint", "tone-up" / "tone up", standalone "BB"
 *     or "CC" (sunscreen context), "cushion" (cushion sunscreens are tinted by
 *     definition), Korean 톤업 / 틴트 / 커버 / BB / CC.
 *   UNTINTED otherwise.
 *
 * No Sonnet needed — name + description is sufficient signal and re-runs are
 * idempotent + free. Tightened regex from the first-pass exploration to avoid
 * false positives like "Mid-Day Blue" matching on "blue" → uses word-boundaries
 * and excludes color-name false positives.
 *
 * Run dry first:  npx tsx --tsconfig tsconfig.json scripts/backfill-tinted-sunscreen.ts
 *   to apply:     npx tsx --tsconfig tsconfig.json scripts/backfill-tinted-sunscreen.ts --apply
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const APPLY = process.argv.includes('--apply')

// Deterministic tinted-detection regex.
// - \btint(ed)?\b — "tint" or "tinted" as a standalone word
// - \btone[\s-]?up\b — "tone up" or "tone-up"
// - \bBB\b / \bCC\b — only as standalone tokens (avoids brand-noise false positives)
// - \bcushion\b — cushion sunscreens are tinted by category
// - 톤업 / 틴트 / 커버 (Korean: tone-up / tint / cover)
const TINTED_RE = /\btint(ed)?\b|\btone[\s-]?up\b|\bBB\b|\bCC\b|\bcushion\b|톤업|틴트|커버/i

interface Row { id: string; name_en: string | null; description_en: string | null; is_tinted: boolean | null }

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function pageAll(db: any): Promise<Row[]> {
  const all: Row[] = []
  let from = 0
  for (;;) {
    const { data, error } = await db
      .from('ss_products')
      .select('id, name_en, description_en, is_tinted')
      .eq('category', 'sunscreen')
      .range(from, from + 999)
    if (error || !data || data.length === 0) break
    all.push(...(data as unknown as Row[]))
    from += 1000
    if (data.length < 1000) break
  }
  return all
}

async function main() {
  const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)
  console.log(`Mode: ${APPLY ? 'APPLY' : 'DRY RUN'}\n`)

  const rows = await pageAll(db)
  console.log(`Total sunscreens: ${rows.length}`)

  let tintedCount = 0
  let untintedCount = 0
  let skipped = 0
  const writes: { id: string; is_tinted: boolean }[] = []
  const tintedExamples: string[] = []
  const untintedExamples: string[] = []

  for (const r of rows) {
    const corpus = `${r.name_en || ''} ${r.description_en || ''}`
    const isTinted = TINTED_RE.test(corpus)
    if (isTinted) {
      tintedCount++
      if (tintedExamples.length < 8) tintedExamples.push(r.name_en || '(unknown)')
    } else {
      untintedCount++
      if (untintedExamples.length < 8) untintedExamples.push(r.name_en || '(unknown)')
    }
    // Only write if value would change (idempotent, cheap)
    if (r.is_tinted !== isTinted) {
      writes.push({ id: r.id, is_tinted: isTinted })
    } else {
      skipped++
    }
  }

  console.log(`\nClassification:`)
  console.log(`  TINTED:   ${tintedCount}`)
  console.log(`  UNTINTED: ${untintedCount}`)
  console.log(`\nTinted examples:`)
  for (const e of tintedExamples) console.log(`  + ${e}`)
  console.log(`\nUntinted examples (random first 8):`)
  for (const e of untintedExamples) console.log(`  - ${e}`)
  console.log(`\nWrites needed: ${writes.length} | unchanged: ${skipped}`)

  if (!APPLY) {
    console.log('\n(dry run — pass --apply to write)')
    return
  }

  // Batch update by is_tinted value (2 single UPDATEs would be cheapest, but
  // PostgREST update supports filter+update only on equality. Use .in() with
  // chunks of 100 ids.)
  let wrote = 0
  for (const target of [true, false]) {
    const ids = writes.filter((w) => w.is_tinted === target).map((w) => w.id)
    for (let i = 0; i < ids.length; i += 100) {
      const chunk = ids.slice(i, i + 100)
      const { error } = await db.from('ss_products').update({ is_tinted: target }).in('id', chunk)
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
