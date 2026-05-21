/**
 * Diagnostic — why does the canary's Torriden case still fail?
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '..', '.env.local')
const envContent = readFileSync(envPath, 'utf-8')
for (const line of envContent.split('\n')) {
  const t = line.trim()
  if (!t || t.startsWith('#')) continue
  const eq = t.indexOf('=')
  if (eq === -1) continue
  if (!process.env[t.slice(0, eq).trim()]) process.env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim()
}

const supabase = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

const SEARCH_STOP_WORDS = new Set([
  'the', 'a', 'an', 'for', 'and', 'or', 'by', 'with', 'in', 'of', 'to',
  'my', 'me', 'is', 'it', 'do', 'you', 'have', 'this', 'that',
  'product', 'products', 'skincare', 'kbeauty', 'k-beauty', 'korean',
])

const query = 'Torriden Dive-In Low Molecular Hyaluronic Acid Toner'

const cleaned = query.trim()
const normalized = cleaned.toLowerCase().replace(/[-/_.]+/g, ' ')
const originalTokens = normalized.split(/\s+/).filter(t => t.length > 0)
const terms = originalTokens.filter(t => t.length > 1 && !SEARCH_STOP_WORDS.has(t))

console.log('cleaned:', cleaned)
console.log('normalized:', normalized)
console.log('originalTokens:', originalTokens)
console.log('terms:', terms)
console.log('')

;(async () => {
// Strategy 1 — full string ilike
console.log('--- Strategy 1: full-string ilike ---')
const { data: s1 } = await supabase
  .from('ss_products')
  .select('id, name_en, brand_en')
  .eq('is_verified', true)
  .or(`name_en.ilike.%${cleaned}%,brand_en.ilike.%${cleaned}%`)
  .limit(5)
console.log('Strategy 1 results:', s1?.length || 0)
if (s1?.length) console.log(s1)

// Strategy 1.5 — brand-prefix composite
console.log('\n--- Strategy 1.5: brand-prefix composite ---')
for (const brandTokenCount of [1, 2, 3]) {
  if (originalTokens.length <= brandTokenCount) {
    console.log(`brandTokenCount=${brandTokenCount}: skipped (originalTokens too short)`)
    continue
  }
  const brandCandidate = originalTokens.slice(0, brandTokenCount).join(' ')
  const nameTerms = originalTokens.slice(brandTokenCount).filter(t => t.length > 1 && !SEARCH_STOP_WORDS.has(t))
  if (nameTerms.length === 0) {
    console.log(`brandTokenCount=${brandTokenCount}: skipped (no name terms after stop-word filter)`)
    continue
  }

  console.log(`brandTokenCount=${brandTokenCount}:`)
  console.log(`  brandCandidate: "${brandCandidate}"`)
  console.log(`  nameTerms:`, nameTerms)

  let q = supabase
    .from('ss_products')
    .select('id, name_en, brand_en')
    .eq('is_verified', true)
    .ilike('brand_en', `%${brandCandidate}%`)
  for (const t of nameTerms) {
    q = q.ilike('name_en', `%${t}%`)
  }
  const { data: result, error } = await q.limit(5)
  console.log(`  results: ${result?.length || 0}`)
  if (error) console.log(`  error:`, error)
  if (result?.length) {
    console.log(`  rows:`, result)
    break
  }
}
})();
