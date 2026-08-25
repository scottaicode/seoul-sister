/**
 * Apply scripts/migrations/fix_truncated_meta_descriptions.sql.
 *
 * 5 blog meta descriptions exceed Google's ~155-160 char SERP cap and render
 * truncated mid-sentence — including the site's highest-impression page
 * (Beauty of Joseon Aqua-Fresh, 198 chars, ~1,162 impr / 5 clicks).
 *
 * Dry run (default):  npx tsx --tsconfig tsconfig.json scripts/apply-meta-description-fix.ts
 * Execute:            ... --apply
 */
import { createClient } from '@supabase/supabase-js'

const apply = process.argv.includes('--apply')
const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } })

const FIXES: Array<[string, string]> = [
  ['beauty-of-joseon-aqua-fresh-sunscreen-full-review',
   'Beauty of Joseon Aqua Fresh sunscreen: full INCI list, the Uvinul A Plus and T 150 filters, who it suits, and how it compares.'],
  ['how-to-tell-if-your-sulwhasoo-first-care-serum-is-fake-5-che',
   'Spot a fake Sulwhasoo First Care Serum with 5 checks: glass weight, gold foil, Korean MFDS label, barcode, and shrink wrap.'],
  ['oily-skin-routine-guide',
   'A K-beauty routine for oily skin, built on BHA, niacinamide and tea tree. Which steps actually control shine, and which to skip.'],
  ['same-brand-different-formula-why-that-similar-k-beauty-product-just-wrecked-your-skin',
   'Broke out from a similar product by the same K-beauty brand? Here is why near-identical formulas react completely differently.'],
  ['how-do-you-build-a-korean-skincare-routine-youll-actually-stick-to',
   'Most people quit because the routine is too big. How to build a Korean skincare routine you will still be using in a year.'],
]

async function main() {
  console.log(apply ? 'MODE: APPLY\n' : 'MODE: DRY RUN (no writes)\n')
  for (const [slug, next] of FIXES) {
    const { data, error } = await sb.from('ss_content_posts').select('meta_description').eq('slug', slug).maybeSingle()
    if (error) throw new Error(`[${slug}] read failed: ${error.message}`)
    if (!data) { console.log(`  SKIP (no such slug): ${slug}`); continue }
    const cur = (data as { meta_description: string | null }).meta_description ?? ''
    if (cur === next) { console.log(`  already fixed: ${slug}`); continue }
    console.log(`  ${slug}\n    ${cur.length} -> ${next.length} chars`)
    if (!apply) continue
    // Guard on the CURRENT value so a re-run cannot clobber a later hand edit.
    const { error: uErr, count } = await sb.from('ss_content_posts')
      .update({ meta_description: next }, { count: 'exact' })
      .eq('slug', slug).eq('meta_description', cur)
    if (uErr) throw new Error(`[${slug}] update failed: ${uErr.message}`)
    console.log(`    updated rows: ${count}`)
  }
  // Verify by re-reading, not by trusting the update.
  const { data: left } = await sb.from('ss_content_posts').select('slug,meta_description')
  const over = ((left ?? []) as any[]).filter(p => (p.meta_description || '').length > 160)
  console.log(`\nremaining >160 chars: ${over.length}`)
  over.forEach(p => console.log(`  ${p.meta_description.length} ${p.slug}`))
}
main().catch(e => { console.error(e); process.exit(1) })
