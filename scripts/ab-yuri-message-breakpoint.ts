/**
 * Warm A/B of the MESSAGES-level cache breakpoint (the turn-2 residual).
 *
 * Context: v11.3.0 fixed the SYSTEM block (composition no longer depends on the
 * user's message). A residual remained: `applyCacheControl` marks the assistant
 * message at `idx === msgs.length - 2`. On turn 1 the array is just [user], so
 * length-2 = -1 and NO marker is placed. Turn 2 is therefore the first turn with a
 * messages-level breakpoint, and it measured (live, conv 486b1962):
 *
 *   turn 2: raw_in 9, cache_READ 6,300 (tools only!), cache_WRITE 23,487 -> $0.153
 *
 * i.e. a 9-token message cost 15 cents. Turns 3+ were healthy (~$0.02).
 *
 * We do NOT ship a fix for this on reasoning (Principle 5 — the LGAAS cache saga:
 * three sound-sounding fixes, three cost INCREASES). We measure three layouts on the
 * real payload, warm, and let the numbers pick:
 *
 *   A "current"  — marker on assistant at msgs.length - 2 (today's behavior)
 *   B "none"     — no messages-level marker at all. Tools+system (~40K, the bulk)
 *                  are already cached by their own markers; history is small by
 *                  comparison. Removing a MOVING breakpoint may simply be better.
 *   C "last"     — marker on the LAST message every turn (a breakpoint that always
 *                  sits at the end of the prefix, so each turn extends the previous
 *                  turn's cached prefix instead of straddling it).
 *
 * Each arm replays the SAME real conversation turn-by-turn against the live API,
 * with the real system prompt, real tools, real history.
 *
 * Run: npx tsx scripts/ab-yuri-message-breakpoint.ts [conversationId]
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'
import { getAnthropicClient, MODELS } from '../src/lib/anthropic'
import { YURI_TOOLS } from '../src/lib/yuri/tools'
import { estimateCost } from '../src/lib/ai-config'
import { detectSpecialist } from '../src/lib/yuri/specialists'
import { loadUserContext } from '../src/lib/yuri/memory'
import { buildSystemPrompt } from '../src/lib/yuri/advisor'
import type { YuriMessage } from '../src/types/database'
import type Anthropic from '@anthropic-ai/sdk'

const USER_ID = '551569d3-aed0-4feb-a340-47bfb146a835' // Bailey
const CONV_ID = process.argv[2] || '7e3abe74-9355-4b66-a7dd-76786122961e'
const TURNS = 5

type Layout = 'current' | 'none' | 'last'

type TurnUsage = { turn: number; raw_in: number; rd: number; wr: number; out: number; cost: number }

/** The three candidate breakpoint layouts. */
function applyLayout(
  msgs: Anthropic.Messages.MessageParam[],
  layout: Layout
): Anthropic.Messages.MessageParam[] {
  if (layout === 'none') return msgs

  const markIdx =
    layout === 'current'
      ? msgs.length - 2 // today: the assistant message before the new user turn
      : msgs.length - 1 // 'last': always the final message (prefix keeps EXTENDING)

  return msgs.map((msg, idx) => {
    if (idx !== markIdx) return msg
    if (typeof msg.content !== 'string') return msg
    // 'current' only ever marked assistant messages; preserve that for a fair arm.
    if (layout === 'current' && msg.role !== 'assistant') return msg
    return {
      role: msg.role,
      content: [
        { type: 'text' as const, text: msg.content, cache_control: { type: 'ephemeral' as const } },
      ],
    } as Anthropic.Messages.MessageParam
  })
}

async function runArm(layout: Layout): Promise<TurnUsage[]> {
  const db = getServiceClient()
  const client = getAnthropicClient()

  const { data: msgs } = await db
    .from('ss_yuri_messages')
    .select('id, role, content, created_at, specialist_type, image_urls')
    .eq('conversation_id', CONV_ID)
    .order('created_at', { ascending: true })
  if (!msgs?.length) throw new Error('no messages')

  const cachedTools = YURI_TOOLS.map((t, i) =>
    i === YURI_TOOLS.length - 1
      ? { ...t, cache_control: { type: 'ephemeral' as const } }
      : t
  ) as Anthropic.Messages.Tool[]

  const results: TurnUsage[] = []
  let turn = 0

  for (let i = 0; i < msgs.length && turn < TURNS; i++) {
    const m = msgs[i] as unknown as { role: string; content: string }
    if (m.role !== 'user') continue
    turn++

    const history = msgs.slice(0, i) as unknown as YuriMessage[]
    const ctx = await loadUserContext(USER_ID, CONV_ID, {
      message: m.content,
      isFirstMessage: history.length === 0,
    })
    const { cachedPrompt, specialistBlock, clockBlock } = buildSystemPrompt(
      ctx,
      detectSpecialist(m.content),
      history
    )

    const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
      { type: 'text', text: cachedPrompt, cache_control: { type: 'ephemeral' } },
    ]
    if (specialistBlock) systemBlocks.push({ type: 'text', text: specialistBlock })
    if (clockBlock) systemBlocks.push({ type: 'text', text: clockBlock })

    const raw: Anthropic.Messages.MessageParam[] = [
      ...history.map((h) => ({
        role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: m.content },
    ]

    const res = await client.messages.create({
      model: MODELS.primary,
      max_tokens: 64,
      system: systemBlocks,
      messages: applyLayout(raw, layout),
      tools: cachedTools,
    })

    const u = res.usage
    const rd = u.cache_read_input_tokens ?? 0
    const wr = u.cache_creation_input_tokens ?? 0
    results.push({
      turn,
      raw_in: u.input_tokens,
      rd,
      wr,
      out: u.output_tokens,
      cost: estimateCost(MODELS.primary, u.input_tokens, u.output_tokens, rd, wr),
    })
  }
  return results
}

async function main() {
  const armEnv = process.env.YURI_BP_ARM as Layout | undefined
  if (armEnv) {
    process.stdout.write('@@JSON@@' + JSON.stringify(await runArm(armEnv)))
    return
  }

  const { execFileSync } = await import('child_process')
  const run = (layout: Layout): TurnUsage[] => {
    const stdout = execFileSync('npx', ['tsx', __filename, ...(process.argv[2] ? [process.argv[2]] : [])], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, YURI_BP_ARM: layout },
    })
    return JSON.parse(stdout.slice(stdout.indexOf('@@JSON@@') + 8))
  }

  const layouts: Layout[] = ['current', 'none', 'last']
  const out: Record<string, TurnUsage[]> = {}
  for (const l of layouts) {
    console.error(`running arm: ${l}...`)
    out[l] = run(l)
  }

  console.log(`\n${'='.repeat(74)}`)
  console.log(`MESSAGES-level cache breakpoint A/B — conv ${CONV_ID}`)
  console.log(`${MODELS.primary} · real system prompt · real tools · real history`)
  console.log('='.repeat(74))

  const summary: { layout: Layout; warmAvg: number; warmWrite: number; total: number }[] = []

  for (const l of layouts) {
    const rows = out[l]
    console.log(`\n--- arm: ${l}${l === 'current' ? '  (today)' : ''} ---`)
    console.log('turn |  raw_in | cache_READ | cache_WRITE |     cost')
    console.log('-----+---------+------------+-------------+---------')
    for (const r of rows) {
      console.log(
        `${String(r.turn).padStart(4)} | ${String(r.raw_in).padStart(7)} | ${String(r.rd).padStart(10)} | ` +
        `${String(r.wr).padStart(11)} | $${r.cost.toFixed(4)}`
      )
    }
    const warm = rows.slice(1)
    const warmAvg = warm.reduce((a, r) => a + r.cost, 0) / Math.max(1, warm.length)
    const warmWrite = warm.reduce((a, r) => a + r.wr, 0)
    const total = rows.reduce((a, r) => a + r.cost, 0)
    console.log(
      `      total $${total.toFixed(4)} | WARM (turns 2+) avg $${warmAvg.toFixed(4)}/turn, cache_write ${warmWrite}`
    )
    summary.push({ layout: l, warmAvg, warmWrite, total })
  }

  summary.sort((a, b) => a.warmAvg - b.warmAvg)
  const best = summary[0]
  const cur = summary.find((s) => s.layout === 'current')!

  console.log(`\n${'='.repeat(74)}\nVERDICT — ranked by warm cost/turn (turns 2+)\n${'='.repeat(74)}`)
  for (const s of summary) {
    const delta = s.layout === 'current' ? '' :
      ` (${(((s.warmAvg - cur.warmAvg) / cur.warmAvg) * 100).toFixed(1)}% vs current)`
    console.log(`  ${s.layout.padEnd(8)} $${s.warmAvg.toFixed(4)}/warm turn · cache_write ${String(s.warmWrite).padStart(7)}${delta}`)
  }
  console.log(
    `\n  WINNER: ${best.layout}` +
    (best.layout === 'current'
      ? ' — today\'s layout is already best. DO NOT CHANGE IT.\n'
      : ` — beats current by ${(((cur.warmAvg - best.warmAvg) / cur.warmAvg) * 100).toFixed(1)}% on warm turns.\n`)
  )
}

main().catch((e) => { console.error(e); process.exit(1) })
