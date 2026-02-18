import { getServiceClient } from '@/lib/supabase'

interface RateLimitResult {
  allowed: boolean
  remaining: number
  resetIn: number
}

/**
 * In-memory fallback — only works within a single Vercel invocation.
 * Used when the ss_rate_limits table hasn't been created yet.
 */
const rateLimitMap = new Map<string, { count: number; resetTime: number }>()

function checkRateLimitInMemory(
  key: string,
  maxRequests: number,
  windowMs: number
): RateLimitResult {
  const now = Date.now()
  const entry = rateLimitMap.get(key)

  if (!entry || now > entry.resetTime) {
    rateLimitMap.set(key, { count: 1, resetTime: now + windowMs })
    return { allowed: true, remaining: maxRequests - 1, resetIn: windowMs }
  }

  if (entry.count >= maxRequests) {
    return { allowed: false, remaining: 0, resetIn: entry.resetTime - now }
  }

  entry.count++
  return {
    allowed: true,
    remaining: maxRequests - entry.count,
    resetIn: entry.resetTime - now,
  }
}

/**
 * Check rate limit using Supabase (persists across Vercel cold starts).
 * Falls back to in-memory if the database function isn't available yet.
 */
export async function checkRateLimit(
  key: string,
  maxRequests: number,
  windowMs: number
): Promise<RateLimitResult> {
  try {
    const supabase = getServiceClient()
    const { data, error } = await supabase.rpc('ss_check_rate_limit', {
      p_key: key,
      p_max_requests: maxRequests,
      p_window_ms: windowMs,
    })

    if (error) throw error

    const row = Array.isArray(data) ? data[0] : data
    if (!row) throw new Error('No result from rate limit check')

    return {
      allowed: row.allowed,
      remaining: row.remaining,
      resetIn: row.reset_in_ms,
    }
  } catch {
    // Table/function doesn't exist yet — fall back to in-memory
    return checkRateLimitInMemory(key, maxRequests, windowMs)
  }
}
