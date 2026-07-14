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
import { trackEvent, DemoEvent } from '@/lib/analytics'

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
  // Which demo script to show (owner vs beginner). Init deterministically to
  // avoid an SSR/client hydration mismatch, then randomize client-side on mount.
  const [demoScript, setDemoScript] = useState<DemoMessage[]>(DEMO_OWNER)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
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
    }

    // `ask` PRESENT (even empty) means the visitor clicked an "Ask Yuri" feeder
    // CTA and wants the chat. Non-empty prefills their question; empty just
    // focuses the widget (e.g. the nav "Ask Yuri" with no topic).
    if (!params.has('ask')) return
    const ask = (params.get('ask') || '').trim()
    if (!sourceRef.current) sourceRef.current = 'landing'
    if (ask) setInput(ask)
    // Land at the TOP of the hero so the visitor sees the full headline + demo
    // + their prefilled question as one first impression, then focus the input
    // WITHOUT scrollIntoView (which would yank the hero up and clip the headline).
    // preventScroll keeps the page at top while still focusing the field.
    requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: 'smooth' })
      inputRef.current?.focus({ preventScroll: true })
    })
    trackEvent(DemoEvent.prefillArrived, {
      source: sourceRef.current || 'unknown',
      has_question: ask.length > 0,
    })
  }, [])

  // Abort any in-flight stream when component unmounts
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  // Scroll within the chat container, not the page
  useEffect(() => {
    const container = messagesContainerRef.current
    if (container) {
      container.scrollTop = container.scrollHeight
    }
  }, [messages])

  const isAtLimit = messageCount >= MAX_FREE_MESSAGES

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || isAtLimit) return

      const trimmed = text.trim()
      setError(null)

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
          }),
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          const errBody = await response.json().catch(() => null)
          throw new Error(errBody?.error || 'Request failed')
        }

        await parseWidgetStream(response.body, controller.signal, {
          onText(content) {
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
          onDone(cleanedMessage, sessionId) {
            if (sessionId) setWidgetSessionId(sessionId)
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

        // Increment count only after successful stream
        const newCount = messageCount + 1
        setMessageCount(newCount)
        setMessageCountState(newCount)
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
          setError(
            err instanceof Error && (err.message.includes('Rate limit') || err.message.includes('rate limit'))
              ? 'You\'ve used all your free preview messages for today. Subscribe for unlimited Yuri conversations!'
              : 'Something went wrong. Please try again.'
          )
        }
      } finally {
        setIsStreaming(false)
      }
    },
    [isStreaming, isAtLimit, messageCount, messages, demoScript]
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
        <span className="badge-gold text-[10px] animate-pulse-soft">Live</span>
      </div>

      {/* Messages area */}
      <div className="flex-1 min-h-0 overflow-y-auto scrollbar-hide">
        {/* Demo conversation (before first interaction) */}
        {!showLive && (
          <div className="p-4 space-y-3">
            {/* Demo shows the memory-rich ceiling: Yuri reading your real routine,
                your city's live weather, and your product INCI to diagnose a
                problem. Condensed from a real subscriber conversation — every
                capability shown is genuine (never fabricated). The soft caption +
                the live "try free" widget below let the gap sell the upgrade. */}
            {demoScript.map((m, i) => (
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
                  {m.text}
                </div>
              </div>
            ))}

            {/* Soft caption: frames the demo as the with-an-account ceiling,
                no hard paywall — the free widget sits right below. Adapts to the
                demo angle (beginner-from-zero vs existing-shelf). */}
            <p className="text-[11px] text-white/40 italic pt-1 px-1 leading-relaxed">
              {demoScript === DEMO_BEGINNER
                ? "No products, no clue, any budget — Yuri meets you right where you are. Talk to her free below. She gets better the more she knows you."
                : 'This is Yuri once she knows your skin, your routine, even your weather. Talk to her free below to see what she’s like. She gets better once she actually knows you.'}
            </p>

            {/* Quick prompts */}
            <div className="flex flex-wrap gap-2 pt-2">
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
          </div>
        )}

        {/* Live messages */}
        {showLive && (
          <div ref={messagesContainerRef} className="p-4 space-y-3">
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
                      <span className="text-gold/70 text-xs italic">Yuri is thinking</span>
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

            {isAtLimit && (
              <div className="bg-gold/5 rounded-2xl p-4 border border-gold/20 text-center">
                <p className="text-sm text-white font-medium mb-1">
                  This is just the preview.
                </p>
                <p className="text-xs text-white/50 mb-3">
                  Subscribers get unlimited Yuri conversations, a personalized skin profile she remembers across sessions, 6 specialist agents, routine building with ingredient conflict detection, and more.
                </p>
                <Link
                  href="/register?plan=pro_monthly"
                  className="inline-flex items-center gap-1.5 glass-button-primary text-xs py-2 px-5"
                >
                  Subscribe at {PRICING.monthly_display}/mo <ArrowRight className="w-3 h-3" />
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

      {/* Input */}
      {!isAtLimit && (
        <div className="flex items-center gap-2 p-3 border-t border-white/10 bg-seoul-card/80">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                sendMessage(input)
              }
            }}
            placeholder="Ask me anything... what you're using, what's not working..."
            disabled={isStreaming}
            className="flex-1 text-sm py-2.5 px-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-white/30"
            aria-label="Ask Yuri a question"
          />
          <button
            onClick={() => sendMessage(input)}
            disabled={isStreaming || !input.trim()}
            className="flex-shrink-0 w-10 h-10 rounded-xl bg-gradient-to-br from-gold to-gold-light text-seoul-dark flex items-center justify-center transition-all hover:shadow-glow-gold disabled:opacity-40"
            aria-label="Send"
          >
            {isStreaming ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
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
