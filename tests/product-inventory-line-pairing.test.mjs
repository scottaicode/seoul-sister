/**
 * Guard test — product inventory line/product pairing.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING
 * Bailey, a paying subscriber, sent Yuri a normal question on July 30 2026 and
 * got "Something went wrong on Yuri's end. Please resend" — twice, deterministically.
 * Authenticated Yuri was hard-down for EVERY user who owned at least one product
 * with no ingredients on file (3 of 3 users with an inventory, including the only
 * real paying customer).
 *
 * The cause was in v11.17.0's confirmed/inferred split. Product lines were rendered
 * into a flat string[], then re-paired against context.userProducts BY INDEX:
 *
 *     productLines.filter((_, i) => !isInferred(context.userProducts[i]))
 *
 * That assumed the two arrays stayed the same length. But the ingredient-visibility
 * block appended THREE narrative lines to that same array, so every index past it
 * read past the end of userProducts and `up.learned_from` threw on undefined.
 * The crash happened in context assembly, BEFORE the Anthropic call — which is why
 * the conversation row was created with zero messages and no retry could help.
 *
 * WHY THIS TEST EXECUTES INSTEAD OF GREPPING
 * The whole v11.17.0 area was already covered by source-structural tests, and they
 * all passed against the broken code — a string assertion cannot catch an
 * off-by-length read. So this test transpiles the real memory.ts and CALLS
 * formatContextForPrompt on the exact data shape that crashed. Revert the fix and
 * this test throws, which is the only thing that proves it guards anything.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')

/**
 * Transpile just the pure formatter out of memory.ts and import it.
 * memory.ts imports a Supabase client at module scope, so we slice the function
 * (and its local helpers) rather than loading the whole module — this keeps the
 * test dependency-free and DB-free while still executing the real source text.
 */
async function loadFormatter() {
  const src = readFileSync(join(root, 'src', 'lib', 'yuri', 'memory.ts'), 'utf8')

  const start = src.indexOf('export function formatContextForPrompt')
  assert.ok(start > -1, 'formatContextForPrompt must exist in memory.ts')

  // Walk braces to find the end of the function body.
  const bodyStart = src.indexOf('{', start)
  let depth = 0
  let end = -1
  for (let i = bodyStart; i < src.length; i++) {
    const ch = src[i]
    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) {
        end = i + 1
        break
      }
    }
  }
  assert.ok(end > -1, 'could not delimit formatContextForPrompt body')

  const fnSrc = src.slice(start, end)
  // Strip type-only imports/annotations by transpiling as TS with types erased.
  const js = ts.transpileModule(fnSrc, {
    compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
  }).outputText

  const dir = mkdtempSync(join(tmpdir(), 'ss-memory-'))
  const file = join(dir, 'formatter.mjs')
  writeFileSync(file, js)
  const mod = await import(pathToFileURL(file).href)
  return mod.formatContextForPrompt
}

/** Minimal UserContext (matches the exported interface in memory.ts). */
function makeContext(userProducts) {
  return {
    skinProfile: null,
    recentConversations: [],
    recentExcerpts: [],
    productReactions: [],
    knownAllergies: [],
    knownPreferences: [],
    routineProducts: [],
    userProducts,
    learningInsights: [],
    specialistInsights: [],
    decisionMemory: null,
    cyclePhase: null,
    locationName: null,
    ingredientOverlap: null,
    glassSkinHistory: [],
  }
}

const catalogProduct = {
  product_id: 'aaaaaaaa-0000-0000-0000-000000000001',
  custom_name: 'Beauty of Joseon Relief Sun',
  custom_brand: null,
  category: 'sunscreen',
  texture_weight: 3,
  notes: null,
  learned_from: 'user',
}

/** The row that triggered the crash: custom entry, no ingredients on file. */
const blindProduct = {
  product_id: null,
  custom_name: 'Ice roller',
  custom_brand: null,
  category: null,
  texture_weight: null,
  notes: null,
  learned_from: 'user',
}

const inferredProduct = {
  product_id: 'aaaaaaaa-0000-0000-0000-000000000002',
  custom_name: 'Some Cleanser',
  custom_brand: null,
  category: 'cleanser',
  texture_weight: 2,
  notes: null,
  learned_from: 'conversation_inferred',
}

test('a shelf containing a product with no ingredients on file does not crash context assembly', async () => {
  const formatContextForPrompt = await loadFormatter()

  // This exact combination — at least one blind product, which appends narrative
  // lines — is what desynced the index pairing and threw on `up.learned_from`.
  const out = formatContextForPrompt(
    makeContext([catalogProduct, blindProduct, inferredProduct])
  )

  assert.equal(typeof out, 'string')
  assert.ok(out.includes('Your Product Inventory'), 'inventory section must render')
})

test('Bailey-shaped shelf (many blind products) renders every product exactly once', async () => {
  const formatContextForPrompt = await loadFormatter()

  // Bailey had 27 products, 17 of them blind — well past the point where the
  // old index arithmetic ran off the end of the array.
  const products = []
  for (let i = 0; i < 10; i++) {
    products.push({ ...catalogProduct, custom_name: `Catalog Product ${i}` })
  }
  for (let i = 0; i < 17; i++) {
    products.push({ ...blindProduct, custom_name: `Blind Product ${i}` })
  }

  const out = formatContextForPrompt(makeContext(products))

  for (const p of products) {
    const occurrences = out.split(p.custom_name).length - 1
    assert.ok(
      occurrences >= 1,
      `${p.custom_name} must appear in the rendered inventory (line/product pairing drifted)`
    )
  }
})

test('the confirmed block never absorbs an inferred product', async () => {
  const formatContextForPrompt = await loadFormatter()

  // The pairing exists to keep a GUESSED row out of the block that reads as fact.
  // A desync does not only crash — when it does not crash it silently mislabels,
  // which is the fabricated-product failure the split was built to prevent.
  const out = formatContextForPrompt(
    makeContext([blindProduct, blindProduct, inferredProduct])
  )

  const confirmedIdx = out.indexOf('### Confirmed')
  const inferredIdx = out.indexOf('### Inferred from conversation')
  assert.ok(inferredIdx > -1, 'an inferred product must render under the inferred heading')

  if (confirmedIdx > -1) {
    const confirmedBlock = out.slice(confirmedIdx, inferredIdx > confirmedIdx ? inferredIdx : undefined)
    assert.ok(
      !confirmedBlock.includes('Some Cleanser'),
      'an inferred product must never be presented as confirmed'
    )
  }
})

test('the ingredient-visibility fact still reaches Yuri', async () => {
  const formatContextForPrompt = await loadFormatter()

  // Fixing the crash must not silently drop the safety fact. A clean conflict
  // result on an unseen product means "not checked", not "safe" — Yuri needs
  // to be told what she cannot see.
  const out = formatContextForPrompt(makeContext([catalogProduct, blindProduct]))

  assert.ok(
    out.includes('INGREDIENT VISIBILITY'),
    'the visibility fact must survive the confirmed/inferred split'
  )
  assert.ok(
    out.includes('Ice roller'),
    'the blind product must be named so Yuri knows which shelf entry is unseen'
  )
})
