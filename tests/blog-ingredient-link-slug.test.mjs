/**
 * Blog ingredient auto-links must point at a page that exists (Oct 13 2026).
 *
 * /ingredients/[slug] resolves rows by toSlug(name_inci). buildIngredientMap
 * slugged the ENGLISH name, so any ingredient whose English and INCI names
 * differ got a 404 link on every post that mentioned it: an Oct 13 crawl found
 * 11 of 72 distinct ingredient links broken across 30 of 52 posts, e.g.
 * "Beta Hydroxy Acid (Salicylic Acid)" -> /ingredients/beta-hydroxy-acid-salicylic-acid.
 *
 * Executes the real linker (transpiled with its real slug module).
 */
import assert from 'node:assert/strict'
import test from 'node:test'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import ts from 'typescript'

const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'ss-linker-'))
const emit = (rel, out, rewrite = (s) => s) => {
  const src = fs.readFileSync(path.join(process.cwd(), rel), 'utf8')
  const js = ts.transpileModule(src, {
    compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
  }).outputText
  fs.writeFileSync(path.join(dir, out), rewrite(js))
}
emit('src/lib/utils/slug.ts', 'slug.mjs')
emit('src/lib/utils/ingredient-linker.ts', 'linker.mjs', (s) => s.replace(/from ['"]\.\/slug['"]/, "from './slug.mjs'"))
const { buildIngredientMap, linkIngredients } = await import(pathToFileURL(path.join(dir, 'linker.mjs')).href)
const { toSlug } = await import(pathToFileURL(path.join(dir, 'slug.mjs')).href)

const BHA = { name_en: 'Beta Hydroxy Acid (Salicylic Acid)', name_inci: 'Salicylic Acid' }

test('links use the INCI slug the ingredient page resolves', () => {
  const links = buildIngredientMap([BHA])
  assert.ok(links.length > 0)
  for (const l of links) assert.equal(l.slug, toSlug(BHA.name_inci))
})

test('the English name and the INCI name both still link, to the same page', () => {
  const links = buildIngredientMap([BHA])
  const names = links.map((l) => l.name)
  assert.ok(names.includes(BHA.name_en))
  assert.ok(names.includes(BHA.name_inci))
  const { html } = linkIngredients('<p>Try salicylic acid at night.</p>', links)
  assert.match(html, /href="\/ingredients\/salicylic-acid"/)
  assert.doesNotMatch(html, /beta-hydroxy-acid/)
})

test('a row with no English name still links by INCI', () => {
  const links = buildIngredientMap([{ name_en: null, name_inci: 'Niacinamide' }])
  assert.deepEqual(links.map((l) => l.slug), ['niacinamide'])
})
