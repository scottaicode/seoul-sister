/**
 * Backfill fitzpatrick_source from the onboarding record of truth.
 *
 * The migration marked every pre-existing fitzpatrick_scale as 'estimated' —
 * the conservative default, since provenance didn't exist yet. But
 * ss_onboarding_progress.skin_profile_data DOES record what the extractor
 * actually pulled from the conversation, so we can recover the truth:
 *
 *   extracted value present  -> the user really told us    -> 'stated'
 *   extracted value NULL but profile has a number -> it was the hardcoded
 *     default (fitzpatrick_scale = extracted || 3) -> NULL the value entirely.
 *
 * That second case is the fabrication this release removes. Leaving a
 * fabricated 3 in place while merely relabelling it 'estimated' would keep
 * feeding Yuri a number nobody gave her; clearing it makes her ASK.
 *
 *   npx tsx scripts/backfill-fitzpatrick-provenance.ts          # dry run
 *   npx tsx scripts/backfill-fitzpatrick-provenance.ts --apply
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'

const APPLY = process.argv.includes('--apply')

async function main() {
  const db = getServiceClient()
  const { data: profiles, error } = await db
    .from('ss_user_profiles')
    .select('id, user_id, fitzpatrick_scale, fitzpatrick_source')
    .not('fitzpatrick_scale', 'is', null)

  if (error) { console.error(error.message); process.exit(1) }

  for (const p of (profiles || []) as Array<Record<string, unknown>>) {
    const { data: prog } = await db
      .from('ss_onboarding_progress')
      .select('skin_profile_data')
      .eq('user_id', p.user_id as string)
      .maybeSingle()

    const extracted = (prog?.skin_profile_data as Record<string, unknown> | null)
      ?.fitzpatrick_scale
    const stated = extracted !== null && extracted !== undefined

    const update = stated
      ? { fitzpatrick_source: 'stated' }
      : { fitzpatrick_scale: null, fitzpatrick_source: null }

    console.log(
      `${(p.id as string).slice(0, 8)}  stored=${p.fitzpatrick_scale}  extracted=${
        stated ? extracted : 'NULL'
      }  -> ${stated ? "stated" : 'CLEARED (was fabricated by the default)'}`
    )

    if (APPLY) {
      const { error: uErr } = await db
        .from('ss_user_profiles')
        .update(update)
        .eq('id', p.id as string)
      if (uErr) console.error('  update failed:', uErr.message)
    }
  }
  console.log(APPLY ? '\nApplied.' : '\nDRY RUN — re-run with --apply.')
}
main()
