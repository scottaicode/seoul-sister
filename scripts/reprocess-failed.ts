/**
 * Reprocess the single failed staging row (GA260136975).
 * Resets it to 'pending' and runs the batch processor on it.
 */
import { createClient } from '@supabase/supabase-js'
import { processBatch } from '../src/lib/pipeline/batch-processor'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('=== Reprocessing Failed Staging Rows ===\n')

  // Check current failed rows
  const { data: failedRows } = await supabase
    .from('ss_product_staging')
    .select('id, source_id, error_message')
    .eq('status', 'failed')

  if (!failedRows || failedRows.length === 0) {
    console.log('No failed staging rows found.')
    process.exit(0)
  }

  console.log(`Found ${failedRows.length} failed row(s):`)
  for (const row of failedRows) {
    console.log(`  - ${row.source_id}: ${row.error_message?.slice(0, 80)}...`)
  }

  // Reset failed rows to pending
  const ids = failedRows.map((r) => r.id)
  const { error: resetErr } = await supabase
    .from('ss_product_staging')
    .update({ status: 'pending', error_message: null })
    .in('id', ids)

  if (resetErr) {
    console.error('Reset error:', resetErr)
    process.exit(1)
  }
  console.log(`\nReset ${ids.length} row(s) to pending.`)

  // Run the batch processor
  console.log('Running batch processor...\n')
  const result = await processBatch(supabase, ids.length)

  console.log('Result:', {
    processed: result.processed,
    failed: result.failed,
    duplicates: result.duplicates,
    remaining: result.remaining,
    cost: result.cost,
  })

  // Check final status
  const { data: after } = await supabase
    .from('ss_product_staging')
    .select('source_id, status, error_message, processed_product_id')
    .in('id', ids)

  console.log('\nFinal status:')
  for (const row of after || []) {
    console.log(`  ${row.source_id}: ${row.status}${row.error_message ? ` — ${row.error_message.slice(0, 100)}` : ''}${row.processed_product_id ? ` → product ${row.processed_product_id}` : ''}`)
  }

  console.log('\n=== Done ===')
  process.exit(0)
}

main().catch((err) => {
  console.error('Fatal error:', err)
  process.exit(1)
})
