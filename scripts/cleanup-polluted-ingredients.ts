/**
 * Cleanup: deactivate polluted ss_ingredients rows.
 *
 * Cause: parseInciString() only splits on commas. Multi-shade makeup products
 * delimit with "@" or run shade blocks together with no comma at all
 * ("...Caprylyl Glycol[#03 Concealer: Titanium Dioxide..."), so an entire INCI
 * dump lands as ONE ingredient row — the worst is 6,081 chars. These rows are
 * public at /ingredients/[slug] and sit in the sitemap, so AI crawlers are
 * being fed garbage on the channel that's actually citing us.
 *
 * Pollution rule (mirrors isPollutedIngredientName in ingredient-parser.ts):
 *   contains "@"  OR  contains "[" or "]"  OR  longer than 60 chars
 *
 * Commas are deliberately NOT a pollution signal: "1,2-Hexanediol" (504 product
 * links) and concentration-annotated names like "Niacinamide (20,000 ppm)" are
 * legitimate and heavily linked. A comma-based rule would delete real data.
 *
 * Deactivates (is_active=false) rather than deleting: reversible, and preserves
 * the ss_product_ingredients FK links. The polluted rows carry only ~2.7K links
 * vs ~227K on clean rows, confirming they aren't load-bearing.
 *
 * Usage:
 *   npx tsx scripts/cleanup-polluted-ingredients.ts          # dry run
 *   npx tsx scripts/cleanup-polluted-ingredients.ts --apply  # write
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { isPollutedIngredientName } from '../src/lib/pipeline/ingredient-parser'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const supabase = createClient(
  get('NEXT_PUBLIC_SUPABASE_URL')!,
  get('SUPABASE_SERVICE_ROLE_KEY')!
)

const APPLY = process.argv.includes('--apply')

// Guard: these must never be caught by the pollution rule. If any of them is
// flagged, the rule is wrong — abort rather than damage the catalog.
const CANARIES = [
  'Water',
  'Glycerin',
  'Niacinamide',
  'Retinol',
  'Salicylic Acid',
  '1,2-Hexanediol',
  'Niacinamide (20,000 ppm)',
]

async function main() {
  for (const name of CANARIES) {
    if (isPollutedIngredientName(name)) {
      console.error(`ABORT: pollution rule would flag a legit ingredient: "${name}"`)
      process.exit(1)
    }
  }
  console.log(`Canary check passed (${CANARIES.length} legit names survive the rule).\n`)

  // Page through the whole table — it's ~15K rows, past the 1K default cap.
  const all: { id: string; name_inci: string; is_active: boolean }[] = []
  const PAGE = 1000
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await supabase
      .from('ss_ingredients')
      .select('id, name_inci, is_active')
      .range(from, from + PAGE - 1)
    if (error) throw error
    if (!data?.length) break
    all.push(...data)
    if (data.length < PAGE) break
  }

  const polluted = all.filter((r) => isPollutedIngredientName(r.name_inci))
  const toDeactivate = polluted.filter((r) => r.is_active)

  console.log(`Scanned:              ${all.length} ingredients`)
  console.log(`Polluted (total):     ${polluted.length}`)
  console.log(`Polluted & active:    ${toDeactivate.length}  <-- will be deactivated`)
  console.log(`Clean & active after: ${all.filter((r) => r.is_active && !isPollutedIngredientName(r.name_inci)).length}\n`)

  console.log('Sample of what gets deactivated:')
  for (const r of toDeactivate.slice(0, 5)) {
    console.log(`  [${String(r.name_inci.length).padStart(4)} chars] ${r.name_inci.slice(0, 90)}...`)
  }

  if (!APPLY) {
    console.log('\nDRY RUN — nothing written. Re-run with --apply to commit.')
    return
  }

  let done = 0
  const CHUNK = 200
  for (let i = 0; i < toDeactivate.length; i += CHUNK) {
    const ids = toDeactivate.slice(i, i + CHUNK).map((r) => r.id)
    const { error } = await supabase
      .from('ss_ingredients')
      .update({ is_active: false })
      .in('id', ids)
    if (error) throw error
    done += ids.length
    console.log(`  deactivated ${done}/${toDeactivate.length}`)
  }

  console.log(`\nDone. ${done} polluted ingredient rows deactivated.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
