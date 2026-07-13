/**
 * Companion to diagnose-yuri-cache-bytediff.ts.
 *
 * Isolates the TWO per-turn variable inputs that sit inside the cache_control'd
 * system block, and shows which prompt SECTIONS each one adds/removes per turn:
 *
 *   1. classifyIntent(message)  -> loadUserContext conditionally loads sections
 *   2. detectSpecialist(message) -> appends/removes the ACTIVE SPECIALIST block
 *
 * Read-only. No API calls.
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'
import { classifyIntent } from '../src/lib/yuri/memory'
import { detectSpecialist } from '../src/lib/yuri/specialists'

const CONV_ID = process.argv[2] || '7e3abe74-9355-4b66-a7dd-76786122961e'

async function main() {
  const db = getServiceClient()
  const { data: msgs } = await db
    .from('ss_yuri_messages')
    .select('role, content')
    .eq('conversation_id', CONV_ID)
    .order('created_at', { ascending: true })

  if (!msgs?.length) throw new Error('no messages')

  console.log(`\nPer-turn variable inputs to the CACHED block — conv ${CONV_ID}\n`)
  console.log('turn | loadAll | specialist        | topics                  | message')
  console.log('-----+---------+-------------------+-------------------------+--------')

  let turn = 0
  let prevKey = ''
  for (let i = 0; i < msgs.length; i++) {
    const m = msgs[i] as { role: string; content: string }
    if (m.role !== 'user') continue
    turn++
    const isFirst = i === 0
    const topics = classifyIntent(m.content, isFirst)
    const loadAll = topics.has('general')
    const spec = detectSpecialist(m.content)
    const key = `${loadAll}|${spec}|${[...topics].sort().join(',')}`
    const changed = prevKey && key !== prevKey ? '  <-- CACHE BREAKS' : ''
    console.log(
      `${String(turn).padStart(4)} | ${String(loadAll).padEnd(7)} | ${String(spec).padEnd(17)} | ${[...topics].sort().join(',').padEnd(23)} | ${m.content.slice(0, 40).replace(/\n/g, ' ')}${changed}`
    )
    prevKey = key
  }
}

main().catch((e) => { console.error(e); process.exit(1) })
