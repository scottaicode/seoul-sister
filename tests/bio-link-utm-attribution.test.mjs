/**
 * Guard test — the bio-link redirects must carry UTMs, and keep ?from= as a fallback.
 *
 * THE GAP THIS CLOSES (found Aug 3 2026 by walking the funnel by hand)
 * Scott clicked Bailey's TikTok bio link, landed on the site, and did not chat.
 *
 * Our own database correctly showed nothing — a `ss_widget_visitors` row is created
 * ONLY when a message is sent (by design: we count conversations, not pageviews, which
 * is the honest denominator when GA4 is bot-inflated).
 *
 * But GA4 filed it under **Direct** too. `?from=tt_ss` is our internal convention;
 * GA4 only names a traffic source from `utm_*` parameters. TikTok's in-app browser
 * strips the referrer, which is the whole reason the /tt redirect exists.
 *
 * So a visitor arriving from TikTok who browsed without chatting was invisible in BOTH
 * systems. If Bailey's channel started working, we would have had no way to prove it.
 *
 * WHY UTMs ON THE REDIRECT AND NOT IN THE BIO
 * Putting `?utm_source=tiktok&utm_medium=bio` directly in the bio would work, but the
 * entire point of /tt is a short, clean, non-scary link — a bare link converts better on
 * a profile, and TikTok already shows an "external website" interstitial on top. Doing it
 * server-side in the redirect keeps the bio clean AND names the source in GA4.
 *
 * WHY THIS IS SAFE
 * The widget reads `utm_source` FIRST and falls back to `?from=` (TryYuriSection). Both
 * parameters are kept, so `ss_widget_sessions.source` still gets a value either way — it
 * just reads 'tiktok' instead of 'tt_ss' now. Verified before shipping: zero historical
 * rows carry tt_ss/ig_ss, and no code anywhere references those literals, so nothing is
 * orphaned.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const ROOT = join(__dirname, '..')

/** Load the redirect table from next.config.js without executing the whole config. */
async function redirects() {
  const src = readFileSync(join(ROOT, 'next.config.js'), 'utf8')
  const start = src.indexOf('async redirects()')
  assert.ok(start > -1, 'next.config.js must define redirects()')
  const open = src.indexOf('[', start)
  const close = src.indexOf(']', open)
  return JSON.parse(
    src
      .slice(open, close + 1)
      .replace(/(\w+):/g, '"$1":')
      .replace(/'/g, '"')
      .replace(/,(\s*[\]}])/g, '$1')
  )
}

test('the bio links name a source GA4 can actually read', async () => {
  const rows = await redirects()

  const tt = rows.find((r) => r.source === '/tt')
  const ig = rows.find((r) => r.source === '/ig')
  assert.ok(tt && ig, 'both /tt and /ig must exist')

  // Without utm_source, GA4 buckets these as Direct and the channel is unprovable.
  assert.match(tt.destination, /utm_source=tiktok/, '/tt must name tiktok to GA4')
  assert.match(ig.destination, /utm_source=instagram/, '/ig must name instagram to GA4')
  assert.match(tt.destination, /utm_medium=bio/, 'medium distinguishes a bio click from a post link')
  assert.match(ig.destination, /utm_medium=bio/)
})

test('?from= survives so our own data keeps working', async () => {
  const rows = await redirects()
  const tt = rows.find((r) => r.source === '/tt')
  const ig = rows.find((r) => r.source === '/ig')

  // The widget prefers utm_source but falls back to ?from=. Keeping both means a
  // change in GA4 conventions can never silently blind ss_widget_sessions.source.
  assert.match(tt.destination, /from=tt_ss/, '/tt must retain the internal fallback tag')
  assert.match(ig.destination, /from=ig_ss/, '/ig must retain the internal fallback tag')
})

test('the bio link itself stays short and clean', async () => {
  const rows = await redirects()
  for (const path of ['/tt', '/ig']) {
    const r = rows.find((x) => x.source === path)
    assert.equal(
      r.source, path,
      'the SOURCE path must stay bare — the UTMs belong on the destination, not the link Bailey posts'
    )
    assert.ok(!r.source.includes('?'), 'no query string may appear in the public bio link')
  }
})

test('the tagged values survive the widget source sanitizer', async () => {
  // The route sanitizes source with /[^a-z0-9_]/gi — hyphens are stripped. 'tiktok'
  // and 'instagram' must pass through intact or the own-data moat records a mangled tag.
  const routeSrc = readFileSync(
    join(ROOT, 'src', 'app', 'api', 'widget', 'chat', 'route.ts'),
    'utf8'
  )
  const m = routeSrc.match(/replace\(\/\[\^([^\]]+)\]\/gi, ''\)/)
  assert.ok(m, 'expected the source sanitizer regex in the widget route')

  const sanitize = (v) => v.replace(new RegExp(`[^${m[1]}]`, 'gi'), '').slice(0, 40)
  assert.equal(sanitize('tiktok'), 'tiktok')
  assert.equal(sanitize('instagram'), 'instagram')
})

test('the redirect stays temporary', async () => {
  const rows = await redirects()
  for (const path of ['/tt', '/ig']) {
    const r = rows.find((x) => x.source === path)
    // A permanent (308) redirect gets cached by browsers and CDNs, which would make a
    // future change to the destination tags unshippable to anyone who already clicked.
    assert.equal(r.permanent, false, `${path} must stay a temporary redirect`)
  }
})
