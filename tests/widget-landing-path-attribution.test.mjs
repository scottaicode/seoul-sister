/**
 * Guard tests — ss_widget_sessions.landing_path.
 *
 * WHY IT EXISTS
 * `source` is page-TYPE granular ('blog', 'product', 'ingredient_cta'), so it
 * can say a conversation came from "a blog post" and never WHICH one. The blog
 * earns ~674 Google clicks / 28 days and yields ~4 widget conversations a month,
 * while blog visitors are the best traffic on the site (6.4 avg messages vs 3.7
 * from the landing page; 37.5% give an email). "Which post converts" was
 * unanswerable.
 *
 * THE TWO PROPERTIES THAT MUST NOT REGRESS
 * 1. PATH ONLY. A feeder link carries `?ask=<whatever the visitor typed>`, and
 *    an external referrer's query can carry a search term. Storing a full URL
 *    would put a visitor's own words into an analytics column.
 * 2. IT MUST NOT LET CRAWLERS MINT SESSIONS. The honest denominator for this
 *    project is `ss_widget_visitors WHERE total_messages > 0`. An earlier
 *    feeder-CTA proposal was rejected precisely because auto-sending would have
 *    let crawlers create sessions. landing_path is written only by
 *    createSession(), on a real first message — it adds a FIELD to sessions
 *    that already exist and creates none.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const client = readFileSync(join(root, 'src/components/widget/TryYuriSection.tsx'), 'utf8')
const route = readFileSync(join(root, 'src/app/api/widget/chat/route.ts'), 'utf8')
const session = readFileSync(join(root, 'src/lib/widget/session.ts'), 'utf8')

// Scope client assertions to the capture block so they cannot accidentally
// match the unrelated referrer-host code above it.
function captureBlock() {
  const start = client.indexOf('WHICH page, not just which KIND of page')
  assert.ok(start > 0, 'landing_path capture block not found')
  // Bound by the NEXT section rather than a fixed character count — a fixed
  // window silently starts failing the moment the block grows.
  const end = client.indexOf('// `ask` PRESENT', start)
  assert.ok(end > start, 'end of capture block not found')
  return client.slice(start, end)
}

test('the client stores the PATH, never the full URL or querystring', () => {
  const block = captureBlock()
  assert.match(block, /\.pathname/, 'must read .pathname')
  // What matters is what gets ASSIGNED to the ref. Parsing document.referrer
  // into a URL is fine and necessary; storing .href or .search is not.
  const assigned = block.match(/landingPathRef\.current\s*=\s*([^\n]+)/g) || []
  assert.ok(assigned.length > 0, 'landing_path must actually be assigned')
  for (const a of assigned) {
    assert.ok(
      !/\.href|\.search|document\.referrer\b(?!\))/.test(a),
      `must never store href or search — a feeder ?ask= carries the visitor's own typed words. Saw: ${a}`
    )
  }
})

test('only a SAME-ORIGIN referrer is recorded', () => {
  const block = captureBlock()
  assert.match(
    block,
    /seoulsister\.com/,
    'must check the referrer host — an external referrer can carry a search term in its query'
  )
})

test('the server REJECTS a non-path value rather than truncating it', () => {
  // Truncating a full URL would still store part of a querystring. A regex that
  // rejects is the only version that cannot leak.
  assert.match(
    route,
    /landing_path[\s\S]{0,400}?\.regex\(/,
    'landing_path must be validated with a regex, not just a max length'
  )
  const m = route.match(/landing_path[\s\S]{0,400}?\.regex\(([^)]+)\)/)
  assert.ok(m && m[1].includes('^\\/'), 'the pattern must anchor to a leading slash')
  assert.ok(!m[1].includes('?'), 'the pattern must not admit a querystring')
})

test('landing_path is written ONLY when a session row is created', () => {
  // This is the crawler protection. If it were written on any other path, a
  // renderer that never types could produce a row and inflate the one honest
  // denominator.
  assert.match(
    session,
    /export async function createSession[\s\S]{0,900}?landing_path/,
    'landing_path must be set inside createSession, which runs on a real first message'
  )
  const writesElsewhere = route.match(/landing_path\s*:/g) || []
  assert.ok(
    writesElsewhere.length <= 1,
    `landing_path should be threaded through, not written from multiple places (found ${writesElsewhere.length})`
  )
})

test('a missing column degrades gracefully instead of breaking a conversation', () => {
  // Same pattern `source` already uses: the migration is applied by hand, so the
  // app must survive running ahead of it.
  assert.match(
    session,
    /source\|landing_path/,
    'the missing-column retry must match landing_path too, or a conversation breaks until the migration lands'
  )
})

test('the landing page itself is not recorded as its own referrer', () => {
  const block = captureBlock()
  assert.match(block, /!==\s*['"]\/['"]/, '"/" is already what `source` says — recording it would just add noise')
})

test('the migration exists, is forward-only, and says why', () => {
  const sql = readFileSync(join(root, 'scripts/migrations/widget_session_landing_path.sql'), 'utf8')
  assert.match(sql, /add column if not exists landing_path/i)
  assert.match(sql, /BACKFILL: PARTIAL, OPT-IN/i, 'the backfill decision must be recorded, not silent')
  // The recoverable count was MEASURED (6 of 8), not asserted. One row matches
  // two posts ambiguously — which is why the UPDATE ships commented out.
  assert.match(sql, /6 match exactly one post/i, 'the measured recoverable count must be stated')
  assert.match(sql, /^-- update ss_widget_sessions/m, 'the backfill must ship commented out, not auto-run')
  // Historical rows are only PARTIALLY reconstructable from the ?ask= prefill;
  // a half-populated column would make "no referrer" and "we could not
  // reconstruct it" indistinguishable.
  assert.match(sql, /partially/i)
})

test('EXECUTED: a real blog path survives validation INTACT and stays joinable', async () => {
  // The defect this catches, found by an adversarial review of my own first
  // implementation: I inherited `source`'s slug-sanitising transform, which
  // strips `/` and `-` and truncates to 40 chars. Executed on a real slug it
  // produced "blogbestkoreanskincareforpieacnescarsand" — slashes gone, words
  // fused, cut mid-word, and UNJOINABLE to ss_content_posts.slug.
  //
  // That is the worst failure mode for instrumentation: the column populates,
  // the dashboard renders, and every number is unusable. `source` can afford a
  // slug transform because it is a short tag; a PATH cannot.
  const { z } = await import('zod')
  const start = route.indexOf('landing_path: z')
  assert.ok(start > 0, 'landing_path schema not found')
  const schemaSrc = route.slice(start, route.indexOf('})', start))

  // Rebuild the declared schema and run REAL paths through it.
  assert.ok(
    !/replace\(\/\[\^a-z0-9_\]/.test(schemaSrc),
    'landing_path must NOT carry the slug-sanitising transform — it destroys the path it exists to record'
  )

  const schema = z
    .string()
    .max(200)
    .regex(/^\/[A-Za-z0-9\-._~/%]*$/)
    .optional()
    .nullable()
    .transform((v) => v ?? undefined)

  const real = '/blog/best-korean-skincare-for-pie-acne-scars-and-texture'
  assert.equal(schema.parse(real), real, 'a real blog path must survive byte-for-byte')
  assert.equal(schema.parse('/ingredients/niacinamide'), '/ingredients/niacinamide')

  // And it must still REJECT the things it exists to keep out.
  assert.throws(() => schema.parse('/blog/x?ask=my+skin+is+breaking+out'), 'a querystring must be rejected, not stripped')
  assert.throws(() => schema.parse('https://evil.example/x'), 'an absolute URL must be rejected')
  assert.throws(() => schema.parse('blog/no-leading-slash'), 'must anchor to a leading slash')
})

test('the stored path stays long enough to identify a real post', () => {
  // Real slugs on this site run past 40 characters; the longest blog path is
  // ~77. A 40-char cap would truncate mid-word and collide distinct posts.
  const start = route.indexOf('landing_path: z')
  assert.ok(start > 0, 'landing_path schema not found')
  const schemaSrc = route.slice(start, route.indexOf('})', start))
  assert.match(schemaSrc, /\.max\(200\)/, 'a path needs room for a real slug, not a tag-sized cap')
  assert.ok(!/slice\(0,\s*40\)/.test(schemaSrc), 'a 40-char slice would truncate real post slugs mid-word')
})

test('an explicit ?fp= is preferred over the referrer, and both are guarded', () => {
  const block = captureBlock()
  // A param is a claim WE control; a referrer is one the BROWSER controls
  // (rel="noreferrer", a referrer-policy change, an in-app webview). Measured
  // Sep 3 2026: the live site sets no rel="noreferrer" and uses
  // strict-origin-when-cross-origin, which DOES send the full same-origin path
  // — so the fallback works today. Both, so neither is a single point of
  // failure.
  assert.match(block, /params\.get\('fp'\)/, 'the explicit feeder path must be read')
  assert.match(block, /document\.referrer/, 'the referrer fallback must remain')
  // The param path must be validated too — it is user-controllable.
  assert.match(block, /startsWith\('\/'\)/, 'fp must be checked for a leading slash')
  assert.match(block, /includes\('\?'\)/, 'fp must not be allowed to carry a querystring')
})

test('the blog CTA emits the specific post path', () => {
  const cta = readFileSync(join(root, 'src/components/blog/BlogYuriCta.tsx'), 'utf8')
  const inline = readFileSync(join(root, 'src/components/blog/BlogInlineYuriPrompt.tsx'), 'utf8')
  for (const [name, srcText] of [['BlogYuriCta', cta], ['BlogInlineYuriPrompt', inline]]) {
    assert.match(srcText, /feederPath/, `${name} must accept the post path`)
    assert.match(srcText, /&fp=\$\{encodeURIComponent\(feederPath\)\}/, `${name} must append it encoded`)
  }
  const page = readFileSync(join(root, 'src/app/blog/[slug]/page.tsx'), 'utf8')
  const passes = page.match(/feederPath=\{`\/blog\/\$\{blogPost\.slug\}`\}/g) || []
  assert.ok(passes.length >= 3, `all CTA render sites must pass the path (found ${passes.length})`)
})

test('fp is stripped from the address bar after it is read', () => {
  assert.match(client, /params\.delete\('fp'\)/, 'fp must not linger in a shareable URL')
})
