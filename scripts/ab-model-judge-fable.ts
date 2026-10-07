/**
 * Blind pairwise judge for ab-model-opus55-widget-replay.ts output.
 *
 * The judge is Claude Fable 5.1 — a DIFFERENT model from both arms, so neither
 * contestant grades itself. Order is randomized per pair and the judge never
 * sees model names. It gets the full production widget prompt (the rules Yuri
 * is supposed to follow), the conversation so far, and each reply WITH the tool
 * calls/results behind it, so "grounded vs fabricated" is checkable rather than
 * a vibe.
 *
 * Run:  npx tsx --tsconfig tsconfig.json scripts/ab-model-judge-fable.ts <outDir>
 */
import './load-env'
import { readFileSync, writeFileSync } from 'fs'
import { getAnthropicClient } from '../src/lib/anthropic'
import { PRICING } from '../src/lib/pricing'
import type Anthropic from '@anthropic-ai/sdk'

const OUT_DIR = process.argv[2] || './ab-out'
const PAIRS: Array<[string, string]> = process.env.PAIRS ? process.env.PAIRS.split(';').map((p) => p.split(',') as [string, string]) : [['A_opus48', 'B_opus55_low'], ['A_opus48', 'C_opus55_medium']]

type ArmResult = { arm: string; text: string; tools: Array<{ name: string; input: unknown; result: string }>; error?: string }
type Row = { sample: { sessionId: string; message: string; history: Array<{ role: string; content: string }>; forced: boolean }; results: ArmResult[] }

// JUDGE_PROMPT=authed grades against the authenticated advisor prompt instead
// of the anonymous widget prompt.
function loadWidgetSystem(): string {
  const authed = process.env.JUDGE_PROMPT === 'authed'
  const src = readFileSync(authed ? 'src/lib/yuri/advisor.ts' : 'src/app/api/widget/chat/route.ts', 'utf-8')
  const marker = authed ? 'const YURI_SYSTEM_PROMPT = `' : 'const YURI_WIDGET_SYSTEM = `'
  const start = src.indexOf(marker) + marker.length
  let i = start
  while (i < src.length) { if (src[i] === '\\') { i += 2; continue } if (src[i] === '`') break; i++ }
  return (new Function('PRICING', 'return `' + src.slice(start, i) + '`') as (p: typeof PRICING) => string)(PRICING)
}

const RUBRIC = `You are grading two candidate replies from "Yuri", Seoul Sister's AI skincare advisor (landing-page widget, or the logged-in advisor for a subscriber; tools marked 'write simulated' were stubbed in this replay — treat their success as real). Below the line is the exact operating prompt Yuri runs under. Grade against IT, plus factual accuracy.

Score each reply 1-5 on:
- grounding: product facts, prices, ingredients and availability match the tool results shown for that reply; nothing asserted as checked that was not checked; no invented products or numbers. A reply that recommends specific products with NO search behind it, where a search was clearly warranted, loses points.
- judgment: the skincare reasoning is correct and fits this visitor; safety/referral handled right; it follows the prompt's give/gate, email-ask and anti-selling rules.
- helpfulness: actually answers what was asked, specific, the right length for a chat widget.
- voice: sounds like the persona the prompt describes, not generic AI.

Then pick an overall winner ("1", "2", or "tie"). Prefer "tie" when the differences would not matter to a real visitor. Be skeptical and specific.

Respond with ONLY a JSON object:
{"r1":{"grounding":n,"judgment":n,"helpfulness":n,"voice":n},"r2":{...},"winner":"1"|"2"|"tie","decisive_reason":"one sentence","defects_r1":["..."],"defects_r2":["..."]}

-----
`

function renderReply(r: ArmResult): string {
  const tools = r.tools.length
    ? r.tools.map((t) => `TOOL ${t.name}(${JSON.stringify(t.input)}) ->\n${t.result}`).join('\n\n')
    : '(no tools called)'
  return `[Tool activity]\n${tools}\n\n[Reply shown to visitor]\n${r.text || '(empty)'}`
}

async function judge(system: string, row: Row, a: ArmResult, b: ArmResult): Promise<Record<string, unknown>> {
  const client = getAnthropicClient()
  const swap = Math.random() < 0.5
  const [r1, r2] = swap ? [b, a] : [a, b]
  const convo = row.sample.history.map((t) => `${t.role.toUpperCase()}: ${t.content}`).join('\n\n')
  const user = `CONVERSATION SO FAR:\n${convo || '(this is the first message)'}\n\nVISITOR'S NEW MESSAGE:\n${row.sample.message}\n\n===== REPLY 1 =====\n${renderReply(r1)}\n\n===== REPLY 2 =====\n${renderReply(r2)}`
  const params = {
    model: 'claude-fable-5-1',
    max_tokens: 16000,
    system: [{ type: 'text', text: RUBRIC + system, cache_control: { type: 'ephemeral' } }],
    output_config: { effort: 'medium' },
    messages: [{ role: 'user', content: user }],
  }
  const res = await client.messages.create(params as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming)
  if (res.stop_reason === 'refusal') return { error: 'refusal' }
  const text = res.content.filter((x): x is Anthropic.Messages.TextBlock => x.type === 'text').map((x) => x.text).join('')
  const m = text.match(/\{[\s\S]*\}/)
  if (!m) return { error: 'no json', raw: text.slice(0, 300) }
  const v = JSON.parse(m[0]) as { r1: unknown; r2: unknown; winner: string; decisive_reason: string; defects_r1: string[]; defects_r2: string[] }
  // Map positional verdict back to arm names.
  const armOf = (pos: string) => (pos === 'tie' ? 'tie' : pos === '1' ? r1.arm : r2.arm)
  return {
    winner: armOf(v.winner),
    reason: v.decisive_reason,
    scores: { [r1.arm]: v.r1, [r2.arm]: v.r2 },
    defects: { [r1.arm]: v.defects_r1, [r2.arm]: v.defects_r2 },
    usage: res.usage,
  }
}

async function main() {
  const rows = JSON.parse(readFileSync(`${OUT_DIR}/replay.json`, 'utf-8')) as Row[]
  const system = loadWidgetSystem()
  const verdicts: Array<Record<string, unknown>> = []
  for (const [n, row] of rows.entries()) {
    for (const [x, y] of PAIRS) {
      const a = row.results.find((r) => r.arm === x)
      const b = row.results.find((r) => r.arm === y)
      if (!a || !b || a.error || b.error) { verdicts.push({ n, pair: `${x} vs ${y}`, error: 'arm error' }); continue }
      try {
        const v = await judge(system, row, a, b)
        verdicts.push({ n, pair: `${x} vs ${y}`, forced: row.sample.forced, ...v })
        console.log(`#${n} ${x} vs ${y}: ${v.winner ?? v.error} — ${v.reason ?? ''}`)
      } catch (e) {
        verdicts.push({ n, pair: `${x} vs ${y}`, error: (e as Error).message })
        console.log(`#${n} ERR ${(e as Error).message}`)
      }
      writeFileSync(`${OUT_DIR}/${process.env.VERDICTS_NAME || "verdicts"}.json`, JSON.stringify(verdicts, null, 2))
    }
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
