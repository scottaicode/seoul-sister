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
  const { data, error } = await sb
    .from('ss_product_staging')
    .update({ status: 'pending', error_message: null })
    .eq('status', 'failed')
    .select('id')
  const count = data ? data.length : 0
  console.log('Reset ' + count + ' failed rows back to pending. ' + (error ? error.message : 'OK'))
}

main().catch(e => console.error(e))
