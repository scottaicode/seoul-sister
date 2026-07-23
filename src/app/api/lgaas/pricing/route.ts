import { NextRequest, NextResponse } from 'next/server'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { secureCompare } from '@/lib/utils/secure-compare'
import { PRICING, USAGE_CAPS } from '@/lib/pricing'

/**
 * GET /api/lgaas/pricing
 *
 * Canonical price endpoint. Seoul Sister's `src/lib/pricing.ts` is the single
 * source of truth for the displayed price; this route exposes it so LGAAS can
 * PULL it and keep its business-profile mirror from drifting.
 *
 * Background: the LGAAS profile hand-mirrored the price ($24.99), and a stale
 * $39.99 survived a June 22 2026 repricing in several profile JSONB keys. That
 * stale value was re-inherited by a system_prompt rotation and served to real
 * users (see lgaas/lgaas-blueprint/129-*.md §129.1). The durable fix is for
 * LGAAS to derive the current price from THIS endpoint instead of a hand-kept
 * copy, so `pricing.ts` becomes the true cross-app single source.
 *
 * Auth: X-LGAAS-API-Key header, same shared secret env var as the other
 * LGAAS-facing endpoints (LGAAS_INGEST_API_KEY). Uses secureCompare for a
 * constant-time check.
 *
 * Contract (STABLE — LGAAS validates this shape and fail-safes on mismatch):
 * - Numbers are numbers (24.99), not strings, so the consumer does its own math.
 * - Display strings are provided alongside so LGAAS can render either.
 * - `annual_usd` is DERIVED (monthly * 12), not a separate source value — Seoul
 *   Sister bills monthly only; annual is a convenience for LGAAS's avg_deal_size
 *   mirror. If an annual plan is ever added to pricing.ts, compute it here.
 * - `source: 'pricing.ts'` marks provenance so a stale mirror is diagnosable.
 *
 * This route reads the PRICING/USAGE_CAPS constants directly — it never hardcodes
 * a dollar amount. If it did, we would have just relocated the drift it exists to
 * prevent.
 */

// Round to cents to avoid floating-point artifacts (24.99 * 12 = 299.88, but
// FP math can yield 299.88000000000005).
function toCents(n: number): number {
  return Math.round(n * 100) / 100
}

export async function GET(request: NextRequest) {
  try {
    const apiKey = request.headers.get('X-LGAAS-API-Key')
    const expectedKey = process.env.LGAAS_INGEST_API_KEY

    if (!apiKey || !expectedKey || !secureCompare(apiKey, expectedKey)) {
      throw new AppError('Unauthorized: invalid or missing API key', 401)
    }

    const monthly = PRICING.monthly_usd
    const annual = toCents(monthly * 12)

    return NextResponse.json({
      success: true,
      source: 'pricing.ts',
      currency: 'USD',
      plan_name: PRICING.plan_name,
      // Numbers for math
      monthly_usd: monthly,
      annual_usd: annual,
      usage_soft_cap_per_month: USAGE_CAPS.yuri_messages_per_month,
      // Display strings for rendering
      monthly_display: PRICING.monthly_display, // "$24.99/mo"
      monthly_display_long: PRICING.monthly_display_long, // "$24.99/month"
      annual_display: `$${annual.toFixed(2)}/yr`, // "$299.88/yr"
    })
  } catch (error) {
    return handleApiError(error)
  }
}
