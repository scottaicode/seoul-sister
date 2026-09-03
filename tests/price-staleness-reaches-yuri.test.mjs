/**
 * Guard tests — the price-freshness instrument must actually REACH Yuri, the
 * sweep must be able to reach the tail, and a remembered name must not license
 * an invented number.
 *
 * THE INCIDENT (Sep 3 2026, a real cold visitor from a ChatGPT citation).
 * A Black woman in France, papillomas plus post-acne hyperpigmentation. Yuri's
 * clinical judgment was excellent — she refused to treat the papillomas
 * cosmetically, talked the visitor OUT of glycolic acid with the correct
 * mechanism for deeply pigmented skin, and abstained honestly when the catalog
 * had no liquid tranexamic lotion. Three of her four price quotes were still
 * wrong, and each traces to a different structural gap:
 *
 * 1. A 149-day-old Celimax price quoted caveat-free. The payload DID carry
 *    `price_age_days: 149`, but a bare integer with no threshold and no
 *    instruction is not actionable. src/lib/yuri/price-freshness.ts was written
 *    for exactly this on Aug 15 and had ZERO CONSUMERS — it fired, built a
 *    careful block, and nothing called it.
 * 2. $19.90 quoted for a product whose only row says $32.30 (checked 1 day
 *    earlier), in a turn with ZERO tool calls, alongside a fabricated 4.7
 *    rating (DB: 4.80). The prompt licensed it: the rule said a number must
 *    have come back "IN THIS CONVERSATION", and it had — three turns earlier.
 * 3. 770 Olive Young rows stranded 90+ days stale behind a keyset cursor that
 *    keyed on `last_checked`, the column the sweep itself mutates.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const route = readFileSync(join(root, 'src/app/api/widget/chat/route.ts'), 'utf8')
const refresher = readFileSync(join(root, 'src/lib/pipeline/olive-young-price-refresh.ts'), 'utf8')

function load(rel) {
  const src = readFileSync(join(root, rel), 'utf8')
  const stripped = src.replace(/^import\s+(?:type\s+)?\{[^}]*\}\s+from\s+'(?!node:)[^']*'\s*$/gm, '')
  const js = ts.transpileModule(stripped, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  return import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
}

test('the price-freshness module has a CONSUMER', () => {
  // The whole defect. A module with no caller is indistinguishable from one that
  // was never written, and this one sat unused for 19 days across at least one
  // real consult it was built to prevent.
  assert.match(
    route,
    /buildPriceFreshnessBlock/,
    'price-freshness.ts must actually be called by the widget, or it protects nobody'
  )
  assert.match(route, /summarisePriceFreshness/)
})

test('the freshness note rides on the TOOL RESULT, beside the prices', () => {
  // It cannot go in the system prompt: the widget resolves tools mid-turn, so
  // the prompt is already built and sent before any price exists.
  const loop = route.slice(route.indexOf('const toolResults'), route.indexOf('loopMessages.push({ role: \'user\', content: toolResults })'))
  assert.match(loop, /buildPriceFreshnessBlock/, 'the note must be attached inside the tool loop')
  assert.match(loop, /last_checked/, 'it must read the age off the price rows')
})

test('EXECUTED: a stale price produces a note, a fresh one produces silence', async () => {
  const m = await load('src/lib/yuri/price-freshness.ts')
  const day = 86_400_000
  const now = Date.now()
  const stale = m.summarisePriceFreshness(
    [{ last_checked: new Date(now - 149 * day).toISOString() }],
    now
  )
  const note = m.buildPriceFreshnessBlock(stale)
  assert.ok(note, 'a 149-day-old price must produce a note')
  assert.match(note, /149 days old/, 'the note must state the real age')

  // A healthy catalog must cost zero tokens and change no behaviour.
  const fresh = m.summarisePriceFreshness([{ last_checked: new Date(now - 2 * day).toISOString() }], now)
  assert.equal(m.buildPriceFreshnessBlock(fresh), null, 'fresh prices must produce NO block')
})

test('EXECUTED: the note states an age and never invents a refresh cadence', async () => {
  const m = await load('src/lib/yuri/price-freshness.ts')
  const now = Date.now()
  const note = m.buildPriceFreshnessBlock(
    m.summarisePriceFreshness([{ last_checked: new Date(now - 100 * 86_400_000).toISOString() }], now)
  )
  // "Our prices update daily" is the most dangerous sentence that could appear
  // here: no command words, passes a naive guard, and is a fabricated guarantee
  // Yuri would repeat with total confidence.
  assert.ok(!/update[sd]? (daily|weekly|hourly|every)/i.test(note), 'must never claim a refresh cadence')
  assert.ok(!/cheaper|less than|lower than|in your favou?r/i.test(note), 'must never predict the DIRECTION of drift')
  assert.match(note, /not a rule and not a cap/i, 'it must stay a fact, not become a disclaimer mandate')
})

test('the price rule is scoped to what Yuri can see NOW, not the conversation', () => {
  // The fabrication licence. "IN THIS CONVERSATION" was true of a price returned
  // three turns earlier, while only the NAME survives cross-turn.
  const rules = route.slice(route.indexOf('Price Quoting Rules') > 0 ? route.indexOf('Price Quoting Rules') : 0)
  assert.match(route, /SEE RIGHT NOW/, 'the rule must bind to the currently visible tool result')
  assert.ok(
    !/came back from[^.]*IN THIS CONVERSATION/i.test(route),
    'the conversation-scoped wording licensed quoting a number no longer in view'
  )
  // Ratings and review counts were fabricated in the same message as the price.
  assert.match(route, /a dollar amount, a rating, or a review count/i)
})

test('the sweep has no cursor keyed on the column it mutates', () => {
  // 770 rows sat permanently behind `.gt('last_checked', cursor)` while the
  // sweep re-refreshed ~10-day-old rows nightly; live runs showed the cursor
  // advancing exactly one day per day with wrapped:false every time.
  assert.ok(
    !/\.gt\('last_checked'/.test(refresher),
    'a keyset cursor on last_checked strands the tail forever — stalest-first is already self-advancing'
  )
  assert.match(refresher, /NO KEYSET CURSOR/, 'the reasoning must stay next to the code')
  // The stalest-first ordering is what replaces it and must survive.
  assert.match(refresher, /\.order\('last_checked', \{ ascending: true/)
})

test('sibling listings quote the AUTHORITATIVE price table, not the inline column', () => {
  const tools = readFileSync(join(root, 'src/lib/yuri/tools.ts'), 'utf8')
  const fn = tools.slice(
    tools.indexOf('async function attachSiblingListings'),
    tools.indexOf('// ---', tools.indexOf('async function attachSiblingListings'))
  )
  // Measured Sep 3 2026: ss_products.price_usd disagrees with the live price row
  // for 66.7% of verified products, and it skews LOW on exactly the multi-unit
  // rows this block exists to disambiguate. The Anua PDRN Double Pack read
  // $33.81 inline against $95.96 live — a 65% understatement, in the direction
  // that makes a two-pack look like a single bottle. A real visitor asked about
  // that product on Aug 31.
  assert.match(
    fn,
    /ss_product_prices\(price_usd/,
    'the sibling block must read the live price table; the inline column is wrong for two thirds of the catalog'
  )
  assert.match(fn, /Math\.min\(\.\.\.live\)/, 'cheapest live row should represent the listing')
  // The inline column may remain ONLY as a fallback for products with no price row.
  assert.match(fn, /live\.length \?.*: \(s\.price_usd/s, 'inline is a fallback, not the source')
})

test('the listings note names the multi-unit trap concretely', () => {
  const tools = readFileSync(join(root, 'src/lib/yuri/tools.ts'), 'utf8')
  // 996 of 4,947 priced products (20.1%) are sets, packs, kits or Nea listings,
  // and nothing else in the payload distinguishes them — the Celimax row that
  // started this had subcategory "brightening serum", singular, contradicting
  // the "Set" in its own name.
  assert.match(
    tools,
    /a "Set", "Double Pack" or "Nea" listing is several units at several units.{0,2} price/,
    'the note must say what a multi-unit row actually costs someone'
  )
})
