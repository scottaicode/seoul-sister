/**
 * Background-model A/B: Sonnet 4.5 (production) vs Sonnet 5.5 (thinking off via
 * `between_tools`) on the REAL decision-memory extraction prompt, read from
 * memory.ts, over real recent Yuri conversations. Read-only: nothing is saved.
 *
 * Run: npx tsx --tsconfig tsconfig.json scripts/ab-background-sonnet55-extraction.ts <outFile> [n]
 */
import './load-env'
import { readFileSync, writeFileSync } from 'fs'
import { getServiceClient } from '../src/lib/supabase'
import { getAnthropicClient } from '../src/lib/anthropic'
import type Anthropic from '@anthropic-ai/sdk'

const OUT = process.argv[2] || 'bg-ab.json'
const N = Number(process.argv[3] || 6)

function promptTemplate(): string {
  const s = readFileSync('src/lib/yuri/memory.ts', 'utf-8')
  const i = s.indexOf('content: `Analyze this K-beauty advisor conversation') + 'content: `'.length
  let j = i
  while (j < s.length) { if (s[j] === '\\') { j += 2; continue } if (s[j] === '`') break; j++ }
  return s.slice(i, j)
}

async function main() {
  const db = getServiceClient()
  const { data: convs, error } = await db.from('ss_yuri_conversations').select('id').order('created_at', { ascending: false }).limit(40)
  if (error) throw error
  const tpl = promptTemplate()
  const fill = new Function('today', 'clock', 'transcript', 'return `' + tpl + '`') as (t: string, c: { weekday: string; timezone: string }, tr: string) => string
  const client = getAnthropicClient()
  const out: unknown[] = []
  for (const c of convs ?? []) {
    if (out.length >= N) break
    const { data: msgs } = await db.from('ss_yuri_messages').select('role, content').eq('conversation_id', c.id).order('created_at', { ascending: true })
    if (!msgs || msgs.length < 8) continue
    const transcript = msgs.slice(-20).map((m) => `${m.role === 'user' ? 'User' : 'Yuri'}: ${(m.content as string).slice(0, 1200)}`).join('\n')
    const prompt = fill('2026-10-07', { weekday: 'Wednesday', timezone: 'America/Chicago' }, transcript)
    const row: Record<string, unknown> = { conversation: c.id, messages: msgs.length }
    for (const [label, model, extra] of [['sonnet45', 'claude-sonnet-4-5-20250929', {}], ['sonnet55', 'claude-sonnet-5-5', { thinking: { type: 'between_tools' } }]] as const) {
      const params = { model, max_tokens: 800, messages: [{ role: 'user', content: prompt }], ...extra }
      const r = await client.messages.create(params as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming)
      const text = r.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text').map((b) => b.text).join('')
      let parses = false
      try { JSON.parse((text.match(/\{[\s\S]*\}/) ?? [''])[0]); parses = true } catch { /* not JSON */ }
      const rate = model === 'claude-sonnet-5-5' ? { in: 2, out: 10 } : { in: 3, out: 15 }
      row[label] = { stop: r.stop_reason, in: r.usage.input_tokens, out: r.usage.output_tokens, cost: (r.usage.input_tokens * rate.in + r.usage.output_tokens * rate.out) / 1e6, parses, text }
      console.log(c.id.slice(0, 8), label, r.stop_reason, 'out', r.usage.output_tokens, 'json', parses)
    }
    out.push(row)
  }
  writeFileSync(OUT, JSON.stringify(out, null, 2))
}
main().catch((e) => { console.error(e); process.exit(1) })
