#!/usr/bin/env tsx
/**
 * One-shot script: parse /tmp/seoul-sister-step5-backfill.log and emit
 * SQL INSERT statements to backfill the ss_enrichment_review_queue table
 * with the 111 SKIP entries + 1 FAIL entry from the May 7 1AM run.
 *
 * Output goes to scripts/review-queue-backfill.sql for human review before
 * pasting into Supabase Studio.
 *
 * Why a script vs hand-writing the SQL: 112 entries each need product_id
 * lookup, source_url, confidence, and reasoning text. Mechanical extraction
 * is faster and less error-prone than copy-paste.
 */
import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// Bootstrap env from .env.local (matches scripts/enrich-stub-products.ts pattern)
const __dir = typeof __dirname !== 'undefined' ? __dirname : path.dirname(fileURLToPath(import.meta.url))
const envPath = path.resolve(__dir, '..', '.env.local')
try {
  const envContent = fs.readFileSync(envPath, 'utf-8')
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#')) continue
    const eqIdx = trimmed.indexOf('=')
    if (eqIdx === -1) continue
    const k = trimmed.slice(0, eqIdx).trim()
    const v = trimmed.slice(eqIdx + 1).trim().replace(/^["']|["']$/g, '')
    if (!process.env[k]) process.env[k] = v
  }
} catch {
  // .env.local not found — assume env is already loaded
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const LOG_PATH = '/tmp/seoul-sister-step5-backfill.log'
const OUTPUT_PATH = path.join(__dirname, 'review-queue-backfill.sql')

interface QueueEntry {
  brand: string
  name: string
  source_url: string | null
  confidence: number | null
  reasoning: string | null
  status: 'skip' | 'fail'
  fail_reason: string | null
}

function parseLog(content: string): QueueEntry[] {
  const lines = content.split('\n')
  const entries: QueueEntry[] = []

  let current: Partial<QueueEntry> & { brand?: string; name?: string } | null = null

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]

    // Product header: "[N/685] Brand — Name (X stub links)"
    const headerMatch = line.match(/^\[(\d+)\/685\]\s+(.+?)\s+—\s+(.+?)\s+\(\d+\s+stub\s+links\)$/)
    if (headerMatch) {
      // Save previous entry if it was a SKIP or FAIL
      if (current && (current.status === 'skip' || current.status === 'fail')) {
        entries.push(current as QueueEntry)
      }
      current = {
        brand: headerMatch[2].trim(),
        name: headerMatch[3].trim(),
        source_url: null,
        confidence: null,
        reasoning: null,
        status: undefined,
        fail_reason: null,
      }
      continue
    }

    if (!current) continue

    // Source URL
    const sourceMatch = line.match(/^\s+Source:\s+(.+)$/)
    if (sourceMatch) {
      current.source_url = sourceMatch[1].trim()
      continue
    }

    // Top URL (fallback if Source not present)
    const topUrlMatch = line.match(/^\s+Top URL:\s+(.+)$/)
    if (topUrlMatch && !current.source_url) {
      current.source_url = topUrlMatch[1].trim()
      continue
    }

    // Confidence (Sonnet line)
    const confMatch = line.match(/^\s+Sonnet:\s+\d+\s+ingredients,\s+confidence\s+([\d.]+)/)
    if (confMatch) {
      current.confidence = parseFloat(confMatch[1])
      continue
    }

    // Reasoning
    const reasonMatch = line.match(/^\s+Reasoning:\s+(.+)$/)
    if (reasonMatch) {
      current.reasoning = reasonMatch[1].trim()
      continue
    }

    // SKIP marker (confidence too low)
    const skipMatch = line.match(/^\s+SKIP:\s+confidence too low\s+\(([\d.]+)\s+<\s+0\.7\)/)
    if (skipMatch) {
      current.status = 'skip'
      if (!current.confidence) current.confidence = parseFloat(skipMatch[1])
      continue
    }

    // SKIP marker (no authoritative URL — Brave returned no Incidecoder hit)
    const skipNoUrlMatch = line.match(/^\s+SKIP:\s+no authoritative URL/)
    if (skipNoUrlMatch) {
      current.status = 'skip'
      current.fail_reason = 'no authoritative URL among Brave results'
      // No confidence captured — leave as null
      continue
    }

    // FAIL marker
    const failMatch = line.match(/^\s+FAIL:\s+(.+)$/)
    if (failMatch) {
      current.status = 'fail'
      current.fail_reason = failMatch[1].trim()
      continue
    }

    // OK marker means this entry was successful — don't queue it
    if (line.match(/^\s+OK:/)) {
      current = null
      continue
    }
  }

  // Last entry
  if (current && (current.status === 'skip' || current.status === 'fail')) {
    entries.push(current as QueueEntry)
  }

  return entries
}

function escapeSql(s: string | null): string {
  if (s === null) return 'NULL'
  return `'${s.replace(/'/g, "''")}'`
}

async function main() {
  if (!fs.existsSync(LOG_PATH)) {
    console.error(`Log file not found: ${LOG_PATH}`)
    process.exit(1)
  }

  const content = fs.readFileSync(LOG_PATH, 'utf-8')
  const entries = parseLog(content)

  console.log(`Parsed ${entries.length} entries from log`)
  console.log(`  SKIP: ${entries.filter(e => e.status === 'skip').length}`)
  console.log(`  FAIL: ${entries.filter(e => e.status === 'fail').length}`)

  // Look up product_id for each entry
  let resolved = 0
  let unresolved: QueueEntry[] = []
  const sqlInserts: string[] = []

  for (const entry of entries) {
    const { data, error } = await supabase
      .from('ss_products')
      .select('id')
      .eq('brand_en', entry.brand)
      .eq('name_en', entry.name)
      .limit(2)

    if (error || !data || data.length === 0) {
      unresolved.push(entry)
      continue
    }
    if (data.length > 1) {
      console.warn(`Ambiguous match for "${entry.brand} - ${entry.name}" — ${data.length} products`)
      unresolved.push(entry)
      continue
    }

    const productId = data[0].id as string
    resolved++

    const reasoning = entry.fail_reason
      ? `[FAIL] ${entry.fail_reason}${entry.reasoning ? ' :: ' + entry.reasoning : ''}`
      : entry.reasoning

    sqlInserts.push(
      `INSERT INTO ss_enrichment_review_queue (product_id, source_url, confidence, reasoning, retry_count, status) VALUES (` +
        `'${productId}', ${escapeSql(entry.source_url)}, ${entry.confidence ?? 'NULL'}, ${escapeSql(reasoning)}, 0, 'pending'` +
        `);`
    )
  }

  console.log(`Resolved ${resolved} of ${entries.length} entries to product UUIDs`)
  if (unresolved.length > 0) {
    console.log(`Unresolved (${unresolved.length}):`)
    for (const u of unresolved) {
      console.log(`  - ${u.brand} — ${u.name}`)
    }
  }

  // Write SQL file
  const header = `-- ============================================================
-- Backfill: ss_enrichment_review_queue
-- Generated: ${new Date().toISOString()}
-- Source: /tmp/seoul-sister-step5-backfill.log (Phase 15.1 May 7 run)
-- Total entries: ${sqlInserts.length}
-- Run AFTER applying migration 20260507120001
-- ============================================================
BEGIN;

`
  const footer = `
COMMIT;

-- Verification
SELECT COUNT(*) AS total, status FROM ss_enrichment_review_queue GROUP BY status;
`
  fs.writeFileSync(OUTPUT_PATH, header + sqlInserts.join('\n') + footer)
  console.log(`\nSQL written to: ${OUTPUT_PATH}`)
}

main().catch(e => {
  console.error(e)
  process.exit(1)
})
