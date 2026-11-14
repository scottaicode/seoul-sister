/**
 * Four things made true on Nov 14 2026. Each test RUNS the real function where
 * there is one; the first version of this file only matched source text, and a
 * second-model review showed six wrong versions that passed it.
 *
 * 1. "Without fragrance" in Yuri's search is a class of ingredients, not a word.
 * 2. Public pages publish no percentage for how "effective" an ingredient is,
 *    and the stored guides' "Seoul Sister users report 79%" sentences are
 *    dropped where the text is read.
 * 3. Only the stronger pairings are stated as common uses; the low estimates
 *    were the cautions and read as endorsements without their number.
 * 4. Learning notes written from a member's conversations are deleted with
 *    them, and the privacy page says what those notes are.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const load = (file, names) => {
  const js = ts.transpileModule(read(file).replace(/^export /gm, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  return new Function(`${js}; return { ${names.join(', ')} }`)()
}

const F = load('src/lib/yuri/fragrance.ts', ['isFragranceTerm', 'nameSaysFragrance', 'ingredientIsFragrance', 'rawInciHasFragrance', 'exclusionVerdict', 'splitExclusionTerms', 'FRAGRANCE_FILTER_NOTE'])
const C = load('src/lib/content/unmeasured-claims.ts', ['isUnmeasuredClaim', 'withoutUnmeasuredClaims', 'sentencesOf', 'cleanGuide', 'commonUses', 'COMMON_USE_FLOOR'])

test('the ways a person says "no fragrance" are recognised, and other ingredients are not', () => {
  for (const yes of ['fragrance', 'Fragrance', 'fragrance-free', 'fragrance free', 'parfum', 'Perfume', 'scent', 'added fragrance', 'synthetic fragrance', ' fragrances ',
    'Fragrance (Parfum)', 'fragrance/parfum', 'fragrance.', '"fragrance"', 'no fragrance', 'unscented', 'no scent', 'scented', 'fragrance free products',
    'fragrance allergens', 'perfume oil', 'fragranced']) {
    assert.equal(F.isFragranceTerm(yes), true, yes)
  }
  for (const no of ['alcohol', 'alcohol-free', 'essential oils', 'linalool', 'niacinamide', 'fragrant plant extract', 'free', 'no added products', 'all products', 'oil', '']) {
    assert.equal(F.isFragranceTerm(no), false, no)
  }
  // One term that holds several requests is read part by part.
  assert.deepEqual(F.splitExclusionTerms(['fragrance, alcohol', 'perfumes and dyes', 'Fragrance (Parfum)', 'sulfates/parabens', ' ']),
    ['fragrance', 'alcohol', 'perfumes', 'dyes', 'Fragrance (Parfum)', 'sulfates', 'parabens'])
})

test('an ingredient counts as fragrance by the table flag or by its name, unless the name says it was left out', () => {
  assert.equal(F.ingredientIsFragrance('linalool', true), true)
  assert.equal(F.ingredientIsFragrance('linalool', false), false, 'an allergen is known only through the flag; no list is kept in code')
  for (const name of ['parfum/fragrance', 'fragrance[madecell cream] water', 'flavor', 'aroma', 'chamomilla recutita (matricaria) flower oil', 'citrus aurantium dulcis peel oil', 'melaleuca alternifolia (tea tree) leaf oil (10ppm)', 'lavender essential oil']) {
    assert.equal(F.ingredientIsFragrance(name, false), true, name)
  }
  for (const name of ['simmondsia chinensis (jojoba) seed oil', 'rosa canina fruit oil', 'niacinamide', 'aromatic hydrocarbon resin', 'glycerin']) {
    assert.equal(F.ingredientIsFragrance(name, false), false, name)
  }
  // Twelve sheet masks were dropped on this row alone, and its flag is set.
  assert.equal(F.ingredientIsFragrance('synthetic fragrance and allergens (excluded from final process)', true), false)
  assert.equal(F.ingredientIsFragrance('fragrance (not added in the final process)', true), false)
  // ...but a parfum that is only "free of" some allergens is still parfum.
  assert.equal(F.ingredientIsFragrance('parfum (free of 26 allergens)', false), true)
  assert.equal(F.ingredientIsFragrance('fragrance without phthalates', true), true)
})

test('the exclusion decision, run on every case that matters', () => {
  const v = F.exclusionVerdict
  const scented = { names: ['water', 'glycerin', 'linalool'], hasFragrance: true }
  const plain = { names: ['water', 'glycerin', 'niacinamide'], hasFragrance: false }
  assert.equal(v(scented, [], true), 'drop')
  assert.equal(v(plain, [], true), 'keep')
  assert.equal(v(scented, [], false), 'keep', 'fragrance is only excluded when asked')
  assert.equal(v(plain, ['niacinamide'], false), 'drop')
  assert.equal(v(plain, ['alcohol'], true), 'keep')
  assert.equal(v(scented, ['alcohol'], false), 'keep')
  // No linked ingredients: raw text is read; with nothing to read it is never "without X".
  assert.equal(v({ names: [], hasFragrance: false, raw: 'water, glycerin, parfum' }, [], true), 'drop')
  assert.equal(v({ names: [], hasFragrance: false, raw: 'water, glycerin, limonene' }, [], true, ['limonene']), 'drop')
  assert.equal(v({ names: [], hasFragrance: false, raw: 'water, glycerin, limonene' }, [], true, []), 'keep')
  assert.equal(v({ names: [], hasFragrance: false, raw: 'water, glycerin, alcohol denat' }, ['alcohol'], false), 'drop')
  assert.equal(v({ names: [], hasFragrance: false, raw: 'water, soybean oil' }, [], true, ['oil']), 'keep', 'a flagged name under 5 characters is not used as a substring')
  assert.equal(v({ names: [], hasFragrance: false, raw: null }, [], true), 'unchecked')
  assert.equal(v({ names: [], hasFragrance: false }, ['alcohol'], false), 'unchecked')
})

test('the search calls that decision, and nothing between it and the result can undo it', () => {
  const tools = read('src/lib/yuri/tools.ts')
  assert.match(tools, /\.select\('product_id, ingredient:ss_ingredients\(name_inci, name_en, is_fragrance\)'\)/)
  assert.match(tools, /if \(ingredientIsFragrance\(name, ing\.is_fragrance === true\)\) hasFragrance\.add\(pid\)/)
  // hasFragrance is written in one place and read in one place; it is never cleared or reassigned.
  assert.deepEqual((code(tools).match(/\bhasFragrance\.[a-z]+\(/g) ?? []).sort(), ['hasFragrance.add(', 'hasFragrance.has('])
  const a = tools.indexOf('if (excludeIngredients?.length && !linkError) {')
  const block = code(tools.slice(a, tools.indexOf('\n  }\n', a)))
  // The whole filter callback, exactly: one call to the tested function.
  const cb = block.slice(block.indexOf('filtered = filtered.filter('), block.indexOf('if (wantsNoFragrance) ingredientFilterNotes.push'))
  assert.equal(cb.replace(/\s+/g, ' ').trim(),
    "filtered = filtered.filter((p: Record<string, unknown>) => { const id = p.id as string const verdict = exclusionVerdict( { names: productIngredientMap.get(id) || [], hasFragrance: hasFragrance.has(id), raw: rawInciById.get(id) }, otherTerms, wantsNoFragrance, flaggedNames ) if (verdict === 'unchecked') uncheckable++ return verdict === 'keep' })")
  assert.match(block, /const exclusionTerms = splitExclusionTerms\(excludeIngredients\)\s*const wantsNoFragrance = exclusionTerms\.some\(isFragranceTerm\)\s*const otherTerms = exclusionTerms\.filter\(\(e\) => !isFragranceTerm\(e\)\)\.map\(\(e\) => e\.toLowerCase\(\)\)/)
  // The flagged list is count-checked, and a failure or a short page is said.
  assert.match(block, /\.select\('name_inci', \{ count: 'exact' \}\)/)
  assert.match(block, /flaggedCount > \(flagged\?\.length \?\? 0\)/)
  assert.equal((block.match(/ingredientFilterNotes\.push\(/g) ?? []).length, 4)
  // What she is told covers only what the rule covers: an essential oil named only by its plant is not claimed.
  assert.equal(F.FRAGRANCE_FILTER_NOTE, 'For "fragrance", products were left out if they list fragrance, parfum, flavor or aroma, a plant oil named for its peel, flower, leaf or wood, or any ingredient our database marks as a fragrance component (linalool and limonene among them).')
  assert.match(tools, /description: 'Must NOT contain these ingredients\. "fragrance" is treated as a class: it also leaves out parfum and every ingredient our database marks as a fragrance component, not only the word\.',/)
})

test('sentences that pass an estimate off as measured are dropped; ordinary statements are kept', () => {
  const drop = [
    'Seoul Sister users with sensitive skin report 79% effectiveness for hyperpigmentation.',
    'Seoul Sister data shows 92% effectiveness for redness, with most improvement reported after one month.',
    'Based on user reports showing 84-88% effectiveness across skin types, most people notice improvement within 2-4 weeks.',
    'With 96 products on Seoul Sister featuring retinol and community effectiveness ratings as high as 87% for anti-aging concerns, this ingredient has proven its value.',
    'Sensitive skin shows the lowest tolerance for retinol, with 62% effectiveness and higher risk of irritation.',
    "According to Seoul Sister's effectiveness data, salicylic acid scores 86% effective for acne.",
    'Seoul Sister community data shows 50% effectiveness for dry skin dealing with dullness, based on 10 user reports.',
    'It is rated 5.0/5 by Seoul Sister users.',
    'Seoul Sister data shows vitamin C is most effective for normal skin (84%) and least effective for dry skin (50%).',
    'Sensitive skin (68% effectiveness) may also experience irritation.',
    "In Seoul Sister's database of 13 products, user ratings average exceptionally high (4.8-5.0/5).",
    'Centella calms redness within a month according to user reports.',
  ]
  const keep = [
    'While avobenzone degrades rapidly under UV exposure (losing up to 50% effectiveness within an hour), ecamsule maintains its protective capacity.',
    'Studies suggest it can be 30% more effective at reducing wrinkle depth.',
    'Unlike L-ascorbic acid which requires 15-20% to be effective, ethyl ascorbic acid works at much lower percentages.',
    'Most users report visible calming effects within 3-7 days of consistent use.',
    'Niacinamide at 5% is well tolerated by most skin types.',
    'You can read more at https://www.seoulsister.com/ingredients/niacinamide and decide.',
    // Counting products in our catalog, and citing a study, are not claims about what we measured.
    "Seoul Sister data shows it's featured in 19 K-beauty products.",
    "While you won't find many eye-specific products in the Seoul Sister data, mists are an option.",
    'Approximately 1-2% of users may develop reactions.',
    'In one trial, 60% of users saw improvement.',
    'Seoul Sister users can scan a label to check.',
  ]
  for (const s of drop) assert.equal(C.isUnmeasuredClaim(s), true, s)
  for (const s of keep) assert.equal(C.isUnmeasuredClaim(s), false, s)
  // Paragraphs survive, link dots are not sentence ends, and nothing else is touched.
  const text = `${keep[4]} ${drop[0]} ${keep[5]}\n\n${drop[1]}\n\n${keep[3]}`
  assert.equal(C.withoutUnmeasuredClaims(text), `${keep[4]} ${keep[5]}\n\n${keep[3]}`)
  assert.equal(C.withoutUnmeasuredClaims(''), '')
  assert.equal(C.withoutUnmeasuredClaims(null), '')
  // An abbreviation's full stop is not a sentence end. Splitting there left
  // "9 NAD Bio Lifting-sil Essence..." and "Jart+ Cicapair..." on live pages.
  assert.deepEqual(C.sentencesOf("It is in Numbuzin's No. 9 NAD Bio Lifting-sil Essence (4.9/5). Try Dr. Jart+ Cicapair too. Use gentle actives, e.g. Centella. Done."),
    ["It is in Numbuzin's No. 9 NAD Bio Lifting-sil Essence (4.9/5).", 'Try Dr. Jart+ Cicapair too.', 'Use gentle actives, e.g. Centella.', 'Done.'])
  const brand = "Seoul Sister data shows 90% effectiveness for redness. It is in Numbuzin's No. 9 Essence and Dr. Jart+ Cicapair."
  assert.equal(C.withoutUnmeasuredClaims(brand), "It is in Numbuzin's No. 9 Essence and Dr. Jart+ Cicapair.")
})

test('a cleaned guide loses the claims, keeps everything else, and has no empty answers', () => {
  const guide = {
    overview: 'Retinol speeds cell turnover. Seoul Sister data shows 87% effectiveness for anti-aging.',
    how_it_works: 'It binds retinoid receptors.',
    skin_types: { normal: 'Well tolerated.', sensitive: 'Seoul Sister users report 62% effectiveness for anti-aging.' },
    usage_tips: ['Start twice a week.', 'Seoul Sister data shows 80% effectiveness for acne.'],
    faq: [
      { question: 'Is it safe?', answer: 'Yes, at low strengths.' },
      { question: 'How well does it work?', answer: 'Seoul Sister users report 87% effectiveness for anti-aging.' },
    ],
    word_count: 900,
  }
  assert.deepEqual(C.cleanGuide(guide), {
    overview: 'Retinol speeds cell turnover.',
    how_it_works: 'It binds retinoid receptors.',
    skin_types: { normal: 'Well tolerated.' },
    usage_tips: ['Start twice a week.'],
    faq: [{ question: 'Is it safe?', answer: 'Yes, at low strengths.' }],
    word_count: 900,
  })
  assert.equal(C.cleanGuide(null), null)
  // CLOSED WORLD: every file under src that reads the stored guide's TEXT is one of these three, and each
  // read goes through the filter. (The others only test that a guide exists.)
  const readers = ['src/app/api/admin/ingredients/context/route.ts', 'src/app/ingredients/[slug]/page.tsx', 'src/lib/yuri/tools.ts']
  const walk = (dir) => readdirSync(dir).flatMap((f) => { const p = join(dir, f); return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : [] })
  const textReaders = walk(join(ROOT, 'src')).filter((f) => /\brich_content\b(?!_)\s*(as\b|\)|\?\.|\.[a-z])|\.rich_content\b(?!_)/.test(code(readFileSync(f, 'utf8')).replace(/\.not\('[a-z.]*rich_content', 'is', null\)/g, '').replace(/r\.rich_content \? 1 : 0/g, '').replace(/if \(ing\.rich_content\) \{/g, '')))
    .map((f) => relative(ROOT, f)).filter((f) => f !== 'src/lib/content/unmeasured-claims.ts').sort()
  assert.deepEqual(textReaders, readers)
  assert.match(code(read(readers[0])), /const rc = cleanGuide\(ing\.rich_content as Record<string, unknown> \| null\) as Record<string, unknown> \| null/)
  const page = code(read('src/app/ingredients/[slug]/page.tsx'))
  assert.deepEqual(page.match(/[^\n]*ingredient\.rich_content\b(?!_)[^\n]*/g).map((l) => l.trim()),
    ['const rc = cleanGuide(ingredient.rich_content)', 'const richContent = cleanGuide(ingredient.rich_content)'])
  const tools = code(read('src/lib/yuri/tools.ts'))
  assert.match(tools, /const rc = \(cleanGuide\(ing\.rich_content as Record<string, unknown>\) \?\? \{\}\) as Record<string, unknown>/)
  assert.match(tools, /entry\.overview = withoutUnmeasuredClaims\(rc\.overview as string\)\.slice\(0, 200\)/)
})

test('only the stronger pairings are stated as common uses', () => {
  const rows = [
    { name: 'niacinamide/oily/acne', effectiveness_score: 0.82 },
    { name: 'retinol/sensitive/anti-aging', effectiveness_score: 0.62 },
    { name: 'tea tree/sensitive/acne', effectiveness_score: 0.58 },
    { name: 'vitamin c/sensitive/hyperpigmentation', effectiveness_score: 0.68 },
    { name: 'niacinamide/sensitive/redness', effectiveness_score: 0.72 },
    { name: 'floor', effectiveness_score: 0.7 },
    { name: 'broken', effectiveness_score: undefined },
  ]
  // The four cautions (0.58, 0.62, 0.65, 0.68, all for sensitive skin) sit below it; ordinary guidance sits above.
  assert.equal(C.COMMON_USE_FLOOR, 0.7)
  assert.deepEqual(C.commonUses(rows).map((r) => r.name), ['niacinamide/oily/acne', 'niacinamide/sensitive/redness', 'floor'])
  assert.deepEqual(C.commonUses(null), [])
  assert.match(read('src/app/ingredients/[slug]/page.tsx'), /const effectiveness = commonUses\(\(effectivenessRes\.data \|\| \[\]\) as EffectivenessRow\[\]\)/)
  assert.match(read('src/app/products/[id]/page.tsx'), /const effectivenessData = commonUses\(\(effectivenessRes\.data \|\| \[\]\) as Array</)
  assert.match(read('src/app/api/ingredients/[id]/enrichment/route.ts'), /\.gte\('effectiveness_score', COMMON_USE_FLOOR\)/)
})

test('CLOSED WORLD: on the public pages the estimate is read for ordering and the floor only, never printed', () => {
  for (const f of ['src/app/products/[id]/page.tsx', 'src/app/ingredients/[slug]/page.tsx', 'src/components/ingredients/IngredientEnrichmentSection.tsx']) {
    const c = code(read(f))
    // EVERY mention of the estimate's columns, under any alias, on a line that is not a fetch or a type.
    const uses = c.split('\n').filter((l) => /effectiveness_score|sample_size|\b(score|pct|percent)\b/i.test(l)).map((l) => l.trim())
    const allowed = [
      /^\.select\('(ingredient_id, )?skin_type, concern, effectiveness_score, sample_size'\)$/, /^\.order\('effectiveness_score', \{ ascending: false \}\),?$/,
      /^\.gte\('sample_size', 5\)$/, /^(effectiveness_score|sample_size|score): number;?$/,
      /^existing\.push\(\{ skin_type: row\.skin_type, concern: row\.concern, score: row\.effectiveness_score, sample_size: row\.sample_size \}\)$/,
      /^const effectivenessMap = new Map<string, Array<\{ skin_type: string; concern: string; score: number; sample_size: number \}>>\(\)$/,
      /safety_rating|comedogenic|compatibility score|rating_avg|"@type"|'@type'/,
    ]
    assert.deepEqual(uses.filter((l) => !allowed.some((r) => r.test(l))), [], `${f} prints or computes with the estimate`)
    assert.ok(!/% effective|effectiveness for \$|clinical research|community consensus|data-backed|most often used/i.test(c), `${f} still words it as measured`)
    // No percentage is built from anything on these pages except a price saving or a layout width.
    const pct = (c.match(/[^\n]*\}%[^\n]*/g) ?? []).filter((l) => !/savings|discount|width|w-\[|translate|opacity|ilike/i.test(l))
    assert.deepEqual(pct.map((l) => l.trim()), [], `${f} prints a computed percentage`)
  }
  assert.ok(!/effectiveness data|research-backed effectiveness|skin-type effectiveness/i.test(read('public/llms.txt')))
  assert.ok(!/effectiveness/i.test(code(read('src/app/ingredients/page.tsx'))))
})

test('learning notes go with their source, on account deletion and on deleting one conversation', async () => {
  const { deleteLearningNotesFrom } = load('src/lib/learning/forget.ts', ['deleteLearningNotesFrom'])
  const calls = []
  const db = (fail) => ({ from: (t) => ({ delete: (o) => ({ in: (col, ids) => { calls.push([t, o, col, ids.length]); return Promise.resolve(fail ? { error: { message: 'boom' }, count: null } : { error: null, count: ids.length }) } }) }) })
  const ids = Array.from({ length: 95 }, (_, i) => `conv-${i}`)
  assert.deepEqual(await deleteLearningNotesFrom(db(false), [...ids, ids[0], '', null]), { error: null, deleted: 95 })
  assert.deepEqual(calls, [['ss_learning_patterns', { count: 'exact' }, 'data->>source_id', 40], ['ss_learning_patterns', { count: 'exact' }, 'data->>source_id', 40], ['ss_learning_patterns', { count: 'exact' }, 'data->>source_id', 15]])
  assert.deepEqual(await deleteLearningNotesFrom(db(false), []), { error: null, deleted: 0 })
  assert.deepEqual(await deleteLearningNotesFrom(db(true), ['a']), { error: { message: 'boom' }, deleted: 0 })
  // A failure on a LATER chunk is reported too, with what had already gone, and the count is the database's.
  let n = 0
  const later = { from: () => ({ delete: () => ({ in: (_c, chunk) => Promise.resolve(++n === 2 ? { error: { message: 'second' }, count: null } : { error: null, count: chunk.length - 1 }) }) }) }
  assert.deepEqual(await deleteLearningNotesFrom(later, ids), { error: { message: 'second' }, deleted: 39 })
  // One conversation: the notes go first, and a failure stops the delete rather than leaving them.
  const memory = read('src/lib/yuri/memory.ts')
  const a = memory.indexOf('export async function deleteConversation(')
  const fn = memory.slice(a, memory.indexOf('\n}\n', a))
  const notes = fn.indexOf('await deleteLearningNotesFrom(db, [conversationId])')
  assert.ok(notes > fn.indexOf("throw new Error('Conversation not found')"), 'ownership is checked first')
  assert.ok(notes < fn.indexOf(".from('ss_yuri_messages')"), 'notes are deleted before the messages')
  assert.match(fn, /if \(forgotten\.error\) throw new Error\(/)
  // The account path is pinned, call by call, in tests/account-erasure.test.mjs.
  assert.match(read('tests/account-erasure.test.mjs'), /by\('delete ss_learning_patterns'\)\.map\(\(c\) => c\.filters\), \[\s*\[\['in', 'data->>source_id', \['rev-1'\]\]\],\s*\[\['in', 'data->>source_id', \['conv-1', 'conv-2'\]\]\],/)
  // Terms says the same thing as Privacy.
  const terms = read('src/app/(legal)/terms/page.tsx')
  assert.ok(terms.includes('An automated process reads conversations and reviews and writes short notes about what it finds, as described in the Privacy Policy'))
  assert.ok(!/anonymized community data/.test(terms))
})

test('the privacy page says what the notes are, what they can contain and when they are deleted', () => {
  const privacy = read('src/app/(legal)/privacy/page.tsx')
  const a = privacy.indexOf('4. Learning Notes')
  const section = privacy.slice(a, privacy.indexOf('</section>', a))
  // The whole section, sentence by sentence: deleting or softening any of them fails here.
  for (const sentence of [
    'An automated process reads conversations with Yuri and reviews, and writes short notes about what it finds.',
    'A note is written by AI from one conversation or review',
    'A note does not contain your name, email address or account ID.',
    'It can include what you told Yuri about your skin, your routine and your health history, because that is what it is written from',
    'Each note is linked internally to the conversation or review it came from, and is deleted when you delete that conversation or your account',
  ]) assert.ok(section.includes(sentence), sentence)
  assert.equal((section.match(/<li>/g) ?? []).length, 3)
  assert.ok(privacy.includes('The learning notes written from your conversations and reviews are deleted with them.'))
  // Nothing on the page still claims anonymity for them, or quotes a statistic nobody measured.
  assert.ok(!/fully anonymized|cannot be identified from|cannot be traced back|Anonymized learning contributions|Cross-User Learning/.test(privacy))
  assert.ok(!/\d+% of users|found Product X effective/.test(privacy))
})
