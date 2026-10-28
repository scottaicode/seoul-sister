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

// Line comments go first: a "//" comment can contain "/*" (e.g. "src/lib/email/*").
const visible = (s) => s.replace(/^\s*\/\/.*$/gm, '').replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '')

// `next` is the real neighbouring line today. Pinning it closed-world means any
// sentence inserted after the rule fails, whatever verb it uses.
const PROMPTS = {
  advisor: { src: visible(read('src', 'lib', 'yuri', 'advisor.ts')), expected: FULL, prefix: '6. **', next: /^This builds more trust than any product recommendation could\.$/ },
  widget: { src: visible(read('src', 'app', 'api', 'widget', 'chat', 'route.ts')), expected: FULL, prefix: '**', next: /^Pregnancy and breastfeeding matter for one specific reason/ },
  onboarding: {
    prefix: '- **',
    next: /^- \*\*Referrals land in English \(LOAD-BEARING\)\.\*\*/,
    src: visible(read('src', 'lib', 'yuri', 'onboarding.ts')),
    expected: `${HEAD}** For anything a doctor prescribed them (tretinoin, prescription-strength adapalene, isotretinoin, spironolactone, prescription hydroquinone, a topical antibiotic or steroid), you do not decide to start, stop, or change its dose or how often they use it. Everything around it stays yours, with full confidence: explain how it works, build around it, keep other actives from colliding with it, and tell them what is normal with it. When something they describe goes beyond what is normal with it, that is a call to the prescriber, so send them with the specific question. When the decision is about the prescription itself, say in one plain sentence that it is their prescriber's call, give them the specific question to bring, and keep helping. Over-the-counter actives (retinol, retinal, OTC adapalene, BHA, AHA, benzoyl peroxide, azelaic acid, sunscreen) remain yours exactly as before. ${SHARED_TAIL}`,
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
