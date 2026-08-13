/**
 * Guard test — the widget's auto-scroll must target the SCROLLING element.
 *
 * THE DEFECT (found Aug 13 2026). The scroll effect wrote
 * `container.scrollTop = container.scrollHeight` to a ref that sat on the inner
 * `p-4 space-y-3` wrapper. The element carrying `overflow-y-auto` was its
 * PARENT. Setting scrollTop on a non-overflowing element is a silent no-op, so
 * the widget never auto-scrolled — for its entire life. Nothing surfaced it,
 * because a chat that doesn't follow its own stream reads as a styling choice.
 *
 * WHERE IT COST US. The chat box is capped at 640px and the paywall card
 * renders as the LAST child, below the final answer. After a long closing
 * message the card sits outside the visible region, and `scrollbar-hide`
 * removes any cue that there is more below. A real visitor on Aug 13 2026
 * (visitor 1ce3b6ce) read a ~1,400-character final answer at the end of a
 * 12-message conversation; the card mounted correctly and she plausibly never
 * saw it. That is the end of the lead-generation funnel failing on a DOM bug,
 * which would have looked like a messaging problem forever.
 *
 * WHY THIS TEST PARSES STRUCTURE. A regex for `scrollTop = scrollHeight`
 * passes against the broken code — the effect body was always correct. The
 * defect was WHICH ELEMENT the ref was attached to, so that is what gets
 * asserted here.
 *
 * Run: `npm test`
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const COMPONENT = join(__dirname, '..', 'src', 'components', 'widget', 'TryYuriSection.tsx')
const src = readFileSync(COMPONENT, 'utf8')

/** The ref identifier the scroll effect actually reads. */
function scrollRefName() {
  const m = src.match(/const\s+container\s*=\s*(\w+)\.current[\s\S]{0,120}?scrollTop\s*=\s*container\.scrollHeight/)
  assert.ok(m, 'the scroll effect must read a ref and assign scrollTop = scrollHeight')
  return m[1]
}

/** Every JSX element carrying `ref={<name>}`, with its className. */
function elementsWithRef(refName) {
  const out = []
  const re = new RegExp(`<div([^>]*\\bref=\\{${refName}\\}[^>]*)>`, 'g')
  let m
  while ((m = re.exec(src))) {
    const attrs = m[1]
    const cls = attrs.match(/className="([^"]*)"/)
    out.push(cls ? cls[1] : '')
  }
  return out
}

test('the scroll ref is attached to exactly one element', () => {
  const ref = scrollRefName()
  const hosts = elementsWithRef(ref)
  assert.equal(
    hosts.length,
    1,
    `expected exactly one element carrying ref={${ref}}, found ${hosts.length}`
  )
})

test('THE BUG: the scroll ref must sit on the element that actually scrolls', () => {
  const ref = scrollRefName()
  const [cls] = elementsWithRef(ref)

  assert.match(
    cls,
    /overflow-y-auto/,
    `ref={${ref}} is attached to an element whose className is "${cls}", which has no ` +
      'overflow-y-auto. Writing scrollTop to a non-overflowing element is a silent no-op — ' +
      'this is the exact defect that hid the paywall card below the fold.'
  )
})

test('the inner message wrapper does NOT hold the scroll ref', () => {
  // The original bug: ref on `p-4 space-y-3`, overflow on the parent.
  assert.doesNotMatch(
    src,
    /<div\s+ref=\{\w+\}\s+className="p-4 space-y-3">/,
    'the padding wrapper is not the scroll container; attaching the ref there ' +
      'reintroduces the no-op'
  )
})

test('the effect re-runs when the paywall card appears, not only on new messages', () => {
  const m = src.match(/scrollTop\s*=\s*container\.scrollHeight[\s\S]{0,80}?\},\s*\[([^\]]*)\]/)
  assert.ok(m, 'the scroll effect must declare a dependency array')
  const deps = m[1]

  assert.match(deps, /messages/, 'must scroll on new messages')
  assert.match(
    deps,
    /isAtLimit/,
    'the paywall card is driven by messageCount — a SEPARATE state update from ' +
      'messages. Depending on messages alone scrolls to the bottom of the last ' +
      'bubble one render BEFORE the card exists, leaving it below the fold.'
  )
})

test('the paywall card is still the last child of the scrolling region', () => {
  // If this stops being true the fold risk changes shape and the fix above
  // needs revisiting rather than silently continuing to "pass".
  const cardIdx = src.indexOf('That&apos;s everything I can remember for free.')
  assert.ok(cardIdx > -1, 'the paywall card copy must exist')
  const gate = src.lastIndexOf('{isAtLimit && (', cardIdx)
  assert.ok(gate > -1 && gate < cardIdx, 'the card must be gated on isAtLimit')
})
