/**
 * Count the cache breakpoints ACTUALLY SENT on each round of a real tool turn, and
 * on the turn that follows it. No API calls — pure inspection of the request shape
 * production builds.
 *
 * The remaining question after 7 falsified hypotheses:
 *   Production: every miss (rd=6,300 = tools only, ~24K system rewritten) lands on the
 *   turn AFTER a tool turn. The 20-block lookback is NOT exceeded (2 blocks/turn —
 *   measured). So WHAT does a tool turn do that a non-tool turn doesn't?
 *
 * Suspect: applyCacheControl runs ONCE PER ROUND (advisor.ts:899, inside the while
 * loop) on a GROWING loopMessages. Its guard is:
 *
 *     msg.role === 'assistant' && typeof msg.content === 'string' && idx === len - 2
 *
 * Round 0 of a tool turn: len-2 is a string assistant message -> marker placed.
 * Round 1+:               len-2 is the assistant(tool_use) message, whose content is
 *                         an ARRAY -> the string guard SKIPS it -> NO messages
 *                         breakpoint on that round.
 *
 * So a tool turn's FINAL round (the one that actually answers, and whose cache entry
 * the next turn would want to read) may be written with a DIFFERENT breakpoint layout
 * than the next turn sends. This prints the exact layout per round so we can see it
 * rather than argue about it.
 *
 * Read-only.
 */
import './load-env'
import type Anthropic from '@anthropic-ai/sdk'

/** Verbatim copy of production's helper (advisor.ts). */
function applyCacheControl(msgs: Anthropic.Messages.MessageParam[]) {
  return msgs.map((msg, idx) => {
    if (
      msg.role === 'assistant' &&
      typeof msg.content === 'string' &&
      idx === msgs.length - 2
    ) {
      return {
        role: 'assistant' as const,
        content: [
          { type: 'text' as const, text: msg.content, cache_control: { type: 'ephemeral' as const } },
        ],
      }
    }
    return msg
  })
}

function countMarkers(msgs: Anthropic.Messages.MessageParam[]): number {
  let n = 0
  for (const m of msgs) {
    if (Array.isArray(m.content)) {
      for (const b of m.content) {
        if ((b as { cache_control?: unknown }).cache_control) n++
      }
    }
  }
  return n
}

function describe(label: string, msgs: Anthropic.Messages.MessageParam[]) {
  const marked = applyCacheControl(msgs)
  const n = countMarkers(marked)
  const idx = marked.findIndex(
    (m) =>
      Array.isArray(m.content) &&
      m.content.some((b) => (b as { cache_control?: unknown }).cache_control)
  )
  console.log(
    `  ${label.padEnd(46)} len=${String(msgs.length).padStart(2)}  ` +
    `msg-breakpoints=${n}  at idx=${idx === -1 ? '—  (NONE!)' : idx}  ` +
    `| total breakpoints sent = ${2 + n} (tools + system + msgs)`
  )
}

function main() {
  console.log('\nWhat production sends, round by round.')
  console.log('(tools block = 1 breakpoint, system block = 1 breakpoint, always present)\n')

  // --- A NON-TOOL turn (turn N, after some history) -------------------------
  console.log('NON-TOOL TURN (these always HIT in production):')
  const plain: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: 'earlier question' },
    { role: 'assistant', content: 'earlier answer' },
    { role: 'user', content: 'ok thanks' },
  ]
  describe('round 0 (only round)', plain)

  // --- A TOOL turn ----------------------------------------------------------
  console.log('\nTOOL TURN (the turn AFTER one of these always MISSES):')
  const loop: Anthropic.Messages.MessageParam[] = [
    { role: 'user', content: 'earlier question' },
    { role: 'assistant', content: 'earlier answer' },
    { role: 'user', content: "what's the price on the Anua toner?" },
  ]
  describe('round 0  (pre-tool)', loop)

  // Production mutates loopMessages in place (advisor.ts ~1059/1090):
  loop.push({
    role: 'assistant',
    content: [{ type: 'tool_use', id: 'toolu_1', name: 'compare_prices', input: {} }],
  })
  loop.push({
    role: 'user',
    content: [{ type: 'tool_result', tool_use_id: 'toolu_1', content: '...' }],
  })
  describe('round 1  (post-tool — THE ANSWERING ROUND)', loop)

  console.log(
    '\nREAD THIS:\n' +
    '  The answering round of a tool turn is the one whose cache entry the NEXT turn\n' +
    '  needs to read. If that round sends a DIFFERENT number of breakpoints (or none)\n' +
    '  in the messages array than the next turn sends, the next turn cannot match the\n' +
    '  messages prefix — and per the tiered invalidation model it falls back to the\n' +
    '  longest prefix it CAN match: the tools block. That is exactly 6,300 tokens.\n'
  )
}

main()
