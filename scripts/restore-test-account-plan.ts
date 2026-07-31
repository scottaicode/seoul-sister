/**
 * Restore app access to Scott's test account WITHOUT a Stripe subscription.
 *
 * WHY (July 31 2026): glassskinatx@gmail.com is Scott's own test/persona
 * account. It carried a live $39.99/mo Stripe subscription — old pricing,
 * predating the June 22 repricing to $24.99 — that had billed Apr 7, May 7,
 * Jun 7 and Jul 7 ($159.96 total) and would have billed again Aug 7. The
 * subscription is now CANCELED in Stripe so the card stops being charged.
 *
 * The cancellation webhook fired correctly and set ss_user_profiles.plan = null,
 * which is right for a real cancellation but wrong here: Scott still needs the
 * account to behave like a subscriber for testing. AppShell.tsx:98 bounces any
 * user whose plan is null/'free' to /subscribe, so without this the test account
 * cannot reach Yuri at all.
 *
 * plan-only, NO fabricated ss_subscriptions row: hasActiveSubscription()
 * (src/lib/subscription.ts:37-58) checks ss_subscriptions FIRST and falls back
 * to ss_user_profiles.plan, so the flag alone satisfies every server-side gate
 * AND AppShell (which reads the profile column directly). Writing a fake Stripe
 * row would corrupt revenue reporting — the canceled row is the truth and stays.
 *
 * SAFETY: targets one user_id, verifies the email before writing, and refuses if
 * an ACTIVE subscription exists (that would mean this is a real paying customer,
 * not the test account). Re-running is a no-op.
 *
 * Dry run:  npx tsx scripts/restore-test-account-plan.ts
 * Apply:    npx tsx scripts/restore-test-account-plan.ts --apply
 */
import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

const url = get('NEXT_PUBLIC_SUPABASE_URL')
const key = get('SUPABASE_SERVICE_ROLE_KEY')
if (!url || !key) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}
const db = createClient(url, key)

const APPLY = process.argv.includes('--apply')

const TARGET_USER_ID = '84bdf605-f4af-4b10-8b5f-3fb03718777a'
const TARGET_EMAIL = 'glassskinatx@gmail.com'
const GRANT_PLAN = 'pro_monthly'

async function main() {
  console.log(APPLY ? '=== APPLYING ===\n' : '=== DRY RUN (pass --apply to write) ===\n')

  const { data: user, error: userErr } = await db.auth.admin.getUserById(TARGET_USER_ID)
  if (userErr || !user?.user) {
    console.error('Could not load auth user:', userErr?.message ?? 'not found')
    process.exit(1)
  }
  if (user.user.email !== TARGET_EMAIL) {
    console.error(`REFUSING: user ${TARGET_USER_ID} is ${user.user.email}, expected ${TARGET_EMAIL}`)
    process.exit(1)
  }

  // If an ACTIVE subscription exists, this is not the cancelled test account.
  const { data: subs, error: subErr } = await db
    .from('ss_subscriptions')
    .select('id, status')
    .eq('user_id', TARGET_USER_ID)
  if (subErr) {
    console.error('Subscription read failed:', subErr.message)
    process.exit(1)
  }
  const active = (subs ?? []).filter((s) => s.status === 'active')
  if (active.length > 0) {
    console.error('REFUSING: an ACTIVE subscription exists — this is not the cancelled test account.')
    process.exit(1)
  }

  const { data: profile, error: profErr } = await db
    .from('ss_user_profiles')
    .select('user_id, plan')
    .eq('user_id', TARGET_USER_ID)
    .maybeSingle()
  if (profErr) {
    console.error('Profile read failed:', profErr.message)
    process.exit(1)
  }
  if (!profile) {
    console.error('No ss_user_profiles row for this user.')
    process.exit(1)
  }

  console.log(`User:            ${user.user.email}`)
  console.log(`Plan now:        ${profile.plan ?? '(null)'}`)
  console.log(`Subscription rows: ${subs?.length ?? 0} (none active — card will not be charged)`)

  if (profile.plan === GRANT_PLAN) {
    console.log('\nAlready restored — nothing to do.')
    return
  }

  console.log(`\nWould set plan: ${profile.plan ?? '(null)'} -> ${GRANT_PLAN}`)
  if (!APPLY) {
    console.log('\nDry run only. Re-run with --apply to write.')
    return
  }

  const { data: updated, error: updErr } = await db
    .from('ss_user_profiles')
    .update({ plan: GRANT_PLAN })
    .eq('user_id', TARGET_USER_ID)
    .select('user_id, plan')
  if (updErr) {
    console.error('Update failed:', updErr.message)
    process.exit(1)
  }
  if (!updated?.length) {
    console.error('Update matched 0 rows.')
    process.exit(1)
  }
  console.log(`\n✅ ${TARGET_EMAIL} is ${updated[0].plan} — app access restored, no Stripe charge.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
