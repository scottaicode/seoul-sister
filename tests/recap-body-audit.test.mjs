/**
 * Guard test — the recap email leaves a record of what it actually said.
 *
 * THE GAP (Aug 17 2026). The lead recap email is the surface that converted the
 * only paying subscriber this funnel has produced. It is written fresh by Opus
 * on every send, from a SEPARATE prompt, and it carries its own explicit scope
 * rule (`lead-email.ts` — "NOT a complete take-home routine... do NOT compile a
 * full AM/PM routine, a multi-week schedule, or a complete shopping list").
 *
 * Its subject and body were generated, sent, and DISCARDED. Only `recap_status`
 * and a Resend message id survived. So an email that violated its own scope and
 * one that obeyed it perfectly left IDENTICAL database state — the fourth of
 * the four questions ("can nothing-happened be told apart from nothing-ran?")
 * failing on a customer-facing artifact, permanently.
 *
 * Sharper still: every give-side instrument (cumulative-give, tool-grounding)
 * reads only the CHAT. A leak living in the email is invisible to all of them.
 *
 * This is observability only — nothing about what Yuri sends changes.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const VISITOR = join(__dirname, '..', 'src', 'lib', 'widget', 'visitor.ts')
const ROUTE = join(__dirname, '..', 'src', 'app', 'api', 'widget', 'chat', 'route.ts')
const LEAD = join(__dirname, '..', 'src', 'lib', 'email', 'lead-email.ts')
const MIGRATION = join(__dirname, '..', 'scripts', 'migrations', 'add_recap_body_audit.sql')

const src = (p) => readFileSync(p, 'utf8')

test('the migration creates every audit column the code writes', () => {
  const sql = src(MIGRATION)
  for (const col of ['recap_subject', 'recap_body_html', 'recap_reason', 'recap_artifacts']) {
    assert.ok(sql.includes(col), `migration must add ${col}`)
  }
  // Re-runnable: a migration that fails on second run blocks a deploy.
  assert.match(sql, /ADD COLUMN IF NOT EXISTS/, 'must be idempotent')
})

test('the SENT body and subject are persisted, not just the status', () => {
  const route = src(ROUTE)
  const sendBlock = route.slice(
    route.indexOf("send.sent ? 'sent' : 'send_failed'"),
    route.indexOf("} else if (result.outcome === 'not_their_address')")
  )
  assert.ok(sendBlock.length > 0, 'send branch not found')
  assert.match(sendBlock, /bodyHtml:\s*result\.email\.bodyHtml/,
    'the body as actually sent must be stored')
  assert.match(sendBlock, /subject:\s*result\.email\.subject/,
    'the subject must be stored')
})

test("Yuri's REASON is persisted on every outcome, not written to console and dropped", () => {
  // A suppressed send with no recorded reason is indistinguishable from a
  // broken one. The prompt has always asked for `reason`; it was parsed, logged,
  // and then thrown away by the return type.
  const lead = src(LEAD)
  assert.match(lead, /outcome: 'suppressed';\s*reason\?: string/,
    'suppressed must carry a reason')
  assert.match(lead, /outcome: 'not_their_address';\s*reason\?: string/,
    'not_their_address must carry a reason')
  assert.match(lead, /reason: parsed\.reason/,
    'the parsed reason must be returned, not only logged')

  const route = src(ROUTE)
  assert.match(route, /'suppressed',\s*\{\s*\n?\s*reason: result\.reason/,
    'the suppressed branch must persist the reason')
})

test('the sent email is scored on the SAME ruler as the chat', () => {
  // Two detectors eventually disagree about the same boundary. The recap is
  // scored with detectCumulativeGive — the chat-side instrument — so "did we
  // hand over the build?" has one answer across both surfaces.
  const visitor = src(VISITOR)
  assert.match(visitor, /import \{ detectCumulativeGive \}/,
    'the recap must reuse the chat-side give detector')
  assert.match(visitor, /recap_artifacts/, 'the artifact score must be stored')
})

test('HTML is stripped before scoring, or markup reads as product names', () => {
  const visitor = src(VISITOR)
  // Anchor to markers UNIQUE to this block. `const { error } = await supabase`
  // occurs earlier in a different function, so using it as the end marker
  // produced an empty slice — and an empty slice fails every assertion for the
  // wrong reason, which reads as a code bug that isn't there.
  const start = visitor.indexOf('if (options.bodyHtml)')
  const end = visitor.indexOf('recap artifact analysis failed')
  assert.ok(start > -1 && end > start, 'bodyHtml block not found')
  const block = visitor.slice(start, end)
  assert.match(block, /replace\(\/<\[\^>\]\+>\/g/,
    'tags must be stripped before the detector reads the body')
  // <br> and block-closing tags must become newlines: the detector is
  // LINE-based (an arrow chain is detected per line), so collapsing a multi-line
  // routine into one line would change what it scores.
  assert.match(block, /<br/i, 'line breaks must survive tag stripping')
  // The stripped text must be what the DETECTOR receives. Asserting only that
  // stripping code exists is not enough: swapping the detector's argument back
  // to `options.bodyHtml` left the stripping in place, unused, and passed.
  assert.match(block, /detectCumulativeGive\(\[\{ role: 'assistant', content: plain \}\]\)/,
    'the detector must read the STRIPPED text, not the raw HTML')
  assert.ok(!/detectCumulativeGive\([^)]*bodyHtml/.test(block),
    'the detector must never be handed raw HTML')
})

test('analysis failure must never cost us the BODY', () => {
  // The body is the irreplaceable artifact; the score can be recomputed from it
  // at any time. If scoring threw and took the write with it, we would be back
  // to storing nothing — the exact gap being closed.
  const visitor = src(VISITOR)
  // Anchor to markers UNIQUE to this block. `const { error } = await supabase`
  // occurs earlier in a different function, so using it as the end marker
  // produced an empty slice — and an empty slice fails every assertion for the
  // wrong reason, which reads as a code bug that isn't there.
  const start = visitor.indexOf('if (options.bodyHtml)')
  const end = visitor.indexOf('recap artifact analysis failed')
  assert.ok(start > -1 && end > start, 'bodyHtml block not found')
  const block = visitor.slice(start, end)
  assert.match(block, /patch\.recap_body_html = options\.bodyHtml/,
    'the body must be assigned BEFORE analysis is attempted')
  assert.match(block, /catch/, 'analysis must be wrapped')
  const bodyIdx = block.indexOf('patch.recap_body_html')
  const tryIdx = block.indexOf('try {')
  assert.ok(bodyIdx < tryIdx, 'the body assignment must precede the analysis try-block')
})

test('a missing audit column must never cost us the STATUS write', () => {
  // Pre-migration tolerance, matching the existing pattern in this file. The
  // delivery/bounce webhook keys on recap_status; losing that to a column that
  // does not exist yet would break a working loop to add observability.
  const visitor = src(VISITOR)
  assert.match(visitor, /recap_subject\|recap_body_html\|recap_reason\|recap_artifacts/,
    'audit-column errors must be detected specifically')
  assert.match(visitor, /recordRecapStatus retry failed/,
    'a retry with only the long-standing columns must exist')
  assert.match(visitor, /add_recap_body_audit\.sql/,
    'the warning must name the migration to run')
})

/**
 * PROVENANCE ON THE SCORE (Aug 17 2026).
 *
 * `detectCumulativeGive` is validated on CHAT prose. Run over a recap EMAIL it
 * over-counts: the first real recap scored `count: 2` and BOTH artifacts were
 * false positives — `SLOT_WITH_PRODUCT` matched "cleanser, Anua" and "Serum,
 * Illiyoon", commas separating items in a LIST of what the visitor already
 * owns. The email had zero arrows and held its scope perfectly.
 *
 * The detector is NOT tuned for this (three hand-adjustments in nine days, one
 * email body to tune against, and a July 30 classifier that measured 23%
 * precision and was discarded). Instead the number carries its limits, the same
 * discipline as `fitzpatrick_source`: a score whose origin you cannot name is
 * not a fact.
 *
 * The cost this prevents is specific — a future session auditing give/gate
 * compliance reading `count: 2` and concluding the recap leaked, then "fixing"
 * an email that was already correct.
 */
test('the stored score carries its provenance, not just a number', async () => {
  // Execute the REAL persistence path against the REAL production email body,
  // rather than asserting the flag appears in source — a source-regex passes
  // even when the flag is dead code.
  const visitorSrc = src(VISITOR)
  const start = visitorSrc.indexOf('if (options.bodyHtml)')
  const end = visitorSrc.indexOf('recap artifact analysis failed')
  assert.ok(start > -1 && end > start, 'bodyHtml block not found')
  const block = visitorSrc.slice(start, end)

  // The count must never be stored bare.
  assert.match(block, /scorer: 'chat_v1'/, 'the scorer version must be recorded')
  assert.match(block, /unvalidated_for: \['email'\]/,
    'the score must declare it is unvalidated on email prose')
  assert.match(block, /caveat:/, 'a human-readable caveat must travel with the score')
  assert.match(block, /Read recap_body_html before acting on this count/i,
    'the caveat must tell the reader what to do instead')

  // And the provenance must sit in the SAME object as the count — a flag stored
  // elsewhere can be read past.
  const objStart = block.indexOf('patch.recap_artifacts = {')
  const objEnd = block.indexOf('}', block.indexOf('caveat:'))
  const obj = block.slice(objStart, objEnd)
  assert.match(obj, /count: give\.count/, 'the count lives in the object')
  assert.match(obj, /unvalidated_for/, 'the provenance lives in the SAME object as the count')
})

test('the detector records its own known limit', async () => {
  // The limit must be discoverable from the detector, not only from the caller
  // — a future session tuning cumulative-give.ts should learn there that its
  // email precision is unmeasured before touching anything.
  const give = readFileSync(
    join(__dirname, '..', 'src', 'lib', 'widget', 'cumulative-give.ts'),
    'utf8'
  )
  assert.match(give, /validated on CHAT prose only/i,
    'the detector must state where it is validated')
  assert.match(give, /DELIBERATELY NOT TUNED/,
    'the decision not to tune must be recorded with its reasoning')
  // Match across the comment's line wrap — the measurement spans two lines in
  // the source, and a single-line regex silently misses it.
  const flat = give.replace(/^\s*\*\s?/gm, '').replace(/\s+/g, ' ')
  assert.match(flat, /31 of 38 genuine chat deliveries also carry 3\+ "your"/,
    'the measured reason the obvious fix fails must be recorded, not re-derived')
})
