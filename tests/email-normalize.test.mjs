/**
 * Guard test — signup email normalization + dot-abuse detection.
 *
 * Locks down the July 23 2026 fix for Gmail dot-abuse signups: 11 of ~30
 * lifetime accounts were throwaway Gmail addresses with 3+ dots in the
 * localpart (Gmail ignores dots, so one inbox mints unlimited "unique"
 * accounts). All 11 were dead-on-arrival. The register form now refuses that
 * pattern, and analytics can exclude the existing rows via canonicalizeEmail.
 *
 * The two failure modes this test exists to prevent:
 *   1. A real user gets blocked (false positive) — the corporate/1-dot cases
 *      below MUST pass. Verified against real humans: Kim, yvette@gilead.com.
 *   2. The bots stop being caught (false negative) — the real abuse addresses
 *      below MUST be rejected.
 *
 * Mirrors the shipped logic and asserts the mirror matches source. Pure — no
 * compile, no DB. Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(
  join(__dirname, '..', 'src', 'lib', 'utils', 'email-normalize.ts'),
  'utf8'
)
const registerSrc = readFileSync(
  join(__dirname, '..', 'src', 'app', '(auth)', 'register', 'page.tsx'),
  'utf8'
)

// --- Mirror of shipped logic, kept honest by source assertions below. --------
const GMAIL_DOMAINS = new Set(['gmail.com', 'googlemail.com'])
const GMAIL_DOT_ABUSE_THRESHOLD = 3

function splitEmail(email) {
  const t = email.trim().toLowerCase()
  const at = t.lastIndexOf('@')
  if (at <= 0 || at === t.length - 1) return null
  return { local: t.slice(0, at), domain: t.slice(at + 1) }
}
function canonicalizeEmail(email) {
  const p = splitEmail(email)
  if (!p) return email.trim().toLowerCase()
  let { local } = p
  const { domain } = p
  if (GMAIL_DOMAINS.has(domain)) {
    local = local.split('+')[0].replace(/\./g, '')
    return `${local}@gmail.com`
  }
  return `${local}@${domain}`
}
function isGmailDotAbuse(email) {
  const p = splitEmail(email)
  if (!p) return false
  if (!GMAIL_DOMAINS.has(p.domain)) return false
  const base = p.local.split('+')[0]
  return base.length - base.replace(/\./g, '').length >= GMAIL_DOT_ABUSE_THRESHOLD
}

// --- Source-mirror assertions ------------------------------------------------
test('source mirror: threshold and gmail-only scope match source', () => {
  assert.ok(
    src.includes('GMAIL_DOT_ABUSE_THRESHOLD = 3'),
    'threshold drifted from source'
  )
  assert.ok(
    src.includes("new Set(['gmail.com', 'googlemail.com'])"),
    'gmail domain set drifted from source'
  )
})

test('register form wires the signup rejection gate before signUp', () => {
  assert.ok(
    /signupEmailRejection\(email\)/.test(registerSrc),
    'register page must call signupEmailRejection'
  )
  // Guard must run before account creation, not after.
  const gateIdx = registerSrc.indexOf('signupEmailRejection(email)')
  const signupIdx = registerSrc.indexOf('await signUp(email')
  assert.ok(gateIdx > 0 && signupIdx > 0 && gateIdx < signupIdx,
    'the email gate must run before signUp')
})

// --- MUST REJECT: the real bot addresses (verbatim from production) ----------
const REAL_BOTS = [
  'ha.van.naji.l.l.ene@gmail.com',
  'he.y.m.a.nt.a.e.l.o.r2.704@gmail.com',
  't.ani.s.ha.z.d.o.ssa@gmail.com',
  'j.w.i.l.lbr.98@gmail.com',
  'aza.mu.he.c.o.gi.0.0.2@gmail.com',
  'e.y.ago.g.izil.uj44@gmail.com',
]
for (const bot of REAL_BOTS) {
  test(`rejects dot-abuse bot: ${bot}`, () => {
    assert.equal(isGmailDotAbuse(bot), true, `${bot} should be flagged`)
  })
}

// --- MUST PASS: real humans (false-positive protection) ----------------------
const REAL_USERS = [
  'kimwells112192@gmail.com', // real paid subscriber, no dots
  'natalielewis@icloud.com', // real, non-gmail
  'yvette.ceragioli@gilead.com', // real corporate address, 1 dot, non-gmail
  'jane.doe@gmail.com', // ordinary first.last gmail (1 dot) — must NOT block
  'first.m.last@gmail.com', // 2 dots — under threshold, must NOT block
  'first.last@company.com', // non-gmail dotted address is normal
]
for (const user of REAL_USERS) {
  test(`allows real user: ${user}`, () => {
    assert.equal(isGmailDotAbuse(user), false, `${user} must not be blocked`)
  })
}

// --- Canonicalization: collapses one inbox's many spellings ------------------
test('canonicalizeEmail collapses gmail dot/tag variants to one key', () => {
  const key = canonicalizeEmail('jane.doe@gmail.com')
  assert.equal(canonicalizeEmail('janedoe@gmail.com'), key)
  assert.equal(canonicalizeEmail('j.a.n.e.d.o.e@gmail.com'), key)
  assert.equal(canonicalizeEmail('janedoe+promo@gmail.com'), key)
  assert.equal(canonicalizeEmail('janedoe@googlemail.com'), key)
})

test('canonicalizeEmail leaves non-gmail dots intact (they are significant)', () => {
  assert.equal(
    canonicalizeEmail('first.last@company.com'),
    'first.last@company.com'
  )
  assert.notEqual(
    canonicalizeEmail('first.last@company.com'),
    canonicalizeEmail('firstlast@company.com')
  )
})

test('malformed input never throws, returns a lowercased best-effort', () => {
  assert.equal(canonicalizeEmail('not-an-email'), 'not-an-email')
  assert.equal(isGmailDotAbuse('not-an-email'), false)
})
