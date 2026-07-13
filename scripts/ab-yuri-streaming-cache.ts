/**
 * Is the cache miss caused by STREAMING?
 *
 * Production (advisor.ts:943) calls `client.messages.stream()`.
 * EVERY A/B harness I built used `client.messages.create()` — non-streaming.
 * That is the one structural difference between my (always-healthy) harnesses and
 * production (which misses the ~24K system block on ~40% of turns, reading only the
 * 6,300-token tools block and rewriting the system prompt for a 9-token message).
 *
 * Principle 5 names this exact trap: "I had compared a streaming round against a
 * non-streaming one and called the difference caching overhead. Before presenting any
 * tradeoff, confirm the two arms differ ONLY in the variable named."
 *
 * So: same user, same system blocks, same tools, same messages — the ONLY difference
 * is stream() vs create(). Each arm is salted so it starts cold and the arms never
 * share a cache entry.
 *
 * Run: npx tsx scripts/ab-yuri-streaming-cache.ts
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

// Conversational turns, no tools — production shows the miss on exactly these
// (raw_in 8-19 tokens, cache_read 6,300, cache_write ~24K).
const SCRIPT = ['what is my current PM routine?', 'ok thanks', 'sounds good', 'got it']

type Arm = 'stream' | 'create'
type Row = { turn: number; raw_in: number; rd: number; wr: number; cost: number }

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
    const { cachedPrompt, specialistBlock, clockBlock } = buildSystemPrompt(
      ctx,
      detectSpecialist(msg),
      []
    )

    // Salt keeps each arm's prefix unique => each arm starts genuinely COLD and one
    // arm cannot warm the cache for the other.
    const sys: Anthropic.Messages.TextBlockParam[] = [
      {
        type: 'text',
        text: `<!-- ${salt} ${arm} -->\n` + cachedPrompt,
        cache_control: { type: 'ephemeral' },
      },
    ]
    if (specialistBlock) sys.push({ type: 'text', text: specialistBlock })
    if (clockBlock) sys.push({ type: 'text', text: clockBlock })

    const messages: Anthropic.Messages.MessageParam[] = [
      ...transcript,
      { role: 'user', content: msg },
    ]

    const params = {
      model: MODELS.primary,
      max_tokens: 200,
      system: sys,
      messages,
      tools: cachedTools,
    }

    let usage: Anthropic.Messages.Usage
    let text = ''

    if (arm === 'stream') {
      // EXACTLY what production does.
      const stream = client.messages.stream(params)
      for await (const ev of stream) {
        if (ev.type === 'content_block_delta' && ev.delta.type === 'text_delta') {
          text += ev.delta.text
        }
      }
      const final = await stream.finalMessage()
      usage = final.usage
    } else {
      const res = await client.messages.create(params)
      usage = res.usage
      text = res.content
        .filter((c) => c.type === 'text')
        .map((c) => (c as Anthropic.Messages.TextBlock).text)
        .join('')
    }

    const rd = usage.cache_read_input_tokens ?? 0
    const wr = usage.cache_creation_input_tokens ?? 0
    rows.push({
      turn: i + 1,
      raw_in: usage.input_tokens,
      rd,
      wr,
      cost: estimateCost(MODELS.primary, usage.input_tokens, usage.output_tokens, rd, wr),
    })

    transcript.push({ role: 'user', content: msg })
    transcript.push({ role: 'assistant', content: text || '(ok)' })
  }
  return rows
}

async function main() {
  const arm = process.env.YURI_ST_ARM as Arm | undefined
  if (arm) {
    process.stdout.write(
      '@@JSON@@' + JSON.stringify(await runArm(arm, process.env.YURI_ST_SALT || 'x'))
    )
    return
  }

  const { execFileSync } = await import('child_process')
  const salt = `st-${Date.now()}`
  const run = (a: Arm): Row[] => {
    const out = execFileSync('npx', ['tsx', __filename], {
      encoding: 'utf8',
      maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, YURI_ST_ARM: a, YURI_ST_SALT: salt },
    })
    return JSON.parse(out.slice(out.indexOf('@@JSON@@') + 8))
  }

  const res: Record<Arm, Row[]> = { stream: [], create: [] }
  // Run create() FIRST so streaming cannot be blamed on going second.
  for (const a of ['create', 'stream'] as Arm[]) {
    console.error(`running arm: ${a} (cold, salted)...`)
    res[a] = run(a)
  }

  console.log(`\n${'='.repeat(76)}`)
  console.log('Does STREAMING break the prompt cache? (the only untested prod difference)')
  console.log('='.repeat(76))

  for (const a of ['create', 'stream'] as Arm[]) {
    console.log(`\n--- arm: messages.${a}()${a === 'stream' ? '   <-- what production uses' : ''} ---`)
    console.log('turn |  raw_in | cache_READ | cache_WRITE |     cost')
    console.log('-----+---------+------------+-------------+---------')
    for (const r of res[a]) {
      const miss = r.rd > 0 && r.rd < 10000 ? '  <-- SYSTEM MISS (6,300 fallback)' : ''
      console.log(
        `${String(r.turn).padStart(4)} | ${String(r.raw_in).padStart(7)} | ${String(r.rd).padStart(10)} | ` +
        `${String(r.wr).padStart(11)} | $${r.cost.toFixed(4)}${miss}`
      )
    }
    const warm = res[a].slice(1)
    const misses = res[a].filter((r) => r.rd > 0 && r.rd < 10000).length
    console.log(
      `      warm(2+) avg $${(warm.reduce((s, r) => s + r.cost, 0) / Math.max(1, warm.length)).toFixed(4)}/turn` +
      `   warm cache_write ${warm.reduce((s, r) => s + r.wr, 0)}   MISSES ${misses}`
    )
  }

  const wm = (a: Arm) => res[a].slice(1).filter((r) => r.rd > 0 && r.rd < 10000).length
  const wc = (a: Arm) => res[a].slice(1).reduce((s, r) => s + r.cost, 0) / Math.max(1, res[a].length - 1)

  console.log(`\n${'='.repeat(76)}\nVERDICT (warm turns 2+)\n${'='.repeat(76)}`)
  console.log(`  create()  $${wc('create').toFixed(4)}/turn · misses ${wm('create')}`)
  console.log(`  stream()  $${wc('stream').toFixed(4)}/turn · misses ${wm('stream')}`)
  console.log(
    wm('stream') > wm('create')
      ? '\n  *** STREAMING IS THE INVALIDATOR. That is why no create()-based harness\n' +
        '      could ever reproduce the production miss. ***\n'
      : '\n  Streaming is NOT the difference — both arms behave the same.\n'
  )
}

main().catch((e) => { console.error(e); process.exit(1) })
