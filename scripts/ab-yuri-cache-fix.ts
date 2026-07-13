/**
 * WARM A/B of the Yuri prompt-cache volatile-composition fix, on the REAL payload.
 *
 * Principle 5 ("Measure the Mechanism, Not the Aggregate"): three consecutive LGAAS
 * cache "fixes" each shipped on locally-sound reasoning and each RAISED cost. The one
 * that worked was A/B'd first. So we do not ship this on reasoning either.
 *
 * Method — deliberately NOT a synthetic benchmark:
 *   - Replay a REAL Bailey conversation, turn by turn, through the REAL production
 *     prompt assembly (loadUserContext -> buildSystemPrompt -> same system blocks,
 *     same YURI_TOOLS with the same cache_control markers, same model).
 *   - Run each arm as its own child process (the flags are module-level consts,
 *     frozen at import — an in-process env flip does NOT re-evaluate them).
 *   - Read the REAL usage numbers back from the API response.
 *
 * What success looks like (from the blueprint):
 *   - cache_creation_tokens -> ~0 on turns 2+ (write once, read thereafter)
 *   - cache_read_tokens     -> large and roughly constant
 *   - cost/turn back to the ~$0.006-0.02 Jun 5-9 baseline
 *
 * Costs real money (Opus). Sends no user-visible output and writes NOTHING to the DB.
 * max_tokens is small: we are measuring INPUT-side cache behavior, not generation.
 *
 * Run:  npx tsx scripts/ab-yuri-cache-fix.ts [conversationId]
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'
import { getAnthropicClient, MODELS } from '../src/lib/anthropic'
import { YURI_TOOLS } from '../src/lib/yuri/tools'
import { estimateCost } from '../src/lib/ai-config'
import { detectSpecialist } from '../src/lib/yuri/specialists'
import type { YuriMessage } from '../src/types/database'
import type Anthropic from '@anthropic-ai/sdk'

const USER_ID = '551569d3-aed0-4feb-a340-47bfb146a835' // Bailey
const CONV_ID = process.argv[2] || '7e3abe74-9355-4b66-a7dd-76786122961e'
const TURNS = 5

type TurnUsage = {
  turn: number
  raw_in: number
  cache_read: number
  cache_write: number
  out: number
  cost: number
}

async function runArm(): Promise<TurnUsage[]> {
  const db = getServiceClient()
  const memory = await import('../src/lib/yuri/memory')
  const advisor = await import('../src/lib/yuri/advisor')
  const client = getAnthropicClient()

  const { data: msgs } = await db
    .from('ss_yuri_messages')
    .select('id, role, content, created_at, specialist_type, image_urls')
    .eq('conversation_id', CONV_ID)
    .order('created_at', { ascending: true })
  if (!msgs?.length) throw new Error('no messages')

  // Same tool cache marker as production (cache_control on the LAST tool def).
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
    const ctx = await memory.loadUserContext(USER_ID, CONV_ID, {
      message: m.content,
      isFirstMessage: history.length === 0,
    })
    const { cachedPrompt, specialistBlock, clockBlock } = advisor.buildSystemPrompt(
      ctx,
      detectSpecialist(m.content),
      history
    )

    // EXACTLY the production system-block shape.
    const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
      { type: 'text', text: cachedPrompt, cache_control: { type: 'ephemeral' } },
    ]
    if (specialistBlock) systemBlocks.push({ type: 'text', text: specialistBlock })
    if (clockBlock) systemBlocks.push({ type: 'text', text: clockBlock })

    // Real history + the real user message.
    const apiMessages: Anthropic.Messages.MessageParam[] = [
      ...history.map((h) => ({
        role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: h.content,
      })),
      { role: 'user' as const, content: m.content },
    ]

    const res = await client.messages.create({
      model: MODELS.primary,
      max_tokens: 64, // measuring INPUT cache behavior, not generation
      system: systemBlocks,
      messages: apiMessages,
      tools: cachedTools,
    })

    const u = res.usage
    const raw_in = u.input_tokens
    const cache_read = u.cache_read_input_tokens ?? 0
    const cache_write = u.cache_creation_input_tokens ?? 0
    const out = u.output_tokens
    results.push({
      turn,
      raw_in,
      cache_read,
      cache_write,
      out,
      cost: estimateCost(MODELS.primary, raw_in, out, cache_read, cache_write),
    })
  }
  return results
}

async function main() {
  if (process.env.YURI_AB_ARM === '1') {
    const r = await runArm()
    process.stdout.write('@@JSON@@' + JSON.stringify(r))
    return
  }

  const { execFileSync } = await import('child_process')
  const run = (enabled: boolean): TurnUsage[] => {
    const stdout = execFileSync('npx', ['tsx', __filename, ...(process.argv[2] ? [process.argv[2]] : [])], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: {
        ...process.env,
        YURI_AB_ARM: '1',
        YURI_VOLATILE_SPLIT_ENABLED: enabled ? 'true' : 'false',
      },
    })
    return JSON.parse(stdout.slice(stdout.indexOf('@@JSON@@') + 8))
  }

  const fmt = (rows: TurnUsage[], label: string) => {
    console.log(`\n--- ${label} ---`)
    console.log('turn |  raw_in | cache_READ | cache_WRITE |  out |     cost')
    console.log('-----+---------+------------+-------------+------+---------')
    for (const r of rows) {
      console.log(
        `${String(r.turn).padStart(4)} | ${String(r.raw_in).padStart(7)} | ` +
        `${String(r.cache_read).padStart(10)} | ${String(r.cache_write).padStart(11)} | ` +
        `${String(r.out).padStart(4)} | $${r.cost.toFixed(4)}`
      )
    }
    const warm = rows.slice(1)
    const total = rows.reduce((a, r) => a + r.cost, 0)
    const warmCost = warm.reduce((a, r) => a + r.cost, 0)
    const warmWrite = warm.reduce((a, r) => a + r.cache_write, 0)
    console.log(
      `      total $${total.toFixed(4)}  |  WARM turns (2+): $${warmCost.toFixed(4)} ` +
      `(avg $${(warmCost / Math.max(1, warm.length)).toFixed(4)}/turn), ` +
      `cache_write ${warmWrite}`
    )
    return { total, warmCost, warmAvg: warmCost / Math.max(1, warm.length), warmWrite }
  }

  // Run OFF first, then ON. Each arm's first turn writes the cache; turns 2+ are warm.
  console.error('running arm OFF (today\'s behavior)...')
  const off = run(false)
  console.error('running arm ON (the fix)...')
  const on = run(true)

  console.log(`\n${'='.repeat(72)}`)
  console.log(`WARM A/B — Yuri prompt cache — conversation ${CONV_ID}`)
  console.log(`model ${MODELS.primary} · real prompt · real tools · real history`)
  console.log('='.repeat(72))
  const sOff = fmt(off, 'ARM OFF — YURI_VOLATILE_SPLIT_ENABLED=false (today)')
  const sOn = fmt(on, 'ARM ON  — YURI_VOLATILE_SPLIT_ENABLED=true  (the fix)')

  const pct = (a: number, b: number) => (a === 0 ? 0 : ((b - a) / a) * 100)
  console.log(`\n${'='.repeat(72)}\nVERDICT (warm turns 2+ — the ones that matter)\n${'='.repeat(72)}`)
  console.log(`  cost/turn   OFF $${sOff.warmAvg.toFixed(4)}  ->  ON $${sOn.warmAvg.toFixed(4)}   ` +
    `(${pct(sOff.warmAvg, sOn.warmAvg).toFixed(1)}%)`)
  console.log(`  cache_write OFF ${sOff.warmWrite}  ->  ON ${sOn.warmWrite}   ` +
    `(${pct(sOff.warmWrite, sOn.warmWrite).toFixed(1)}%)`)
  const better = sOn.warmAvg < sOff.warmAvg
  console.log(
    `\n  ${better ? 'SHIP' : 'DO NOT SHIP'} — warm cost/turn is ` +
    `${better ? 'LOWER' : 'NOT lower'} with the fix on.\n`
  )
}

main().catch((e) => { console.error(e); process.exit(1) })
