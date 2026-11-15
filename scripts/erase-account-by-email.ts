/**
 * Erases one account by email address, using the same `eraseAccount` the
 * "Delete my account" button runs (Stripe subscription and customer, photos,
 * conversations, preview chat, nurture row, login), then verifies it is gone.
 *
 * For the owner's own test addresses. Dry run by default.
 *
 *   npx tsx scripts/erase-account-by-email.ts someone@example.com            # show what exists
 *   npx tsx scripts/erase-account-by-email.ts someone@example.com --apply    # erase
 *   ... --apply --forget-trial   # also remove the free-week ledger row, which
 *                                # eraseAccount keeps on purpose so one inbox
 *                                # cannot take the free week twice. Only for a
 *                                # test address that should start clean.
 */
import './load-env'
import { getServiceClient } from '../src/lib/supabase'
import { eraseAccount } from '../src/lib/account/erase'
import { cancelSubscriptionForDeletedAccount, deleteStripeCustomer, findStripeCustomersForUser } from '../src/lib/stripe'

const BUCKETS = ['glass-skin-photos', 'user-uploads']

async function main() {
  const email = (process.argv[2] || '').trim().toLowerCase()
  const apply = process.argv.includes('--apply')
  const forgetTrial = process.argv.includes('--forget-trial')
  if (!email || !email.includes('@') || /[*%_]/.test(email)) throw new Error('give one exact email address')
  const db = getServiceClient()

  // auth.users is not exposed to PostgREST; page through the admin list.
  let user: { id: string; email?: string } | null = null
  for (let page = 1; ; page++) {
    const { data, error } = await db.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw new Error(`could not list logins: ${error.message}`)
    const hit = data.users.find((u) => (u.email || '').toLowerCase() === email)
    if (hit) { user = { id: hit.id, email: hit.email }; break }
    if (data.users.length < 1000) break
  }

  const { data: ledger, error: ledgerError } = await db.from('ss_trial_starts').select('id, user_id, started_at, trial_end').eq('email_canonical', email)
  if (ledgerError) throw new Error(`could not read the free-week ledger: ${ledgerError.message}`)
  console.log(`login: ${user ? user.id : 'none'}`)
  console.log(`free-week ledger rows for this address: ${ledger?.length ?? 0}`)
  if (!apply) { console.log('Dry run. Nothing changed.'); return }

  if (user) {
    const result = await eraseAccount(db, { id: user.id, email: user.email }, {
      cancelSubscription: cancelSubscriptionForDeletedAccount,
      deleteStripeCustomer,
      findStripeCustomers: findStripeCustomersForUser,
      purgePhotos: async (userId) => {
        let removed = 0
        for (const bucket of BUCKETS) {
          const { data: top, error } = await db.storage.from(bucket).list(userId, { limit: 1000 })
          if (error) throw new Error(`could not list ${bucket}: ${error.message}`)
          const paths: string[] = []
          for (const e of top ?? []) {
            if (e.id !== null) { paths.push(`${userId}/${e.name}`); continue }
            const { data: nested, error: nestedError } = await db.storage.from(bucket).list(`${userId}/${e.name}`, { limit: 1000 })
            if (nestedError) throw new Error(`could not list ${bucket}/${e.name}: ${nestedError.message}`)
            for (const f of nested ?? []) paths.push(`${userId}/${e.name}/${f.name}`)
          }
          if (paths.length) {
            const { error: removeError } = await db.storage.from(bucket).remove(paths)
            if (removeError) throw new Error(`could not remove photos from ${bucket}: ${removeError.message}`)
            removed += paths.length
          }
        }
        return removed
      },
    })
    console.log(`erased. steps: ${result.steps.join(' > ')}; photos removed: ${result.photosRemoved}`)
  }

  if (forgetTrial) {
    const { data: gone, error } = await db.from('ss_trial_starts').delete().eq('email_canonical', email).select('id')
    if (error) throw new Error(`could not remove the free-week ledger row: ${error.message}`)
    console.log(`free-week ledger rows removed: ${gone?.length ?? 0}`)
  }
}

main().then(() => process.exit(0)).catch((e) => { console.error(e instanceof Error ? e.message : e); process.exit(1) })
