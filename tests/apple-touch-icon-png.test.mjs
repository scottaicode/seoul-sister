/**
 * Guard test — home-screen and social icons must be PNG, not SVG.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 *
 * Found July 29 2026 while writing the icon spec for Bailey, and it is independent
 * of the logo redesign.
 *
 *   <link rel="apple-touch-icon" href="/icons/icon-192.svg" />
 *
 * iOS does NOT support SVG for home-screen icons. So every iPhone that added Seoul
 * Sister to its home screen got a SCREENSHOT of the page instead of the logo —
 * during the exact session we were walking Bailey through installing it. The
 * manifest had the same problem: every entry was image/svg+xml, and Android's
 * installer support for SVG is inconsistent.
 *
 * The og:image tags were SVG too. Every social platform rejects SVG for previews,
 * so blog shares rendered with no image at all.
 *
 * Rendering the old icon-512.svg down to 180px also proved it could not be the
 * source art: it packs an orb, two rings, the 유 glyph AND a two-line wordmark, and
 * at 180px "SISTER" is invisible. The interim icon is the 유 alone.
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

const layoutSrc = read('src', 'app', 'layout.tsx')
const manifestSrc = read('src', 'app', 'manifest.ts')
const swSrc = read('public', 'sw.js')

const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\/.*$/gm, '')

// ---------------------------------------------------------------------------
// The files have to actually exist, at the right dimensions
// ---------------------------------------------------------------------------

const PNGS = [
  ['public/icons/apple-touch-icon.png', 180],
  ['public/icons/icon-192.png', 192],
  ['public/icons/icon-512.png', 512],
]

for (const [rel, size] of PNGS) {
  test(`${rel} exists and is a real PNG`, () => {
    const p = join(root, rel)
    assert.ok(existsSync(p), `${rel} is missing — iOS falls back to a page screenshot.`)
    assert.ok(statSync(p).size > 500, `${rel} is suspiciously small; likely a broken render.`)

    // PNG magic bytes + IHDR width/height, read directly. No image library needed.
    const buf = readFileSync(p)
    assert.equal(
      buf.subarray(0, 8).toString('hex'),
      '89504e470d0a1a0a',
      `${rel} is not a PNG. iOS ignores SVG for home-screen icons.`
    )
    assert.equal(buf.readUInt32BE(16), size, `${rel} should be ${size}px wide.`)
    assert.equal(buf.readUInt32BE(20), size, `${rel} should be ${size}px tall.`)
  })
}

test('the home-screen PNG is opaque', () => {
  // iOS composites a transparent icon onto WHITE, which would frame a near-black
  // icon in a white box. colourType 2 = truecolour without alpha.
  const buf = readFileSync(join(root, 'public/icons/apple-touch-icon.png'))
  const colourType = buf.readUInt8(25)
  assert.ok(
    colourType === 2 || colourType === 0,
    `apple-touch-icon has colour type ${colourType} (alpha present). iOS would ` +
      'composite it onto white.'
  )
})

// ---------------------------------------------------------------------------
// Wiring
// ---------------------------------------------------------------------------

test('apple-touch-icon points at the PNG, never an SVG', () => {
  const code = stripComments(layoutSrc)
  assert.match(
    code,
    /rel="apple-touch-icon"[^>]*href="\/icons\/apple-touch-icon\.png"/,
    'apple-touch-icon must be the PNG.'
  )
  assert.doesNotMatch(
    code,
    /rel="apple-touch-icon"[^>]*\.svg/,
    'apple-touch-icon is an SVG again — iPhones will show a page screenshot ' +
      'instead of the logo.'
  )
})

test('the manifest leads with PNG icons', () => {
  const code = stripComments(manifestSrc)
  const firstIcon = code.indexOf("src: '/icons/")
  const firstPng = code.indexOf("type: 'image/png'")
  assert.ok(firstPng > -1, 'The manifest must declare PNG icons.')
  const svgOnly = !/image\/png/.test(code)
  assert.ok(!svgOnly, 'An SVG-only manifest falls back to a generic install icon.')
  assert.ok(firstIcon > -1, 'No icons declared at all.')
})

test('the manifest declares a maskable icon', () => {
  assert.match(
    manifestSrc,
    /purpose: 'maskable'/,
    'Without a maskable entry Android crops the standard icon and can clip it.'
  )
})

test('social preview images are PNG', () => {
  // Every social platform rejects SVG for og:image, so shares rendered blank.
  const blogSrc = read('src', 'app', 'blog', 'page.tsx')
  assert.doesNotMatch(
    blogSrc,
    /images:\s*\[\s*\{\s*url:\s*'[^']*\.svg'/,
    'og:image must not be an SVG — social platforms will not render it.'
  )
  assert.match(blogSrc, /icon-512\.png/, 'Lost the PNG social image.')
})

test('the service worker precaches icons that exist', () => {
  const code = stripComments(swSrc)
  assert.doesNotMatch(
    code,
    /STATIC_ASSETS[\s\S]{0,120}icon-192\.svg/,
    'Precaching the old SVG icons wastes the install on assets nothing references.'
  )
  assert.match(code, /apple-touch-icon\.png/, 'The SW should precache the real icon.')
})

test('CACHE_NAME was bumped so the new precache list reaches returning users', () => {
  const m = swSrc.match(/const CACHE_NAME = 'seoul-sister-v(\d+)'/)
  assert.ok(m, 'CACHE_NAME must stay in the greppable seoul-sister-vN form.')
  assert.ok(
    Number(m[1]) >= 4,
    `CACHE_NAME is v${m[1]}. Changing STATIC_ASSETS without a bump leaves ` +
      'returning visitors on the old list.'
  )
})

// ---------------------------------------------------------------------------
// The interim art must not repeat the mistake it replaced
// ---------------------------------------------------------------------------

test('the interim icon has no wordmark baked in', () => {
  // The old icon-512.svg contained "SEOUL" and "SISTER" as text. At 180px that is
  // an unreadable smudge, and iOS already prints the app name under the icon.
  const markSrc = read('public', 'icons', 'icon-mark.svg')
  assert.doesNotMatch(
    markSrc,
    />SEOUL</,
    'No wordmark in the app icon — iOS prints the name underneath already.'
  )
  assert.doesNotMatch(markSrc, />SISTER</, 'No wordmark in the app icon.')
})
