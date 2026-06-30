import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

// Migration helper: add a nullable `source` column to ss_widget_sessions so we
// can attribute each anonymous Yuri conversation to the feeder page that drove
// it (blog/product/ingredient/nav/...).
//
// Per this repo's convention (see migrate-content-posts.ts), the Supabase MCP
// and service client are read-only for DDL, so this script DETECTS whether the
// column exists and, if not, prints the one line of SQL for Scott to run in the
// Supabase Dashboard > SQL Editor. The app code is written to tolerate the
// column being absent (the insert simply omits it until it exists).

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

async function main() {
  const db = createClient(get('NEXT_PUBLIC_SUPABASE_URL')!, get('SUPABASE_SERVICE_ROLE_KEY')!)

  const { error } = await db.from('ss_widget_sessions').select('source').limit(1)

  if (!error) {
    console.log('✓ ss_widget_sessions.source already exists. Nothing to do.')
    return
  }

  console.log('Column ss_widget_sessions.source is MISSING.\n')
  console.log('=== Run this in Supabase Dashboard > SQL Editor > New Query ===\n')
  console.log('ALTER TABLE ss_widget_sessions ADD COLUMN IF NOT EXISTS source TEXT;')
  console.log('\n=== END SQL ===')
  console.log('\nThe app code is already deployed and tolerates the column being')
  console.log('absent; once you run the SQL above, feeder attribution starts')
  console.log('populating automatically on new conversations.')
}

main().then(() => process.exit(0))
