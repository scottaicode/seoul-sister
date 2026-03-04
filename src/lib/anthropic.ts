import Anthropic from '@anthropic-ai/sdk'

let client: Anthropic | null = null

export function getAnthropicClient(): Anthropic {
  if (!client) {
    const apiKey = process.env.ANTHROPIC_API_KEY
    if (!apiKey) {
      throw new Error('Missing ANTHROPIC_API_KEY environment variable')
    }
    client = new Anthropic({ apiKey })
  }
  return client
}

export const MODELS = {
  primary: 'claude-opus-4-6' as const,
  background: 'claude-sonnet-4-5-20250929' as const,
} as const

// ---------------------------------------------------------------------------
// Retry wrapper for transient Anthropic API failures
// ---------------------------------------------------------------------------

const RETRYABLE_STATUS_CODES = new Set([429, 529, 503, 502])
const RETRYABLE_ERROR_PATTERNS = [
  'Connection error',
  'overloaded',
  'ECONNRESET',
  'socket hang up',
  'ETIMEDOUT',
]

function isRetryableError(error: unknown): boolean {
  if (error && typeof error === 'object') {
    const err = error as { status?: number; message?: string }
    if (err.status && RETRYABLE_STATUS_CODES.has(err.status)) return true
    if (err.message && RETRYABLE_ERROR_PATTERNS.some((p) => err.message!.includes(p))) return true
  }
  return false
}

/**
 * Call an Anthropic API function with retry logic.
 * Retries on transient failures (529 overloaded, 502/503 gateway errors,
 * connection resets) with exponential backoff (2s, 4s, 8s).
 * Does NOT retry client errors (400, 401, 403, 404).
 */
export async function callAnthropicWithRetry<T>(
  fn: () => Promise<T>,
  maxRetries = 3
): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn()
    } catch (error: unknown) {
      if (isRetryableError(error) && attempt < maxRetries) {
        const delay = Math.pow(2, attempt) * 1000 // 2s, 4s, 8s
        console.warn(
          `[anthropic] Attempt ${attempt}/${maxRetries} failed (${(error as Error).message || (error as { status?: number }).status}), retrying in ${delay}ms...`
        )
        await new Promise((resolve) => setTimeout(resolve, delay))
        continue
      }
      throw error
    }
  }
  // Unreachable — final attempt either returns or throws
  throw new Error('[anthropic] Retry loop exhausted without result')
}

/** Exposed for streaming retry loops in advisor.ts and widget */
export { isRetryableError }
