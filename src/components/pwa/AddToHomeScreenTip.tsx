'use client'

import { useState, useEffect } from 'react'
import { Share, Plus, X, Smartphone } from 'lucide-react'

const DISMISSED_KEY = 'ss-home-screen-tip-dismissed'

/**
 * A dashboard card that tells new subscribers Seoul Sister installs.
 *
 * Requested by Bailey (July 29 2026), after she and the platform's most engaged
 * subscriber both discovered by accident that this was possible:
 *
 *   "I HAD NO IDEA ABOUT THE APP THING / THAT CHANGES EVERYTHING"
 *   "I was retyping seoulsister into web EVERY SINGLE TIME"
 *   "We need some tip sheet pop up as soon as someone signs up on how to
 *    download that as an app. Seriously HUGE also I guarantee a lot don't
 *    realize that's possible since neither Caroline or I did"
 *
 * This is deliberately NOT a modal. It sits in the dashboard flow, states the
 * benefit, and can be dismissed forever in one tap. The floating InstallPrompt
 * still handles the Chromium `beforeinstallprompt` path; this covers the case
 * that path cannot reach — iOS, where Apple exposes no install API at all and
 * showing someone the two taps is the only thing that works.
 */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  )
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

/**
 * True when the app is running from the apex rather than the canonical www
 * origin — i.e. this install is the broken kind.
 *
 * An install added from seoulsister.com is anchored there permanently; the
 * manifest fix only applies to NEW installs. Such an app boots on the apex,
 * 307s to www, and lands with no readable session because localStorage is
 * partitioned per origin — a login screen on every launch (Bailey, July 29
 * 2026, filmed). The manifest cannot relocate it. Only re-adding the icon can.
 *
 * This is deliberately checked on the ORIGIN the document ended up on, so it
 * stays correct after the redirect resolves.
 */
function isWrongOrigin(): boolean {
  if (typeof window === 'undefined') return false
  const host = window.location.hostname
  return host === 'seoulsister.com'
}

export default function AddToHomeScreenTip() {
  const [visible, setVisible] = useState(false)
  const [ios, setIos] = useState(false)
  const [reinstall, setReinstall] = useState(false)

  useEffect(() => {
    // A broken install suppresses BOTH install surfaces, because it really is
    // running standalone — so the one person who most needs to be told
    // something is wrong would otherwise be told nothing, forever. This case
    // is checked FIRST and deliberately ignores both the standalone check and
    // the dismissed flag: it is not a discoverability nudge, it is the only
    // route out of an app that cannot hold a login.
    if (isWrongOrigin()) {
      setIos(isIOS())
      setReinstall(true)
      setVisible(true)
      return
    }

    // Nothing to say to someone who already installed it.
    if (isStandalone()) return
    if (localStorage.getItem(DISMISSED_KEY)) return
    setIos(isIOS())
    setVisible(true)
  }, [])

  if (!visible) return null

  const dismiss = () => {
    setVisible(false)
    localStorage.setItem(DISMISSED_KEY, Date.now().toString())
  }

  return (
    <div className="glass-card p-4 border border-gold/20">
      <div className="flex items-start gap-3">
        <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold to-gold-light flex items-center justify-center flex-shrink-0">
          <Smartphone className="w-4 h-4 text-seoul-dark" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">
            {reinstall
              ? 'Re-add this app to fix the sign-in loop'
              : 'Seoul Sister works as an app on your phone'}
          </p>
          <p className="text-xs text-white/50 mt-1">
            {reinstall ? (
              <>
                This icon was added from the old web address, so it can&apos;t keep you
                signed in — that&apos;s why it asks you to log in every time. Delete the
                icon from your home screen, then add it again from{' '}
                <span className="text-gold">www.seoulsister.com</span>. Takes about ten
                seconds and it&apos;s the last time you&apos;ll have to do it.
              </>
            ) : (
              <>
                Add it to your home screen and it opens full screen with its own icon — no
                address bar, no typing the web address, camera works the same. Most people
                never realise this is possible.
              </>
            )}
          </p>

          {reinstall ? (
            <ol className="mt-3 space-y-1.5 text-xs text-white/70">
              <li className="flex items-start gap-1.5">
                <span className="text-white/40">1.</span> Press and hold this app&apos;s
                icon on your home screen, then delete it
              </li>
              <li className="flex items-start gap-1.5">
                <span className="text-white/40">2.</span> Open Safari to{' '}
                <span className="text-gold">www.seoulsister.com</span>
              </li>
              {ios ? (
                <li className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-white/40">3.</span> Tap
                  <Share className="w-3.5 h-3.5 text-gold" aria-label="the Share button" />
                  then
                  <Plus className="w-3.5 h-3.5 text-gold" aria-hidden="true" />
                  &quot;Add to Home Screen&quot;
                </li>
              ) : (
                <li className="flex items-start gap-1.5">
                  <span className="text-white/40">3.</span> Open the browser menu and
                  choose <span className="text-gold">Install app</span>
                </li>
              )}
            </ol>
          ) : ios ? (
            <ol className="mt-3 space-y-1.5 text-xs text-white/70">
              <li className="flex items-center gap-1.5">
                <span className="text-white/40">1.</span> Tap
                <Share className="w-3.5 h-3.5 text-gold" aria-label="the Share button" />
                in Safari&apos;s toolbar
              </li>
              <li className="flex items-center gap-1.5">
                <span className="text-white/40">2.</span> Choose
                <Plus className="w-3.5 h-3.5 text-gold" aria-hidden="true" />
                &quot;Add to Home Screen&quot;
              </li>
            </ol>
          ) : (
            <p className="mt-3 text-xs text-white/70">
              Open your browser menu and choose <span className="text-gold">Install app</span>{' '}
              or <span className="text-gold">Add to Home screen</span>.
            </p>
          )}

          {/* No dismiss on the re-install card: it is the only route out of an
              app that cannot hold a login, and hiding it strands the user. */}
          {!reinstall && (
            <button
              onClick={dismiss}
              className="mt-3 text-xs text-white/40 hover:text-white/70 transition-colors"
            >
              Don&apos;t show this again
            </button>
          )}
        </div>
        {!reinstall && (
          <button
            onClick={dismiss}
            className="text-white/30 hover:text-white/60"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>
    </div>
  )
}
