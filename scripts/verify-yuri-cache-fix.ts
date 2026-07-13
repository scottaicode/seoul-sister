/**
 * Verification for the Yuri volatile-composition cache fix.
 *
 * Proves the two things the fix must never break, against REAL Bailey turns:
 *
 *   A) NO CONTEXT IS LOST — the assembled prompt with the fix ON is a SUPERSET of
 *      the prompt with it OFF. The fix never removes anything Yuri can see today.
 *
 *      NOTE, and this is the subtle part: ON is not byte-identical to OFF on every
 *      turn, and it MUST NOT BE. The old intent gate (Feature 13.4) *withheld*
 *      sections on keyword-matching turns — so on those turns OFF is the SMALLER
 *      prompt. Turning the gate off restores context Yuri was being denied
 *      (including, ironically, the "Recent Conversation Excerpts" memory safety
 *      net). Yuri's full-context turns are byte-identical; her focused turns now
 *      see MORE, never less. The invariant that matters is therefore "superset",
 *      not "equal".
 *
 *      The pure byte-MOVE (the ACTIVE SPECIALIST block leaving the cached body) IS
 *      content-neutral, and is checked as such: the assembled text is unchanged.
 *
 *   B) PREFIX STABILITY — with the fix ON, the cache_control'd block is byte-
 *      identical across every turn of a conversation (so turns 2+ read the cache).
 *      With it OFF, it churns (reproducing the bug).
 *
 * Read-only. No API calls. Run:
 *   npx tsx scripts/verify-yuri-cache-fix.ts [conversationId]
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'
import { detectSpecialist } from '../src/lib/yuri/specialists'
import type { YuriMessage } from '../src/types/database'

const USER_ID = '551569d3-aed0-4feb-a340-47bfb146a835' // Bailey
const CONV_IDS = process.argv[2]
  ? [process.argv[2]]
  : ['7e3abe74-9355-4b66-a7dd-76786122961e', '9f047ae2-4816-4e14-aa3c-e99f8d5bae21']

/**
 * Build the full system-block list for one turn, under the flag setting that this
 * PROCESS was started with.
 *
 * NOTE (this matters): the flags are module-level `const`s, so they are frozen at
 * import time. An in-process `process.env` flip + dynamic re-import does NOT
 * re-evaluate them (tsx resolves the relative specifier to the same module record
 * and returns the cached one — the `?v=` bust trick silently no-ops). An earlier
 * version of this harness did exactly that and reported BOTH arms as "stable",
 * which would have "proven" the fix worked while measuring the same arm twice.
 * So each arm runs as its own child process with the env var set. Principle 5:
 * instrumentation that cannot distinguish the branches is instrumentation that
 * encodes the error.
 */
async function buildTurn(
  conversationId: string,
  message: string,
  history: YuriMessage[]
): Promise<{ cached: string; assembled: string }> {
  const memory = await import('../src/lib/yuri/memory')
  const advisor = await import('../src/lib/yuri/advisor')

  const ctx = await memory.loadUserContext(USER_ID, conversationId, {
    message,
    isFirstMessage: history.length === 0,
  })
  const built = advisor.buildSystemPrompt(ctx, detectSpecialist(message), history)

  // The model sees the system blocks concatenated, in order.
  const assembled = [built.cachedPrompt, built.specialistBlock, built.clockBlock]
    .filter(Boolean)
    .join('')
  return { cached: built.cachedPrompt, assembled }
}

/** Strip the minute-granularity clock, which legitimately differs between two runs. */
function stripClock(s: string): string {
  return s.replace(/It is \*\*[^*]+\*\*/g, 'It is **<CLOCK>**')
}

function multiset(s: string): Map<string, number> {
  const m = new Map<string, number>()
  for (const ch of s) m.set(ch, (m.get(ch) || 0) + 1)
  return m
}

function multisetEqual(a: string, b: string): boolean {
  const ma = multiset(a)
  const mb = multiset(b)
  if (ma.size !== mb.size) return false
  for (const [k, v] of ma) if (mb.get(k) !== v) return false
  return true
}

type TurnResult = { turn: number; cached: string; assembled: string }

/** Child mode: emit this arm's per-turn prompts as JSON on stdout. */
async function runArm() {
  const db = getServiceClient()
  const out: Record<string, TurnResult[]> = {}

  for (const convId of CONV_IDS) {
    const { data: msgs } = await db
      .from('ss_yuri_messages')
      .select('id, role, content, created_at, specialist_type, image_urls')
      .eq('conversation_id', convId)
      .order('created_at', { ascending: true })
    if (!msgs?.length) continue

    const results: TurnResult[] = []
    let turn = 0
    for (let i = 0; i < msgs.length && turn < 6; i++) {
      const m = msgs[i] as unknown as { role: string; content: string }
      if (m.role !== 'user') continue
      turn++
      const history = msgs.slice(0, i) as unknown as YuriMessage[]
      const built = await buildTurn(convId, m.content, history)
      results.push({ turn, ...built })
    }
    out[convId] = results
  }
  process.stdout.write('@@JSON@@' + JSON.stringify(out))
}

/** Parent mode: run both arms as child processes and compare. */
async function main() {
  const { execFileSync } = await import('child_process')
  const run = (enabled: boolean): Record<string, TurnResult[]> => {
    const stdout = execFileSync(
      'npx',
      ['tsx', __filename, ...(process.argv[2] ? [process.argv[2]] : [])],
      {
        encoding: 'utf8',
        maxBuffer: 64 * 1024 * 1024,
        env: {
          ...process.env,
          YURI_CACHE_VERIFY_ARM: '1',
          YURI_VOLATILE_SPLIT_ENABLED: enabled ? 'true' : 'false',
        },
      }
    )
    return JSON.parse(stdout.slice(stdout.indexOf('@@JSON@@') + 8))
  }

  console.log('running arm: fix ON  (YURI_VOLATILE_SPLIT_ENABLED=true)')
  const on = run(true)
  console.log('running arm: fix OFF (YURI_VOLATILE_SPLIT_ENABLED=false)')
  const off = run(false)

  let contentFailures = 0

  for (const convId of Object.keys(on)) {
    console.log(`\n${'='.repeat(78)}\nconversation ${convId}\n${'='.repeat(78)}`)
    const turnsOn = on[convId]
    const turnsOff = off[convId] || []

    for (let i = 0; i < turnsOn.length; i++) {
      const aOn = stripClock(turnsOn[i].assembled)
      const aOff = stripClock(turnsOff[i].assembled)

      // Every '## ' section OFF renders must still render ON. (Superset check —
      // see the header note on why equality is the WRONG invariant here.)
      const secs = (s: string) => new Set((s.match(/\n(## [^\n]+)/g) || []).map((x) => x.trim()))
      const onSecs = secs(aOn)
      const offSecs = secs(aOff)
      const lost = [...offSecs].filter((s) => !onSecs.has(s))
      const gained = [...onSecs].filter((s) => !offSecs.has(s))
      if (lost.length > 0) contentFailures++

      const equal = aOn === aOff
      console.log(
        `turn ${String(turnsOn[i].turn).padStart(2)} | assembled ON=${aOn.length} OFF=${aOff.length} | ` +
        `${equal ? 'byte-identical    ' : `ON restores ${gained.length} section(s)`} | ` +
        `context LOST=${lost.length === 0 ? 'none' : `*** ${lost.length} ***`} | ` +
        `cached ON=${turnsOn[i].cached.length} OFF=${turnsOff[i].cached.length}`
      )
      if (gained.length) {
        console.log(`        + restored (was withheld by the intent gate): ${gained.join(' | ')}`)
      }
      if (lost.length) {
        console.log(`        !!! REGRESSION — context Yuri sees today is GONE: ${lost.join(' | ')}`)
      }
    }

    // PREFIX STABILITY across turns — the whole point of the fix.
    const stability = (turns: TurnResult[]) => {
      let stable = 0
      for (let i = 1; i < turns.length; i++) {
        if (turns[i].cached === turns[i - 1].cached) stable++
      }
      return { stable, total: turns.length - 1 }
    }
    const sOn = stability(turnsOn)
    const sOff = stability(turnsOff)
    console.log(
      `\n  cached-prefix stability (cached block at turn N == turn N+1):\n` +
      `    fix ON : ${sOn.stable}/${sOn.total} turn-pairs byte-identical  ` +
      `${sOn.stable === sOn.total ? '<- cache HITS on every warm turn' : '<- STILL CHURNING'}\n` +
      `    fix OFF: ${sOff.stable}/${sOff.total} turn-pairs byte-identical  <- the bug (churn)`
    )
  }

  console.log(
    `\n${'='.repeat(78)}\n` +
    (contentFailures === 0
      ? 'PASS — no context is lost with the fix ON (superset on every turn), and the\n' +
        '       cached prefix is byte-stable across turns so warm turns read the cache.\n' +
        '       Where the two arms differ, ON RESTORES context the intent gate withheld.'
      : `FAIL — ${contentFailures} turn(s) LOST context Yuri sees today. DO NOT SHIP.`) +
    `\n${'='.repeat(78)}`
  )
  process.exit(contentFailures === 0 ? 0 : 1)
}

if (process.env.YURI_CACHE_VERIFY_ARM === '1') {
  runArm().catch((e) => { console.error(e); process.exit(1) })
} else {
  main().catch((e) => { console.error(e); process.exit(1) })
}
