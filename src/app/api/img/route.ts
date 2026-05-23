import { NextRequest, NextResponse } from 'next/server'

/**
 * GET /api/img?url=<encoded-image-url>
 *
 * Proxies product images through Seoul Sister's own domain to avoid
 * cross-origin blocking on Safari iOS and Firefox ORB. Olive Young's CDN
 * (cdn-image.oliveyoung.com) doesn't send Access-Control-Allow-Origin
 * headers and sets cookies on every request, which causes Safari ITP and
 * Firefox ORB to block the images when loaded cross-origin via <img> tags.
 *
 * By proxying through our domain, the browser sees a same-origin request
 * and renders the image without cross-origin restrictions.
 *
 * Only allows image URLs from known product CDN domains to prevent
 * open-proxy abuse.
 */

const ALLOWED_DOMAINS = new Set([
  'cdn-image.oliveyoung.com',
  'image.oliveyoung.com',
  'dist.oliveyoung.com',
  'cdn.shopify.com',
  'image.yesstyle.com',
  'img.yesstyle.com',
  'medicube.us',
  'www.cosrx.com',
  'theisntree.com',
  'heimish.us',
  'www.dodoskin.com',
  'neogenlab.us',
  'tonymoly.us',
  'us.laneige.com',
  'us.innisfree.com',
  'misshaus.com',
  'us.sulwhasoo.com',
  'www.wishtrend.com',
  'wishtrend.com',
  'beautyofjoseon.com',
  'dalba.com',
  'anua.com',
  'www.sephora.com',
  'd1flfk77wl2xk4.cloudfront.net',
])

export async function GET(request: NextRequest) {
  const url = request.nextUrl.searchParams.get('url')

  if (!url) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 })
  }

  // Validate the domain is in our allowlist
  let parsedUrl: URL
  try {
    parsedUrl = new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  if (!ALLOWED_DOMAINS.has(parsedUrl.hostname)) {
    return NextResponse.json({ error: 'Domain not allowed' }, { status: 403 })
  }

  try {
    const response = await fetch(url, {
      headers: {
        // v10.8.3: browser-style UA reduces Cloudflare bot-management
        // challenges in front of Olive Young's CDN. Generic UAs like
        // "SeoulSister/1.0" were getting passed but occasionally challenged.
        'User-Agent':
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/123.0.0.0 Safari/537.36',
        Accept: 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
      },
    })

    if (!response.ok) {
      return new NextResponse(null, { status: response.status })
    }

    const buffer = await response.arrayBuffer()
    const bytes = new Uint8Array(buffer)
    const upstreamCT = response.headers.get('content-type') || ''

    // v10.8.3: override application/octet-stream + missing/wrong content-type
    // with sniffed image/*. Olive Young CDN returns octet-stream for every
    // image, which Bailey's browser correctly refused to render — this was
    // root cause of "why don't most products have images?" surfaced May 23.
    const contentType = upstreamCT.startsWith('image/')
      ? upstreamCT
      : sniffImageContentType(bytes, 'image/jpeg')

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Content-Length': String(bytes.byteLength),
        // 1 year, immutable — Olive Young paths are content-hashed UUIDs.
        // Vercel edge caches aggressively after first request.
        'Cache-Control': 'public, max-age=31536000, immutable, s-maxage=31536000',
        'Access-Control-Allow-Origin': '*',
        'Referrer-Policy': 'no-referrer',
      },
    })
  } catch (err) {
    console.error('[/api/img] proxy error:', err)
    return new NextResponse(null, { status: 502 })
  }
}

/**
 * Sniff image content type from magic bytes. Used when upstream returns
 * application/octet-stream (Olive Young CDN). Browsers refuse to render
 * <img> tags whose Content-Type is octet-stream regardless of byte content,
 * so we must rewrite the header.
 */
function sniffImageContentType(bytes: Uint8Array, fallback: string): string {
  if (bytes.length < 4) return fallback
  // JPEG: FF D8 FF
  if (bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff) return 'image/jpeg'
  // PNG: 89 50 4E 47
  if (bytes[0] === 0x89 && bytes[1] === 0x50 && bytes[2] === 0x4e && bytes[3] === 0x47) return 'image/png'
  // WebP: RIFF....WEBP
  if (
    bytes.length >= 12 &&
    bytes[0] === 0x52 &&
    bytes[1] === 0x49 &&
    bytes[2] === 0x46 &&
    bytes[3] === 0x46 &&
    bytes[8] === 0x57 &&
    bytes[9] === 0x45 &&
    bytes[10] === 0x42 &&
    bytes[11] === 0x50
  ) {
    return 'image/webp'
  }
  // GIF: GIF8
  if (bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46 && bytes[3] === 0x38) return 'image/gif'
  // AVIF: ftyp box with avif brand
  if (bytes.length >= 12 && bytes[4] === 0x66 && bytes[5] === 0x74 && bytes[6] === 0x79 && bytes[7] === 0x70) {
    return 'image/avif'
  }
  // SVG: starts with '<'
  if (bytes[0] === 0x3c) return 'image/svg+xml'
  return fallback
}
