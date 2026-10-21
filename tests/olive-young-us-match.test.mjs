/**
 * Guard tests — the Olive Young US matcher must refuse anything it isn't sure of.
 *
 * A confident wrong match writes a wrong US price that Yuri and the product page
 * then present as fact. Every case below is from the first real dry run
 * (Oct 21 2026) or from a wrong-product class this repo has already paid for
 * (numbuzin No.3 vs No.9). The module is executed, not pattern-matched.
 */

import { test } from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { dirname, join } from 'node:path'
import { tmpdir } from 'node:os'
import ts from 'typescript'

const __dirname = dirname(fileURLToPath(import.meta.url))
const src = readFileSync(join(__dirname, '..', 'src', 'lib', 'pipeline', 'olive-young-us.ts'), 'utf8')
const js = ts.transpileModule(src, {
  compilerOptions: { module: ts.ModuleKind.ESNext, target: ts.ScriptTarget.ES2022 },
}).outputText
const dir = mkdtempSync(join(tmpdir(), 'ss-oyus-'))
writeFileSync(join(dir, 'm.mjs'), js)
const { verifyOyUsMatch, oyUsSearchQuery, fetchOyUsProduct } = await import(pathToFileURL(join(dir, 'm.mjs')).href)

const us = (name, brand, extra = {}) => ({ id: 'UA1', name, brand, price: 20, inStock: true, hasVariants: false, ...extra })
const ok = (ours, theirs) => verifyOyUsMatch(ours, theirs).verdict === 'match'
const verdict = (ours, theirs) => verifyOyUsMatch(ours, theirs).verdict

test('exact matches pass', () => {
  assert.ok(ok(
    { brand: 'COSRX', name: 'Advanced Snail 96 Mucin Power Essence', volume: '100ml' },
    us('COSRX Advanced Snail 96 Mucin Power Essence 3.38 fl. oz.(100ml)', 'COSRX')
  ))
  assert.ok(ok(
    { brand: 'Anua', name: 'Heartleaf 77% Soothing Toner', volume: '250ml' },
    us('Anua Heartleaf 77 Soothing Toner 8.45 fl. oz.(250ml)', 'Anua')
  ))
  assert.ok(ok(
    { brand: 'SKIN1004', name: 'Madagascar Centella Hyalu-Cica Water-Fit Sun Serum (Twin Pack)', volume: '50ml*2ea' },
    us('SKIN1004 Madagascar Centella Hyalu-Cica Water-Fit Sun Serum UV Twin Pack 1.69 fl. oz.(50ml) X 2ea', 'SKIN1004')
  ), 'a twin pack matches a twin pack')
})

test('a bundle never matches a single (the first dry run got this wrong)', () => {
  assert.equal(ok(
    { brand: 'Beplain', name: 'Mung Bean pH-Balanced Cleansing Foam', volume: 'Cleansing Foam 160ml+Cleansing Foam 160ml+mangomee Coin Purse' },
    us('beplain Mung Bean pH-Balanced Cleansing Foam 5.41 fl. oz.(160ml)', 'beplain')
  ), false)
  assert.equal(ok(
    { brand: 'ma:nyo', name: 'Pure Cleansing Oil', volume: 'Original Product: Pure Cleansing Oil 200ml*2ea+Refill 200ml, Special Gift: Pure Soybean Cleansing Milk 2ml*3ea' },
    us('ma:nyo Pure Cleansing Oil 6.76 fl. oz.(200ml)', 'ma:nyo')
  ), false)
})

test('a twin pack never matches a single, and vice versa', () => {
  assert.equal(ok(
    { brand: 'SKIN1004', name: 'Madagascar Centella Hyalu-Cica Water-Fit Sun Serum (Twin Pack)', volume: '50ml*2ea' },
    us('SKIN1004 Madagascar Centella Hyalu-cica Water-fit Sun Serum UV 1.69 fl. oz.(50ml)', 'SKIN1004')
  ), false)
  assert.equal(ok(
    { brand: 'SKIN1004', name: 'Madagascar Centella Hyalu-Cica Water-Fit Sun Serum', volume: '50ml' },
    us('SKIN1004 Madagascar Centella Hyalu-Cica Water-Fit Sun Serum UV Twin Pack 1.69 fl. oz.(50ml) X 2ea', 'SKIN1004')
  ), false)
})

test('a sibling product never matches (cream vs lotion, different sizes)', () => {
  assert.equal(ok(
    { brand: 'Aestura', name: 'Atobarrier 365 Cream', volume: '80ml' },
    us('AESTURA Atobarrier365 Lotion 5.07 fl. oz.(150ml)', 'AESTURA')
  ), false)
  assert.equal(ok(
    { brand: 'Beplain', name: 'Mung Bean pH-Balanced Cleansing Foam', volume: '160ml' },
    us('beplain Mung Bean pH-balanced Cleansing Foam 2.7 fl. oz.(80ml)', 'beplain')
  ), false)
})

test('the number IS the product (numbuzin No.3 vs No.9, Medicube 2000 vs 7500)', () => {
  assert.equal(ok(
    { brand: 'numbuzin', name: 'No.3 Skin Softening Serum', volume: '50ml' },
    us('numbuzin No.9 Skin Softening Serum 1.69 fl. oz.(50ml)', 'numbuzin')
  ), false)
  // The listing carries a number our name lacks: every word of ours is present,
  // so only the identity-number rule can refuse it.
  assert.equal(ok(
    { brand: 'numbuzin', name: 'Skin Softening Serum', volume: '50ml' },
    us('numbuzin No.3 Skin Softening Serum 1.69 fl. oz.(50ml)', 'numbuzin')
  ), false)
  assert.equal(ok(
    { brand: 'Medicube', name: 'PDRN Pink Exosome Shot Serum 2000', volume: '30ml' },
    us('medicube PDRN Pink Exosome Shot Serum 7500 1.01 fl. oz.(30ml)', 'medicube')
  ), false)
})

test('variants, another brand, and a missing price all refuse', () => {
  const ours = { brand: 'Torriden', name: 'Dive-In Low Molecular Hyaluronic Acid Serum', volume: '50ml' }
  assert.equal(ok(ours, us('[2options] Torriden Dive-in Low Molecular Hyaluronic Acid Serum 1.69 fl. oz.(50ml)', 'Torriden', { hasVariants: true })), false)
  assert.equal(ok(ours, us('AESTURA Atobarrier365 Cream 2.70 fl. oz. (80ml)', 'AESTURA')), false)
  assert.equal(ok(ours, us('Torriden Dive-in Low Molecular Hyaluronic Acid Serum 1.69 fl. oz.(50ml)', 'Torriden', { price: null })), false)
})

test('search query keeps identity numbers and drops sizes and bundle words', () => {
  assert.equal(oyUsSearchQuery('Round Lab', '1025 Dokdo Toner 200ml'), 'Round Lab 1025 dokdo toner')
  assert.equal(oyUsSearchQuery('Anua', 'Heartleaf Pore Control Cleansing Oil Double Set'), 'Anua heartleaf pore control')
})

test('the feed reader treats 404 as gone and any other failure as an error, never a silent null', async () => {
  const resp = (status, body) => async () => ({ status, ok: status < 400, json: async () => body })
  assert.equal(await fetchOyUsProduct('UA1', resp(404, {})), null)
  await assert.rejects(fetchOyUsProduct('UA1', resp(403, {})), /HTTP 403/)
  await assert.rejects(fetchOyUsProduct('UA1', resp(200, { data: {} })), /unexpected shape/)
  const p = await fetchOyUsProduct('UA1', resp(200, { data: {
    product_id: 'UA1', name: 'X', brand: { name: 'B' }, pricing: { price: { amount: 38 } }, is_soldout: true, has_variants: false,
  } }))
  assert.deepEqual(p, { id: 'UA1', name: 'X', brand: 'B', price: 38, inStock: false, hasVariants: false })
})

test('the four wrong matches from the first full dry run (Oct 21 2026) are refused', () => {
  // "Pad" was being stripped as if it were a "PA++++" rating.
  assert.equal(verdict(
    { brand: 'Abib', name: 'Heartleaf Calming Toner Pad', volume: '80 pads' },
    us('Abib Heartleaf Calming Toner Skin Booster 6.76 fl. oz.(200ml)', 'Abib')
  ), 'reject', 'toner pads are not a liquid toner')
  assert.equal(ok(
    { brand: 'Torriden', name: 'DIVE-IN Low Molecular Hyaluronic Acid Pad', volume: '80 pads' },
    us('Torriden Dive-in Low Molecular Hyaluronic Acid Mask 10 Sheets 0.91 fl. oz.(27ml)', 'Torriden')
  ), false, 'pads are not sheet masks')
  assert.equal(ok(
    { brand: 'Medicube', name: 'PDRN Pink Collagen Gel Toner Pad', volume: '60 pads' },
    us('medicube PDRN Pink Collagen Toning Gel Toner Pad 70 Pads 4.05 fl. oz.(120ml)', 'medicube')
  ), false, '60 pads is not 70 pads')
  assert.equal(ok(
    { brand: "I'm From", name: 'Mugwort Cream', volume: '50ml' },
    us('I’m From Mugwort Fluid Cream 1.69 fl. oz.(50ml)', "I'm From")
  ), false, 'a listing that adds a product-form word is a different product')
})

test('real same-product matches still pass after the stricter rules', () => {
  assert.ok(ok(
    { brand: 'Skinfood', name: 'Carrot Carotene Calming Water Pad', volume: '60 pads' },
    us('SKINFOOD Carrot Carotene Calming Water Pad 60 Pads 8.81 oz.(250g)', 'SKINFOOD')
  ))
  assert.ok(ok(
    { brand: 'Abib', name: 'Mild Acidic pH Sheet Mask Heartleaf Fit', volume: '1 sheet' },
    us('Abib Mild Acidic pH Sheet Mask Heartleaf Fit 1 Sheet 1.01 fl. oz.(30ml)', 'Abib')
  ))
  assert.ok(ok(
    { brand: 'Dr. Jart+', name: 'Ceramidin Skin Barrier Moisturizing Cream', volume: '50ml' },
    us('Dr.Jart+ Ceramidin™ Skin Barrier Moisturizing Cream 1.69 fl. oz.(50ml)', 'Dr.Jart+')
  ))
})

test('review attacks (Oct 21 2026): a listing adding a variant word is never a clean match', () => {
  const cases = [
    [{ brand: 'COSRX', name: 'Snail 96 Mucin Power Essence', volume: '100ml' }, us('COSRX Advanced Snail 96 Mucin Power Essence 3.38 fl. oz.(100ml)', 'COSRX')],
    [{ brand: 'Heimish', name: 'Marine Care Cream', volume: '30ml' }, us('HEIMISH Marine Care Eye Cream 1.01 fl. oz.(30ml)', 'HEIMISH')],
    [{ brand: 'Laneige', name: 'Lip Sleeping Mask', volume: '20g' }, us('LANEIGE Lip Sleeping Mask Berry 0.7 oz.(20g)', 'LANEIGE')],
    [{ brand: 'Dr.G', name: 'Red Blemish Clear Soothing Cream', volume: '70ml' }, us('Dr.G Red Blemish Clear Soothing Cream Plus 2.36 fl. oz.(70ml)', 'Dr.G')],
    [{ brand: 'Round Lab', name: '1025 Dokdo Toner', volume: '200ml' }, us('ROUND LAB 1025 Dokdo Toner Refill 6.76 fl. oz.(200ml)', 'ROUND LAB')],
    [{ brand: 'Anua', name: 'Heartleaf 77% Soothing Toner', volume: null }, us('Anua Heartleaf 77 Soothing Toner Mini 1.35 fl. oz.(40ml)', 'Anua')],
    [{ brand: 'COSRX', name: 'Advanced Snail 92 All In One Cream', volume: '100g' }, us('COSRX Advanced Snail 92 All In One Cream Intensive Repair 3.52 oz.(100g)', 'COSRX')],
  ]
  for (const [o, t] of cases) assert.equal(verdict(o, t), 'reject', `${t.name} must be refused`)
  // An unknown extra word is a person's call, never a write.
  assert.equal(verdict(
    { brand: 'Haruharu Wonder', name: 'Black Rice Hyaluronic Toner', volume: '150ml' },
    us('HARUHARU WONDER Black Rice Hyaluronic Toner Free Of Alcohol And Fragrance 5.07 fl. oz.(150ml)', 'HARUHARU WONDER')
  ), 'review')
})

test('brand must match as a whole, not a substring', () => {
  const ours = { brand: 'Dr.G', name: 'Brightening Peeling Gel', volume: '120ml' }
  assert.equal(ok(ours, us('Dr.Gem Brightening Peeling Gel 4.23 fl. oz.(120ml)', 'Dr.Gem')), false)
  assert.equal(ok({ brand: 'Anua', name: 'Heartleaf 77% Soothing Toner', volume: '250ml' }, us('Manua Heartleaf 77 Soothing Toner (250ml)', 'Manua')), false)
  assert.ok(ok(ours, us('Dr.G Brightening Peeling Gel 4.23 oz.(120g)', 'Dr.G')), 'punctuation/case differences are fine')
})

test('No.5+ is not No.5', () => {
  assert.equal(ok(
    { brand: 'numbuzin', name: 'No.5 Vitamin Concentrated Serum', volume: '30ml' },
    us('numbuzin No.5+ Vitamin Concentrated Serum 1.01 fl. oz.(30ml)', 'numbuzin')
  ), false)
})

test('sizes: an unparseable or multi-size listing is refused; fl. oz alone is converted', () => {
  const ours = { brand: 'COSRX', name: 'Advanced Snail 96 Mucin Power Essence', volume: '100ml' }
  assert.equal(ok(ours, us('COSRX Advanced Snail 96 Mucin Power Essence', 'COSRX')), false, 'no size on the listing')
  assert.equal(ok(ours, us('COSRX Advanced Snail 96 Mucin Power Essence (100ml) (Special 150ml)', 'COSRX')), false, 'two sizes')
  assert.ok(ok(ours, us('COSRX Advanced Snail 96 Mucin Power Essence 3.38 fl. oz.', 'COSRX')), '3.38 fl oz is ~100ml')
  assert.equal(ok(ours, us('COSRX Advanced Snail 96 Mucin Power Essence 1.69 fl. oz.', 'COSRX')), false, '1.69 fl oz is ~50ml')
})

test('bundles and multi-packs written in the NAME are refused too', () => {
  assert.equal(ok(
    { brand: 'COSRX', name: 'Advanced Snail 96 Mucin Power Essence (2 pcs)', volume: '100ml' },
    us('COSRX Advanced Snail 96 Mucin Power Essence 3.38 fl. oz.(100ml)', 'COSRX')
  ), false)
  assert.equal(ok(
    { brand: 'COSRX', name: 'Snail Essence Set (Essence 100ml + Cream 50ml)', volume: null },
    us('COSRX Snail Essence 3.38 fl. oz.(100ml)', 'COSRX')
  ), false)
})

test('each structural rule binds on its own case', () => {
  // pad/sheet count present on one side only
  assert.equal(ok({ brand: 'Skinfood', name: 'Carrot Carotene Calming Water Pad', volume: '250g' },
    us('SKINFOOD Carrot Carotene Calming Water Pad 60 Pads 8.81 oz.(250g)', 'SKINFOOD')), false)
  // twin word without an ea count
  assert.equal(ok({ brand: 'Anua', name: 'Heartleaf 77% Soothing Toner', volume: '250ml' },
    us('Anua Heartleaf 77 Soothing Toner Duo 8.45 fl. oz.(250ml)', 'Anua')), false)
  // a form word that is NOT in the refuse list on its own
  assert.equal(verdict({ brand: 'Benton', name: 'Snail Bee High Content Skin', volume: '150ml' },
    us('BENTON Snail Bee High Content Skin Toner 5.07 fl. oz.(150ml)', 'BENTON')), 'reject')
})

test('an unknown size on our side is a review, never a clean match', () => {
  assert.equal(verdict(
    { brand: 'Anua', name: 'Heartleaf 77% Soothing Toner', volume: null },
    us('Anua Heartleaf 77 Soothing Toner 8.45 fl. oz.(250ml)', 'Anua')
  ), 'review')
})
