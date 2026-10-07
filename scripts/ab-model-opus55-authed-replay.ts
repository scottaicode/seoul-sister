/**
 * MODEL A/B for AUTHENTICATED Yuri — Opus 4.8 (production) vs the proposed
 * Opus 5.5 configuration, on real recent conversations.
 *
 * Read-only: user context comes from the real loader (memory.loadUserContext,
 * no writes) and the real prompt builder (advisor.buildSystemPrompt). The six
 * tools that WRITE (routine/library/reaction) are stubbed with a simulated
 * success — identical for both arms — so no user's data is touched.
 *
 * Arms:
 *   A  claude-opus-4-8, production layout: system [body+context (cached),
 *      specialist, clock]; history breakpoint on the last assistant message;
 *      forced tool_choice when the production heuristic fires; max_tokens 2048.
 *   E  claude-opus-5-5, effort low, proposed layout: system [static prompt
 *      (cached)] [user context (cached)]; breakpoint on the user's message;
 *      specialist + clock (+ a one-line fact on product turns) as a trailing
 *      mid-conversation system message; thinking blocks passed back in the
 *      tool loop; max_tokens 8000.
 *
 * Output feeds scripts/ab-model-judge-fable.ts (JUDGE_PROMPT=authed).
 * Run: npx tsx --tsconfig tsconfig.json scripts/ab-model-opus55-authed-replay.ts <outDir>
 */
import './load-env'
import { writeFileSync, mkdirSync } from 'fs'
import { getServiceClient } from '../src/lib/supabase'
import { getAnthropicClient } from '../src/lib/anthropic'
import { YURI_TOOLS, executeYuriTool } from '../src/lib/yuri/tools'
import { detectSpecialist } from '../src/lib/yuri/specialists'
import type { YuriMessage } from '../src/types/database'
import type Anthropic from '@anthropic-ai/sdk'

const OUT_DIR = process.argv[2] || './ab-authed'
const CONVS = 4
const TURNS_PER_CONV = 2
const MAX_TOOL_LOOPS = 5
const WRITE_TOOLS = new Set(['add_to_routine', 'remove_from_routine', 'update_user_product', 'mark_product_reaction', 'clear_product_reaction', 'save_routine'])
const RATES: Record<string, { in: number; out: number; cr: number; cw: number }> = {
  'claude-opus-4-8': { in: 5, out: 25, cr: 0.5, cw: 6.25 },
  'claude-opus-5-5': { in: 4, out: 20, cr: 0.2, cw: 5 },
}
const STEER_NOTE = `\n\n## This Message (fact)\nThis message asks about specific products, prices, or picks, and no catalog search has run yet this turn. The catalog is where current prices, stock, and verified ingredient lists live.`

// Copy of advisor.ts shouldForceToolUse (not exported) — decides arm A's
// production tool_choice and arm E's fact line.
function shouldForce(message: string): boolean {
  const msg = message.toLowerCase()
  const SKIP = [
    /^(hi|hey|hello|thanks|thank you|bye|goodbye|ok|okay|got it|cool|nice|yes|no|sure)\b/i,
    /^(what is|what are|explain|how does|how do|why does|why do|tell me about|can you explain)\s+(skincare|k-beauty|glass skin|double cleansing|layering|skin cycling|ph|retinol|niacinamide|hyaluronic|ceramide|snail mucin|centella)/i,
    /^(how do i|where is|where do i|how can i|can i|show me how)\s+(use|find|navigate|access|get to|open|delete|rename|set up|change)/i,
  ]
  if (SKIP.some((p) => p.test(message))) return false
  const BRANDS = ['cosrx', 'beauty of joseon', 'laneige', 'innisfree', 'etude', 'missha', 'klairs', 'some by mi', 'purito', 'dr.jart', 'dr jart', 'sulwhasoo', 'amorepacific', 'banila co', 'heimish', 'isntree', 'goodal', 'medicube', 'skin1004', 'anua', 'torriden', 'roundlab', 'round lab', 'numbuzin', 'illiyoon', 'hera', 'iope', 'belif', 'benton', 'neogen', 'pyunkang yul', 'dear klairs', 'rohto', 'biore', 'canmake', 'supergoop', 'la roche', 'cerave', 'skinfood', 'tonymoly', 'holika', 'peach slices', 'glow recipe', 'tatcha', 'drunk elephant', 'paula', 'the ordinary', 'soko glam', 'olive young', 'yesstyle', 'stylevana', 'amazon', 'mediheal', 'beplain', 'aestura', 'vt cosmetics', 'abib', 'mixsoon', 'biodance', 'tirtir', 'rom&nd', 'romand', 'espoir', 'jung saem mool', 'hanyul', 'mamonde', 'nature republic', 'the face shop', 'apieu', "a'pieu", 'clio', 'peripera']
  if (BRANDS.some((b) => msg.includes(b))) return true
  return [
    /\b(how much|price|cost|cheap|afford|budget|where.{0,15}buy|where.{0,15}get|retailer|deal)\b/i,
    /\b(trending|trend|what's new|whats new|popular|bestseller|best seller|hot right now|emerging|viral)\b/i,
    /\b(do you have|is .{1,40} in (your|the) database|search for|look up|find me|recommend.{0,20}(product|serum|cream|sunscreen|cleanser|toner|moisturizer|mask|essence|ampoule))\b/i,
    /\b(best|top|good|favorite|favourite)\s+(serum|sunscreen|cleanser|toner|moisturizer|cream|mask|essence|ampoule|exfoliator|eye cream|lip)\b/i,
    /\b(for my skin|good for (oily|dry|combo|combination|sensitive|normal|acne|aging|dark spot))\b/i,
    /\b(weather|uv|humidity|temperature|sun.{0,5}(today|right now|outside))\b/i,
    /\b(can i (use|mix|combine)|conflict|interact|together|layer.{0,15}with)\b/i,
  ].some((r) => r.test(msg))
}

type Turn = { role: 'user' | 'assistant'; content: string }
type ArmResult = { arm: string; text: string; tools: Array<{ name: string; input: unknown; result: string }>; usage: { in: number; out: number; cr: number; cw: number }; cost: number; ms: number; error?: string }

async function runTool(name: string, input: Record<string, unknown>, userId: string): Promise<string> {
  if (WRITE_TOOLS.has(name)) return JSON.stringify({ success: true, note: 'replay harness: write simulated, nothing saved' })
  return executeYuriTool(name, input, userId)
}

async function runArm(arm: 'A_opus48' | 'E_opus55_low_new', p: { cachedPrompt: string; specialistBlock: string; clockBlock: string }, history: Turn[], message: string, forced: boolean, userId: string): Promise<ArmResult> {
  const client = getAnthropicClient()
  const is55 = arm !== 'A_opus48'
  const model = is55 ? 'claude-opus-5-5' : 'claude-opus-4-8'
  const tools = YURI_TOOLS.map((t, i) => (i === YURI_TOOLS.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t))
  const split = p.cachedPrompt.indexOf('\n---\n# USER CONTEXT')
  const staticPart = split > 0 ? p.cachedPrompt.slice(0, split) : p.cachedPrompt
  const contextPart = split > 0 ? p.cachedPrompt.slice(split) : ''
  const usage = { in: 0, out: 0, cr: 0, cw: 0 }
  const toolLog: ArmResult['tools'] = []
  const msgs: unknown[] = is55
    ? [...history, { role: 'user', content: [{ type: 'text', text: message, cache_control: { type: 'ephemeral' } }] }, { role: 'system', content: (p.specialistBlock + p.clockBlock + (forced ? STEER_NOTE : '')).trim() }]
    : [...history.map((m, idx) => (m.role === 'assistant' && idx === history.length - 1 ? { role: 'assistant', content: [{ type: 'text', text: m.content, cache_control: { type: 'ephemeral' } }] } : m)), { role: 'user', content: message }]
  const system = is55
    ? [{ type: 'text', text: staticPart, cache_control: { type: 'ephemeral' } }, ...(contextPart ? [{ type: 'text', text: contextPart, cache_control: { type: 'ephemeral' } }] : [])]
    : [{ type: 'text', text: p.cachedPrompt, cache_control: { type: 'ephemeral' } }, ...(p.specialistBlock ? [{ type: 'text', text: p.specialistBlock }] : []), ...(p.clockBlock ? [{ type: 'text', text: p.clockBlock }] : [])]
  const t0 = Date.now()
  let text = ''
  try {
    for (let loop = 0; loop <= MAX_TOOL_LOOPS; loop++) {
      const params: Record<string, unknown> = { model, max_tokens: is55 ? 8000 : 2048, system, messages: msgs, tools }
      if (is55) params.output_config = { effort: 'low' }
      else params.tool_choice = forced && loop === 0 ? { type: 'any' } : { type: 'auto' }
      const res = await client.messages.create(params as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming)
      usage.in += res.usage.input_tokens ?? 0
      usage.out += res.usage.output_tokens ?? 0
      usage.cr += res.usage.cache_read_input_tokens ?? 0
      usage.cw += res.usage.cache_creation_input_tokens ?? 0
      const uses = res.content.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use')
      if (uses.length === 0 || loop === MAX_TOOL_LOOPS) {
        text = res.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text').map((b) => b.text).join('')
        break
      }
      // Production drops narration text; 5.5 keeps its thinking blocks.
      msgs.push({ role: 'assistant', content: is55 ? res.content.filter((b) => b.type !== 'text') : uses.map((b) => ({ type: 'tool_use', id: b.id, name: b.name, input: b.input })) })
      const results = []
      for (const u of uses) {
        const out = await runTool(u.name, u.input as Record<string, unknown>, userId)
        toolLog.push({ name: u.name, input: u.input, result: out })
        results.push({ type: 'tool_result', tool_use_id: u.id, content: out })
      }
      msgs.push({ role: 'user', content: results })
    }
  } catch (e) {
    return { arm, text, tools: toolLog, usage, cost: 0, ms: Date.now() - t0, error: (e as Error).message }
  }
  const r = RATES[model]
  return { arm, text, tools: toolLog, usage, cost: (usage.in * r.in + usage.out * r.out + usage.cr * r.cr + usage.cw * r.cw) / 1e6, ms: Date.now() - t0 }
}

async function main() {
  mkdirSync(OUT_DIR, { recursive: true })
  const db = getServiceClient()
  const memory = await import('../src/lib/yuri/memory')
  const advisor = await import('../src/lib/yuri/advisor')
  const { data: convs, error } = await db.from('ss_yuri_conversations').select('id, user_id, conversation_type').neq('conversation_type', 'onboarding').order('created_at', { ascending: false }).limit(30)
  if (error) throw error
  const out: unknown[] = []
  let used = 0
  for (const c of convs ?? []) {
    if (used >= CONVS) break
    const { data: rows, error: mErr } = await db.from('ss_yuri_messages').select('*').eq('conversation_id', c.id).order('created_at', { ascending: true })
    if (mErr) throw mErr
    const msgs = (rows ?? []) as YuriMessage[]
    const userIdx = msgs.map((m, i) => i).filter((i) => msgs[i].role === 'user' && !(msgs[i].image_urls?.length) && msgs[i].content.length > 20)
    if (msgs.length < 8 || userIdx.length < 3) continue
    used++
    for (const i of [userIdx[Math.floor(userIdx.length / 2)], userIdx[userIdx.length - 1]].slice(0, TURNS_PER_CONV)) {
      const prior = msgs.slice(0, i)
      const message = msgs[i].content
      const ctx = await memory.loadUserContext(c.user_id as string, c.id as string, { message, isFirstMessage: prior.length === 0 })
      const built = advisor.buildSystemPrompt(ctx, detectSpecialist(message), prior)
      const history: Turn[] = prior.map((m) => ({ role: m.role === 'user' ? 'user' : 'assistant', content: m.content }))
      const forced = shouldForce(message)
      const results: ArmResult[] = []
      for (const arm of ['A_opus48', 'E_opus55_low_new'] as const) {
        const r = await runArm(arm, built, history, message, forced, c.user_id as string)
        results.push(r)
        console.log(`${(c.id as string).slice(0, 8)}#${i} ${arm} out=${r.usage.out} tools=${r.tools.length} cr=${r.usage.cr} cw=${r.usage.cw} $${r.cost.toFixed(4)} ${r.ms}ms${r.error ? ' ERR ' + r.error : ''}`)
      }
      out.push({ sample: { sessionId: c.id, message, history: history.slice(-12), forced }, results })
      writeFileSync(`${OUT_DIR}/replay.json`, JSON.stringify(out, null, 2))
    }
  }
  console.log('done')
}
main().catch((e) => { console.error(e); process.exit(1) })
