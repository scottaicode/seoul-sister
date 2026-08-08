/**
 * Guards for the favicon Google actually shows (Aug 7 2026).
 *
 * Bailey: "I thought we got rid of the ugly guy" / "When I googled it". Google
 * was still serving the retired 유 Hangul stopgap, which at 16px reads as a stick
 * figure in a hat. Every asset in the repo was already correct — the failure was
 * that Google never found a replacement it trusts.
 *
 * Requirements below are from Google's own docs, verified rather than recalled
 * (developers.google.com/search/docs/appearance/favicon-in-search). Note there is
 * NO multiple-of-48 rule; that theory was wrong and was discarded before it cost
 * a pointless resize. The real ones: /favicon.ico is the default requested path,
 * >48x48px is recommended, and "The favicon URL must be stable."
 *
 * This file has a bad history to protect: the icon churned six times on
 * Jul 29-30 and shipped visibly broken more than once.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { existsSync, readFileSync, statSync } from 'node:fs'

const LAYOUT = readFileSync('src/app/layout.tsx', 'utf8')

// ── /favicon.ico must exist and be a real multi-size ICO ────────────────────
test('/favicon.ico exists at the root path Google requests by default', () => {
  assert.ok(existsSync('public/favicon.ico'), 'public/favicon.ico missing — Google gets a 404')
  assert.ok(statSync('public/favicon.ico').size > 500, 'favicon.ico suspiciously small')
})

test('favicon.ico is a valid ICO containing 16, 32 and 48px frames', () => {
  const ico = readFileSync('public/favicon.ico')
  assert.equal(ico.readUInt16LE(0), 0, 'ICO reserved field must be 0')
  assert.equal(ico.readUInt16LE(2), 1, 'ICO type must be 1 (icon)')

  const count = ico.readUInt16LE(4)
  const sizes = []
  for (let i = 0; i < count; i++) {
    const o = 6 + i * 16
    const w = ico.readUInt8(o) || 256
    const h = ico.readUInt8(o + 1) || 256
    const len = ico.readUInt32LE(o + 8)
    const off = ico.readUInt32LE(o + 12)

    assert.equal(w, h, `frame ${i} is not square (${w}x${h}) — Google requires 1:1`)
    assert.ok(off + len <= ico.length, `frame ${i} data runs past end of file`)

    // Each frame must be a real PNG, not a zero-filled placeholder.
    const frame = ico.subarray(off, off + len)
    assert.ok(
      frame[0] === 0x89 && frame[1] === 0x50 && frame[2] === 0x4e && frame[3] === 0x47,
      `frame ${i} is not a PNG`
    )
    sizes.push(w)
  }

  for (const required of [16, 32, 48]) {
    assert.ok(sizes.includes(required), `favicon.ico lacks a ${required}px frame (has ${sizes})`)
  }
})

// ── The >48px recommendation ────────────────────────────────────────────────
test('a 48px favicon PNG exists and is declared', () => {
  // Google: "we recommend using a favicon that's larger than 48x48px". Our
  // largest was 32px, which is a live reason it fell back to its cache.
  assert.ok(existsSync('public/icons/favicon-48.png'), 'favicon-48.png missing')
  assert.ok(
    /href="\/icons\/favicon-48\.png"/.test(LAYOUT),
    'favicon-48.png exists but is not declared in layout.tsx'
  )
})

test('layout declares /favicon.ico', () => {
  assert.ok(
    /rel="icon"[^>]*href="\/favicon\.ico"/.test(LAYOUT),
    '/favicon.ico is not declared — Google may not associate it with the site'
  )
})

// ── Stability: no query-versioned icon URLs ────────────────────────────────
test('no icon URL carries a query string (Google requires a STABLE url)', () => {
  const iconLinks = LAYOUT.match(/<link[^>]*rel="(?:icon|apple-touch-icon)"[^>]*>/g) ?? []
  for (const link of iconLinks) {
    const href = link.match(/href="([^"]+)"/)?.[1] ?? ''
    assert.ok(!href.includes('?'), `icon href is query-versioned and therefore unstable: ${href}`)
  }
})

test('src/app/icon.svg is absent (Next would emit a ?hash URL last, sizes="any")', () => {
  // It was the SAME single-S drawing as favicon.ico, so it added nothing while
  // emitting an unstable /icon.svg?<hash> link that could outrank the icons we
  // set deliberately. apple-icon.svg is a DIFFERENT drawing (180px monogram) and
  // is intentionally kept.
  assert.ok(
    !existsSync('src/app/icon.svg'),
    'src/app/icon.svg is back — it re-adds a query-versioned icon link'
  )
  assert.ok(existsSync('src/app/apple-icon.svg'), 'apple-icon.svg should be kept')
})

// ── Service worker fence ───────────────────────────────────────────────────
test('service worker cache was bumped so returning visitors get the new icon', () => {
  const sw = readFileSync('public/sw.js', 'utf8')
  const version = sw.match(/const CACHE_NAME = 'seoul-sister-v(\d+)'/)?.[1]
  assert.ok(version, 'CACHE_NAME not found in sw.js')
  assert.ok(
    Number(version) >= 14,
    `CACHE_NAME is v${version}; /icons/ is cache-first, so the favicon fix needs >= v14`
  )
})

// ── Meta description length (Bing Webmaster Tools) ──────────────────────────
test('home page meta description fits a SERP snippet', () => {
  // Bing flagged 173 chars as "Meta Description too long" on the home page — the
  // surface our ~525 weekly Bing citations point at, so a truncated snippet costs
  // real clicks on the channel that actually converts.
  //
  // Measured on the SOURCE string here. Entity escaping (&#x27; for an
  // apostrophe) inflates the RENDERED count, which is how the old one drifted
  // over; the current text deliberately contains no apostrophes. If you add one,
  // re-measure the served HTML, not just this.
  const desc = LAYOUT.match(/^  description:\n\s+'([^']+)'/m)?.[1]
  assert.ok(desc, 'root metadata description not found in layout.tsx')
  assert.ok(
    desc.length >= 120 && desc.length <= 160,
    `meta description is ${desc.length} chars; Bing flags outside ~120-160`
  )
  // The differentiator is WHY we get cited. Trimming for length must never
  // remove it.
  assert.ok(
    /English-language/i.test(desc) && /Korean/i.test(desc),
    'the English-language + Korean claim was trimmed out — that is the citation hook'
  )
})
