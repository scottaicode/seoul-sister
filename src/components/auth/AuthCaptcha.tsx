'use client'

/**
 * Cloudflare Turnstile gate for the auth forms (register / login / forgot-password).
 *
 * WHY THIS EXISTS (July 28 2026)
 * A scripted attacker used Seoul Sister as a free spam relay: sign up as a
 * harvested victim address from a Tor exit node, wait ~60s, then fire three
 * password-reset requests in 15 seconds from a DIFFERENT hosting range (so the
 * signup and recovery IPs never correlate). Four accounts in 21 hours, zero
 * product engagement — the point was never an account, it was making OUR domain
 * mail strangers. Supabase's built-in rate limiter held (all 24 /recover
 * attempts returned 429 over_email_send_rate_limit, no abuse mail was ever
 * delivered), but that limiter is the last line, not the first.
 *
 * IP blocking was rejected: Tor exit lists rotate constantly and would need
 * forever-maintenance. A CAPTCHA closes the whole class generically.
 *
 * WHY TURNSTILE over hCaptcha/reCAPTCHA: free at unlimited volume, and
 * invisible for most real users — no "select all crosswalks" tax. That matters
 * because the measured problem in this funnel is strangers bouncing in seconds;
 * adding visible friction at registration would be self-defeating.
 *
 * GRACEFUL-DEGRADATION CONTRACT (important)
 * This component is a NO-OP until NEXT_PUBLIC_TURNSTILE_SITE_KEY is set. When
 * unset it renders nothing and immediately reports a null token, so the auth
 * forms keep working exactly as before. That lets this ship ahead of the
 * dashboard setup instead of holding the code hostage to a manual step, and it
 * means a Cloudflare outage degrades to "auth still works" rather than "nobody
 * can log in" — the same fail-open posture as the widget spend circuit breaker.
 *
 * The real enforcement is SERVER-SIDE in Supabase (Authentication > Bot and
 * Abuse Protection). Once that toggle is on, Supabase rejects any auth call
 * whose captcha token is missing or invalid — a client that skips this
 * component gets refused at the API. This file only obtains the token; it is
 * deliberately not a security boundary on its own.
 */

import { useRef, useImperativeHandle, forwardRef } from 'react'
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile'

/** Set in Vercel once the Cloudflare Turnstile widget exists. Unset = disabled. */
const SITE_KEY = process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY

/** True when captcha is configured. Callers use this to decide whether to
 *  block submission on a missing token (see requireCaptchaToken below). */
export const captchaEnabled = Boolean(SITE_KEY)

export interface AuthCaptchaHandle {
  /** Reset the widget. MUST be called after a failed auth attempt — Turnstile
   *  tokens are single-use, so a retry with a spent token fails server-side and
   *  looks to the user like their correct password stopped working. */
  reset: () => void
}

interface AuthCaptchaProps {
  /** Receives the token on success, or null when it expires / errors out. */
  onToken: (token: string | null) => void
}

export const AuthCaptcha = forwardRef<AuthCaptchaHandle, AuthCaptchaProps>(
  function AuthCaptcha({ onToken }, ref) {
    const instanceRef = useRef<TurnstileInstance | null>(null)

    useImperativeHandle(ref, () => ({
      reset: () => {
        instanceRef.current?.reset()
        onToken(null)
      },
    }))

    if (!SITE_KEY) return null

    return (
      <div className="flex justify-center">
        <Turnstile
          ref={instanceRef}
          siteKey={SITE_KEY}
          options={{ theme: 'dark', size: 'flexible' }}
          onSuccess={(token) => onToken(token)}
          // Expiry and error both invalidate the held token. Reporting null
          // keeps the form's state honest instead of submitting a dead token.
          onExpire={() => onToken(null)}
          onError={() => onToken(null)}
        />
      </div>
    )
  }
)

/**
 * Guard for form submit handlers. Returns an error string to show the user, or
 * null when it is safe to proceed.
 *
 * When captcha is not configured this always returns null — the forms behave
 * exactly as they did before this feature, by design (see contract above).
 */
export function requireCaptchaToken(token: string | null): string | null {
  if (!captchaEnabled) return null
  if (!token) return 'Please complete the verification check below.'
  return null
}
