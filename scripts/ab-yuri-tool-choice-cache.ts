/**
 * Is a PER-TURN-VARYING `tool_choice` the cache invalidator?
 *
 * THE EVIDENCE (production, post-v11.3.0): all six system-block misses share ONE
 * trait — `raw_in` averages TWELVE tokens. The misses happen exclusively on tiny
 * conversational turns ("ok thanks", "sounds good"); not a single tool turn missed.
 * Each miss reads only 6,300 (the tools block) and REWRITES the ~24K system prompt.
 *
 * THE MECHANISM (advisor.ts:904):
 *
 *   const toolChoice = forceToolUse && toolLoopCount === 0 ? {type:'any'} : {type:'auto'}
 *
 * `shouldForceToolUse(message)` is a function of the USER'S MESSAGE. And `tool_choice`
 * is part of the cache prefix — it sits with `tools`, BEFORE the system block. So when
 * it flips 'any' <-> 'auto' between turns, the prefix changes at the tools boundary and
 * EVERYTHING AFTER IT — including the ~24K system block — invalidates.
 *
 * This is the SAME disease as the two invalidators v11.3.0 fixed, one layer earlier in
 * the prefix: a per-turn-variable input, derived from the user's message, sitting inside
 * the cached prefix.
 *
 * Every previous harness missed it because none of them set `tool_choice` at all.
 *
 * ARMS (identical in every other respect; each salted so it starts genuinely COLD):
 *   A "varying" — tool_choice flips per message, exactly as production does today
 *   B "fixed"   — tool_choice is always 'auto' (never varies)
 *
 * Success = arm B stops falling back to 6,300 on the cheap turns.
 *
 * Run: npx tsx scripts/ab-yuri-tool-choice-cache.ts
 */
import './load-env'
import { getAnthropicClient, MODELS } from '../src/lib/anthropic'
import { YURI_TOOLS } from '../src/lib/yuri/tools'
import { estimateCost } from '../src/lib/ai-config'
import { loadUserContext } from '../src/lib/yuri/memory'
import { buildSystemPrompt } from '../src/lib/yuri/advisor'
import { detectSpecialist } from '../src/lib/yuri/specialists'
import type Anthropic from '@anthropic-ai/sdk'

const USER_ID = '551569d3-aed0-4feb-a340-47bfb146a835'

// The exact production shape that produced the misses: a tool/product question
// (-> forceToolUse TRUE -> 'any'), then cheap chat (-> FALSE -> 'auto').
const SCRIPT = [
  "what's the price on the Anua Heartleaf toner right now?", // forceToolUse -> 'any'
  'ok thanks',                                                // -> 'auto'  *** MISS in prod
  'sounds good',                                              // -> 'auto'
  'what serum should I add?',                                 // -> 'any' again
  'got it',                                                   // -> 'auto'  *** MISS in prod
]

type Arm = 'varying' | 'fixed'
type Row = { turn: number; choice: string; forced: boolean; raw_in: number; rd: number; wr: number; cost: number }

async function runArm(arm: Arm, salt: string): Promise<Row[]> {
  const client = getAnthropicClient()
  const cachedTools = YURI_TOOLS.map((t, i) =>
    i === YURI_TOOLS.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t
  ) as Anthropic.Messages.Tool[]

  const transcript: Anthropic.Messages.MessageParam[] = []
  const rows: Row[] = []

  for (let i = 0; i < SCRIPT.length; i++) {
    const msg = SCRIPT[i]
    const ctx = await loadUserContext(USER_ID, undefined, {
      message: msg,
      isFirstMessage: transcript.length === 0,
    })
    const { cachedPrompt, specialistBlock, clockBlock } = buildSystemPrompt(ctx, detectSpecialist(msg), [])

    const sys: Anthropic.Messages.TextBlockParam[] = [
      { type: 'text', text: `<!-- ${salt} ${arm} -->\n` + cachedPrompt, cache_control: { type: 'ephemeral' } },
    ]
    if (specialistBlock) sys.push({ type: 'text', text: specialistBlock })
    if (clockBlock) sys.push({ type: 'text', text: clockBlock })

    // THE VARIABLE UNDER TEST.
    // Mirrors shouldForceToolUse() (kept local so we don't have to export prod internals).
    const forced = /price|cost|cheap|dupe|trending|popular|best|recommend|serum|moisturizer|toner|sunscreen|find me|search/i.test(msg)
    const toolChoice: Anthropic.Messages.MessageCreateParams['tool_choice'] =
      arm === 'varying'
        ? (forced ? { type: 'any' } : { type: 'auto' }) // production today
        : { type: 'auto' }                              // never varies

    // Non-streaming, single round: we are isolating tool_choice, nothing else.
    const res = await client.messages.create({
      model: MODELS.primary,
      max_tokens: 150,
      system: sys,
      messages: [...transcript, { role: 'user', content: msg }],
      tools: cachedTools,
      tool_choice: toolChoice,
    })

    const u = res.usage
    const rd = u.cache_read_input_tokens ?? 0
    const wr = u.cache_creation_input_tokens ?? 0
    rows.push({
      turn: i + 1,
      choice: toolChoice.type,
      forced,
      raw_in: u.input_tokens,
      rd, wr,
      cost: estimateCost(MODELS.primary, u.input_tokens, u.output_tokens, rd, wr),
    })

    const text = res.content.filter((c) => c.type === 'text').map((c) => (c as Anthropic.Messages.TextBlock).text).join('')
    // Keep the transcript clean text (as production rebuilds from the DB).
    transcript.push({ role: 'user', content: msg })
    transcript.push({ role: 'assistant', content: text || '(acknowledged)' })
  }
  return rows
}

async function main() {
  const arm = process.env.YURI_TC_ARM as Arm | undefined
  if (arm) {
    process.stdout.write('@@JSON@@' + JSON.stringify(await runArm(arm, process.env.YURI_TC_SALT || 'x')))
    return
  }

  const { execFileSync } = await import('child_process')
  const salt = `tc-${Date.now()}`
  const run = (a: Arm): Row[] => {
    const out = execFileSync('npx', ['tsx', __filename], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, YURI_TC_ARM: a, YURI_TC_SALT: salt },
    })
    return JSON.parse(out.slice(out.indexOf('@@JSON@@') + 8))
  }

  const res: Record<Arm, Row[]> = { varying: [], fixed: [] }
  // Run the FIXED (candidate) arm FIRST so it cannot win by going second on a warm cache.
  for (const a of ['fixed', 'varying'] as Arm[]) {
    console.error(`running arm: ${a} (cold, salted)...`)
    res[a] = run(a)
  }

  console.log(`\n${'='.repeat(88)}`)
  console.log('Does a per-turn-varying tool_choice invalidate the cached SYSTEM block?')
  console.log('='.repeat(88))

  for (const a of ['varying', 'fixed'] as Arm[]) {
    console.log(`\n--- arm: ${a}${a === 'varying' ? '   (production today)' : '   (tool_choice always auto)'} ---`)
    console.log('turn | forceTool | tool_choice |  raw_in | cache_READ | cache_WRITE |     cost')
    console.log('-----+-----------+-------------+---------+------------+-------------+---------')
    for (const r of res[a]) {
      const miss = r.rd > 0 && r.rd < 10000 ? '  <-- SYSTEM MISS' : ''
      console.log(
        `${String(r.turn).padStart(4)} | ${String(r.forced).padEnd(9)} | ${r.choice.padEnd(11)} | ` +
        `${String(r.raw_in).padStart(7)} | ${String(r.rd).padStart(10)} | ${String(r.wr).padStart(11)} | ` +
        `$${r.cost.toFixed(4)}${miss}`
      )
    }
    const warm = res[a].slice(1)
    const misses = warm.filter((r) => r.rd > 0 && r.rd < 10000).length
    console.log(
      `      WARM(2+) avg $${(warm.reduce((s, r) => s + r.cost, 0) / Math.max(1, warm.length)).toFixed(4)}/turn` +
      `   warm cache_write ${warm.reduce((s, r) => s + r.wr, 0)}   WARM MISSES ${misses}`
    )
  }

  const warmMiss = (a: Arm) => res[a].slice(1).filter((r) => r.rd > 0 && r.rd < 10000).length
  const warmCost = (a: Arm) => res[a].slice(1).reduce((s, r) => s + r.cost, 0) / Math.max(1, res[a].length - 1)

  console.log(`\n${'='.repeat(88)}\nVERDICT (warm turns 2+ — the ones production is bleeding on)\n${'='.repeat(88)}`)
  console.log(`  varying (today)  $${warmCost('varying').toFixed(4)}/turn · misses ${warmMiss('varying')}`)
  console.log(`  fixed            $${warmCost('fixed').toFixed(4)}/turn · misses ${warmMiss('fixed')}`)
  const win = warmMiss('fixed') < warmMiss('varying') && warmCost('fixed') < warmCost('varying')
  console.log(
    win
      ? `\n  *** CONFIRMED: per-turn tool_choice IS the invalidator. ***\n` +
        `      fixing it cuts warm cost ${(((warmCost('varying') - warmCost('fixed')) / warmCost('varying')) * 100).toFixed(1)}%\n`
      : '\n  NOT CONFIRMED — tool_choice is not the difference. Do not ship a change.\n'
  )
}

main().catch((e) => { console.error(e); process.exit(1) })
