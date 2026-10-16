/** Live before/after replay of real production queries with a word joined to a number. Read-only. Run: npx tsx --tsconfig tsconfig.json scripts/replay-joined-alnum-search.ts */
import './load-env'
import { executeYuriTool } from '../src/lib/yuri/tools'
const Q = [
  'AESTURA AtoBarrier365 Cream', 'AtoBarrier365 Cream', 'Aestura Atobarrier 365 Cream',
  'SKIN1004 Madagascar Centella Air-Fit Suncream sunscreen SPF50', 'SKIN1004 Madagascar Centella Soothing Cream',
  'SKIN1004 Madagascar Centella Toning Toner', 'Round Lab Birch Juice Moisturizing Cleanser Purito Oat-In Calming Gel Cream SKIN1004 sunscreen',
  'SKIN1004 Madagascar Centella Ampoule', 'SKIN1004 Hyalu-Cica Water-Fit Sun Serum',
  'MISSHA M Perfect Cover BB Cream SPF42 PA+++ No. 27', 'MISSHA M Perfect Cover BB Cream SPF42',
  'tone up brightening sunscreen SPF50', 'Beauty of Joseon Relief Sun Rice Probiotics SPF50',
  'Mediheal madecassoside sunscreen SPF50', 'daily sunscreen SPF50 PA++++ lightweight sensitive',
  'Melixir Vegan Daily Skin Tint SPF50+', 'Round Lab Birch Juice Moisturizing Sunscreen SPF50',
  'gentle daily sunscreen sensitive skin SPF50', 'lightweight sunscreen oily skin no white cast SPF50',
  'Beauty of Joseon Relief Sun rice probiotics sunscreen SPF50', 'sunscreen SPF50 daily broad spectrum',
  // joined forms of other spaced catalog names
  'VT Reedle Shot100', 'Anua Heartleaf77 Toner', 'Mediheal Derma365 cream', 'Some By Mi PHA30', 'CKD Retino Collagen Small Molecule300 cream',
  // controls
  'numbuzin No.9 toner', 'Anua Heartleaf 77 Toner', 'COSRX Snail 96 Mucin Power Essence', 'Torriden Dive-In serum',
]
async function main() {
  for (const query of Q) {
    const raw = await executeYuriTool('search_products', { query }, '')
    let out: string
    try { const j = JSON.parse(raw); out = (j.products ?? []).slice(0, 3).map((p: { brand: string; name: string }) => `${p.brand} | ${p.name}`).join(' ;; ') || raw.slice(0, 120) } catch { out = raw.slice(0, 120) }
    console.log(`Q: ${query}\n   -> ${out}`)
  }
  for (const n of ['AESTURA AtoBarrier365 Cream', 'Anua Heartleaf77 Toner', 'Anua PDRN10 toner', 'MISSHA Atelo Collagen50 cream', 'AtoBarrier365 Cream']) {
    const j = JSON.parse(await executeYuriTool('get_personalized_match', { product_name: n }, 'b6decb40-5861-4b4f-baa1-a10c3d629a33'))
    console.log(`MATCH: ${n} -> ${j.resolved_product?.matched_product ?? JSON.stringify(j).slice(0, 150)} [${j.resolved_product?.match_quality ?? '?'}]`)
  }
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
