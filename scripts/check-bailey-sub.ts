import { createClient } from '@supabase/supabase-js'
import { readFileSync } from 'fs'

const env = readFileSync('.env.local', 'utf8')
const get = (k: string) =>
  env.match(new RegExp(`^${k}=(.+)$`, 'm'))?.[1]?.trim().replace(/^["']|["']$/g, '')

async function main() {
  const db = createClient(
    get('NEXT_PUBLIC_SUPABASE_URL')!,
    get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  const { data: users } = await db.auth.admin.listUsers()
  const bailey = users.users.find((u) => u.email?.toLowerCase().includes('bailey'))
  console.log('Bailey user:', bailey?.email, bailey?.id)
  if (!bailey) {
    console.log('all emails:', users.users.map((u) => u.email))
    return
  }

  const { data: profile } = await db
    .from('ss_user_profiles')
    .select('plan, onboarding_completed')
    .eq('user_id', bailey.id)
    .maybeSingle()
  console.log('Profile:', JSON.stringify(profile))

  const { data: subs } = await db
    .from('ss_subscriptions')
    .select('plan, status, current_period_end, stripe_subscription_id')
    .eq('user_id', bailey.id)
  console.log('Subscriptions:', JSON.stringify(subs, null, 2))
}
main()
