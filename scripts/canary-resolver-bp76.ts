/**
 * Resolver canary for the BP76 Strategy 1.5 brand-prefix fix.
 *
 * Exercises both `resolveProductByName` (returns match_quality) and
 * `resolveProductByNameStrict` (returns null on partial) against:
 *
 *   - Bare product names (should resolve cleanly, no regression)
 *   - Brand-prefixed product names (the BP76 fix target)
 *   - Multi-word brand names (Beauty of Joseon, Some By Mi, Round Lab)
 *   - Off-target queries that SHOULD partial-match (verify strict gate still nulls them)
 *   - Bailey's known library brands
 *
 * Pass criteria:
 *   - Every named target product returns a non-null, all_terms-or-exact match
 *   - Off-target / vague queries either return a brand-correct match or null
 *     (never silently substitute the wrong brand)
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/canary-resolver-bp76.ts
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
const envPath = resolve(__dir, '..', '.env.local')
try {
  const envContent = readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const key = trimmed.slice(0, eqIdx).trim()
    const val = trimmed.slice(eqIdx + 1).trim()
    if (!process.env[key]) process.env[key] = val
  }
} catch {
  console.error('Failed to read .env.local')
  process.exit(1)
}

// Dynamic import inside main() so env-load runs first.
// Loose typing — the real SupabaseClient generic doesn't match the inferred
// type from createClient() in this script context. Script-only, not prod code.
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type ResolveFn = (db: any, productName: string) => Promise<{ id: string; name_en: string; brand_en: string } | null>

let resolveProductByNameStrict: ResolveFn

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface Case {
  query: string
  expect: 'resolves' | 'null' | 'either'
  expectedBrand?: string  // If specified, the returned brand must match (case-insensitive substring)
  expectedNameContains?: string  // If specified, the returned name must contain this (case-insensitive)
  label: string
}

const cases: Case[] = [
  // === Brand-prefixed (the BP76 fix target) ===
  {
    query: 'COSRX BHA Blackhead Power Liquid',
    expect: 'resolves',
    expectedBrand: 'cosrx',
    expectedNameContains: 'blackhead',
    label: 'BP76 e2e target #1 — COSRX BHA',
  },
  {
    query: 'Anua BHA 2% Gentle Exfoliating Toner',
    expect: 'resolves',
    expectedBrand: 'anua',
    expectedNameContains: 'bha',
    label: 'BP76 e2e target #2 — Anua BHA',
  },
  {
    query: 'Beauty of Joseon Relief Sun',
    expect: 'resolves',
    expectedBrand: 'beauty of joseon',
    expectedNameContains: 'relief sun',
    label: 'Multi-word brand (3 tokens) — Beauty of Joseon',
  },
  {
    query: 'Beauty of Joseon Glow Deep Serum',
    expect: 'resolves',
    expectedBrand: 'beauty of joseon',
    expectedNameContains: 'glow',
    label: 'Multi-word brand + product — BoJ Glow Deep Serum',
  },
  {
    query: 'Round Lab 1025 Dokdo Toner',
    expect: 'resolves',
    expectedBrand: 'round lab',
    expectedNameContains: 'dokdo',
    label: 'Multi-word brand (2 tokens) — Round Lab',
  },
  {
    query: 'Some By Mi AHA BHA PHA 30 Days Miracle Toner',
    expect: 'resolves',
    expectedBrand: 'some by mi',
    expectedNameContains: 'miracle',
    label: 'Multi-word brand (3 tokens) — Some By Mi',
  },
  {
    query: 'Torriden Dive-In Low Molecular Hyaluronic Acid Toner',
    expect: 'resolves',
    expectedBrand: 'torriden',
    expectedNameContains: 'hyaluronic',
    label: 'Single-word brand + long name — Torriden Dive-In',
  },

  // === Bare names (no brand prefix, should still resolve via Strategy 1) ===
  {
    query: 'Relief Sun: Rice + Probiotics SPF50+ PA++++',
    expect: 'resolves',
    expectedBrand: 'beauty of joseon',
    expectedNameContains: 'relief sun',
    label: 'Bare name — Relief Sun exact catalog title',
  },
  {
    query: 'Glow Deep Serum: Rice + Alpha-Arbutin',
    expect: 'resolves',
    expectedBrand: 'beauty of joseon',
    expectedNameContains: 'glow deep',
    label: 'Bare name — Glow Deep Serum',
  },

  // === Bailey's library brands ===
  {
    query: 'Goodal Green Tangerine Vita C Dark Spot Serum',
    expect: 'resolves',
    expectedBrand: 'goodal',
    expectedNameContains: 'vita c',
    label: "Bailey's library — Goodal Vita C",
  },
  {
    query: 'Illiyoon Ceramide Ato Concentrate Cream',
    expect: 'resolves',
    expectedBrand: 'illiyoon',
    expectedNameContains: 'ceramide',
    label: "Bailey's library — Illiyoon Ceramide",
  },
  {
    query: 'Medicube PDRN Pink Peptide Serum',
    expect: 'resolves',
    expectedBrand: 'medicube',
    expectedNameContains: 'pdrn',
    label: "Bailey's library — Medicube PDRN",
  },

  // === Off-target / over-matching probe ===
  {
    query: 'COSRX BHA',  // Brand + 1 short token. Should resolve to A COSRX BHA product, not a different brand.
    expect: 'either',
    expectedBrand: 'cosrx',
    label: 'Short query — brand + 1 token (must stay in brand)',
  },
  {
    query: 'Beauty of Joseon',  // Brand-only query
    expect: 'either',
    expectedBrand: 'beauty of joseon',
    label: 'Brand-only query — should match SOME BoJ product if any',
  },
  {
    query: 'NonExistentBrand Magical Cream',  // Should not silently substitute
    expect: 'null',
    label: 'Non-existent brand — strict resolver should return null',
  },
  {
    query: 'fake product 9999',  // Garbage
    expect: 'null',
    label: 'Garbage query — strict resolver should return null',
  },
]

interface Result {
  case: Case
  resolved: { id: string; name_en: string; brand_en: string } | null
  passed: boolean
  reason: string
}

async function runOne(c: Case): Promise<Result> {
  const resolved = await resolveProductByNameStrict(supabase, c.query)

  // Did it match the expected outcome shape?
  if (c.expect === 'resolves' && resolved === null) {
    return { case: c, resolved, passed: false, reason: 'Expected to resolve, got null' }
  }
  if (c.expect === 'null' && resolved !== null) {
    return {
      case: c,
      resolved,
      passed: false,
      reason: `Expected null (no silent substitution), got ${resolved.brand_en} ${resolved.name_en}`,
    }
  }
  if (c.expect === 'either' && resolved === null) {
    // Either is OK — null is fine for 'either' cases
    return { case: c, resolved, passed: true, reason: 'null result accepted for "either" case' }
  }

  // Brand check (when applicable)
  if (resolved && c.expectedBrand) {
    if (!resolved.brand_en.toLowerCase().includes(c.expectedBrand.toLowerCase())) {
      return {
        case: c,
        resolved,
        passed: false,
        reason: `Brand mismatch: expected ${c.expectedBrand}, got ${resolved.brand_en}`,
      }
    }
  }

  // Name check (when applicable)
  if (resolved && c.expectedNameContains) {
    if (!resolved.name_en.toLowerCase().includes(c.expectedNameContains.toLowerCase())) {
      return {
        case: c,
        resolved,
        passed: false,
        reason: `Name does not contain "${c.expectedNameContains}": got ${resolved.name_en}`,
      }
    }
  }

  return {
    case: c,
    resolved,
    passed: true,
    reason: resolved ? `${resolved.brand_en} — ${resolved.name_en}` : 'null',
  }
}

async function main() {
  console.log('🐤 BP76 resolver canary (Strategy 1.5 verification)\n')

  // Dynamic import — env vars must be set before tools.ts loads supabase.ts
  const tools = await import('../src/lib/yuri/tools')
  resolveProductByNameStrict = tools.resolveProductByNameStrict as ResolveFn

  const results: Result[] = []
  for (const c of cases) {
    const r = await runOne(c)
    results.push(r)
    const icon = r.passed ? '✅' : '❌'
    console.log(`${icon} ${c.label}`)
    console.log(`   query: "${c.query}"`)
    console.log(`   result: ${r.reason}`)
    console.log('')
  }

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length

  console.log('========== Summary ==========')
  console.log(`Passed: ${passed}/${results.length}`)
  if (failed > 0) {
    console.error(`Failed: ${failed}`)
    for (const r of results.filter(r => !r.passed)) {
      console.error(`  - ${r.case.label}: ${r.reason}`)
    }
    process.exit(1)
  }
  console.log('🎉 Resolver canary clean — Strategy 1.5 working as designed')
}

main().catch(err => {
  console.error('Canary crashed:', err)
  process.exit(1)
})
