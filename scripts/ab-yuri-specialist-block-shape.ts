/**
 * Does an UNMARKED trailing system block change the cached-prefix identity?
 *
 * THE OBSERVATION (live, reproduced twice): turn 1 fires a tool and routes to a
 * specialist; turn 2 ("ok thanks", 9 tokens) reads only 6,300 (tools block) and
 * REWRITES ~23K of system prompt — $0.15 for nine tokens.
 *
 * `cachedPrompt` is byte-identical between the two turns (verified: same sha256).
 * The ONLY difference in the request is the SHAPE of the `system` array:
 *
 *   turn 1: [ cachedPrompt(cache_control), specialistBlock, clockBlock ]   3 blocks
 *   turn 2: [ cachedPrompt(cache_control),                  clockBlock ]   2 blocks
 *
 * v11.3.0 moved specialistBlock OUT of the cached body to keep it byte-stable. That
 * worked. But it introduced a block that APPEARS AND DISAPPEARS between turns — and
 * the question this script answers is whether the cached-prefix identity depends on
 * the blocks that FOLLOW the breakpoint.
 *
 * If it does, the v11.3.0 specialist split is itself the remaining invalidator, and
 * the fix is to make the specialist block ALWAYS PRESENT (empty-string placeholder,
 * or fold it back and accept its churn) rather than conditionally present.
 *
 * ARMS (each: warm the cache with a specialist-routed turn, then a plain turn):
 *   A "today"    — specialist block present on turn 1, ABSENT on turn 2
 *   B "always"   — a specialist-slot block ALWAYS present (placeholder when unrouted)
 *
 * Success = arm B's turn 2 reads the full ~40K instead of falling back to 6,300.
 *
 * Run: npx tsx scripts/ab-yuri-specialist-block-shape.ts
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

// Turn 1 routes to a specialist (routine/ingredient keywords). Turn 2 does not.
// This is the exact live shape that produced the $0.15 nine-token message.
const SCRIPT = [
  'what ingredient should I layer under my retinol in my PM routine?', // -> specialist
  'ok thanks',                                                          // -> no specialist
  'sounds good',                                                        // -> no specialist
]

type Arm = 'today' | 'always'
type Row = { turn: number; spec: string; blocks: number; raw_in: number; rd: number; wr: number; cost: number }

async function runArm(arm: Arm): Promise<Row[]> {
  const client = getAnthropicClient()
  const cachedTools = YURI_TOOLS.map((t, i) =>
    i === YURI_TOOLS.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t
  ) as Anthropic.Messages.Tool[]

  const transcript: Anthropic.Messages.MessageParam[] = []
  const rows: Row[] = []

  for (let i = 0; i < SCRIPT.length; i++) {
    const msg = SCRIPT[i]
    const spec = detectSpecialist(msg)
    const ctx = await loadUserContext(USER_ID, undefined, {
      message: msg,
      isFirstMessage: transcript.length === 0,
    })
    const { cachedPrompt, specialistBlock, clockBlock } = buildSystemPrompt(ctx, spec, [])

    // CRITICAL for a fair A/B: both arms build the SAME cachedPrompt, so whichever
    // arm runs first WARMS THE CACHE FOR THE OTHER — and the second arm then looks
    // artificially good (or the miss simply vanishes). Prefix each arm's cached block
    // with a unique, run-scoped salt so each arm starts genuinely COLD and the two
    // never share a cache entry. The salt is a comment line: it does not change what
    // Yuri is told, and it is identical across all turns WITHIN an arm (so it cannot
    // itself invalidate anything).
    const salt = `<!-- ab-run ${process.env.YURI_SB_SALT ?? 'x'} arm=${arm} -->\n`

    const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
      { type: 'text', text: salt + cachedPrompt, cache_control: { type: 'ephemeral' } },
    ]

    if (arm === 'today') {
      // Reproduce the PRE-FIX behavior: drop the block when no specialist is routed,
      // so it VANISHES between turns. (buildSystemPrompt now always returns a slot,
      // so we strip the placeholder here to recreate the bug.)
      const isPlaceholder = specialistBlock.includes('# ACTIVE SPECIALIST: none')
      if (specialistBlock && !isPlaceholder) {
        systemBlocks.push({ type: 'text', text: specialistBlock })
      }
    } else {
      // The SHIPPED behavior: buildSystemPrompt always returns a specialist slot
      // (real body when routed, factual placeholder when not), so the system-array
      // SHAPE is identical on every turn.
      if (specialistBlock) systemBlocks.push({ type: 'text', text: specialistBlock })
    }
    systemBlocks.push({ type: 'text', text: clockBlock })

    const res = await client.messages.create({
      model: MODELS.primary,
      max_tokens: 200,
      system: systemBlocks,
      messages: [...transcript, { role: 'user', content: msg }],
      tools: cachedTools,
    })

    const u = res.usage
    const rd = u.cache_read_input_tokens ?? 0
    const wr = u.cache_creation_input_tokens ?? 0
    rows.push({
      turn: i + 1,
      spec: spec ?? 'none',
      blocks: systemBlocks.length,
      raw_in: u.input_tokens,
      rd, wr,
      cost: estimateCost(MODELS.primary, u.input_tokens, u.output_tokens, rd, wr),
    })

    const text = res.content.filter((c) => c.type === 'text').map((c) => (c as Anthropic.Messages.TextBlock).text).join('')
    transcript.push({ role: 'user', content: msg })
    transcript.push({ role: 'assistant', content: text || '(ok)' })
  }
  return rows
}

async function main() {
  const arm = process.env.YURI_SB_ARM as Arm | undefined
  if (arm) {
    process.stdout.write('@@JSON@@' + JSON.stringify(await runArm(arm)))
    return
  }

  const { execFileSync } = await import('child_process')
  // One salt per ARM so each arm's cached prefix is unique and starts genuinely COLD
  // (otherwise arm #1 warms the cache for arm #2 and the comparison is meaningless —
  // Principle 5: "confirm the two arms differ ONLY in the variable named").
  const stamp = Date.now()
  const run = (a: Arm): Row[] => {
    const out = execFileSync('npx', ['tsx', __filename], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, YURI_SB_ARM: a, YURI_SB_SALT: `${stamp}` },
    })
    return JSON.parse(out.slice(out.indexOf('@@JSON@@') + 8))
  }

  // Run the FIXED arm first, so the buggy arm cannot be blamed on going second.
  const res: Record<Arm, Row[]> = { today: [], always: [] }
  for (const a of ['always', 'today'] as Arm[]) {
    console.error(`running arm: ${a} (cold, salted)...`)
    res[a] = run(a)
  }

  console.log(`\n${'='.repeat(84)}`)
  console.log('Does a VANISHING unmarked system block invalidate the cached prefix before it?')
  console.log('='.repeat(84))

  for (const a of ['today', 'always'] as Arm[]) {
    console.log(`\n--- arm: ${a}${a === 'today' ? '  (v11.3.0: specialist block appears/disappears)' : '  (specialist slot ALWAYS present)'} ---`)
    console.log('turn | specialist        | sys blocks |  raw_in | cache_READ | cache_WRITE |     cost')
    console.log('-----+-------------------+------------+---------+------------+-------------+---------')
    for (const r of res[a]) {
      const miss = r.rd > 0 && r.rd < 10000 ? '  <-- SYSTEM MISS' : ''
      console.log(
        `${String(r.turn).padStart(4)} | ${r.spec.padEnd(17)} | ${String(r.blocks).padStart(10)} | ` +
        `${String(r.raw_in).padStart(7)} | ${String(r.rd).padStart(10)} | ${String(r.wr).padStart(11)} | $${r.cost.toFixed(4)}${miss}`
      )
    }
    const tot = res[a].reduce((s, r) => s + r.cost, 0)
    const misses = res[a].filter((r) => r.rd > 0 && r.rd < 10000).length
    console.log(`      TOTAL $${tot.toFixed(4)}   system-block MISSES: ${misses}`)
  }

  const tT = res.today.reduce((s, r) => s + r.cost, 0)
  const aT = res.always.reduce((s, r) => s + r.cost, 0)
  const tM = res.today.filter((r) => r.rd > 0 && r.rd < 10000).length
  const aM = res.always.filter((r) => r.rd > 0 && r.rd < 10000).length

  console.log(`\n${'='.repeat(84)}\nVERDICT\n${'='.repeat(84)}`)
  console.log(`  cost    today $${tT.toFixed(4)}  ->  always $${aT.toFixed(4)}  (${(((aT - tT) / tT) * 100).toFixed(1)}%)`)
  console.log(`  misses  today ${tM}            ->  always ${aM}`)
  console.log(
    aM < tM && aT < tT
      ? '\n  CONFIRMED: the vanishing block WAS the invalidator. Keep the slot always present.\n'
      : aM === tM && tM === 0
        ? '\n  INCONCLUSIVE — neither arm missed here. The repro needs the real route (tools + streaming).\n'
        : '\n  NOT CONFIRMED — do not ship this.\n'
  )
}

main().catch((e) => { console.error(e); process.exit(1) })
