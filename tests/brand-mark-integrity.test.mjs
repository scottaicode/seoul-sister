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

/** Minimal PNG reader: returns {w,h,px(x,y)} for truecolour/greyscale PNGs. */
function readPng(rel) {
  const d = readFileSync(icons(rel))
  const w = d.readUInt32BE(16), h = d.readUInt32BE(20)
  const colourType = d[25]
  let idat = Buffer.alloc(0)
  for (let i = 8; i < d.length; ) {
    const len = d.readUInt32BE(i)
    if (d.slice(i + 4, i + 8).toString() === 'IDAT') idat = Buffer.concat([idat, d.slice(i + 8, i + 8 + len)])
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
  return { w, h, colourType, px: (x, y) => [...rows[y].slice(x * ch, (x + 1) * ch)] }
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
    ['landing nav', ['src', 'app', 'page.tsx']],
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

test('the cache fence advanced so the new icon reaches returning visitors', () => {
  const m = read('public', 'sw.js').match(/const CACHE_NAME = 'seoul-sister-v(\d+)'/)
  assert.ok(m, 'CACHE_NAME must stay in the greppable seoul-sister-vN form.')
  assert.ok(
    Number(m[1]) >= 9,
    `CACHE_NAME is v${m[1]}. STATIC_ASSETS precaches the icon PNGs, so a returning ` +
      'visitor keeps the OLD icon until this name changes.'
  )
})
