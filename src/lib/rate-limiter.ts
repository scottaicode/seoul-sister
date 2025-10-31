/**
 * Rate Limiting Middleware
 * Simple in-memory rate limiter for API routes
 */

import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'

interface RateLimitStore {
  [key: string]: {
    count: number
    resetTime: number
  }
}

interface RateLimitConfig {
  windowMs: number // Time window in milliseconds
  maxRequests: number // Maximum requests per window
  message?: string // Custom error message
  skipSuccessfulRequests?: boolean // Don't count successful requests
  keyGenerator?: (req: NextRequest) => string // Custom key generator
}

class RateLimiter {
  private store: RateLimitStore = {}
  private cleanupInterval: NodeJS.Timeout | null = null

  constructor() {
    // Clean up expired entries every minute
    if (typeof window === 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 60000)
    }
  }

  private cleanup() {
    const now = Date.now()
    for (const key in this.store) {
      if (this.store[key].resetTime <= now) {
        delete this.store[key]
      }
    }
  }

  private getKey(req: NextRequest, keyGenerator?: (req: NextRequest) => string): string {
    if (keyGenerator) {
      return keyGenerator(req)
    }

    // Default key generator using IP and user agent
    const forwarded = req.headers.get('x-forwarded-for')
    const ip = forwarded ? forwarded.split(',')[0] : 'unknown'
    const userAgent = req.headers.get('user-agent') || 'unknown'

    // Create a hash of IP + user agent for the key
    return crypto
      .createHash('sha256')
      .update(`${ip}-${userAgent}`)
      .digest('hex')
      .substring(0, 16)
  }

  async limit(
    req: NextRequest,
    config: RateLimitConfig
  ): Promise<NextResponse | null> {
    const key = this.getKey(req, config.keyGenerator)
    const now = Date.now()
    const resetTime = now + config.windowMs

    // Get or create entry
    let entry = this.store[key]
    if (!entry || entry.resetTime <= now) {
      entry = {
        count: 0,
        resetTime: resetTime
      }
      this.store[key] = entry
    }

    // Increment counter
    entry.count++

    // Check if limit exceeded
    if (entry.count > config.maxRequests) {
      const retryAfter = Math.ceil((entry.resetTime - now) / 1000)

      return NextResponse.json(
        {
          error: config.message || 'Too many requests',
          retryAfter: retryAfter
        },
        {
          status: 429,
          headers: {
            'Retry-After': retryAfter.toString(),
            'X-RateLimit-Limit': config.maxRequests.toString(),
            'X-RateLimit-Remaining': '0',
            'X-RateLimit-Reset': entry.resetTime.toString()
          }
        }
      )
    }

    // Request allowed - return null to continue
    return null
  }

  reset(key: string) {
    delete this.store[key]
  }

  destroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.store = {}
  }
}

// Create singleton instance
const rateLimiter = new RateLimiter()

// Export middleware factory
export function createRateLimitMiddleware(config: RateLimitConfig) {
  return async (req: NextRequest) => {
    return rateLimiter.limit(req, config)
  }
}

// Preset configurations
export const rateLimitPresets = {
  // Strict limit for auth endpoints
  auth: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    message: 'Too many authentication attempts. Please try again later.'
  },

  // Standard API limit
  api: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 60,
    message: 'Rate limit exceeded. Please slow down your requests.'
  },

  // Expensive operations (AI, scraping)
  expensive: {
    windowMs: 5 * 60 * 1000, // 5 minutes
    maxRequests: 10,
    message: 'Too many expensive operations. Please wait before trying again.'
  },

  // Public endpoints
  public: {
    windowMs: 1 * 60 * 1000, // 1 minute
    maxRequests: 100,
    message: 'Too many requests from this IP.'
  }
}

// Helper function to apply rate limiting to API route
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>,
  config: RateLimitConfig = rateLimitPresets.api
) {
  return async (req: NextRequest) => {
    const limitResponse = await rateLimiter.limit(req, config)
    if (limitResponse) {
      return limitResponse
    }
    return handler(req)
  }
}

export default rateLimiter