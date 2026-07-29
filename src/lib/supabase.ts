import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

/**
 * Browser Supabase client.
 *
 * The auth options below were previously ABSENT — `createClient(url, key)` with
 * no third argument. Bailey (July 29 2026): "I also relog in every single time."
 *
 * CORRECTION (later the same day): setting these did NOT fix that. `persistSession`
 * and `autoRefreshToken` are already the library defaults, so pinning them
 * changed no behaviour, and Bailey still landed on /login after closing the app.
 * The database showed persistence had never been broken — her session was
 * created at 13:57 and successfully refreshed at 20:11.
 *
 * The actual cause was in AuthContext, which discarded the `error` from
 * `getSession()` and so treated a cold-launch AuthRetryableFetchError as a
 * logout. See the comment there. These options are still worth keeping — the
 * pinned storageKey below is genuine protection — but they are documentation
 * and upgrade-safety, NOT the session-persistence fix. Do not read this block
 * as the reason logins stick.
 *
 * Session transport is localStorage rather than cookies BY DESIGN: every API
 * route here authenticates from an `Authorization: Bearer` header taken from
 * `supabase.auth.getSession()`, not from a cookie. Switching to @supabase/ssr
 * would mean rewriting the auth read in all 150 files importing this module,
 * for no gain given that transport.
 */
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Keep the session across launches, tab closes, and app restarts.
    persistSession: true,
    // Refresh before expiry so a returning user is never bounced to /login
    // holding an expired-but-present token.
    autoRefreshToken: true,
    // Pin the storage key EXPLICITLY, and pin it to the value supabase-js
    // already derives from the project ref (`sb-<ref>-auth-token`). Naming it
    // ourselves means a future library upgrade cannot silently change it and
    // sign everyone out — while matching the current value means shipping this
    // fix does not sign anyone out either. Do NOT "tidy" this into a
    // brand-styled key: that is a one-time forced logout for every user.
    storageKey: `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`,
    // Magic-link / OAuth callbacks arrive as URL fragments.
    detectSessionInUrl: true,
  },
})

export function getServiceClient() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) {
    throw new Error('Missing SUPABASE_SERVICE_ROLE_KEY')
  }
  return createClient(supabaseUrl!, serviceKey)
}
