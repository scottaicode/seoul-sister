/**
 * IndexNow — instant search-engine notification on publish.
 *
 * IndexNow is an open protocol (Bing, Yandex, and partners) that lets a site
 * tell search engines "these URLs just changed, come recrawl them" instead of
 * waiting for an organic crawl. One POST notifies all participating engines.
 * Google does NOT participate — it discovers via the sitemap — so this is a
 * Bing/Yandex accelerator, which is Seoul Sister's strongest GEO channel.
 *
 * Ownership is verified by hosting `public/<key>.txt` whose contents equal the
 * key. The key lives in INDEXNOW_KEY; the hosted file name must match it.
 *
 * This is fire-and-forget and NON-CRITICAL: a failed ping must never fail the
 * ingest that triggered it. All failures are logged (not swallowed) so a broken
 * key or endpoint change surfaces in logs rather than silently degrading.
 */

const HOST = 'www.seoulsister.com'
const SITE = `https://${HOST}`
const ENDPOINT = 'https://api.indexnow.org/indexnow'

/**
 * Notify IndexNow that the given URLs changed. Accepts absolute URLs or
 * site-relative paths (which are resolved against the canonical host).
 *
 * @returns true if the submission was accepted (HTTP 2xx), false otherwise.
 *          Never throws — errors are logged and reported via the return value.
 */
export async function submitToIndexNow(urls: string[]): Promise<boolean> {
  const key = process.env.INDEXNOW_KEY
  if (!key) {
    console.warn('[indexnow] INDEXNOW_KEY not set — skipping submission')
    return false
  }

  // Normalize to absolute, same-host URLs; IndexNow rejects mixed/foreign hosts.
  const urlList = Array.from(
    new Set(
      urls
        .map((u) => (u.startsWith('http') ? u : `${SITE}${u.startsWith('/') ? '' : '/'}${u}`))
        .filter((u) => {
          try {
            return new URL(u).host === HOST
          } catch {
            return false
          }
        })
    )
  )

  if (urlList.length === 0) {
    console.warn('[indexnow] no valid same-host URLs to submit')
    return false
  }

  try {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
      },
      body: JSON.stringify({
        host: HOST,
        key,
        keyLocation: `${SITE}/${key}.txt`,
        urlList,
      }),
    })

    // IndexNow returns 200 (accepted) or 202 (accepted, pending validation).
    if (res.ok) {
      console.log(`[indexnow] submitted ${urlList.length} URL(s), status ${res.status}`)
      return true
    }

    console.error(
      `[indexnow] submission rejected: status ${res.status} ${res.statusText}`
    )
    return false
  } catch (err) {
    console.error('[indexnow] submission failed:', err instanceof Error ? err.message : err)
    return false
  }
}
