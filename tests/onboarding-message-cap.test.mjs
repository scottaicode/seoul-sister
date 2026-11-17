/**
 * Guard test — free-onboarding message cap + skip clobber guard.
 *
 * Context (July 24 2026): commit 68acafe moved the paywall AFTER onboarding,
 * making /api/yuri/onboarding the one Yuri surface reachable without a
 * subscription. Its send_message action had NO cap — unlimited free Opus for
 * any registered account. Review of the first fix attempt found two would-be
 * silent no-ops this test locks against:
 *
 *   1. The cap must count via an EXACT ss_yuri_messages query, never from the
 *      loaded `history` — loadConversationMessages bridge-truncates past 50
 *      total messages (HEAD 4 + TAIL 40), so a history-derived user-message
 *      count saturates near ~22 and a 50-cap would never fire.
 *   2. skipOnboarding must not clobber a finalized profile with defaults
 *      (skin_type 'normal') when a completed user hits the always-visible
 *      skip link — which the cap's error copy points at.
 *
 * Pure structural assertions — no DB, no compile. Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const routeSrc = readFileSync(
  join(__dirname, '..', 'src', 'app', 'api', 'yuri', 'onboarding', 'route.ts'),
  'utf8'
)
const onboardingLibSrc = readFileSync(
  join(__dirname, '..', 'src', 'lib', 'yuri', 'onboarding.ts'),
  'utf8'
)

// --- Cap exists and is enforced with a 429 ----------------------------------

test('a lifetime user-message cap is declared and reaches the route', () => {
  // The constant moved from the route to lib/yuri/onboarding.ts on July 31 2026
  // when Yuri's turn-state block began reporting the user's position against it
  // — one number, two readers, so it must not be duplicated. What matters is
  // that exactly one declaration exists and the route uses THAT one.
  const declaredInLib = /export const ONBOARDING_USER_MESSAGE_CAP = \d+/.test(
    onboardingLibSrc
  )
  const declaredInRoute = /const ONBOARDING_USER_MESSAGE_CAP = \d+/.test(routeSrc)

  assert.ok(
    declaredInLib || declaredInRoute,
    'ONBOARDING_USER_MESSAGE_CAP constant must exist'
  )
  assert.ok(
    !(declaredInLib && declaredInRoute),
    'cap must be declared once, not duplicated across route and lib'
  )
  assert.ok(
    /ONBOARDING_USER_MESSAGE_CAP/.test(routeSrc),
    'the route must still reference the cap to enforce it'
  )
})

test('cap check returns 429 with a stable machine code', () => {
  assert.ok(
    /code: 'onboarding_message_cap'/.test(routeSrc),
    "cap rejection must carry code 'onboarding_message_cap'"
  )
  const capBlock = routeSrc.slice(
    routeSrc.indexOf("code: 'onboarding_message_cap'") - 600,
    routeSrc.indexOf("code: 'onboarding_message_cap'") + 200
  )
  assert.ok(/status: 429/.test(capBlock), 'cap rejection must be a 429')
})

// --- The count must be truncation-immune ------------------------------------

test('cap counts via an exact ss_yuri_messages query, not the truncated history', () => {
  assert.ok(
    /\.from\('ss_yuri_messages'\)\s*\n\s*\.select\('id', \{ count: 'exact', head: true \}\)/.test(
      routeSrc
    ),
    'must use an exact head-count query on ss_yuri_messages'
  )
  assert.ok(
    /\.eq\('role', 'user'\)/.test(routeSrc),
    'count must filter to user-role messages'
  )
})

test('cap check runs before the user message is saved or history loaded', () => {
  const sendIdx = routeSrc.indexOf("parsed.action === 'send_message'")
  const countIdx = routeSrc.indexOf("count: 'exact'", sendIdx)
  const capIdx = routeSrc.indexOf('ONBOARDING_USER_MESSAGE_CAP', sendIdx)
  const historyIdx = routeSrc.indexOf('await loadConversationMessages(', sendIdx)
  const saveIdx = routeSrc.indexOf("saveMessage(progress.conversation_id, 'user'", sendIdx)
  assert.ok(sendIdx > 0 && countIdx > sendIdx, 'exact count must live in send_message')
  assert.ok(capIdx > sendIdx && capIdx < historyIdx, 'cap check must precede history load')
  assert.ok(capIdx < saveIdx, 'cap check must precede saveMessage')
})

// --- Skip must not clobber a finalized profile ------------------------------

test('at the message limit the way out is Finish setup, which keeps what was learned', () => {
  // The limit used to point at the skip link, which could reset a profile.
  // There is no skip now; the limit is the one case where setup finishes with
  // something missing, and it goes through the same finalize as any finish.
  assert.equal(/export async function skipOnboarding/.test(onboardingLibSrc), false)
  assert.ok(onboardingLibSrc.includes('if (!checkOnboardingComplete(extracted) && opts?.atLimit !== true) return'))
})

