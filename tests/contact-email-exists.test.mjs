/**
 * Guard: every @seoulsister.com address we show a user must actually accept mail.
 *
 * Aug 7 2026. Yuri told Bailey to email support@seoulsister.com to sync a profile
 * field. That mailbox does not exist. Neither did privacy@ or legal@ — the stated
 * contacts on the Privacy Policy and Terms pages. Probed at the mail server
 * (mx1.privateemail.com, SMTP RCPT): team@ returns 250; support@, privacy@,
 * legal@ and yuri@ all return 450 "Recipient address rejected", identical to a
 * nonsense address. So three plausible-looking addresses were bouncing, and the
 * one real inbox appeared NOWHERE in the codebase.
 *
 * This test is deliberately OFFLINE — it asserts the allowlist, not live SMTP, so
 * it can't flake on a network blip or hammer the mail server in CI. Re-probe by
 * hand when adding an address (see src/lib/contact.ts).
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Addresses verified to ACCEPT mail (SMTP 250). Adding to this list requires
 * provisioning the mailbox in the Namecheap PrivateEmail console FIRST — a
 * Scott-only action — and re-probing. Never add one speculatively.
 */
const DELIVERABLE = new Set(['team@seoulsister.com'])

/**
 * SEND-ONLY: can send via Resend, has no inbox. Legal to appear in a From
 * header; NEVER legal to hand to a user as somewhere to write.
 */
const SEND_ONLY = new Set(['yuri@seoulsister.com'])

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (entry === 'node_modules' || entry === '.next') continue
      walk(full, out)
    } else if (/\.(ts|tsx|mjs|js)$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const files = walk('src')
const ADDR_RE = /[a-zA-Z0-9._%+-]+@seoulsister\.com/g

test('no user-facing surface references an address that bounces', () => {
  const offenders = []
  for (const file of files) {
    // contact.ts documents the dead addresses on purpose, in prose, to explain
    // why they must not be used. Its own exported constants are checked below.
    if (file.endsWith(join('lib', 'contact.ts'))) continue

    const src = readFileSync(file, 'utf8')
    for (const [addr] of src.matchAll(ADDR_RE)) {
      if (DELIVERABLE.has(addr)) continue
      if (SEND_ONLY.has(addr)) continue
      offenders.push(`${file}: ${addr}`)
    }
  }
  assert.deepEqual(
    offenders,
    [],
    'These addresses do not accept mail — a user emailing them gets a bounce:\n  ' +
      offenders.join('\n  ')
  )
})

test('the send-only address is never offered as a contact (mailto/href)', () => {
  const offenders = []
  for (const file of files) {
    const src = readFileSync(file, 'utf8')
    for (const addr of SEND_ONLY) {
      // A mailto: to a send-only address sends the user into a black hole.
      if (src.includes(`mailto:${addr}`)) offenders.push(`${file}: mailto:${addr}`)
    }
  }
  assert.deepEqual(offenders, [], offenders.join('\n  '))
})

test('contact.ts exports only a deliverable address as THE contact', async () => {
  const src = readFileSync(join('src', 'lib', 'contact.ts'), 'utf8')
  const m = src.match(/export const CONTACT_EMAIL = '([^']+)'/)
  assert.ok(m, 'CONTACT_EMAIL export not found')
  assert.ok(
    DELIVERABLE.has(m[1]),
    `CONTACT_EMAIL is ${m[1]}, which is not a verified-deliverable address`
  )
})

test("Yuri's prompt names only the deliverable address", () => {
  const src = readFileSync(join('src', 'lib', 'yuri', 'advisor.ts'), 'utf8')
  for (const [addr] of src.matchAll(ADDR_RE)) {
    assert.ok(
      DELIVERABLE.has(addr),
      `advisor.ts prompt tells users to email ${addr}, which bounces`
    )
  }
  // She must be told not to invent one — the failure was a plausible guess, not
  // a typo, so removing the bad string alone does not prevent a recurrence.
  assert.ok(
    /ONLY email address you may ever give/i.test(src),
    'the do-not-invent-an-address instruction was removed from the prompt'
  )
})
