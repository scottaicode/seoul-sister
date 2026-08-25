/**
 * Guard tests for the SS brand mark.
 *
 * WHY (July 30 2026)
 *
 * Bailey: *"But damn I gotta get on that icon asap."* The shipping icon was an
 * interim 유 stopgap, added only because the previous apple-touch-icon pointed at
 * an SVG — which iOS cannot use for a home-screen icon — so every iPhone showed a
 * page screenshot instead of a logo.
 *
 * This repo has broken its own icon THREE separate ways, and each is a test here:
 *   - `f7e4d23` — an SVG with no intrinsic size renders NOTHING in an <img>, so
 *     width/height AND viewBox must both be present.
 *   - the old `icon-512.svg` used <text> with `font-family="Georgia, serif"`, so
 *     the mark depended on a font being installed on the viewer's machine.
 *   - `f70d937` — iOS ignores the manifest for home-screen icons and cannot use
 *     SVG, so the PNGs are the real icons and must exist.
 *
 * Plus one new failure mode introduced by this design: the icon is a monogram on a
 * gold TILE, so reusing it as the `maskable` entry would let Android's circle /
 * squircle / teardrop crop slice the tile's own rounded corners and render a
 * visibly broken icon. Maskable needs full-bleed art.
 *
 * Run: `npm test`.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, statSync } from 'node:fs'
import { inflateSync } from 'node:zlib'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')
const icons = (f) => join(root, 'public', 'icons', f)

const MARKS = ['icon-mark.svg', 'icon-maskable.svg', 'ss-mark-gold.svg']

// ---------------------------------------------------------------------------
// The three historical breakages
// ---------------------------------------------------------------------------

test('no brand SVG depends on a font being installed', () => {
  for (const f of MARKS) {
    const src = readFileSync(icons(f), 'utf8')
    // Strip comments first — the files DOCUMENT this hazard by naming it, and an
    // earlier version of this very test flagged its own documentation.
    const code = src.replace(/<!--[\s\S]*?-->/g, '')
    assert.ok(
      !/font-family/.test(code),
      `${f} sets font-family. The old icon-512.svg needed Georgia installed, so ` +
        'the mark rendered differently (or not at all) depending on the viewer.'
    )
    assert.ok(
      !/<text[\s>]/.test(code),
      `${f} contains a live <text> element. Letterforms must be outlined <path> ` +
        'geometry so the mark cannot depend on font availability.'
    )
    assert.match(code, /<path\b/, `${f} has no <path> — where did the artwork go?`)
  }
})

test('every brand SVG declares an intrinsic size AND a viewBox', () => {
  for (const f of MARKS) {
    const src = readFileSync(icons(f), 'utf8')
    const tag = src.slice(0, src.indexOf('>') + 1)
    assert.match(tag, /width="\d+"/, `${f} has no width — f7e4d23: renders blank in an <img>.`)
    assert.match(tag, /height="\d+"/, `${f} has no height — f7e4d23: renders blank in an <img>.`)
    assert.match(tag, /viewBox="0 0 \d+ \d+"/, `${f} has no viewBox, so it cannot scale.`)
  }
})

test('the PNG icons iOS actually uses all exist and are non-trivial', () => {
  // iOS ignores the manifest for home-screen icons and cannot render SVG, so
  // these files ARE the icon on every iPhone (f70d937).
  for (const f of [
    'apple-touch-icon.png',
    'icon-192.png',
    'icon-512.png',
    'icon-maskable-512.png',
    'favicon-32.png',
    'favicon-16.png',
  ]) {
    assert.ok(existsSync(icons(f)), `${f} is missing — iOS/Android need real PNGs.`)
    assert.ok(
      statSync(icons(f)).size > 200,
      `${f} is suspiciously small (${statSync(icons(f)).size}b) — likely a blank render.`
    )
  }
})

// ---------------------------------------------------------------------------
// The new failure mode this design introduces
// ---------------------------------------------------------------------------

test('the maskable icon is full-bleed, not the rounded tile', () => {
  const mask = readFileSync(icons('icon-maskable.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '')
  // A rounded rect inset from the edges is exactly what Android would clip.
  assert.ok(
    !/<rect[^>]*\brx=/.test(mask),
    'The maskable icon contains a rounded rect. Android crops to a circle/squircle/' +
      'teardrop and only the middle ~80% is safe, so an inset rounded tile gets its ' +
      'own corners sliced off and the icon looks broken. Use full-bleed art.'
  )
  assert.match(
    mask,
    /<rect width="512" height="512" fill="url\(#tile\)"\/>/,
    'The maskable icon must fill the whole canvas with the gold field so any crop ' +
      'shape still lands on gold.'
  )
})

test('the manifest points maskable at its own art, not the tile', () => {
  const src = read('src', 'app', 'manifest.ts')
  const maskableBlock = src.slice(src.indexOf("purpose: 'maskable'") - 400, src.indexOf("purpose: 'maskable'"))
  assert.match(
    maskableBlock,
    /icon-maskable-512\.png/,
    'The maskable manifest entry must use icon-maskable-512.png. Reusing icon-512.png ' +
      '(the rounded tile) means Android clips the tile corners.'
  )
})

// ---------------------------------------------------------------------------
// The black-halo trap (July 30 2026)
//
// iOS and Android apply their OWN rounded mask to a home-screen icon. So art
// that already has rounded corners sitting on a dark field gets masked a second
// time, and the dark field shows through as black wedges just inside the OS
// curve. The first version of this icon shipped exactly that: corner pixels
// measured (13,13,15) — the brand near-black.
//
// Fix: home-screen icons are FULL-BLEED gold and let the OS do the rounding.
// Favicons deliberately KEEP the rounded tile, because a browser tab does not
// mask the icon and a full-bleed gold square is a harsh block on a light tab
// strip.
// ---------------------------------------------------------------------------

/**
 * Minimal PNG reader: returns {w,h,px(x,y)} as RGB triples.
 *
 * Handles PALETTE PNGs (colourType 3) as well as truecolour/greyscale. That is not
 * optional: the favicons are written with `palette: true` because an indexed PNG is
 * both smaller and free of the resampling smear a full-colour downscale introduces.
 * An earlier version of this reader ignored PLTE, so every palette pixel came back
 * as a single index byte — `corner is [0]` — and the test failed on a perfectly good
 * icon. A test that fails on correct art is as bad as one that passes on broken art.
 */
function readPng(rel) {
  const d = readFileSync(icons(rel))
  const w = d.readUInt32BE(16), h = d.readUInt32BE(20)
  const colourType = d[25]
  let idat = Buffer.alloc(0)
  let plte = null
  for (let i = 8; i < d.length; ) {
    const len = d.readUInt32BE(i)
    const type = d.slice(i + 4, i + 8).toString()
    if (type === 'IDAT') idat = Buffer.concat([idat, d.slice(i + 8, i + 8 + len)])
    if (type === 'PLTE') plte = d.slice(i + 8, i + 8 + len)
    i += 12 + len
  }
  const raw = inflateSync(idat)
  const ch = { 0: 1, 2: 3, 3: 1, 4: 2, 6: 4 }[colourType]
  const stride = w * ch + 1
  const rows = []
  let prev = Buffer.alloc(w * ch)
  for (let r = 0; r < h; r++) {
    const off = r * stride
    const ft = raw[off]
    const line = Buffer.from(raw.slice(off + 1, off + stride))
    for (let k = 0; k < line.length; k++) {
      const a = k >= ch ? line[k - ch] : 0
      const b = prev[k]
      const c = k >= ch ? prev[k - ch] : 0
      if (ft === 1) line[k] = (line[k] + a) & 255
      else if (ft === 2) line[k] = (line[k] + b) & 255
      else if (ft === 3) line[k] = (line[k] + ((a + b) >> 1)) & 255
      else if (ft === 4) {
        const p = a + b - c
        const pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c)
        line[k] = (line[k] + (pa <= pb && pa <= pc ? a : pb <= pc ? b : c)) & 255
      }
    }
    prev = line
    rows.push(line)
  }
  return {
    w,
    h,
    colourType,
    // Always returns RGB, resolving through the palette when there is one.
    px: (x, y) => {
      if (colourType === 3 && plte) {
        const idx = rows[y][x]
        return [plte[idx * 3], plte[idx * 3 + 1], plte[idx * 3 + 2]]
      }
      const p = [...rows[y].slice(x * ch, (x + 1) * ch)]
      return colourType === 0 || colourType === 4 ? [p[0], p[0], p[0]] : p
    },
  }
}

test('home-screen icons are FULL-BLEED, with no dark corners for iOS to mask', () => {
  for (const f of ['apple-touch-icon.png', 'icon-192.png', 'icon-512.png', 'icon-maskable-512.png']) {
    const { w, h, px } = readPng(f)
    const corners = [px(1, 1), px(w - 2, 1), px(1, h - 2), px(w - 2, h - 2)]
    for (const [i, c] of corners.entries()) {
      const brightness = c[0] + c[1] + c[2]
      assert.ok(
        brightness > 150,
        `${f} corner ${i} is ${JSON.stringify(c)} — dark. iOS/Android apply their OWN ` +
          'rounded mask, so pre-rounded art on a dark field shows black wedges inside ' +
          'the OS curve. Ship full-bleed art and let the OS round it.'
      )
    }
  }
})

test('the favicon is its own drawing, not the shrunk monogram', () => {
  // Scott, looking at the shipped 32px favicon: "FINAL-SHIPPED-favicon-32 is
  // blurry." Correct — and 16px was worse: magnifying it showed the two-S serif
  // monogram had degraded into unreadable noise. High-contrast serif hairlines
  // cannot survive a favicon, which is the SAME reason Bailey's original Canva
  // ribbon could not be the app icon.
  //
  // So the favicon is a separate drawing: ONE letter (double the pixel budget per
  // stroke) in Poppins Bold — the wordmark's own typeface, uniform stroke weight,
  // no hairlines to lose.
  //
  // Proxy for "not the monogram": the monogram is two glyphs of high-contrast
  // serif (~124 Bezier commands); a single sans S is far simpler (~46).
  const src = readFileSync(icons('favicon.svg'), 'utf8').replace(/<!--[\s\S]*?-->/g, '')
  const curves = (src.match(/[QqCc]/g) || []).length
  assert.ok(
    curves > 10 && curves < 90,
    `favicon.svg has ${curves} Bezier commands. Below ~10 is placeholder art; above ` +
      '~90 means the full two-glyph serif monogram has been dropped in, which ' +
      'measured as mush at 32px and noise at 16px. The favicon must stay a single, ' +
      'simple letterform.'
  )
  // And it must not be the literal monogram file content.
  const monogram = readFileSync(icons('icon-mark.svg'), 'utf8')
  assert.notEqual(
    src.replace(/\s+/g, ''),
    monogram.replace(/<!--[\s\S]*?-->/g, '').replace(/\s+/g, ''),
    'favicon.svg is byte-identical to the monogram. They are deliberately different ' +
      'drawings for different pixel budgets.'
  )
})

test('favicons KEEP the rounded tile (a browser tab does not mask them)', () => {
  const { w, h, px } = readPng('favicon-32.png')
  const corner = px(1, 1)
  assert.ok(
    corner[0] + corner[1] + corner[2] < 150,
    `favicon-32 corner is ${JSON.stringify(corner)}. Favicons should keep the dark ` +
      'field + rounded tile: nothing masks a tab icon, and a full-bleed gold square ' +
      'reads as a harsh block on a light tab strip. This is deliberately the OPPOSITE ' +
      'of the home-screen rule above.'
  )
  assert.equal(w, 32)
  assert.equal(h, 32)
})

// ---------------------------------------------------------------------------
// Wiring: retired art must not linger, and the mark must be ON the site.
// ---------------------------------------------------------------------------

test('nothing references the retired orb-and-wordmark SVGs', () => {
  for (const f of [
    ['src', 'app', 'manifest.ts'],
    ['src', 'app', 'layout.tsx'],
    ['public', 'sw.js'],
  ]) {
    const src = read(...f).replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{?\/\*[\s\S]*?\*\/\}?/g, '')
      .replace(/\/\/[^\n]*/g, '')
    for (const dead of ['icon-192.svg', 'icon-512.svg']) {
      assert.ok(
        !src.includes(dead),
        `${f.join('/')} still references ${dead} — that is the pre-July-30 art, which ` +
          'packed an orb, two rings and a two-line wordmark that was invisible mush at ' +
          'icon size.'
      )
    }
  }
})

test('both headers render the brand mark', () => {
  for (const [label, parts] of [
    ['authenticated Header', ['src', 'components', 'layout', 'Header.tsx']],
    ['landing nav', ['src', 'components', 'home', 'HomeClient.tsx']],
  ]) {
    assert.match(
      read(...parts),
      /icons\/icon-mark\.svg/,
      `${label} does not render the SS monogram. Before this, the authenticated header ` +
        'used a generic lucide Sparkles glyph — the app had no mark of its own on the ' +
        'one surface every page shows.'
    )
  }
})

test("Next's file-convention icons carry real letterform art", () => {
  // src/app/icon.svg and src/app/apple-icon.svg are a Next.js FILE CONVENTION —
  // their mere existence makes Next emit <link> tags. Both shipped as a gold STAR
  // unrelated to the brand mark, and they are not harmless:
  //   - /icon.svg is emitted LAST with sizes="any", so it can win the browser tab
  //     over the favicon PNGs declared in layout.tsx.
  //   - apple-icon.svg makes Next emit an apple-touch-icon link, and iOS cannot
  //     render SVG for a home-screen icon at all — the exact bug f70d937 fixed.
  //
  // They carry DIFFERENT art on purpose, and the sizes decide which:
  //   icon.svg (32px, browser tab) → the SINGLE-S favicon drawing. The two-S serif
  //     monogram measured as mush at 32px and unreadable noise at 16px.
  //   apple-icon.svg (180px) → the full monogram; there is plenty of room.
  // So this asserts "real outlined letterform, not placeholder polygon art" rather
  // than "identical to the monogram" — an earlier version demanded the latter and
  // rejected the correct favicon.
  for (const f of ['icon.svg', 'apple-icon.svg']) {
    const p = join(root, 'src', 'app', f)
    if (!existsSync(p)) continue // deleting them is also a valid answer
    const code = readFileSync(p, 'utf8').replace(/<!--[\s\S]*?-->/g, '')
    assert.match(
      code,
      /<path\b/,
      `src/app/${f} has no <path> — it must carry outlined letterform art.`
    )
    assert.ok(
      !/font-family|<text[\s>]/.test(code),
      `src/app/${f} depends on a font. Same rule as the other brand SVGs.`
    )
    // The discriminator is CURVE DENSITY, by a wide margin rather than a
    // fingerprint. A real outlined letterform is hundreds of bytes of Bezier data
    // per glyph; the gold star this replaced was a 10-line straight-edge polygon
    // (~330 bytes, zero curves). The threshold sits well below the single-S
    // favicon (~40 curves) and far above any polygon placeholder.
    //
    // Two earlier versions of this assertion were WRONG and both were caught by
    // testing them: the first tried to detect the star by its straight-line path
    // commands and PASSED against the real star; the second demanded monogram-level
    // curve counts and REJECTED the correct single-S favicon.
    const curves = (code.match(/[QqCc]/g) || []).length
    assert.ok(
      curves >= 20,
      `src/app/${f} has only ${curves} Bezier commands — that is polygon/placeholder ` +
        'art (the gold star that shipped here had zero), not an outlined letterform. ' +
        'A Next file-convention icon overrides <link> tags set deliberately in ' +
        'layout.tsx, so placeholder art here silently replaces the brand.'
    )
  }
})

test('the cache fence advanced so the new icon reaches returning visitors', () => {
  const m = read('public', 'sw.js').match(/const CACHE_NAME = 'seoul-sister-v(\d+)'/)
  assert.ok(m, 'CACHE_NAME must stay in the greppable seoul-sister-vN form.')
  assert.ok(
    Number(m[1]) >= 13,
    `CACHE_NAME is v${m[1]}. STATIC_ASSETS precaches the icon PNGs, so a returning ` +
      'visitor keeps the OLD icon until this name changes.'
  )
})
