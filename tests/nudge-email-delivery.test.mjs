/**
 * Guard test — proactive nudge email delivery (v11.23.0).
 *
 * THE GAP THIS CHANNEL CLOSES
 *
 * The nudge engine generated good, well-timed messages and delivered none of
 * them. A nudge rendered only on the dashboard, so it waited for the user to
 * return in order to deliver a message whose entire purpose is getting them to
 * return. Aug 3 2026: two paying subscribers each had an unsent nudge while
 * neither had signed in for days.
 *
 * THE DEFECTS THESE TESTS PREVENT
 *
 * 1. CANNIBALIZATION. /api/me/nudge selects WHERE status = 'pending' and
 *    YuriNudgeCard flips pending -> surfaced on render. If the email send moved
 *    `status`, the dashboard card would silently never appear for an emailed
 *    nudge. Channel state MUST live on the email_* columns only.
 *
 * 2. SILENT SEND FAILURE. Per v10.3.4, an outcome that isn't recorded is an
 *    outcome that didn't happen as far as anyone can tell. Every path —
 *    including the graceful no-provider no-op and a missing address — must
 *    persist a status.
 *
 * 3. HTML INJECTION from a model-generated body. The message is ours, but a
 *    generated string reaching an HTML document unescaped is an injection
 *    surface regardless of author.
 *
 * These tests EXECUTE the real module against a stubbed Supabase/fetch rather
 * than asserting on source text (feedback_source_tests_miss_runtime_bugs).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

/**
 * Transpile nudge-email.ts with its two module imports rewritten to local
 * stubs, so we execute the REAL logic without a database or network.
 */
async function loadNudgeEmail({ sendResult, captureUpdate }) {
  const dir = mkdtempSync(join(tmpdir(), 'nudge-email-'))

  // --- stub: lib/email/send ---
  writeFileSync(
    join(dir, 'send.mjs'),
    `export const __calls = []
export async function sendEmail(to, subject, html, options = {}) {
  __calls.push({ to, subject, html, options })
  return ${JSON.stringify(sendResult)}
}
export function wrapEmailHtml(bodyHtml, footerHtml) {
  return '<html><body>' + bodyHtml + '<hr>' + (footerHtml ?? '') + '</body></html>'
}`
  )

  // --- stub: lib/email/html (real implementation, it's pure) ---
  writeFileSync(
    join(dir, 'html.mjs'),
    ts.transpileModule(read('src', 'lib', 'email', 'html.ts'), {
      compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
    }).outputText
  )

  // --- stub: lib/supabase — records every update patch ---
  writeFileSync(
    join(dir, 'supabase.mjs'),
    `export const __updates = []
export function getServiceClient() {
  return {
    from(table) {
      const chain = {
        update(patch) { __updates.push({ table, patch }); return chain },
        eq() { return chain },
        not() { return chain },
        select() { return Promise.resolve({ data: [{ id: 'row-1' }], error: null }) },
        then(res) { return Promise.resolve({ data: null, error: null }).then(res) },
      }
      return chain
    },
  }
}`
  )

  let src = read('src', 'lib', 'email', 'nudge-email.ts')
  src = src
    .replace("from '@/lib/supabase'", "from './supabase.mjs'")
    .replace("from './send'", "from './send.mjs'")
    .replace("from './html'", "from './html.mjs'")

  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  writeFileSync(join(dir, 'nudge-email.mjs'), js)

  const mod = await import(pathToFileURL(join(dir, 'nudge-email.mjs')).href)
  const sendStub = await import(pathToFileURL(join(dir, 'send.mjs')).href)
  const dbStub = await import(pathToFileURL(join(dir, 'supabase.mjs')).href)
  return { mod, sendCalls: sendStub.__calls, updates: dbStub.__updates }
}

const baseInput = (overrides = {}) => ({
  nudgeId: 'nudge-1',
  message: 'Been thinking about your routine.\n\nThere is still that one blank spot.',
  deepLink: '/yuri?ask=picking%20back%20up',
  nudgeType: 'open_loop',
  nudgeSequence: 1,
  unsubscribeToken: '11111111-2222-3333-4444-555555555555',
  ...overrides,
})

// ---------------------------------------------------------------------------
// 1. The email must never touch `status` (cannibalization guard)
// ---------------------------------------------------------------------------

test('a successful send writes ONLY email_* columns, never status', async () => {
  const { mod, updates } = await loadNudgeEmail({
    sendResult: { sent: true, providerId: 'resend-abc' },
  })

  const status = await mod.sendNudgeEmail('sub@example.com', false, baseInput())
  assert.equal(status, 'sent')

  assert.ok(updates.length > 0, 'the send outcome must be persisted')
  for (const u of updates) {
    assert.equal(u.table, 'ss_user_nudges')
    assert.ok(
      !('status' in u.patch),
      'writing `status` would hide the nudge from the dashboard card — ' +
        'the email channel must not cannibalize the in-app surface'
    )
    assert.ok(
      !('surfaced_at' in u.patch) && !('acted_at' in u.patch),
      'lifecycle timestamps belong to the in-app surface only'
    )
  }

  const patch = updates[0].patch
  assert.equal(patch.email_status, 'sent')
  assert.equal(patch.email_provider_id, 'resend-abc')
  assert.ok(patch.email_sent_at, 'a successful send must stamp email_sent_at')
})

// ---------------------------------------------------------------------------
// 2. Every outcome is recorded — no silent failure
// ---------------------------------------------------------------------------

test('a provider failure is recorded as send_failed, not swallowed', async () => {
  const { mod, updates } = await loadNudgeEmail({
    sendResult: { sent: false, error: 'resend_422' },
  })

  const status = await mod.sendNudgeEmail('sub@example.com', false, baseInput())
  assert.equal(status, 'send_failed')
  assert.equal(updates[0].patch.email_status, 'send_failed')
  assert.ok(!updates[0].patch.email_sent_at, 'a failed send must not claim a send time')
})

test('an unconfigured provider records no_provider, distinct from a failure', async () => {
  const { mod, updates } = await loadNudgeEmail({
    sendResult: { sent: false, reason: 'no_provider' },
  })

  const status = await mod.sendNudgeEmail('sub@example.com', false, baseInput())
  assert.equal(
    status,
    'no_provider',
    'an unset API key is a graceful no-op and must stay distinguishable from a real failure'
  )
  assert.equal(updates[0].patch.email_status, 'no_provider')
})

test('a missing address records no_address and sends nothing', async () => {
  const { mod, updates, sendCalls } = await loadNudgeEmail({
    sendResult: { sent: true, providerId: 'x' },
  })

  const status = await mod.sendNudgeEmail(null, false, baseInput())
  assert.equal(status, 'no_address')
  assert.equal(sendCalls.length, 0, 'must not attempt a send with no recipient')
  assert.equal(updates[0].patch.email_status, 'no_address')
})

test('an opted-out subscriber is suppressed before any send', async () => {
  const { mod, updates, sendCalls } = await loadNudgeEmail({
    sendResult: { sent: true, providerId: 'x' },
  })

  const status = await mod.sendNudgeEmail('sub@example.com', true, baseInput())
  assert.equal(status, 'suppressed')
  assert.equal(sendCalls.length, 0, 'opt-out must be honored before the provider call')
  assert.equal(updates[0].patch.email_status, 'suppressed')
})

// ---------------------------------------------------------------------------
// 3. Body rendering
// ---------------------------------------------------------------------------

test("the generated message is escaped, not interpolated raw", async () => {
  const { mod } = await loadNudgeEmail({ sendResult: { sent: true } })

  const html = mod.buildNudgeEmailHtml(
    baseInput({ message: 'Your <script>alert(1)</script> routine & "toner"' })
  )

  assert.ok(!html.includes('<script>'), 'a raw <script> tag must never reach the body')
  assert.ok(html.includes('&lt;script&gt;'), 'the tag must be escaped')
  assert.ok(html.includes('&amp;'), 'ampersands must be escaped')
})

test('paragraph breaks in the generated message survive as separate paragraphs', async () => {
  const { mod } = await loadNudgeEmail({ sendResult: { sent: true } })
  const html = mod.buildNudgeEmailHtml(baseInput())
  const paragraphCount = (html.match(/<p style="margin:0 0 14px;">/g) || []).length
  assert.ok(
    paragraphCount >= 3,
    'greeting + two message paragraphs should each render separately'
  )
})

test('the CTA points at the deep link and is attributed to the email channel', async () => {
  const { mod } = await loadNudgeEmail({ sendResult: { sent: true } })
  const html = mod.buildNudgeEmailHtml(baseInput())

  assert.ok(
    html.includes('https://www.seoulsister.com/yuri?ask=picking%20back%20up&from=nudge_email'),
    'the CTA must preserve the prefilled ?ask= and add source attribution'
  )
})

test('a nudge with no deep link still gets a working CTA', async () => {
  const { mod } = await loadNudgeEmail({ sendResult: { sent: true } })
  const html = mod.buildNudgeEmailHtml(baseInput({ deepLink: null }))
  assert.ok(html.includes('https://www.seoulsister.com/yuri?from=nudge_email'))
})

// ---------------------------------------------------------------------------
// 4. Unsubscribe plumbing
// ---------------------------------------------------------------------------

test('the unsubscribe URL is passed to the transport for RFC 8058 headers', async () => {
  const { mod, sendCalls } = await loadNudgeEmail({
    sendResult: { sent: true, providerId: 'p' },
  })

  await mod.sendNudgeEmail('sub@example.com', false, baseInput())
  assert.equal(sendCalls.length, 1)
  assert.match(
    sendCalls[0].options.unsubscribeUrl,
    /nudge_token=11111111-2222-3333-4444-555555555555/,
    'List-Unsubscribe headers only get emitted when send.ts receives this URL'
  )
})

test('a missing token degrades gracefully rather than emitting a broken link', async () => {
  const { mod, sendCalls } = await loadNudgeEmail({
    sendResult: { sent: true, providerId: 'p' },
  })

  await mod.sendNudgeEmail('sub@example.com', false, baseInput({ unsubscribeToken: null }))
  assert.equal(
    sendCalls[0].options.unsubscribeUrl,
    undefined,
    'no token means no unsubscribe URL, not a URL with "null" in it'
  )
  const html = mod.buildNudgeEmailHtml(baseInput({ unsubscribeToken: null }))
  assert.ok(!html.includes('nudge_token=null'))
})

// ---------------------------------------------------------------------------
// 5. Subject lines stay quiet and non-marketing
// ---------------------------------------------------------------------------

test('subjects carry no guilt, urgency or marketing punctuation', async () => {
  const { mod } = await loadNudgeEmail({ sendResult: { sent: true } })

  const types = [
    'open_loop',
    'phase_routine_mismatch',
    'cycle_timed_brightening',
    'glass_skin_cadence',
    'unknown_future_type',
  ]
  for (const t of types) {
    for (const seq of [1, 2, 3]) {
      const subject = mod.buildNudgeSubject(t, seq)
      assert.ok(subject && subject.length > 0, `${t}/${seq} must have a subject`)
      assert.ok(!subject.includes('!'), `"${subject}" — no exclamation marks`)
      assert.ok(
        !/haven't|still waiting|don't forget|last chance|miss(ing)? you/i.test(subject),
        `"${subject}" — no guilt or urgency framing`
      )
    }
  }
})

test('the final nudge signals it is the last one', async () => {
  const { mod } = await loadNudgeEmail({ sendResult: { sent: true } })
  const subject = mod.buildNudgeSubject('open_loop', 3)
  assert.match(
    subject,
    /last/i,
    'the escalation ladder promises "I will not keep bringing it up" — the subject should agree'
  )
})
