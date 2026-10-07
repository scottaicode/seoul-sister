/**
 * MODEL A/B — Opus 4.8 (production) vs Opus 5.5 on REAL widget turns.
 *
 * Question (Oct 7 2026): does Opus 5.5 ($4/$20, cache read $0.20) cost less than
 * Opus 4.8 ($5/$25, cache read $0.50) on OUR traffic, at equal or better quality?
 * The per-token price is 20% lower, but Opus 5.5 cannot disable thinking, and
 * thinking is billed as output. Production runs 4.8 with NO thinking. So the
 * saving is real only if thinking stays small at the effort we would ship.
 *
 * Arms (same reconstructed input for every arm):
 *   A  claude-opus-4-8, no thinking, production tool_choice ('any' when the
 *      route's shouldWidgetForceToolUse would fire), max_tokens 1500.
 *   B  claude-opus-5-5, effort low,    tool_choice auto, max_tokens 8000
 *   C  claude-opus-5-5, effort medium, tool_choice auto, max_tokens 8000
 *   (max_tokens is raised on 5.5 so thinking can be MEASURED, not truncated.)
 *
 * Arms run interleaved per sample so each model's system/tools cache is warm in
 * the same way (caches are model-scoped; nothing is shared across arms).
 *
 * Writes NOTHING to the database. Tools run through the real executeYuriTool
 * (read-only for the six widget tools). Output: JSON in the scratch dir given
 * as argv[2] (default ./ab-out).
 *
 * Run:  npx tsx --tsconfig tsconfig.json scripts/ab-model-opus55-widget-replay.ts <outDir> [n]
 */
import './load-env'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { getServiceClient } from '../src/lib/supabase'
import { getAnthropicClient } from '../src/lib/anthropic'
import { YURI_TOOLS, executeYuriTool } from '../src/lib/yuri/tools'
import { PRICING } from '../src/lib/pricing'
import { detectCumulativeGive, buildCumulativeGiveBlock, detectBuildRequest, buildRequestBlock } from '../src/lib/widget/cumulative-give'
import { detectEmailAsks, buildEmailAskBlock } from '../src/lib/widget/email-ask-count'
import { buildSubscriberSurfaceBlock } from '../src/lib/widget/subscriber-surface'
import { MAX_FREE_MESSAGES } from '../src/lib/widget/visitor'
import type Anthropic from '@anthropic-ai/sdk'

const OUT_DIR = process.argv[2] || './ab-out'
const N = Number(process.argv[3] || 20)
const MAX_TOOL_LOOPS = 3
// The candidate replacement for forced tool_choice: a FACT, not a command.
const STEER_NOTE = `\n\n## This Message (fact)\nThis message asks about specific products, prices, or picks, and no catalog search has run yet this turn. The catalog is where current prices, stock, and verified ingredient lists live.`

// Per-MTok rates (official, cached Oct 6 2026). 5-minute cache write = 1.25x input.
const RATES: Record<string, { in: number; out: number; cr: number; cw: number }> = {
  'claude-opus-4-8': { in: 5, out: 25, cr: 0.5, cw: 6.25 },
  'claude-opus-5-5': { in: 4, out: 20, cr: 0.2, cw: 5 },
}

// --- The REAL widget system prompt, read from the route source. It is not
// exported, and copying it would let the harness drift from production.
function loadWidgetSystem(): string {
  const src = readFileSync('src/app/api/widget/chat/route.ts', 'utf-8')
  const start = src.indexOf('const YURI_WIDGET_SYSTEM = `')
  if (start < 0) throw new Error('YURI_WIDGET_SYSTEM not found')
  let i = start + 'const YURI_WIDGET_SYSTEM = `'.length
  const bodyStart = i
  while (i < src.length) {
    if (src[i] === '\\') { i += 2; continue }
    if (src[i] === '`') break
    i++
  }
  const body = src.slice(bodyStart, i)
  // Evaluate the template literal with the same interpolations the route uses.
  const fn = new Function('PRICING', 'return `' + body + '`') as (p: typeof PRICING) => string
  const text = fn(PRICING)
  if (text.length < 5000) throw new Error(`system prompt suspiciously short: ${text.length}`)
  return text
}

// Mirror of the route's shouldWidgetForceToolUse (not exported). Copied verbatim
// in behavior; only used to decide arm A's production tool_choice.
function shouldForce(message: string): boolean {
  const msg = message.toLowerCase()
  if (/^(hi|hey|hello|thanks|thank you|bye|ok|okay|cool)\b/i.test(message)) return false
  if (/^(what is|explain|how does|tell me about)\s+(skincare|k-beauty|glass skin|double cleansing|layering)/i.test(message)) return false
  const BRANDS = ['cosrx', 'beauty of joseon', 'laneige', 'innisfree', 'etude', 'missha', 'klairs', 'some by mi', 'purito', 'dr.jart', 'dr jart', 'sulwhasoo', 'anua', 'torriden', 'roundlab', 'round lab', 'numbuzin', 'illiyoon', 'skinfood', 'tonymoly', 'holika', 'glow recipe', 'tatcha', 'the ordinary', 'mediheal', 'beplain', 'aestura', 'abib', 'mixsoon', 'biodance', 'tirtir']
  if (BRANDS.some((b) => msg.includes(b))) return true
  if (/\b(how much|price|cost|cheap|where.{0,15}buy|retailer|deal)\b/i.test(msg)) return true
  if (/\b(trending|trend|what's new|popular|bestseller|viral|emerging)\b/i.test(msg)) return true
  if (/\b(do you have|search for|find me|recommend.{0,20}(product|serum|cream|sunscreen|cleanser|toner|moisturizer|mask|routine|lineup|regimen|shelf))\b/i.test(msg)) return true
  if (/\b(revamp|rebuild|redo|overhaul|put together|build)\b.{0,30}\b(routine|lineup|regimen|shelf|skincare)\b/i.test(msg)) return true
  if (/\b(best|top|good)\s+(serum|sunscreen|cleanser|toner|moisturizer|cream|mask|essence)\b/i.test(msg)) return true
  if (/\b(weather|uv|humidity|sun.{0,5}(today|right now))\b/i.test(msg)) return true
  return false
}

type Turn = { role: 'user' | 'assistant'; content: string }
type Sample = { sessionId: string; turnIndex: number; history: Turn[]; message: string; source: string | null; productionReply: string; forced: boolean }

// Approximation of the route's per-turn dynamic block, built from the same pure
// detectors. Lifetime usage is approximated by the in-session turn number; the
// visitor-memory block is omitted. Identical for every arm, so the A/B is fair.
function buildDynamic(s: Sample): string {
  const turnNumber = Math.floor(s.history.length / 2) + 1
  const hasEmail = s.history.some((t) => t.role === 'user' && /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/.test(t.content))
  const remaining = Math.max(0, MAX_FREE_MESSAGES - turnNumber)
  let d = `\n\n## Conversation State (facts, not instructions)
- This is the visitor's message #${turnNumber} in this conversation.
- Free preview usage: this is free message #${turnNumber} of ${MAX_FREE_MESSAGES} total. After you reply, exactly ${remaining} free messages remain.${remaining > 3 ? ' Volunteering the count is NOT appropriate yet. Only say it if they ask.' : ''}
- Email on file for this visitor: ${hasEmail ? 'YES — do NOT ask again.' : 'NO — Seoul Sister has no way to reach them after they close this tab.'}

Use these facts with the judgment described above. They are context, not a trigger.`
  if (!hasEmail) { const b = buildEmailAskBlock(detectEmailAsks(s.history)); if (b) d += b }
  const give = detectCumulativeGive(s.history)
  const gb = buildCumulativeGiveBlock(give); if (gb) d += gb
  const rb = buildRequestBlock(detectBuildRequest(s.message), give); if (rb) d += rb
  d += buildSubscriberSurfaceBlock()
  if (s.source && s.source !== 'landing') d += `\n\n## How This Visitor Arrived\nThey clicked an "Ask Yuri" link on a Seoul Sister page (source tag: "${s.source}"). Treat any guide they mention as real; don't invent its contents.`
  return d
}

async function loadSamples(): Promise<Sample[]> {
  const db = getServiceClient()
  const { data: rows, error } = await db
    .from('ss_widget_messages')
    .select('session_id, role, content, created_at')
    .gte('created_at', '2026-07-15')
    .order('created_at', { ascending: true })
    .range(0, 4999)
  if (error) throw error
  const { data: sessions, error: sErr } = await db.from('ss_widget_sessions').select('id, source')
  if (sErr) throw sErr
  const srcById = new Map((sessions ?? []).map((s) => [s.id as string, (s.source as string | null) ?? null]))
  const bySession = new Map<string, Turn[]>()
  for (const r of rows ?? []) {
    if (!r.content) continue
    const list = bySession.get(r.session_id) ?? []
    list.push({ role: r.role as Turn['role'], content: r.content as string })
    bySession.set(r.session_id, list)
  }
  // Candidate = a user turn that got a real assistant reply. Deterministic
  // spread: one turn per session (alternating early/late), forced and unforced.
  const forced: Sample[] = []
  const unforced: Sample[] = []
  let k = 0
  for (const [sessionId, turns] of bySession) {
    const idxs = turns.map((t, i) => i).filter((i) => turns[i].role === 'user' && turns[i + 1]?.role === 'assistant' && turns[i].content.length > 15)
    if (idxs.length === 0) continue
    const i = idxs[k++ % 2 === 0 ? Math.min(1, idxs.length - 1) : idxs.length - 1]
    const s: Sample = { sessionId, turnIndex: i, history: turns.slice(0, i), message: turns[i].content, source: srcById.get(sessionId) ?? null, productionReply: turns[i + 1].content, forced: shouldForce(turns[i].content) }
    ;(s.forced ? forced : unforced).push(s)
  }
  const half = Math.floor(N / 2)
  return [...forced.slice(-half), ...unforced.slice(-(N - Math.min(half, forced.length)))].slice(0, N)
}

// D/E/F are candidate production configs: 'trailing' = dynamic block as a
// trailing system message; 'steer' = when the route's force heuristic fires,
// a one-line fact replaces the forced tool_choice (which 400s on Opus 5.5).
type ArmName = 'A_opus48' | 'B_opus55_low' | 'C_opus55_medium' | 'D_opus55_medium_trailing' | 'E_opus55_low_trailing_steer' | 'F_opus55_medium_trailing_steer'
type ArmResult = { arm: ArmName; text: string; tools: Array<{ name: string; input: unknown; result: string }>; rounds: number; usage: { in: number; out: number; cr: number; cw: number }; cost: number; ms: number; stop: string; error?: string }

async function runArm(arm: ArmName, s: Sample, system: string, dynamic: string): Promise<ArmResult> {
  const client = getAnthropicClient()
  const is55 = arm !== 'A_opus48'
  const model = is55 ? 'claude-opus-5-5' : 'claude-opus-4-8'
  const tools = YURI_TOOLS.filter((t) => ['search_products', 'compare_prices', 'get_trending_products', 'get_current_weather', 'get_ingredient_guide', 'get_counterfeit_markers'].includes(t.name))
    .map((t, i, a) => (i === a.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t))
  const msgs: Anthropic.Messages.MessageParam[] = [...s.history.map((t) => ({ role: t.role, content: t.content })), { role: 'user', content: s.message }]
  const usage = { in: 0, out: 0, cr: 0, cw: 0 }
  const toolLog: ArmResult['tools'] = []
  const t0 = Date.now()
  let text = ''
  let stop = ''
  let rounds = 0
  try {
    for (let loop = 0; loop <= MAX_TOOL_LOOPS; loop++) {
      rounds++
      // Same message-history breakpoint as production (last string assistant at len-2).
      // D: the dynamic block moves out of `system` into a mid-conversation system
      // message right after the visitor's message (see ab-widget-dynamic-placement.ts).
      const trailing = arm.includes('trailing')
      const steer = arm.includes('steer') && s.forced
      const dyn = steer ? dynamic + STEER_NOTE : dynamic
      const userAt = s.history.length
      const cached: unknown[] = trailing
        ? [...msgs.slice(0, userAt + 1), { role: 'system', content: dyn.trim() }, ...msgs.slice(userAt + 1)]
        : msgs.map((m, idx) => (m.role === 'assistant' && typeof m.content === 'string' && idx === msgs.length - 2 ? { role: 'assistant' as const, content: [{ type: 'text' as const, text: m.content, cache_control: { type: 'ephemeral' as const } }] } : m))
      const params: Record<string, unknown> = {
        model,
        max_tokens: is55 ? 8000 : 1500,
        system: trailing ? [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }] : [{ type: 'text', text: system, cache_control: { type: 'ephemeral' } }, { type: 'text', text: dyn }],
        messages: cached,
        tools,
        tool_choice: !is55 && s.forced && loop === 0 ? { type: 'any' } : { type: 'auto' },
      }
      if (is55) params.output_config = { effort: arm.includes('medium') ? 'medium' : 'low' }
      const res = await client.messages.create(params as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming)
      const u = res.usage
      usage.in += u.input_tokens ?? 0
      usage.out += u.output_tokens ?? 0
      usage.cr += u.cache_read_input_tokens ?? 0
      usage.cw += u.cache_creation_input_tokens ?? 0
      stop = res.stop_reason ?? ''
      const toolUses = res.content.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use')
      if (toolUses.length === 0 || loop === MAX_TOOL_LOOPS) {
        text = res.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text').map((b) => b.text).join('')
        break
      }
      // 4.8: production reconstruction (tool_use blocks only). 5.5: pass the
      // full content back unchanged, which preserved thinking requires.
      msgs.push({ role: 'assistant', content: is55 ? (res.content as unknown as Anthropic.Messages.ContentBlockParam[]) : toolUses.map((b) => ({ type: 'tool_use' as const, id: b.id, name: b.name, input: b.input })) })
      const results: Anthropic.Messages.ToolResultBlockParam[] = []
      for (const tu of toolUses) {
        const out = await executeYuriTool(tu.name, tu.input as Record<string, unknown>, '')
        toolLog.push({ name: tu.name, input: tu.input, result: out.slice(0, 1500) })
        results.push({ type: 'tool_result', tool_use_id: tu.id, content: out })
      }
      msgs.push({ role: 'user', content: results })
    }
  } catch (e) {
    return { arm, text, tools: toolLog, rounds, usage, cost: 0, ms: Date.now() - t0, stop, error: (e as Error).message }
  }
  const r = RATES[model]
  const cost = (usage.in * r.in + usage.out * r.out + usage.cr * r.cr + usage.cw * r.cw) / 1_000_000
  return { arm, text, tools: toolLog, rounds, usage, cost, ms: Date.now() - t0, stop }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const system = loadWidgetSystem()
  // SAMPLES_FROM=<replay.json> reuses an earlier run's exact samples so a new arm
  // is compared on identical inputs even if new widget traffic arrived since.
  const samples: Sample[] = process.env.SAMPLES_FROM
    ? (JSON.parse(readFileSync(process.env.SAMPLES_FROM, 'utf-8')) as Array<{ sample: Sample }>).map((r) => r.sample)
    : await loadSamples()
  console.log(`system=${system.length} chars, samples=${samples.length} (forced=${samples.filter((s) => s.forced).length})`)
  const out: Array<{ sample: Omit<Sample, 'history'> & { historyLen: number; history: Turn[] }; results: ArmResult[] }> = []
  for (const [n, s] of samples.entries()) {
    const dynamic = buildDynamic(s)
    const results: ArmResult[] = []
    const arms = (process.env.ARMS ? process.env.ARMS.split(',') : ['A_opus48', 'B_opus55_low', 'C_opus55_medium']) as ArmName[]
    for (const arm of arms) {
      const r = await runArm(arm, s, system, dynamic)
      results.push(r)
      console.log(`#${n} ${arm} out=${r.usage.out} tools=${r.tools.length} cost=$${r.cost.toFixed(4)} ${r.ms}ms stop=${r.stop}${r.error ? ' ERR ' + r.error : ''}`)
    }
    out.push({ sample: { ...s, historyLen: s.history.length }, results })
    writeFileSync(`${OUT_DIR}/${process.env.OUT_NAME || 'replay'}.json`, JSON.stringify(out, null, 2))
  }
  console.log('done')
}

main().catch((e) => { console.error(e); process.exit(1) })
