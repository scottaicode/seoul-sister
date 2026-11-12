/**
 * Things a member was shown on the owner's walkthrough (Nov 11 2026) that were
 * not true, or not findable:
 *  - The Routine page said "Missing Steps: Moisturizer" over a routine that had
 *    one, minutes after Yuri built it. A page rule giving advice.
 *  - Nothing linked to /settings, where the Terms and the Privacy Policy send
 *    members to delete their account.
 *  - The membership page led with "$9.99 /month" and put the free week in small
 *    grey print, the reverse of the public pricing card.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
function walk(dir, out = []) {
  for (const f of readdirSync(join(root, dir))) {
    const p = `${dir}/${f}`
    if (statSync(join(root, p)).isDirectory()) walk(p, out)
    else if (/\.tsx?$/.test(f)) out.push(p)
  }
  return out
}

test('no page tells a member what their routine is "missing": that is advice, and advice is Yuri\'s', () => {
  const hits = []
  for (const f of [...walk('src/app'), ...walk('src/components')]) {
    const src = read(f)
    // Rendered text or a call, not a comment explaining the removal.
    const code = src.replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')
    if (/Missing Steps|MissingStepBanner|detectMissingSteps\(/.test(code)) hits.push(f)
  }
  assert.deepEqual(hits, [])
  const page = read('src/app/(app)/routine/page.tsx')
  assert.doesNotMatch(page.replace(/\/\/[^\n]*/g, ''), /missingSteps|MissingStepAlert/)
  // Not only that name. The SHAPE: nothing the Routine page renders may tell the
  // member to add, need or lack a step. (The seasonal tips survived two removals
  // by living in a differently named component; a name search cannot see that.)
  const rendered = ['src/app/(app)/routine/page.tsx', ...walk('src/components/routine')]
  for (const f of rendered) {
    const text = read(f).replace(/\/\*[\s\S]*?\*\/|\/\/[^\n]*/g, '')
    // Text a person would read: JSX text nodes and string literals, not identifiers.
    const visible = [...text.matchAll(/>([^<>{}]{12,})</g), ...text.matchAll(/(['"`])((?:(?!\1)[^\\\n]){12,})\1/g)].map((m) => m[2] ?? m[1])
    for (const v of visible) {
      assert.doesNotMatch(v, /\b(is|are|you're|your routine is) missing\b|\bmissing (a|an|your|steps?)\b|\byou (need|should add)\b|\badd (a|an) (moisturizer|sunscreen|cleanser|toner|serum)\b/i, `${f}: "${v.trim().slice(0, 80)}"`)
    }
  }
  // The warnings that ARE data stay: ingredient conflicts and wait times.
  assert.match(page, /<ConflictWarning conflicts=\{conflicts\} checkFailed=\{conflictCheckFailed\} \/>/)
  assert.match(page, /suggestWaitTimes\(productsForAnalysis\)/)
})

test('Settings can be reached from the profile menu and from the Profile page, as the Terms and Privacy Policy say', () => {
  const header = read('src/components/layout/Header.tsx')
  const menu = header.slice(header.indexOf('{/* Profile dropdown */}'), header.indexOf('Sign Out', header.indexOf('{/* Profile dropdown */}')))
  assert.match(menu, /<Link\n\s+href="\/settings"\n\s+onClick=\{\(\) => setProfileMenuOpen\(false\)\}[\s\S]*?Settings\n\s+<\/Link>/)
  assert.ok(menu.indexOf('href="/profile"') < menu.indexOf('href="/settings"'))
  // For every member, not behind the admin check that follows it.
  assert.ok(menu.indexOf('href="/settings"') < menu.indexOf('{isAdmin && ('), 'the Settings link must sit outside the admin-only block')
  assert.doesNotMatch(menu.slice(menu.indexOf('href="/profile"'), menu.indexOf('href="/settings"')), /isAdmin|plan\b|&& \(/)
  const profile = read('src/app/(app)/profile/page.tsx')
  assert.match(profile, /<Link\n\s+href="\/settings"[\s\S]{0,200}Settings: membership, or delete your account\n\s+<\/Link>/)
  // The pages that send people there, and the page itself.
  assert.match(read('src/app/(legal)/terms/page.tsx'), /delete your account at any time through Settings/)
  assert.match(read('src/app/(legal)/privacy/page.tsx'), /Settings &rarr; Delete Account/)
  const settings = read('src/app/(app)/settings/page.tsx')
  assert.match(settings, /label="Delete Account"/)
  assert.doesNotMatch(settings, /v3\.3\.0|Seoul Sister v\d/, 'a hand-written version number goes stale; it said v3.3.0 at v11.57')
})

const offersJs = ts.transpileModule(read('src/lib/offers.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace(/import\s*\{[^}]*\}\s*from\s*['"]@\/lib\/pricing['"];?/, "const PRICING = { trial_days: 7, monthly_display: '$9.99/mo', monthly_display_long: '$9.99/month', monthly_price: 9.99 };")
  .replace(/import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?/g, '')
const offers = await import('data:text/javascript;base64,' + Buffer.from(offersJs).toString('base64'))

test('the membership page leads with the free week in the public card\'s own words, and says what a card does (executed wording)', () => {
  const card = offers.pricingCardLines()
  assert.deepEqual([card.headline, card.noCard, card.cta], ['Free for 7 days', 'No card needed to start.', 'Start my 7 free days'])
  const line = offers.paywallFreeWeekLine('$9.99/month')
  assert.equal(line, "Add a card any time in those 7 days to keep going at $9.99/month. If you don't, the free week ends and nothing is charged.")
  assert.doesNotMatch(line, /[—–]|unlimited/i)
  // A saved creator code flows through unchanged, whatever its wording.
  assert.match(offers.paywallFreeWeekLine('$4.99 for your first month, then $9.99/month'), /keep going at \$4\.99 for your first month, then \$9\.99\/month\. If you don't/)

  const page = read('src/app/(auth)/subscribe/page.tsx')
  assert.match(page, /const freeWeekLeads = trialEligible === true && noCardTrial\n/)
  // Headline: the free week when it is on offer with no card; the price otherwise.
  assert.match(page, /\{freeWeekLeads \? \(\n\s+<>\n\s+<p className="text-4xl font-bold text-white leading-tight">\{card\.headline\}<\/p>\n\s+<p className="text-base font-semibold text-gold-light mb-2">\{card\.noCard\}<\/p>\n\s+<\/>\n\s+\) : \(\n\s+<div className="flex items-baseline gap-1 mb-1">\n\s+<p className="text-4xl font-bold text-white">\$\{tier\.price\}<\/p>/)
  // The sentence under it comes from offers.ts and is readable, not 40% grey at 12px.
  assert.match(page, /<p className=\{freeWeekLeads \? 'text-sm text-white\/80 mb-6' : 'text-sm text-white\/60 mb-6'\}>\n\s+\{trialEligible === true && noCardTrial\n\s+\? paywallFreeWeekLine\(priceLong\)\n/)
  // Readable type on both sale surfaces (the owner could not read the grey print, Nov 11 2026):
  // nothing a buyer needs is smaller than 12px or fainter than 50% white.
  for (const [name, src] of [['membership page', page], ['pricing card', read('src/components/pricing/PricingCards.tsx')]]) {
    const cardAt = src.indexOf('dark-card-gold')
    // The card and the links under it; a decorative separator dot is not text.
    const body = src.slice(cardAt).replace(/<span className="text-white\/20">·<\/span>/g, '')
    assert.doesNotMatch(body, /text-\[(9|10|11)px\]/, `${name}: type under 12px on the card`)
    assert.doesNotMatch(body, /text-white\/(10|20|30|40)\b/, `${name}: text fainter than 50% white on the card`)
    assert.match(body, /<li key=\{f\} className="flex gap-2\.5 text-sm text-white\/85">/, name)
  }
  // The feature list says what Yuri can do, not more.
  const tiers = read('src/lib/stripe.ts')
  const monthly = tiers.slice(tiers.indexOf('features: ['), tiers.indexOf('],', tiers.indexOf('features: [')))
  assert.match(monthly, /'Counterfeit warning signs & price checks',/)
  assert.doesNotMatch(monthly.replace(/\/\/[^\n]*/g, ''), /\blive\b|detection|guarantee|verif/i)
  assert.match(page, /\{freeWeekLeads \? card\.cta : trialEligible === true \? `Start \$\{PRICING\.trial_days\} days free` : 'Start membership'\}/)
  // Same badge as the public card.
  const publicCard = read('src/components/pricing/PricingCards.tsx')
  const badge = 'Your K-Beauty Advisor, Available 24/7'
  assert.ok(page.includes(badge) && publicCard.includes(badge))
  assert.doesNotMatch(page, /Full AI Intelligence Suite/)
  // "No card needed" under the button only when that is true: the trial is on offer AND takes no card.
  assert.match(page, /\{trialEligible === true && noCardTrial \? 'No card needed to start\. Handled by Stripe\.' : 'Secure payment via Stripe\.'\}/)
  assert.equal((page.match(/No card needed to start\. Handled by Stripe\./g) ?? []).length, 1)
  // And "no card" is only believed when the server says so in as many words.
  assert.match(page, /setNoCardTrial\(t\.eligible === true && t\.no_card === true\)/)
  // Someone who cannot have the free week (trial used, network cap, card required) still sees the price first.
  for (const s of ['Your free trial has ended. Continue for', 'charged today. The free trial is not available here']) assert.ok(page.includes(s), s)
  // The allowance note is not on this page (owner decision, Nov 11 2026; see src/lib/pricing.ts allowanceNote).
  assert.doesNotMatch(page, /allowanceNote/)
})

// ── Setup is "completed" only when it is ─────────────────────────────────────
// finalizeOnboardingProfile also runs after every message once a skin type is
// known. It used to stamp the setup 'completed' each time: 31% done, required
// age missing, and a return to /onboarding ended the chat instead of resuming.

const ONB = read('src/lib/yuri/onboarding.ts')
function cut(src, signature) {
  const start = src.indexOf(signature)
  assert.ok(start > -1, signature)
  let d = 0, j = src.indexOf('{\n', src.indexOf(')', start))
  // skip a return-type annotation's braces, if any, by starting at the body brace
  j = src.indexOf('{\n', src.indexOf('): ', start))
  const open = j
  for (; j < src.length; j++) {
    if (src[j] === '{') d++
    else if (src[j] === '}') { d--; if (!d) break }
  }
  void open
  return src.slice(start, j + 1).replace(/^export /, '')
}
function loadFinalize(writes, { fn = 'finalizeOnboardingProfile', selected = null } = {}) {
  const src = [
    ONB.slice(ONB.indexOf('const ALL_FIELDS'), ONB.indexOf('export function buildOnboardingSystemPrompt')),
    cut(ONB, 'export function calculateOnboardingProgress('),
    cut(ONB, 'export function checkOnboardingComplete('),
    cut(ONB, 'export async function finalizeOnboardingProfile('),
    cut(ONB, 'export async function skipOnboarding('),
  ].join('\n').replace(/^export /gm, '')
  const js = ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  const chain = (table) => {
    const call = { table, op: 'select' }
    const q = new Proxy(function () {}, {
      get(_t, k) {
        if (k === 'then') return (res) => Promise.resolve({ data: call.op === 'select' ? selected : null, error: null }).then(res)
        return (...a) => {
          if (k === 'update' || k === 'upsert' || k === 'insert') { call.op = k; call.values = a[0]; writes.push(call) }
          if (k === 'eq') (call.eq ??= []).push(a)
          return q
        }
      },
    })
    return q
  }
  const db = { from: chain, auth: { admin: { getUserById: async () => ({ data: { user: null } }) } } }
  // Anything the function reaches for that is not defined here is a permissive stub.
  const scope = new Proxy({ getServiceClient: () => db, console: { log() {}, warn() {}, error() {} } }, {
    has: (t, k) => typeof k === 'string' && !(k in globalThis) && k !== 'finalizeOnboardingProfile' && k !== 'skipOnboarding' && k !== 'checkOnboardingComplete' && k !== 'calculateOnboardingProgress' && !/^(ALL_FIELDS|REQUIRED_FIELDS)$/.test(k) || k in t,
    get: (t, k) => (k in t ? t[k] : k === Symbol.unscopables ? undefined : async () => null),
  })
  return new Function('scope', `with (scope) { ${js}\n return ${fn} }`)(scope)
}

test('setup is stamped "completed" only with skin type, concerns AND age; the profile is synced either way (executed)', async () => {
  const partial = { skin_type: 'dry', skin_concerns: ['breakouts'], current_routine: ['a cleanser'] }
  const full = { ...partial, age_range: '31-35' }
  for (const [name, extracted, expectStamp] of [['31% done, age missing', partial, false], ['required fields in', full, true], ['skin type only', { skin_type: 'dry' }, false], ['concerns empty', { skin_type: 'dry', skin_concerns: [], age_range: '31-35' }, false]]) {
    const writes = []
    await loadFinalize(writes)('u1', extracted)
    const profile = writes.filter((w) => w.table === 'ss_user_profiles')
    assert.equal(profile.length, 1, `${name}: the profile is still written`)
    assert.equal(profile[0].values.skin_type, 'dry', name)
    const stamps = writes.filter((w) => w.table === 'ss_onboarding_progress' && w.values?.onboarding_status === 'completed')
    assert.equal(stamps.length, expectStamp ? 1 : 0, name)
  }
})

test('skipping part-way keeps the profile and still records the skip, so nobody is left "in progress" for good (executed)', async () => {
  // A profile already exists (a skin type was captured): nothing in it is overwritten.
  const writes = []
  await loadFinalize(writes, { fn: 'skipOnboarding', selected: { onboarding_completed: true } })('u1')
  assert.equal(writes.filter((w) => w.table === 'ss_user_profiles').length, 0, 'an extracted profile must not be reset to a blank one')
  const status = writes.filter((w) => w.table === 'ss_onboarding_progress')
  assert.deepEqual(status.map((w) => w.values), [{ onboarding_status: 'skipped' }])
  // Only a setup still in progress: a finished one stays finished.
  assert.deepEqual(status[0].eq, [['user_id', 'u1'], ['onboarding_status', 'in_progress']])
  // Nothing yet: the minimal profile is written and the skip recorded, as before.
  const fresh = []
  await loadFinalize(fresh, { fn: 'skipOnboarding', selected: null })('u1')
  assert.equal(fresh.filter((w) => w.table === 'ss_user_profiles').length, 1)
  assert.ok(fresh.some((w) => w.table === 'ss_onboarding_progress' && w.values.onboarding_status === 'skipped'))
  // Both status writes in this file read their result.
  assert.match(ONB, /if \(stampError\) console\.error\(/)
  assert.match(ONB, /if \(skipError\) console\.error\(/)
})

test('the weekly note calls an old shelf row "not confirmed owned" only when it predates owned-only saving', () => {
  const src = read('src/lib/proactive/subscriber-checkin.ts')
  assert.match(src, /const SHELF_MEANS_OWNED_SINCE = '2026-11-13'\n/)
  assert.match(src, /x\.product_id && onSavedRoutine\.has\(x\.product_id\) && x\.created_at < SHELF_MEANS_OWNED_SINCE \? 'on a plan you saved, not confirmed owned' : null/)
  // The comparison the code makes, on the two shapes a timestamp arrives in.
  for (const before of ['2026-11-12T23:59:59.999+00:00', '2026-08-14T05:00:00Z']) assert.ok(before < '2026-11-13')
  for (const after of ['2026-11-13T00:00:00+00:00', '2026-12-01T00:00:00Z']) assert.ok(!(after < '2026-11-13'))
})

test('the two places that read "completed" mean a finished setup', () => {
  const route = read('src/app/api/yuri/onboarding/route.ts')
  assert.match(route, /if \(progress\.onboarding_status === 'completed'\) \{/)
  assert.match(read('src/app/(auth)/subscribe/page.tsx'), /progressRes\.data\?\.onboarding_status === 'completed'/)
  // The other writer already required it.
  assert.match(ONB, /if \(isComplete\) \{\n\s+updates\.onboarding_status = 'completed'/)
})

// ── Starter questions and the sender name ────────────────────────────────────
test('the starter questions shown to every member assume nothing about that member', () => {
  const page = read('src/app/(app)/yuri/page.tsx')
  const block = page.slice(page.indexOf('const SUGGESTED_PROMPTS = ['), page.indexOf(']', page.indexOf('const SUGGESTED_PROMPTS = [')))
  const texts = [...block.matchAll(/text: (['"])(.*?)\1, specialist/g)].map((m) => m[2])
  assert.equal(texts.length, 4)
  for (const t of texts) {
    assert.doesNotMatch(t, /\b(oily|dry|combination|sensitive|acne|mature)\b/i, `"${t}" assumes a skin type`)
    assert.doesNotMatch(t, /COSRX|Sulwhasoo|Snail|Laneige|Anua|Innisfree/i, `"${t}" names a product they may not own`)
    assert.doesNotMatch(t, /[—–]/)
  }
})

const sendJs = ts.transpileModule(read('src/lib/email/send.ts'), { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
  .replace(/import\s*\{[^}]*\}\s*from\s*['"][^'"]+['"];?/g, '').replace(/import\s+[^;\n]+;?/g, '')
const { withSenderName } = await import('data:text/javascript;base64,' + Buffer.from(sendJs).toString('base64'))

test('a bare sender address is given Yuri\'s name; anything already named is left alone (executed)', () => {
  assert.equal(withSenderName('yuri@seoulsister.com'), 'Yuri at Seoul Sister <yuri@seoulsister.com>')
  assert.equal(withSenderName('  yuri@seoulsister.com '), 'Yuri at Seoul Sister <yuri@seoulsister.com>')
  for (const named of ['Yuri at Seoul Sister <yuri@seoulsister.com>', 'Seoul Sister <team@seoulsister.com>', '"Yuri" <yuri@seoulsister.com>', '<yuri@seoulsister.com>', 'not an address', '']) {
    assert.equal(withSenderName(named), named)
  }
  assert.match(read('src/lib/email/send.ts'), /const from = withSenderName\(\n\s+options\.from \|\|\n\s+process\.env\.EMAIL_FROM \|\|/)
})

// ── A routine is built with Yuri, not by a second generator wearing her name ──
test('the Routine page hands "build me a routine" to Yuri; no separate generator exists', async () => {
  const { existsSync } = await import('node:fs')
  for (const gone of ['src/components/routine/RoutineGenerator.tsx', 'src/app/api/routine/generate/route.ts']) {
    assert.equal(existsSync(join(root, gone)), false, `${gone} is back`)
  }
  const page = read('src/app/(app)/routine/page.tsx').replace(/\{\/\*[\s\S]*?\*\/\}|\/\/[^\n]*/g, '')
  assert.doesNotMatch(page, /AI Generate|Generate (Morning|Evening) Routine|Routine Architect|showGenerator|RoutineGenerator/)
  // Both gaps (no morning routine, no evening routine) open the chat with the request ready.
  assert.match(page, /href="\/yuri\?ask=Build%20my%20morning%20routine\."/)
  assert.match(page, /href="\/yuri\?ask=Build%20my%20evening%20routine\."/)
  assert.equal((page.match(/Build with Yuri/g) ?? []).length, 2)
  // Adding products by hand is still there: that is the member's own choice, not advice.
  assert.equal((page.match(/Build Manually/g) ?? []).length, 2)
  // Neither link is hidden or conditional.
  for (const t of ['morning', 'evening']) {
    const at = page.indexOf(`href="/yuri?ask=Build%20my%20${t}%20routine."`)
    const tag = page.slice(page.lastIndexOf('<Link', at), page.indexOf('>', at))
    assert.doesNotMatch(tag, /hidden|invisible|opacity-0|sr-only|aria-hidden/, t)
  }
  // Closed world: the only links into Yuri are those two and the existing ask-Yuri prompts, and
  // the page talks to exactly these endpoints. A new "instant routine" call cannot be added quietly.
  const calls = [...page.matchAll(/fetch\(\s*[`'"]([^`'"?$]+)/g)].map((m) => m[1]).sort()
  assert.deepEqual([...new Set(calls)], ['/api/routine', '/api/routine/', '/api/tracking'])
  assert.doesNotMatch(page, /instant|auto-?build|one[- ]click routine/i)
  // The SHAPE, not only these names: no route under src/app/api/routine calls a model.
  for (const f of walk('src/app/api/routine')) {
    assert.doesNotMatch(read(f), /getAnthropicClient|anthropic\.messages|MODELS\./, `${f} makes its own model call`)
  }
  // And the chat page really does take the prefilled request.
  assert.match(read('src/app/(app)/yuri/page.tsx'), /const askParam = searchParams\?\.get\('ask'\) \|\| null/)
})
