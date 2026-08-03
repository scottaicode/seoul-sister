/**
 * Guard test — the email ask must be legible, and confusion must not burn the one ask.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 * Aug 3 2026, a real cold visitor arriving from an ingredient page. Yuri answered a
 * glycerin-sourcing question well — twice refusing to guess at an INCI she couldn't
 * verify, which is the honesty moat working. Then she made the email offer, in the exact
 * words the prompt modelled:
 *
 *     "want me to hang onto your email so we can pick this thread back up next time"
 *
 * The visitor replied: "Can I use gmail instead of email?"
 *
 * They read "email" as a service they might not have, rather than an address to type.
 * They were trying to say yes. Yuri answered warmly, the capture never completed, and
 * `captured_email` stayed NULL. A real lead, on the only surface with a measured
 * conversion record (16.4% email capture), lost to an ambiguous noun.
 *
 * TWO THINGS HAD TO CHANGE
 * 1. The ask has to name a concrete action ("type your email address") rather than an
 *    abstraction ("hang onto your email"), and say what actually arrives.
 * 2. Confusion in reply to the ask is NOT a refusal. The prompt caps Yuri at one ask —
 *    correctly, since re-asking reads as nagging — but without an exception a confused
 *    "what do you mean?" spends that one ask and the visitor can never give it.
 *
 * WHY THIS IS A FACT AND NOT A SCRIPT
 * The fix hands Yuri the failure and the reasoning, then explicitly tells her to adapt to
 * the person rather than recite a line. A visitor writing fluent ingredient questions
 * needs a different touch than someone typing in a second language. Scripting the exact
 * sentence would be the anti-pattern the Yuri Sole Authority Principle exists to prevent,
 * and the widget give/gate has already failed twice by rewording a rule instead of
 * supplying a better fact.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROUTE = join(__dirname, '..', 'src', 'app', 'api', 'widget', 'chat', 'route.ts')

/**
 * The static system prompt body.
 *
 * The prompt itself contains backticks (inline code in the guidance), so a naive
 * "first backtick after the declaration" scan truncates it mid-way and every
 * assertion below silently passes against a fragment. Walk to the CLOSING backtick
 * that terminates the declaration instead — the one followed by the statement end.
 */
function widgetSystemPrompt() {
  const src = readFileSync(ROUTE, 'utf8')
  const decl = src.indexOf('const YURI_WIDGET_SYSTEM = `')
  assert.ok(decl > -1, 'const YURI_WIDGET_SYSTEM must exist')
  const open = src.indexOf('`', decl)

  // Scan forward for a backtick that ends the template literal: the next
  // non-whitespace character is the end of the statement, not more prose.
  for (let i = open + 1; i < src.length; i++) {
    if (src[i] !== '`' || src[i - 1] === '\\') continue
    const after = src.slice(i + 1, i + 40)
    if (/^\s*(;|\n\s*(const|export|function|\/\*|\/\/))/.test(after)) {
      return src.slice(open + 1, i)
    }
  }
  throw new Error('could not find the end of the YURI_WIDGET_SYSTEM template literal')
}

test('the real failure is recorded so the reasoning survives a reword', () => {
  const p = widgetSystemPrompt()

  assert.match(
    p, /Can I use gmail instead of email\?/,
    'the actual visitor reply must be quoted — a future editor who only sees abstract advice will smooth it away'
  )
  assert.match(
    p, /Aug 3 2026/,
    'the failure should be dated so its age can be judged'
  )
})

test('Yuri is told to name the concrete action, not an abstraction', () => {
  const p = widgetSystemPrompt()

  assert.match(
    p, /type your email address/i,
    'the prompt must model a concrete action; "hang onto your email" is what failed'
  )
  assert.match(
    p, /send you a write-up|what actually arrives/i,
    'the visitor must be told what they get, not just asked for an address'
  )
})

test('confusion does not count as the one ask', () => {
  const p = widgetSystemPrompt()

  // Without this, the ask-once rule silently converts a would-be lead into a dead end.
  assert.match(
    p, /not a refusal and it does not count as your one ask/i,
    'a confused reply must not spend the single permitted ask'
  )
  assert.match(
    p, /re-offer in the same breath/i,
    'Yuri must answer the confusion AND re-offer, since the visitor was trying to say yes'
  )
  assert.match(
    p, /any provider/i,
    'the specific confusion was provider-shaped ("gmail instead of email") and must be answerable'
  )
})

test('it stays a fact for judgment, never a script', () => {
  const p = widgetSystemPrompt()

  assert.match(
    p, /Don't recite a script/i,
    'the instruction must explicitly refuse scripting — the give/gate failed twice by rewording rules'
  )
  assert.match(
    p, /read them and adapt/i,
    'Yuri must be told to adapt to the person rather than apply one wording'
  )
  // The ask-once discipline is load-bearing and must survive this change.
  assert.match(
    p, /ask ONCE, then let it rest/,
    'the anti-nagging rule must remain intact'
  )
})

test('the addition cannot break the prompt cache', () => {
  const src = readFileSync(ROUTE, 'utf8')
  const section = src.slice(
    src.indexOf("Make sure they understand WHAT you're asking for"),
    src.indexOf('But ask ONCE, then let it rest')
  )
  assert.ok(section.length > 0, 'expected the new section to exist')

  // v11.1.0 regression: appending per-turn strings to the cached block silently killed
  // the prompt cache. The static block must stay byte-stable across turns.
  assert.ok(
    !/\$\{/.test(section),
    'no template interpolation may appear in the cached system block'
  )
})
