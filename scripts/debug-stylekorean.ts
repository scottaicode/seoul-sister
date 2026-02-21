import { chromium } from 'playwright'

async function main() {
  console.log('Launching browser...')
  const browser = await chromium.launch({ headless: true })
  const page = await browser.newPage()

  console.log('Navigating to StyleKorean search...')
  await page.goto('https://www.stylekorean.com/shop/search_result.php?keyword=COSRX', {
    waitUntil: 'networkidle',
    timeout: 40000,
  })

  console.log('Waiting for AJAX content...')
  await page.waitForTimeout(3000)

  const info = await page.evaluate(() => {
    const el = document.querySelector('.search_result')
    const innerHTML = el ? el.innerHTML.substring(0, 2000) : 'NOT_FOUND'
    const childCount = el ? el.children.length : 0

    // All product links on the page (not in nav)
    const shopLinks = Array.from(document.querySelectorAll('a'))
      .filter(a => {
        const href = a.href
        return href.includes('/shop/') && !href.includes('search') && a.textContent && a.textContent.trim().length > 5
      })
      .map(a => ({ href: a.href, text: (a.textContent || '').trim().slice(0, 80) }))
      .slice(0, 15)

    // Find price text on page
    const bodyText = document.body.textContent || ''
    const prices = bodyText.match(/\$\d+\.?\d*/g)?.slice(0, 10) || []
    const noProduct = bodyText.includes('No product has been searched')
    const cosrxMentions = (bodyText.match(/COSRX/gi) || []).length

    return { childCount, shopLinks, prices, noProduct, cosrxMentions, innerHTML }
  })

  console.log('\n=== Search Result Container ===')
  console.log('Children:', info.childCount)
  console.log('No product message:', info.noProduct)
  console.log('COSRX mentions:', info.cosrxMentions)
  console.log('Prices:', info.prices)
  console.log('\nProduct-like links:')
  info.shopLinks.forEach(l => console.log(`  ${l.text} -> ${l.href}`))
  console.log('\nInnerHTML preview:')
  console.log(info.innerHTML.substring(0, 500))

  await browser.close()
  console.log('\nDone.')
}

main().catch(e => {
  console.error('Error:', e.message)
  process.exit(1)
})
