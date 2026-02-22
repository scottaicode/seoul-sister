/**
 * Migration: Extend ss_content_posts for LGAAS content ingestion
 * Run: npx tsx --tsconfig tsconfig.json scripts/migrate-content-posts.ts
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

// Load .env.local manually (no dotenv dependency)
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

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!

if (!supabaseUrl || !serviceKey) {
  console.error('Missing env vars')
  process.exit(1)
}

const supabase = createClient(supabaseUrl, serviceKey)

async function run() {
  console.log('Running migration: extend_content_posts_for_lgaas\n')

  // First verify the table exists and check current columns
  const { data: testData, error: testError } = await supabase
    .from('ss_content_posts')
    .select('id')
    .limit(0)

  if (testError) {
    console.error('Cannot access ss_content_posts:', testError.message)
    process.exit(1)
  }
  console.log('Table ss_content_posts exists, checking if migration needed...\n')

  // Test if new columns already exist
  const { error: colError } = await supabase
    .from('ss_content_posts')
    .select('lgaas_post_id')
    .limit(0)

  if (!colError) {
    console.log('Columns already exist! Migration was already applied.')
    return
  }

  // The MCP and direct execute_sql are both read-only.
  // Output the SQL for manual execution in Supabase SQL Editor.
  console.log('=== Run this SQL in Supabase Dashboard > SQL Editor > New Query ===\n')

  const sql = `-- Migration: extend_content_posts_for_lgaas
-- Adds SEO fields, LGAAS dedup, tracking, and source attribution

ALTER TABLE ss_content_posts
  ADD COLUMN IF NOT EXISTS meta_description TEXT,
  ADD COLUMN IF NOT EXISTS excerpt TEXT,
  ADD COLUMN IF NOT EXISTS featured_image_url TEXT,
  ADD COLUMN IF NOT EXISTS primary_keyword TEXT,
  ADD COLUMN IF NOT EXISTS secondary_keywords TEXT[],
  ADD COLUMN IF NOT EXISTS faq_schema JSONB,
  ADD COLUMN IF NOT EXISTS read_time_minutes INTEGER,
  ADD COLUMN IF NOT EXISTS author TEXT DEFAULT 'Seoul Sister Team',
  ADD COLUMN IF NOT EXISTS view_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS lgaas_post_id UUID,
  ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Source check constraint
DO $$ BEGIN
  ALTER TABLE ss_content_posts ADD CONSTRAINT ss_content_posts_source_check
    CHECK (source IN ('lgaas', 'manual'));
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Dedup index for LGAAS webhook retries
CREATE UNIQUE INDEX IF NOT EXISTS idx_content_posts_lgaas_post_id
  ON ss_content_posts(lgaas_post_id) WHERE lgaas_post_id IS NOT NULL;

-- Blog listing query index
CREATE INDEX IF NOT EXISTS idx_content_posts_published_source
  ON ss_content_posts(published_at DESC, source) WHERE published_at IS NOT NULL;

-- updated_at trigger
DROP TRIGGER IF EXISTS set_content_posts_updated_at ON ss_content_posts;
CREATE TRIGGER set_content_posts_updated_at
  BEFORE UPDATE ON ss_content_posts FOR EACH ROW
  EXECUTE FUNCTION ss_set_updated_at();`

  console.log(sql)
  console.log('\n=== END SQL ===')
}

run().catch(e => { console.error(e); process.exit(1) })
