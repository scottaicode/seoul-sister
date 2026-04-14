/**
 * Wraps a product image URL through the /api/img proxy to avoid
 * cross-origin blocking on Safari iOS and Firefox ORB.
 *
 * Only proxies URLs from known product CDN domains. Returns the
 * original URL unchanged for domains that don't need proxying
 * (e.g., Supabase storage, same-origin).
 */

const PROXY_DOMAINS = new Set([
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

export function proxyImageUrl(url: string | null): string | null {
  if (!url) return null

  try {
    const parsed = new URL(url)
    if (PROXY_DOMAINS.has(parsed.hostname)) {
      return `/api/img?url=${encodeURIComponent(url)}`
    }
  } catch {
    // Invalid URL, return as-is
  }

  return url
}
