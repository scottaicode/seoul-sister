/**
 * Backfill decision_memory for existing Yuri conversations.
 *
 * Origin: A merge bug in mergeDecisionMemory (memory.ts) caused every
 * extractAndSaveDecisionMemory call to throw `TypeError: base.decisions is
 * not iterable` when the existing decision_memory was the schema default
 * `{}`. The fire-and-forget .catch(() => {}) in advisor.ts:838 silently
 * swallowed the error. Three months of decision memory data lost
 * (Feb 23 - May 5 2026, Phase 13.3 ship date through fix date).
 *
 * v10.3.4 fixed the merge function. This script runs the production
 * extractAndSaveDecisionMemory against every existing Yuri conversation
 * with at least 4 messages so the decision memory layer is populated for
 * conversations that pre-date the fix.
 *
 * Cost estimate (Sonnet 4.5):
 *   ~30 conversations * ~6,000 input tokens * $3/M = ~$0.54 input
 *   ~30 conversations * ~800 output tokens * $15/M = ~$0.36 output
 *   Total: ~$1 for full backfill
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/backfill-decision-memory.ts
 *   npx tsx --tsconfig tsconfig.json scripts/backfill-decision-memory.ts --dry-run
 *   npx tsx --tsconfig tsconfig.json scripts/backfill-decision-memory.ts --force
 *
 * Default: skip conversations that already have non-empty decision_memory
 * --force: re-run extraction even on populated conversations
 * --dry-run: show what would run, do not call Sonnet
 */

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

const dryRun = process.argv.includes('--dry-run')
const force = process.argv.includes('--force')

async function main() {
  const { extractAndSaveDecisionMemory } = await import('../src/lib/yuri/memory.js')
  const { createClient } = await import('@supabase/supabase-js')

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: conversations, error } = await supabase
    .from('ss_yuri_conversations')
    .select('id, user_id, title, message_count, decision_memory, created_at')
    .gte('message_count', 4)
    .order('created_at', { ascending: true })

  if (error) throw error
  if (!conversations?.length) {
    console.log('No conversations to backfill')
    return
  }

  const targets = force
    ? conversations
    : conversations.filter(c => !c.decision_memory || JSON.stringify(c.decision_memory) === '{}')

  console.log(`${conversations.length} conversations >= 4 messages`)
  console.log(`${targets.length} need backfill (force=${force})`)
  if (dryRun) {
    console.log('\n--dry-run set, exiting')
    for (const c of targets) {
      console.log(`  ${c.id} | ${c.title || '(untitled)'} | ${c.message_count} messages`)
    }
    return
  }

  let success = 0
  let skipped = 0
  let failed = 0

  for (const c of targets) {
    process.stdout.write(`${c.id.slice(0, 8)} (${c.message_count} msgs) ${c.title?.slice(0, 50) || '(untitled)'}... `)

    const { data: messages, error: msgErr } = await supabase
      .from('ss_yuri_messages')
      .select('role, content, created_at')
      .eq('conversation_id', c.id)
      .order('created_at')

    if (msgErr || !messages?.length) {
      console.log('no messages, skipping')
      skipped++
      continue
    }

    try {
      await extractAndSaveDecisionMemory(
        c.user_id,
        c.id,
        messages.map(m => ({ role: m.role, content: m.content }))
      )

      const { data: post } = await supabase
        .from('ss_yuri_conversations')
        .select('decision_memory')
        .eq('id', c.id)
        .single()

      const dm = post?.decision_memory as { decisions?: unknown[]; preferences?: unknown[]; commitments?: unknown[]; corrections?: unknown[] } | null
      const dCount = dm?.decisions?.length ?? 0
      const pCount = dm?.preferences?.length ?? 0
      const cCount = dm?.commitments?.length ?? 0
      const xCount = dm?.corrections?.length ?? 0

      if (dCount + pCount + cCount + xCount === 0) {
        console.log('(empty extraction, no action needed)')
        skipped++
      } else {
        console.log(`d:${dCount} p:${pCount} c:${cCount} x:${xCount}`)
        success++
      }
    } catch (err) {
      console.log(`FAILED: ${err instanceof Error ? err.message : String(err)}`)
      failed++
    }

    // Throttle: 500ms between Sonnet calls to be kind to the API
    await new Promise(r => setTimeout(r, 500))
  }

  console.log(`\nDone: ${success} populated, ${skipped} empty/skipped, ${failed} failed`)
}

main().catch(err => {
  console.error('UNCAUGHT:', err)
  process.exit(1)
})
