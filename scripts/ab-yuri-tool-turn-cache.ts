/**
 * Warm A/B of the TOOL-TURN cache breakpoint bug (the real turn-N spike).
 *
 * THE OBSERVATION (live, conv 98340394, 10 real turns): four turns showed
 * `cache_read = 6,300` — the TOOLS block ONLY, meaning the ~40K system block missed
 * entirely — and rewrote ~24K, costing ~$0.15-0.18 EACH, for messages of 9-19 input
 * tokens. The earlier breakpoint A/B could not reproduce this because it replayed
 * history as clean text and NEVER FIRED A TOOL.
 *
 * THE HYPOTHESIS (to be measured, not assumed): on a tool-using turn, the tool loop
 * pushes tool_use / tool_result blocks into loopMessages (advisor.ts ~1059/1090).
 * applyCacheControl then re-runs on that mutated array, where `msgs.length - 2` now
 * points at the assistant TOOL_USE message — whose .content is an ARRAY, so the
 * `typeof msg.content === 'string'` guard SILENTLY SKIPS IT. That round therefore
 * writes its cache entry with NO messages-level breakpoint. The next turn places a
 * marker at a string assistant message — a DIFFERENT prefix boundary — so it can't
 * match, and falls back to the shortest common prefix: the tools block (6,300).
 *
 * This harness runs a REAL tool-firing conversation (it actually executes the tool
 * loop, so tool_use/tool_result blocks really enter the array) under two layouts:
 *
 *   A "current" — the string-only guard (today). Marker silently vanishes on tool rounds.
 *   B "robust"  — marker placed on the last message REGARDLESS of content shape, so a
 *                 breakpoint always exists at a stable end-of-prefix position.
 *
 * Success = the turn AFTER a tool turn stops falling back to 6,300.
 *
 * Costs real Opus tokens (it genuinely calls tools). Writes NOTHING to the DB.
 *
 * Run: npx tsx scripts/ab-yuri-tool-turn-cache.ts
 */
import './load-env'
import { getAnthropicClient, MODELS } from '../src/lib/anthropic'
import { YURI_TOOLS, executeYuriTool } from '../src/lib/yuri/tools'
import { estimateCost } from '../src/lib/ai-config'
import { loadUserContext } from '../src/lib/yuri/memory'
import { buildSystemPrompt } from '../src/lib/yuri/advisor'
import type Anthropic from '@anthropic-ai/sdk'

const USER_ID = '551569d3-aed0-4feb-a340-47bfb146a835' // Bailey

// A conversation shaped like the live one that exposed the bug: tool-firing turns
// followed by cheap conversational turns (which is where the 6,300 fallback showed up).
const SCRIPT = [
  "what's the price on the Anua Heartleaf toner right now?", // fires a tool
  'ok thanks',                                                // <- the victim turn
  'why that one over the others?',                            // <- and this one
  "what's trending in Korea right now?",                      // fires a tool
  'sounds good',                                              // <- victim again
]

type Layout = 'current' | 'robust'
type TurnUsage = { turn: number; msg: string; tools: number; raw_in: number; rd: number; wr: number; cost: number }

/** Today's helper, verbatim (advisor.ts): string-content assistant at len-2. */
function applyCurrent(msgs: Anthropic.Messages.MessageParam[]): Anthropic.Messages.MessageParam[] {
  return msgs.map((msg, idx) => {
    if (msg.role === 'assistant' && typeof msg.content === 'string' && idx === msgs.length - 2) {
      return {
        role: 'assistant' as const,
        content: [{ type: 'text' as const, text: msg.content, cache_control: { type: 'ephemeral' as const } }],
      }
    }
    return msg
  })
}

/**
 * Robust: always put a breakpoint at the END of the prefix, whatever the block shape.
 * For array content, mark the LAST content block (that's where the prefix ends).
 */
function applyRobust(msgs: Anthropic.Messages.MessageParam[]): Anthropic.Messages.MessageParam[] {
  if (msgs.length === 0) return msgs
  const markIdx = msgs.length - 1
  return msgs.map((msg, idx) => {
    if (idx !== markIdx) return msg
    if (typeof msg.content === 'string') {
      return {
        role: msg.role,
        content: [{ type: 'text' as const, text: msg.content, cache_control: { type: 'ephemeral' as const } }],
      } as Anthropic.Messages.MessageParam
    }
    const blocks = [...(msg.content as Anthropic.Messages.ContentBlockParam[])]
    if (blocks.length === 0) return msg
    blocks[blocks.length - 1] = {
      ...(blocks[blocks.length - 1] as object),
      cache_control: { type: 'ephemeral' as const },
    } as Anthropic.Messages.ContentBlockParam
    return { role: msg.role, content: blocks } as Anthropic.Messages.MessageParam
  })
}

async function runArm(layout: Layout): Promise<TurnUsage[]> {
  const client = getAnthropicClient()
  const apply = layout === 'current' ? applyCurrent : applyRobust

  const cachedTools = YURI_TOOLS.map((t, i) =>
    i === YURI_TOOLS.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t
  ) as Anthropic.Messages.Tool[]

  // Persistent transcript (plain text) — mirrors what production rebuilds from the DB.
  const transcript: Anthropic.Messages.MessageParam[] = []
  const results: TurnUsage[] = []

  for (let t = 0; t < SCRIPT.length; t++) {
    const userMsg = SCRIPT[t]
    const ctx = await loadUserContext(USER_ID, undefined, {
      message: userMsg,
      isFirstMessage: transcript.length === 0,
    })
    const { cachedPrompt, specialistBlock, clockBlock } = buildSystemPrompt(ctx, null, [])
    const systemBlocks: Anthropic.Messages.TextBlockParam[] = [
      { type: 'text', text: cachedPrompt, cache_control: { type: 'ephemeral' } },
    ]
    if (specialistBlock) systemBlocks.push({ type: 'text', text: specialistBlock })
    if (clockBlock) systemBlocks.push({ type: 'text', text: clockBlock })

    // The live tool loop, exactly as production runs it.
    const loopMessages: Anthropic.Messages.MessageParam[] = [
      ...transcript,
      { role: 'user', content: userMsg },
    ]

    let raw_in = 0, rd = 0, wr = 0, out = 0, toolsFired = 0
    let finalText = ''

    for (let round = 0; round < 4; round++) {
      const res = await client.messages.create({
        model: MODELS.primary,
        max_tokens: 700,
        system: systemBlocks,
        messages: apply(loopMessages),
        tools: cachedTools,
      })
      const u = res.usage
      raw_in += u.input_tokens
      rd += u.cache_read_input_tokens ?? 0
      wr += u.cache_creation_input_tokens ?? 0
      out += u.output_tokens

      const toolUses = res.content.filter((c) => c.type === 'tool_use') as Anthropic.Messages.ToolUseBlock[]
      const text = res.content.filter((c) => c.type === 'text').map((c) => (c as Anthropic.Messages.TextBlock).text).join('')

      if (toolUses.length === 0) { finalText = text; break }

      // Mutate loopMessages EXACTLY like production does.
      toolsFired += toolUses.length
      loopMessages.push({
        role: 'assistant',
        content: toolUses.map((tu) => ({ type: 'tool_use' as const, id: tu.id, name: tu.name, input: tu.input as Record<string, unknown> })),
      })
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        const r = await executeYuriTool(tu.name, tu.input as Record<string, unknown>, USER_ID)
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(r).slice(0, 8000) })
      }
      loopMessages.push({ role: 'user', content: toolResults })
    }

    results.push({
      turn: t + 1,
      msg: userMsg.slice(0, 34),
      tools: toolsFired,
      raw_in, rd, wr,
      cost: estimateCost(MODELS.primary, raw_in, out, rd, wr),
    })

    // Persist as CLEAN TEXT — production rebuilds history from the DB, not from loopMessages.
    transcript.push({ role: 'user', content: userMsg })
    transcript.push({ role: 'assistant', content: finalText || '(ok)' })
  }
  return results
}

async function main() {
  const arm = process.env.YURI_TT_ARM as Layout | undefined
  if (arm) {
    process.stdout.write('@@JSON@@' + JSON.stringify(await runArm(arm)))
    return
  }

  const { execFileSync } = await import('child_process')
  const run = (l: Layout): TurnUsage[] => {
    const stdout = execFileSync('npx', ['tsx', __filename], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, YURI_TT_ARM: l },
    })
    return JSON.parse(stdout.slice(stdout.indexOf('@@JSON@@') + 8))
  }

  const out: Record<Layout, TurnUsage[]> = { current: [], robust: [] }
  for (const l of ['current', 'robust'] as Layout[]) {
    console.error(`running arm: ${l} (fires real tools)...`)
    out[l] = run(l)
  }

  console.log(`\n${'='.repeat(80)}`)
  console.log('TOOL-TURN cache A/B — does the turn AFTER a tool turn fall back to 6,300?')
  console.log('='.repeat(80))

  for (const l of ['current', 'robust'] as Layout[]) {
    console.log(`\n--- arm: ${l}${l === 'current' ? '  (today)' : '  (marker survives tool blocks)'} ---`)
    console.log('turn | tools |  raw_in | cache_READ | cache_WRITE |     cost | message')
    console.log('-----+-------+---------+------------+-------------+----------+--------')
    for (const r of out[l]) {
      const miss = r.rd > 0 && r.rd < 10000 ? '  <-- SYSTEM CACHE MISS' : ''
      console.log(
        `${String(r.turn).padStart(4)} | ${String(r.tools).padStart(5)} | ${String(r.raw_in).padStart(7)} | ` +
        `${String(r.rd).padStart(10)} | ${String(r.wr).padStart(11)} | $${r.cost.toFixed(4)} | ${r.msg}${miss}`
      )
    }
    const warm = out[l].slice(1)
    const tot = out[l].reduce((a, r) => a + r.cost, 0)
    const misses = out[l].filter((r) => r.rd > 0 && r.rd < 10000).length
    console.log(`      TOTAL $${tot.toFixed(4)} | warm avg $${(warm.reduce((a,r)=>a+r.cost,0)/Math.max(1,warm.length)).toFixed(4)}/turn | system-cache MISSES: ${misses}`)
  }

  const cT = out.current.reduce((a, r) => a + r.cost, 0)
  const rT = out.robust.reduce((a, r) => a + r.cost, 0)
  const cM = out.current.filter((r) => r.rd > 0 && r.rd < 10000).length
  const rM = out.robust.filter((r) => r.rd > 0 && r.rd < 10000).length
  console.log(`\n${'='.repeat(80)}\nVERDICT\n${'='.repeat(80)}`)
  console.log(`  conversation cost   current $${cT.toFixed(4)}  ->  robust $${rT.toFixed(4)}  (${(((rT-cT)/cT)*100).toFixed(1)}%)`)
  console.log(`  system-cache misses current ${cM}          ->  robust ${rM}`)
  console.log(`\n  ${rT < cT ? 'SHIP robust' : 'DO NOT SHIP — robust is not cheaper'}\n`)
}

main().catch((e) => { console.error(e); process.exit(1) })
