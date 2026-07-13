/**
 * Minimal reproduction probe for the turn-2 SYSTEM-BLOCK cache miss.
 *
 * Live evidence (conv at 22:40 UTC Jul 13, a 2-turn conversation):
 *   turn 1 ("what's the price on the Anua...")  raw_in 1280  rd 29,059  wr 29,059
 *   turn 2 ("ok thanks", NINE tokens)           raw_in    9  rd  6,300  wr 23,238  -> $0.150
 *
 * rd=6,300 means the TOOLS block matched and the ~24K SYSTEM block did NOT.
 * Cache prefix order is tools -> system -> messages, so for tools to hit while
 * system misses, the system bytes MUST differ between the two turns.
 *
 * This builds BOTH turns' system prompts from live DB state, exactly as the route
 * does, and hashes them. If they differ, it prints the first differing byte and the
 * section it lands in. If they are identical, the invalidator is NOT the system text
 * and the search moves to the request shape.
 */
import './load-env'
import { createHash } from 'crypto'
import { getServiceClient } from '../src/lib/supabase'
import { loadUserContext } from '../src/lib/yuri/memory'
import { buildSystemPrompt } from '../src/lib/yuri/advisor'
import { detectSpecialist } from '../src/lib/yuri/specialists'
import type { YuriMessage } from '../src/types/database'

const USER_ID = '551569d3-aed0-4feb-a340-47bfb146a835'

async function main() {
  const db = getServiceClient()

  // The most recent conversation (the 2-turn repro).
  const { data: convs } = await db
    .from('ss_yuri_conversations')
    .select('id, created_at')
    .eq('user_id', USER_ID)
    .order('created_at', { ascending: false })
    .limit(1)
  const convId = convs?.[0]?.id as string
  console.log(`conversation: ${convId}\n`)

  const { data: msgs } = await db
    .from('ss_yuri_messages')
    .select('id, role, content, created_at, specialist_type, image_urls')
    .eq('conversation_id', convId)
    .order('created_at', { ascending: true })
  if (!msgs?.length) throw new Error('no messages')

  const build = async (userMsg: string, history: YuriMessage[], label: string) => {
    const spec = detectSpecialist(userMsg)
    const ctx = await loadUserContext(USER_ID, convId, {
      message: userMsg,
      isFirstMessage: history.length === 0,
    })
    const b = buildSystemPrompt(ctx, spec, history)
    const h = createHash('sha256').update(b.cachedPrompt).digest('hex').slice(0, 16)
    console.log(
      `${label}\n` +
      `  message        : "${userMsg.slice(0, 50)}"\n` +
      `  isFirstMessage : ${history.length === 0}\n` +
      `  specialist     : ${spec}\n` +
      `  cachedPrompt   : ${b.cachedPrompt.length} chars   sha=${h}\n` +
      `  specialistBlock: ${b.specialistBlock.length} chars\n` +
      `  clockBlock     : ${b.clockBlock.length} chars\n`
    )
    return b.cachedPrompt
  }

  // Turn 1: the tool question, empty history.
  const t1 = await build(msgs[0].content as string, [], 'TURN 1 (tool question, cold)')

  // Turn 2: "ok thanks", history = [user1, assistant1].
  const hist2 = msgs.slice(0, 2) as unknown as YuriMessage[]
  const t2msg = (msgs.find((m, i) => i >= 2 && m.role === 'user') as { content: string } | undefined)?.content
  if (!t2msg) { console.log('no turn-2 user message found'); return }
  const t2 = await build(t2msg, hist2, 'TURN 2 (the $0.15 miss)')

  console.log('='.repeat(70))
  if (t1 === t2) {
    console.log('SYSTEM BLOCKS ARE BYTE-IDENTICAL.')
    console.log('=> The system TEXT is not the invalidator. The cache miss must come')
    console.log('   from the REQUEST SHAPE (block layout / cache_control placement),')
    console.log('   not from the prompt content. Look at the systemBlocks array.')
  } else {
    let d = 0
    while (d < Math.min(t1.length, t2.length) && t1[d] === t2[d]) d++
    const before = t2.slice(0, d)
    const idx = before.lastIndexOf('\n## ')
    const section = idx === -1 ? '(base prompt)' : t2.slice(idx + 1, t2.indexOf('\n', idx + 1))
    console.log(`SYSTEM BLOCKS DIFFER. first_diff_at_char=${d} of ${t2.length}`)
    console.log(`  section : ${section}`)
    console.log(`  turn1   : ${JSON.stringify(t1.slice(d - 60, d + 60))}`)
    console.log(`  turn2   : ${JSON.stringify(t2.slice(d - 60, d + 60))}`)
    console.log(`  => ${(((t2.length - d) / t2.length) * 100).toFixed(1)}% of the prompt is rewritten.`)
  }
  console.log('='.repeat(70))
}

main().catch((e) => { console.error(e); process.exit(1) })
