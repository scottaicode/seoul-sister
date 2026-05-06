'use client'

/**
 * Dismissible hero callout that introduces the camera label scanner to users
 * who have never used it (or haven't used it in the current billing period).
 *
 * Why this exists: the label scanner is the platform's biggest differentiator,
 * but new subscribers often miss it. Bailey, our most engaged user, used it
 * exactly once in 3 months (Feb 22). Surfacing it explicitly with a one-time
 * banner gets discoverability without being naggy.
 *
 * Behavior: shows for users with 0 scans this billing period UNTIL dismissed.
 * Dismissal is stored in localStorage with a versioned key so future updates
 * to the banner copy can re-trigger it if needed.
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Camera, X, Sparkles } from 'lucide-react'
import { supabase } from '@/lib/supabase'

const DISMISS_KEY = 'ss_scanner_discovery_dismissed_v1'

export default function ScannerDiscoveryBanner() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    let cancelled = false

    async function check() {
      // 1. Already dismissed in this browser? Done.
      try {
        if (localStorage.getItem(DISMISS_KEY) === '1') return
      } catch {
        // localStorage may be blocked; carry on
      }

      // 2. Has the user scanned anything in the current billing period?
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) return

      const periodStart = new Date()
      periodStart.setDate(1)
      periodStart.setHours(0, 0, 0, 0)

      const { count } = await supabase
        .from('ss_user_scans')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', periodStart.toISOString())

      if (!cancelled && (count ?? 0) === 0) setShow(true)
    }

    check()
    return () => { cancelled = true }
  }, [])

  if (!show) return null

  function dismiss() {
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // localStorage blocked; just hide for the session
    }
    setShow(false)
  }

  return (
    <section className="relative rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-white/5 to-transparent p-5 overflow-hidden">
      <button
        type="button"
        onClick={dismiss}
        aria-label="Dismiss"
        className="absolute top-3 right-3 p-1 text-white/40 hover:text-white/80 transition-colors"
      >
        <X className="w-4 h-4" strokeWidth={1.75} />
      </button>

      <div className="flex items-start gap-4">
        <div className="shrink-0 mt-1 p-2.5 rounded-xl bg-gold/15 border border-gold/30">
          <Camera className="w-5 h-5 text-gold" strokeWidth={1.75} />
        </div>

        <div className="flex-1 min-w-0 pr-6">
          <div className="flex items-center gap-1.5 mb-1.5">
            <Sparkles className="w-3.5 h-3.5 text-gold" strokeWidth={1.75} />
            <span className="text-[11px] font-medium text-gold uppercase tracking-wide">
              You haven&apos;t tried this yet
            </span>
          </div>
          <h3 className="font-display font-semibold text-base text-white mb-1.5">
            Scan any Korean label, get the full ingredient breakdown
          </h3>
          <p className="text-sm text-white/70 leading-relaxed mb-3">
            Point your camera at any K-beauty product — even one you can&apos;t read.
            Yuri translates the Korean ingredients, flags anything that conflicts
            with your skin, and matches it to your routine in seconds.
          </p>

          <div className="flex items-center gap-3">
            <Link
              href="/scan"
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-gold text-deep-black text-sm font-medium hover:bg-gold-light transition-colors"
            >
              <Camera className="w-3.5 h-3.5" strokeWidth={2} />
              Try the scanner
            </Link>
            <button
              type="button"
              onClick={dismiss}
              className="text-xs text-white/50 hover:text-white/80 transition-colors"
            >
              Maybe later
            </button>
          </div>
        </div>
      </div>
    </section>
  )
}
