import { load, type CheerioAPI } from 'cheerio'

const USER_AGENTS = [
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.3 Safari/605.1.15',
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:123.0) Gecko/20100101 Firefox/123.0',
]

interface FetchOptions {
  headers?: Record<string, string>
  retries?: number
  timeout?: number
}

interface QueueItem {
  url: string
  options: FetchOptions
  resolve: (value: string) => void
  reject: (reason: Error) => void
}

/**
 * Base scraper class with rate limiting, retry logic, user-agent rotation,
 * request queueing, and error logging.
 */
export class ScraperBase {
  private queue: QueueItem[] = []
  private activeRequests = 0
  private readonly maxConcurrency: number
  private readonly delayMs: number
  private readonly maxRetries: number
  private lastRequestTime = 0
  private userAgentIndex = 0
  private requestCount = 0
  private errorCount = 0

  constructor(options?: {
    maxConcurrency?: number
    delayMs?: number
    maxRetries?: number
  }) {
    this.maxConcurrency = options?.maxConcurrency ?? 3
    this.delayMs = options?.delayMs ?? 2000
    this.maxRetries = options?.maxRetries ?? 3
  }

  /** Fetch a URL with rate limiting, retries, and user-agent rotation */
  async fetchPage(url: string, options: FetchOptions = {}): Promise<string> {
    return new Promise<string>((resolve, reject) => {
      this.queue.push({ url, options, resolve, reject })
      this.processQueue()
    })
  }

  /** Parse HTML string into a cheerio instance */
  parseHTML(html: string): CheerioAPI {
    return load(html)
  }

  /** Fetch and parse a URL, returning a cheerio instance */
  async fetchAndParse(url: string, options: FetchOptions = {}): Promise<CheerioAPI> {
    const html = await this.fetchPage(url, options)
    return this.parseHTML(html)
  }

  /** Fetch JSON from a URL with rate limiting */
  async fetchJSON<T = unknown>(url: string, options: FetchOptions = {}): Promise<T> {
    const body = await this.fetchPage(url, {
      ...options,
      headers: {
        'Accept': 'application/json',
        ...options.headers,
      },
    })
    return JSON.parse(body) as T
  }

  get stats() {
    return {
      totalRequests: this.requestCount,
      errors: this.errorCount,
      queueLength: this.queue.length,
      activeRequests: this.activeRequests,
    }
  }

  private async processQueue(): Promise<void> {
    if (this.activeRequests >= this.maxConcurrency || this.queue.length === 0) {
      return
    }

    const item = this.queue.shift()
    if (!item) return

    this.activeRequests++

    try {
      const result = await this.executeWithRetry(item.url, item.options)
      item.resolve(result)
    } catch (error) {
      item.reject(error instanceof Error ? error : new Error(String(error)))
    } finally {
      this.activeRequests--
      this.processQueue()
    }
  }

  private async executeWithRetry(url: string, options: FetchOptions): Promise<string> {
    const retries = options.retries ?? this.maxRetries

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        await this.enforceRateLimit()
        this.requestCount++

        const controller = new AbortController()
        const timeoutId = setTimeout(
          () => controller.abort(),
          options.timeout ?? 30000
        )

        const response = await fetch(url, {
          headers: {
            'User-Agent': this.getNextUserAgent(),
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9,ko;q=0.8',
            'Accept-Encoding': 'gzip, deflate, br',
            'Cache-Control': 'no-cache',
            ...options.headers,
          },
          signal: controller.signal,
        })

        clearTimeout(timeoutId)

        if (response.status === 429 || response.status === 503) {
          const retryAfter = parseInt(response.headers.get('Retry-After') ?? '10', 10)
          const backoffMs = Math.min(retryAfter * 1000, 60000)
          console.warn(
            `[scraper] Rate limited (${response.status}) on ${url}, ` +
            `retrying in ${backoffMs}ms (attempt ${attempt + 1}/${retries + 1})`
          )
          await this.sleep(backoffMs)
          continue
        }

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText} for ${url}`)
        }

        return await response.text()
      } catch (error) {
        this.errorCount++
        const isLastAttempt = attempt === retries

        if (isLastAttempt) {
          console.error(
            `[scraper] Failed after ${retries + 1} attempts: ${url}`,
            error instanceof Error ? error.message : error
          )
          throw error
        }

        const backoffMs = Math.pow(2, attempt) * 1000 + Math.random() * 1000
        console.warn(
          `[scraper] Attempt ${attempt + 1} failed for ${url}, ` +
          `retrying in ${Math.round(backoffMs)}ms: ${error instanceof Error ? error.message : error}`
        )
        await this.sleep(backoffMs)
      }
    }

    throw new Error(`Exhausted retries for ${url}`)
  }

  private async enforceRateLimit(): Promise<void> {
    const now = Date.now()
    const elapsed = now - this.lastRequestTime
    if (elapsed < this.delayMs) {
      await this.sleep(this.delayMs - elapsed)
    }
    this.lastRequestTime = Date.now()
  }

  private getNextUserAgent(): string {
    const ua = USER_AGENTS[this.userAgentIndex % USER_AGENTS.length]
    this.userAgentIndex++
    return ua
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms))
  }
}
