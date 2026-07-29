'use client'

import { useState, useEffect } from 'react'
import { Download, X, Share, Plus } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const VISIT_COUNT_KEY = 'ss-app-visits'
const DISMISSED_KEY = 'pwa-prompt-dismissed'
const MIN_VISITS_TO_SHOW = 2

/**
 * iOS Safari NEVER fires `beforeinstallprompt` — that event is Chromium-only.
 *
 * This component previously did all its work inside that listener, so on iPhone
 * it was dead code: the prompt could not appear, ever. Seoul Sister's founder
 * and its most engaged subscriber both used the product for months without
 * knowing it installs at all ("I HAD NO IDEA ABOUT THE APP THING / THAT CHANGES
 * EVERYTHING", July 29 2026), and one of them had been retyping the URL every
 * single session. For a Gen Z beauty audience — overwhelmingly iPhone — that is
 * most of the user base.
 *
 * Apple exposes no programmatic install trigger, so the only thing that works
 * on iOS is telling someone where the button is. Hence two modes below.
 */
function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent
  return (
    /iPad|iPhone|iPod/.test(ua) ||
    // iPadOS 13+ reports as Mac; the touch-point check disambiguates.
    (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
  )
}

/** Installing from iOS is only possible in Safari — not Chrome/Firefox on iOS. */
function isIOSSafari(): boolean {
  if (!isIOS()) return false
  const ua = navigator.userAgent
  return !/CriOS|FxiOS|EdgiOS|OPiOS/.test(ua)
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    // iOS Safari's own flag, set when launched from the home screen.
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  )
}

export default function InstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [iosMode, setIosMode] = useState(false)

  useEffect(() => {
    // Already installed, or they've told us no.
    if (isStandalone()) return
    if (localStorage.getItem(DISMISSED_KEY)) return

    const visits = parseInt(localStorage.getItem(VISIT_COUNT_KEY) || '0', 10) + 1
    localStorage.setItem(VISIT_COUNT_KEY, visits.toString())
    if (visits < MIN_VISITS_TO_SHOW) return

    // iOS path: no event will ever arrive, so show instructions directly.
    if (isIOSSafari()) {
      setIosMode(true)
      const t = setTimeout(() => setShowPrompt(true), 4000)
      return () => clearTimeout(t)
    }

    // Chromium path: wait for the browser to tell us it's installable.
    const handler = (e: Event) => {
      e.preventDefault()
      setDeferredPrompt(e as BeforeInstallPromptEvent)
      setTimeout(() => setShowPrompt(true), 4000)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const handleInstall = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') setShowPrompt(false)
    setDeferredPrompt(null)
  }

  const handleDismiss = () => {
    setShowPrompt(false)
    localStorage.setItem(DISMISSED_KEY, Date.now().toString())
  }

  if (!showPrompt) return null

  return (
    <div className="fixed bottom-20 md:bottom-6 left-4 right-4 md:left-auto md:right-6 md:w-80 z-50 animate-fade-in">
      <div className="glass-card-strong p-4 shadow-xl border border-gold/20">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-gold-light flex items-center justify-center flex-shrink-0">
            <Download className="w-5 h-5 text-seoul-dark" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white">Add Seoul Sister to your home screen</p>
            <p className="text-xs text-white/50 mt-0.5">
              {iosMode
                ? 'It opens like a real app — full screen, no address bar, camera and all.'
                : 'Opens full screen like a native app. No typing the address every time.'}
            </p>
          </div>
          <button
            onClick={handleDismiss}
            className="text-white/30 hover:text-white/60"
            aria-label="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {iosMode ? (
          // Apple gives no install API — the only thing that works is showing
          // people the two taps. Icons mirror what they'll actually see.
          <>
            <ol className="mt-3 space-y-2 text-xs text-white/70">
              <li className="flex items-center gap-2">
                <span className="text-white/40">1.</span>
                <span className="flex items-center gap-1.5">
                  Tap
                  <Share className="w-3.5 h-3.5 text-gold" aria-label="the Share button" />
                  in Safari&apos;s toolbar
                </span>
              </li>
              <li className="flex items-center gap-2">
                <span className="text-white/40">2.</span>
                <span className="flex items-center gap-1.5">
                  Choose
                  <Plus className="w-3.5 h-3.5 text-gold" aria-hidden="true" />
                  &quot;Add to Home Screen&quot;
                </span>
              </li>
            </ol>
            <button
              onClick={handleDismiss}
              className="w-full mt-3 py-2 rounded-lg bg-gold text-seoul-dark text-sm font-semibold hover:bg-gold-light transition-colors"
            >
              Got it
            </button>
          </>
        ) : (
          <div className="flex gap-2 mt-3">
            <button
              onClick={handleInstall}
              className="flex-1 py-2 rounded-lg bg-gold text-seoul-dark text-sm font-semibold hover:bg-gold-light transition-colors"
            >
              Install
            </button>
            <button
              onClick={handleDismiss}
              className="px-4 py-2 rounded-lg bg-white/5 text-white/60 text-sm hover:bg-white/10 transition-colors"
            >
              Not now
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
