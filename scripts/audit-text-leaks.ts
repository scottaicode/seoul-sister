/**
 * READ-ONLY audit: scan user-facing TEXT columns for internal/debug/developer artifacts
 * that leaked into fields a subscriber or visitor can read.
 *
 * Usage: npx tsx --tsconfig tsconfig.json scripts/audit-text-leaks.ts
 *
 * Does NOT write/update/delete anything.
 */
import { createClient, SupabaseClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const db: SupabaseClient = createClient(
  get('NEXT_PUBLIC_SUPABASE_URL')!,
  get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } }
)

// Dev-artifact patterns. Each has a label so we can report WHAT matched.
// Kept conservative to limit false positives on legitimate skincare copy.
const PATTERNS: Array<{ label: string; re: RegExp }> = [
  { label: 'version-ref', re: /\bv(?:8|9|10)\.\d+(?:\.\d+)?\b/i },
  { label: 'dev-phase', re: /\bphase\s+\d+(?:\.\d+)?\b/i },
  { label: 'resolver', re: /\bresolver\b/i },
  { label: 'glitch', re: /\bglitch\b/i },
  { label: 'debug', re: /\bdebug\b/i },
  { label: 'destashed-via', re: /\bdestashed via\b/i },
  { label: 'migration', re: /\bmigration\b/i },
  { label: 'backfill', re: /\bbackfill\b/i },
  { label: 'TODO/FIXME', re: /\b(?:TODO|FIXME|XXX)\b/ },
  { label: 'placeholder', re: /\bplaceholder\b/i },
  { label: 'stub', re: /\bstub\b/i },
  { label: 'repurposed-from', re: /\brepurposed from\b/i },
  { label: 'not-in-product-db', re: /\bnot in (?:our )?product db\b/i },
  { label: 'custom-entry', re: /\bcustom entry\b/i },
  { label: 'do-not', re: /\bDO NOT\b/ },
  { label: 'internal', re: /\binternal\b/i },
  { label: 'bracket-note', re: /\[[^\]]{8,}\]/ }, // bracketed editorial note >= 8 chars inside
  { label: 'sonnet', re: /\bsonnet\b/i },
  { label: 'claude', re: /\bclaude\b/i },
  { label: 'extraction', re: /\bextraction\b/i },
  { label: 'prompt', re: /\bprompt\b/i },
  { label: 'confidence', re: /\bconfidence\b/i },
  { label: 'match-quality', re: /\bmatch[_ ]quality\b/i },
  { label: 'cleanup-via', re: /\bcleanup\b/i },
]

interface Hit {
  table: string
  column: string
  rowId: string
  matched: string[]
  text: string
}

const allHits: Hit[] = []
const cleanCols: string[] = []
const skipped: string[] = []

function scan(value: unknown): string[] {
  if (value == null) return []
  const s = typeof value === 'string' ? value : JSON.stringify(value)
  if (!s) return []
  const labels: string[] = []
  for (const p of PATTERNS) {
    if (p.re.test(s)) labels.push(p.label)
  }
  return labels
}

function trunc(s: string, n = 120): string {
  s = s.replace(/\s+/g, ' ').trim()
  return s.length > n ? s.slice(0, n) + '…' : s
}

/**
 * Audit a table: select id + the given columns, scan each column for patterns.
 * idCol defaults to 'id'. If the select errors (missing column/table), record as skipped.
 */
async function auditTable(
  table: string,
  columns: string[],
  idCol = 'id'
): Promise<void> {
  const selectCols = Array.from(new Set([idCol, ...columns])).join(',')
  const { data, error } = await db.from(table).select(selectCols).limit(10000)
  if (error) {
    skipped.push(`${table} (${error.message})`)
    return
  }
  const rows = (data ?? []) as unknown as Array<Record<string, unknown>>
  for (const col of columns) {
    let colHits = 0
    for (const row of rows) {
      const labels = scan(row[col])
      if (labels.length) {
        colHits++
        const raw = typeof row[col] === 'string' ? (row[col] as string) : JSON.stringify(row[col])
        allHits.push({
          table,
          column: col,
          rowId: String(row[idCol] ?? '(no-id)'),
          matched: labels,
          text: trunc(raw),
        })
      }
    }
    if (colHits === 0) cleanCols.push(`${table}.${col} (${rows.length} rows scanned)`)
  }
}

async function discoverColumns(table: string): Promise<string[]> {
  const { data, error } = await db.from(table).select('*').limit(1)
  if (error) return []
  const row = (data?.[0] ?? {}) as Record<string, unknown>
  return Object.keys(row)
}

async function main() {
  console.log('=== READ-ONLY TEXT-LEAK AUDIT ===\n')

  // Discover columns for a couple tables where the spec was unsure
  for (const t of ['ss_reviews', 'ss_content_posts', 'ss_ingredients', 'ss_trending_products', 'ss_glass_skin_scores']) {
    const cols = await discoverColumns(t)
    console.log(`columns(${t}): ${cols.length ? cols.join(', ') : '(table empty or missing)'}`)
  }
  console.log('')

  // ---- The audits (user-facing text columns) ----
  await auditTable('ss_user_products', ['notes', 'custom_name', 'custom_brand'])
  await auditTable('ss_routine_products', ['notes'])
  await auditTable('ss_products', ['description_en', 'name_en', 'subcategory'])
  await auditTable('ss_treatment_phases', ['name', 'goal', 'protocol', 'decisions', 'watch_for', 'outcomes'])
  await auditTable('ss_glass_skin_scores', ['recommendations', 'analysis_notes'])
  await auditTable('ss_yuri_conversations', ['title', 'decision_memory'])
  await auditTable('ss_reviews', ['review_text', 'title', 'content'])
  await auditTable('ss_content_posts', ['title', 'body', 'content', 'excerpt'])
  await auditTable('ss_trending_products', ['source_product_name', 'source_product_brand', 'trend_name', 'change_summary'])
  await auditTable('ss_ingredients', ['name_en', 'description', 'description_en'])

  // ---- REPORT ----
  console.log('\n========== RESULTS ==========\n')

  // Severity buckets
  const P0_SURFACES = new Set([
    'ss_products.description_en',
    'ss_products.name_en',
    'ss_products.subcategory',
    'ss_user_products.notes',
    'ss_user_products.custom_name',
    'ss_user_products.custom_brand',
    'ss_content_posts.body',
    'ss_content_posts.content',
    'ss_content_posts.title',
    'ss_content_posts.excerpt',
    'ss_reviews.review_text',
    'ss_reviews.title',
    'ss_reviews.content',
    'ss_ingredients.name_en',
    'ss_ingredients.description',
    'ss_ingredients.description_en',
  ])
  const P1_SURFACES = new Set([
    'ss_routine_products.notes',
    'ss_glass_skin_scores.recommendations',
    'ss_glass_skin_scores.analysis_notes',
    'ss_yuri_conversations.title',
    'ss_treatment_phases.name',
    'ss_treatment_phases.goal',
    'ss_trending_products.source_product_name',
    'ss_trending_products.source_product_brand',
    'ss_trending_products.trend_name',
    'ss_trending_products.change_summary',
  ])
  // everything else (JSONB internals) => P2

  function sev(h: Hit): 'P0' | 'P1' | 'P2' {
    const key = `${h.table}.${h.column}`
    if (P0_SURFACES.has(key)) return 'P0'
    if (P1_SURFACES.has(key)) return 'P1'
    return 'P2'
  }

  const buckets: Record<string, Hit[]> = { P0: [], P1: [], P2: [] }
  for (const h of allHits) buckets[sev(h)].push(h)

  for (const b of ['P0', 'P1', 'P2'] as const) {
    console.log(`\n----- ${b} (${buckets[b].length} rows) -----`)
    if (buckets[b].length === 0) {
      console.log('  (none)')
      continue
    }
    for (const h of buckets[b]) {
      console.log(`  [${h.table}.${h.column}] id=${h.rowId}`)
      console.log(`     matched: ${h.matched.join(', ')}`)
      console.log(`     text: "${h.text}"`)
    }
  }

  // per-column counts
  console.log('\n----- AFFECTED ROW COUNTS BY TABLE.COLUMN -----')
  const counts: Record<string, number> = {}
  for (const h of allHits) {
    const k = `${h.table}.${h.column}`
    counts[k] = (counts[k] ?? 0) + 1
  }
  for (const [k, n] of Object.entries(counts).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${k}: ${n}`)
  }

  console.log('\n----- CLEAN COLUMNS -----')
  for (const c of cleanCols) console.log(`  ✓ ${c}`)

  if (skipped.length) {
    console.log('\n----- SKIPPED (column/table missing) -----')
    for (const s of skipped) console.log(`  - ${s}`)
  }

  console.log(`\n=== TOTAL LEAK ROWS: ${allHits.length} ===`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
