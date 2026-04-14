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
        'User-Agent': 'Mozilla/5.0 (compatible; SeoulSister/1.0)',
        'Accept': 'image/*',
      },
    })

    if (!response.ok) {
      return new NextResponse(null, { status: response.status })
    }

    const contentType = response.headers.get('content-type') || 'image/jpeg'
    const buffer = await response.arrayBuffer()

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=2592000, immutable', // 30 days
        'Access-Control-Allow-Origin': '*',
      },
    })
  } catch {
    return new NextResponse(null, { status: 502 })
  }
}
