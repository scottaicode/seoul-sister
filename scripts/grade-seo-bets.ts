/**
 * Run the SEO bet grader against the real backlog.
 *
 * Dry run (default — reads live data, writes NOTHING):
 *   npx tsx scripts/grade-seo-bets.ts
 * Apply (writes grades + graded_at onto ss_seo_reports):
 *   npx tsx scripts/grade-seo-bets.ts --apply
 *
 * A dry run performs the same live page fetches the cron does, so the execution
 * verdicts printed here are the ones the cron will record.
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { runBetGrader } from '../src/lib/seo/grade-bets'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const url = get('NEXT_PUBLIC_SUPABASE_URL')
const key = get('SUPABASE_SERVICE_ROLE_KEY')
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const APPLY = process.argv.includes('--apply')
const db = createClient(url, key)

// In dry-run mode, intercept writes so the grading path runs identically but
// nothing is persisted.
const realFrom = db.from.bind(db)
if (!APPLY) {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ;(db as any).from = (table: string) => {
    const q = realFrom(table)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(q as any).update = () => ({
      eq: async () => {
        console.log(`   [dry-run] would write grades to ${table}`)
        return { error: null }
      },
    })
    return q
  }
}

async function main() {
  console.log(`\nSEO bet grader — ${APPLY ? 'APPLY (writing)' : 'DRY RUN (no writes)'}\n`)
  const result = await runBetGrader(db)

  if (result.status === 'failed') {
    console.error(`FAILED: ${result.error}`)
    process.exit(1)
  }

  console.log(`\n${'='.repeat(72)}`)
  console.log(`Bets examined: ${result.betsExamined}`)
  console.log(`Newly graded : ${result.gradedNow}`)
  console.log(`Summary      : ${result.summary}`)
  console.log('='.repeat(72))

  const { data } = await db
    .from('ss_seo_reports')
    .select('created_at, bets, grades')
    .eq('status', 'completed')
    .order('created_at', { ascending: true })

  console.log('\nPer-bet detail (from this run):\n')
  for (const r of data ?? []) {
    const grades = (r.grades ?? {}) as Record<string, Record<string, unknown>>
    for (const b of (r.bets ?? []) as Array<Record<string, unknown>>) {
      const g = grades[b.id as string]
      if (!g) continue
      console.log(`  [${String(r.created_at).slice(0, 10)}] ${b.id}`)
      console.log(`     verdict   : ${g.verdict}${g.powered ? ` (p=${g.p_value})` : ''}`)
      console.log(`     execution : ${g.execution_status} — ${g.execution_evidence}`)
      console.log(`     clicks    : ${g.baseline_clicks} -> ${g.after_clicks}  gap=${g.gap_days}d`)
      console.log(`     notes     : ${g.notes}`)
      console.log('')
    }
  }
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
