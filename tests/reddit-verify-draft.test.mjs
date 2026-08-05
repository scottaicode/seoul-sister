/**
 * Guard tests — the Reddit draft fact-checker.
 *
 * WHAT THIS PROTECTS
 *
 * The checker is the verification step in a human-in-the-loop process: LGAAS
 * surfaces threads, Scott picks and posts, and this sits between the draft and
 * the post. Its failure mode is not "wrong answer" — it is "clean-looking
 * output that checked nothing", which would give false confidence on a public,
 * permanent, attributable claim. So the census (`checked`, `verified_anything`)
 * is tested as hard as the findings.
 *
 * Pure functions are executed directly. The DB-touching path is executed
 * against a stub client, so the real control flow runs — a regex over source
 * text would pass against broken code.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

/** Transpile and load the real module, stubbing only its imports. */
function loadModule({ ingredients = [], prices = [], resolve = () => null } = {}) {
  const src = readFileSync(join(root, 'src/lib/reddit/verify-draft.ts'), 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2020 },
  }).outputText

  // Minimal PostgREST-shaped stub. Returns { data, error } like the real client.
  const makeQuery = (rows) => {
    const q = {
      select: () => q,
      eq: () => q,
      order: () => q,
      limit: () => Promise.resolve({ data: rows, error: null }),
      then: (res) => Promise.resolve({ data: rows, error: null }).then(res),
    }
    return q
  }
  const db = {
    from: (table) =>
      table === 'ss_product_ingredients' ? makeQuery(ingredients) : makeQuery(prices),
  }

  const module = { exports: {} }
  const require_ = (spec) => {
    if (spec === '@/lib/supabase') return { getServiceClient: () => db }
    if (spec === '@/lib/yuri/tools') return { resolveProductByNameStrict: async (_d, n) => resolve(n) }
    if (spec === '@/lib/pipeline/ingredient-parser')
      return { excludePollutedIngredientRows: (q) => q }
    throw new Error(`unexpected import: ${spec}`)
  }
  new Function('module', 'exports', 'require', js)(module, module.exports, require_)
  return { mod: module.exports, db }
}

const { mod } = loadModule()
const {
  extractProductCandidates,
  extractIngredientClaims,
  extractPriceClaims,
  checkPolicy,
  formatFindings,
} = mod

// ---------------------------------------------------------------- extraction

test('finds a product named inline in real prose', () => {
  // Verbatim from the live corpus (score 8, r/koreanskincare).
  const draft =
    'Klairs Supple Preparation Unscented Toner is great for this, especially if your skin is reactive.'
  const found = extractProductCandidates(draft)
  assert.ok(
    found.some((c) => c.includes('Klairs Supple Preparation')),
    `expected the Klairs product, got: ${JSON.stringify(found)}`
  )
})

test('does not treat a sentence opener as a product', () => {
  const found = extractProductCandidates("The thing I'd flag though is the fragrance.")
  assert.ok(
    !found.some((c) => c.toLowerCase().startsWith('the thing')),
    `sentence prose leaked in: ${JSON.stringify(found)}`
  )
})

test('reads a positive and a negated ingredient claim', () => {
  const claims = extractIngredientClaims(
    'The Anua cleanser contains fragrance. The Isntree toner is free of essential oils.'
  )
  const positive = claims.find((c) => !c.negated)
  const negated = claims.find((c) => c.negated)
  assert.ok(positive, 'missed the "contains" claim')
  assert.ok(negated, 'missed the "free of" claim')
  assert.match(positive.ingredient, /fragrance/i)
})

test('finds dollar amounts with their sentence', () => {
  const claims = extractPriceClaims('It runs about $18.30 at Olive Young. Worth it.')
  assert.equal(claims.length, 1)
  assert.equal(claims[0].amount, '$18.30')
  assert.match(claims[0].sentence, /Olive Young/)
})

// ------------------------------------------------------------------- policy

test('BLOCKS implying a discouraged retailer sells fakes', () => {
  // The rule is shipping/refund quality, NOT authenticity. Getting this
  // backwards is both false and an affiliate/legal exposure.
  const f = checkPolicy('Avoid YesStyle, a lot of what they sell is counterfeit.')
  const hit = f.find((x) => x.rule === 'retailer_counterfeit_smear')
  assert.ok(hit, 'did not catch the counterfeit smear')
  assert.equal(hit.severity, 'blocker')
  assert.match(hit.detail, /AUTHENTIC/)
})

test('warns (not blocks) on merely steering to a discouraged retailer', () => {
  const f = checkPolicy("I'd get it from YesStyle, they usually have it cheaper.")
  const hit = f.find((x) => x.rule === 'retailer_steering')
  assert.ok(hit, 'did not catch the steering')
  assert.equal(hit.severity, 'warn')
})

test('does not flag a recommended retailer', () => {
  const f = checkPolicy("I'd get it from Olive Young.")
  assert.equal(f.filter((x) => x.rule.startsWith('retailer')).length, 0)
})

test('flags a marketplace counterfeit accusation', () => {
  const f = checkPolicy('Never buy it on Amazon, it is all counterfeit there.')
  assert.ok(f.some((x) => x.rule === 'marketplace_accusation'))
})

test('flags the unsourced KTRI sunscreen statistic', () => {
  const f = checkPolicy('KTRI tested these and 68% of COSRX sunscreen failed SPF.')
  const hit = f.find((x) => x.rule === 'unsourced_claim')
  assert.ok(hit)
  assert.match(hit.detail, /no primary source/i)
})

test('flags a stale commingling argument', () => {
  const f = checkPolicy('Amazon commingles inventory so fakes get mixed in.')
  assert.ok(f.some((x) => x.rule === 'unsourced_claim' && /March 2026/.test(x.detail)))
})

test('notes that US-sold Korean sunscreens are reformulated', () => {
  const f = checkPolicy('Just grab the Beauty of Joseon sunscreen at Target.')
  assert.ok(f.some((x) => x.rule === 'us_sunscreen_reformulation'))
})

test('BLOCKS a medical presentation with no referral', () => {
  const f = checkPolicy('That mole looks like it has been bleeding — try a gentle cleanser.')
  const hit = f.find((x) => x.rule === 'medical_referral_missing')
  assert.ok(hit, 'a lesion with no referral must block')
  assert.equal(hit.severity, 'blocker')
})

test('accepts a medical presentation that DOES refer out', () => {
  const f = checkPolicy(
    'That mole has been bleeding, which is worth getting looked at by a dermatologist rather than treated with a product.'
  )
  assert.equal(f.filter((x) => x.rule === 'medical_referral_missing').length, 0)
})

test('flags an em-dash', () => {
  assert.ok(checkPolicy('This is great — really great.').some((x) => x.rule === 'ai_tell'))
})

// ------------------------------------------------------- catalog verification

const KLAIRS = { id: 'p1', name_en: 'Supple Preparation Unscented Toner', brand_en: 'Klairs' }
const ing = (n) => ({ ss_ingredients: { name_inci: n } })

test('BLOCKS a claim the catalog contradicts (the fabricated-claim class)', async () => {
  // Exactly the Sulwhasoo failure: a confident ingredient claim the DB denies.
  const { mod } = loadModule({
    resolve: (n) => (n.includes('Klairs Supple Preparation') ? KLAIRS : null),
    ingredients: [ing('Water'), ing('Butylene Glycol'), ing('Sodium Hyaluronate')],
  })
  const res = await mod.verifyDraft(
    'Klairs Supple Preparation Unscented Toner contains niacinamide, which is why it helps.'
  )
  const hit = res.findings.find((f) => f.rule === 'ingredient_contradicted')
  assert.ok(hit, `expected a contradiction, got ${JSON.stringify(res.findings)}`)
  assert.equal(hit.severity, 'blocker')
  assert.equal(res.checked.ingredient_claims, 1, 'the claim must count as CHECKED')
})

test('passes a claim the catalog supports', async () => {
  const { mod } = loadModule({
    resolve: (n) => (n.includes('Klairs Supple Preparation') ? KLAIRS : null),
    ingredients: [ing('Water'), ing('Sodium Hyaluronate')],
  })
  const res = await mod.verifyDraft(
    'Klairs Supple Preparation Unscented Toner contains sodium hyaluronate.'
  )
  assert.equal(res.findings.filter((f) => f.rule === 'ingredient_contradicted').length, 0)
  assert.equal(res.checked.ingredient_claims, 1)
})

test('a product with NO ingredient rows is unverifiable, never a pass', async () => {
  // Absence of a match is not evidence of absence. This is the whole thesis.
  const { mod } = loadModule({
    resolve: (n) => (n.includes('Klairs Supple Preparation') ? KLAIRS : null),
    ingredients: [],
  })
  const res = await mod.verifyDraft(
    'Klairs Supple Preparation Unscented Toner contains niacinamide.'
  )
  const hit = res.findings.find((f) => f.rule === 'ingredient_unverifiable')
  assert.ok(hit, 'an empty INCI list must be reported, not silently passed')
  assert.equal(res.checked.ingredient_claims, 0, 'nothing was actually verified')
  assert.equal(
    res.findings.filter((f) => f.rule === 'ingredient_contradicted').length,
    0,
    'must NOT claim contradiction when the data is simply missing'
  )
})

test('an unresolved product name is info, not an error', async () => {
  // ~40% of products people discuss are legitimately outside a Korean catalog.
  const { mod } = loadModule({ resolve: () => null })
  const res = await mod.verifyDraft('CeraVe Moisturizing Cream works well for that.')
  const hit = res.findings.find((f) => f.rule === 'product_unresolved')
  assert.ok(hit)
  assert.equal(hit.severity, 'info', 'a non-Korean product must not read as an error')
})

test('flags a stale price with the real date', async () => {
  const old = new Date(Date.now() - 120 * 86400000).toISOString()
  const { mod } = loadModule({
    resolve: (n) => (n.includes('Klairs Supple Preparation') ? KLAIRS : null),
    prices: [{ price_usd: 20.9, last_checked: old }],
  })
  const res = await mod.verifyDraft(
    'Klairs Supple Preparation Unscented Toner is about $20.90 right now.'
  )
  const hit = res.findings.find((f) => f.rule === 'price_stale')
  assert.ok(hit, 'a 120-day-old price must be flagged')
  assert.match(hit.detail, /120 days ago/)
})

test('does not flag a fresh price', async () => {
  const fresh = new Date(Date.now() - 2 * 86400000).toISOString()
  const { mod } = loadModule({
    resolve: (n) => (n.includes('Klairs Supple Preparation') ? KLAIRS : null),
    prices: [{ price_usd: 20.9, last_checked: fresh }],
  })
  const res = await mod.verifyDraft(
    'Klairs Supple Preparation Unscented Toner is about $20.90 right now.'
  )
  assert.equal(res.findings.filter((f) => f.rule === 'price_stale').length, 0)
})

// --------------------------------------------------------------- the census

test('a clean draft that checked NOTHING says so', () => {
  // The core anti-silent-failure property. "No findings" on an empty census
  // must not read as "verified".
  const res = { findings: [], checked: { products_named: 0, products_resolved: 0, ingredient_claims: 0, price_claims: 0, policy_scans: 1 }, verified_anything: false }
  const out = formatFindings(res)
  assert.match(out, /nothing was verified against the catalog/i)
  assert.match(out, /NOT "the draft is verified"/)
})

test('a draft that DID verify something does not carry the warning', () => {
  const res = { findings: [], checked: { products_named: 1, products_resolved: 1, ingredient_claims: 1, price_claims: 0, policy_scans: 1 }, verified_anything: true }
  assert.doesNotMatch(formatFindings(res), /nothing was verified/i)
})

test('the census is always reported', async () => {
  const { mod } = loadModule({ resolve: () => null })
  const res = await mod.verifyDraft('Just a plain sentence about hydration.')
  assert.ok(res.checked, 'result must always carry a census')
  assert.equal(typeof res.checked.products_named, 'number')
  assert.equal(res.verified_anything, false)
})

test('blockers sort first and are counted in the summary', () => {
  const res = {
    findings: [
      { severity: 'info', rule: 'ai_tell', quote: 'x', detail: 'd' },
      { severity: 'blocker', rule: 'ingredient_contradicted', quote: 'y', detail: 'd' },
    ],
    checked: { products_named: 1, products_resolved: 1, ingredient_claims: 1, price_claims: 0, policy_scans: 1 },
    verified_anything: true,
  }
  const out = formatFindings(res)
  assert.ok(out.indexOf('BLOCKER') < out.indexOf('INFO'), 'blockers must sort first')
  assert.match(out, /1 blocker\(s\) — do not post as written/)
})

test('the checker never returns rewritten text', async () => {
  // A checker that edits becomes a second author and the voice dies.
  const { mod } = loadModule({ resolve: () => null })
  const res = await mod.verifyDraft('Avoid YesStyle, it is all counterfeit.')
  assert.equal(res.draft, undefined)
  assert.equal(res.rewritten, undefined)
  assert.equal(res.corrected, undefined)
  for (const f of res.findings) {
    assert.equal(typeof f.quote, 'string')
    assert.ok(!('replacement' in f), 'findings must suggest, never replace')
  }
})

/**
 * The antecedent rule. Real prose splits the product and the claim across
 * sentences — "Klairs ... is great for this. It contains niacinamide." A
 * same-sentence-only pairing silently skipped exactly that, reporting
 * `0 ingredient claims verified` on a draft containing a false claim. Honest,
 * but useless: the check the human most needs is the one that did not run.
 */
test('pairs a claim with the product named in the PREVIOUS sentence', async () => {
  const { mod } = loadModule({
    resolve: (n) => (n.includes('Klairs Supple Preparation') ? KLAIRS : null),
    ingredients: [ing('Water'), ing('Butylene Glycol')],
  })
  const res = await mod.verifyDraft(
    'Klairs Supple Preparation Unscented Toner is great for reactive skin. It contains niacinamide, which helps.'
  )
  assert.equal(res.checked.ingredient_claims, 1, 'the cross-sentence claim must be CHECKED')
  assert.ok(
    res.findings.some((f) => f.rule === 'ingredient_contradicted'),
    'and the false claim must be caught'
  )
})

test('never attributes a claim to a product named LATER', async () => {
  // Looking forward would invent a link the writer never made.
  const { mod } = loadModule({
    resolve: (n) => (n.includes('Klairs Supple Preparation') ? KLAIRS : null),
    ingredients: [ing('Water')],
  })
  const res = await mod.verifyDraft(
    'It contains niacinamide. Klairs Supple Preparation Unscented Toner is a different product entirely.'
  )
  assert.equal(
    res.checked.ingredient_claims,
    0,
    'a claim before any product name must stay unchecked, not be guessed at'
  )
})
