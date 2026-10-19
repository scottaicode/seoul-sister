/**
 * Decision-memory recall on Sonnet 5.5: thinking off (between_tools) vs adaptive
 * thinking at low effort, vs Sonnet 4.5, on one real conversation where 5.5
 * (thinking off) missed a Fitzpatrick I->II correction that 4.5 caught.
 * Read-only. Run: npx tsx --tsconfig tsconfig.json scripts/ab-decision-memory-thinking.ts <conversationId> [runs]
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'
import { getAnthropicClient } from '../src/lib/anthropic'
import { extractDecisionMemory } from '../src/lib/yuri/memory'

const CONV = process.argv[2]
const RUNS = Number(process.argv[3] || 3)
const client = getAnthropicClient()
const m = client.messages as unknown as { create: (p: Record<string, unknown>) => Promise<{ usage: { output_tokens: number } }> }
const raw = m.create
let variant: Record<string, unknown> = {}
let lastOut = 0
m.create = async (p) => { const r = await raw({ ...p, ...variant, max_tokens: 16000 }); lastOut = r.usage.output_tokens; return r }

async function main() {
  const db = getServiceClient()
  const { data: msgs, error } = await db.from('ss_yuri_messages').select('role, content').eq('conversation_id', CONV).order('created_at')
  if (error || !msgs) throw error
  const hist = (msgs as Array<{ role: string; content: string }>).slice(-20)
  const variants: Array<[string, Record<string, unknown>]> = [
    ['4.5', { model: 'claude-sonnet-4-5-20250929' }],
    ['5.5 off', { model: 'claude-sonnet-5-5', thinking: { type: 'between_tools' } }],
    ['5.5 adaptive low', { model: 'claude-sonnet-5-5', thinking: { type: 'adaptive' }, output_config: { effort: 'low' } }],
  ]
  for (const [label, v] of variants) {
    for (let i = 0; i < RUNS; i++) {
      variant = v
      const out = await extractDecisionMemory(CONV, hist, 'America/Chicago', [], new Date())
      const inc = out?.incoming as unknown as Record<string, unknown[]> | undefined
      const all = JSON.stringify(out ?? {})
      const fitz = /fitzpatrick/i.test(all)
      console.log(`${label.padEnd(18)} run ${i + 1}: fitzpatrick=${fitz} decisions=${inc?.decisions?.length ?? 0} prefs=${inc?.preferences?.length ?? 0} commitments=${inc?.commitments?.length ?? 0} corrections=${inc?.corrections?.length ?? 0} loops=${inc?.open_loops?.length ?? 0} out_tokens=${lastOut}`)
    }
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
