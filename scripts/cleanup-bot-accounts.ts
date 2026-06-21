/**
 * One-time cleanup: Remove bot / dead signup accounts.
 *
 * Context (May 31 2026): The registration flow has no captcha/bot protection
 * (see CLAUDE.md Future Work — "Supabase Attack Protection"). Bots were
 * registering with dotted-Gmail addresses, getting an auto-created profile via
 * the handle_new_user trigger, then never engaging. They inflate every user
 * count and clutter the admin view without contributing any learning data.
 *
 * A "bot / dead" account is defined STRICTLY as:
 *   - NOT one of the protected real accounts (Scott, Bailey, glass_skin_atx)
 *   - onboarding_completed = false
 *   - plan = 'free' (never subscribed)
 *
 * Real engaged accounts are protected three ways: explicit allowlist,
 * the onboarding flag, and the plan flag. Deleting via the Supabase Admin API
 * tears down auth-schema rows (identities, sessions) and cascades public-schema
 * data through the existing ON DELETE CASCADE foreign keys.
 *
 * Usage:
 *   Dry run (default — lists what WOULD be deleted, deletes nothing):
 *     npx tsx --tsconfig tsconfig.json scripts/cleanup-bot-accounts.ts
 *   Execute the deletion:
 *     npx tsx --tsconfig tsconfig.json scripts/cleanup-bot-accounts.ts --execute
 */
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
  { auth: { autoRefreshToken: false, persistSession: false } }
)

// Real accounts that must NEVER be deleted, regardless of flags.
const PROTECTED_EMAILS = new Set([
  'vibetrendai@gmail.com', // Scott
  'baileydonmartin@gmail.com', // Bailey (lighthouse user)
  'glassskinatx@gmail.com', // Reddit persona test account
])

const EXECUTE = process.argv.includes('--execute')

async function main() {
  console.log(`=== Bot Account Cleanup (${EXECUTE ? 'EXECUTE' : 'DRY RUN'}) ===\n`)

  // Pull all auth users via the Admin API (paginated).
  const allUsers: { id: string; email: string | undefined }[] = []
  let page = 1
  for (;;) {
    const { data, error } = await supabase.auth.admin.listUsers({ page, perPage: 200 })
    if (error) throw error
    allUsers.push(...data.users.map((u) => ({ id: u.id, email: u.email })))
    if (data.users.length < 200) break
    page++
  }
  console.log(`Total auth users: ${allUsers.length}`)

  // Pull profile flags to classify.
  const { data: profiles, error: pErr } = await supabase
    .from('ss_user_profiles')
    .select('user_id, onboarding_completed, plan')
  if (pErr) throw pErr
  const profileById = new Map(
    (profiles ?? []).map((p) => [p.user_id, p])
  )

  const targets = allUsers.filter((u) => {
    if (!u.email || PROTECTED_EMAILS.has(u.email)) return false
    const prof = profileById.get(u.id)
    const onboarded = prof?.onboarding_completed ?? false
    const plan = prof?.plan ?? 'free'
    return onboarded === false && plan === 'free'
  })

  console.log(`\nBot / dead accounts to remove: ${targets.length}\n`)
  for (const t of targets) console.log(`  - ${t.email}`)

  // Safety assertion: never let a protected account slip into the target set.
  const protectedHit = targets.find((t) => t.email && PROTECTED_EMAILS.has(t.email))
  if (protectedHit) {
    throw new Error(`SAFETY ABORT: protected account in target set: ${protectedHit.email}`)
  }

  if (!EXECUTE) {
    console.log('\nDry run complete. Re-run with --execute to delete.')
    return
  }

  console.log('\nDeleting...\n')
  let ok = 0
  let fail = 0
  for (const t of targets) {
    const { error } = await supabase.auth.admin.deleteUser(t.id)
    if (error) {
      console.error(`  FAILED ${t.email}: ${error.message}`)
      fail++
    } else {
      console.log(`  deleted ${t.email}`)
      ok++
    }
  }
  console.log(`\nDone. Deleted ${ok}, failed ${fail}.`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
