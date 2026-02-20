import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dir = typeof __dirname !== 'undefined' ? __dirname : dirname(fileURLToPath(import.meta.url))
const envContent = readFileSync(resolve(__dir, '..', '.env.local'), 'utf-8')
const env: Record<string, string> = {}
for (const line of envContent.split('\n')) {
  const trimmed = line.trim()
  if (!trimmed || trimmed.startsWith('#')) continue
  const eqIdx = trimmed.indexOf('=')
  if (eqIdx === -1) continue
  env[trimmed.slice(0, eqIdx).trim()] = trimmed.slice(eqIdx + 1).trim()
}

const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY)

async function main() {
  // Reset stuck processing rows
  const { data, error } = await sb
    .from('ss_product_staging')
    .update({ status: 'pending' })
    .eq('status', 'processing')
    .select('id')
  const resetCount = data ? data.length : 0
  const errMsg = error ? error.message : 'OK'
  console.log('Reset ' + resetCount + ' rows from processing->pending: ' + errMsg)

  // Check what failures look like
  const { data: failures } = await sb
    .from('ss_product_staging')
    .select('error_message, raw_data')
    .eq('status', 'failed')
    .limit(5)

  if (failures) {
    console.log('\nSample failures:')
    for (const f of failures) {
      const rd = f.raw_data as Record<string, unknown>
      const name = rd && rd.name_en ? String(rd.name_en).substring(0, 60) : 'unknown'
      const errText = f.error_message ? String(f.error_message).substring(0, 150) : 'no error msg'
      console.log('  ' + name + ':\n    ' + errText)
    }
  }

  // Status summary
  const { count: pendingCount } = await sb.from('ss_product_staging').select('id', { count: 'exact', head: true }).eq('status', 'pending')
  const { count: processedCount } = await sb.from('ss_product_staging').select('id', { count: 'exact', head: true }).eq('status', 'processed')
  const { count: failedCount } = await sb.from('ss_product_staging').select('id', { count: 'exact', head: true }).eq('status', 'failed')
  const { count: dupesCount } = await sb.from('ss_product_staging').select('id', { count: 'exact', head: true }).eq('status', 'duplicate')

  console.log('\nStatus summary:')
  console.log('  pending:   ' + pendingCount)
  console.log('  processed: ' + processedCount)
  console.log('  failed:    ' + failedCount)
  console.log('  duplicate: ' + dupesCount)
  console.log('  total:     ' + ((pendingCount || 0) + (processedCount || 0) + (failedCount || 0) + (dupesCount || 0)))
}

main().catch(e => console.error(e))
