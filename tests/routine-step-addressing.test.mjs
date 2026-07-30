/**
 * Guard test — routine steps are addressed by their own row id.
 *
 * THE DEFECT THIS PREVENTS FROM RETURNING (July 30 2026)
 *
 * ss_routine_products.product_id is NULLABLE: a device ("LED mask"), an action
 * ("Shower / cleanse"), or a product we don't carry is stored as a CUSTOM step
 * with product_id = NULL and its identity in `notes`.
 *
 * Every mutation path keyed on product_id:
 *   - DELETE /api/routine/:id/products required ?product_id= (z.string().uuid())
 *   - PUT reorder took { product_ids } and looped .eq('product_id', ...)
 *   - Yuri's remove_from_routine deleted with .eq('product_id', productId)
 *
 * A NULL row cannot be named by any of those, so custom steps were permanently
 * stuck: undeletable and unreorderable by the user, by the UI, and by Yuri. The
 * routine page had to HIDE the buttons because the API could not express the
 * request at all. Bailey could not remove her own adapalene step.
 *
 * Secondary defect: the old reorder renumbered only the catalog rows it was
 * handed, working in a "null-filtered space", so a custom step kept its saved
 * step_order and could collide with a renumbered product.
 *
 * Verified against the live database before shipping: a throwaway routine of
 * catalog + custom steps reordered the custom step from position 2 to 1 and
 * then deleted it — both impossible before this change.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = join(__dirname, '..')
const read = (...p) => readFileSync(join(root, ...p), 'utf8')

const apiSrc = read('src', 'app', 'api', 'routine', '[id]', 'products', 'route.ts')
const pageSrc = read('src', 'app', '(app)', 'routine', 'page.tsx')
const toolsSrc = read('src', 'lib', 'yuri', 'tools.ts')

// --- 1. The API can address any row ---------------------------------------

test('DELETE accepts step_id and deletes by row id', () => {
  assert.ok(
    /searchParams\.get\('step_id'\)/.test(apiSrc),
    'DELETE must accept step_id'
  )
  assert.ok(
    /\.eq\('id', stepId\)/.test(apiSrc),
    'DELETE must delete by the row id when step_id is given'
  )
  // Ownership must still be scoped to the routine, or a step id from someone
  // else's routine could be deleted.
  assert.ok(
    /delete\(\)\.eq\('routine_id', routineId\)/.test(apiSrc),
    'the delete must stay scoped to the verified routine'
  )
})

test('reorder accepts step_ids covering every step', () => {
  assert.ok(/step_ids: z\.array/.test(apiSrc), 'reorder schema must accept step_ids')
  assert.ok(
    /\.eq\('id', step_ids\[i\]\)/.test(apiSrc),
    'reorder must renumber by row id so custom steps participate'
  )
})

test('the legacy product_id shape still works for one release', () => {
  // A cached SPA bundle may still send the old shape; breaking it would 400
  // every reorder for users who have not reloaded.
  assert.ok(
    /product_ids: z\.array/.test(apiSrc),
    'product_ids must remain accepted for backward compatibility'
  )
  assert.ok(
    /step_ids \(preferred\) or product_ids/.test(apiSrc),
    'the error message must name the preferred parameter'
  )
})

// --- 2. The UI must not hide controls for custom steps --------------------

test('the routine page addresses steps by row id', () => {
  assert.ok(/handleRemoveStep\(rp\.id\)/.test(pageSrc), 'remove must pass the row id')
  assert.ok(/handleMoveStep\(rp\.id,/.test(pageSrc), 'reorder must pass the row id')
  assert.ok(/step_ids: newOrder/.test(pageSrc), 'the page must send step_ids')
})

test('reorder and remove are no longer gated on product_id', () => {
  // These gates are what made the buttons vanish for custom steps.
  assert.ok(
    !/\{rp\.product_id && \(\s*<button/.test(pageSrc),
    'the remove button must not be conditional on product_id'
  )
  assert.ok(
    !/\{rp\.product_id \? \(\s*<>/.test(pageSrc),
    'the reorder buttons must not be conditional on product_id'
  )
  assert.ok(
    !/Custom steps \(null product_id\) can't be reordered/.test(pageSrc),
    'the early-return that blocked custom steps must be gone'
  )
})

test('reorder operates over all steps, not a null-filtered subset', () => {
  // Working in the filtered space is what let step_order collide.
  assert.ok(
    !/\.map\(\(rp\) => rp\.product_id\)\s*\n\s*\.filter\(\(id\): id is string => id !== null\)/.test(pageSrc),
    'the null-filtered reorder space must be gone'
  )
  assert.ok(
    /\[\.\.\.routine\.products\]\.sort\(\(a, b\) => a\.step_order - b\.step_order\)/.test(pageSrc),
    'reorder must be computed over the full ordered step list'
  )
})

// --- 3. Yuri can remove a custom step, but only on an exact match ---------

test('Yuri can remove a custom step by its exact name', () => {
  assert.ok(
    /findCustomRoutineStepByName/.test(toolsSrc),
    'remove_from_routine must be able to find a custom step'
  )
  assert.ok(
    /deleteRoutineStepById/.test(toolsSrc),
    'removal must delete by row id'
  )
})

test('custom-step matching is exact and refuses ambiguity', () => {
  const idx = toolsSrc.indexOf('async function findCustomRoutineStepByName')
  assert.ok(idx > -1, 'helper must exist')
  const block = toolsSrc.slice(idx, idx + 1800)

  assert.ok(
    /notes === wanted \|\| notes\.split\(' — '\)\[0\]\.trim\(\) === wanted/.test(block),
    'matching must be exact on the whole note or the name portion'
  )
  assert.ok(
    /matches\.length === 1/.test(block),
    'an ambiguous match must refuse rather than guess which step to delete'
  )
  // A fuzzy remove deletes the wrong step — worse than declining.
  assert.ok(
    !/ilike|resolveProductByName\(/.test(block),
    'custom-step removal must never use fuzzy matching'
  )
})

test('renumbering after a delete keeps step_order contiguous', () => {
  const idx = toolsSrc.indexOf('async function deleteRoutineStepById')
  const block = toolsSrc.slice(idx, idx + 1400)
  assert.ok(
    /step_order: i \+ 1/.test(block),
    'remaining steps must be renumbered after a removal'
  )
})

// --- 4. Yuri must be able to SEE a custom step to act on it ---------------

test('get_routine_context names custom steps instead of "(unknown)"', () => {
  const idx = toolsSrc.indexOf('let currentRoutineSteps')
  assert.ok(idx > -1, 'get_routine_context must build routine steps')
  const block = toolsSrc.slice(idx, idx + 2200)

  assert.ok(
    !/product_name: prod\?\.name_en \|\| '\(unknown\)'/.test(block),
    'a custom step must not render as "(unknown)" — Yuri could not name the step she was being asked about'
  )
  assert.ok(
    /step_id: s\.id/.test(block),
    'each step must expose its row id so Yuri can address it'
  )
  assert.ok(
    /is_custom_step/.test(block),
    'Yuri must be able to tell a custom step from a catalog one'
  )
})

test('the stale type that hid every null bug is corrected', () => {
  const dbTypes = read('src', 'types', 'database.ts')
  const idx = dbTypes.indexOf('export interface RoutineProduct')
  const block = dbTypes.slice(idx, idx + 900)
  assert.ok(
    /product_id: string \| null/.test(block),
    'RoutineProduct.product_id must be nullable to match the live column'
  )
})
