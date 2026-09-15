/**
 * Guard test — the SEO Guardian's query-intent finding is a FACT, not a rule.
 *
 * WHY THIS EXISTS
 * Measured Aug 2 2026 from a real GSC export: across the top 32 queries by
 * impressions (818 impr / 2 clicks / 0.24% CTR at avg position 12), the clicks
 * split entirely by intent —
 *   definitional ("sebaceous filaments", "madecassic acid", "melaset"):
 *       541 impressions, 0 clicks, 0.00%
 *   solution/review ("...aqua fresh sunscreen review", "korean skincare FOR
 *   sebaceous filaments"): 277 impressions, 2 clicks, 0.72%
 * The site already has well-titled ranking pages for every definitional theme,
 * so this is not a content gap — AI Overviews answer those inline.
 *
 * The temptation is to encode "don't write definitional content" as a rule.
 * That would be wrong twice over: definitional pages are plausibly still the
 * right play for the AI-citation channel (a proven win, 596 Copilot citations
 * /7d), and it would replace the strategist's judgment with a static
 * constraint — the exact anti-pattern the AI-First guard exists to stop. The
 * prompt says "YOUR JUDGMENT IS THE PRODUCT"; this finding must inform that
 * judgment, never override it.
 *
 * Same shape as the widget cumulative-give instrument: surface the fact, hand
 * the decision back.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const SRC = join(__dirname, '..', 'src', 'lib', 'seo', 'seo-guardian.ts')

test('the intent finding is present with its real measured numbers', () => {
  const src = readFileSync(SRC, 'utf8')

  assert.match(src, /541 impressions and 0 clicks/, 'the definitional cluster result must be stated')
  assert.match(src, /277 impressions and both clicks/, 'the solution-intent cluster result must be stated')
  assert.match(src, /MEASURED Aug 2 2026/, 'the finding must be dated so a later strategist can judge its age')
})

test('it does NOT become a rule that overrides the strategist', () => {
  const src = readFileSync(SRC, 'utf8')

  // Extract just the business-context bullet we added.
  const line = src.split('\n').find((l) => l.includes('MEASURED Aug 2 2026'))
  assert.ok(line, 'expected the measured-intent bullet')

  for (const banned of [
    /\bnever write\b/i,
    /\bdo not write\b/i,
    /\bstop writing\b/i,
    /\bonly bet on\b/i,
    /\bmust not target\b/i,
    /\bforbidden\b/i,
  ]) {
    assert.ok(
      !banned.test(line),
      `the finding must not forbid a content class — it is a fact for judgment (matched ${banned})`
    )
  }

  assert.match(
    line, /fact for your judgment, not a rule/,
    'the bullet must explicitly hand the decision back to the strategist'
  )
  assert.match(
    line, /definitional pages may still be worth writing/,
    'it must preserve the AI-citation case for definitional content rather than killing it'
  )
})

test('the strategist still owns the call', () => {
  const src = readFileSync(SRC, 'utf8')
  assert.match(
    src, /YOUR JUDGMENT IS THE PRODUCT/,
    'the judgment-primacy instruction must survive'
  )
  assert.match(
    src, /conveniences, not constraints/,
    'computed facts must remain non-binding'
  )
})

test('the metadata-ceiling caveat is included', () => {
  const src = readFileSync(SRC, 'utf8')
  // Without this, a strategist could read "low CTR" and bet on title rewrites,
  // which have a low ceiling at position 12.
  assert.match(
    src, /at or above published par for page 2/,
    'the strategist must know 0.24% at position 12 is par, not a broken-titles signal'
  )
})

// ---------------------------------------------------------------------------
// Sept 15 2026 — the strategist spent 13 bets over 9 consecutive weeks on ONE
// query that has never clicked, and the Aug 2 block above was feeding the loop
// by citing it as a solution-intent query that earned clicks.
//
// Joined query-to-page from the weekly gsc_snapshot archives: the DEDICATED PIH
// page, with the correct title, held the query at position 9.7-10.1 for a month
// and earned 2 clicks on 430 impressions (0.47%). Google then moved it to the
// PIE page: 1,714 impressions at 10.4, zero clicks. Both pages, both titles,
// near-zero clicks — so a metadata or internal-link bet cannot recover it. That
// experiment already ran.
//
// The impressions are anomalous: a 245x "best X" / bare "X" ratio against a
// site norm of 0.5-1.7x, volume up ~20x in ten weeks with position frozen.
//
// These assertions are deliberately about the FACT surviving in the prompt, and
// about it not degrading into a rule. The block's whole design is facts-for-
// judgment; a version that ordered the strategist around would be the
// regression, so the last test attacks that shape directly.
// ---------------------------------------------------------------------------

test('the PIH phantom-query fact is stated with its evidence', () => {
  const src = readFileSync(SRC, 'utf8')
  const i = src.indexOf('best korean skincare for pih" is NOT a target')
  assert.ok(i !== -1, 'the PIH fact must be present in the strategist prompt')
  const block = src.slice(i, i + 3000)
  // The numbers are what make it a fact rather than an opinion; without them a
  // future session re-derives the same wrong conclusion from the Aug 2 note.
  assert.match(block, /0\.47%/, 'must carry the dedicated page CTR that already failed')
  assert.match(block, /245x/, 'must carry the phrase-ratio anomaly')
  assert.match(block, /13 bets/, 'must name the size of the loop it is stopping')
})

test('it protects the PIE page, which is 19% of site clicks', () => {
  const src = readFileSync(SRC, 'utf8')
  const i = src.indexOf('best korean skincare for pih" is NOT a target')
  const block = src.slice(i, i + 3000)
  assert.match(block, /do not touch the PIE page/i,
    'the highest-traffic page must be explicitly out of scope for this query')
})

test('the PIH fact does not become a blanket ban on pigmentation content', () => {
  const src = readFileSync(SRC, 'utf8')
  const i = src.indexOf('best korean skincare for pih" is NOT a target')
  const block = src.slice(i, i + 3000)
  // Scoped to ONE phrase. A rule banning the topic would cost real queries:
  // the PIH/dark-spot family minus this query runs 1.56% CTR, which is healthy.
  assert.match(block, /fact about one phrase, not a rule against pigmentation/i,
    'the fact must name its own scope so it cannot widen into a topic ban')
})
