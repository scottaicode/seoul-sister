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
