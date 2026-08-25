/**
 * One-time cleanup: remove the diagnostic widget visitor row created during the
 * Aug 25 2026 "is the widget still capturing?" check.
 *
 * Context: to tell "no traffic" apart from "traffic not being recorded", a real
 * message was sent to the production widget with visitor_id 'zz-diag-check-0824'.
 * It proved capture works (a row appeared immediately), but the row is synthetic
 * and would inflate the Aug 25 visitor/message counts by one.
 *
 * Scoped STRICTLY to that one visitor_id — never a date range, so re-running is
 * a no-op once the row is gone and it can never touch a real visitor.
 *
 * Usage:
 *   Dry run (default):
 *     npx tsx --tsconfig tsconfig.json scripts/cleanup-diag-visitor.ts
 *   Execute:
 *     npx tsx --tsconfig tsconfig.json scripts/cleanup-diag-visitor.ts --apply
 */
import { createClient } from '@supabase/supabase-js'

const TARGET = 'zz-diag-check-0824'
const apply = process.argv.includes('--apply')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Children first, parent last — child tables key on the TEXT visitor_id.
const CHILD_TABLES = [
  'ss_widget_intent_signals',
  'ss_widget_messages',
  'ss_widget_sessions',
] as const

async function main() {
  console.log(`Target visitor_id: ${TARGET}`)
  console.log(apply ? 'MODE: APPLY (will delete)\n' : 'MODE: DRY RUN (no writes)\n')

  // Blast radius first: show exactly what matches before touching anything.
  let total = 0
  for (const table of [...CHILD_TABLES, 'ss_widget_visitors']) {
    const { count, error } = await supabase
      .from(table)
      .select('*', { count: 'exact', head: true })
      .eq('visitor_id', TARGET)
    if (error) throw new Error(`[${table}] count failed: ${error.message}`)
    console.log(`  ${table}: ${count ?? 0} row(s)`)
    total += count ?? 0
  }

  if (total === 0) {
    console.log('\nNothing to delete — already clean.')
    return
  }
  if (!apply) {
    console.log('\nDry run complete. Re-run with --apply to delete.')
    return
  }

  console.log('')
  for (const table of CHILD_TABLES) {
    const { error } = await supabase.from(table).delete().eq('visitor_id', TARGET)
    if (error) throw new Error(`[${table}] delete failed: ${error.message}`)
    console.log(`  deleted from ${table}`)
  }
  const { error } = await supabase.from('ss_widget_visitors').delete().eq('visitor_id', TARGET)
  if (error) throw new Error(`[ss_widget_visitors] delete failed: ${error.message}`)
  console.log('  deleted from ss_widget_visitors')

  // Verify: re-count rather than trusting the delete reported success.
  let remaining = 0
  for (const table of [...CHILD_TABLES, 'ss_widget_visitors']) {
    const { count, error: e } = await supabase
      .from(table).select('*', { count: 'exact', head: true }).eq('visitor_id', TARGET)
    if (e) throw new Error(`[${table}] verify failed: ${e.message}`)
    remaining += count ?? 0
  }
  console.log(remaining === 0 ? '\nVerified: 0 rows remain.' : `\nWARNING: ${remaining} row(s) still present.`)
}

main().catch((err) => { console.error(err); process.exit(1) })
