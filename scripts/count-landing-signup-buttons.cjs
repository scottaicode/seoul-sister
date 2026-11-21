/**
 * Counts the sign-up buttons a visitor can actually see on the landing page,
 * in a real browser, at a phone width and a desktop width.
 *
 * Nov 20 2026: below desktop width the page should render exactly ONE, the bar
 * pinned to the bottom, on screen at the top of the page, in the middle and at
 * the footer. On desktop exactly TWO: the nav button, on screen at all three
 * places, and the one in the final section. The node tests pin the source; this is the
 * check that it renders that way.
 *
 *   node scripts/count-landing-signup-buttons.cjs                      # production
 *   node scripts/count-landing-signup-buttons.cjs http://localhost:3000
 *
 * Needs Google Chrome installed (uses playwright-core with the Chrome channel).
 * Exits 1 if a phone or tablet width shows anything but one, or desktop anything
 * but two. Checked as a signed-out visitor with the menu closed: the menu a
 * visitor opens has its own sign-up link at the narrowest widths, and a signed-in
 * member is shown no bar at all. Neither is exercised here.
 */
const { chromium } = require('playwright-core')
const base = (process.argv[2] || 'https://www.seoulsister.com').replace(/\/$/, '')

// Any link to sign-up or membership, and any button that says it creates an
// account or starts the free week, whatever its exact words.
const seen = () => [...document.querySelectorAll('a[href^="/register"], a[href^="/subscribe"], button, a')]
  .filter((e) => /^\/(register|subscribe)/.test(e.getAttribute('href') || '') || /create (my|your|a) (free )?account|start (my|your) free week|sign up/i.test(e.textContent || ''))
  .filter((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.display !== 'none' && s.visibility !== 'hidden' })
  .map((e) => { const r = e.getBoundingClientRect(); return { bar: e.hasAttribute('data-sticky-signup'), nav: !!e.closest('nav'), onScreen: r.top < innerHeight && r.bottom > 0, href: e.getAttribute('href') } })

;(async () => {
  const browser = await chromium.launch({ channel: 'chrome', headless: true })
  let bad = 0
  for (const [name, width, height] of [['phone', 390, 760], ['small tablet', 700, 900], ['tablet', 900, 1100], ['desktop', 1280, 800]]) {
    const page = await (await browser.newContext({ viewport: { width, height } })).newPage()
    await page.goto(base + '/', { waitUntil: 'networkidle' })
    await page.waitForTimeout(1200)
    const rows = []
    for (const where of ['top', 'middle', 'bottom']) {
      await page.evaluate((w) => window.scrollTo(0, w === 'top' ? 0 : w === 'middle' ? document.body.scrollHeight / 2 : document.body.scrollHeight), where)
      await page.waitForTimeout(500)
      const list = await page.evaluate(seen)
      rows.push({ where, rendered: list.length, onScreen: list.filter((x) => x.onScreen).length, barOnScreen: list.some((x) => x.bar && x.onScreen), navOnScreen: list.some((x) => x.nav && x.onScreen) })
    }
    const wide = width >= 1024
    // Desktop has two: the nav button, always on screen, and the final section's.
    const navAlways = rows.every((r) => r.navOnScreen)
    const ok = wide ? rows.every((r) => r.rendered === 2) && navAlways : rows.every((r) => r.rendered === 1 && r.onScreen === 1 && r.barOnScreen)
    if (!ok) bad++
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} (${width}px): ` + rows.map((r) => `${r.where} rendered=${r.rendered} onScreen=${r.onScreen}`).join(' | '))
    await page.close()
  }
  // What an account starts and costs. Yuri's card on the landing page no longer
  // carries the sentence at any width; on the sign-up form it must be readable at
  // every width, because that is where a visitor is told before creating an account.
  const costShown = () => [...document.querySelectorAll('p')].filter((e) => /free week: \d+ days, no card/.test(e.textContent || ''))
    .some((e) => { const r = e.getBoundingClientRect(); const s = getComputedStyle(e); return r.width > 0 && r.height > 0 && s.visibility !== 'hidden' && Number(s.opacity) > 0.2 && r.left >= 0 && r.right <= innerWidth + 1 })
  for (const [name, width] of [['phone', 390], ['tablet', 900], ['desktop', 1280]]) {
    const page = await (await browser.newContext({ viewport: { width, height: 800 } })).newPage()
    await page.goto(base + '/', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3500)
    const onLanding = await page.evaluate(costShown)
    await page.goto(base + '/register?plan=monthly', { waitUntil: 'domcontentloaded' })
    await page.waitForTimeout(3500)
    const onSignup = await page.evaluate(costShown)
    const ok = onSignup && onLanding === false
    if (!ok) bad++
    console.log(`${ok ? 'OK  ' : 'FAIL'} ${name} (${width}px): cost sentence on sign-up form=${onSignup} | in Yuri's card=${onLanding}`)
    await page.close()
  }
  await browser.close()
  process.exit(bad ? 1 : 0)
})().catch((e) => { console.error(e.message); process.exit(1) })
