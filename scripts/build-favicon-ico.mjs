/**
 * Build /public/favicon.ico (16+32+48) and /public/icons/favicon-48.png.
 *
 * WHY (Aug 7 2026). Bailey: "I thought we got rid of the ugly guy" — Google was
 * still showing the retired 유 Hangul stopgap next to seoulsister.com, which at
 * 16px reads as a stick figure in a hat. Every asset in the repo was already
 * correct; the problem was entirely on Google's side, and two real gaps kept it
 * from re-crawling:
 *
 *   1. /favicon.ico was a hard 404. That is the location Google requests by
 *      default and trusts most. Nothing was there.
 *   2. The largest declared favicon was 32px. Google's own docs (verified at
 *      developers.google.com/search/docs/appearance/favicon-in-search, not
 *      recalled) say: "we recommend using a favicon that's larger than 48x48px".
 *      There is NO multiple-of-48 rule — that was a wrong theory, checked and
 *      discarded before it cost a pointless resize.
 *
 * Also documented there and load-bearing here: "The favicon URL must be stable
 * (don't change the URL frequently)." The icon churned six times in one day on
 * Jul 29-30. /favicon.ico is a permanent, unversioned path — pick it once and
 * never move it.
 *
 * DRAWING DISCIPLINE (inherited from public/icons/favicon.svg, earned):
 * draw AT the target size rather than downscaling a 512-unit master. A previous
 * favicon measured 38% mid-tone pixels — pure anti-aliasing smear. Each size
 * here is rendered 1:1 from an SVG authored at that exact pixel size, with the
 * corner radius and glyph scale recomputed per size so stems land on the pixel
 * grid.
 *
 * RENDERER: `sharp` (already a dependency — it ships librsvg). Do NOT use
 * macOS `qlmanage` here, which was the first attempt and produced a visibly
 * wrong icon: qlmanage treats an SVG as a PAGE, drawing the artwork at natural
 * size in the top-left of an otherwise white canvas, so `-s 48` yielded a tiny
 * mark on a white square rather than a 48px icon. Caught only by LOOKING at the
 * output — the file had correct dimensions and a plausible byte count, so every
 * indirect check passed. There is no ImageMagick, rsvg-convert, or Pillow on
 * this machine; sharp is the supported path.
 *
 * The .ico container is written byte-by-byte below; an ICO holding PNG frames is
 * valid per the format and is what modern browsers expect.
 *
 *   node scripts/build-favicon-ico.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import sharp from 'sharp'

// The single-S Poppins Bold glyph outline, lifted verbatim from
// public/icons/favicon.svg so the two drawings can never drift apart.
const GLYPH_PATH =
  'M316 7Q239 7 178-18Q117-43 80.50-92Q44-141 42-210L224-210Q228-171 251-150.50' +
  'Q274-130 311-130Q349-130 371-147.50Q393-165 393-196Q393-222 375.50-239' +
  'Q358-256 332.50-267Q307-278 260-292Q192-313 149-334Q106-355 75-396' +
  'Q44-437 44-503Q44-601 115-656.50Q186-712 300-712Q416-712 487-656.50' +
  'Q558-601 563-502L378-502Q376-536 353-555.50Q330-575 294-575Q263-575 244-558.50' +
  'Q225-542 225-511Q225-477 257-458Q289-439 357-417Q425-394 467.50-373' +
  'Q510-352 541-312Q572-272 572-209Q572-149 541.50-100Q511-51 453-22Q395 7 316 7'

/**
 * The 32px reference geometry, from favicon.svg: radius 6/32, glyph translated
 * to (7, 27) at scale 0.03060. Expressed as ratios so any size reproduces the
 * same optical weight, then SNAPPED to whole pixels (Math.round) so stems sit on
 * the grid instead of straddling it.
 */
const REF = { size: 32, radius: 6, tx: 7, ty: 27, scale: 0.03060 }

function svgAt(size) {
  const k = size / REF.size
  const radius = Math.round(REF.radius * k)
  const tx = Math.round(REF.tx * k)
  const ty = Math.round(REF.ty * k)
  const scale = (REF.scale * k).toFixed(5)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" shape-rendering="crispEdges" role="img" aria-label="Seoul Sister">
<title>Seoul Sister</title>
<defs><linearGradient id="t" x1="0.1" y1="0" x2="0.6" y2="1">
<stop offset="0%" stop-color="#EDCB8B"/><stop offset="45%" stop-color="#CFA257"/>
<stop offset="100%" stop-color="#A87F38"/></linearGradient></defs>
<rect width="${size}" height="${size}" rx="${radius}" fill="url(#t)"/>
<g transform="translate(${tx} ${ty}) scale(${scale})"><path d="${GLYPH_PATH}" fill="#0D0D0F"/></g></svg>`
}

/**
 * Render one SVG to an exact-size PNG.
 *
 * The SVG is authored AT this pixel size (see svgAt), so sharp rasterizes 1:1
 * with no resampling — which is the whole point: a downscaled master is what
 * produced the 38%-mid-tone smear this drawing exists to avoid. `density` is set
 * so librsvg's user-unit-to-pixel mapping is exactly 1.
 */
async function renderPng(size) {
  return sharp(Buffer.from(svgAt(size)), { density: 72 })
    .resize(size, size, { fit: 'fill' })
    .png({ compressionLevel: 9 })
    .toBuffer()
}

/**
 * Pack PNG frames into an ICO container.
 * Header: 6 bytes. Then one 16-byte directory entry per image, then the data.
 * A width/height byte of 0 means 256; all our sizes are < 256 so they encode
 * directly.
 */
function buildIco(frames) {
  const count = frames.length
  const header = Buffer.alloc(6)
  header.writeUInt16LE(0, 0) // reserved
  header.writeUInt16LE(1, 2) // type 1 = icon
  header.writeUInt16LE(count, 4)

  const entries = []
  let offset = 6 + count * 16
  for (const { size, data } of frames) {
    const e = Buffer.alloc(16)
    e.writeUInt8(size >= 256 ? 0 : size, 0) // width
    e.writeUInt8(size >= 256 ? 0 : size, 1) // height
    e.writeUInt8(0, 2) // palette count (0 = no palette)
    e.writeUInt8(0, 3) // reserved
    e.writeUInt16LE(1, 4) // color planes
    e.writeUInt16LE(32, 6) // bits per pixel
    e.writeUInt32LE(data.length, 8)
    e.writeUInt32LE(offset, 12)
    entries.push(e)
    offset += data.length
  }

  return Buffer.concat([header, ...entries, ...frames.map((f) => f.data)])
}

// 16 and 32 for crisp tab rendering; 48 because Google recommends >48px and
// reads the largest declared icon.
const sizes = [16, 32, 48]
const frames = []
for (const size of sizes) {
  const data = await renderPng(size)
  // Sanity-check the raster actually carries the icon rather than a blank page —
  // the qlmanage failure produced correct dimensions and a plausible byte count
  // while being ~97% white. A gold-tile icon must be overwhelmingly non-white.
  const { channels } = await sharp(data).stats()
  const meanLuma = (channels[0].mean + channels[1].mean + channels[2].mean) / 3
  if (meanLuma > 240) {
    throw new Error(
      `${size}x${size} rendered almost entirely white (mean ${meanLuma.toFixed(1)}) — ` +
        'the SVG did not fill the canvas. Do not ship this.'
    )
  }
  console.log(`  rendered ${size}x${size}  ${data.length} bytes  mean-luma ${meanLuma.toFixed(1)}`)
  frames.push({ size, data })
}

const ico = buildIco(frames)
writeFileSync('public/favicon.ico', ico)
console.log(`\n  public/favicon.ico            ${ico.length} bytes  (${sizes.join('+')})`)

// Standalone 48px PNG so the <link> tags can declare a >48px-class icon
// explicitly, not only inside the .ico.
const png48 = frames.find((f) => f.size === 48).data
writeFileSync('public/icons/favicon-48.png', png48)
console.log(`  public/icons/favicon-48.png   ${png48.length} bytes`)
