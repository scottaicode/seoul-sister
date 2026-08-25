import { createSign } from 'node:crypto'

// ---------------------------------------------------------------------------
// Google Search Console Search Analytics client (zero-dependency).
// Service-account JWT -> OAuth2 token -> searchanalytics.query.
// Read-only scope; the service account must be added as a user on the
// Search Console property (Search Console has its own permission system —
// Cloud IAM roles do NOT apply). See SEO-GUARDIAN-SETUP.md.
// ---------------------------------------------------------------------------

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/webmasters.readonly'

export interface GscRow {
  query: string
  page: string
  clicks: number
  impressions: number
  ctr: number // fraction, 0.0353 = 3.53%
  position: number
}

export interface GscConfig {
  clientEmail: string
  privateKey: string
  siteUrl: string // e.g. 'sc-domain:seoulsister.com'
}

export function getGscConfig(): GscConfig | null {
  const clientEmail = process.env.GSC_CLIENT_EMAIL
  const privateKey = process.env.GSC_PRIVATE_KEY
  if (!clientEmail || !privateKey) return null
  return {
    clientEmail,
    // Vercel env vars store the PEM with literal \n sequences — restore real
    // newlines or node:crypto fails with an opaque OpenSSL decode error.
    privateKey: privateKey.replace(/\\n/g, '\n'),
    siteUrl: process.env.GSC_SITE_URL || 'sc-domain:seoulsister.com',
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function getAccessToken(config: GscConfig): Promise<string> {
  const iat = Math.floor(Date.now() / 1000)
  const header = base64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  // No `sub` claim — that is Workspace domain-wide delegation only; including
  // it without delegation configured fails with unauthorized_client.
  const claims = base64url(
    JSON.stringify({
      iss: config.clientEmail,
      scope: SCOPE,
      aud: TOKEN_URL,
      exp: iat + 3600,
      iat,
    })
  )
  const signingInput = `${header}.${claims}`
  const signature = base64url(
    createSign('RSA-SHA256').update(signingInput).sign(config.privateKey)
  )

  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: `${signingInput}.${signature}`,
    }),
  })
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GSC token exchange failed (${res.status}): ${body.slice(0, 300)}`)
  }
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error('GSC token exchange returned no access_token')
  return json.access_token
}

/**
 * Pull query+page Search Analytics rows for a date window, paginating until
 * exhausted. Dates are YYYY-MM-DD, interpreted by Google in Pacific Time.
 * GSC data lags ~3 days — callers should end the window at today-3d.
 */
/**
 * TRUE site totals for the window — an UNDIMENSIONED query.
 *
 * Why this exists (measured Aug 25 2026 against Scott's own Search Console):
 * summing the `['query','page']` rows UNDERCOUNTS badly, because Google
 * WITHHOLDS rows for rare/anonymized queries. It is not a pagination bug — the
 * dimensioned call returned 3,072 rows against a 25,000 limit, so nothing was
 * truncated; the rows simply are not served.
 *
 * The gap is enormous and was silently wrong in every weekly report:
 *   28d — console 568 clicks / 63.9K impr   vs   summed rows 73 / 12,056
 *         (the report saw 12.9% of clicks, 18.9% of impressions)
 *   7d  — console 192 clicks   vs   81 clicks across the visible query rows
 *         (58% of clicks live in withheld rows)
 *
 * A report that says "73 clicks, slow healthy drift upward" about a site
 * actually earning 568 is not a small error: it drives which pages get bets, it
 * is the baseline every bet is graded against, and it made the funnel look
 * traffic-starved when the real shortfall is arrival→conversation.
 *
 * Dimensioned rows stay the analysis surface (they are the only way to see
 * per-query position). This call supplies the DENOMINATOR alongside them.
 */
export async function fetchSiteTotals(
  config: GscConfig,
  startDate: string,
  endDate: string
): Promise<{ clicks: number; impressions: number; ctr: number; position: number } | null> {
  const token = await getAccessToken(config)
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl)}/searchAnalytics/query`

  const res = await fetch(url, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    // NO `dimensions` key: one aggregate row for the whole window.
    body: JSON.stringify({ startDate, endDate, rowLimit: 1 }),
  })
  if (!res.ok) {
    // Never throw: a failed totals call must not kill the weekly report. The
    // caller falls back to summed rows and SAYS SO, rather than silently
    // presenting an undercount as truth.
    console.error(`[gsc] site-totals query failed (${res.status}) — falling back to summed rows`)
    return null
  }
  const json = (await res.json()) as {
    rows?: Array<{ clicks: number; impressions: number; ctr: number; position: number }>
  }
  const row = json.rows?.[0]
  if (!row) return null
  return {
    clicks: Math.round(row.clicks),
    impressions: Math.round(row.impressions),
    ctr: row.ctr,
    position: row.position,
  }
}

export async function fetchSearchAnalytics(
  config: GscConfig,
  startDate: string,
  endDate: string
): Promise<GscRow[]> {
  const token = await getAccessToken(config)
  // siteUrl is a path segment: the colon in sc-domain: MUST be percent-encoded.
  const url = `https://www.googleapis.com/webmasters/v3/sites/${encodeURIComponent(config.siteUrl)}/searchAnalytics/query`

  const all: GscRow[] = []
  const ROW_LIMIT = 25000
  let startRow = 0

  for (;;) {
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        startDate,
        endDate,
        dimensions: ['query', 'page'],
        rowLimit: ROW_LIMIT,
        startRow,
      }),
    })
    if (!res.ok) {
      const body = await res.text()
      throw new Error(`GSC query failed (${res.status}): ${body.slice(0, 300)}`)
    }
    const json = (await res.json()) as {
      rows?: Array<{ keys: string[]; clicks: number; impressions: number; ctr: number; position: number }>
    }
    // `rows` is ABSENT (not []) when there are no results.
    const rows = json.rows ?? []
    for (const r of rows) {
      all.push({
        query: r.keys[0] ?? '',
        page: r.keys[1] ?? '',
        clicks: r.clicks,
        impressions: r.impressions,
        ctr: r.ctr,
        position: r.position,
      })
    }
    if (rows.length < ROW_LIMIT) break
    startRow += ROW_LIMIT
  }

  return all
}
