/**
 * Guard test — onboarding double-greeting race fix.
 *
 * Bug (July 23 2026): Kim's onboarding opened with TWO different Yuri greetings
 * 0.9s apart. Root cause was a check-then-act race with no atomicity:
 *   - client: the mount effect fired start_onboarding twice (React 18 Strict
 *     Mode / fast re-mount), with no ran-once guard;
 *   - server: it generated a greeting whenever `messages.length === 0`, but the
 *     greeting is SAVED only after the ~0.9s stream ends — so both concurrent
 *     requests read zero messages and both generated + saved a greeting.
 * Observed live: 1 of 3 onboardings double-greeted.
 *
 * The fix is defense-in-depth and this test locks BOTH layers against
 * regression by asserting their structural shape in source (pure — no DB, no
 * compile). Run: `npm test`.
 *
 *   Layer 1 (client): a useRef ran-once guard that returns before firing.
 *   Layer 2 (server): an atomic conditional UPDATE claim
 *     (.is('greeting_started_at', null)) — only the winner generates a greeting.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const clientSrc = readFileSync(
  join(__dirname, '..', 'src', 'app', '(app)', 'onboarding', 'page.tsx'),
  'utf8'
)
const routeSrc = readFileSync(
  join(__dirname, '..', 'src', 'app', 'api', 'yuri', 'onboarding', 'route.ts'),
  'utf8'
)
const migrationSrc = readFileSync(
  join(__dirname, '..', 'scripts', 'migrations', 'add_onboarding_greeting_lock.sql'),
  'utf8'
)

// --- Layer 1: client ran-once guard -----------------------------------------
test('client declares a ran-once ref for the start effect', () => {
  assert.ok(
    /const startedRef = useRef\(false\)/.test(clientSrc),
    'startedRef ran-once guard must exist'
  )
})

test('client guard returns before firing start_onboarding a second time', () => {
  // The guard must appear inside the mount effect and short-circuit.
  assert.ok(
    /if \(startedRef\.current\) return\s*\n\s*startedRef\.current = true/.test(clientSrc),
    'the effect must return early when startedRef is already set, then set it'
  )
  // ...and it must sit ahead of the init() call so the duplicate never fetches.
  const guardIdx = clientSrc.indexOf('if (startedRef.current) return')
  const initCallIdx = clientSrc.indexOf('init()\n    return () => { cancelled = true }')
  assert.ok(guardIdx > 0 && initCallIdx > guardIdx, 'guard must precede init() call')
})

// --- Layer 2: server atomic claim -------------------------------------------
test('server claims the greeting with a conditional UPDATE on null', () => {
  assert.ok(
    /\.update\(\{ greeting_started_at: nowIso \}\)/.test(routeSrc),
    'server must set greeting_started_at'
  )
  assert.ok(
    /\.is\('greeting_started_at', null\)/.test(routeSrc),
    "claim must be conditional on greeting_started_at IS null (atomic)"
  )
})

test('server only greets when the claim is won', () => {
  // A lost claim must clear greetingClaimed so no greeting is generated.
  assert.ok(
    /greetingClaimed = false/.test(routeSrc),
    'a lost claim must set greetingClaimed = false'
  )
  assert.ok(
    /if \(greetingClaimed && progress\.conversation_id\)/.test(routeSrc),
    'greeting generation must be gated on the won claim'
  )
})

test('server fails OPEN if the lock column is missing (pre-migration)', () => {
  // A column-missing error must not suppress the greeting (tolerated), so
  // onboarding still works before the migration is applied.
  assert.ok(
    /greeting_started_at/.test(routeSrc) &&
      /claimError && !\/greeting_started_at\//.test(routeSrc),
    'column-missing claim error must be tolerated (fail open)'
  )
})

// --- Migration ---------------------------------------------------------------
test('migration adds the nullable lock column idempotently', () => {
  assert.ok(
    /ADD COLUMN IF NOT EXISTS greeting_started_at timestamptz/.test(migrationSrc),
    'migration must add greeting_started_at timestamptz IF NOT EXISTS'
  )
  assert.ok(
    !/NOT NULL/.test(migrationSrc.split('greeting_started_at')[1] || ''),
    'the column must be nullable (null = greeting not started)'
  )
})
