/**
 * Two things Bailey hit on Aug 7 2026, both in one screenshot.
 *
 * 1. She photographed an Abib Dark Spot Collagen Wrapping Mask and asked where
 *    niacinamide sat. Yuri answered "No ingredient panel, so I still can't
 *    confirm where niacinamide sits" and asked for another angle of the tube.
 *    Bailey then asked directly — "Is the product not in the database to get
 *    ingredients?" — Yuri called search_products, found it, and read the full
 *    list. Her verdict: "why didn't she just pull the ingredient list first
 *    thing lol." The product was in the catalog, verified, with complete INCI,
 *    the whole time.
 *
 *    The prompt caused this. It said a non-catalog product "has none on file"
 *    and then offered exactly two ways to get ingredients — photograph the
 *    label, or web_search. Searching the catalog FIRST was never listed.
 *
 * 2. That same reply opened with a literal "[Fri 9:25 PM]". Those tags are
 *    injected by formatMessageTimestamp() so Claude can reason about message
 *    timing; nothing told her they were metadata, so she echoed one.
 *
 * These assert on the assembled prompt, not on a source regex over the file.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const ADVISOR = join(root, 'src/lib/yuri/advisor.ts')
const source = readFileSync(ADVISOR, 'utf8')

/** The ingredient-blindness guidance block, isolated from the rest of the prompt. */
function ingredientBlindnessBlock(src) {
  const start = src.indexOf('update_user_product — recording ingredients for a product we don')
  assert.ok(start !== -1, 'ingredient-recording guidance block not found')
  const end = src.indexOf('update_user_product — swaps are TWO calls', start)
  assert.ok(end !== -1, 'end of ingredient-recording block not found')
  return src.slice(start, end)
}

test('catalog search is ordered BEFORE asking for a photo', () => {
  const block = ingredientBlindnessBlock(source)

  const catalogIdx = block.search(/search[_ ]products/i)
  const photoIdx = block.search(/photograph the ingredients panel/i)

  assert.ok(catalogIdx !== -1, 'block must tell Yuri to search the catalog')
  assert.ok(photoIdx !== -1, 'block must still describe the photo path')
  assert.ok(
    catalogIdx < photoIdx,
    'the catalog search must be instructed BEFORE the photo request — ' +
      'ordering is the whole defect, not the presence of either instruction'
  )
})

test('the block explicitly forbids asking for a photo of a catalog product', () => {
  const block = ingredientBlindnessBlock(source)
  assert.match(
    block,
    /Do not ask for a photo of something you could have looked up/i,
    'the prohibition must be stated, not merely implied by ordering'
  )
})

test('a photo does not exempt Yuri from searching the catalog', () => {
  // Bailey DID send a photo. If the rule only covered named-but-unphotographed
  // products, this exact case would still slip through.
  const block = ingredientBlindnessBlock(source)
  assert.match(
    block,
    /photo[\s\S]{0,200}catalog search|catalog[\s\S]{0,200}(photograph|photo)/i,
    'the guidance must cover the photographed case, which is the one that failed'
  )
})

test('timestamp tags are declared metadata and must not be reproduced', () => {
  assert.match(
    source,
    /never reproduce it in a reply|never print the tag/i,
    'the prompt must tell Yuri the [Fri 9:42 PM] tags are input metadata'
  )
})

test('the timestamp rule sits in the same block that explains the tags', () => {
  // A rule far from its context gets ignored. It must live in RIGHT NOW, where
  // the temporal anchors already are.
  const rightNow = source.indexOf('## RIGHT NOW')
  assert.ok(rightNow !== -1, 'RIGHT NOW block not found')
  const anchor = source.indexOf('Do not estimate or round.', rightNow)
  assert.ok(anchor !== -1, 'temporal-anchor text not found inside RIGHT NOW')

  // The tag rule must appear within the RIGHT NOW block — i.e. after the
  // heading and close to the anchors, not stranded elsewhere in the prompt.
  const rule = source.indexOf('metadata for you, not text from the conversation')
  assert.ok(rule !== -1, 'timestamp-tag rule not found at all')
  assert.ok(
    rule > rightNow && rule - anchor < 600,
    'the tag rule must live inside the RIGHT NOW block beside the temporal anchors — ' +
      'a rule far from its context gets ignored'
  )
})

test('formatMessageTimestamp still produces the tag it warns about', () => {
  // If the tag format ever changes, the prompt rule naming "[Fri 9:42 PM]"
  // silently stops matching reality. Execute the real formatter shape.
  const fn = source.match(/return `\[\$\{map\.weekday\} \$\{map\.hour\}:\$\{map\.minute\} \$\{map\.dayPeriod\}\]`/)
  assert.ok(
    fn,
    'formatMessageTimestamp no longer emits [Weekday H:MM AM] — update the prompt rule to match'
  )

  // And the shape the prompt cites must be producible by that template.
  const parts = { weekday: 'Fri', hour: '9', minute: '42', dayPeriod: 'PM' }
  const rendered = `[${parts.weekday} ${parts.hour}:${parts.minute} ${parts.dayPeriod}]`
  assert.equal(rendered, '[Fri 9:42 PM]')
})
