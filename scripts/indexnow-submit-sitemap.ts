/**
 * Submit every URL in the live sitemap to IndexNow (Bing + Yandex).
 *
 * WHY THIS EXISTS (Aug 4 2026): the sitemap grew from 2,033 to ~14,000 URLs
 * after three fixes — `is_active` was being used as a publish gate, PostgREST
 * was silently capping the query at 1,000 rows, and the resulting set included
 * ~2,018 URLs that 404'd. Nearly 12,000 real pages had never been advertised
 * to a search engine. Waiting for an organic recrawl of that many pages takes
 * weeks; IndexNow tells Bing and Yandex immediately.
 *
 * Google does NOT participate in IndexNow — it discovers via the sitemap, which
 * is already referenced in robots.txt and submitted in Search Console. So this
 * accelerates the Bing/Copilot channel specifically, which is Seoul Sister's
 * strongest citation surface (525 citations/7d as of July 2026).
 *
 * Run after any change that adds a meaningful number of public URLs. The key
 * lives in Vercel (not .env.local), so pull it into the environment first:
 *
 *   vercel env pull /tmp/venv --environment=production
 *   set -a && . /tmp/venv && set +a
 *   npx tsx scripts/indexnow-submit-sitemap.ts               # everything
 *   npx tsx scripts/indexnow-submit-sitemap.ts ingredients   # one type only
 *   npx tsx scripts/indexnow-submit-sitemap.ts --dry-run     # preview
 *
 * Also requires the public/<key>.txt ownership file, which must be served at
 * https://www.seoulsister.com/<key>.txt and contain exactly the key. The script
 * verifies this before submitting — IndexNow silently ignores a submission
 * whose key file does not match, so an unverified run would look like success.
 *
 * Idempotent and safe to re-run: IndexNow treats a repeat submission as a
 * refresh, not an error. Do not run it in a tight loop — submitting unchanged
 * URLs repeatedly is what gets a key rate-limited.
 */

const HOST = 'www.seoulsister.com'
const SITEMAP = `https://${HOST}/sitemap.xml`
const ENDPOINT = 'https://api.indexnow.org/indexnow'
const BATCH = 10_000 // IndexNow's documented per-request maximum

async function main() {
  const args = process.argv.slice(2)
  const dryRun = args.includes('--dry-run')
  const filter = args.find((a) => !a.startsWith('--'))

  const key = process.env.INDEXNOW_KEY
  if (!key) {
    console.error('INDEXNOW_KEY is not set. It lives in Vercel, not .env.local:')
    console.error('  vercel env pull /tmp/venv --environment=production')
    console.error('  set -a && . /tmp/venv && set +a')
    console.error('  npx tsx scripts/indexnow-submit-sitemap.ts')
    process.exit(1)
  }

  // Verify ownership BEFORE submitting. IndexNow silently ignores a submission
  // whose key file does not match, so a broken key would look like success.
  const keyUrl = `https://${HOST}/${key}.txt`
  const keyRes = await fetch(keyUrl)
  const keyBody = (await keyRes.text()).trim()
  if (!keyRes.ok || keyBody !== key) {
    console.error(`Ownership check FAILED. ${keyUrl} must return exactly the key.`)
    console.error(`  status=${keyRes.status} body=${keyBody.slice(0, 80)}`)
    process.exit(1)
  }
  console.log(`Ownership verified at ${keyUrl}`)

  console.log(`Fetching ${SITEMAP} ...`)
  const xml = await (await fetch(SITEMAP)).text()
  let urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim())
  urls = [...new Set(urls)].filter((u) => {
    try {
      return new URL(u).host === HOST
    } catch {
      return false
    }
  })

  if (filter) {
    urls = urls.filter((u) => u.includes(`/${filter}/`))
    console.log(`Filtered to "/${filter}/": ${urls.length} URLs`)
  }

  console.log(`${urls.length} URLs to submit`)
  if (dryRun) {
    console.log('DRY RUN — nothing submitted. Sample:')
    for (const u of urls.slice(0, 5)) console.log(`  ${u}`)
    return
  }

  let accepted = 0
  for (let i = 0; i < urls.length; i += BATCH) {
    const urlList = urls.slice(i, i + BATCH)
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify({ host: HOST, key, keyLocation: keyUrl, urlList }),
    })
    // 200 = accepted, 202 = accepted pending validation. Anything else is real.
    if (res.ok) {
      accepted += urlList.length
      console.log(`  batch ${i / BATCH + 1}: ${urlList.length} URLs -> HTTP ${res.status}`)
    } else {
      console.error(`  batch ${i / BATCH + 1}: REJECTED HTTP ${res.status} ${res.statusText}`)
      console.error(`  ${(await res.text()).slice(0, 300)}`)
    }
  }

  console.log(`\nAccepted ${accepted}/${urls.length}.`)
  console.log('Bing/Yandex recrawl on their own schedule — this shortens discovery, not indexing.')
  console.log('Grade it in Bing Webmaster Tools > Sitemaps ("URLs discovered") over the next 1-2 weeks.')
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
