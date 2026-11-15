/**
 * Where a user goes right after OAuth sign-in (/auth/callback).
 *
 * Not onboarded → Yuri onboarding, paid or free. The paywall fires at the END
 * of onboarding (the value moment, commit 68acafe). This used to send every
 * free user straight to /subscribe, so Google sign-ups — which all land on the
 * callback — met the $24.99 wall 3 seconds after creating an account and never
 * talked to Yuri (13 of 14 Google sign-ups Jul 15 – Oct 14 2026). Same rule as
 * the email login page.
 */
export interface PostSignInProfile {
  plan?: string | null
  onboarding_completed?: boolean | null
}

export function postSignInDestination(
  profile: PostSignInProfile | null | undefined
): '/onboarding' | '/dashboard' | '/subscribe' {
  if (!profile?.onboarding_completed) return '/onboarding'
  const paid = !!profile.plan && profile.plan !== 'free'
  return paid ? '/dashboard' : '/subscribe'
}

/**
 * Where the in-app gate (AppShell) sends an account that opened a member page.
 * `null` means let them in.
 *
 * `setupStatus` is `ss_onboarding_progress.onboarding_status`; pass `undefined`
 * when it could not be read. It is needed because the profile flag alone does
 * not say whether setup is finished: `onboarding_completed` turns true as soon
 * as a skin type is known, a turn or two into the chat.
 *
 * Unpaid and still in setup goes back to the setup chat. The gate used to check
 * the plan first, so a new free account that tapped a menu item during setup
 * was sent to the pricing page, which has no link back (Nov 14 2026: sign-up,
 * greeting, pricing page in 29 seconds, and nothing after).
 *
 * A setup already marked completed or skipped is never sent back to the setup
 * chat, whatever the profile flag says: that page sends a finished setup on to
 * a member page, so the two would pass the account back and forth for ever.
 */
export function appGateDestination(
  profile: PostSignInProfile | null | undefined,
  setupStatus: string | null | undefined
): '/onboarding' | '/subscribe' | null {
  const paid = !!profile?.plan && profile.plan !== 'free'
  const finished = setupStatus === 'completed' || setupStatus === 'skipped'
  const hasProfile = !!profile?.onboarding_completed
  if (paid) return !finished && !hasProfile ? '/onboarding' : null
  const inSetup = !finished && (setupStatus === 'in_progress' || !hasProfile)
  return inSetup ? '/onboarding' : '/subscribe'
}
