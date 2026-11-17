/**
 * Nobody uses a member feature without going through the setup chat
 * (the owner's rule, Nov 17 2026).
 *
 * What happened: creating an account starts the free week, so a new person is
 * a member before setup begins. A stranger tapped "Skip this chat" 23 seconds
 * in, uploaded a photo and had a routine saved with nothing asked about their
 * health. Another member had finished setup after two messages, because
 * "Finish setup" needed only a skin type, a concern and an age range.
 *
 * The rules are EXECUTED here (setup-requirements.ts, the app gate, the server
 * gate). The wiring that cannot be loaded without a database is pinned by
 * text, and the list of gated routes is closed-world: a new member route that
 * checks the subscription and not setup fails this file.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const transpile = (src) => ts.transpileModule(src, { compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 } }).outputText
const dir = mkdtempSync(join(tmpdir(), 'ss-setup-'))
const load = async (name, src) => {
  writeFileSync(join(dir, `${name}.mjs`), transpile(src))
  return import(pathToFileURL(join(dir, `${name}.mjs`)).href)
}
const rules = await load('setup-requirements', read('src/lib/yuri/setup-requirements.ts'))

const COMPLETE = {
  skin_type: 'dry',
  skin_concerns: ['redness'],
  age_range: '50+',
  location_text: 'Sacramento, California',
  sun_history: 'burns first, then tans a little',
  medical_question_answered: true,
  reactions_question_answered: true,
}
const missingKeys = (record) => rules.missingSetupRequirements(record).map((r) => r.key)

test('setup needs seven things, and exactly these seven', () => {
  assert.deepEqual(rules.SETUP_REQUIREMENTS.map((r) => r.key), ['skin_type', 'skin_concerns', 'age', 'where', 'sun', 'medical', 'reactions'])
  assert.deepEqual(missingKeys({}), ['skin_type', 'skin_concerns', 'age', 'where', 'sun', 'medical', 'reactions'])
  assert.deepEqual(missingKeys(null), ['skin_type', 'skin_concerns', 'age', 'where', 'sun', 'medical', 'reactions'])
  assert.deepEqual(missingKeys(COMPLETE), [])
  // Taking any one away leaves exactly that one missing.
  const drop = { skin_type: 'skin_type', skin_concerns: 'skin_concerns', age_range: 'age', location_text: 'where', sun_history: 'sun', medical_question_answered: 'medical', reactions_question_answered: 'reactions' }
  for (const [field, key] of Object.entries(drop)) {
    const record = { ...COMPLETE }
    delete record[field]
    assert.deepEqual(missingKeys(record), [key], `without ${field}`)
  }
})

test('what used to be enough is not: a skin type, a concern and an age range', () => {
  // The whole of the old rule. "Finish setup" appeared on this.
  assert.deepEqual(missingKeys({ skin_type: 'dry', skin_concerns: ['dryness'], age_range: '25-30' }), ['where', 'sun', 'medical', 'reactions'])
})

test('a safety question is met by an ANSWER, whatever it is, and by nothing else', () => {
  // A fact on file is NOT the answer: "I saw a derm for acne once" must not
  // close the medical question with skin cancer and prescriptions never raised.
  assert.deepEqual(missingKeys({ ...COMPLETE, medical_question_answered: undefined, medical_history: ['rosacea'] }), ['medical'])
  assert.deepEqual(missingKeys({ ...COMPLETE, reactions_question_answered: undefined, allergies: ['fragrance'] }), ['reactions'])
  // "None" is recorded as answered with nothing found.
  assert.deepEqual(missingKeys({ ...COMPLETE, medical_history: [], allergies: [] }), [])
  // An empty list alone is "never asked", not "none".
  assert.deepEqual(missingKeys({ ...COMPLETE, medical_question_answered: undefined, medical_history: [] }), ['medical'])
  assert.deepEqual(missingKeys({ ...COMPLETE, reactions_question_answered: undefined, allergies: [] }), ['reactions'])
  // Only `true` counts: not a string, not false, not 1.
  for (const v of [false, 'true', 1, null]) assert.deepEqual(missingKeys({ ...COMPLETE, medical_question_answered: v }), ['medical'])
  // An exact age stands in for a range, and a climate for a place.
  assert.deepEqual(missingKeys({ ...COMPLETE, age_range: undefined, age_years: 60 }), [])
  assert.deepEqual(missingKeys({ ...COMPLETE, location_text: undefined, climate: 'dry' }), [])
})

test('nobody is held for declining: age, place and sun reaction can each be met by a refusal, skin type and a concern cannot', () => {
  const bare = { skin_type: 'dry', skin_concerns: ['redness'], medical_question_answered: true, reactions_question_answered: true }
  assert.deepEqual(missingKeys(bare), ['age', 'where', 'sun'])
  assert.deepEqual(missingKeys({ ...bare, declined_to_say: ['age'] }), ['where', 'sun'])
  assert.deepEqual(missingKeys({ ...bare, declined_to_say: ['age', 'where', 'sun'] }), [])
  // Not a way round the two that cannot be declined, or round the safety questions.
  assert.deepEqual(missingKeys({ declined_to_say: ['skin_type', 'skin_concerns', 'age', 'where', 'sun', 'medical', 'reactions'] }), ['skin_type', 'skin_concerns', 'medical', 'reactions'])
  assert.deepEqual(missingKeys({ ...bare, declined_to_say: 'age' }), ['age', 'where', 'sun'], 'only a list counts')
})

test('who is still in setup: the status decides, and a profile only stands in when there is no status', () => {
  const t = rules.stillInSetup
  // In progress is in setup even with a profile: that was the hole (a skin
  // type on file after one message opened every page).
  assert.equal(t('in_progress', true), true)
  assert.equal(t('in_progress', false), true)
  assert.equal(t('completed', true), false)
  assert.equal(t('completed', false), false)
  assert.equal(t('skipped', false), false, 'rows from before the link was removed are not sent back')
  // No row: members from before setup records were kept have a profile.
  assert.equal(t(null, true), false)
  assert.equal(t(null, false), true)
  // Unreadable is treated as no row: a failed read does not eject a member with a profile.
  assert.equal(t(undefined, true), false)
  assert.equal(t(undefined, false), true)
})

test('the app gate holds a MEMBER in setup too (executed)', async () => {
  const gate = await load('post-sign-in', read('src/lib/auth/post-sign-in.ts').replace("from '@/lib/yuri/setup-requirements'", "from './setup-requirements.mjs'"))
  const g = gate.appGateDestination
  const member = (done) => ({ plan: 'monthly', onboarding_completed: done })
  const free = (done) => ({ plan: 'free', onboarding_completed: done })
  // The case that let a new member out after one message.
  assert.equal(g(member(true), 'in_progress'), '/onboarding')
  assert.equal(g(member(false), 'in_progress'), '/onboarding')
  assert.equal(g(member(false), null), '/onboarding')
  assert.equal(g(member(true), 'completed'), null)
  assert.equal(g(member(true), 'skipped'), null)
  assert.equal(g(member(true), null), null, 'a member from before setup records')
  assert.equal(g(member(true), undefined), null, 'a failed read does not eject a member')
  // Not a member: setup first, then the membership page.
  assert.equal(g(free(true), 'in_progress'), '/onboarding')
  assert.equal(g(free(false), null), '/onboarding')
  assert.equal(g(free(true), 'completed'), '/subscribe')
  assert.equal(g(free(true), 'skipped'), '/subscribe')
  assert.equal(g(null, null), '/onboarding')
})

function fakeDb({ status, profile, fail }) {
  return {
    from(table) {
      const api = {
        select: () => api,
        eq: () => api,
        maybeSingle: () =>
          Promise.resolve(
            fail === table
              ? { data: null, error: { message: 'boom' } }
              : table === 'ss_onboarding_progress'
              ? { data: status === undefined ? null : { onboarding_status: status }, error: null }
              : { data: profile === undefined ? null : { onboarding_completed: profile }, error: null }
          ),
      }
      return api
    },
  }
}
async function serverGate(state) {
  writeFileSync(join(dir, 'supabase.mjs'), 'export let db = null; export const setDb = (d) => { db = d }; export const getServiceClient = () => db')
  writeFileSync(join(dir, 'error-handler.mjs'), 'export class AppError extends Error { constructor(m, s = 500, c) { super(m); this.statusCode = s; this.code = c } }')
  const mod = await load('setup-gate', read('src/lib/yuri/setup-gate.ts').replace("from '@/lib/supabase'", "from './supabase.mjs'").replace("from '@/lib/yuri/setup-requirements'", "from './setup-requirements.mjs'").replace("from '@/lib/utils/error-handler'", "from './error-handler.mjs'"))
  const { setDb } = await import(pathToFileURL(join(dir, 'supabase.mjs')).href)
  setDb(fakeDb(state))
  const realError = console.error
  console.error = () => {}
  try { return await mod.setupRequiredResponse('u1') } finally { console.error = realError }
}

test('the server refuses a member route while setup is unfinished (executed)', async () => {
  const blocked = await serverGate({ status: 'in_progress', profile: true })
  assert.equal(blocked.status, 403)
  assert.deepEqual(await blocked.json(), { error: rules.SETUP_REQUIRED_MESSAGE, code: 'setup_required' })
  assert.equal((await serverGate({ status: undefined, profile: undefined })).status, 403, 'no setup row and no profile: a brand-new account')
  assert.equal((await serverGate({ status: 'in_progress', profile: false })).status, 403)
  assert.equal(await serverGate({ status: 'completed', profile: true }), null)
  assert.equal(await serverGate({ status: 'skipped', profile: true }), null)
  assert.equal(await serverGate({ status: undefined, profile: true }), null, 'a member from before setup records')
  // A read that fails lets a member through: it must not take the product away.
  assert.equal(await serverGate({ status: 'in_progress', profile: true, fail: 'ss_onboarding_progress' }), null)
  assert.equal(await serverGate({ status: 'in_progress', profile: true, fail: 'ss_user_profiles' }), null)
})

function apiRoutes(d = join(root, 'src/app/api')) {
  const out = []
  for (const name of readdirSync(d)) {
    const p = join(d, name)
    if (statSync(p).isDirectory()) out.push(...apiRoutes(p))
    else if (name === 'route.ts') out.push(p)
  }
  return out
}

test('CLOSED WORLD: every route that checks membership also checks setup, straight after', () => {
  const gated = []
  for (const file of apiRoutes()) {
    const src = readFileSync(file, 'utf8')
    if (!/hasActiveSubscription\(/.test(src)) continue
    const rel = file.slice(root.length + 1)
    // The one route that only REPORTS membership (the setup page asks it).
    if (rel === 'src/app/api/me/subscription/route.ts') {
      assert.equal(/setupRequiredResponse|requireSetupFinished/.test(src), false)
      continue
    }
    gated.push(rel)
    const at = src.indexOf('hasActiveSubscription(user.id)')
    assert.ok(at > -1, `${rel} checks the signed-in user's membership`)
    const check = src.indexOf('const setupBlock = await setupRequiredResponse(user.id)\n    if (setupBlock) return setupBlock\n', at)
    assert.ok(check > at, `${rel} checks setup after the membership check`)
    // Nothing reads the request body or does work between the two checks.
    assert.equal(/request\.json\(\)|request\.formData\(\)|messages\.create|\.insert\(|\.update\(/.test(src.slice(at, check)), false, `${rel}: nothing runs between the checks`)
  }
  assert.deepEqual(gated.sort(), [
    'src/app/api/products/curated/[id]/reasoning/route.ts',
    'src/app/api/products/curated/route.ts',
    'src/app/api/scan/counterfeit/route.ts',
    'src/app/api/scan/route.ts',
    'src/app/api/shelf-scan/route.ts',
    'src/app/api/skin-score/route.ts',
    'src/app/api/yuri/chat/route.ts',
  ])
})

test('CLOSED WORLD: every route behind requireAuth checks setup on every handler, except the ones the setup chat itself needs', () => {
  // What a person still in setup must be able to reach: their account,
  // their free week and card, the notice at the top, and deleting the account.
  const NEEDED_IN_SETUP = [
    'src/app/api/account/delete/route.ts',
    'src/app/api/me/nudge/route.ts',
    'src/app/api/me/offer-code/route.ts',
    'src/app/api/me/paywall-reached/route.ts',
    'src/app/api/me/stated-facts/route.ts',
    'src/app/api/me/subscription/route.ts',
    'src/app/api/me/timezone/route.ts',
    'src/app/api/me/trial/route.ts',
    'src/app/api/stripe/add-card/route.ts',
  ]
  // Gated a few lines later, after the membership check (the test above).
  const GATED_WITH_MEMBERSHIP = ['src/app/api/scan/counterfeit/route.ts', 'src/app/api/scan/route.ts', 'src/app/api/shelf-scan/route.ts', 'src/app/api/skin-score/route.ts']
  // Reads the public ingredient encyclopedia for a signed-in reader.
  const PUBLIC_CATALOG = ['src/app/api/ingredients/[id]/enrichment/route.ts']
  const seen = []
  for (const file of apiRoutes()) {
    const src = readFileSync(file, 'utf8')
    const auths = (src.match(/await requireAuth\(request\)/g) ?? []).length
    if (auths === 0) continue
    const rel = file.slice(root.length + 1)
    seen.push(rel)
    const gates = (src.match(/const user = await requireAuth\(request\)\n\s*await requireSetupFinished\(user\.id\)\n/g) ?? []).length
    if (NEEDED_IN_SETUP.includes(rel) || GATED_WITH_MEMBERSHIP.includes(rel) || PUBLIC_CATALOG.includes(rel)) {
      assert.equal(gates, 0, `${rel} is not gated here`)
    } else {
      assert.equal(gates, auths, `${rel}: every handler that signs the user in checks setup on the next line`)
    }
  }
  for (const rel of [...NEEDED_IN_SETUP, ...GATED_WITH_MEMBERSHIP, ...PUBLIC_CATALOG]) assert.ok(seen.includes(rel), `${rel} still exists`)
  assert.equal(seen.length - NEEDED_IN_SETUP.length - GATED_WITH_MEMBERSHIP.length - PUBLIC_CATALOG.length, 18, 'eighteen member data routes are gated')
})

test('the thrown form of the server gate carries the code the app redirects on (executed)', async () => {
  writeFileSync(join(dir, 'supabase.mjs'), 'export let db = null; export const setDb = (d) => { db = d }; export const getServiceClient = () => db')
  writeFileSync(join(dir, 'error-handler.mjs'), 'export class AppError extends Error { constructor(m, s = 500, c) { super(m); this.statusCode = s; this.code = c } }')
  const mod = await load('setup-gate-throw', read('src/lib/yuri/setup-gate.ts').replace("from '@/lib/supabase'", "from './supabase.mjs'").replace("from '@/lib/yuri/setup-requirements'", "from './setup-requirements.mjs'").replace("from '@/lib/utils/error-handler'", "from './error-handler.mjs'"))
  const { setDb } = await import(pathToFileURL(join(dir, 'supabase.mjs')).href)
  setDb(fakeDb({ status: 'in_progress', profile: true }))
  await assert.rejects(() => mod.requireSetupFinished('u1'), (e) => e.statusCode === 403 && e.code === 'setup_required' && e.message === rules.SETUP_REQUIRED_MESSAGE)
  setDb(fakeDb({ status: 'completed', profile: true }))
  await mod.requireSetupFinished('u1')
  assert.ok(read('src/hooks/useYuri.ts').includes("if (err.code === 'setup_required' && typeof window !== 'undefined') window.location.assign('/onboarding')"))
})

test('there is no skip: not on the page, not in the code, and the old action is refused', () => {
  const page = read('src/app/(app)/onboarding/page.tsx')
  for (const gone of ['handleSkip', 'skip_onboarding', 'SkipForward', 'skipSetupLabel', 'Skip this chat']) assert.equal(page.includes(gone), false, `the setup page has no ${gone}`)
  assert.equal(read('src/lib/offers.ts').includes('Skip this chat'), false)
  const lib = read('src/lib/yuri/onboarding.ts')
  assert.equal(/export async function skipOnboarding/.test(lib), false)
  assert.equal(/onboarding_status: 'skipped'/.test(lib), false, 'nothing writes the skipped status any more')
  const route = read('src/app/api/yuri/onboarding/route.ts')
  const skip = route.slice(route.indexOf("if (parsed.action === 'skip_onboarding') {"), route.indexOf("if (parsed.action === 'complete_onboarding') {"))
  assert.ok(skip.includes("code: 'setup_required' }, { status: 400 })"))
  assert.equal(/finalizeOnboardingProfile|\.update\(|\.upsert\(/.test(skip), false, 'the refused action writes nothing')
})

test('setup finishes only when nothing is missing, or when the chat can take no more messages', () => {
  const route = read('src/app/api/yuri/onboarding/route.ts')
  const done = route.slice(route.indexOf("if (parsed.action === 'complete_onboarding') {"), route.indexOf("return Response.json({ error: 'Unknown action' }"))
  assert.ok(done.includes('const atLimit = !checkOnboardingComplete(extracted) && (await setupAtMessageLimit(progress.conversation_id))'))
  assert.ok(done.includes("if (!checkOnboardingComplete(extracted) && !atLimit) {"))
  assert.ok(done.includes("code: 'setup_incomplete' },\n          { status: 400 }"))
  assert.ok(done.indexOf("status: 400") < done.indexOf('await finalizeOnboardingProfile('), 'the refusal comes before anything is written')
  assert.ok(route.includes('return (count ?? 0) >= ONBOARDING_USER_MESSAGE_CAP'))
  assert.ok(/if \(error\) \{\s*console\.error\('\[yuri\/onboarding\] could not count setup messages:', error\.message\)\s*return false/.test(route), 'a failed count is not "at the limit"')
  const lib = read('src/lib/yuri/onboarding.ts')
  assert.ok(lib.includes('if (!checkOnboardingComplete(extracted) && opts?.atLimit !== true) return'))
  assert.ok(lib.includes('const missingRequired = missingSetupRequirements(extracted).map((r) => r.key as string)'), 'one rule decides "complete"')
  assert.equal(/REQUIRED_FIELDS/.test(lib.replace(/\/\/.*$/gm, '')), false, 'the old three-field list is gone')
  const page = read('src/app/(app)/onboarding/page.tsx')
  // The button shows whenever setup can be finished: no second condition can hide it.
  assert.ok(page.includes('{!isStreaming && (isComplete || atLimit) && ('))
  assert.ok(page.includes("if (err.code === 'onboarding_message_cap') setAtLimit(true)"))
  assert.ok(page.includes('if (data.at_limit === true) setAtLimit(true)'))
  // The limit counts the PERSON's messages, and the after-each-message writer uses the same rule.
  assert.match(route, /async function setupAtMessageLimit[\s\S]{0,420}\.eq\('conversation_id', conversationId\)\s*\.eq\('role', 'user'\)/)
  assert.ok(route.includes('if (!conversationId) return false'))
  assert.ok(route.includes('const isComplete = missingRequired.length === 0'))
  // Ending at the limit with a safety question unanswered is written on the record.
  assert.ok(done.includes("if (atLimit && (extracted.medical_question_answered !== true || extracted.reactions_question_answered !== true)) {"))
  assert.ok(done.includes('.update({ skin_profile_data: { ...extracted, safety_followup: true } })'))
})

test('Yuri is told what is still required, in words, and the extractor records an answer as an answer', async () => {
  const lib = read('src/lib/yuri/onboarding.ts')
  assert.ok(lib.includes('const requiredMissing = missingSetupRequirements(extractedSoFar).map((r) => r.label)'))
  assert.ok(lib.includes("Required before setup can finish, still missing: ${requiredMissing.length > 0 ? requiredMissing.join('; ') : 'NONE.'}"))
  assert.ok(lib.includes('- medical_question_answered: true, and only true.'))
  assert.ok(lib.includes('- reactions_question_answered: true, and only true.'))
  // The prompt no longer names the old minimum, and no longer invites skipping a required question.
  assert.equal(lib.includes('at minimum: skin_type + 2 concerns + age_range'), false)
  assert.equal(lib.includes('If they want to skip something, respect that and move on'), false)
  assert.ok(lib.includes(`An answer of "none" is an answer. So is "I'd rather not say", for those three and for their age and where they live`))
  assert.ok(lib.includes('One question at a time still holds'))
  assert.equal(lib.includes('Two or three of the seven fit in one message'), false)
  // The flags are for a reply to the question, never for something mentioned in passing.
  assert.ok(lib.includes('A fact the user mentioned without being asked does not set it'))
  assert.ok(lib.includes('A reaction mentioned without being asked does not set it.'))
  assert.equal(/Also set it when they volunteered/.test(lib), false)
  assert.ok(lib.includes('- declined_to_say: array, any of "age", "where", "sun".'))
  // A question answered "none" is not shown as still needed.
  assert.ok(lib.includes("...(extractedSoFar.medical_question_answered === true ? ['medical_history'] : []),"))
  // Every label reads as something not yet learned (no order to Yuri inside it).
  for (const r of rules.SETUP_REQUIREMENTS) assert.equal(/\b(must|always|never|ask them)\b/i.test(r.label), false, r.key)
})

test('only a member whose setup record is MARKED is asked first in the member chat, and only until they answer', () => {
  const mem = read('src/lib/yuri/memory.ts')
  const a = mem.indexOf('const safety = context.setupSafety')
  const block = mem.slice(a, mem.indexOf("sections.push(`## User's Skin Profile\\nNot yet created.", a))
  // The mark decides. Without it nothing is asked on this account's behalf:
  // the first version rendered for six of nine paid accounts.
  assert.ok(block.includes('const askMedical = safety?.followUp === true && !safety.medicalAnswered'))
  assert.ok(block.includes('const askReactions = safety?.followUp === true && !safety.reactionsAnswered && !(p.allergies?.length)'))
  assert.ok(block.indexOf('if (askMedical || askReactions) {') < block.indexOf('} else if (safety?.medicalAnswered) {'))
  assert.ok(block.indexOf('} else if (safety?.medicalAnswered) {') < block.indexOf('## Medical History (not on file)'))
  assert.ok(block.includes('ask it before you name a new product or save or change a routine'))
  assert.ok(block.includes('ahead of the routine-build instruction too'))
  assert.ok(block.includes('If they have already told you in a conversation you can see, that is their answer'))
  // Nothing it says is a claim about what happened to this member before.
  for (const gone of ['every member is asked in setup', 'Nothing you have recommended to them so far', 'reached the member chat without being asked']) assert.equal(block.includes(gone), false, gone)
  assert.deepEqual(rules.parseSetupSafety({ medical_question_answered: true }), { medicalAnswered: true, reactionsAnswered: false, followUp: false })
  assert.deepEqual(rules.parseSetupSafety({ safety_followup: true }), { medicalAnswered: false, reactionsAnswered: false, followUp: true })
  // No setup row, an empty one, or junk: not marked, so no note (a member with no row could never clear it).
  for (const record of [null, undefined, {}, { safety_followup: 'true' }, { safety_followup: 1 }]) assert.equal(rules.parseSetupSafety(record).followUp, false)
  assert.ok(mem.includes("return { shelf: null, safety: null }"), 'a failed read is unknown, not marked')
  // The answer given in the member chat is written where that block reads it.
  const adv = read('src/lib/yuri/advisor.ts')
  assert.ok(adv.includes("const answeredMedical = parsed.profile_updates.medical_question_answered === true"))
  assert.ok(adv.includes("await db.from('ss_onboarding_progress').update({ skin_profile_data: merged }).eq('user_id', userId)"))
  assert.ok(adv.includes('...((row.skin_profile_data as Record<string, unknown> | null) ?? {}),'), 'the rest of the setup record is kept')
})
