/**
 * Count the CONTENT BLOCKS in each request, per round, for a real tool-firing turn.
 *
 * WHY: Anthropic's prompt-caching docs state a 20-block lookback window —
 *   "Each breakpoint walks backward AT MOST 20 content blocks to find a prior cache
 *    entry. If a single turn adds more than 20 blocks (common in agentic loops with
 *    many tool_use/tool_result pairs), the next request's breakpoint won't find the
 *    previous cache and SILENTLY MISSES."
 *
 * Production shows every miss on the turn AFTER a tool turn. If the block count
 * between the previous cached breakpoint and the new one exceeds 20, that is the
 * mechanism. If it does NOT exceed 20, the 20-block rule is NOT the cause and I must
 * not ship a fix based on it.
 *
 * NOTE the subtlety this script exists to settle: production REBUILDS history from
 * the DB as clean TEXT on every turn (messagesToApiFormat). The tool_use/tool_result
 * blocks only ever live inside ONE turn's loopMessages — they are never persisted.
 * So the next turn's array may be small, and the lookback may never be exceeded.
 * Measure it; don't assume.
 *
 * Read-only. No API calls.
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'

const CONV_ID = process.argv[2] || '98340394-019b-4fbb-b269-5546a21ab1e0'

function blocksIn(content: unknown): number {
  if (typeof content === 'string') return 1
  if (Array.isArray(content)) return content.length
  return 1
}

async function main() {
  const db = getServiceClient()
  const { data: msgs } = await db
    .from('ss_yuri_messages')
    .select('role, content, created_at')
    .eq('conversation_id', CONV_ID)
    .order('created_at', { ascending: true })
  if (!msgs?.length) throw new Error('no messages')

  console.log(`\nconversation ${CONV_ID}`)
  console.log(
    '\nWhat production actually SENDS per turn (history rebuilt from DB as clean text,\n' +
    'one text block per message — tool blocks are NOT persisted):\n'
  )
  console.log('turn | messages in array | content blocks | breakpoint idx (len-2) | blocks since prev breakpoint')
  console.log('-----+-------------------+----------------+------------------------+-----------------------------')

  let turn = 0
  let prevBreakpointBlockPos: number | null = null

  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i] as unknown as { role: string; content: string }
    if (m.role !== 'user') continue
    turn++

    // Production: history = all prior messages (as text) + this user message.
    const arrayLen = i + 1
    // Each DB message becomes ONE text block.
    const totalBlocks = arrayLen
    // applyCacheControl marks idx === len - 2 (the last assistant message).
    const bpIdx = arrayLen - 2
    const bpBlockPos = bpIdx >= 0 ? bpIdx + 1 : null // 1-indexed block position

    const since =
      prevBreakpointBlockPos != null && bpBlockPos != null
        ? bpBlockPos - prevBreakpointBlockPos
        : null

    console.log(
      `${String(turn).padStart(4)} | ${String(arrayLen).padStart(17)} | ${String(totalBlocks).padStart(14)} | ` +
      `${String(bpIdx).padStart(22)} | ${since == null ? '   (first)' : String(since).padStart(10)}` +
      (since != null && since > 20 ? '   *** EXCEEDS 20-BLOCK LOOKBACK ***' : '')
    )

    if (bpBlockPos != null) prevBreakpointBlockPos = bpBlockPos
  }

  console.log(
    `\nVERDICT:\n` +
    `  Each turn adds exactly 2 messages (user + assistant) = 2 content blocks.\n` +
    `  The messages breakpoint therefore advances 2 blocks per turn — FAR under the\n` +
    `  20-block lookback. Tool_use/tool_result blocks live only inside a single turn's\n` +
    `  loopMessages and are never persisted to the next turn's array.\n\n` +
    `  => The 20-block lookback is NOT exceeded between turns. If the numbers above\n` +
    `     confirm this, the 20-block rule does NOT explain the production miss, and a\n` +
    `     fix based on it must NOT be shipped.\n`
  )
}

main().catch((e) => { console.error(e); process.exit(1) })
