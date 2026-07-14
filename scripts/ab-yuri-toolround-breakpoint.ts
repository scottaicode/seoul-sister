/**
 * A/B: does placing a messages-level breakpoint on the TOOL-TURN ANSWERING ROUND
 * stop the next turn from falling back to the 6,300-token tools block?
 *
 * THE MECHANISM (measured, not assumed — scripts/diagnose-yuri-breakpoints.ts):
 *   applyCacheControl's guard is `typeof msg.content === 'string' && idx === len-2`.
 *   On a tool turn's ANSWERING round, idx len-2 is the assistant(tool_use) message,
 *   whose content is an ARRAY — so the guard skips it and NO messages breakpoint is
 *   sent. That round writes its cache with 2 breakpoints (tools + system). The NEXT
 *   turn sends 3. The layouts don't match, so the next turn can't reuse the messages
 *   prefix and falls back to the longest prefix it CAN match: the tools block = 6,300.
 *
 *   Production confirms: EVERY miss (rd=6,300, ~24K rewritten, ~$0.16 for a 9-token
 *   message) lands on the turn immediately after a tool turn. No other turn ever misses.
 *
 * WHY THE EARLIER "tool blocks" A/B (hypothesis #3) DIDN'T CATCH THIS:
 *   it used messages.create() with ONE tool and never drove the real multi-round
 *   streaming loop, so the answering-round layout was never reproduced.
 *
 * ARMS (identical but for the guard; each salted so it starts genuinely COLD):
 *   A "current" — production's string-only guard (breakpoint vanishes on tool rounds)
 *   B "fixed"   — breakpoint always placed at the end of the prefix, whatever the
 *                 block shape, so every round sends the same 3-breakpoint layout
 *
 * SUCCESS = arm B's post-tool turn stops reading 6,300 and reads the full ~40K.
 *
 * Drives the REAL tool loop (real tools execute). Costs Opus tokens. Writes nothing.
 *
 * Run: npx tsx scripts/ab-yuri-toolround-breakpoint.ts
 */
import './load-env'
import { getAnthropicClient, MODELS } from '../src/lib/anthropic'
import { YURI_TOOLS, executeYuriTool } from '../src/lib/yuri/tools'
import { estimateCost } from '../src/lib/ai-config'
import { loadUserContext } from '../src/lib/yuri/memory'
import { buildSystemPrompt } from '../src/lib/yuri/advisor'
import { detectSpecialist } from '../src/lib/yuri/specialists'
import type Anthropic from '@anthropic-ai/sdk'

const USER_ID = '551569d3-aed0-4feb-a340-47bfb146a835' // Bailey

// Exactly the production shape that misses: a tool question, then cheap chat.
const SCRIPT = [
  "what's the price on the Anua Heartleaf toner right now?", // fires a tool
  'ok thanks',                                                // <-- MISSES in prod ($0.15)
  'sounds good',                                              // <-- and this one
]

type Arm = 'current' | 'fixed'
type Row = { turn: number; tools: number; rounds: number; raw_in: number; rd: number; wr: number; cost: number }

/** Production's helper, verbatim: string-content assistant at len-2. */
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
 * The candidate fix: always place a breakpoint at the END of the stable prefix —
 * i.e. on the last message BEFORE the newest one — regardless of content shape.
 * On a tool round that is the assistant(tool_use) / user(tool_result) pair, so we
 * mark its LAST content block. Every round then sends the same 3-breakpoint layout.
 */
function applyFixed(msgs: Anthropic.Messages.MessageParam[]): Anthropic.Messages.MessageParam[] {
  const markIdx = msgs.length - 2
  if (markIdx < 0) return msgs
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

async function runArm(arm: Arm, salt: string): Promise<Row[]> {
  const client = getAnthropicClient()
  const apply = arm === 'current' ? applyCurrent : applyFixed

  const cachedTools = YURI_TOOLS.map((t, i) =>
    i === YURI_TOOLS.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t
  ) as Anthropic.Messages.Tool[]

  const transcript: Anthropic.Messages.MessageParam[] = []
  const rows: Row[] = []

  for (let t = 0; t < SCRIPT.length; t++) {
    const userMsg = SCRIPT[t]
    const ctx = await loadUserContext(USER_ID, undefined, {
      message: userMsg,
      isFirstMessage: transcript.length === 0,
    })
    const { cachedPrompt, specialistBlock, clockBlock } = buildSystemPrompt(
      ctx,
      detectSpecialist(userMsg),
      []
    )
    // Salt => each arm starts genuinely COLD and the arms never share a cache entry.
    const sys: Anthropic.Messages.TextBlockParam[] = [
      { type: 'text', text: `<!-- ${salt} ${arm} -->\n` + cachedPrompt, cache_control: { type: 'ephemeral' } },
    ]
    if (specialistBlock) sys.push({ type: 'text', text: specialistBlock })
    if (clockBlock) sys.push({ type: 'text', text: clockBlock })

    // THE REAL TOOL LOOP (advisor.ts): loopMessages is mutated in place per round.
    const loopMessages: Anthropic.Messages.MessageParam[] = [
      ...transcript,
      { role: 'user', content: userMsg },
    ]

    let raw_in = 0, rd = 0, wr = 0, out = 0, toolsFired = 0, rounds = 0
    let finalText = ''

    for (let round = 0; round < 5; round++) {
      rounds++
      const res = await client.messages.create({
        model: MODELS.primary,
        max_tokens: 500,
        system: sys,
        messages: apply(loopMessages), // <-- THE VARIABLE UNDER TEST
        tools: cachedTools,
      })
      const u = res.usage
      raw_in += u.input_tokens
      rd += u.cache_read_input_tokens ?? 0
      wr += u.cache_creation_input_tokens ?? 0
      out += u.output_tokens

      const toolUses = res.content.filter((c) => c.type === 'tool_use') as Anthropic.Messages.ToolUseBlock[]
      const text = res.content
        .filter((c) => c.type === 'text')
        .map((c) => (c as Anthropic.Messages.TextBlock).text)
        .join('')

      if (toolUses.length === 0) { finalText = text; break }

      toolsFired += toolUses.length
      // Mutate EXACTLY like production (advisor.ts ~1059 / ~1090).
      loopMessages.push({
        role: 'assistant',
        content: toolUses.map((tu) => ({
          type: 'tool_use' as const, id: tu.id, name: tu.name,
          input: tu.input as Record<string, unknown>,
        })),
      })
      const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        const r = await executeYuriTool(tu.name, tu.input as Record<string, unknown>, USER_ID)
        toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(r).slice(0, 6000) })
      }
      loopMessages.push({ role: 'user', content: toolResults })
    }

    rows.push({
      turn: t + 1, tools: toolsFired, rounds, raw_in, rd, wr,
      cost: estimateCost(MODELS.primary, raw_in, out, rd, wr),
    })

    // Production persists CLEAN TEXT (history is rebuilt from the DB next turn).
    transcript.push({ role: 'user', content: userMsg })
    transcript.push({ role: 'assistant', content: finalText || '(ok)' })
  }
  return rows
}

async function main() {
  const arm = process.env.YURI_TR_ARM as Arm | undefined
  if (arm) {
    process.stdout.write('@@JSON@@' + JSON.stringify(await runArm(arm, process.env.YURI_TR_SALT || 'x')))
    return
  }

  const { execFileSync } = await import('child_process')
  const salt = `tr-${Date.now()}`
  const run = (a: Arm): Row[] => {
    const out = execFileSync('npx', ['tsx', __filename], {
      encoding: 'utf8', maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, YURI_TR_ARM: a, YURI_TR_SALT: salt },
    })
    return JSON.parse(out.slice(out.indexOf('@@JSON@@') + 8))
  }

  // Run the CANDIDATE first so it cannot win merely by going second on a warm cache.
  const res: Record<Arm, Row[]> = { current: [], fixed: [] }
  for (const a of ['fixed', 'current'] as Arm[]) {
    console.error(`running arm: ${a} (cold, salted, REAL tool loop)...`)
    res[a] = run(a)
  }

  console.log(`\n${'='.repeat(86)}`)
  console.log('Does a breakpoint on the tool-turn ANSWERING ROUND stop the 6,300 fallback?')
  console.log('='.repeat(86))

  for (const a of ['current', 'fixed'] as Arm[]) {
    console.log(`\n--- arm: ${a}${a === 'current' ? '   (production today)' : '   (breakpoint survives tool blocks)'} ---`)
    console.log('turn | tools | rounds |  raw_in | cache_READ | cache_WRITE |     cost')
    console.log('-----+-------+--------+---------+------------+-------------+---------')
    for (const r of res[a]) {
      const miss = r.rd > 0 && r.rd < 10000 ? '  <-- 6,300 FALLBACK (system missed)' : ''
      console.log(
        `${String(r.turn).padStart(4)} | ${String(r.tools).padStart(5)} | ${String(r.rounds).padStart(6)} | ` +
        `${String(r.raw_in).padStart(7)} | ${String(r.rd).padStart(10)} | ${String(r.wr).padStart(11)} | ` +
        `$${r.cost.toFixed(4)}${miss}`
      )
    }
    const post = res[a].slice(1) // the turns AFTER the tool turn — where prod bleeds
    const misses = post.filter((r) => r.rd > 0 && r.rd < 10000).length
    const tot = res[a].reduce((s, r) => s + r.cost, 0)
    console.log(
      `      TOTAL $${tot.toFixed(4)}   post-tool turns: ${post.length}, ` +
      `6,300-fallbacks: ${misses}, cost $${post.reduce((s, r) => s + r.cost, 0).toFixed(4)}`
    )
  }

  const postMiss = (a: Arm) => res[a].slice(1).filter((r) => r.rd > 0 && r.rd < 10000).length
  const postCost = (a: Arm) => res[a].slice(1).reduce((s, r) => s + r.cost, 0)
  const total = (a: Arm) => res[a].reduce((s, r) => s + r.cost, 0)

  console.log(`\n${'='.repeat(86)}\nVERDICT\n${'='.repeat(86)}`)
  console.log(`  post-tool fallbacks   current ${postMiss('current')}  ->  fixed ${postMiss('fixed')}`)
  console.log(`  post-tool cost        current $${postCost('current').toFixed(4)}  ->  fixed $${postCost('fixed').toFixed(4)}`)
  console.log(`  conversation total    current $${total('current').toFixed(4)}  ->  fixed $${total('fixed').toFixed(4)}` +
    `  (${(((total('fixed') - total('current')) / total('current')) * 100).toFixed(1)}%)`)

  const win = postMiss('fixed') < postMiss('current') && total('fixed') < total('current')
  console.log(
    win
      ? '\n  *** CONFIRMED — SHIP. The vanishing tool-round breakpoint was the cause. ***\n'
      : '\n  NOT CONFIRMED — do not ship. Leave production alone.\n'
  )
}

main().catch((e) => { console.error(e); process.exit(1) })
