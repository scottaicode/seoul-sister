/**
 * MULTI-TURN cost A/B of the widget AS IT WOULD SHIP vs production today.
 * Written after a Fable 5.1 review showed the single-turn replay measured a
 * layout nobody proposed (trailing arms had no message breakpoint at all).
 *
 * Replays real sessions TURN BY TURN with real tool loops. Each turn's history
 * is the RECORDED production transcript (identical bytes for both arms), so the
 * cross-turn cache behavior is measured on the real prefix, and output/thinking
 * cost comes from real generation.
 *
 *   prod  claude-opus-4-8, system [static (cc), dynamic], len-2 assistant
 *         breakpoint, forced tool_choice on heuristic turns, tool_use-only
 *         passback, max_tokens 1500 — production today.
 *   ship  claude-opus-5-5, effort low, system [static (cc)], breakpoint on the
 *         visitor's message, dynamic block (+ message-only fact on heuristic
 *         turns) as a trailing role:'system' message, FULL content passback,
 *         max_tokens 6000.
 *
 * Arms salted so each starts cold; ship runs FIRST so any ordering artifact
 * favors production (lesson #4 in the ab-yuri-* headers). Read-only.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/ab-model-widget-multiturn.ts <out.json> <sessionId> [sessionId...]
 */
import './load-env'
import { readFileSync, writeFileSync } from 'fs'
import { getServiceClient } from '../src/lib/supabase'
import { getAnthropicClient } from '../src/lib/anthropic'
import { YURI_TOOLS, executeYuriTool } from '../src/lib/yuri/tools'
import { PRICING } from '../src/lib/pricing'
import { detectCumulativeGive, buildCumulativeGiveBlock, detectBuildRequest, buildRequestBlock } from '../src/lib/widget/cumulative-give'
import { detectEmailAsks, buildEmailAskBlock } from '../src/lib/widget/email-ask-count'
import { buildSubscriberSurfaceBlock } from '../src/lib/widget/subscriber-surface'
import { PRODUCT_TURN_FACT, mentionsTerm, nextRoundAction, withSearchRetry, withTrailingContext, markLastUserMessage } from '../src/lib/llm-request'
import { namedProductCount } from '../src/lib/widget/tool-grounding'
import type Anthropic from '@anthropic-ai/sdk'

const OUT = process.argv[2]
const SESSIONS = process.argv.slice(3)
const MAX_TURNS = 8
const MAX_TOOL_LOOPS = 3
const RATES: Record<string, { in: number; out: number; cr: number; cw: number }> = {
  'claude-opus-4-8': { in: 5, out: 25, cr: 0.5, cw: 6.25 },
  'claude-opus-5-5': { in: 4, out: 20, cr: 0.2, cw: 5 },
}

function loadWidgetSystem(): string {
  const src = readFileSync('src/app/api/widget/chat/route.ts', 'utf-8')
  const start = src.indexOf('const YURI_WIDGET_SYSTEM = `') + 'const YURI_WIDGET_SYSTEM = `'.length
  let i = start
  while (i < src.length) { if (src[i] === '\\') { i += 2; continue } if (src[i] === '`') break; i++ }
  return (new Function('PRICING', 'return `' + src.slice(start, i) + '`') as (p: typeof PRICING) => string)(PRICING)
}

function shouldForce(message: string): boolean {
  const msg = message.toLowerCase()
  if (/^(hi|hey|hello|thanks|thank you|bye|ok|okay|cool)\b/i.test(message)) return false
  if (/^(what is|explain|how does|tell me about)\s+(skincare|k-beauty|glass skin|double cleansing|layering)/i.test(message)) return false
  const BRANDS = ['cosrx', 'beauty of joseon', 'laneige', 'innisfree', 'etude', 'missha', 'klairs', 'some by mi', 'purito', 'dr.jart', 'dr jart', 'sulwhasoo', 'anua', 'torriden', 'roundlab', 'round lab', 'numbuzin', 'illiyoon', 'skinfood', 'tonymoly', 'holika', 'glow recipe', 'tatcha', 'the ordinary', 'mediheal', 'beplain', 'aestura', 'abib', 'mixsoon', 'biodance', 'tirtir']
  if (BRANDS.some((b) => mentionsTerm(msg, b))) return true
  return [/\b(how much|price|cost|cheap|where.{0,15}buy|retailer|deal)\b/i, /\b(trending|trend|what's new|popular|bestseller|viral|emerging)\b/i, /\b(do you have|search for|find me|recommend.{0,20}(product|serum|cream|sunscreen|cleanser|toner|moisturizer|mask|routine|lineup|regimen|shelf))\b/i, /\b(revamp|rebuild|redo|overhaul|put together|build)\b.{0,30}\b(routine|lineup|regimen|shelf|skincare)\b/i, /\b(best|top|good)\s+(serum|sunscreen|cleanser|toner|moisturizer|cream|mask|essence)\b/i, /\b(weather|uv|humidity|sun.{0,5}(today|right now))\b/i].some((r) => r.test(msg))
}

type Turn = { role: 'user' | 'assistant'; content: string }

function dynamicFor(history: Turn[], message: string, turnNumber: number): string {
  let d = `\n\n## Conversation State (facts, not instructions)\n- This is the visitor's message #${turnNumber} in this conversation.\n- Free preview usage: this is free message #${turnNumber} of 12 total.`
  const ea = buildEmailAskBlock(detectEmailAsks(history)); if (ea) d += ea
  const give = detectCumulativeGive(history)
  const gb = buildCumulativeGiveBlock(give); if (gb) d += gb
  const rb = buildRequestBlock(detectBuildRequest(message), give); if (rb) d += rb
  return d + buildSubscriberSurfaceBlock()
}

async function runTurn(arm: 'ship' | 'prod', system: string, history: Turn[], message: string, turnNumber: number) {
  const client = getAnthropicClient()
  const ship = arm === 'ship'
  const model = ship ? 'claude-opus-5-5' : 'claude-opus-4-8'
  const forced = shouldForce(message)
  const tools = YURI_TOOLS.filter((t) => ['search_products', 'compare_prices', 'get_trending_products', 'get_current_weather', 'get_ingredient_guide', 'get_counterfeit_markers'].includes(t.name))
    .map((t, i, a) => (i === a.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t))
  const dyn = dynamicFor(history, message, turnNumber)
  // ship arm: the exact shipped helpers (imported, not copied).
  const msgs: unknown[] = ship
    ? withTrailingContext(markLastUserMessage([...history, { role: 'user', content: message }]), forced ? `${dyn}\n\n${PRODUCT_TURN_FACT}` : dyn)
    : [...history, { role: 'user', content: message }]
  let retried = false
  const sys = ship ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] : [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }, { type: 'text', text: dyn }]
  const u = { in: 0, out: 0, cr: 0, cw: 0 }
  const rounds: Array<{ cr: number; cw: number; in: number }> = []
  let tools_used = 0
  for (let loop = 0; loop <= MAX_TOOL_LOOPS; loop++) {
    // Production's len-2 assistant breakpoint, recomputed per round like applyCacheControl.
    const sent = ship ? msgs : (msgs as Anthropic.Messages.MessageParam[]).map((m, idx, arr) => (m.role === 'assistant' && typeof m.content === 'string' && idx === arr.length - 2 ? { role: 'assistant', content: [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }] } : m))
    const params: Record<string, unknown> = { model, max_tokens: ship ? 6000 : 1500, system: sys, messages: sent, tools }
    if (ship) params.output_config = { effort: 'low' }
    else params.tool_choice = forced && loop === 0 ? { type: 'any' } : { type: 'auto' }
    const res = await client.messages.create(params as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming)
    const r = res.usage
    u.in += r.input_tokens ?? 0; u.out += r.output_tokens ?? 0; u.cr += r.cache_read_input_tokens ?? 0; u.cw += r.cache_creation_input_tokens ?? 0
    rounds.push({ in: r.input_tokens ?? 0, cr: r.cache_read_input_tokens ?? 0, cw: r.cache_creation_input_tokens ?? 0 })
    const uses = res.content.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use')
    if (ship) {
      const draft = res.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text').map((b) => b.text).join('')
      const action = nextRoundAction({ stopReason: res.stop_reason, onFallbackModel: false, toolUses: uses.length, productTurn: forced, round: tools_used > 0 ? 1 : 0, alreadyRetried: retried, draftNamesProducts: namedProductCount(draft) > 0, retryEnabled: true })
      if (action === 'retry_search') {
        retried = true
        msgs.splice(0, msgs.length, ...withSearchRetry(msgs as Anthropic.Messages.MessageParam[]))
        loop--
        continue
      }
    }
    if (uses.length === 0 || loop === MAX_TOOL_LOOPS) break
    tools_used += uses.length
    msgs.push({ role: 'assistant', content: ship ? res.content : uses.map((b) => ({ type: 'tool_use', id: b.id, name: b.name, input: b.input })) })
    const results = []
    for (const t of uses) results.push({ type: 'tool_result', tool_use_id: t.id, content: await executeYuriTool(t.name, t.input as Record<string, unknown>, '') })
    msgs.push({ role: 'user', content: results })
  }
  const rate = RATES[model]
  return { arm, turn: turnNumber, forced, retried, tools_used, rounds, usage: u, cost: (u.in * rate.in + u.out * rate.out + u.cr * rate.cr + u.cw * rate.cw) / 1e6 }
}

async function main() {
  const db = getServiceClient()
  const base = loadWidgetSystem()
  const all: unknown[] = []
  for (const sid of SESSIONS) {
    const { data, error } = await db.from('ss_widget_messages').select('role, content').eq('session_id', sid).order('created_at', { ascending: true })
    if (error) throw error
    const turns = (data ?? []).filter((m) => m.content).map((m) => ({ role: m.role as Turn['role'], content: m.content as string }))
    const userIdx = turns.map((t, i) => i).filter((i) => turns[i].role === 'user').slice(0, MAX_TURNS)
    for (const arm of (process.env.ARMS ? process.env.ARMS.split(',') : ['ship', 'prod']) as Array<'ship' | 'prod'>) {
      const system = `<!-- ${arm} ${sid} ${Date.now()} -->\n` + base
      let total = 0
      for (const [n, ui] of userIdx.entries()) {
        const r = await runTurn(arm, system, turns.slice(0, ui), turns[ui].content, n + 1)
        total += r.cost
        all.push({ session: sid, ...r })
        console.log(`${sid.slice(0, 8)} ${arm} t${n + 1}${r.forced ? ' F' : '  '}${r.retried ? ' RETRY' : ''} tools=${r.tools_used} rounds=${r.rounds.map((x) => `[in${x.in} cr${x.cr} cw${x.cw}]`).join('')} out=${r.usage.out} $${r.cost.toFixed(4)}`)
      }
      console.log(`${sid.slice(0, 8)} ${arm} TOTAL $${total.toFixed(4)} over ${userIdx.length} turns\n`)
      writeFileSync(OUT, JSON.stringify(all, null, 2))
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
