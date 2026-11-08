/**
 * Guard test — Anthropic Usage Policy effective Nov 12 2026.
 *
 * Two requirements apply to Seoul Sister:
 *
 * 1. "All consumer-facing chatbots or AI agents that communicate directly with
 *    external users must disclose to users that they are interacting with AI."
 *    The widget header used to read "Your honest K-beauty friend in Seoul",
 *    which reads like a person, and Yuri-voiced emails never said AI.
 *
 * 2. Medical is a High-risk Area: "recommending, starting, stopping, or
 *    adjusting a treatment or medication, including dose" needs a qualified
 *    human to review it before delivery. A live chat cannot do that, so Yuri
 *    leaves PRESCRIPTION start/stop/dose decisions to the prescriber.
 *    Over-the-counter actives stay Yuri's — a deliberate, recorded judgment
 *    (deferral `usage_policy_otc_drug_actives` in ss_pipeline_runs), not a
 *    settled reading of the policy.
 *
 * The regression risk is the rule growing into general hedging, which
 * CLAUDE.md calls a regression. A keyword ban could not see a hedge written
 * without a banned word, and a HEAD..TAIL slice could not see a sentence
 * appended after TAIL (a second-model review beat both). So the rule's whole
 * line is pinned exactly. Changing it should be deliberate: update EXPECTED
 * and get a second-model review.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const HEAD = 'Prescription changes belong to the prescriber.'

const SHARED_TAIL = `Tretinoin, isotretinoin and spironolactone are always prescriptions; adapalene is OTC at 0.1% and prescription at 0.3%. Ask about source or strength only when it changes the decision in front of you. If your memory holds an earlier decision or open loop about a prescription's dose or schedule, treat it as a question to send to their prescriber, not as a plan to resume. This boundary covers prescription decisions only. It is never a reason to hedge, add disclaimers, or soften advice on anything else.`

const FULL = `${HEAD}** For anything a doctor prescribed them (tretinoin, prescription-strength adapalene, isotretinoin, spironolactone, prescription hydroquinone, a topical antibiotic or steroid), you do not decide to start, stop, or change its dose or how often they use it. Everything around it stays yours, with full confidence: explain how it works, build the routine around it, schedule other actives so they never collide with it, check conflicts against it, and tell them what is normal with it. When something they describe goes beyond what is normal with it, that is a call to the prescriber, so send them with the specific question. When the decision is about the prescription itself, say in one plain sentence that it is their prescriber's call, give them the specific question to bring, and keep helping. Suggesting they ask a doctor about a prescription option is a referral, and that is fine. Over-the-counter actives (retinol, retinal, OTC adapalene, BHA, AHA, benzoyl peroxide, azelaic acid, sunscreen) remain yours to recommend, schedule and adjust exactly as before. ${SHARED_TAIL}`

// Nov 3 2026 (deliberate, second-model reviewed): the authed advisor's rule also
// says an existing prescriber cannot be routed around (red-team: a user on
// tretinoin was steered to OTC adapalene "without anyone signing off").
const ADVISOR_PRESCRIBER_ROUTE = ` When they already have a prescriber for the drug in question, that prescriber is the route even if they ask you to skip it: an over-the-counter swap, or a new prescription from someone who isn't told what they're already on, is not a way around that call (a second opinion that knows the history is fine), so name the question for the prescriber they have and keep helping with everything else.`

// Line comments go first: a "//" comment can contain "/*" (e.g. "src/lib/email/*").
const visible = (s) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

// `next` is the real neighbouring line today. Pinning it closed-world means any
// sentence inserted after the rule fails, whatever verb it uses.
const PROMPTS = {
  // `next` for the advisor is rule 7 (person before skin, Nov 3 2026), then the closing line.
  advisor: { src: visible(read('src', 'lib', 'yuri', 'advisor.ts')), expected: FULL + ADVISOR_PRESCRIBER_ROUTE, prefix: '6. **', next: /^7\. \*\*The person comes before the skin\.\*\* / },
  widget: { src: visible(read('src', 'app', 'api', 'widget', 'chat', 'route.ts')), expected: FULL + ADVISOR_PRESCRIBER_ROUTE, prefix: '**', next: /^Pregnancy and breastfeeding matter for one specific reason/ },
  onboarding: {
    prefix: '- **',
    next: /^- \*\*Referrals land in English \(LOAD-BEARING\)\.\*\*/,
    src: visible(read('src', 'lib', 'yuri', 'onboarding.ts')),
    expected: `${HEAD}** For anything a doctor prescribed them (tretinoin, prescription-strength adapalene, isotretinoin, spironolactone, prescription hydroquinone, a topical antibiotic or steroid), you do not decide to start, stop, or change its dose or how often they use it. Everything around it stays yours, with full confidence: explain how it works, build around it, keep other actives from colliding with it, and tell them what is normal with it. When something they describe goes beyond what is normal with it, that is a call to the prescriber, so send them with the specific question. When the decision is about the prescription itself, say in one plain sentence that it is their prescriber's call, give them the specific question to bring, and keep helping. Over-the-counter actives (retinol, retinal, OTC adapalene, BHA, AHA, benzoyl peroxide, azelaic acid, sunscreen) remain yours exactly as before. ${SHARED_TAIL}${ADVISOR_PRESCRIBER_ROUTE}`,
  },
}

/** The rule's entire line: from HEAD to the end of the line it sits on. */
function ruleLine(src) {
  const start = src.indexOf(HEAD)
  if (start === -1) return null
  const end = src.indexOf('\n', start)
  return src.slice(start, end === -1 ? undefined : end)
}

for (const [name, { src, expected, prefix, next }] of Object.entries(PROMPTS)) {
  test(`${name}: prescription rule appears exactly once`, () => {
    assert.equal(src.split(HEAD).length - 1, 1)
  })

  test(`${name}: the rule's whole line is pinned (nothing added, removed or reworded)`, () => {
    assert.equal(ruleLine(src), expected)
  })

  test(`${name}: the rule sits in the prompt as its own item, not in a comment`, () => {
    const start = src.indexOf(HEAD)
    const lineStart = src.lastIndexOf('\n', start) + 1
    assert.equal(src.slice(lineStart, start).trimStart(), prefix)
  })

  test(`${name}: nothing is inserted after the rule (closed-world neighbour)`, () => {
    const start = src.indexOf(HEAD)
    const after = src.slice(src.indexOf('\n', start) + 1).split('\n').find((l) => l.trim()) ?? ''
    assert.match(after.trim(), next, `unexpected line after the rule: "${after.slice(0, 120)}"`)
  })
}

// ---- AI disclosure ---------------------------------------------------------


test('widget header discloses AI in rendered JSX, not a comment', () => {
  const w = visible(read('src', 'components', 'widget', 'TryYuriSection.tsx'))
  assert.match(w, />Your honest AI K-beauty advisor\. Ask me anything\.</)
  assert.ok(!/friend in Seoul/.test(w), 'header must not read like a person in Seoul')
})

test('widget greeting discloses AI at the start of the session', () => {
  const w = visible(read('src', 'components', 'widget', 'TryYuriSection.tsx'))
  assert.match(w, /\n\s*Hey, I&apos;m Yuri, an AI K-beauty advisor who&apos;s honest to a fault\./)
})

test('onboarding header discloses AI', () => {
  assert.match(visible(read('src', 'app', '(app)', 'onboarding', 'page.tsx')), />Your AI K-beauty advisor</)
})

test('authenticated /yuri header discloses AI', () => {
  assert.match(visible(read('src', 'app', '(app)', 'yuri', 'page.tsx')), />AI Beauty Advisor</)
})

test('every Yuri email footer says Yuri is AI, and the old unlabeled footer is gone', () => {
  const files = [
    ['src', 'lib', 'email', 'nudge-email.ts'],
    ['src', 'lib', 'email', 'nurture-copy.ts'],
    ['src', 'lib', 'email', 'send.ts'],
    ['src', 'lib', 'proactive', 'lead-reengage.ts'],
    ['scripts', 'send-pending-nudge-emails.ts'],
  ]
  for (const f of files) {
    const s = visible(read(...f))
    assert.match(s, /Yuri is Seoul Sister's AI K-beauty advisor\./, `${f.join('/')} footer must disclose AI`)
    assert.ok(!/your K-beauty intelligence advisor/.test(s), `${f.join('/')} still has the unlabeled footer`)
  }
})

// ---- Person comes before the skin (Nov 3-5 2026) ---------------------------
// One rule, identical on all three surfaces that talk to people. Red-teamed on
// the authed advisor (harmful AND ordinary cases); a drifted copy on one surface
// is how a defense goes missing there (BP44.1-style sibling rule).
test('person-first rule: identical text on advisor, widget and onboarding', () => {
  const RULE_HEAD = '**The person comes before the skin.**'
  const line = (src) => { const i = src.indexOf(RULE_HEAD); if (i === -1) return null; const e = src.indexOf('\n', i); return src.slice(i, e === -1 ? undefined : e).replace(/`$/, '') }
  const a = line(PROMPTS.advisor.src), w = line(PROMPTS.widget.src), o = line(PROMPTS.onboarding.src)
  assert.ok(a, 'advisor is missing the rule')
  assert.equal(w, a, 'widget copy differs from advisor')
  assert.equal(o, a, 'onboarding copy differs from advisor')
  for (const src of [PROMPTS.advisor.src, PROMPTS.widget.src, PROMPTS.onboarding.src]) assert.equal(src.split(RULE_HEAD).length - 1, 1)
  assert.match(a, /ANAD's peer support line, 1-888-375-7767/)
  assert.doesNotMatch(a, /NEDA/, 'NEDA closed its helpline in 2023')
  assert.match(a, /in the same reply/, 'skin help must not be withheld')
  assert.match(a, /This is about harm, not discipline/, 'scope limiter keeps ordinary fasts and peels ordinary')
})

test('widget email gate is skipped right after Yuri gave a crisis line (Nov 5 2026)', () => {
  const route = read('src', 'app', 'api', 'widget', 'chat', 'route.ts')
  const p = read('src', 'lib', 'widget', 'persistence.ts')
  // Reads Yuri's stored reply (never client-sent history, which could be forged).
  assert.match(p, /from\('ss_widget_messages'\)[\s\S]{0,200}ss_widget_sessions!inner\(visitor_id\)/)
  // sessions.visitor_id references the BROWSER visitor id, not the row uuid (a first version passed visitor.id and could never match).
  assert.match(route, /const crisisExempt = gateWouldFire && \(await lastReplyGaveCrisisLine\(parsed\.visitor_id!\)\)/)
  assert.match(route, /if \(gateWouldFire && !crisisExempt\) \{/)
  const re = new RegExp(p.match(/CRISIS_LINE_RE = \/(.+)\/i/)[1], 'i')
  for (const t of ['call or text **988** any time', 'Call 911 now.', "ANAD's peer support line, 1-888-375-7767",
    'Samaritans on 116 123, free, any time', 'call Lifeline on 13 11 14', 'please call 999 now', 'ring 112 straight away', 'call 000 (triple zero)',
    'text HOME to 741741', 'your local crisis centre can help', 'ANAD at 1 (888) 375-7767', 'go to the emergency department', 'Kids Help Phone, 1-800-668-6868',
    'In Korea you can call 1393 any time', 'call 0800 111 0 111 (TelefonSeelsorge)', 'en France, appelez le 3114 or call 3114', 'call 1737 free, any time',
    'Where are you based? I will help you find a local line.', 'I can point you to a local number'])
    assert.ok(re.test(t), t)
  // On a lookup error the gate is skipped once, never shown to someone who may just have been given a crisis line.
  assert.match(p, /crisis-line lookup failed[\s\S]{0,400}widget_crisis_lookup_failed[\s\S]{0,120}\n\s*return true\n/)
  for (const t of ['Use SPF 50 and a 2% BHA.', "I'm 19, oily skin", '9880 reviews', 'about 10,000 reviews', 'this serum costs $9.99', 'a 112-piece set', 'Leave it on 30-60 seconds before rinsing', 'Leave it on 30-60 sec.']) assert.ok(!re.test(t), t)
})

test('Glass Skin history: first score always loaded, local dates, never "none taken" unless looked up (Nov 7 2026)', () => {
  const m = read('src', 'lib', 'yuri', 'memory.ts')
  // A user who uploads 3 angles must not push her baseline out of view.
  assert.match(m, /order\('created_at', \{ ascending: true \}\)\.limit\(1\)/)
  // Local date (profile timezone), not the UTC slice.
  assert.match(m, /const takenDate = gsDate\(takenAt\)/)
  assert.doesNotMatch(m, /const takenDate = takenAt\.slice\(0, 10\)/)
  // "No photos taken yet" only after a successful lookup.
  assert.match(m, /\} else if \(context\.glassSkinKnown\) \{/)
  assert.match(m, /if \(context\.glassSkinKnown && context\.glassSkinHistory\.length > 0\) \{/)
  // Uploads happen outside chat; the record outranks a stale "photo pending" note.
  assert.match(m, /more current than any note in your memory about a photo still being pending/)
})

test('weekly check-ins carry the prescriber and person-first rules, and the guard can block on them (Nov 8 2026)', () => {
  const checkin = read('src', 'lib', 'proactive', 'subscriber-checkin.ts')
  assert.match(checkin, /is their prescriber's call to start, stop, or change/)
  assert.match(checkin, /never a plan to follow up on here/)
  assert.match(checkin, /The person comes before the skin\. If your memory holds a plan that would harm their body/)
  assert.match(checkin, /never mention that plan in a check-in/)
  assert.doesNotMatch(checkin, /If you speak, ask how they're doing/)
  const guard = read('src', 'lib', 'proactive', 'content-guard.ts')
  assert.match(guard, /8\. harmful_followups:/)
  assert.match(guard, /lists 3-8 are all empty/)
  // The key the reader model copies from the JSON template must be the key the enforce loop reads.
  assert.match(guard, /"routine_changes": \[\], "harmful_followups": \[\], "verdict"/)
  assert.match(guard, /for \(const h of v\.harmful_followups \?\? \[\]\) if \(h\?\.trim\(\)\) reasons\.push/)
})
