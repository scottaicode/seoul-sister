/**
 * Replays ONE message to the member chat for a real member, several times,
 * with the current prompt and that member's real context. Nothing is written:
 * every tool that writes is simulated, and the conversation is not saved.
 *
 * Why this exists (Nov 17 2026): two members reached the member chat without
 * being asked the setup safety questions. Their context now says so. This
 * counts whether Yuri asks first, and whether she names a product before the
 * answer.
 *
 *   npx tsx scripts/replay-member-turn.ts <userId> "<message>" [runs=5]
 */
import './load-env'
import { getAnthropicClient, MODELS, CHAT_EFFORT } from '../src/lib/anthropic'
import { YURI_TOOLS, executeYuriTool } from '../src/lib/yuri/tools'
import { detectSpecialist } from '../src/lib/yuri/specialists'
import type Anthropic from '@anthropic-ai/sdk'

const WRITE_TOOLS = new Set(['add_to_routine', 'remove_from_routine', 'update_user_product', 'mark_product_reaction', 'clear_product_reaction', 'save_routine'])

async function main() {
  const [userId, message, runsRaw] = process.argv.slice(2)
  if (!userId || !message) throw new Error('usage: <userId> "<message>" [runs]')
  const runs = Number(runsRaw || 5)
  const memory = await import('../src/lib/yuri/memory')
  const advisor = await import('../src/lib/yuri/advisor')
  const client = getAnthropicClient()
  const ctx = await memory.loadUserContext(userId, undefined, { message, isFirstMessage: true })
  const built = advisor.buildSystemPrompt(ctx, detectSpecialist(message), [])
  const safetyNote = built.cachedBlocks.join('\n').match(/## (Safety questions?[^\n]*|Medical History[^\n]*)/)?.[0]
  console.log(`context section: ${safetyNote ?? '(none found)'}\nmessage: ${message}`)
  const system = built.cachedBlocks.map((text) => ({ type: 'text' as const, text, cache_control: { type: 'ephemeral' as const } }))
  const tools = YURI_TOOLS.map((t, i) => (i === YURI_TOOLS.length - 1 ? { ...t, cache_control: { type: 'ephemeral' as const } } : t))
  for (let run = 1; run <= runs; run++) {
    const msgs: unknown[] = [{ role: 'user', content: message }, { role: 'system', content: (built.specialistBlock + built.clockBlock).trim() }]
    const used: string[] = []
    let text = ''
    for (let loop = 0; loop <= 6; loop++) {
      const res = await client.messages.create({ model: MODELS.chat, max_tokens: 8000, system, messages: msgs, tools, output_config: { effort: CHAT_EFFORT } } as unknown as Anthropic.Messages.MessageCreateParamsNonStreaming)
      const uses = res.content.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use')
      if (uses.length === 0 || loop === 6) {
        text = res.content.filter((b): b is Anthropic.Messages.TextBlock => b.type === 'text').map((b) => b.text).join('')
        break
      }
      msgs.push({ role: 'assistant', content: res.content.filter((b) => b.type !== 'text') })
      const results = []
      for (const u of uses) {
        used.push(u.name)
        const out = WRITE_TOOLS.has(u.name) ? JSON.stringify({ success: true, note: 'replay: write simulated, nothing saved' }) : await executeYuriTool(u.name, u.input as Record<string, unknown>, userId)
        results.push({ type: 'tool_result', tool_use_id: u.id, content: out })
      }
      msgs.push({ role: 'user', content: results })
    }
    console.log(`\n[run ${run}] tools: ${used.join(', ') || 'none'}\n${text}`)
  }
}
main().catch((e) => { console.error(e); process.exit(1) })
