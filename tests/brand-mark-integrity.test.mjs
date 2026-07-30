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
    Number(m[1]) >= 8,
    `CACHE_NAME is v${m[1]}. STATIC_ASSETS precaches the icon PNGs, so a returning ` +
      'visitor keeps the OLD icon until this name changes.'
  )
})
