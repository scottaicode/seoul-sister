/**
 * Three clean-ups after the Nov 14 2026 honesty pass.
 *
 * 1. `ss_ingredient_effectiveness` is an EDITORIAL BASELINE: 47 rows seeded
 *    from published research and reset on May 28 2026 (v10.8.20), every one
 *    with a "sample size" of 50 to 70 in an app with 61 profiles. v10.8.20
 *    relabelled the public headings but left Yuri being told "Users with dry
 *    skin report 88% satisfaction ... based on 70 reports" under a heading
 *    that said "From Community Data. Cite the data". Nobody reported that.
 * 2. The Browse page's ingredient controls did nothing from May 22 2026.
 * 3. The outcome grader compared Glass Skin scores made by different scorers.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs'
import { join, dirname, relative } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const walk = (dir) => readdirSync(dir).flatMap((f) => {
  const p = join(dir, f)
  return statSync(p).isDirectory() ? walk(p) : /\.tsx?$/.test(f) ? [p] : []
})

test('Yuri is told the baseline is editorial, in the line and in its heading', () => {
  const memory = read('src/lib/yuri/memory.ts')
  const a = memory.indexOf("type: 'effectiveness',")
  const line = memory.slice(a, memory.indexOf('\n        })', a))
  // Run the template with a real row.
  const tpl = line.slice(line.indexOf('summary: `') + 'summary: '.length).replace(/,\s*$/, '')
  const make = new Function('skinProfile', 'ingredient', 'pct', 'ti', `return ${tpl}`)
  assert.equal(make({ skin_type: 'dry' }, { name_en: 'Ceramide NP', function: 'barrier repair' }, 88, { sample_size: 70, concern: 'dehydration' }),
    'Ceramide NP (barrier repair): editorial estimate 88% for dry skin, dehydration')
  assert.ok(!tpl.includes('sample_size'), 'the seeded "sample size" must not reach Yuri as a number of reports')
  // What it is gets said ONCE, in the heading, so she is not primed to repeat a
  // disclaimer on every line. It claims no source: the seed cites none.
  assert.match(memory, /sections\.push\(`## Reference Data\\nBackground you can draw on\. The \[effectiveness\] lines are Seoul Sister's own editorial estimates, set when the app launched; they are not counts of member reports\.\\n\$\{insightLines\}`\)/)
  for (const f of ['src/lib/yuri/memory.ts', 'src/lib/yuri/tools.ts', 'src/lib/yuri/advisor.ts']) {
    assert.ok(!/published research|clinical research|research-backed|research baseline/i.test(code(read(f))), `${f} claims a research source nobody can point to`)
  }
})

test('CLOSED WORLD: the ingredient guide tool returns three fields per effectiveness row and says what they are once', () => {
  const tools = read('src/lib/yuri/tools.ts')
  const a = tools.indexOf('result.effectiveness = effectivenessRes.data.map(')
  const obj = code(tools.slice(a, tools.indexOf('\n    )', a)))
  assert.deepEqual([...obj.matchAll(/^\s+([a-z_]+):/gm)].map((m) => m[1]), ['skin_type', 'concern', 'score'])
  assert.match(tools, /result\.effectiveness_basis = "Seoul Sister's own editorial estimates, not counts of member reports"\n/)
})

test('SHAPE: nothing a member or Yuri reads presents the baseline as people reporting', () => {
  // A number of "reports"/"users" or an "n=" printed next to effectiveness data,
  // or a sentence saying users/members/the community report or rate something.
  const flat = (l) => l.replace(/\$\{[^}]*\}/g, 'X')
  const SHAPE = /(sample_?[sS]ize\}?\s*(reports|users|reviews|people))|\bX (user |member |community )?reports\b|\(n=X\)|\bX% of (users|members|people|subscribers)\b|\b(loved|rated|trusted|used) by X\b|\b(community|user|member)-(rated|tested|proven)\b|\b(our|the) (users|members|community) (rate|rates|report|reports|love|loves)\b|\bproven for\b|\(n=\{|\b(users|members|people|subscribers|the community)\b[^.`'"\n]{0,40}\b(report|reported|rate|rated|say|found)\b[^.`'"\n]{0,60}\b(satisf|effective|%)|\b(rated|reported|reviewed|voted|proven|loved)\b[^.`'"\n]{0,40}\b(by|from|across|among)\s+(our|the|Seoul Sister'?s?)\s+(community|users|members|subscribers)\b/i
  const hits = []
  // The legal pages are left out on purpose: their example sentences are the
  // owner's to reword (flagged in CHANGELOG v11.61.5).
  for (const dir of ['src/lib/yuri', 'src/lib/intelligence', 'src/lib/scanning', 'src/lib/learning', 'src/components', 'src/app/ingredients', 'src/app/products', 'src/app/(app)', 'src/app/api']) {
    for (const file of walk(join(ROOT, dir))) {
      code(readFileSync(file, 'utf8')).split('\n').forEach((l, i) => { if (SHAPE.test(l) || SHAPE.test(flat(l))) hits.push(`${relative(ROOT, file)}:${i + 1}`) })
    }
  }
  // The ONE place a count of member reports is printed is the one place the
  // number is real: ss_product_effectiveness (single reviews and reactions).
  // src/lib/learning/recommendations.ts is dead code (its only route has no caller).
  assert.deepEqual(hits.filter((h) => !h.startsWith('src/lib/learning/recommendations.ts:')), [])
  const sections = read('src/components/shared/EnrichmentSections.tsx')
  assert.match(sections, /\(\{data\.effectiveness_sample_size\} member \{data\.effectiveness_sample_size === 1 \? 'report' : 'reports'\}\)/)
  assert.match(read('src/lib/scanning/enrich-scan.ts'), /from\('ss_product_effectiveness'\)[\s\S]{0,200}effectiveness_score, sample_size, skin_type/)
  assert.ok(!/research baseline/i.test(code(sections)), 'real member data must not be labelled a baseline')
  assert.ok(!/grows as users contribute/.test(read('src/lib/yuri/advisor.ts')))
})

test('CLOSED WORLD: Browse has search and category, and sends exactly what the server reads', () => {
  assert.ok(!existsSync(join(ROOT, 'src/components/products/IngredientPicker.tsx')))
  const filters = read('src/components/products/ProductFilters.tsx')
  const a = filters.indexOf('interface ProductFiltersProps {')
  assert.deepEqual([...filters.slice(a, filters.indexOf('\n}', a)).matchAll(/^\s+([A-Za-z]+)\??:/gm)].map((m) => m[1]),
    ['query', 'category', 'sortBy', 'showFilters', 'isAuthenticated', 'onQueryChange', 'onCategoryChange', 'onSortChange', 'onToggleFilters'])
  const page = code(read('src/app/(app)/browse/page.tsx'))
  // Every control's state on the page is sent; nothing is kept and dropped.
  assert.deepEqual([...page.matchAll(/params\.set\('([a-z_]+)'/g)].map((m) => m[1]), ['query', 'category', 'page', 'limit'])
  assert.ok(!/ingredient|fragrance|comedogenic/i.test(page.replace(/a particular ingredient|a certain ingredient|ingredient list/g, '')), 'ingredient filter state is back on the page')
  // No link anywhere sends an ingredient filter to a page that does not read one.
  const dead = walk(join(ROOT, 'src')).filter((f) => /include_ingredients=|exclude_ingredients=/.test(code(readFileSync(f, 'utf8')))).map((f) => relative(ROOT, f))
  assert.deepEqual(dead, [])
  // And the server reads those same four (plus brand and price, which the page does not offer).
  const route = read('src/app/api/products/curated/route.ts')
  assert.deepEqual([...route.matchAll(/searchParams\.get\('([a-z_]+)'\)/g)].map((m) => m[1]).filter((v, i, arr) => arr.indexOf(v) === i),
    ['query', 'category', 'brand', 'min_price', 'max_price', 'page', 'limit'])
})

test('the grader does not compare scores made by different scorers', () => {
  const grader = read('src/lib/intelligence/nudge-outcome-grader.ts')
  const a = grader.indexOf('export function scorerVersionOf(')
  const js = ts.transpileModule(grader.slice(a, grader.indexOf('\n}', a) + 2).replace(/^export /, ''), { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const v = new Function(`${js}; return scorerVersionOf`)()
  assert.equal(v({ photo_quality: null }), 1)
  assert.equal(v({ photo_quality: {} }), 1)
  assert.equal(v({ photo_quality: { confidence_modifier: 0.9 } }), 1)
  assert.equal(v({ photo_quality: { scorer_version: 2 } }), 2)
  assert.equal(v({ photo_quality: { scorer_version: 'x' } }), 1)
  // The gate runs before a delta is ever computed, and writes a grade that is excluded from the rate.
  const gate = grader.indexOf('if (scorerVersionOf(baseline) !== scorerVersionOf(followup)) {')
  assert.ok(gate > 0 && gate < grader.indexOf('const delta = followup.overall_score - baseline.overall_score'))
  assert.match(grader.slice(gate, gate + 400), /writeGrade\(db, nudge\.id, 'insufficient_data', null, baseline\.id, followup\.id,/)
  // The scorer writes the version this reads.
  assert.match(read('src/app/api/skin-score/route.ts'), /scorer_version: GLASS_SKIN_SCORER_VERSION/)
})

test('"without X" never includes a product whose ingredients were not checked, and a failed lookup is said', () => {
  const tools = read('src/lib/yuri/tools.ts')
  const a = tools.indexOf('if (excludeIngredients?.length && !linkError) {')
  const block = tools.slice(a, tools.indexOf('\n  }\n', a))
  // No list and no raw INCI: dropped and counted, never passed.
  assert.match(block, /if \(raw\) return !excludeIngredients\.some\(\(exc\) => raw\.includes\(exc\.toLowerCase\(\)\)\)\s*(\/\/[^\n]*\n\s*)*uncheckable\+\+\s*return false/)
  assert.match(block, /if \(uncheckable > 0\) \{\s*ingredientFilterNotes\.push\(/)
  // Run the note builder for 1 and for several.
  const tpl = block.slice(block.indexOf('ingredientFilterNotes.push(`') + 'ingredientFilterNotes.push('.length, block.lastIndexOf('`)') + 1)
  const note = new Function('uncheckable', `return ${tpl}`)
  assert.equal(note(1), '1 matching product was left out because we have no ingredient list for it, so "without" could not be checked.')
  assert.equal(note(3), '3 matching products were left out because we have no ingredient list for them, so "without" could not be checked.')
  // A failed lookup still skips filtering (an empty list would read as "we do not carry this"), but says so.
  assert.match(tools, /if \(linkError\) \{\s*console\.error\([^)]*\)\s*(\/\/[^\n]*\n\s*)*ingredientFilterNotes\.push\('The ingredient lookup failed, so these results are NOT filtered by ingredient\./)
  assert.match(tools, /\.\.\.\(ingredientFilterNotes\.length \? \{ ingredient_filter_notes: ingredientFilterNotes \} : \{\}\),/)
})
