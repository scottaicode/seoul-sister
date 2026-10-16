/**
 * Guard test — an ingredient list from Yuri is stored exactly, or refused loudly.
 *
 * Oct 6 2026, production: Yuri sent a subscriber's Cetaphil and Naturium label
 * lists to update_user_product as comma-separated strings. The tool accepted
 * only arrays, stored nothing, and returned success; Yuri told her the INCI was
 * saved. A first fix ran strings through the catalog parser; a second-model
 * review showed newline lists became ONE stored "ingredient" and a stray ";"
 * silently dropped names, and that a helper which only worked on lists starting
 * with "Water" passed the first suite. Every case below is one of those.
 *
 * Executes the real readIngredientInput with the real pollution guard.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'
import ts from 'typescript'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const read = (p) => readFileSync(join(root, p), 'utf8')
const bundle = [
  read('src/lib/pipeline/ingredient-parser.ts'),
  read('src/lib/yuri/ingredient-input.ts').replace(/^import .*$/m, ''),
].join('\n')
const js = ts.transpileModule(bundle, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const { readIngredientInput } = await import('data:text/javascript;base64,' + Buffer.from(js).toString('base64'))

// Both exact strings from the Oct 6 tool calls.
const CETAPHIL =
  'Water, Glycerin, Cocamidopropyl Betaine, Sodium Lauroyl Sarcosinate, Disodium Laureth Sulfosuccinate, Panthenol, Niacinamide, Pantolactone, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Masking Fragrance, Sodium Chloride, Citric Acid, Sodium Benzoate'
const NATURIUM =
  'Aqua, Glycerin, Dimethicone, Simmondsia Chinensis (Jojoba) Seed Oil, Squalane, Glyceryl Stearate, Cetyl Alcohol, Niacinamide, Stearyl Alcohol, Palmitoyl Tripeptide-5, Pantolactone, Palmitoyl Tripeptide-1, Palmitoyl Tetrapeptide-7, Hydrolyzed Plukenetia Volubilis Seed Extract, Dunaliella Salina Extract, Sodium Hyaluronate, 3-O-Ethyl Ascorbic Acid, Panthenol, Caryodendron Orinocense Seed Oil, Honokiol, Magnolol, Palmitic Acid, Sorbitan Oleate, Aluminum Starch Octenylsuccinate, Hydroxyacetophenone, Stearic Acid, Acrylamide/Sodium Acryloyldimethyltaurate Copolymer, Polyglyceryl-6 Laurate, 1,2-Hexanediol, Boron Nitride, Caprylyl Glycol, Polyglyceryl-10 Oleate, Isohexadecane, Butylene Glycol, Chlorphenesin, Acrylates/C10-30 Alkyl Acrylate Crosspolymer, Tocopheryl Acetate, Polysorbate 80, Sorbitan Palmitate, Sodium Hydroxide, Sodium Benzoate, Carbomer, Sodium Lactate, Phenoxyethanol, Polysorbate 20, Citric Acid, Ethylhexylglycerin, Potassium Sorbate'

/** The stored list must be exactly the label, name for name. */
function assertExact(input, expected) {
  const r = readIngredientInput(input)
  assert.equal(r.unreadable, false)
  assert.deepEqual(r.list, expected)
}

test('both recorded label strings are stored in full, name for name', () => {
  assertExact(CETAPHIL, CETAPHIL.split(', '))
  assertExact(NATURIUM, NATURIUM.split(', '))
  assert.equal(readIngredientInput(NATURIUM).list.length, 48)
  assert.equal(readIngredientInput(NATURIUM).list[28], '1,2-Hexanediol')
})

test('commas inside a name are not separators', () => {
  assertExact('Water, 1,2-Hexanediol, Niacinamide (20,000ppm)', ['Water', '1,2-Hexanediol', 'Niacinamide (20,000ppm)'])
})

test('an "Ingredients:" prefix and a final period are tolerated', () => {
  assertExact('Ingredients: Water, Glycerin.', ['Water', 'Glycerin'])
})

test('arrays are stored as sent (trimmed), including the Aug 1 production shape', () => {
  assertExact(['Aqua/Water', ' Glycerin ', '1,2-Hexanediol', 'Butyrospermum Parkii (Shea) Butter'],
    ['Aqua/Water', 'Glycerin', '1,2-Hexanediol', 'Butyrospermum Parkii (Shea) Butter'])
})

test('"nothing sent" is not an error', () => {
  for (const v of [undefined, null, [], '', '   ']) {
    const r = readIngredientInput(v)
    assert.equal(r.unreadable, false, JSON.stringify(v))
    assert.equal(r.list, undefined, JSON.stringify(v))
  }
})

test('every shape that would store a wrong list is refused, never shortened or merged', () => {
  const refused = {
    'newline list': 'Water\nGlycerin\nNiacinamide',
    'numbered lines': '1. Water\n2. Glycerin',
    'sentences': 'Water. Glycerin. Niacinamide.',
    'dash separated': 'Water - Glycerin - Niacinamide',
    'prose': 'I could not read the label',
    'one stray semicolon': 'Water, Retinal, Glycolic Acid, Niacinamide; Fragrance',
    'run-together names': 'Water, Glycerin, SodiumHyaluronate, Niacinamide',
    'May contain block': 'Water, Glycerin, Titanium Dioxide. May contain (+/-): CI 77891',
    'trailing "and"': 'Water, Glycerin, and Niacinamide',
    'footnote star': 'Water, Glycerin*, Niacinamide',
    'semicolon list': 'Water; Glycerin; Niacinamide',
    'array holding a comma list': ['Water, Glycerin, Niacinamide'],
    'array with a non-string': ['Water', 42, 'Glycerin'],
    'array with an empty name': ['Water', '  ', 'Glycerin'],
    'object': { a: 1 },
    'number': 42,
  }
  for (const [label, v] of Object.entries(refused)) {
    const r = readIngredientInput(v)
    assert.equal(r.unreadable, true, label)
    assert.equal(r.list, undefined, label)
  }
})

test('update_user_product refuses unreadable input and reports what it stored', () => {
  const src = read('src/lib/yuri/tools.ts')
  const start = src.indexOf('async function executeUpdateUserProduct(')
  const body = src.slice(start, src.indexOf('\nasync function ', start + 10))
  assert.match(body, /const ingredientInput = readIngredientInput\(input\.ingredients_inci\)/)
  assert.match(body, /if \(ingredientInput\.unreadable\) \{\s*return JSON\.stringify\(\{\s*error:/)
  assert.equal((body.match(/ingredients_saved: ingredientsInci\?\.length \?\? 0/g) || []).length, 2)
})

test('check_ingredient_conflicts cannot spread a string into letters', () => {
  const src = read('src/lib/yuri/tools.ts')
  const start = src.indexOf('async function executeCheckIngredientConflicts(')
  const body = src.slice(start, src.indexOf('\nasync function ', start + 10))
  assert.match(body, /readIngredientInput\(input\.ingredient_names\)/)
  assert.match(body, /if \(ingredientInput\.unreadable\) \{\s*return JSON\.stringify\(\{\s*error:/)
  assert.match(body, /\['product_ids', 'product_names'\][\s\S]{0,120}!Array\.isArray\(input\[key\]\)/)
  assert.doesNotMatch(body, /input\.ingredient_names as string\[\]/)
})
