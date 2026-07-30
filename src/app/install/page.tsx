'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Share, Plus, MoreVertical, Check, AlertCircle, Smartphone } from 'lucide-react'

/**
 * Public install instructions — /install
 *
 * WHY THIS PAGE EXISTS (July 29 2026)
 *
 * Scott and Bailey deleted their home-screen icons in order to re-add them from
 * the canonical origin (the apex-vs-www session fix), and then could not find the
 * card telling them how: "Neither of us have this card on our landing page to
 * help us install the icon."
 *
 * Every piece of install help lived on /dashboard — behind login, behind the
 * paywall, and DISMISSIBLE. That is exactly backwards for this task:
 *
 *   - Someone who just deleted their icon may be logged out (that was the
 *     original bug), so a logged-in-only surface is unreachable.
 *   - Anyone who tapped "Don't show this again" burned the only route, forever,
 *     with no way to bring it back.
 *   - Installing is a PRE-login action. A visitor should be able to install
 *     before ever having an account.
 *
 * So this page is public, permanent, never dismissible, and linked from the
 * footer. It is also the honest place to send someone from a text message —
 * "go to seoulsister.com/install" is a thing you can say out loud.
 *
 * The instructions are browser-SPECIFIC because they have to be. Apple exposes
 * no programmatic install, so showing the actual taps is the only thing that
 * works, and the taps differ per browser. Getting this wrong sends someone
 * hunting for a button that is not there — the same failure the iOS install
 * prompt had before it was fixed.
 */

type Browser = 'ios-safari' | 'ios-other' | 'android-chrome' | 'desktop' | 'unknown'

function detectBrowser(): Browser {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  const isIOS =
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)

  if (isIOS) {
    // Chrome/Firefox/Edge on iOS CANNOT add to home screen — only Safari can.
    // Telling them to tap Share would send them to a dead end.
    return /CriOS|FxiOS|EdgiOS|OPiOS/.test(ua) ? 'ios-other' : 'ios-safari'
  }
  if (/Android/.test(ua)) return 'android-chrome'
  return 'desktop'
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

const CANONICAL_HOST = 'www.seoulsister.com'

export default function InstallPage() {
  const [browser, setBrowser] = useState<Browser>('unknown')
  const [installed, setInstalled] = useState(false)
  const [host, setHost] = useState('')

  useEffect(() => {
    setBrowser(detectBrowser())
    setInstalled(isStandalone())
    setHost(window.location.hostname)
  }, [])

  // The apex and www are separate origins and only www holds the session, so an
  // install started here would inherit the broken one. This is the single most
  // important thing on the page for anyone re-adding their icon.
  const wrongOrigin = host === 'seoulsister.com'

  return (
    <div className="min-h-screen bg-seoul-darker text-white">
      <div className="max-w-lg mx-auto px-5 py-10">
        <Link href="/" className="text-xs text-gold-light hover:text-gold">
          &larr; Seoul Sister
        </Link>

        <div className="mt-6 flex items-center gap-3">
          <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-gold to-gold-light flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-5 h-5 text-seoul-dark" />
          </div>
          <div>
            <h1 className="font-display font-bold text-2xl">Add Seoul Sister to your phone</h1>
            <p className="text-sm text-white/50 mt-0.5">
              It opens full screen with its own icon — no address bar, no typing the web
              address, camera works the same.
            </p>
          </div>
        </div>

        {wrongOrigin && (
          <div className="mt-6 p-4 rounded-xl bg-gold/10 border border-gold/40">
            <div className="flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-gold flex-shrink-0 mt-0.5" />
              <div className="text-sm leading-snug">
                <p className="font-semibold text-white">Open this page on www first</p>
                <p className="mt-1 text-white/70">
                  You&apos;re on <span className="text-white/90">seoulsister.com</span>. An icon
                  added from here can&apos;t keep you signed in — that&apos;s the sign-in loop.
                </p>
                <a
                  href={`https://${CANONICAL_HOST}/install`}
                  className="inline-block mt-2.5 px-3.5 py-2 rounded-lg bg-gold text-seoul-dark text-sm font-semibold"
                >
                  Go to {CANONICAL_HOST}
                </a>
              </div>
            </div>
          </div>
        )}

        {installed && !wrongOrigin && (
          <div className="mt-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/30 flex items-start gap-3">
            <Check className="w-5 h-5 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-white/80">
              You&apos;re already running the installed app. Nothing to do.
            </p>
          </div>
        )}

        {!wrongOrigin && (
          <div className="mt-7">
            {browser === 'ios-safari' && (
              <Steps
                title="On iPhone or iPad (Safari)"
                steps={[
                  <>
                    Tap the Share button{' '}
                    <Share className="w-4 h-4 text-gold inline align-text-bottom" /> in
                    Safari&apos;s toolbar (bottom of the screen).
                  </>,
                  <>
                    Scroll down the list and choose{' '}
                    <Plus className="w-4 h-4 text-gold inline align-text-bottom" />{' '}
                    <span className="text-white font-medium">Add to Home Screen</span>.
                  </>,
                  <>
                    Tap <span className="text-white font-medium">Add</span> in the top-right
                    corner. The icon appears on your home screen.
                  </>,
                ]}
              />
            )}

            {browser === 'ios-other' && (
              <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <p className="text-sm font-semibold text-white">Switch to Safari first</p>
                <p className="mt-1.5 text-sm text-white/60 leading-snug">
                  On iPhone and iPad, only Safari can add an app to your home screen —
                  Chrome, Firefox and Edge can&apos;t, so there&apos;s no button to look for.
                  Open <span className="text-gold">{CANONICAL_HOST}/install</span> in Safari
                  and the steps will be here.
                </p>
              </div>
            )}

            {browser === 'android-chrome' && (
              <Steps
                title="On Android (Chrome)"
                steps={[
                  <>
                    Tap the menu{' '}
                    <MoreVertical className="w-4 h-4 text-gold inline align-text-bottom" /> in
                    the top-right corner.
                  </>,
                  <>
                    Choose <span className="text-white font-medium">Add to Home screen</span>{' '}
                    (or <span className="text-white font-medium">Install app</span>).
                  </>,
                  <>
                    Confirm with <span className="text-white font-medium">Install</span>.
                  </>,
                ]}
              />
            )}

            {(browser === 'desktop' || browser === 'unknown') && (
              <>
                <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                  <p className="text-sm font-semibold text-white">You&apos;re on a computer</p>
                  <p className="mt-1.5 text-sm text-white/60 leading-snug">
                    Seoul Sister installs on a desktop too — look for an install icon in your
                    browser&apos;s address bar, or the browser menu &rarr;{' '}
                    <span className="text-white/80">Install Seoul Sister</span>. But it&apos;s
                    built for your phone, and the camera features need one.
                  </p>
                </div>
                <p className="mt-5 text-xs uppercase tracking-wider text-gold font-semibold">
                  On your phone
                </p>
                <div className="mt-2 space-y-4">
                  <Steps
                    title="iPhone / iPad — Safari"
                    steps={[
                      <>
                        Tap Share{' '}
                        <Share className="w-4 h-4 text-gold inline align-text-bottom" /> in the
                        toolbar
                      </>,
                      <>
                        Choose{' '}
                        <span className="text-white font-medium">Add to Home Screen</span>, then{' '}
                        <span className="text-white font-medium">Add</span>
                      </>,
                    ]}
                  />
                  <Steps
                    title="Android — Chrome"
                    steps={[
                      <>
                        Tap the menu{' '}
                        <MoreVertical className="w-4 h-4 text-gold inline align-text-bottom" />
                      </>,
                      <>
                        Choose{' '}
                        <span className="text-white font-medium">Add to Home screen</span>
                      </>,
                    ]}
                  />
                </div>
              </>
            )}
          </div>
        )}

        <div className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10">
          <p className="text-sm font-semibold text-white">Already had the app and got signed out?</p>
          <p className="mt-1.5 text-sm text-white/60 leading-snug">
            Delete the old icon first (press and hold it, then remove), then add it again from{' '}
            <span className="text-gold">{CANONICAL_HOST}</span> using the steps above. Adding it
            without deleting the old one leaves the broken icon in place.
          </p>
        </div>

        <p className="mt-8 text-xs text-white/30">
          This page is always at{' '}
          <span className="text-white/50">{CANONICAL_HOST}/install</span> — no account needed.
        </p>
      </div>
    </div>
  )
}

function Steps({ title, steps }: { title: string; steps: React.ReactNode[] }) {
  return (
    <div className="p-4 rounded-xl bg-white/5 border border-white/10">
      <p className="text-sm font-semibold text-white">{title}</p>
      <ol className="mt-3 space-y-3">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm text-white/70 leading-snug">
            <span className="w-5 h-5 rounded-full bg-gold/20 text-gold text-xs font-semibold flex items-center justify-center flex-shrink-0 mt-0.5">
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
