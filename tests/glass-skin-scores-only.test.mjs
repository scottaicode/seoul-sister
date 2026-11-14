/**
 * Glass Skin scores and describes; the Dupe Finder lists overlap and price.
 * Neither advises (Nov 14 2026). Same class as Shelf Scan (v11.61.0): a
 * one-shot model call that saw one photo or one product name, and none of what
 * Yuri and the member have worked out, was telling members what to do.
 */
import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, existsSync, readdirSync } from 'node:fs'
import { createHash } from 'node:crypto'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import ts from 'typescript'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(ROOT, p), 'utf8')
const code = (s) => s.replace(/\{\/\*[\s\S]*?\*\/\}/g, '').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')
const GLASS_PROMPT_FINGERPRINT = 'f5166d058e05ee9cbd4bdae4a35eb52b9ef9e92fa292f95534e0bc2d104b1484'

test('the Glass Skin instruction is pinned: score and describe, no advice', () => {
  const route = read('src/app/api/skin-score/route.ts')
  const a = route.indexOf('const GLASS_SKIN_SYSTEM_PROMPT = `')
  const prompt = route.slice(a, route.indexOf('}`', a) + 2)
  // Changing a word means a second-model review, then a new fingerprint.
  assert.equal(createHash('sha256').update(prompt).digest('hex'), GLASS_PROMPT_FINGERPRINT)
  assert.match(route, /system: GLASS_SKIN_SYSTEM_PROMPT,/)
  assert.equal((route.match(/messages\.create\(/g) ?? []).length, 1)
  // The words sent with the photo are part of the instruction too.
  assert.deepEqual([...code(route).matchAll(/^\s+text: '([^']*)',$/gm)].map((m) => m[1]), ['Score this photo for glass skin quality.'])
  // Nothing about the member is added to it: the score comes from the photo.
  assert.ok(!/ss_user_profiles|ss_ingredient_effectiveness|ss_treatment_phases[\s\S]{0,400}systemPrompt|buildSystemPrompt/.test(code(route)))
})

test('CLOSED WORLD: nine named fields are read from the model, and tips are never stored or returned', () => {
  const route = read('src/app/api/skin-score/route.ts')
  const a = route.indexOf('const analysis: GlassSkinAnalysisResult = {')
  const obj = route.slice(a, route.indexOf('\n    }\n', a))
  assert.deepEqual([...obj.matchAll(/^ {6}([a-z_]+):/gm)].map((m) => m[1]),
    ['overall_score', 'luminosity_score', 'smoothness_score', 'clarity_score', 'hydration_score', 'evenness_score', 'recommendations', 'analysis_notes', 'photo_quality'])
  assert.match(obj, /recommendations: \[\],/)
  assert.ok(!obj.includes('...'), 'spreading the model output would pass through whatever it adds')
  // EVERY use of the parsed model object: declared, assigned twice (parse and
  // fallback parse), then read by name for the eight fields and nothing else.
  // No raw['tips'], no destructuring, no spread.
  const rawUses = [...code(route).matchAll(/\braw\b(\.[a-z_]+|\[[^\]]*\]| =|: Record<string, unknown>)?/g)].map((m) => m[0])
  assert.deepEqual(rawUses.sort(), [
    'raw =', 'raw =', 'raw: Record<string, unknown>',
    'raw.analysis_notes', 'raw.analysis_notes', 'raw.clarity_score', 'raw.evenness_score', 'raw.hydration_score',
    'raw.luminosity_score', 'raw.overall_score', 'raw.photo_quality', 'raw.photo_quality', 'raw.photo_quality', 'raw.smoothness_score',
  ].sort())
  assert.match(route, /\n        recommendations: \[\],\n        analysis_notes: analysis\.analysis_notes \|\| null,/)
  const c = code(route)
  for (const gone of ['product_suggestions', 'recommended_ingredients', 'recommended_categories', 'findProductSuggestions']) {
    assert.ok(!c.includes(gone), `${gone} is back`)
  }
  const types = read('src/types/database.ts')
  assert.ok(!/GlassSkinProductSuggestion|recommended_ingredients|recommended_categories/.test(types))
})

test('a score that is missing or not a number fails the request and is never saved as 0', () => {
  const route = read('src/app/api/skin-score/route.ts')
  const a = route.indexOf('const num = (v: unknown): number => {')
  const fn = route.slice(a, route.indexOf('\n    }\n', a) + 6)
  const js = ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  class AppError extends Error { constructor(m, status) { super(m); this.status = status } }
  const num = new Function('AppError', `${js}; return num`)(AppError)
  assert.equal(num(72), 72)
  assert.equal(num('72'), 72)
  assert.equal(num(0), 0)
  for (const bad of [undefined, null, '', ' ', 'high', NaN, Infinity, {}, [], true]) {
    assert.throws(() => num(bad), (e) => e instanceof AppError && e.status === 502, `accepted ${String(bad)}`)
  }
})

test('the page and its components show nothing but scores, a description from the current scorer, and a link to Yuri', () => {
  const page = code(read('src/app/(app)/glass-skin/page.tsx'))
  assert.deepEqual([...new Set([...page.matchAll(/fetch\(\s*[`'"]([^`'"?$]+)/g)].map((m) => m[1]))].sort(), ['/api/skin-score'])
  for (const f of readdirSync(join(ROOT, 'src/components/glass-skin'))) {
    const c = code(read(`src/components/glass-skin/${f}`))
    assert.ok(!/recommendations|product_suggestions|recommended_/.test(c), `${f} reads a tips field`)
    assert.ok(!/fetch\(/.test(c) || /\/api\/skin-score/.test(c), `${f} calls something other than the score endpoint`)
  }
  // Old rows' notes carry advice; the timeline shows notes only for scorer_version 2.
  const timeline = read('src/components/glass-skin/ProgressTimeline.tsx')
  assert.match(timeline, /\?\.scorer_version === 2\s*\? s\.analysis_notes\s*: null/)
  assert.equal((code(timeline).match(/s\.analysis_notes/g) ?? []).length, 1, 'the stored note is read once, behind the version check')
  const route = read('src/app/api/skin-score/route.ts')
  assert.match(route, /const GLASS_SKIN_SCORER_VERSION = 2\n/)
  assert.match(route, /photo_quality: \{ \.\.\.\(analysis\.photo_quality \|\| \{\}\), scorer_version: GLASS_SKIN_SCORER_VERSION \},/)
})

test('the Dupe Finder has no model call of its own and one message builder that goes to Yuri', () => {
  assert.ok(!existsSync(join(ROOT, 'src/app/api/dupes/ai/route.ts')))
  assert.deepEqual(readdirSync(join(ROOT, 'src/app/api/dupes')).sort(), ['route.ts'])
  assert.deepEqual(readdirSync(join(ROOT, 'src/components/dupes')).sort(), ['DupeCard.tsx', 'IngredientComparison.tsx'])
  for (const f of ['src/app/api/dupes/route.ts', 'src/lib/intelligence/dupe-finder.ts']) {
    assert.ok(!/anthropic|messages\.create/i.test(read(f)), `${f} makes a model call`)
  }
  // The page draws results through these components and nothing else.
  const imports = [...read('src/app/(app)/dupes/page.tsx').matchAll(/^import .* from '(@\/components\/[^']+)'/gm)].map((m) => m[1]).sort()
  assert.deepEqual(imports, ['@/components/dupes/DupeCard', '@/components/ui/EmptyState', '@/components/ui/LazyImage', '@/components/ui/LoadingSpinner'])
  // SHAPE: the card states overlap and price. It does not rate a product for
  // the member or tell them to pick one.
  const card = code(read('src/components/dupes/DupeCard.tsx')).replace(/className=("[^"]*"|\{`[^`]*`\})/g, '')
  assert.deepEqual(card.split('\n').filter((l) => /\b(best|top pick|recommend\w*|effective (for|against|on)|should|winner|perfect for|ideal for|we suggest|Yuri (says|picks|recommends))\b/i.test(l)), [])
  assert.ok(!card.includes('effectiveness_insight.'), 'the effectiveness line is back on the card')

  const page = read('src/app/(app)/dupes/page.tsx')
  const c = code(page)
  // Every request the page makes: the catalog search and the overlap data.
  assert.deepEqual([...c.matchAll(/fetch\(`?'?([^`'?$]+)/g)].map((m) => m[1]).sort(), ['/api/dupes', '/api/products'])
  // Every link out goes to Yuri through the one builder.
  const hrefs = [...c.matchAll(/href=\{?[`"']?([^\n]{0,60})/g)].map((m) => m[1])
  assert.equal(hrefs.length, 2)
  for (const h of hrefs) assert.ok(h.startsWith('/yuri?ask=${encodeURIComponent(askYuriForAlternative('), h)
  assert.ok(!/useRouter|router\.|window\.location|location\.href/.test(c))
  assert.ok(!/AI-recommended|AI Dupe Search|Budget Optimizer|Yuri will find|Savings Summary|estimated_price/i.test(c))

  const fn = page.slice(page.indexOf('function askYuriForAlternative'), page.indexOf('export default function DupesPage'))
  const js = ts.transpileModule(fn, { compilerOptions: { target: ts.ScriptTarget.ES2022 } }).outputText
  const ask = new Function(`${js}; return askYuriForAlternative`)()
  assert.equal(ask('  Sulwhasoo   Concentrated Ginseng Cream '), 'Is there a cheaper product with the same key ingredients as Sulwhasoo Concentrated Ginseng Cream? Tell me if it is worth switching.')
  assert.equal(ask('   '), '')
  assert.equal(ask('x'.repeat(500)).length, 'Is there a cheaper product with the same key ingredients as ? Tell me if it is worth switching.'.length + 120)
})
