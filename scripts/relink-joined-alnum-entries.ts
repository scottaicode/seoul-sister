/**
 * Relink custom entries the "AtoBarrier365" search miss saved without a catalog
 * link (Oct 2026). Before the joined-alnum fix, a name like "AtoBarrier365
 * Cream" could not match the catalog's "Atobarrier 365 Cream", so Yuri saved it
 * as a custom entry (product_id NULL): no catalog INCI, so conflict checks
 * could not see it.
 *
 * Blast radius measured Oct 16 2026: one user (Caroline), one library row and
 * one routine step. Rows are named explicitly rather than re-resolved, so a
 * re-run cannot bind anything new. Each update is guarded on product_id still
 * being NULL, so re-running is a no-op.
 *
 * Dry run by default. Write: npx tsx --tsconfig tsconfig.json scripts/relink-joined-alnum-entries.ts --apply
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'

const USER = 'b6decb40-5861-4b4f-baa1-a10c3d629a33'
const CATALOG_ID = '15eb0437-6007-4f27-b4da-5b9cdc66ee8c' // Aestura Atobarrier 365 Cream (verified)
const LIBRARY_ROW = 'fde78d17-0b19-46c4-97d6-838d24632da0'
const ROUTINE_STEP = 'a878181c-6692-4b31-acf8-ff9837509bd4'
const apply = process.argv.includes('--apply')

async function main() {
  const db = getServiceClient()

  const { data: product, error: pErr } = await db
    .from('ss_products').select('id, brand_en, name_en, is_verified').eq('id', CATALOG_ID).single()
  if (pErr || !product?.is_verified) throw new Error(`catalog row missing or unverified: ${pErr?.message}`)
  console.log(`target: ${product.brand_en} ${product.name_en}`)

  const { data: lib, error: lErr } = await db
    .from('ss_user_products').select('id, custom_name, product_id').eq('id', LIBRARY_ROW).eq('user_id', USER).single()
  if (lErr) throw new Error(`library read failed: ${lErr.message}`)
  const { data: step, error: sErr } = await db
    .from('ss_routine_products').select('id, routine_id, product_id, notes').eq('id', ROUTINE_STEP).single()
  if (sErr) throw new Error(`routine read failed: ${sErr.message}`)
  const { data: routine, error: rErr } = await db
    .from('ss_user_routines').select('user_id, name').eq('id', step.routine_id).single()
  if (rErr || routine?.user_id !== USER) throw new Error(`routine ownership check failed: ${rErr?.message}`)

  console.log(`library  "${lib.custom_name}" product_id=${lib.product_id}`)
  console.log(`routine  "${routine.name}" step product_id=${step.product_id} notes="${(step.notes || '').slice(0, 60)}"`)
  if (!apply) { console.log('dry run — pass --apply to write'); return }

  const { data: l, error: luErr } = await db.from('ss_user_products')
    .update({ product_id: CATALOG_ID, updated_at: new Date().toISOString() })
    .eq('id', LIBRARY_ROW).eq('user_id', USER).is('product_id', null).select('id, product_id')
  if (luErr) throw new Error(`library update failed: ${luErr.message}`)
  const { data: s, error: suErr } = await db.from('ss_routine_products')
    .update({ product_id: CATALOG_ID })
    .eq('id', ROUTINE_STEP).is('product_id', null).select('id, product_id')
  if (suErr) throw new Error(`routine update failed: ${suErr.message}`)
  console.log(`updated library rows: ${l?.length ?? 0}, routine steps: ${s?.length ?? 0}`)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
