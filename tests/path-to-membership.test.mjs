/**
 * The path from "create my free account" to the free week, as wired.
 *
 * Nov 15 2026: a tester created an account and believed that had started her
 * free week. She skipped the setup chat, met a page headed "One last step",
 * then Stripe's page with a price on it. The wording itself is executed in
 * tests/no-card-trial.test.mjs and tests/walkthrough-surfaces.test.mjs; this
 * file holds the wiring.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')
const code = (src) => src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')

test('the sign-up form calls this step an account, never joining, and its price sentence comes from offers.ts', () => {
  const page = read('src', 'app', '(auth)', 'register', 'page.tsx')
  const shown = code(page)
  assert.ok(shown.includes('>Create your free account</h2>'))
  assert.ok(shown.includes('By creating an account you agree to our'))
  assert.doesNotMatch(shown, /\bJoin\b|\bjoining\b/)
  // Under the heading and above BOTH ways of signing up (Google and email),
  // readable, once, and with the visitor's creator code applied.
  const footnote = page.indexOf('{registerFootnote(savedOffer.percentOff)}')
  assert.ok(footnote > 0 && footnote < page.indexOf('Continue with Google') && footnote < page.indexOf('type="submit"'), 'the explanation must come before both sign-up buttons')
  assert.equal(page.split('registerFootnote(savedOffer.percentOff)').length - 1, 1)
  assert.ok(page.includes('<p className="text-white/70 text-sm leading-relaxed mb-8">{registerFootnote(savedOffer.percentOff)}</p>'))
  // The button is named for what it makes.
  assert.ok(shown.includes("'Create my free account'") && !shown.includes("'Create Account'"))
  // No price of its own (comments aside: one records an old price).
  assert.doesNotMatch(shown, /PRICING\.|\$\d|9\.99/)
})

test('the setup chat says what it is, and its two exits say where they go', () => {
  const page = read('src', 'app', '(app)', 'onboarding', 'page.tsx')
  assert.ok(page.includes('<p className="text-xs text-white/60">{setupChatLine(isMember)}</p>'))
  assert.ok(page.includes('          {skipSetupLabel(isMember)}\n'))
  assert.ok(page.includes("                {isMember === true ? 'Finish setup' : 'Finish setup and see membership'}"))
  // The skip link goes where its label says: a member to Yuri, anyone else to membership.
  assert.equal(page.split("router.push(isMember === true ? '/yuri' : '/subscribe')").length - 1, 2)
  // Membership is read from their own profile row; a failed read claims nothing.
  assert.ok(page.includes("      setIsMember(!!profile?.plan && profile.plan !== 'free')\n"))
  // Read by user_id (the profile's `id` is a surrogate key and matches no one).
  assert.equal(page.split(".from('ss_user_profiles')").length - 1, 2)
  assert.equal((page.match(/\.select\('plan'\)\s*\.eq\('user_id', (id|uid)\)/g) ?? []).length, 2)
  // Someone just back from Stripe is not read as "not a member": the plan is
  // still being written, so it is left unknown and read after the confirm.
  assert.ok(page.includes("      if (justPaidRef.current || new URLSearchParams(window.location.search).has('session_id')) return\n"))
  assert.match(page, /if \(!planError && profile\?\.plan && profile\.plan !== 'free'\) \{\s*setIsMember\(true\)\s*return true/)
  // The link runs the handler that goes where the label says.
  assert.match(page, /onClick=\{handleSkip\}[\s\S]{0,260}\{skipSetupLabel\(isMember\)\}/)
  assert.ok(page.includes('const [isMember, setIsMember] = useState<boolean | null>(null)'))
  assert.doesNotMatch(code(page), /Skip for now|complete your profile anytime/)
  // The message shown at the setup cap points at a link that exists.
  const route = read('src', 'app', 'api', 'yuri', 'onboarding', 'route.ts')
  assert.ok(route.includes('Tap \\"Skip this chat\\" under the message box to go on.'))
  assert.doesNotMatch(route, /fill in details later/)
})

test('the membership page for someone who has not finished setup: an honest heading and a way back', () => {
  const page = read('src', 'app', '(auth)', 'subscribe', 'page.tsx')
  assert.ok(page.includes("fromOnboarding ? 'Want me to keep going?' : freeWeekLeads ? 'Start your free week' : 'Become a member'}"))
  assert.doesNotMatch(code(page), /One last step/)
  assert.ok(page.includes("'You have a free account. Membership is separate: I learn your skin, we build your routine together, and I remember all of it.'"))
  // The way back shows only when the setup chat can really be continued: a
  // finished setup sends them straight back here, and an unread state is not "open".
  assert.ok(page.includes("          setSetupOpen(status === 'in_progress' || status === 'skipped')\n"))
  assert.match(page, /\{!hadTrial && !hasProfile && setupOpen && \(\s*<p className="text-sm mt-3">\s*<Link href="\/onboarding"[^>]*>\s*Rather talk first\? Back to the setup chat\s*<\/Link>/)
})

test('the checkout refuses to ask for a card after the page said it would not', () => {
  const page = read('src', 'app', '(auth)', 'subscribe', 'page.tsx')
  assert.ok(page.includes('          ...(trialEligible === true && noCardTrial ? { expect_free_week: true } : {}),\n'))
  // After a refusal the page reads again what applies, so it states the
  // real terms (a card-required week, or charged today) before a second press.
  assert.match(page, /if \(response\.status === 409 && result\.free_week_changed\) \{[\s\S]{0,700}fetch\('\/api\/me\/trial'[\s\S]{0,200}applyTrialFacts\(await again\.json\(\)\)[\s\S]{0,200}setCheckoutError\(result\.error\)\s*return/)
  assert.match(page, /function applyTrialFacts\([^)]*\) \{\s*setTrialEligible\(t\.eligible === true\)\s*setNoCardTrial\(t\.eligible === true && t\.no_card === true\)\s*setHadTrial\(t\.had_trial === true\)\s*setNetworkCap\(t\.network_cap === true\)/)
  const route = read('src', 'app', 'api', 'stripe', 'checkout', 'route.ts')
  assert.ok(route.includes('  expect_free_week: z.boolean().optional(),\n'))
  // Decided from the checkout's own answer, before any session is created.
  const guard = route.indexOf('if (parsed.data.expect_free_week === true && !(withTrial && noCard)) {')
  const session = route.indexOf('createCheckoutSession(')
  assert.ok(guard > 0 && session > guard, 'the guard must run before the Stripe session is built')
  // And before the "pressed the button" stamp and the code lookup: a refusal starts nothing.
  assert.ok(guard < route.indexOf("update({ checkout_clicked_at:") && guard < route.indexOf('resolveOffer('))
  assert.ok(route.includes('return NextResponse.json({ error: freeWeekChangedLine(), free_week_changed: true }, { status: 409 })'))
})

test('the first member screen does not claim a setup conversation that never happened', () => {
  const api = read('src', 'app', 'api', 'yuri', 'welcome-context', 'route.ts')
  // Counted from their own messages in the setup conversation, not from its status.
  assert.match(api, /\.from\('ss_yuri_messages'\)\s*\.select\('id', \{ count: 'exact', head: true \}\)\s*\.eq\('conversation_id', setupId\)\s*\.eq\('role', 'user'\)/)
  assert.ok(api.includes('      else setupSaidAnything = (saidCount ?? 0) > 0\n'))
  assert.ok(api.includes('      setup_said_anything: setupSaidAnything,\n'))
  const page = read('src', 'app', '(app)', 'yuri', 'page.tsx')
  assert.match(page, /\{welcomeContext\?\.setup_said_anything === false \? \(\s*"I don't know your skin yet, so tell me what bothers you most about it and we start there\."/)
})

test('closed world: the membership page lists four of the plan\'s own lines and nothing else', () => {
  const stripe = read('src', 'lib', 'stripe.ts')
  // The list is built from the plan's own lines by position, on this exact
  // line and nowhere else, so nothing can be added here that the plan does not state.
  assert.ok(stripe.includes('\nexport const PAYWALL_FEATURES: readonly string[] = [3, 2, 7, 0].map((i) => SUBSCRIPTION_TIERS.monthly.features[i])\n'))
  assert.equal(stripe.split('PAYWALL_FEATURES').length - 1, 1, 'defined once, never reassigned or extended')
  // Which four lines those positions are today, word for word.
  const monthly = stripe.slice(stripe.indexOf('  monthly: {'), stripe.indexOf('  pro_monthly'))
  const features = [...monthly.slice(monthly.indexOf('features: ['), monthly.indexOf('\n    ]')).matchAll(/^\s+'([^']+)',$/gm)].map((m) => m[1])
  assert.deepEqual([3, 2, 7, 0].map((i) => features[i]), [
    'Remembers your skin across every session',
    'Reads your Korean labels & builds conflict-aware routines',
    'Check-in notes from Yuri, with your local forecast once your location is on file',
    'Yuri, your K-beauty advisor, available 24/7',
  ])
  const page = read('src', 'app', '(auth)', 'subscribe', 'page.tsx')
  assert.ok(page.includes('          {PAYWALL_FEATURES.map((f) => ('))
  assert.equal(page.split('<li').length - 1, 1, 'the mapped line is the only list item on the page')
  assert.doesNotMatch(monthly, /^\s+"/m, 'a double-quoted feature would shift the positions unseen')
  assert.doesNotMatch(page, /tier\.features/)
})

test('a just-started member who skipped setup goes to the member chat, only once the plan is confirmed', () => {
  const page = read('src', 'app', '(app)', 'onboarding', 'page.tsx')
  // The confirm step resolves to whether they are a member; the redirect waits for it.
  assert.ok(page.includes('    confirmedRef.current = (async (): Promise<boolean> => {'))
  assert.match(page, /if \(data\.status === 'skipped' && justPaidRef\.current && confirmedRef\.current\) \{\s*const member = await confirmedRef\.current\s*if \(cancelled\) return\s*if \(member\) \{\s*router\.replace\('\/yuri'\)\s*return/)
  // No prefilled "from what you learned in my setup chat" for them.
  assert.doesNotMatch(page, /router\.replace\('\/yuri\?ask/)
  assert.equal(page.split('FIRST_MEMBER_ASK').length - 1, 2, 'the prefilled first message is used on the completed-setup path only')
})

test('"free week" is true only while the free period is 7 days', () => {
  // Every "free week" in the app, the emails and Yuri's facts rests on this number.
  // Change it and the wording has to change with it.
  assert.match(read('src', 'lib', 'pricing.ts'), /^\s+trial_days: 7,$/m)
  // And the Stripe session takes its length from that number and nowhere else.
  const params = read('src', 'lib', 'stripe-params.ts')
  assert.ok(params.includes('  const trialDays = p.withTrial ? PRICING.trial_days : 0\n'))
  assert.ok(params.includes('      ...(trialDays > 0 ? { trial_period_days: trialDays } : {}),\n'))
  assert.equal(params.split('trial_period_days').length - 1, 1)
})

test('closed world: "trial" is not our word. It appears only where a sentence says it is Stripe\'s', () => {
  const files = []
  const walk = (dir) => {
    for (const e of readdirSync(dir, { withFileTypes: true })) {
      const p = join(dir, e.name)
      if (e.isDirectory()) walk(p)
      else if (/\.tsx?$/.test(e.name)) files.push(p)
    }
  }
  walk(join(root, 'src'))
  assert.ok(files.length > 300, `only ${files.length} files scanned`)
  // Read by the owner or by a log, never by a member.
  const internal = ['src/lib/email/new-subscriber-alert.ts']
  const hits = []
  for (const f of files) {
    const rel = relative(root, f)
    if (internal.includes(rel)) continue
    const shown = code(readFileSync(f, 'utf8'))
    for (const line of shown.split('\n')) {
      // The word in prose (after another word and a space), in any phrasing.
      // A log or a thrown error is not read by a member. The only pass is a
      // sentence that says the word is Stripe's.
      if (!/\b(?!(?:const|let|var|return|typeof|await|new|in|of|type)\b)[A-Za-z0-9'-]+ trials?\b(?!\s*[.:=?)\],;&|(!<>{}\[])/i.test(line)) continue
      if (/console\.|new Error\(/.test(line)) continue
      if (!/Stripe(&apos;|')?s? (calls?|page|pages|checkout)/.test(line)) hits.push(`${rel}: ${line.trim().slice(0, 140)}`)
    }
  }
  assert.deepEqual(hits, [])
})
