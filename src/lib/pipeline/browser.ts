/**
 * Shared browser utility for Vercel serverless + local development.
 *
 * On Vercel (detected via VERCEL=1 env var):
 *   Uses playwright-core + @sparticuz/chromium — a lightweight Chromium
 *   binary (~40MB) built for AWS Lambda / Vercel serverless, staying under
 *   the 50MB function size limit.
 *
 * Locally:
 *   Falls back to playwright-core connecting to the system Chromium binary,
 *   or to the full playwright package if installed.
 */
import type { Browser, Page } from 'playwright-core'

const IS_VERCEL = !!process.env.VERCEL

/**
 * Launch a headless Chromium browser suitable for the current environment.
 *
 * @param extraArgs - Additional Chromium CLI args (e.g. --disable-blink-features)
 */
export async function launchBrowser(extraArgs: string[] = []): Promise<Browser> {
  const baseArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process',
    ...extraArgs,
  ]

  if (IS_VERCEL) {
    // Serverless: use @sparticuz/chromium for the binary + playwright-core for the API
    const chromium = await import('@sparticuz/chromium')
    const { chromium: playwrightChromium } = await import('playwright-core')

    const executablePath = await chromium.default.executablePath()

    return playwrightChromium.launch({
      executablePath,
      headless: true,
      args: [...chromium.default.args, ...baseArgs],
    })
  }

  // Local development: use playwright-core with system Chromium
  // Try playwright (full) first for local dev, fall back to playwright-core
  try {
    const { chromium } = await import('playwright-core')
    return chromium.launch({
      headless: true,
      args: baseArgs,
    })
  } catch {
    throw new Error(
      'No browser found. Install Playwright browsers locally: npx playwright install chromium'
    )
  }
}

/**
 * Create a new page with standard settings.
 */
export async function newPage(browser: Browser): Promise<Page> {
  const page = await browser.newPage()
  await page.setExtraHTTPHeaders({
    'Accept-Language': 'en-US,en;q=0.9',
  })
  return page
}

// Re-export types for convenience
export type { Browser, Page } from 'playwright-core'
