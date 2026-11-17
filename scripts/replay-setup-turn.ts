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
import { buildOnboardingSystemPrompt, buildOnboardingTurnState, calculateOnboardingQuality, ONBOARDING_USER_MESSAGE_CAP } from '../src/lib/yuri/onboarding'
import { withTrailingContext, markPenultimateAssistant } from '../src/lib/llm-request'
import type { ExtractedSkinProfile } from '../src/types/database'

async function main() {
  const [conversationId, nRaw, runsRaw, pattern] = process.argv.slice(2)
  const runs = Number(runsRaw || 6)
  const db = getServiceClient()
  const { data, error } = await db.from('ss_yuri_messages').select('role, content, created_at').eq('conversation_id', conversationId).order('created_at').range(0, 199)
  if (error) throw new Error(error.message)
  const list = (data ?? []) as Array<{ role: 'user' | 'assistant'; content: string }>
  const userIdx = list.map((m, i) => (m.role === 'user' ? i : -1)).filter((i) => i >= 0)
  const at = userIdx[Number(nRaw) - 1]
  if (at === undefined) throw new Error('no such user message')
  const history = list.slice(0, at).map((m) => ({ role: m.role, content: m.content }))
  const message = list[at].content
  console.log(`turn: "${message}"`)
  const extracted = {} as ExtractedSkinProfile
  const turnState = buildOnboardingTurnState(extracted, calculateOnboardingQuality(extracted).suggestions, { isSubscribed: true, userMessageNumber: Number(nRaw), userMessageCap: ONBOARDING_USER_MESSAGE_CAP })
  const messages = withTrailingContext(markPenultimateAssistant([...history, { role: 'user' as const, content: message }]), turnState)
  const client = getAnthropicClient()
  const re = pattern ? new RegExp(pattern, 'i') : null
  let hits = 0
  for (let run = 1; run <= runs; run++) {
    const res = await client.messages.create({ model: MODELS.chat, max_tokens: 6000, output_config: { effort: CHAT_EFFORT }, system: [{ type: 'text' as const, text: buildOnboardingSystemPrompt({}) }], messages } as Parameters<typeof client.messages.create>[0])
    const reply = responseText(res as { content: Array<{ type: string; text?: string }> })
    const hit = re ? reply.match(re)?.[0] : null
    if (hit) hits++
    console.log(`\n[run ${run}]${re ? ` match: ${hit ?? 'none'}` : ''}\n${reply}`)
  }
  if (re) console.log(`\n${hits}/${runs} replies matched /${pattern}/`)
}
main().catch((e) => { console.error(e); process.exit(1) })
