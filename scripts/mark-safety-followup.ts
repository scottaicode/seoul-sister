/**
 * Marks a member's setup record so Yuri asks the setup safety questions first
 * in the member chat (setup-requirements.ts SetupSafety.followUp). For members
 * who got past setup before it was required: the skip link, or the old
 * three-field finish. Dry run by default; names every row it would change.
 *
 *   npx tsx scripts/mark-safety-followup.ts <userId> [<userId> ...] [--apply]
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'

async function main() {
  const apply = process.argv.includes('--apply')
  const ids = process.argv.slice(2).filter((a) => /^[0-9a-f-]{36}$/.test(a))
  if (ids.length === 0) throw new Error('give at least one full user id')
  const db = getServiceClient()
  for (const id of ids) {
    const { data: row, error } = await db.from('ss_onboarding_progress').select('onboarding_status, skin_profile_data').eq('user_id', id).maybeSingle()
    if (error) throw new Error(error.message)
    if (!row) { console.log(`${id}: no setup record, nothing to mark`); continue }
    const record = (row.skin_profile_data as Record<string, unknown> | null) ?? {}
    console.log(`${id}: status ${row.onboarding_status}; medical answered ${record.medical_question_answered === true}; reactions answered ${record.reactions_question_answered === true}; already marked ${record.safety_followup === true}; record keys: ${Object.keys(record).join(', ') || '(none)'}`)
    if (!apply || record.safety_followup === true) continue
    const { data: done, error: wErr } = await db.from('ss_onboarding_progress').update({ skin_profile_data: { ...record, safety_followup: true } }).eq('user_id', id).select('user_id')
    console.log(wErr ? `  FAILED: ${wErr.message}` : `  marked (${done?.length} row)`)
  }
  if (!apply) console.log('Dry run. Nothing changed.')
}
main().catch((e) => { console.error(e); process.exit(1) })
