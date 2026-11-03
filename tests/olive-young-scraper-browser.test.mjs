/**
 * Guard tests — the Olive Young new-product scraper must reach every category,
 * and must say so when Olive Young blocks it.
 *
 * Earned Nov 3 2026. From at least June, every nightly run scraped only the first
 * of 11 categories: under `--single-process`, `browser.newPage()` makes a fresh
 * context per call and fails with "Target page, context or browser has been
 * closed" once the first page has closed. Runs still wrote `completed`.
 *
 * Executes the real OliveYoungScraper against a fake browser that fails the same
 * way real single-process Chromium does (reproduced locally before writing this).
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const dir = mkdtempSync(join(tmpdir(), 'ss-oy-scraper-'))
writeFileSync(join(dir, 'browser.mjs'), 'export async function launchBrowser() { throw new Error("tests inject a fake browser") }\n')
const src = readFileSync(join(__dirname, '..', 'src', 'lib', 'pipeline', 'sources', 'olive-young.ts'), 'utf8')
  .replace("from '../browser'", "from './browser.mjs'")
writeFileSync(join(dir, 'olive-young.mjs'), ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText)
const { OliveYoungScraper } = await import(pathToFileURL(join(dir, 'olive-young.mjs')).href)

const ALL_CATEGORIES = OliveYoungScraper.getCategories()

/** A browser that behaves like single-process Chromium: one context only. */
function fakeBrowser({ title = 'Olive Young', rendersProducts = true } = {}) {
  const visited = []
  let contexts = 0
  const makePage = () => ({
    async setExtraHTTPHeaders() {},
    async goto(url) { visited.push(url) },
    async waitForSelector() { if (!rendersProducts) throw new Error('timeout') },
    async waitForTimeout() {},
    async title() { return title },
    async $() { return null },
    async evaluate() { return [] },
    async close() {},
  })
  const newContext = async () => {
    contexts++
    if (contexts > 1) throw new Error('browser.newContext: Target page, context or browser has been closed')
    return { newPage: async () => makePage() }
  }
  return {
    visited,
    newContext,
    // browser.newPage() = a new context + page, so the second call fails.
    async newPage() { await newContext(); return makePage() },
    async close() {},
  }
}

const db = { from: () => ({ update: () => ({ eq: async () => ({ error: null }) }) }) }

function scraperWith(browser) {
  const s = new OliveYoungScraper({ delayMs: 0 })
  s.browser = browser
  return s
}

test('every category is visited, with no browser-closed errors', async () => {
  const browser = fakeBrowser()
  const s = scraperWith(browser)
  const stats = await s.runScrape(db, 'run', { mode: 'incremental', maxPagesPerCategory: 1, skipDetails: true })
  assert.equal(ALL_CATEGORIES.length, 11)
  assert.equal(browser.visited.length, ALL_CATEGORIES.length)
  assert.deepEqual(stats.errors, [])
})

test('the bot-protection page is recorded as blocked, not as an empty category', async () => {
  const s = scraperWith(fakeBrowser({ title: 'Access restricted | OLIVE YOUNG', rendersProducts: false }))
  await s.runScrape(db, 'run', { mode: 'incremental', maxPagesPerCategory: 1, skipDetails: true, categories: ['1000000008', '1000000009'] })
  assert.deepEqual(s.blockedCategories, ['1000000008', '1000000009'])
})

test('a slow-rendering real page is NOT recorded as blocked', async () => {
  const s = scraperWith(fakeBrowser({ title: 'Skincare | OLIVE YOUNG Global', rendersProducts: false }))
  await s.runScrape(db, 'run', { mode: 'incremental', maxPagesPerCategory: 1, skipDetails: true, categories: ['1000000008'] })
  assert.deepEqual(s.blockedCategories, [])
})

test('the start offset rotates the category order', async () => {
  const browser = fakeBrowser()
  const s = scraperWith(browser)
  await s.runScrape(db, 'run', { mode: 'incremental', maxPagesPerCategory: 1, skipDetails: true, categories: ['1000000008', '1000000009', '1000000010'], startOffset: 4 })
  assert.deepEqual(browser.visited.map((u) => u.split('ctgrNo=')[1]), ['1000000009', '1000000010', '1000000008'])
})

test('a passed deadline starts no category and counts what was skipped', async () => {
  const browser = fakeBrowser()
  const s = scraperWith(browser)
  await s.runScrape(db, 'run', { mode: 'incremental', maxPagesPerCategory: 1, skipDetails: true, categories: ['1000000008', '1000000009'], deadlineAt: Date.now() - 1 })
  assert.equal(browser.visited.length, 0)
  assert.equal(s.categoriesSkippedForTime, 2)
})
