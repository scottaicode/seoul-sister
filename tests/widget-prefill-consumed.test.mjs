/**
 * Guard tests — the `?ask=` prefill must be CONSUMED, and a wiped conversation
 * must be restorable.
 *
 * THE DEFECT (Aug 18 2026). `?ask=` survived in the URL after being read, so it
 * re-populated the input on every load. The first organic blog visitor sent the
 * identical canned line from blog-prefill.ts as messages #1, #3 and #8 of her
 * 12 LIFETIME free messages — a quarter of her quota on a question she never
 * typed. Occurrence #2 was 60 seconds after her substantive answer: a
 * mid-conversation reload, which showed her an EMPTY chat (messages live in
 * React state only) even though the server held the whole transcript and had
 * been rehydrating it for YURI since v11.2.0.
 *
 * The duplicate then got laundered into her stored ai_memory as "Visitor
 * repeated initial question, suggesting possible uncertainty about accepting
 * the redirected advice" — a UI bug turned into a durable false read.
 *
 * WHY THE ORDERING ASSERTIONS ARE LOAD-BEARING. Stripping `ask` is only safe
 * because SignedInRedirect reads it FIRST: it keeps a signed-in user on the
 * landing page only when ask/from/hash is present, and otherwise bounces them
 * to /dashboard. It is mounted earlier in page.tsx than TryYuriSection, so its
 * effect has already run. Reorder that JSX (or lazy-load it) and a paying
 * subscriber clicking a feeder CTA gets yanked to /dashboard — the Bailey PWA
 * class of bug. Likewise the strip must follow the attribution capture and the
 * prefillArrived event, both of which read the params.
 *
 * Run: `npm test`
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const widget = readFileSync(join(root, 'src/components/widget/TryYuriSection.tsx'), 'utf8')
const page = readFileSync(join(root, 'src/components/home/HomeClient.tsx'), 'utf8')
const redirect = readFileSync(join(root, 'src/components/auth/SignedInRedirect.tsx'), 'utf8')

test('the ask param is deleted and the URL rewritten, so a reload cannot re-arm it', () => {
  assert.match(
    widget,
    /params\.delete\(['"]ask['"]\)/,
    'the consumed `ask` param must be deleted'
  )
  assert.match(
    widget,
    /window\.history\.replaceState\(/,
    'the URL must be rewritten with replaceState (pushState would break the back button)'
  )
  assert.ok(
    !/window\.history\.pushState\(/.test(widget),
    'pushState must NOT be used — it would add a history entry and break Back'
  )
})

test('the strip runs AFTER the attribution capture and the prefillArrived event', () => {
  const sourceIdx = widget.indexOf("sourceRef.current = 'landing'")
  const trackIdx = widget.indexOf('DemoEvent.prefillArrived')
  const stripIdx = widget.indexOf("params.delete('ask')")

  assert.ok(sourceIdx > 0 && trackIdx > 0 && stripIdx > 0, 'all three sites must exist')
  assert.ok(
    stripIdx > sourceIdx,
    'stripping before the attribution floor would blind source capture'
  )
  assert.ok(
    stripIdx > trackIdx,
    'stripping before prefillArrived would lose the has_question/source payload'
  )
})

test('SignedInRedirect still gates on ask, and mounts BEFORE the widget that strips it', () => {
  // If this ever stops reading `ask`, the ordering constraint below is moot —
  // but so is the redirect's own guarantee, so it must be asserted.
  assert.match(
    redirect,
    /params\.has\(['"]ask['"]\)/,
    'SignedInRedirect must still treat ?ask= as intent to stay on the landing page'
  )

  const redirectIdx = page.indexOf('<SignedInRedirect')
  const widgetIdx = page.indexOf('<TryYuriSection')
  assert.ok(redirectIdx > 0, '<SignedInRedirect /> must be mounted on the landing page')
  assert.ok(widgetIdx > 0, '<TryYuriSection /> must be mounted on the landing page')
  assert.ok(
    redirectIdx < widgetIdx,
    'SignedInRedirect MUST mount before TryYuriSection: its effect has to read ?ask= ' +
      'before the widget strips it, or a signed-in subscriber following a feeder CTA ' +
      'is redirected to /dashboard'
  )
})

test('a wiped conversation is restored from the server, and cannot clobber a live one', () => {
  assert.match(
    widget,
    /\/api\/widget\/transcript\?session_id=/,
    'the widget must fetch the stored transcript to repaint after a reload'
  )
  // The re-check inside the setter is what makes the async restore safe: the
  // visitor may have started typing while the fetch was in flight.
  assert.match(
    widget,
    /setMessages\(\(current\)\s*=>\s*\{[\s\S]{0,400}?if \(current\.length > 0\) return current/,
    'the restore must re-check emptiness INSIDE the state setter, not only before the fetch'
  )
})

test('the transcript endpoint requires the visitor to own the session', () => {
  const route = readFileSync(join(root, 'src/app/api/widget/transcript/route.ts'), 'utf8')
  assert.match(
    route,
    /\.eq\(['"]visitor_id['"],\s*visitorId\)/,
    'a session id alone must not authorise reading a transcript — the visitor_id must match'
  )
  // A failed lookup must not be reported as "no such session"; that is the
  // silent-failure class this repo keeps paying for.
  assert.match(
    route,
    /if \(sessionError\)/,
    'the session lookup error must be checked, not discarded'
  )
})
