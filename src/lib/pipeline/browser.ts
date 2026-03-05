/**
 * Shared browser utility for Vercel serverless + local development.
 *
 * On Vercel (detected via VERCEL=1 env var):
 *   Uses playwright-core + @sparticuz/chromium — a lightweight Chromium
 *   binary (~64MB compressed) built for AWS Lambda / Vercel serverless.
 *   The binary is decompressed to /tmp on first invocation (~10-15s cold start).
 *
 * Locally:
 *   Falls back to playwright-core connecting to the system Chromium binary.
 */
import type { Browser, Page } from 'playwright-core'

const IS_VERCEL = !!process.env.VERCEL

/** Timeout for browser launch (covers binary decompression + process startup) */
const LAUNCH_TIMEOUT_MS = 60_000

/**
 * Launch a headless Chromium browser suitable for the current environment.
 * Includes a timeout guard to prevent indefinite hangs on cold starts.
 *
 * @param extraArgs - Additional Chromium CLI args (e.g. --disable-blink-features)
 */
export async function launchBrowser(extraArgs: string[] = []): Promise<Browser> {
  const startMs = Date.now()

  const baseArgs = [
    '--no-sandbox',
    '--disable-setuid-sandbox',
    '--disable-dev-shm-usage',
    '--disable-gpu',
    '--single-process',
    ...extraArgs,
  ]

  // Wrap the actual launch in a timeout to prevent indefinite hangs
  const launchPromise = IS_VERCEL
    ? launchVercel(baseArgs)
    : launchLocal(baseArgs)

  const timeoutPromise = new Promise<never>((_, reject) => {
    setTimeout(() => {
      reject(new Error(
        `Browser launch timed out after ${LAUNCH_TIMEOUT_MS / 1000}s ` +
        `(IS_VERCEL=${IS_VERCEL}, elapsed=${Date.now() - startMs}ms)`
      ))
    }, LAUNCH_TIMEOUT_MS)
  })

  const browser = await Promise.race([launchPromise, timeoutPromise])
  const elapsed = Date.now() - startMs
  console.warn(`[browser] Launched in ${elapsed}ms (IS_VERCEL=${IS_VERCEL})`)
  return browser
}

async function launchVercel(baseArgs: string[]): Promise<Browser> {
  console.warn('[browser] Loading @sparticuz/chromium...')
  const chromium = await import('@sparticuz/chromium')
  console.warn('[browser] Loading playwright-core...')
  const { chromium: playwrightChromium } = await import('playwright-core')

  console.warn('[browser] Resolving executablePath (decompressing binary)...')
  const executablePath = await chromium.default.executablePath()
  console.warn(`[browser] executablePath resolved: ${executablePath}`)

  console.warn('[browser] Launching Chromium...')
  return playwrightChromium.launch({
    executablePath,
    headless: true,
    args: [...chromium.default.args, ...baseArgs],
  })
}

async function launchLocal(baseArgs: string[]): Promise<Browser> {
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
