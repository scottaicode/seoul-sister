import { createSign } from 'node:crypto'

// ---------------------------------------------------------------------------
// Google Analytics Data API (GA4) client — zero-dependency.
// Service-account JWT -> OAuth2 token -> runReport.
//
// Deliberately mirrors src/lib/seo/gsc-client.ts rather than pulling in
// @google-analytics/data: the JWT dance is ~40 lines, the SDK is megabytes, and
// the GSC client has already proven this pattern in production.
//
// SETUP (console work only Scott can do — see the panel's not_configured state):
//   1. Enable the "Google Analytics Data API" in the SAME Google Cloud project
//      that owns the GSC service account.
//   2. Add that service account's email as a VIEWER on the GA4 property
//      (GA4 Admin -> Property access management). GA4 has its own permission
//      system; Cloud IAM roles do NOT grant property access.
//   3. Set GA4_PROPERTY_ID to the NUMERIC property id (e.g. 123456789), not the
//      G-XXXXXXX measurement id. Mixing these up is the most common failure.
//
// WHY ONLY SOURCE BREAKDOWNS ARE EXPOSED. Seoul Sister's GA4 is heavily
// bot-inflated — 120 of 265 "active users" came from Singapore datacenters on
// Aug 10 2026, and GA4 reported 346 phantom users against 0 database rows on
// Jul 27. Raw user/pageview totals are therefore NOT surfaced by this module.
//
// Session-source rows are a meaningfully cleaner slice: a session tagged
// utm_source=tiktok arrived through Bailey's /tt bio link, and crawlers do not
// append UTM parameters. That gives the one number the database genuinely
// cannot produce — the DENOMINATOR (people who landed) against our own
// numerator (people who actually talked to Yuri).
// ---------------------------------------------------------------------------

const TOKEN_URL = 'https://oauth2.googleapis.com/token'
const SCOPE = 'https://www.googleapis.com/auth/analytics.readonly'

export interface Ga4Config {
  clientEmail: string
  privateKey: string
  propertyId: string
}

export interface Ga4SourceRow {
  source: string
  sessions: number
}

/**
 * Returns null when GA4 is not wired up yet. Callers MUST treat null as a soft
 * "not configured" state and still render — never as an error. The dashboard's
 * database panels do not depend on GA4 and must work without it.
 */
export function getGa4Config(): Ga4Config | null {
  const clientEmail = process.env.GSC_CLIENT_EMAIL
  const privateKey = process.env.GSC_PRIVATE_KEY
  const propertyId = process.env.GA4_PROPERTY_ID
  if (!clientEmail || !privateKey || !propertyId) return null
  return {
    clientEmail,
    // Vercel stores the PEM with literal \n sequences — restore real newlines
    // or node:crypto fails with an opaque OpenSSL decode error.
    privateKey: privateKey.replace(/\\n/g, '\n'),
    // Tolerate someone pasting "properties/123456789".
    propertyId: propertyId.replace(/^properties\//, '').trim(),
  }
}

function base64url(input: Buffer | string): string {
  return Buffer.from(input)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}

async function getAccessToken(config: Ga4Config): Promise<string> {
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
    throw new Error(`GA4 token exchange failed (${res.status}): ${body.slice(0, 300)}`)
  }
  const json = (await res.json()) as { access_token?: string }
  if (!json.access_token) throw new Error('GA4 token exchange returned no access_token')
  return json.access_token
}

interface RunReportResponse {
  rows?: Array<{
    dimensionValues?: Array<{ value?: string }>
    metricValues?: Array<{ value?: string }>
  }>
}

/**
 * Sessions grouped by session source for the last `days` days.
 *
 * `sessionSource` is the UTM-derived source ('tiktok', 'google', 'chatgpt.com'),
 * which is what makes this the honest slice — see the module header.
 */
export async function fetchSessionsBySource(
  config: Ga4Config,
  days = 7
): Promise<Ga4SourceRow[]> {
  const token = await getAccessToken(config)
  const res = await fetch(
    `https://analyticsdata.googleapis.com/v1beta/properties/${config.propertyId}:runReport`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        dateRanges: [{ startDate: `${days}daysAgo`, endDate: 'today' }],
        dimensions: [{ name: 'sessionSource' }],
        metrics: [{ name: 'sessions' }],
        orderBys: [{ metric: { metricName: 'sessions' }, desc: true }],
        limit: 25,
      }),
    }
  )
  if (!res.ok) {
    const body = await res.text()
    throw new Error(`GA4 runReport failed (${res.status}): ${body.slice(0, 300)}`)
  }
  const json = (await res.json()) as RunReportResponse
  return (json.rows || []).map((r) => ({
    source: r.dimensionValues?.[0]?.value || '(not set)',
    sessions: Number(r.metricValues?.[0]?.value || 0),
  }))
}
