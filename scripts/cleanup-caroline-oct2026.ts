/**
 * One-off cleanup of Caroline's (comped tester) data after the Oct 6 2026
 * session review. Every value written here is traced to her own words or to a
 * recorded tool call; nothing is inferred.
 *
 *  1. Cetaphil + Naturium label INCI: Yuri sent both from her label photos as
 *     strings; update_user_product dropped them and reported success (fixed in
 *     ingredient-input.ts). Restored from the recorded tool-call input,
 *     source label_scan, captured at the original call time.
 *  2. Naturium was in the library twice (original still 'active', copy
 *     'destashed'). The original takes the parked status + notes; copy deleted.
 *  3. "Byoma Balancing Toner" -> "Byoma Milky Toner": she said "byoma milky
 *     toner" (Jul 28); she never said Balancing. Byoma's variants differ in actives.
 *  4. Fitzpatrick II, stated: "I burn fairly easily without sunscreen but then I
 *     tan" (Oct 6) is a complete burn+tan answer (onboarding.ts rule).
 *  5. sun_history (was NULL despite two answers): her words.
 *  6. Duplicate skin_concerns / medical_history entries merged.
 *  7. Memory: a "correction" claiming Yuri said BoJ was "effective as labeled"
 *     (she said the opposite) removed from the conversation and durable store;
 *     the superseded Jul 28 AM routine (Caudalie, since parked) removed; an open
 *     loop that claimed "Yuri saved" an AM routine that does not exist reworded.
 *  8. "[Mon 8:38 PM] " tags the model echoed into 4 of her replies stripped.
 *
 * Dry run by default. Write: npx tsx --tsconfig tsconfig.json scripts/cleanup-caroline-oct2026.ts --apply
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'
import { readIngredientInput } from '../src/lib/yuri/ingredient-input'

const USER = 'b6decb40-5861-4b4f-baa1-a10c3d629a33'
const apply = process.argv.includes('--apply')
const db = getServiceClient()

const CETAPHIL_ROW = '9a5ffcc2-09ee-4618-ac39-a771f3c10348'
const NATURIUM_ORIGINAL = 'deecac17-6857-4abf-b1c3-c0a782a64574'
const NATURIUM_DUPLICATE = '53cbe16f-6cee-4fdf-96ab-170080a4bd8c'
const BYOMA_ROW = '8584070c-bad7-4708-b335-4d0237fcb395'
const PM_ROUTINE = '96a73bf4-9afe-48b2-8190-afdf04b501f8'
const CONV_ONBOARDING = 'bfcabdf6-a683-4014-9907-ea6049ba7c69'
const CONV_OCT6 = 'c31d9fdf-b0ae-4d66-8e41-38aa7c308008'
const LABEL_SCAN_AT = '2026-10-06T01:42:41.514Z'
const TAG = /^\[(Mon|Tue|Wed|Thu|Fri|Sat|Sun) \d{1,2}:\d{2} (AM|PM)\] /

function check<T>(label: string, r: { data: T; error: { message: string } | null }): T {
  if (r.error) throw new Error(`${label}: ${r.error.message}`)
  return r.data
}

type Dm = {
  decisions?: Array<{ topic: string; decision: string }>
  corrections?: Array<{ topic: string }>
  open_loops?: Array<{ topic: string; resolved_reason?: string | null }>
}

async function main() {
  const log: string[] = []

  // Recorded label lists, read from the Oct 6 tool call itself (not retyped).
  const msgs = check('label call', await db.from('ss_yuri_messages').select('tool_calls')
    .eq('conversation_id', CONV_OCT6).eq('created_at', '2026-10-06 01:42:41.514722+00'))
  const calls = (msgs as Array<{ tool_calls: Array<{ input: Record<string, unknown> }> }>)[0]?.tool_calls ?? []
  const inciFor = (name: string) => {
    const c = calls.find((t) => t.input?.product_name === name)
    const r = readIngredientInput(c?.input?.ingredients_inci)
    if (!r.list || c?.input?.ingredients_source !== 'label_scan') throw new Error(`no label list for ${name}`)
    return r.list
  }
  const cetaphil = inciFor('Cetaphil Daily Facial Cleanser')
  const naturium = inciFor('Naturium Multi-Peptide Moisturizer')
  log.push(`label INCI: Cetaphil ${cetaphil.length}, Naturium ${naturium.length}`)

  const dup = check('naturium dup', await db.from('ss_user_products').select('status, notes')
    .eq('id', NATURIUM_DUPLICATE).eq('user_id', USER).maybeSingle()) as { status: string; notes: string } | null
  const prof = check('profile', await db.from('ss_user_profiles')
    .select('fitzpatrick_scale, fitzpatrick_source, sun_history, skin_concerns, medical_history')
    .eq('user_id', USER).single()) as Record<string, unknown>
  const convs = check('convs', await db.from('ss_yuri_conversations').select('id, decision_memory')
    .in('id', [CONV_ONBOARDING, CONV_OCT6]).eq('user_id', USER)) as Array<{ id: string; decision_memory: Dm }>
  const mem = check('durable', await db.from('ss_user_memory').select('durable_corrections')
    .eq('user_id', USER).maybeSingle()) as { durable_corrections: Array<{ topic: string }> } | null
  const tagged = (check('tagged', await db.from('ss_yuri_messages').select('id, content, conversation_id')
    .in('conversation_id', [CONV_ONBOARDING, CONV_OCT6, 'd08e994d-c65e-4f0a-bb13-4ee873c92fbd'])
    .eq('role', 'assistant')) as Array<{ id: string; content: string }>).filter((m) => TAG.test(m.content))

  log.push(`naturium duplicate: ${dup ? `${dup.status}` : 'already gone'}`)
  log.push(`profile now: fitz=${prof.fitzpatrick_scale}/${prof.fitzpatrick_source} sun_history=${prof.sun_history === null ? 'NULL' : 'set'}`)
  log.push(`timestamp-tagged replies: ${tagged.length}`)
  console.log(log.join('\n'))
  if (!apply) { console.log('dry run — pass --apply to write'); return }

  // 1. Label INCI (only where still empty).
  for (const [id, list] of [[CETAPHIL_ROW, cetaphil], [NATURIUM_ORIGINAL, naturium]] as const) {
    const r = check(`inci ${id}`, await db.from('ss_user_products')
      .update({ ingredients_inci: list, ingredients_source: 'label_scan', ingredients_captured_at: LABEL_SCAN_AT })
      .eq('id', id).eq('user_id', USER).is('ingredients_inci', null).select('id'))
    console.log(`inci ${id}: ${(r as unknown[]).length}`)
  }

  // 2. Merge Naturium.
  if (dup) {
    check('naturium original', await db.from('ss_user_products')
      .update({ status: 'destashed', notes: dup.notes, updated_at: new Date().toISOString() })
      .eq('id', NATURIUM_ORIGINAL).eq('user_id', USER))
    const del = check('naturium delete', await db.from('ss_user_products').delete()
      .eq('id', NATURIUM_DUPLICATE).eq('user_id', USER).select('id'))
    console.log(`naturium merged, duplicate deleted: ${(del as unknown[]).length}`)
  }

  // 3. Byoma variant (library + routine step).
  const b1 = check('byoma lib', await db.from('ss_user_products').update({ custom_name: 'Byoma Milky Toner' })
    .eq('id', BYOMA_ROW).eq('user_id', USER).eq('custom_name', 'Byoma Balancing Toner').select('id'))
  const b2 = check('byoma step', await db.from('ss_routine_products').update({ notes: 'Byoma Milky Toner' })
    .eq('routine_id', PM_ROUTINE).eq('notes', 'Byoma Balancing Toner').select('id'))
  console.log(`byoma renamed: library ${(b1 as unknown[]).length}, routine ${(b2 as unknown[]).length}`)

  // 4-6. Profile.
  check('profile', await db.from('ss_user_profiles').update({
    fitzpatrick_scale: 2,
    fitzpatrick_source: 'stated',
    sun_history:
      'Burns fairly easily without sunscreen, then tans (Oct 6 2026). No personal or family history of skin cancer; no moles or spots of concern (Jul 28 2026).',
    skin_concerns: ['inconsistent skin', 'dehydration', 'dryness', 'dullness', 'oiliness', 'breakouts'],
    medical_history: ['Took Accutane (isotretinoin) in college', 'Acne since her teens; it came back in her twenties'],
    updated_at: new Date().toISOString(),
  }).eq('user_id', USER))
  console.log('profile updated')

  // 7. Memory.
  for (const c of convs) {
    const dm = { ...c.decision_memory }
    if (c.id === CONV_ONBOARDING) {
      dm.decisions = (dm.decisions ?? [])
        .filter((d) => d.topic !== 'morning_routine')
        .map((d) => d.topic === 'seasonal_adjustment'
          ? { ...d, decision: 'Layer a richer cream or facial oil over her moisturizer in KC winter to combat indoor heat dryness' }
          : d)
    }
    if (c.id === CONV_OCT6) {
      dm.corrections = (dm.corrections ?? []).filter((x) => x.topic !== 'beauty_of_joseon_spf_reformulation')
      dm.open_loops = (dm.open_loops ?? []).map((l) => l.topic === 'am_routine'
        ? { ...l, resolved_reason: 'User described her AM routine (Cetaphil, Byoma toner, snail mucin, Korean-formula Beauty of Joseon SPF); it was not saved as a routine' }
        : l)
    }
    check(`memory ${c.id}`, await db.from('ss_yuri_conversations').update({ decision_memory: dm }).eq('id', c.id).eq('user_id', USER))
  }
  if (mem) {
    check('durable', await db.from('ss_user_memory').update({
      durable_corrections: (mem.durable_corrections ?? []).filter((x) => x.topic !== 'beauty_of_joseon_spf_reformulation'),
    }).eq('user_id', USER))
  }
  console.log('memory updated')

  // 8. Echoed timestamp tags.
  for (const m of tagged) {
    check(`tag ${m.id}`, await db.from('ss_yuri_messages').update({ content: m.content.replace(TAG, '') })
      .eq('id', m.id).eq('content', m.content))
  }
  console.log(`tags stripped: ${tagged.length}`)
}
main().then(() => process.exit(0)).catch((e) => { console.error(e); process.exit(1) })
