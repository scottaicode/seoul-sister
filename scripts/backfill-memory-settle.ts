/**
 * Backfill: settle every conversation whose summary / decision memory is missing
 * or older than its last message (see src/lib/intelligence/memory-settle.ts).
 *
 * DRY RUN BY DEFAULT: computes the new summary and merged decision memory with
 * the real extractors and writes NOTHING. --apply writes through the same
 * functions the advisor uses.
 *
 * Usage:
 *   npx tsx --tsconfig tsconfig.json scripts/backfill-memory-settle.ts [outDir] [--users a,b] [--limit N] [--all] [--apply]
 *
 * Default scope: each user's 3 most recent conversations, or any with a message
 * in the last 60 days. --all widens to every conversation (re-opens old threads).
 *
 * Prints counts (unsettled, missing summary, stale summary) and, per
 * conversation, open loops before → after and which were resolved.
 */
import './load-env'
import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { getServiceClient } from '../src/lib/supabase'
import { findUnsettled, settleConversation, settleUserDry, settleStateMigrated } from '../src/lib/intelligence/memory-settle'

function arg(name: string): string[] {
  const i = process.argv.indexOf(name)
  return i > -1 && process.argv[i + 1] ? process.argv[i + 1].split(',').filter(Boolean) : []
}

async function main() {
  const apply = process.argv.includes('--apply')
  const outDir = process.argv[2] && !process.argv[2].startsWith('--') ? process.argv[2] : null
  const users = arg('--users')
  const limit = Number(arg('--limit')[0] ?? '1000')
  const db = getServiceClient()
  if (apply && !(await settleStateMigrated(db))) {
    // --apply without the settle state + activity-only updated_at trigger would
    // bump every old conversation to "most recent" and could not record progress.
    throw new Error('migration 20261010000001/20261010000002 missing: apply both before --apply (dry run works without them)')
  }

  const scope = process.argv.includes('--all') ? 'all' : 'recent'
  const pending = await findUnsettled(db, { userIds: users.length ? users : undefined, scope })
  const missing = pending.filter((c) => !c.hasSummary).length
  console.log(
    `${apply ? 'APPLY' : 'DRY RUN'} (scope ${scope}${scope === 'recent' ? ': 3 most recent conversations per user or active in 60 days; --all widens' : ''}): ${pending.length} unsettled conversations (${missing} with no summary, ${pending.length - missing} with a summary older than their last message)`
  )

  const { data: profiles, error } = await db.from('ss_user_profiles').select('user_id, timezone')
  if (error) throw new Error(`profile load: ${error.message}`)
  const tz = new Map((profiles ?? []).map((p) => [p.user_id as string, (p.timezone as string | null) ?? null]))

  // Per user, oldest → newest, so a later conversation can resolve a loop an earlier one opened.
  const byUser = new Map<string, typeof pending>()
  for (const c of pending.slice(0, limit)) byUser.set(c.userId, [...(byUser.get(c.userId) ?? []), c])
  const meta = new Map(pending.map((c) => [c.id, c]))

  const proposals: Array<Record<string, unknown>> = []
  for (const [userId, convs] of byUser) {
    const results = apply
      ? await (async () => {
          const out = []
          for (const c of convs) out.push(await settleConversation(db, c, { timezone: tz.get(userId) ?? null }))
          return out
        })()
      : await settleUserDry(db, userId, convs, tz.get(userId) ?? null)
    for (const p of results) {
      const c = meta.get(p.conversationId)
      proposals.push({ ...p, conversationType: c?.conversationType ?? null, lastMessageAt: c?.lastMessageAt ?? null, summaryGeneratedAt: c?.summaryGeneratedAt ?? null, settled: !!c })
      console.log(
        `- ${p.conversationId.slice(0, 8)} user ${userId.slice(0, 8)} ${c ? `${c.conversationType ?? ''} last ${c.lastMessageAt.slice(0, 16)} summary ${c.summaryGeneratedAt?.slice(0, 16) ?? 'none'}` : '(not settled; a later conversation resolved its loops)'} | loops ${JSON.stringify(p.openLoopsBefore)} -> ${apply ? '(applied)' : JSON.stringify(p.openLoopsAfter)} resolved ${JSON.stringify(p.resolvedOpenLoops)}${p.errors.length ? ` ERRORS ${p.errors.join('; ')}` : ''}`
      )
    }
  }
  if (outDir) {
    mkdirSync(outDir, { recursive: true })
    writeFileSync(join(outDir, 'memory-settle-proposals.json'), JSON.stringify(proposals, null, 2))
  }
  const failed = proposals.filter((p) => (p.errors as string[]).length).length
  console.log(`${proposals.length} processed, ${failed} with errors${apply ? '' : ' (nothing written)'}`)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
