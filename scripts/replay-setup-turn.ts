/**
 * Replays ONE turn of a real setup chat several times with the current prompt
 * and prints the replies. Read-only. For counting how often a reply states
 * something the person did not say at that turn (Nov 16 2026: told "Northern
 * California", Yuri wrote "even on gray Bay Area days").
 *
 *   npx tsx scripts/replay-setup-turn.ts <conversationId> <userMessageNumber> [runs=6] [regex to count]
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'
import { getAnthropicClient, MODELS, CHAT_EFFORT, responseText } from '../src/lib/anthropic'
import { buildOnboardingSystemPrompt, buildOnboardingTurnState, calculateOnboardingQuality, extractSkinProfileData, ONBOARDING_USER_MESSAGE_CAP, SETUP_LOOKUP_ROUNDS, SETUP_LOOKUP_TOOL_NAMES, runSetupLookup } from '../src/lib/yuri/onboarding'
import { YURI_TOOLS } from '../src/lib/yuri/tools'
import { missingSetupRequirements } from '../src/lib/yuri/setup-requirements'
import { withTrailingContext, markPenultimateAssistant } from '../src/lib/llm-request'
import type { ExtractedSkinProfile } from '../src/types/database'

async function main() {
  const [conversationId, nRaw, runsRaw, pattern] = process.argv.slice(2)
  const runs = Number(runsRaw || 6)
  const db = getServiceClient()
  const { data, error } = await db.from('ss_yuri_messages').select('role, content, created_at').eq('conversation_id', conversationId).order('created_at').range(0, 199)
  if (error) throw new Error(error.message)
  const { data: conv } = await db.from('ss_yuri_conversations').select('user_id').eq('id', conversationId).single()
  const userId = (conv?.user_id as string) ?? ''
  const list = (data ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>
  const userIdx = list.map((m, i) => (m.role === 'user' ? i : -1)).filter((i) => i >= 0)
  const at = userIdx[Number(nRaw) - 1]
  if (at === undefined) throw new Error('no such user message')
  const history = list.slice(0, at).map((m) => ({ role: m.role, content: m.content }))
  const message = list[at].content
  console.log(`turn: "${message}"`)
  // What setup would hold at this turn: the record as of the previous turn, as in production.
  const extracted = (history.length > 1 ? await extractSkinProfileData(history) : {}) as ExtractedSkinProfile
  console.log(`still required at this turn: ${missingSetupRequirements(extracted).map((r) => r.key).join(', ') || 'nothing'}`)
  const turnState = buildOnboardingTurnState(extracted, calculateOnboardingQuality(extracted).suggestions, { isSubscribed: true, userMessageNumber: Number(nRaw), userMessageCap: ONBOARDING_USER_MESSAGE_CAP })
  const messages = withTrailingContext(markPenultimateAssistant([...history, { role: 'user' as const, content: message }]), turnState)
  const client = getAnthropicClient()
  const re = pattern ? new RegExp(pattern, 'i') : null
  let hits = 0
  // As a member: the two read-only lookups the setup chat has, run for real.
  const tools = (YURI_TOOLS as unknown as Array<{ name: string }>).filter((t) => (SETUP_LOOKUP_TOOL_NAMES as readonly string[]).includes(t.name))
  for (let run = 1; run <= runs; run++) {
    const msgs: unknown[] = [...(messages as unknown[])]
    const used: string[] = []
    let reply = ''
    for (let round = 0; round <= SETUP_LOOKUP_ROUNDS; round++) {
      const res = await client.messages.create({ model: MODELS.chat, max_tokens: 6000, output_config: { effort: CHAT_EFFORT }, system: [{ type: 'text' as const, text: buildOnboardingSystemPrompt({}) }], messages: msgs, tools } as unknown as Parameters<typeof client.messages.create>[0])
      const content = (res as { content: Array<{ type: string; text?: string; id?: string; name?: string; input?: unknown }> }).content
      const text = content.filter((c) => c.type === 'text').map((c) => c.text ?? '').join('')
      if (text) reply += (reply ? '\n\n' : '') + text
      const uses = content.filter((c) => c.type === 'tool_use')
      if (uses.length === 0) break
      msgs.push({ role: 'assistant', content })
      const results = []
      for (const u of uses) {
        used.push(`${u.name}(${JSON.stringify(u.input).slice(0, 90)})`)
        results.push({ type: 'tool_result', tool_use_id: u.id, content: await runSetupLookup(u.name!, u.input as Record<string, unknown>, userId) })
      }
      msgs.push({ role: 'user', content: results })
    }
    const hit = re ? reply.match(re)?.[0] : null
    if (hit) hits++
    console.log(`\n[run ${run}] lookups: ${used.join('; ') || 'none'}${re ? `  match: ${hit ?? 'none'}` : ''}\n${reply}`)
  }
  if (re) console.log(`\n${hits}/${runs} replies matched /${pattern}/`)
}
main().catch((e) => { console.error(e); process.exit(1) })
