/**
 * Reddit OAuth 2.0 — Script-type authentication for server-side use.
 *
 * Uses Reddit's "script" app flow (client credentials + bot account)
 * to get an OAuth bearer token for authenticated API access at 60 req/min.
 *
 * Env vars required:
 *   REDDIT_CLIENT_ID, REDDIT_CLIENT_SECRET, REDDIT_USERNAME, REDDIT_PASSWORD
 */

const TOKEN_URL = 'https://www.reddit.com/api/v1/access_token'
const API_BASE = 'https://oauth.reddit.com'
const PUBLIC_BASE = 'https://www.reddit.com'
const USER_AGENT = 'SeoulSister/1.0 (K-beauty trend intelligence)'

// In-memory token cache
let cachedToken: string | null = null
let tokenExpiresAt = 0

// Rate limiting: 60 req/min for authenticated, 10 req/min for public
let lastRequestAt = 0
const MIN_REQUEST_INTERVAL_MS = 1100 // ~55 req/min with margin

/**
 * Obtain an OAuth access token from Reddit. Caches in memory with
 * 55-minute TTL (tokens last 1 hour).
 */
async function getAccessToken(): Promise<string | null> {
  const clientId = process.env.REDDIT_CLIENT_ID
  const clientSecret = process.env.REDDIT_CLIENT_SECRET
  const username = process.env.REDDIT_USERNAME
  const password = process.env.REDDIT_PASSWORD

  if (!clientId || !clientSecret || !username || !password) {
    console.warn('[reddit-oauth] Missing Reddit credentials — falling back to public API')
    return null
  }

  // Return cached token if still valid (5 min buffer)
  if (cachedToken && Date.now() < tokenExpiresAt - 300_000) {
    return cachedToken
  }

  try {
    const credentials = Buffer.from(`${clientId}:${clientSecret}`).toString('base64')
    const body = new URLSearchParams({
      grant_type: 'password',
      username,
      password,
    })

    const res = await fetch(TOKEN_URL, {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${credentials}`,
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': USER_AGENT,
      },
      body: body.toString(),
    })

    if (!res.ok) {
      const text = await res.text()
      console.error(`[reddit-oauth] Token request failed (${res.status}): ${text}`)
      cachedToken = null
      return null
    }

    const data = await res.json()
    cachedToken = data.access_token
    tokenExpiresAt = Date.now() + (data.expires_in ?? 3600) * 1000

    console.log('[reddit-oauth] Token obtained successfully')
    return cachedToken
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    console.error(`[reddit-oauth] Token request error: ${msg}`)
    cachedToken = null
    return null
  }
}

/**
 * Rate-limited fetch from Reddit API. Uses OAuth if credentials are
 * available, falls back to public API (10 req/min) otherwise.
 */
export async function redditFetch(
  endpoint: string,
  params?: Record<string, string>
): Promise<unknown> {
  // Rate limiting
  const now = Date.now()
  const elapsed = now - lastRequestAt
  if (elapsed < MIN_REQUEST_INTERVAL_MS) {
    await new Promise(resolve => setTimeout(resolve, MIN_REQUEST_INTERVAL_MS - elapsed))
  }
  lastRequestAt = Date.now()

  const token = await getAccessToken()
  const base = token ? API_BASE : PUBLIC_BASE
  const url = new URL(`${base}${endpoint}`)

  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value)
    }
  }

  // Public API needs .json suffix
  if (!token && !url.pathname.endsWith('.json')) {
    url.pathname += '.json'
  }

  const headers: Record<string, string> = {
    'User-Agent': USER_AGENT,
  }
  if (token) {
    headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(url.toString(), { headers })

  if (res.status === 401 && token) {
    // Token expired — clear cache and retry once with public API
    console.warn('[reddit-oauth] Token expired, falling back to public API')
    cachedToken = null
    tokenExpiresAt = 0
    return redditFetch(endpoint, params)
  }

  if (res.status === 429) {
    console.warn('[reddit-oauth] Rate limited by Reddit — backing off 5s')
    await new Promise(resolve => setTimeout(resolve, 5000))
    return redditFetch(endpoint, params)
  }

  if (!res.ok) {
    throw new Error(`Reddit API error ${res.status}: ${await res.text()}`)
  }

  return res.json()
}
