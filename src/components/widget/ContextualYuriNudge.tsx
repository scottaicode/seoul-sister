'use client'

import { useEffect, useRef, useState } from 'react'
import { Sparkles, X } from 'lucide-react'
import { useRouter } from 'next/navigation'
import { AnimatePresence, motion } from 'framer-motion'
import { trackEvent, NudgeEvent } from '@/lib/analytics'

interface ContextualYuriNudgeProps {
  /**
   * Which feeder page this is. `category` covers the /best/[category] "best Korean
   * X" pages — which are the TOP AI-search landing pages (per Bing AI Performance,
   * /best/serums is the #1 cited page) and had NO nudge at all until Jul 13 2026:
   * their only Yuri path was a CTA at line 557 of a 587-line page that nobody
   * scrolls to. That was the single highest-value leak in the funnel.
   */
  kind: 'product' | 'ingredient' | 'category'
  /** Display name of the thing on this page (product, ingredient, or category title). */
  name: string
  /** Optional brand, for products. */
  brand?: string | null
}

// Engagement thresholds — only nudge an INTERESTED visitor, never on instant
// arrival (that reads as a popup ad and breaks the honest-insider trust).
// `ratio` below = the viewport's BOTTOM edge as a fraction of the page, so on a
// scrollable page any real scroll past 40% fires it. SHORT pages (e.g. an
// ingredient with little to scroll) can't meaningfully scroll, so the 9s dwell
// timer is what surfaces it there — short enough that engaged readers see it
// before they leave, long enough not to feel like an instant popup.
const SCROLL_TRIGGER = 0.4
const DWELL_TRIGGER_MS = 9000

/**
 * Contextual, engagement-triggered nudge that feeds the landing Yuri widget.
 * References the specific product/ingredient on the page, appears only after the
 * visitor shows interest (scroll depth or dwell), is dismissible (and stays
 * dismissed for the session), and routes to the single front door
 * (/?ask=<question>&from=<kind>) with the visitor's question prefilled.
 * Yuri owns the answer from there (AI-First).
 */
export default function ContextualYuriNudge({ kind, name, brand }: ContextualYuriNudgeProps) {
  const router = useRouter()
  const [visible, setVisible] = useState(false)
  const shownTrackedRef = useRef(false)
  const dismissKey = `yuri_nudge_dismissed_${kind}`

  // The visitor's seeded opening question (not a Yuri script — Yuri answers freely).
  //
  // WHY THIS WORDING (Jul 13 2026 — the feeder leak):
  // 217 engaged readers saw this nudge; ~3 clicked (~1%). The mechanism was fine
  // (engagement-gated, dismissible, prefilled, routes to FREE Yuri). The OFFER was
  // the problem: it asked "curious whether X is right for your skin?" of someone who
  // had just read a comprehensive page answering exactly that. We were offering them
  // the thing they already had.
  //
  // The page can explain what an ingredient is, how it works, and how it scores by
  // skin type. The one thing it structurally CANNOT know is WHAT ELSE IS IN THIS
  // PERSON'S BATHROOM. That is Yuri's only real edge, and the nudge never mentioned
  // it. So the seed now asks the question the page cannot answer: does this conflict
  // with what I'm already using?
  //
  // AI-First: this seeds the VISITOR's opening message. Yuri still answers freely.
  //
  // The CATEGORY page ("best Korean serums") has a different gap: the reader is
  // staring at 20 ranked options and cannot tell which one is for THEM. A list
  // cannot answer "which of these, for my skin?" — Yuri can.
  const question =
    kind === 'product'
      ? `I'm looking at ${[brand, name].filter(Boolean).join(' ')}. Will it conflict with what I'm already using?`
      : kind === 'category'
        ? `I'm looking at your ${name} list. Which one is actually right for my skin?`
        : `Will ${name} conflict with anything already in my routine?`

  useEffect(() => {
    if (typeof window === 'undefined') return
    // Respect a prior dismissal for this page-type this session.
    if (sessionStorage.getItem(dismissKey)) return

    let done = false
    const reveal = () => {
      if (done) return
      done = true
      setVisible(true)
      cleanup()
    }

    const onScroll = () => {
      const scrolled = window.scrollY + window.innerHeight
      const ratio = scrolled / document.documentElement.scrollHeight
      if (ratio >= SCROLL_TRIGGER) reveal()
    }

    const timer = window.setTimeout(reveal, DWELL_TRIGGER_MS)
    window.addEventListener('scroll', onScroll, { passive: true })

    function cleanup() {
      window.clearTimeout(timer)
      window.removeEventListener('scroll', onScroll)
    }
    return cleanup
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dismissKey])

  // Fire the shown event once, when it actually becomes visible.
  useEffect(() => {
    if (visible && !shownTrackedRef.current) {
      shownTrackedRef.current = true
      trackEvent(NudgeEvent.shown, { kind })
    }
  }, [visible, kind])

  const dismiss = () => {
    setVisible(false)
    try {
      sessionStorage.setItem(dismissKey, '1')
    } catch {
      // sessionStorage can throw in private mode — non-critical.
    }
  }

  const accept = () => {
    trackEvent(NudgeEvent.click, { kind })
    router.push(`/?ask=${encodeURIComponent(question)}&from=${kind}`)
  }

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 24 }}
          transition={{ duration: 0.3, ease: 'easeOut' }}
          className="fixed bottom-4 left-1/2 -translate-x-1/2 z-40 w-[calc(100vw-2rem)] max-w-md
                     rounded-2xl bg-seoul-card/95 backdrop-blur-xl border border-gold/30 shadow-glow-gold
                     p-4 flex items-start gap-3"
          role="dialog"
          aria-label="Ask Yuri"
        >
          <Sparkles className="w-5 h-5 text-gold shrink-0 mt-0.5" />
          <div className="flex-1 min-w-0">
            {/* The offer must be what this PAGE CANNOT ANSWER. The page already
                explains the ingredient/product; asking "curious whether it's right
                for you?" offers the reader what they just finished reading. The gap
                is their OWN routine — what they already own, and whether this
                collides with it. That is the only thing worth clicking for. */}
            <p className="text-sm text-white/90 leading-relaxed">
              {kind === 'product'
                ? `Already using other actives? Yuri can check whether ${name} clashes with them.`
                : kind === 'category'
                  ? `Not sure which one is for you? Tell Yuri your skin type and what you already use.`
                  : `Tell Yuri what you already use and she'll check whether ${name} conflicts with it.`}{' '}
              <span className="text-white/50">Free, no signup.</span>
            </p>
            <button
              onClick={accept}
              className="mt-3 inline-flex items-center gap-1.5 glass-button-primary text-xs py-2 px-4"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {kind === 'category' ? 'Which one for me?' : 'Check my routine'}
            </button>
          </div>
          <button
            onClick={dismiss}
            aria-label="Dismiss"
            className="shrink-0 text-white/30 hover:text-white/60 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
