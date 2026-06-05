/**
 * Seoul Sister Guardian — Health Check CLI (READ-ONLY)
 * ====================================================
 * Thin CLI wrapper around the shared probe in src/lib/guardian/healthcheck.ts
 * (single source of truth — same logic the always-on watcher cron runs).
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/guardian-healthcheck.ts
 * Output: the HealthReport JSON on stdout. The /guardian-run agent reads it,
 * classifies findings into charter tiers, and acts/escalates accordingly.
 *
 * Writes NOTHING (charter Tier 3: monitoring reads only).
 */

import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { runHealthCheck } from '../src/lib/guardian/healthcheck'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

async function main() {
  const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)
  const report = await runHealthCheck(db)
  process.stdout.write(JSON.stringify(report, null, 2) + '\n')
  process.exit(report.overall === 'critical' ? 2 : 0)
}

main().catch((err) => {
  process.stdout.write(
    JSON.stringify({ generated_at: new Date().toISOString(), overall: 'critical', error: String(err), signals: [] }, null, 2) + '\n'
  )
  process.exit(1)
})
