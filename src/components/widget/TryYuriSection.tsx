'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Sparkles, Send, Loader2, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import Link from 'next/link'
import {
  getMessageCount,
  setMessageCount,
  MAX_FREE_MESSAGES,
  onMessageCountChange,
  getOrCreateVisitorId,
  getWidgetSessionId,
  setWidgetSessionId,
} from '@/lib/utils/widget-session'
import { renderMarkdown, parseWidgetStream } from '@/lib/utils/widget-shared'
import type { WidgetMessage } from '@/lib/utils/widget-shared'
import { PRICING } from '@/lib/pricing'
import { trackEvent, DemoEvent, WidgetEvent } from '@/lib/analytics'
import { detectAiReferrer } from '@/lib/widget/ai-referrer'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

const QUICK_PROMPTS = [
  "I'm new to K-beauty, where do I start?",
  'Build me a routine on a budget',
  'What actually works for glass skin?',
  'Did I get a fake? / Am I overpaying?',
]

// Demo conversations shown before the visitor types. Two angles, one picked at
// random per load so different visitors see themselves:
//   1. "owner" — someone with a full shelf getting a real problem diagnosed
//      (memory of routine + live weather + INCI reads). The upgrade ceiling.
//   2. "beginner" — someone starting from zero, insecure, on a budget, getting a
//      real starter routine built. The emotional-relief angle.
// Nothing here is fabricated: every move (pulling weather, reading INCI, building
// a budget routine from real catalog products) is something live Yuri genuinely
// does. Beginner-demo product names + prices are real verified catalog entries.
//
// v11.9.1 (July 19 2026, Lynndon confusion report): the demo is no longer the
// FIRST thing a visitor sees — an unlabeled scripted transcript read as a real
// conversation already in progress, and pushed the quick prompts below the
// card's scroll. The pre-conversation state now leads with a greeting from
// Yuri + the quick prompts (the action layer), and renders only the demo's
// FIRST exchange below an explicit "Example" divider (the exhibit layer). The
// greeting lives ONLY in this render branch — it is never added to `messages`,
// so it never enters the history sent to the server (no scripted words in
// Yuri's real transcript).
type DemoMessage = { role: 'user' | 'assistant'; text: string }

const DEMO_OWNER: DemoMessage[] = [
  {
    role: 'user',
    text: 'My chin keeps breaking out in these little bumps. Is something in my routine doing it in this heat?',
  },
  {
    role: 'assistant',
    text: "I think I see it. It's 64% humidity where you are right now, and you've been wearing that MISSHA BB cream every single day as your only sunscreen. So it's basically sat on your chin and clogged it back up faster than your BHA can clear it at night. The good news: your Colorescience showed up, so you don't actually need the BB cream for sun protection anymore. Want to drop it for a couple weeks and see if your chin calms down?",
  },
  {
    role: 'user',
    text: 'Yes please. Are any of my other products gonna clog me too?',
  },
  {
    role: 'assistant',
    text: "I went through the ingredients on all six. Honestly? You're clean. Your Acwell toner, the Goodal Vita C, your COSRX BHA, all good (the BHA is actually the thing un-clogging you). The one I'd just keep an eye on is your Anua milky toner, it's a little rich, so if anything's still acting up after we pull the BB cream, that's the next one to test. Colorescience stays, it won't clog you. Let's give it two weeks and check back.",
  },
]

const DEMO_BEGINNER: DemoMessage[] = [
  {
    role: 'user',
    text: "Honestly I have zero products and no idea where to start. Everyone online has a 10-step routine and it's overwhelming. I just don't want to make my skin worse.",
  },
  {
    role: 'assistant',
    text: "Okay, first, breathe. You do not need 10 steps, and most of the people posting them don't either. Starting from zero is actually the easy mode, you get to skip every mistake. What's your budget, and is there one thing about your skin that's been bugging you? That tells me where to point you.",
  },
  {
    role: 'user',
    text: "Maybe like $40 to start? My skin gets kind of dry and dull and I break out sometimes.",
  },
  {
    role: 'assistant',
    text: "$40 is plenty for a real starter routine, here's exactly what I'd get: COSRX Low pH Gel Cleanser ($12), Beauty of Joseon Relief Sun ($15, this one matters most, dullness and dryness are often just sun damage), and Etude SoonJung Barrier Cream ($12.50) for the dry patches. That's it, $39.50, three steps. We add actives later once your skin's happy. Want me to walk you through the morning order?",
  },
]

const DEMO_SCRIPTS: DemoMessage[][] = [DEMO_OWNER, DEMO_BEGINNER]

// Stable label for the shown demo, used as the `demo_variant` GA4 dimension so
// we can read display→engagement rate per angle.
function demoVariantLabel(script: DemoMessage[]): 'owner' | 'beginner' {
  return script === DEMO_BEGINNER ? 'beginner' : 'owner'
}

interface TryYuriSectionProps {
  /** "hero" renders as embedded widget card; default renders as full-width section */
  variant?: 'hero' | 'section'
}

export default function TryYuriSection({ variant = 'section' }: TryYuriSectionProps) {
  const [messages, setMessages] = useState<WidgetMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [messageCount, setMessageCountState] = useState(0)
  const [showLive, setShowLive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  // Server-enforced cap. The client `messageCount` (localStorage) and the
  // server's lifetime `total_messages` per visitor_id can legitimately diverge
  // (cleared storage, another device, a shared-IP fallback). The SERVER is the
  // real gate — when it returns 429/`limitReached`, we flip this so the upsell
  // card renders and the input closes even when the local counter says we're
  // still under the limit. Without it, a server-blocked visitor saw only a
  // generic "Something went wrong" error and no way to subscribe.
  const [serverLimitReached, setServerLimitReached] = useState(false)
  // Email continue-gate (July 19 2026): the server blocks message N+ for a
  // visitor with no email on file (429 `emailRequired`). We stash the question
  // that got blocked, ask for the email, send the email THROUGH the chat (the
  // server's capture pipeline records it and Yuri acknowledges in her own
  // voice), then restore the stashed question into the input.
  const [emailGateActive, setEmailGateActive] = useState(false)
  const [pendingQuestion, setPendingQuestion] = useState<string | null>(null)
  // Transient "working…" status (e.g. a tool firing) shown inside the thinking
  // indicator before Yuri's first token, so a multi-second tool round-trip shows
  // motion instead of appearing frozen. Cleared the instant real text streams.
  const [statusLabel, setStatusLabel] = useState<string | null>(null)
  // Which demo script to show (owner vs beginner). Init deterministically to
  // avoid an SSR/client hydration mismatch, then randomize client-side on mount.
  const [demoScript, setDemoScript] = useState<DemoMessage[]>(DEMO_OWNER)
  // Must be attached to the element carrying `overflow-y-auto` — see the
  // scroll effect below for why putting it on an inner wrapper silently breaks.
  const messagesScrollRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setMessageCountState(getMessageCount())
    return onMessageCountChange((count) => setMessageCountState(count))
  }, [])

  // Pick a random demo angle on mount (client-only, post-hydration) and record
  // which one was shown so GA4 can grade engagement per variant.
  useEffect(() => {
    const picked = DEMO_SCRIPTS[Math.floor(Math.random() * DEMO_SCRIPTS.length)]
    setDemoScript(picked)
    trackEvent(DemoEvent.shown, { demo_variant: demoVariantLabel(picked) })
  }, [])

  // Fire the first-message engagement event once per session.
  const firstMessageTrackedRef = useRef(false)
  // The feeder source (blog/product/ingredient/nav/...) this visitor arrived
  // from, captured from ?from= so it can be persisted onto the widget session
  // for first-touch funnel attribution in our own data.
  const sourceRef = useRef<string | null>(null)
  const sourceSentRef = useRef(false)
  // The specific same-origin page this visitor arrived FROM (path only).
  const landingPathRef = useRef<string | null>(null)

  // Carry intent from a feeder page (blog/product/ingredient "Ask Yuri" CTA):
  // ?ask=<question> drops the visitor's question into the input and focuses it,
  // so they land on the big hero widget ready to send instead of cold-starting.
  // We prefill (visitor sends) rather than auto-send — they stay in control and
  // the demo conversation above stays visible. AI-First: Yuri owns the answer;
  // this only seeds the visitor's opening message.
  useEffect(() => {
    if (typeof window === 'undefined') return
    const params = new URLSearchParams(window.location.search)

    // ---- Source capture runs FOR EVERY ARRIVAL, not just feeder CTAs. --------
    // This used to sit BELOW the `!params.has('ask')` early-return, which meant
    // any visitor who landed WITHOUT an ?ask= was never tagged. That silently
    // broke the one funnel we actually care about: the BP108 Reddit bridge sends
    // people to `seoulsister.com/?utm_source=reddit&utm_medium=social&...` — no
    // `ask` param — so every Reddit arrival fell through and their widget session
    // was recorded as untagged. GA4 could see the LANDING, but our own data could
    // never answer the question that matters: "did the Reddit visitor actually
    // talk to Yuri?" ss_widget_sessions.source has never once said 'reddit'.
    //
    // utm_source is checked first (it's the standard the Reddit profile link and
    // any future paid/social campaign already use); ?from= remains for the
    // internal feeder CTAs (blog/product/ingredient/nav).
    const utm = (params.get('utm_source') || '').trim()
    const from = (params.get('from') || '').trim()
    if (utm || from) {
      sourceRef.current = utm || from
    } else {
      // ---- AI-assistant referrer fallback (July 27 2026) -------------------
      // Same class of blind spot as the Reddit gap above: an AI citation sends
      // a visitor with NO utm and NO from, so they fell through to 'landing'
      // and the channel was invisible in our own data. Bing Copilot alone was
      // citing Seoul Sister 525x/week with no way to tell whether ANY of those
      // readers reached Yuri.
      //
      // document.referrer is the only signal available for these arrivals. It
      // is empty for many AI surfaces (in-app webviews, stripped referrers), so
      // this RAISES the floor — it never claims certainty. A miss falls through
      // to 'landing' exactly as before.
      const ai = detectAiReferrer(document.referrer)
      if (ai) sourceRef.current = ai
      else if (document.referrer) {
        // ---- Raw referrer host fallback (Aug 9 2026) -------------------------
        // A social arrival whose params were stripped still usually carries a
        // referrer. Recording the HOST is strictly better than NULL: it cannot
        // claim a campaign, but it separates "came from tiktok.com" from "we
        // have no idea", which is the distinction 58 of 75 sessions could not
        // make. Sanitised to a short slug so it matches the server's schema.
        try {
          const host = new URL(document.referrer).hostname
            .replace(/^www\./, '')
            .toLowerCase()
          // Our own pages are not an external source; they're internal
          // navigation and would otherwise drown the real referrers.
          if (host && !host.endsWith('seoulsister.com')) {
            sourceRef.current = `ref_${host.replace(/[^a-z0-9]/g, '_').slice(0, 32)}`
          }
        } catch {
          // A malformed referrer is not worth a thrown error on the happy path.
        }
      }
    }

    // ---- The attribution FLOOR (Aug 9 2026) ---------------------------------
    // This used to live INSIDE the `?ask=` branch below, so every visitor who
    // arrived without a feeder CTA recorded `source = NULL`. Measured: 58 of 75
    // sessions in all of production history — 77% of every conversation Seoul
    // Sister has ever had — were NULL, including the best cold conversation of
    // Aug 9.
    //
    // NULL is the specific failure this repo keeps paying for: it cannot be
    // told apart from "the capture code never ran". 'landing' is a claim we can
    // actually stand behind — the visitor arrived at the landing page with no
    // campaign, no feeder tag, and no usable referrer — and it makes a genuine
    // gap visible instead of silent.
    if (!sourceRef.current) sourceRef.current = 'landing'

    // ---- WHICH page, not just which KIND of page (Sep 3 2026) ---------------
    // `source` is page-TYPE granular ('blog', 'product', 'ingredient_cta'), so
    // it can say a conversation came from "a blog post" but never WHICH one.
    // That is the gap under the site's biggest measured asymmetry: the blog
    // earns ~674 Google clicks per 28 days and yields ~4 widget conversations a
    // month, while blog visitors are the best traffic we have (6.4 avg messages
    // vs 3.7 from the landing page; 37.5% give an email). Without the specific
    // path, "which post converts" is unanswerable and every content bet is a
    // guess.
    //
    // Captured from the SAME-ORIGIN referrer, so no CTA on any feeder page has
    // to change. Deliberately PATH ONLY — never the querystring, which can
    // carry a prefilled ?ask= containing whatever the visitor typed, and never
    // an external referrer, whose query can carry a search term. Those are the
    // visitor's words, not a page identifier.
    try {
      if (document.referrer) {
        const ref = new URL(document.referrer)
        if (ref.hostname.replace(/^www\./, '').toLowerCase() === 'seoulsister.com') {
          const path = ref.pathname.slice(0, 200)
          // "/" is the landing page — already what `source` says. Recording it
          // would just add noise.
          if (path && path !== '/') landingPathRef.current = path
        }
      }
    } catch {
      // A malformed referrer must never break the widget.
    }

    // `ask` PRESENT (even empty) means the visitor clicked an "Ask Yuri" feeder
    // CTA and wants the chat. Non-empty prefills their question; empty just
    // focuses the widget (e.g. the nav "Ask Yuri" with no topic).
    if (!params.has('ask')) return
    const ask = (params.get('ask') || '').trim()
    // (The 'landing' floor moved ABOVE this early-return — see the comment
    // there. Leaving it here meant a non-CTA arrival was never tagged at all.)
    if (ask) setInput(ask)
    // Get the visitor to the INPUT, not just the page. On desktop the widget
    // sits in the right hero column already above the fold, so top-of-page shows
    // headline + widget together — keep that. On MOBILE the hero is single-column
    // and the widget renders BELOW the entire value-prop column (headline, copy,
    // stats, CTAs), so scrolling to top lands them on marketing copy with their
    // prefilled question far below the fold — they never see where to send it.
    // There, bring the widget itself into view. Breakpoint matches Tailwind `lg`.
    requestAnimationFrame(() => {
      const isMobile = window.matchMedia('(max-width: 1023px)').matches
      if (isMobile) {
        document.getElementById('hero-yuri')?.scrollIntoView({
          behavior: 'smooth',
          block: 'start',
        })
      } else {
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }
      inputRef.current?.focus({ preventScroll: true })
    })
    trackEvent(DemoEvent.prefillArrived, {
      source: sourceRef.current || 'unknown',
      has_question: ask.length > 0,
    })

    // ---- CONSUME the prefill so it cannot be re-armed (Aug 18 2026) ---------
    // `?ask=` used to survive in the URL after being consumed, so it
    // re-populated the input on EVERY load of that URL. Measured on the first
    // organic blog visitor: she sent the identical canned line from
    // blog-prefill.ts as messages #1, #3 and #8 of her 12 LIFETIME free
    // messages. #2 was 60 seconds after her substantive answer -- a
    // mid-conversation reload. A quarter of her quota went to a question she
    // never typed, and the duplicate was then laundered into her stored
    // ai_memory as "Visitor repeated initial question, suggesting possible
    // uncertainty about accepting the redirected advice" -- a UI defect turned
    // into a durable false read of her.
    //
    // Stripping beats a storage flag: no cleared-storage or cross-device
    // failure mode, no key to keep in sync with the visitor id, and
    // sessionStorage is per-tab so it would not have stopped occurrence #3 in
    // a new tab. `replaceState` (not pushState) keeps the back button intact
    // and is router-integrated in Next since 14.1; passing window.history.state
    // back preserves Next's internal state.
    //
    // NOTE this is the SMALLER half of the fix. She reloaded mid-conversation
    // and saw an EMPTY chat (messages live in React state only), so she would
    // have retyped with or without the param. See the transcript-restore effect
    // below, which is what actually stops the retype.
    //
    // ORDERING IS LOAD-BEARING, TWICE OVER:
    //  1. This runs AFTER the sourceRef capture and the prefillArrived event
    //     above -- both read the params, so stripping first would blind
    //     attribution. (It also stops prefillArrived re-firing on every reload,
    //     so expect that event's counts to DROP after this ships. That is the
    //     fix working, not a regression.)
    //  2. SignedInRedirect (src/components/auth/SignedInRedirect.tsx:62) reads
    //     window.location.search and keeps a signed-in user on this page only
    //     if `ask`/`from`/a hash is present -- otherwise it bounces them to
    //     /dashboard. It is mounted EARLIER in page.tsx (~line 115) than this
    //     component (~276), so its effect has already read `ask` by the time we
    //     strip it. If that JSX order is ever changed, or SignedInRedirect is
    //     lazy-loaded, a paying subscriber clicking a feeder CTA gets yanked to
    //     /dashboard. tests/widget-prefill-consumed.test.mjs asserts the order.
    try {
      params.delete('ask')
      const qs = params.toString()
      window.history.replaceState(
        window.history.state,
        '',
        `${window.location.pathname}${qs ? `?${qs}` : ''}${window.location.hash}`
      )
    } catch (err) {
      // Never let a URL rewrite break the prefill happy path -- but leave a
      // breadcrumb, so "the strip failed" is distinguishable from "the strip
      // worked" rather than both looking like silence.
      console.warn('[widget] prefill URL strip failed', err)
    }
  }, [])

  // ---- RESTORE a conversation a reload wiped (Aug 18 2026) -----------------
  // `messages` lives in React state ONLY, while the session id lives in
  // sessionStorage. So a mid-conversation reload showed an EMPTY chat while the
  // server still held every message, and Yuri (who HAS had server-side
  // rehydration since v11.2.0) knew a history the visitor could no longer see.
  //
  // The first organic blog visitor hit exactly this: 60 seconds after answering
  // a substantive question she reloaded, saw nothing, and re-sent her opening
  // question -- spending another of her 12 LIFETIME free messages. Stripping the
  // `?ask=` re-arm above stops the canned line coming back, but on its own it
  // would only have made her retype the same thing by hand. THIS is the half
  // that stops the retype.
  //
  // Deliberately conservative: only ever runs when a session id already exists
  // AND nothing is on screen yet, so it can never clobber a live conversation
  // or double-paint. Failure is silent by design -- an unrestored transcript
  // leaves the visitor exactly where they were before this shipped.
  useEffect(() => {
    const sessionId = getWidgetSessionId()
    if (!sessionId) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(
          `/api/widget/transcript?session_id=${encodeURIComponent(sessionId)}` +
            `&visitor_id=${encodeURIComponent(getOrCreateVisitorId())}`
        )
        if (!res.ok || cancelled) return
        const data = (await res.json()) as {
          messages?: Array<{ role: 'user' | 'assistant'; content: string }>
        }
        const restored = data.messages || []
        if (cancelled || restored.length === 0) return

        setMessages((current) => {
          // Re-check INSIDE the setter: the fetch is async, so the visitor may
          // have started typing a new message while it was in flight. Restoring
          // over that would destroy live content.
          if (current.length > 0) return current
          return restored.map((m, i) => ({
            id: `restored-${i}`,
            role: m.role,
            content: m.content,
          }))
        })
        // A restored transcript is a real conversation, so show the live chat
        // rather than the scripted example exhibit.
        setShowLive(true)
      } catch {
        // Never break the widget over a failed restore.
      }
    })()

    return () => {
      cancelled = true
    }
  }, [])

  // Abort any in-flight stream when component unmounts
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  const isAtLimit = messageCount >= MAX_FREE_MESSAGES || serverLimitReached

  // Scroll within the chat container, not the page.
  //
  // The ref MUST sit on the element that actually scrolls — the one carrying
  // `overflow-y-auto`. It previously sat on the inner `p-4 space-y-3` wrapper,
  // whose parent is the scrolling box, so `scrollTop = scrollHeight` was
  // written to a non-overflowing element: a silent no-op. The widget never
  // auto-scrolled at all, and nothing surfaced it because a chat that doesn't
  // follow its own stream looks like a styling preference, not a bug.
  //
  // The cost landed at the worst moment. The chat box is capped at 640px and
  // the paywall card renders as the LAST child, below the final answer — so
  // after a long closing message the card sits outside the visible region,
  // with `scrollbar-hide` removing any cue that there's more below. A visitor
  // who read a 1,400-character final answer (a real Aug 13 2026 conversation)
  // could reach the end of her preview and never see the subscribe card.
  //
  // `isAtLimit` is in the dep array on purpose: the card's arrival is driven by
  // `messageCount`, a SEPARATE state update from `messages`. Depending on
  // `messages` alone would scroll to the bottom of the last bubble and stop
  // there, one render before the card exists.
  useEffect(() => {
    const container = messagesScrollRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages, isAtLimit])

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || isAtLimit) return

      const trimmed = text.trim()
      setError(null)
      setStatusLabel(null)

      // Record the visitor's first engagement against the demo that was on
      // screen — this is the conversion signal GA4 grades each variant by.
      if (!firstMessageTrackedRef.current) {
        firstMessageTrackedRef.current = true
        trackEvent(DemoEvent.firstMessage, { demo_variant: demoVariantLabel(demoScript) })
      }

      setShowLive(true)

      // Abort any previous in-flight stream
      abortControllerRef.current?.abort()
      const controller = new AbortController()
      abortControllerRef.current = controller

      const userMsg: WidgetMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
      }
      const assistantMsg: WidgetMessage = {
        id: `a-${Date.now()}`,
        role: 'assistant',
        content: '',
        isStreaming: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])
      setInput('')
      setIsStreaming(true)

      try {
        const history = messages
          .filter((m) => !m.isStreaming)
          .map((m) => ({ role: m.role, content: m.content }))

        const includeSource = !sourceSentRef.current && sourceRef.current
        if (includeSource) sourceSentRef.current = true
        const response = await fetch('/api/widget/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            message: trimmed,
            history,
            visitor_id: getOrCreateVisitorId(),
            session_id: getWidgetSessionId(),
            // First-touch feeder attribution: send the source once, on the
            // request that will create the session. Server persists it.
            ...(includeSource ? { source: sourceRef.current } : {}),
            // Sent on the same turn as `source` — both are first-touch facts,
            // and both are written only when the session row is created (i.e.
            // on a REAL first message), so neither can be minted by a crawler.
            ...(includeSource && landingPathRef.current ? { landing_path: landingPathRef.current } : {}),
          }),
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          const errBody = await response.json().catch(() => null)
          // Two DIFFERENT server rejections both arrive as 429 — distinguish them
          // by the `limitReached` flag, NOT the bare status:
          //   • limitReached:true  → the per-VISITOR preview cap. This IS the
          //     conversion moment: show the upsell card, close the input.
          //   • rateLimited:true (limitReached false) → the per-IP/day ABUSE
          //     limit, which can false-trip for a brand-new visitor behind
          //     NAT/VPN. Show a transient retry message and KEEP the input open —
          //     never show the paywall to someone who hasn't hit their own cap.
          if (errBody?.limitReached) {
            setServerLimitReached(true)
            // Keep the local counter consistent so the "N remaining" copy and
            // the isAtLimit-gated UI agree with the server.
            setMessageCount(MAX_FREE_MESSAGES)
            setMessageCountState(MAX_FREE_MESSAGES)
            // Drop the empty placeholder assistant bubble we optimistically added.
            setMessages((prev) => prev.filter((m) => !m.isStreaming))
            trackEvent(WidgetEvent.sendFailed, { reason: 'limit_reached' })
            return
          }
          if (errBody?.emailRequired) {
            // Continue-gate, not the paywall: drop BOTH optimistic bubbles
            // (the server never processed this message), stash the question,
            // and open the email ask. Input stays open.
            setMessages((prev) => prev.filter((m) => m.id !== userMsg.id && m.id !== assistantMsg.id))
            setPendingQuestion((prev) => prev ?? trimmed)
            if (!emailGateActive) {
              setEmailGateActive(true)
              trackEvent(WidgetEvent.emailGateShown)
            }
            return
          }
          if (errBody?.capacityLimited) {
            // GLOBAL capacity breaker — Yuri is off across the whole site, not
            // this visitor's fault and NOT their cap. Never show the paywall
            // here: upselling someone because we're over budget is backwards.
            // Drop the placeholder, stash their question so it survives, and
            // open the email card — during a surge, capturing the lead IS the
            // degraded product. Input stays open so they can retry.
            setMessages((prev) => prev.filter((m) => !m.isStreaming))
            setPendingQuestion((prev) => prev ?? trimmed)
            setError(errBody?.error || 'Yuri is at capacity right now.')
            if (!emailGateActive) {
              setEmailGateActive(true)
              trackEvent(WidgetEvent.emailGateShown)
            }
            trackEvent(WidgetEvent.sendFailed, { reason: 'capacity_limited' })
            return
          }
          if (errBody?.rateLimited) {
            // Transient: drop the placeholder bubble, surface a soft retry,
            // leave the input open so they can try again in a moment.
            setMessages((prev) => prev.filter((m) => !m.isStreaming))
            setError(errBody?.error || 'Yuri is getting a lot of traffic right now. Give it a moment and try again.')
            trackEvent(WidgetEvent.sendFailed, { reason: 'rate_limited' })
            return
          }
          throw new Error(errBody?.error || 'Request failed')
        }

        // Server-authoritative remaining count captured from the done event —
        // used below to sync the local counter to the lifetime ledger.
        let serverRemaining: number | null = null

        await parseWidgetStream(response.body, controller.signal, {
          onStatus(label) {
            // Show the working status only until the first real token arrives.
            setStatusLabel(label)
          },
          onText(content) {
            // First token — the status has served its purpose; clear it.
            setStatusLabel(null)
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.isStreaming) {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + content,
                }
              }
              return updated
            })
          },
          onDone(cleanedMessage, sessionId, remaining) {
            setStatusLabel(null)
            if (sessionId) setWidgetSessionId(sessionId)
            if (typeof remaining === 'number') serverRemaining = remaining
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last?.isStreaming) {
                updated[updated.length - 1] = {
                  ...last,
                  isStreaming: false,
                  ...(cleanedMessage ? { content: cleanedMessage } : {}),
                }
              }
              return updated
            })
          },
          onError(err) {
            throw err
          },
        })

        // Sync the counter after a successful stream. Prefer the server's
        // lifetime ledger (fixes the drift where a returning visitor's local
        // 30-day counter said 8 remaining while the server said 4); fall back
        // to a local increment when the server didn't send a count.
        const newCount =
          serverRemaining !== null
            ? Math.max(0, MAX_FREE_MESSAGES - serverRemaining)
            : messageCount + 1
        setMessageCount(newCount)
        setMessageCountState(newCount)

        // Email gate satisfied: ANY send the server accepted while the gate
        // was showing means the gate is no longer binding (email captured, or
        // the server judged it satisfied another way) — clear the gate UI.
        // If the sent message was the email itself, also restore the stashed
        // question; if they typed a question directly, they've moved on.
        if (emailGateActive) {
          setEmailGateActive(false)
          if (/\S+@\S+\.\S+/.test(trimmed)) {
            trackEvent(WidgetEvent.emailGateSubmitted)
            if (pendingQuestion) {
              setInput(pendingQuestion)
            }
          }
          setPendingQuestion(null)
        }
      } catch (err) {
        if (err instanceof DOMException && err.name === 'AbortError') {
          setMessages((prev) => {
            const updated = [...prev]
            const last = updated[updated.length - 1]
            if (last?.isStreaming && last.content.trim()) {
              updated[updated.length - 1] = { ...last, isStreaming: false, isIncomplete: true }
              return updated
            }
            return prev.filter((m) => !m.isStreaming)
          })
          return
        }

        let hadPartialContent = false
        setMessages((prev) => {
          const updated = [...prev]
          const last = updated[updated.length - 1]
          if (last?.role === 'assistant' && last.isStreaming && last.content.trim()) {
            updated[updated.length - 1] = {
              ...last,
              isStreaming: false,
              isIncomplete: true,
            }
            hadPartialContent = true
            return updated
          }
          return prev.filter((m) => !m.isStreaming)
        })
        if (!hadPartialContent) {
          // Preview-cap 429s are handled up front (serverLimitReached), so this
          // path is now only genuine failures — network drops, 5xx, parse errors.
          // Record it: a failed send with zero content is invisible in the DB
          // (no session row) and otherwise looks identical to a chosen bounce.
          setError('Something went wrong. Please try again.')
          trackEvent(WidgetEvent.sendFailed, { reason: 'error' })
        }
      } finally {
        setIsStreaming(false)
        setStatusLabel(null)
      }
    },
    [isStreaming, isAtLimit, messageCount, messages, demoScript, emailGateActive, pendingQuestion]
  )

  // ---------- Chat content (shared between both variants) ----------
  const chatContent = (
    <>
      {/* Header */}
      <div className="flex items-center gap-3 px-5 py-3.5 bg-gold/5 border-b border-white/10 rounded-t-2xl">
        <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold to-gold-light flex items-center justify-center">
          <Sparkles className="w-4 h-4 text-seoul-dark" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-white">
            Yuri <span className="text-gold">(유리)</span>
          </p>
          <p className="text-xs text-white/40">Your honest K-beauty friend in Seoul. Ask me anything.</p>
        </div>
        {/* "Live" only once a real conversation is streaming — a scripted
            example under a "Live" badge read as a fake live chat (v11.9.1). */}
        <span className="badge-gold text-[10px] animate-pulse-soft">
          {showLive ? 'Live' : 'Free preview'}
        </span>
      </div>

      {/* Messages area — this is the scrolling element, so it owns the ref. */}
      <div ref={messagesScrollRef} className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        {/* Pre-conversation state: greeting + prompts first, labeled example below */}
        {!showLive && (
          <div className="p-4 space-y-3">
            {/* Yuri's greeting — the visitor's entry point. Identify + value +
                clear next step (the welcome-message pattern that beats a bare
                transcript for cold-visitor engagement). Static presentation
                copy: honest claims only, never sent to the server as history. */}
            <div className="flex justify-start">
              <div className="max-w-[88%] rounded-2xl px-4 py-3 text-sm leading-relaxed bg-white/5 border border-gold/25 text-white/85">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3 h-3 text-gold" />
                  <p className="font-semibold text-gold">Yuri</p>
                </div>
                Hey, I&apos;m Yuri, a K-beauty advisor who&apos;s honest to a fault.
                Tell me what you&apos;re using or what&apos;s bugging your skin and
                I&apos;ll give you my real read. Free, no signup. Start with one of
                these, or just type below:
              </div>
            </div>

            {/* Quick prompts — directly under the greeting so they're visible
                without scrolling (they were previously pushed below the demo,
                out of view at the card's fixed height). */}
            <div className="flex flex-wrap gap-2">
              {QUICK_PROMPTS.map((q) => (
                <button
                  key={q}
                  onClick={() => sendMessage(q)}
                  className="text-[11px] px-3 py-1.5 rounded-full bg-gold/10 text-gold-light hover:bg-gold/20 transition-colors border border-gold/20"
                >
                  {q}
                </button>
              ))}
            </div>

            {/* Labeled example — the with-an-account ceiling as an exhibit,
                never mistakable for the visitor's own conversation. First
                exchange only; every capability shown is genuine. */}
            <div className="pt-3 mt-1 border-t border-white/10">
              <p className="text-[10px] uppercase tracking-wider text-white/35 mb-2">
                {demoScript === DEMO_BEGINNER
                  ? 'Example — Yuri building a starter routine with a new member'
                  : 'Example — Yuri with a subscriber she’s known for months'}
              </p>
              <div className="space-y-3 opacity-80">
                {demoScript.slice(0, 2).map((m, i) => (
                  <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div
                      className={`max-w-[85%] rounded-2xl px-4 py-3 text-xs leading-relaxed ${
                        m.role === 'user'
                          ? 'bg-gradient-to-br from-gold to-gold-light text-seoul-dark'
                          : 'bg-white/5 border border-white/10 text-white/80'
                      }`}
                    >
                      {m.role === 'assistant' && (
                        <div className="flex items-center gap-1.5 mb-1">
                          <Sparkles className="w-3 h-3 text-gold" />
                          <p className="font-semibold text-gold">Yuri</p>
                        </div>
                      )}
                      {/* Clamp so the whole pre-chat state fits the card height
                          without scrolling — the exhibit shows her voice, it
                          doesn't need the full answer (that clipped behind the
                          input on common screen sizes). */}
                      <p className="line-clamp-3">{m.text}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Live messages */}
        {showLive && (
          <div className="p-4 space-y-3">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                    msg.role === 'user'
                      ? 'bg-gradient-to-br from-gold to-gold-light text-seoul-dark'
                      : 'bg-white/5 border border-white/10 text-white/80'
                  }`}
                >
                  {msg.role === 'assistant' && (
                    <div className="flex items-center gap-1.5 mb-1">
                      <Sparkles className="w-3 h-3 text-gold" />
                      <p className="font-semibold text-gold">Yuri</p>
                    </div>
                  )}
                  {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                  {msg.isStreaming && msg.content.length > 0 && (
                    <span className="inline-block w-1 h-3 bg-gold/60 animate-pulse ml-0.5 align-middle" />
                  )}
                  {msg.isStreaming && msg.content.length === 0 && (
                    <span className="flex items-center gap-1.5 py-0.5">
                      {/* Show the live tool status if we have one (motion during a
                          multi-second tool round-trip), else the default label. */}
                      <span className="text-gold/70 text-xs italic">{statusLabel ?? 'Yuri is thinking'}</span>
                      <span className="flex items-center gap-0.5">
                        <span className="w-1 h-1 rounded-full bg-gold/50 animate-pulse" />
                        <span className="w-1 h-1 rounded-full bg-gold/50 animate-pulse [animation-delay:150ms]" />
                        <span className="w-1 h-1 rounded-full bg-gold/50 animate-pulse [animation-delay:300ms]" />
                      </span>
                    </span>
                  )}
                  {msg.isIncomplete && (
                    <p className="text-[10px] text-amber-500/70 mt-1.5 italic">
                      (Response may be incomplete)
                    </p>
                  )}
                </div>
              </div>
            ))}

            {/* The paywall moment. This used to be a generic feature list, shown
                at the one instant we know the most about this visitor: Yuri has
                just spent a whole conversation on their actual skin. A visitor
                who has told her about their oily T-zone, their Austin humidity
                and the three products they already own does not need to be told
                what "6 specialist agents" are — they need to know that all of
                it is about to be lost, and that keeping it is what they'd be
                paying for. Continuity is the product; the feature list was
                answering a question nobody asked. (July 21 2026) */}
            {isAtLimit && (
              <div className="bg-gold/5 rounded-2xl p-4 border border-gold/20 text-center">
                <p className="text-sm text-white font-medium mb-1">
                  That&apos;s everything I can remember for free.
                </p>
                <p className="text-xs text-white/60 mb-1">
                  Everything you just told me about your skin disappears when you close this tab.
                </p>
                <p className="text-xs text-white/50 mb-3">
                  Subscribe and I keep all of it — your skin, what you already own, what
                  we ruled out — and we pick up here instead of starting over. That&apos;s
                  when I can actually build your routine and adjust it as your skin responds.
                </p>
                <Link
                  href="/register?plan=pro_monthly"
                  className="inline-flex items-center gap-1.5 glass-button-primary text-xs py-2 px-5"
                >
                  Keep going at {PRICING.monthly_display} <ArrowRight className="w-3 h-3" />
                </Link>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-red-500/10 border-t border-red-500/20">
          <p className="text-xs text-red-400 text-center">{error}</p>
        </div>
      )}

      {/* Email continue-gate banner */}
      {!isAtLimit && emailGateActive && (
        <div className="px-4 py-2.5 bg-gold/10 border-t border-gold/20">
          <p className="text-xs text-gold-light text-center leading-relaxed">
            Your question is saved. Drop your email below so Yuri can keep the
            conversation (and send you a recap) — then you&apos;ll pick up right
            where you left off.
          </p>
        </div>
      )}

      {/* Input — a full-width two-row composer with the send button INSIDE the
          field (the ChatGPT-style pattern visitors recognize as "write to me").
          Enter sends, Shift+Enter adds a line. */}
      {!isAtLimit && (
        <div className="p-3 border-t border-white/10 bg-seoul-card/80">
          <div className="relative">
            <textarea
              ref={inputRef}
              rows={2}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault()
                  sendMessage(input)
                }
              }}
              placeholder={
                emailGateActive
                  ? 'your@email.com'
                  : showLive
                    ? "Ask me anything... what you're using, what's not working..."
                    : 'Type here to ask about your skin. Free, no signup.'
              }
              disabled={isStreaming}
              inputMode={emailGateActive ? 'email' : 'text'}
              /* text-base (16px) on mobile prevents iOS Safari from auto-zooming
                 the viewport on focus — any input under 16px triggers it, which
                 shifts the entire conversion surface at the exact moment a
                 visitor starts typing. sm:text-sm keeps the 14px desktop look. */
              className="w-full text-base sm:text-sm py-2.5 pl-3 pr-12 rounded-xl bg-white/10 border border-white/15 text-white focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-white/40 resize-none leading-snug block"
              aria-label="Ask Yuri a question"
            />
            <button
              onClick={() => sendMessage(input)}
              disabled={isStreaming || !input.trim()}
              className="absolute right-2 bottom-2 w-9 h-9 rounded-lg bg-gradient-to-br from-gold to-gold-light text-seoul-dark flex items-center justify-center transition-all hover:shadow-glow-gold disabled:opacity-40"
              aria-label="Send"
            >
              {isStreaming ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
            </button>
          </div>
        </div>
      )}

      {/* Remaining counter */}
      {!isAtLimit && showLive && (
        <p className="text-center text-[10px] text-white/30 py-1.5">
          {MAX_FREE_MESSAGES - messageCount} free message{MAX_FREE_MESSAGES - messageCount !== 1 ? 's' : ''} remaining
        </p>
      )}
    </>
  )

  // ---------- Hero variant: embedded card, no section wrapper ----------
  if (variant === 'hero') {
    return (
      <div
        id="hero-yuri"
        className="dark-card-gold shadow-glow-gold flex flex-col overflow-hidden"
        style={{ minHeight: '520px', maxHeight: '640px' }}
      >
        {chatContent}
      </div>
    )
  }

  // ---------- Section variant: full-width section (legacy, for standalone use) ----------
  return (
    <section className="py-20 px-4 bg-seoul-darker" id="try-yuri">
      <div className="max-w-4xl mx-auto">
        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-60px' }}
          variants={fadeUp}
          className="text-center mb-8"
        >
          <span className="badge-gold mb-3 inline-block">AI Beauty Advisor</span>
          <h2 className="section-heading mb-3">
            Try Yuri <span className="text-gold">(유리)</span>
          </h2>
          <p className="section-subheading mx-auto">
            Ask her anything about Korean skincare. No signup required.
          </p>
        </motion.div>

        <motion.div
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, margin: '-40px' }}
          variants={fadeUp}
          className="dark-card-gold shadow-glow-gold flex flex-col overflow-hidden"
          style={{ minHeight: '480px', maxHeight: '600px' }}
        >
          {chatContent}
        </motion.div>
      </div>
    </section>
  )
}
