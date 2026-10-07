/**
 * CACHE A/B — where the widget's per-turn dynamic block sits.
 *
 * Production (route.ts): system = [static (cache_control), dynamic], then the
 * history with a breakpoint on the last assistant message. The dynamic block
 * changes EVERY turn (message #, give count...), and it sits BEFORE the history
 * in the cache prefix — so, hypothesis, the history breakpoint can never be read
 * on the next turn and the whole history is re-WRITTEN each turn.
 * ss_ai_usage (60d): widget_chat writes ~9.3K tokens/call = ~58% of widget cost.
 *
 * Candidate: system = [static (cache_control)] only; the dynamic block moves to
 * a mid-conversation system message AFTER the visitor's message, with the
 * breakpoint on the visitor's message (before the volatile block). Supported on
 * Opus 4.8 and Opus 5.5, no beta header.
 *
 * Method (the lessons in scripts/ab-yuri-*.ts): replay one REAL session turn by
 * turn using its recorded replies as history; each arm SALTED so it starts cold
 * (no cross-arm cache sharing); candidate runs FIRST so any ordering artifact
 * favors production. max_tokens small — this measures input-side caching only.
 *
 * Run:  npx tsx --tsconfig tsconfig.json scripts/ab-widget-dynamic-placement.ts [model] [sessionId]
 */
import './load-env'
import { readFileSync } from 'fs'
import { getServiceClient } from '../src/lib/supabase'
import { getAnthropicClient } from '../src/lib/anthropic'
import { YURI_TOOLS } from '../src/lib/yuri/tools'
import { PRICING } from '../src/lib/pricing'
import { detectCumulativeGive, buildCumulativeGiveBlock } from '../src/lib/widget/cumulative-give'
import { buildSubscriberSurfaceBlock } from '../src/lib/widget/subscriber-surface'
import type Anthropic from '@anthropic-ai/sdk'

const MODEL = process.argv[2] || 'claude-opus-5-5'
const SESSION = process.argv[3]
const MAX_TURNS = 8
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

type Turn = { role: 'user' | 'assistant'; content: string }

async function loadSession(): Promise<Turn[]> {
  const db = getServiceClient()
  let id = SESSION
  if (!id) {
    // Most recent session with >= 6 user turns.
    const { data, error } = await db.from('ss_widget_sessions').select('id, message_count').gte('message_count', 6).order('created_at', { ascending: false }).limit(1)
    if (error) throw error
    id = data?.[0]?.id as string
  }
  const { data, error } = await db.from('ss_widget_messages').select('role, content').eq('session_id', id).order('created_at', { ascending: true })
  if (error) throw error
  console.log(`session ${id}: ${data?.length} messages`)
  return (data ?? []).filter((m) => m.content).map((m) => ({ role: m.role as Turn['role'], content: m.content as string }))
}

function dynamicFor(history: Turn[], turnNumber: number): string {
  let d = `\n\n## Conversation State (facts, not instructions)\n- This is the visitor's message #${turnNumber} in this conversation.`
  const gb = buildCumulativeGiveBlock(detectCumulativeGive(history)); if (gb) d += gb
  return d + buildSubscriberSurfaceBlock()
}

async function runArm(name: 'production' | 'candidate', turns: Turn[], baseSystem: string) {
  const client = getAnthropicClient()
  const salt = `<!-- arm ${name} ${Date.now()} -->\n`
  const system = salt + baseSystem
  const tools = YURI_TOOLS.filter((t) => ['search_products', 'compare_prices', 'get_trending_products', 'get_current_weather', 'get_ingredient_guide', 'get_counterfeit_markers'].includes(t.name))
    .map((t, i, a) => (i === a.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t))
  let total = 0
  const userIdx = turns.map((t, i) => i).filter((i) => turns[i].role === 'user').slice(0, MAX_TURNS)
  for (const [n, ui] of userIdx.entries()) {
    const history = turns.slice(0, ui)
    const dyn = dynamicFor(history, n + 1)
    let messages: unknown[]
    let sys: unknown[]
    if (name === 'production') {
      sys = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }, { type: 'text', text: dyn }]
      const msgs: Anthropic.Messages.MessageParam[] = [...history.map((t) => ({ role: t.role, content: t.content })), { role: 'user', content: turns[ui].content }]
      messages = msgs.map((m, idx) => (m.role === 'assistant' && typeof m.content === 'string' && idx === msgs.length - 2 ? { role: 'assistant', content: [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }] } : m))
    } else {
      sys = [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }]
      messages = [
        ...history.map((t) => ({ role: t.role, content: t.content })),
        { role: 'user', content: [{ type: 'text', text: turns[ui].content, cache_control: { type: 'ephemeral' } }] },
        { role: 'system', content: dyn.trim() },
      ]
    }
    const params: Record<string, unknown> = { model: MODEL, max_tokens: MODEL === 'claude-opus-5-5' ? 1024 : 16, system: sys, messages, tools }
    if (MODEL === 'claude-opus-5-5') params.output_config = { effort: 'low' }
    const res = await client.messages.create(params as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming)
    const u = res.usage
    const r = RATES[MODEL]
    // Input-side cost only — output is not comparable at a tiny max_tokens.
    const inCost = ((u.input_tokens ?? 0) * r.in + (u.cache_read_input_tokens ?? 0) * r.cr + (u.cache_creation_input_tokens ?? 0) * r.cw) / 1e6
    total += inCost
    console.log(`${name.padEnd(10)} turn ${n + 1}: raw_in=${u.input_tokens} cache_read=${u.cache_read_input_tokens} cache_write=${u.cache_creation_input_tokens} input_cost=$${inCost.toFixed(4)}`)
  }
  console.log(`${name} TOTAL input cost: $${total.toFixed(4)}\n`)
  return total
}

async function main() {
  const turns = await loadSession()
  const sys = loadWidgetSystem()
  const cand = await runArm('candidate', turns, sys)
  const prod = await runArm('production', turns, sys)
  console.log(`candidate vs production input cost: ${(((cand - prod) / prod) * 100).toFixed(1)}%`)
}

main().catch((e) => { console.error(e); process.exit(1) })
