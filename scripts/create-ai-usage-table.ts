/**
 * Create ss_ai_usage table for AI cost tracking.
 * Run with: npx tsx --tsconfig tsconfig.json scripts/create-ai-usage-table.ts
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

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function main() {
  console.log('Creating ss_ai_usage table...')

  // Use raw SQL via rpc if available, otherwise try direct insert to test
  const { error } = await supabase.rpc('exec_sql', {
    sql: `
      CREATE TABLE IF NOT EXISTS ss_ai_usage (
        id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
        feature TEXT NOT NULL,
        model TEXT NOT NULL,
        tokens_in INTEGER NOT NULL DEFAULT 0,
        tokens_out INTEGER NOT NULL DEFAULT 0,
        cache_read_tokens INTEGER NOT NULL DEFAULT 0,
        cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
        cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
        user_id UUID REFERENCES auth.users(id),
        conversation_id UUID,
        cached BOOLEAN NOT NULL DEFAULT FALSE,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      );

      CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ss_ai_usage(feature, created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ss_ai_usage(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ss_ai_usage(user_id) WHERE user_id IS NOT NULL;

      ALTER TABLE ss_ai_usage ENABLE ROW LEVEL SECURITY;

      DO $$ BEGIN
        CREATE POLICY "Service role manages ai usage"
          ON ss_ai_usage FOR ALL
          USING ((select auth.role()) = 'service_role');
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;

      DO $$ BEGIN
        CREATE POLICY "Admins can read ai usage"
          ON ss_ai_usage FOR SELECT
          USING (EXISTS (
            SELECT 1 FROM ss_user_profiles WHERE user_id = (select auth.uid()) AND is_admin = true
          ));
      EXCEPTION WHEN duplicate_object THEN NULL;
      END $$;
    `
  })

  if (error) {
    // exec_sql RPC may not exist. Fall back to migration file instruction.
    console.log('RPC not available. Run this SQL manually in Supabase SQL Editor:')
    console.log(`
CREATE TABLE IF NOT EXISTS ss_ai_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature TEXT NOT NULL,
  model TEXT NOT NULL,
  tokens_in INTEGER NOT NULL DEFAULT 0,
  tokens_out INTEGER NOT NULL DEFAULT 0,
  cache_read_tokens INTEGER NOT NULL DEFAULT 0,
  cache_creation_tokens INTEGER NOT NULL DEFAULT 0,
  cost_usd DECIMAL(10,6) NOT NULL DEFAULT 0,
  user_id UUID REFERENCES auth.users(id),
  conversation_id UUID,
  cached BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ai_usage_feature ON ss_ai_usage(feature, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_date ON ss_ai_usage(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_usage_user ON ss_ai_usage(user_id) WHERE user_id IS NOT NULL;

ALTER TABLE ss_ai_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Service role manages ai usage"
  ON ss_ai_usage FOR ALL
  USING ((select auth.role()) = 'service_role');

CREATE POLICY "Admins can read ai usage"
  ON ss_ai_usage FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM ss_user_profiles WHERE user_id = (select auth.uid()) AND is_admin = true
  ));
    `)
  } else {
    console.log('Table created successfully!')
  }
}

main().catch(console.error)
