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
