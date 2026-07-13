/**
 * Step 1 of YURI-CACHE-REGRESSION-BLUEPRINT: prove the invalidator with a byte-diff.
 *
 * Replays a REAL Bailey conversation turn-by-turn through the REAL production code
 * path (loadUserContext -> buildSystemPrompt) and diffs the cached block between
 * consecutive turns. Reports first_diff_at_char and the % of the prompt after it.
 *
 * No API calls. Read-only DB.
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'
import { loadUserContext } from '../src/lib/yuri/memory'
import { buildSystemPrompt } from '../src/lib/yuri/advisor'
import { detectSpecialist } from '../src/lib/yuri/specialists'

const USER_ID = '551569d3-aed0-4feb-a340-47bfb146a835' // Bailey
const CONV_ID = process.argv[2] || '7e3abe74-9355-4b66-a7dd-76786122961e'

function firstDiff(a: string, b: string): number {
  const n = Math.min(a.length, b.length)
  for (let i = 0; i < n; i++) if (a[i] !== b[i]) return i
  return a.length === b.length ? -1 : n
}

function sectionAt(prompt: string, pos: number): string {
  // Walk backwards to the nearest "## " heading.
  const before = prompt.slice(0, pos)
  const idx = before.lastIndexOf('\n## ')
  if (idx === -1) return '(before any ## heading — i.e. the base system prompt)'
  return prompt.slice(idx + 1, prompt.indexOf('\n', idx + 1))
}

async function main() {
  const db = getServiceClient()
  const { data: msgs } = await db
    .from('ss_yuri_messages')
    .select('id, role, content, created_at, specialist_type, image_urls')
    .eq('conversation_id', CONV_ID)
    .order('created_at', { ascending: true })

  if (!msgs?.length) throw new Error('no messages')

  console.log(`\nConversation ${CONV_ID} — ${msgs.length} messages\n`)

  const prompts: { turn: number; msg: string; cached: string; specialist: string | null }[] = []

  // Replay each USER message as if it were the live turn. History = everything before it.
  let turn = 0
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i] as { role: string; content: string }
    if (m.role !== 'user') continue
    turn++
    if (turn > 6) break // 6 turns is plenty to see the pattern

    const history = msgs.slice(0, i) as unknown as Parameters<typeof buildSystemPrompt>[2]
    const specialistType = detectSpecialist(m.content)
    const ctx = await loadUserContext(USER_ID, CONV_ID, {
      message: m.content,
      isFirstMessage: history.length === 0,
    })
    const { cachedPrompt } = buildSystemPrompt(ctx, specialistType, history)
    prompts.push({ turn, msg: m.content.slice(0, 60), cached: cachedPrompt, specialist: specialistType })
  }

  for (let i = 1; i < prompts.length; i++) {
    const prev = prompts[i - 1]
    const cur = prompts[i]
    const pos = firstDiff(prev.cached, cur.cached)
    const total = cur.cached.length
    console.log(`--- turn ${prev.turn} -> ${cur.turn} ---`)
    console.log(`  msg N   : "${prev.msg}..."  specialist=${prev.specialist}`)
    console.log(`  msg N+1 : "${cur.msg}..."  specialist=${cur.specialist}`)
    console.log(`  len N=${prev.cached.length}  len N+1=${total}`)
    if (pos === -1) {
      console.log(`  IDENTICAL — cached block byte-stable (cache would HIT)`)
    } else {
      const pctAfter = (((total - pos) / total) * 100).toFixed(1)
      console.log(`  first_diff_at_char = ${pos}  (${((pos / total) * 100).toFixed(1)}% in)`)
      console.log(`  % of prompt AFTER first diff (rewritten) = ${pctAfter}%`)
      console.log(`  section at diff: ${sectionAt(cur.cached, pos)}`)
      console.log(`  ctx N   : ...${JSON.stringify(prev.cached.slice(pos - 60, pos + 60))}`)
      console.log(`  ctx N+1 : ...${JSON.stringify(cur.cached.slice(pos - 60, pos + 60))}`)
    }
    console.log()
  }

  // Section inventory of the last prompt
  const last = prompts[prompts.length - 1].cached
  console.log('--- section map (last turn) ---')
  const re = /\n(## [^\n]+)/g
  let mm
  while ((mm = re.exec(last)) !== null) {
    console.log(`  @${String(mm.index).padStart(6)}  ${mm[1]}`)
  }
  console.log(`  total chars: ${last.length}  (~${Math.round(last.length / 3.6)} tokens)`)
}

main().catch((e) => { console.error(e); process.exit(1) })
