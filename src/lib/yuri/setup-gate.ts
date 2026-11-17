import { getServiceClient } from '@/lib/supabase'
import { stillInSetup, SETUP_REQUIRED_MESSAGE } from '@/lib/yuri/setup-requirements'
import { AppError } from '@/lib/utils/error-handler'

/**
 * The server side of "no member feature before setup is finished" (Nov 17
 * 2026). The app's own gate (AppShell) only moves the page; this is what a
 * typed address, a stale page or a direct request meets.
 *
 * Returns a Response to send back when the account is still in setup, or null
 * to carry on. A read that fails lets the request through and says so in the
 * log: a member who finished setup must not lose the product to a database
 * hiccup, and the app gate has usually already decided.
 */
export async function setupRequiredResponse(userId: string): Promise<Response | null> {
  const db = getServiceClient()
  const [progress, profile] = await Promise.all([
    db.from('ss_onboarding_progress').select('onboarding_status').eq('user_id', userId).maybeSingle(),
    db.from('ss_user_profiles').select('onboarding_completed').eq('user_id', userId).maybeSingle(),
  ])
  if (progress.error || profile.error) {
    console.error('[setup gate] could not read setup state; letting the request through:', progress.error?.message ?? profile.error?.message)
    return null
  }
  const status = (progress.data?.onboarding_status as string | null | undefined) ?? null
  if (!stillInSetup(status, profile.data?.onboarding_completed === true)) return null
  return new Response(JSON.stringify({ error: SETUP_REQUIRED_MESSAGE, code: 'setup_required' }), {
    status: 403,
    headers: { 'Content-Type': 'application/json' },
  })
}

/** The same check for routes that answer through `handleApiError`: throws a 403 with code `setup_required`. */
export async function requireSetupFinished(userId: string): Promise<void> {
  if (await setupRequiredResponse(userId)) throw new AppError(SETUP_REQUIRED_MESSAGE, 403, 'setup_required')
}
