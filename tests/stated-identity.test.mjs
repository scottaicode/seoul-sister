/**
 * What a member has told Yuri about who they are: gender and exact age.
 *
 * Nov 15 2026: told "I'm in my late 50s", Yuri answered "after menopause...
 * at 57" to a 59-year-old man. Production held the same shape in 9
 * conversations. Executes the real module; wiring is checked by source text,
 * and the behaviour itself is graded by scripts/replay-unstated-body-facts.ts
 * (a model run), because no source test can see what Yuri says.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')
const js = ts.transpileModule(read('src', 'lib', 'yuri', 'stated-identity.ts'), {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const m = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))
const NOW = new Date('2026-11-15T20:00:00Z')

test('closed world: only the three stored genders pass, and nothing is coerced', () => {
  assert.deepEqual([...m.GENDERS], ['woman', 'man', 'nonbinary'])
  for (const g of m.GENDERS) assert.equal(m.cleanGender(g), g)
  for (const bad of ['male', 'female', 'Woman', 'MAN', 'f', 'm', '', ' woman', null, undefined, 1, true, {}, ['man']]) {
    assert.equal(m.cleanGender(bad), null, JSON.stringify(bad))
  }
})

test('an age is a whole number the database accepts, or nothing', () => {
  for (const ok of [13, 18, 59, 110]) assert.equal(m.cleanAgeYears(ok), ok)
  for (const bad of [12, 111, 0, -5, 59.5, '59', null, undefined, NaN, Infinity]) assert.equal(m.cleanAgeYears(bad), null, String(bad))
})

test('the range written for an exact age is one the column accepts, at every boundary', () => {
  const ALLOWED = ['18-24', '25-30', '31-35', '36-40', '41-50', '50+']
  const expected = { 13: null, 17: null, 18: '18-24', 24: '18-24', 25: '25-30', 30: '25-30', 31: '31-35', 35: '31-35', 36: '36-40', 40: '36-40', 41: '41-50', 50: '41-50', 51: '50+', 59: '50+', 110: '50+' }
  for (const [age, range] of Object.entries(expected)) assert.equal(m.ageRangeFor(Number(age)), range, age)
  for (let a = 18; a <= 110; a++) assert.ok(ALLOWED.includes(m.ageRangeFor(a)), String(a))
})

test('the stated date is written once, and only moves when the number changes', () => {
  // First time: number, date and range together (the pairing constraint needs both).
  assert.deepEqual(m.ageWrite(59, null, NOW), { age_years: 59, age_stated_on: '2026-11-15', age_range: '50+' })
  assert.deepEqual(m.ageWrite(59, { age_years: null, age_stated_on: null }, NOW), { age_years: 59, age_stated_on: '2026-11-15', age_range: '50+' })
  // Same number again (setup re-reads the whole chat every message): the date stays.
  assert.deepEqual(m.ageWrite(59, { age_years: 59, age_stated_on: '2026-11-01' }, NOW), { age_range: '50+' })
  // A different number is a new statement.
  assert.deepEqual(m.ageWrite(60, { age_years: 59, age_stated_on: '2026-11-01' }, NOW), { age_years: 60, age_stated_on: '2026-11-15', age_range: '50+' })
  // Under 18 has no range bucket; the age itself is still kept.
  assert.deepEqual(m.ageWrite(15, null, NOW), { age_years: 15, age_stated_on: '2026-11-15' })
  // Nothing usable: nothing written, so a range-only member is left alone.
  for (const none of [null, undefined, 'late 50s', 57.5, 200]) assert.deepEqual(m.ageWrite(none, null, NOW), {})
})

test('Yuri is shown a current age, not the number from years ago', () => {
  assert.equal(m.ageLine({ age_years: 59, age_stated_on: '2026-11-15', age_range: '50+' }, NOW), '- Age: 59 (they told you on 2026-11-15)')
  assert.equal(m.ageLine({ age_years: 59, age_stated_on: '2023-11-01', age_range: '50+' }, NOW), '- Age: about 62 now (they told you 59 on 2023-11-01)')
  // A range is shown as a range, and says it is not a number.
  assert.equal(m.ageLine({ age_range: '50+' }, NOW), '- Age range: 50+ (a range is all that is on file, not a number)')
  assert.equal(m.ageLine({}, NOW), '- Age range: not established')
  // A number with no date is not trusted as current.
  assert.equal(m.ageLine({ age_years: 59, age_range: '50+' }, NOW), '- Age range: 50+ (a range is all that is on file, not a number)')
})

test('closed world: the gender line is one of exactly these four, and the unknown one is a state, not a question', () => {
  assert.equal(m.genderLine('man'), '- Gender: man (their own word for themselves)')
  assert.equal(m.genderLine('woman'), '- Gender: woman (their own word for themselves)')
  assert.equal(m.genderLine('nonbinary'), '- Gender: nonbinary (their own word for themselves)')
  const unknown = '- Gender: they have not said, and nothing else in this profile tells you.'
  for (const none of [null, undefined, '', 'male', 'female']) assert.equal(m.genderLine(none), unknown)
  // The shape that made setup ask: a question, an instruction to ask, or text
  // she could say back to the member as a question.
  assert.doesNotMatch(unknown, /\?|\bask\b|\bconfirm\b|\bfind out\b|\bcheck\b/i)
})

test('setup is told what is missing as facts, marked as possibly one message old', () => {
  const none = m.setupIdentityFacts({ age_range: '50+' })
  assert.equal(none.length, 2)
  assert.match(none[0], /^Their gender: not stated in anything recorded so far\. \(Read before their latest message/)
  assert.match(none[0], /It is not one of the things you are here to collect/)
  assert.equal(none[1], 'Their age: they gave a range, not a number, and the range is all setup needs. (Read before their latest message.)')
  for (const line of none) assert.doesNotMatch(line, /\?|\bask\b/i)
  // Known: nothing is added (the value is already in the setup record she sees).
  assert.deepEqual(m.setupIdentityFacts({ gender: 'man', age_years: 59, age_range: '50+' }), [])
  // No age at all: only the gender line. Age is a required field and is already listed as needed.
  assert.equal(m.setupIdentityFacts({}).length, 1)
})

test('gender is not one of the fields the setup chat collects', () => {
  const setup = read('src', 'lib', 'yuri', 'onboarding.ts')
  const list = setup.slice(setup.indexOf('const ALL_FIELDS = ['), setup.indexOf('] as const', setup.indexOf('const ALL_FIELDS = [')))
  assert.doesNotMatch(list, /'gender'|'sex'|'age_years'/, 'a listed field becomes a question in most setup chats')
  assert.ok(setup.includes('  statusLines.push(...setupIdentityFacts(extractedSoFar))\n'))
})

test('dated facts keep the day they were first said, and are never duplicated or dropped', () => {
  const day = (d) => new Date(`${d}T12:00:00Z`)
  // First mention: dated today, in the member's words.
  assert.deepEqual(m.mergeDatedFacts(null, ['pregnant'], day('2026-11-15')), ['pregnant (said 2026-11-15)'])
  // Said again five days later, or re-read from the whole setup chat: the date does not move.
  assert.deepEqual(m.mergeDatedFacts(['pregnant (said 2026-11-15)'], ['Pregnant'], day('2026-11-20')), ['pregnant (said 2026-11-15)'])
  // A date the model added itself is ignored; the code's date is the only one.
  assert.deepEqual(m.mergeDatedFacts([], ['on HRT (said 2020-01-01)'], day('2026-11-15')), ['on HRT (said 2026-11-15)'])
  // A new fact joins; an old one stays, with its old date showing its age.
  assert.deepEqual(
    m.mergeDatedFacts(['pregnant (said 2026-03-01)', 'no rosacea'], ['breastfeeding'], day('2026-11-15')),
    ['pregnant (said 2026-03-01)', 'breastfeeding (said 2026-11-15)']
  )
  // Nothing stated: stored dated facts survive untouched (a setup re-run must not delete them).
  assert.deepEqual(m.mergeDatedFacts(['pregnant (said 2026-03-01)'], [], day('2026-11-15')), ['pregnant (said 2026-03-01)'])
  assert.deepEqual(m.mergeDatedFacts(undefined, undefined, day('2026-11-15')), [])
  // Junk is dropped and long text is bounded.
  assert.deepEqual(m.mergeDatedFacts([], ['', '   ', 42, null], day('2026-11-15')), [])
  assert.ok(m.mergeDatedFacts([], ['x'.repeat(900)], day('2026-11-15'))[0].length < 230)
  // Standing facts are the undated ones.
  assert.deepEqual(m.standingFacts(['no rosacea', 'pregnant (said 2026-03-01)', '', 7]), ['no rosacea'])
})

test('both writers clean the values, read what is stored first, and check the write', () => {
  const setup = read('src', 'lib', 'yuri', 'onboarding.ts')
  // A re-opened, finished setup only fills gaps; a live setup chat may correct itself.
  assert.ok(setup.includes("  const fillOnly = opts?.reopened === true\n"))
  assert.ok(setup.includes("      if (statedGender && (!fillOnly || !cleanGender(stored?.gender))) profileData.gender = statedGender\n"))
  assert.ok(setup.includes("      if (statedAge !== null && (!fillOnly || cleanAgeYears(stored?.age_years) === null)) {\n        Object.assign(profileData, ageWrite(statedAge, stored, new Date()))\n"))
  assert.ok(setup.includes("      if (fillOnly && stored?.age_range) delete profileData.age_range\n"))
  assert.ok(setup.includes("        fillOnly && storedStanding.length\n          ? storedStanding\n"))
  // Only the re-open path asks for fill-only; the two live paths do not.
  const route = read('src', 'app', 'api', 'yuri', 'onboarding', 'route.ts')
  assert.equal(route.split('finalizeOnboardingProfile(').length - 1, 3)
  assert.equal(route.split('{ reopened: true }').length - 1, 1)
  assert.ok(route.includes("if (progress.onboarding_status === 'completed') {"))
  assert.ok(setup.includes('      const dated = mergeDatedFacts(stored?.medical_history, hormonal, new Date())\n'))
  // A failed read of what is stored writes none of the three, medical history included.
  assert.ok(setup.includes('      delete profileData.medical_history\n'))
  assert.ok(setup.includes('const { error: profileWriteError } = await db'))
  const advisor = read('src', 'lib', 'yuri', 'advisor.ts')
  assert.ok(advisor.includes('      const statedGender = cleanGender(pu.gender)\n      if (statedGender) updates.gender = statedGender\n'))
  assert.ok(advisor.includes('Object.assign(updates, ageWrite(pu.age_years, stored, new Date()))'))
  assert.ok(advisor.includes('mergeDatedFacts(stored?.medical_history, newHormonal, new Date())'))
  assert.ok(advisor.includes('const { error: updateError } = await db'))
  // The updater sees the END of Yuri's previous message, where her question is.
  assert.ok(advisor.includes("${(precedingAssistant ?? '').slice(-600) || '(none)'}"))
  // Nothing writes these columns except through the cleaners, under any spelling.
  for (const [name, src] of [['onboarding', setup], ['advisor', advisor]]) {
    const genderWrites = [...src.matchAll(/(?:\.gender|\['gender'\]|\["gender"\])\s*=(?!=)\s*([^\n;]+)/g)].map((x) => x[1].trim())
    assert.ok(genderWrites.length >= 1, `${name} never writes gender`)
    for (const rhs of genderWrites) assert.equal(rhs, 'statedGender', `${name} writes gender unchecked: ${rhs}`)
    assert.doesNotMatch(src, /age_years['"\]]*\s*[:=]\s*(extracted|pu)\b/, `${name} writes age unchecked`)
    assert.doesNotMatch(src, /\.\.\.(pu|extracted)\b(?!\.)/, `${name} spreads unchecked extractor output into a write`)
    // The model is never asked for a date: the code adds it.
    assert.doesNotMatch(src, /\(said \$\{/, `${name} asks the model to write a date`)
  }
})

test('both extractors take gender only from a sentence about the person\'s own gender, and never store a denial', () => {
  for (const f of ['onboarding.ts', 'advisor.ts']) {
    const src = read('src', 'lib', 'yuri', f)
    assert.match(src, /gender: "woman"[^\n]*ONLY from a sentence the user wrote about themselves whose content is their gender/, f)
    assert.match(src, /Anything from which gender would have to be worked out is not that, however certain it seems/, f)
    assert.match(src, /A denial sets nothing/, f)
    assert.match(src, /never record that someone is NOT pregnant, NOT breastfeeding or NOT trying to conceive/, f)
    assert.match(src, /Return each with NO date; the date is added for you/, f)
    // "55F" read as a gender also reads as a temperature in a climate chat.
    assert.doesNotMatch(src, /"55F"/, f)
  }
})

test('neither prompt carries a pregnancy check yet (it needs a verified clinical basis first)', () => {
  // Removed before shipping on two reviews: it named retinoids as the ONE
  // reason while the Sensitivity Guardian lists three, its breastfeeding claim
  // was unverified, and "where that could apply" cannot be judged without
  // guessing a gender. Stated pregnancy is still saved and shown to Yuri.
  for (const f of ['onboarding.ts', 'advisor.ts']) {
    assert.doesNotMatch(read('src', 'lib', 'yuri', f), /Pregnancy and breastfeeding matter for one specific reason/, f)
  }
})

test('product search no longer tells Yuri the member is a woman', () => {
  const tools = read('src', 'lib', 'yuri', 'tools.ts')
  const at = tools.indexOf('include_mens: {')
  const desc = tools.slice(at, tools.indexOf('},', at))
  assert.match(desc, /Set true when the person has told you they are a man/)
  assert.doesNotMatch(desc, /audience is women|almost never/)
})
