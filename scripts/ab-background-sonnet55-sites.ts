/**
 * Sonnet 4.5 -> 5.5 background migration, measured per call site (Oct 19 2026).
 *
 * Runs the REAL background functions on real recent inputs. Every background
 * request is intercepted and sent to BOTH models:
 *   - Sonnet 4.5 with the call site's own params (today's production behavior)
 *   - Sonnet 5.5 through adaptParamsForModel (adaptive thinking, effort low) with max_tokens lifted to 16000,
 *     so its natural output length is visible instead of being cut at the cap
 * The 5.5 response is what the function receives, so its own parsing runs on
 * 5.5 output. Only pure functions are exercised (they return values and write
 * nothing to the product tables; extractSkinProfileData does log a cost row to
 * ss_ai_usage, so delete rows logged during a run afterwards); side-effecting
 * sites are sized from this evidence instead.
 *
 * Run: AI_BACKGROUND_MODEL=claude-sonnet-5-5 npx tsx --tsconfig tsconfig.json scripts/ab-background-sonnet55-sites.ts <outFile> [perSite]
 */
import './load-env'
import { writeFileSync } from 'fs'
import { getServiceClient } from '../src/lib/supabase'
import { getAnthropicClient, adaptParamsForModel, responseText } from '../src/lib/anthropic'
import { generateTitle, generateConversationSummary } from '../src/lib/yuri/advisor'
import { extractSkinProfileData } from '../src/lib/yuri/onboarding'
import { extractDecisionMemory } from '../src/lib/yuri/memory'
import { extractProductData } from '../src/lib/pipeline/extractor'
import { extractPatternsFromReview, extractPatternsFromConversation } from '../src/lib/learning/patterns'

const OUT = process.argv[2] || 'bg-sites-ab.json'
const PER = Number(process.argv[3] || 5)
const S45 = 'claude-sonnet-4-5-20250929'
const S55 = 'claude-sonnet-5-5'

type Row = { site: string; cap: number; s45: Record<string, unknown>; s55: Record<string, unknown>; result?: string }
const rows: Row[] = []
let site = ''
let result = ''

function jsonish(t: string): boolean {
  const m = t.match(/[[{][\s\S]*[\]}]/)
  if (!m) return false
  try { JSON.parse(m[0]); return true } catch { return false }
}

const client = getAnthropicClient()
const msgs = client.messages as unknown as { create: (p: Record<string, unknown>, o?: unknown) => Promise<unknown> }
const raw = msgs.create
msgs.create = async (params) => {
  if (params.model !== S55) return raw(params)
  const cap = Number(params.max_tokens)
  const t0 = Date.now()
  const r45 = (await raw({ ...params, model: S45 })) as { stop_reason: string; usage: { output_tokens: number }; content: [] }
  const p55 = adaptParamsForModel({ ...params, max_tokens: 16000 } as Record<string, unknown> & { model?: string })
  const t1 = Date.now()
  const r55 = (await raw(p55)) as { stop_reason: string; usage: { output_tokens: number; input_tokens: number }; content: [] }
  const t2 = Date.now()
  const t45 = responseText(r45)
  const t55 = responseText(r55)
  rows.push({
    site, cap,
    s45: { stop: r45.stop_reason, out: r45.usage.output_tokens, ms: t1 - t0, json: jsonish(t45), text: t45 },
    s55: { stop: r55.stop_reason, out: r55.usage.output_tokens, ms: t2 - t1, in: r55.usage.input_tokens, fits_cap: r55.usage.output_tokens <= cap, json: jsonish(t55), text: t55 },
  })
  console.log(`${site.padEnd(22)} cap ${String(cap).padStart(5)} | 4.5 ${r45.stop_reason} ${r45.usage.output_tokens} | 5.5 ${r55.stop_reason} ${r55.usage.output_tokens}${r55.usage.output_tokens > cap ? '  << OVER CAP' : ''}`)
  return r55
}

async function run(label: string, fn: () => Promise<unknown>) {
  site = label
  try {
    const out = await fn()
    result = out == null ? 'null' : typeof out === 'string' ? out.slice(0, 200) : JSON.stringify(out).slice(0, 300)
  } catch (e) {
    result = `THREW: ${e instanceof Error ? e.message : e}`
  }
  const last = rows[rows.length - 1]
  if (last && last.site === label && !last.result) last.result = result
}

async function main() {
  const db = getServiceClient()

  // Real conversations, newest first, with enough turns to matter.
  const { data: convs, error } = await db.from('ss_yuri_conversations')
    .select('id, conversation_type, specialist_type').order('updated_at', { ascending: false }).limit(60)
  if (error) throw error
  const general: Array<{ id: string; specialist_type: string | null; messages: Array<{ role: string; content: string }> }> = []
  const onboarding: typeof general = []
  for (const c of convs ?? []) {
    const { data: m, error: mErr } = await db.from('ss_yuri_messages').select('role, content').eq('conversation_id', c.id).order('created_at')
    if (mErr) throw mErr
    if (!m || m.length < 6) continue
    const entry = { id: c.id, specialist_type: c.specialist_type, messages: m as Array<{ role: string; content: string }> }
    if (c.conversation_type === 'onboarding') { if (onboarding.length < PER) onboarding.push(entry) }
    else if (general.length < PER) general.push(entry)
    if (general.length >= PER && onboarding.length >= PER) break
  }

  for (const c of general) {
    const user = c.messages.find((m) => m.role === 'user')?.content ?? ''
    const asst = c.messages.find((m) => m.role === 'assistant')?.content ?? ''
    await run('title', () => generateTitle(user, asst))
    const hist = c.messages.slice(0, -1) as never
    await run('summary', () => generateConversationSummary(hist, c.messages[c.messages.length - 1].content))
    await run('decision_memory', () => extractDecisionMemory(c.id, c.messages.slice(-20), 'America/Chicago', [], new Date()))
    await run('patterns_conversation', () => extractPatternsFromConversation({ id: c.id, specialist_type: c.specialist_type, messages: c.messages.slice(-20), user_skin_type: null, user_concerns: [] }))
  }
  for (const c of onboarding) {
    await run('onboarding_extraction', () => extractSkinProfileData(c.messages as Array<{ role: 'user' | 'assistant'; content: string }>))
  }

  const { data: reviews, error: rErr } = await db.from('ss_reviews')
    .select('id, product_id, rating, body, skin_type, skin_concerns, reaction, usage_duration').not('body', 'is', null).limit(PER)
  if (rErr) throw rErr
  for (const r of reviews ?? []) await run('patterns_review', () => extractPatternsFromReview(r as never))

  const { data: staged, error: sErr } = await db.from('ss_product_staging').select('raw_data').not('raw_data', 'is', null).limit(PER)
  if (sErr) throw sErr
  for (const s of staged ?? []) await run('product_extraction', () => extractProductData(s.raw_data as never))

  writeFileSync(OUT, JSON.stringify(rows, null, 2))
  const by: Record<string, { n: number; cap: number; max45: number; max55: number; over: number; cut45: number; cut55: number; json55: number; ms45: number; ms55: number }> = {}
  for (const r of rows) {
    const b = (by[r.site] ??= { n: 0, cap: r.cap, max45: 0, max55: 0, over: 0, cut45: 0, cut55: 0, json55: 0, ms45: 0, ms55: 0 })
    b.ms45 = Math.max(b.ms45, Number(r.s45.ms))
    b.ms55 = Math.max(b.ms55, Number(r.s55.ms))
    b.n++
    b.max45 = Math.max(b.max45, Number(r.s45.out))
    b.max55 = Math.max(b.max55, Number(r.s55.out))
    if (!r.s55.fits_cap) b.over++
    if (r.s45.stop === 'max_tokens') b.cut45++
    if (r.s55.stop !== 'end_turn') b.cut55++
    if (r.s55.json) b.json55++
  }
  console.table(by)
}
main().catch((e) => { console.error(e); process.exit(1) })
