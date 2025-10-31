/**
 * AI Response Cache
 * Caches AI responses to reduce API costs and improve performance
 */

import crypto from 'crypto'

interface CacheEntry<T = unknown> {
  data: T
  timestamp: number
  ttl: number
  hits: number
}

interface CacheOptions {
  ttl?: number // Time to live in milliseconds
  maxSize?: number // Maximum cache size
  maxAge?: number // Maximum age regardless of TTL
}

class AICache {
  private cache: Map<string, CacheEntry> = new Map()
  private readonly defaultTTL = 1000 * 60 * 60 // 1 hour default
  private readonly maxSize = 1000 // Maximum number of entries
  private readonly maxAge = 1000 * 60 * 60 * 24 // 24 hours maximum age
  private cleanupInterval: NodeJS.Timeout | null = null
  private stats = {
    hits: 0,
    misses: 0,
    evictions: 0,
    totalSaved: 0
  }

  constructor() {
    // Cleanup expired entries every 5 minutes
    if (typeof window === 'undefined') {
      this.cleanupInterval = setInterval(() => this.cleanup(), 5 * 60 * 1000)
    }
  }

  /**
   * Generate cache key from request parameters
   */
  private generateKey(params: Record<string, unknown>): string {
    const normalized = JSON.stringify(params, Object.keys(params).sort())
    return crypto.createHash('sha256').update(normalized).digest('hex')
  }

  /**
   * Clean up expired entries
   */
  private cleanup(): void {
    const now = Date.now()
    let evicted = 0

    for (const [key, entry] of this.cache.entries()) {
      const age = now - entry.timestamp
      if (age > entry.ttl || age > this.maxAge) {
        this.cache.delete(key)
        evicted++
      }
    }

    if (evicted > 0) {
      this.stats.evictions += evicted
      console.log(`🧹 Cache cleanup: evicted ${evicted} expired entries`)
    }
  }

  /**
   * Enforce size limit using LRU eviction
   */
  private enforceLimit(): void {
    if (this.cache.size <= this.maxSize) return

    // Sort by hits (ascending) and timestamp (ascending) to find LRU
    const entries = Array.from(this.cache.entries())
      .sort(([, a], [, b]) => {
        if (a.hits === b.hits) return a.timestamp - b.timestamp
        return a.hits - b.hits
      })

    // Evict least recently used entries
    const toEvict = this.cache.size - this.maxSize + 1
    for (let i = 0; i < toEvict; i++) {
      this.cache.delete(entries[i][0])
      this.stats.evictions++
    }
  }

  /**
   * Get cached response
   */
  get<T = unknown>(
    params: Record<string, unknown>
  ): T | null {
    const key = this.generateKey(params)
    const entry = this.cache.get(key)

    if (!entry) {
      this.stats.misses++
      return null
    }

    const now = Date.now()
    const age = now - entry.timestamp

    // Check if expired
    if (age > entry.ttl || age > this.maxAge) {
      this.cache.delete(key)
      this.stats.misses++
      return null
    }

    // Update hits and return data
    entry.hits++
    this.stats.hits++
    return entry.data as T
  }

  /**
   * Set cached response
   */
  set<T = unknown>(
    params: Record<string, unknown>,
    data: T,
    options: CacheOptions = {}
  ): void {
    const key = this.generateKey(params)
    const ttl = options.ttl || this.defaultTTL

    this.cache.set(key, {
      data,
      timestamp: Date.now(),
      ttl,
      hits: 0
    })

    this.enforceLimit()
  }

  /**
   * Cache wrapper for async functions
   */
  async wrap<T>(
    fn: () => Promise<T>,
    params: Record<string, unknown>,
    options: CacheOptions = {}
  ): Promise<T> {
    // Check cache first
    const cached = this.get<T>(params)
    if (cached !== null) {
      console.log('✅ AI Cache hit - saved API call')
      this.stats.totalSaved++
      return cached
    }

    // Execute function and cache result
    console.log('🔄 AI Cache miss - calling API')
    const result = await fn()
    this.set(params, result, options)
    return result
  }

  /**
   * Clear entire cache
   */
  clear(): void {
    this.cache.clear()
    console.log('🗑️ AI Cache cleared')
  }

  /**
   * Get cache statistics
   */
  getStats() {
    const hitRate = this.stats.hits + this.stats.misses > 0
      ? (this.stats.hits / (this.stats.hits + this.stats.misses) * 100).toFixed(2)
      : 0

    return {
      ...this.stats,
      size: this.cache.size,
      hitRate: `${hitRate}%`,
      estimatedSavings: `$${(this.stats.totalSaved * 0.01).toFixed(2)}` // Rough estimate
    }
  }

  /**
   * Destroy cache and cleanup
   */
  destroy(): void {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval)
      this.cleanupInterval = null
    }
    this.cache.clear()
  }
}

// Create singleton instance
const aiCache = new AICache()

// Cache configurations for different AI operations
export const cacheConfigs = {
  // Product recommendations - cache for 1 hour
  recommendations: {
    ttl: 1000 * 60 * 60 // 1 hour
  },

  // Skin analysis - cache for 24 hours
  skinAnalysis: {
    ttl: 1000 * 60 * 60 * 24 // 24 hours
  },

  // Ingredient analysis - cache for 7 days
  ingredientAnalysis: {
    ttl: 1000 * 60 * 60 * 24 * 7 // 7 days
  },

  // Price predictions - cache for 30 minutes
  pricePredictions: {
    ttl: 1000 * 60 * 30 // 30 minutes
  },

  // General AI queries - cache for 2 hours
  general: {
    ttl: 1000 * 60 * 60 * 2 // 2 hours
  }
}

// Helper function to create cache key for AI requests
export function createAICacheKey(
  operation: string,
  ...params: unknown[]
): Record<string, unknown> {
  return {
    operation,
    params: params.map(p =>
      typeof p === 'object' ? JSON.stringify(p) : p
    )
  }
}

export default aiCache
export { AICache }