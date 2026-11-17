'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, SkipForward } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import { consentedVisitorId, hasPreviewConversation, getCarryoverChoice, setCarryoverChoice, previewedAt, previewCameFromEmail } from '@/lib/utils/widget-session'
import CarryoverPrompt from '@/components/onboarding/CarryoverPrompt'
import ChatMessage from '@/components/yuri/ChatMessage'
import ChatInput from '@/components/yuri/ChatInput'
import type { ChatMessage as ChatMessageType } from '@/types/yuri'
import { getOfferCode, setupChatLine, skipSetupLabel, freeWeekNotStartedLine } from '@/lib/offers'
import { hasFreshSignupAgreement, clearSignupAgreement, shouldStartAtSignup, isJustCreated, rememberStartNote, readStartNote } from '@/lib/signup-agreement'
import { startFreeWeekOnce } from '@/lib/start-free-week'
import { takeCarriedQuestion } from '@/lib/landing-chat'

// What a new member's first Yuri message is prefilled with after checkout. It is
// only prefilled (the Yuri page's ?ask= never auto-sends), so they can edit it.
const FIRST_MEMBER_ASK = "Let's build my routine from what you learned in my setup chat."

export default function OnboardingPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  // progress tracked internally for completion detection only
  const [progress, setProgress] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [qualityScore, setQualityScore] = useState(0)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)
  // Ran-once guard for the start-onboarding effect. React 18 Strict Mode (and
  // fast re-mounts) fire the mount effect twice; without this the client POSTs
  // start_onboarding twice, which (pre server-side lock) produced two different
  // greetings 0.9s apart. Survives re-renders; resets only on a true remount.
  const startedRef = useRef(false)
  // True when Stripe just returned this person from checkout (Nov 10 2026). The
  // paywall and the preview both say the routine is the first thing built once
  // they are a member, so a new member whose setup is already done lands in
  // Yuri with that request ready to send, not on the dashboard.
  const justPaidRef = useRef(false)
  // The free week was started on our own membership page (?started=1), not on Stripe's.
  const startedHereRef = useRef(false)
  // The confirm step for someone just back from Stripe, resolving to whether
  // they are a member now. Awaited before a just-started member who skipped
  // setup is sent to the member chat, so the app gate there never meets a plan
  // that is still being written.
  const confirmedRef = useRef<Promise<boolean> | null>(null)
  // Whether to carry this browser's free-preview chat into onboarding. 'pending'
  // until read on the client; 'ask' shows CarryoverPrompt and holds the start
  // until they answer; 'na' when there is no preview chat on this device.
  const [carryChoice, setCarryChoice] = useState<'pending' | 'ask' | 'yes' | 'no' | 'na'>('pending')
  // The question they arrived at the site with, held across sign-up
  // (src/lib/landing-chat.ts). Prefilled into the box once; they send it or
  // delete it. Only set when there is one, so a second effect run cannot clear it.
  const [carriedAsk, setCarriedAsk] = useState<string | null>(null)
  useEffect(() => {
    try {
      const question = takeCarriedQuestion(window.localStorage, Date.now())
      if (question) setCarriedAsk(question)
    } catch (err) {
      console.warn('[onboarding] carried question not read:', err)
    }
  }, [])
  // Whether this person is already a member: null until read, and null if the
  // read fails, in which case nothing is claimed either way. A member is sent
  // here too (after starting the free week with setup unfinished, or from the
  // "complete your skin profile" links), and "your free week has not started"
  // or "see membership" would be false for them.
  const [isMember, setIsMember] = useState<boolean | null>(null)
  // True on the page load where this account's free week was started (sign-up starts it).
  const [freeWeekJustStarted, setFreeWeekJustStarted] = useState(false)
  // Why sign-up did not start the free week, when it did not (the sign-up page said it would).
  const [startNote, setStartNote] = useState<string | null>(null)
  // The answer is per ACCOUNT, so read it once we know who is signed in.
  const [userId, setUserId] = useState<string>('')
  useEffect(() => {
    let live = true
    ;(async () => {
      const { data } = await supabase.auth.getSession()
      const id = data.session?.user?.id ?? ''
      if (!live) return
      setUserId(id)
      setCarryChoice(id && hasPreviewConversation() ? getCarryoverChoice(id) ?? 'ask' : 'na')
      if (!id) return
      // Someone just back from Stripe: their plan is still being written, so a
      // read now would say "not a member" seconds after they started the free
      // week. Left unknown here; the confirm step below reads it afterwards.
      const arrived = new URLSearchParams(window.location.search)
      if (justPaidRef.current || arrived.has('session_id') || arrived.get('started') === '1') return
      // Their own profile row (RLS). A failed read leaves isMember null.
      const { data: profile, error: planError } = await supabase
        .from('ss_user_profiles')
        .select('plan')
        .eq('user_id', id)
        .maybeSingle()
      if (!live) return
      if (planError) {
        console.warn('[onboarding] plan not read; nothing is said about membership:', planError.message)
        return
      }
      const member = !!profile?.plan && profile.plan !== 'free'
      // Creating an account starts the free week (Nov 16 2026). This is the
      // first page after sign-up, by email or by Google, so it is done here,
      // once, for a browser that has just come through the sign-up page.
      // Anything short of "started" leaves them as they were: an account, with
      // the membership page as the way in.
      // Only for an account made within the hour: an older free account that
      // passes through the sign-up page (its Google button signs anyone in)
      // is not started without being asked. The membership page asks them.
      const createdAt = data.session?.user?.created_at
      const token = data.session?.access_token
      if (shouldStartAtSignup({ member, hasToken: !!token, accountCreatedAt: createdAt, hasMark: hasFreshSignupAgreement(), now: Date.now() })) {
        // One start per account however often this effect runs.
        const outcome = await startFreeWeekOnce(id, token as string, getOfferCode())
        if (outcome.started) {
          clearSignupAgreement()
          if (!live) return
          setIsMember(true)
          setFreeWeekJustStarted(true)
          // The banner at the top read "no free week" a moment ago; have it look again.
          window.dispatchEvent(new Event('ss:trial-changed'))
          return
        }
        // A reason that will not change (already used, the network limit, a
        // code) ends it: the mark goes, and the sentence is kept so a reload
        // says the same thing. A failure keeps the mark, so a reload tries again.
        if (!outcome.retry) {
          clearSignupAgreement()
          rememberStartNote(id, outcome.note)
        }
        if (!live) return
        setStartNote(outcome.note)
      } else if (!member && isJustCreated(createdAt, Date.now())) {
        // A new account with no start in progress. If this tab was already
        // told why (above, before a reload), say that again; otherwise it did
        // not come through the sign-up page in this browser.
        setStartNote(readStartNote(id) ?? freeWeekNotStartedLine('not_asked'))
      }
      setIsMember(member)
    })()
    return () => { live = false }
  }, [])

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [])

  // Second fulfillment trigger (July 21 2026). Stripe sends the buyer here with
  // ?session_id=cs_... the instant payment succeeds, but the plan is flipped by
  // the out-of-band webhook — so a paying customer could finish onboarding and
  // get bounced to the paywall. This confirms payment DIRECTLY with Stripe on
  // arrival (Stripe's documented dual-trigger fulfillment). Idempotent and
  // safe: the endpoint verifies ownership and payment_status server-side, so
  // it grants nothing to someone who simply types the URL. Setup itself
  // never waits for it (the webhook is still a second chance and /subscribe
  // self-corrects). Only the redirect for a member who skipped setup awaits
  // the result, through confirmedRef, and the request gives up after 8s.
  useEffect(() => {
    const search = new URLSearchParams(window.location.search)
    const sessionId = search.get('session_id')
    // ?started=1: the free week was started on our own membership page, with
    // no Stripe page and so no session to confirm. The plan was written before
    // that page moved on; it is read here, and that read is all that counts,
    // so typing the address grants nothing.
    const startedHere = !sessionId && search.get('started') === '1'
    if (!sessionId && !startedHere) return
    startedHereRef.current = startedHere
    // Read synchronously, before the start effect below can redirect: Stripe
    // only sends a buyer here with a session id right after checkout.
    justPaidRef.current = true
    // Drop the id from the URL NOW, synchronously, so a refresh or a shared link
    // doesn't replay it. This used to run after the confirm fetch resolved; by
    // then the start effect may already have sent a just-paid member to
    // /yuri?ask=..., and rewriting the URL at that point wiped the prefilled
    // routine request and left /onboarding in the address bar (review, Nov 10
    // 2026). The id is already captured in `sessionId`.
    window.history.replaceState({}, '', '/onboarding')
    confirmedRef.current = (async (): Promise<boolean> => {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) return false
        if (sessionId) await fetch('/api/stripe/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ session_id: sessionId }),
          // Bounded: a member who skipped setup waits on this before being sent
          // to the member chat, and must not sit on the loading screen if it stalls.
          // Older Safari has no AbortSignal.timeout; there the request is sent unbounded.
          signal: typeof AbortSignal.timeout === 'function' ? AbortSignal.timeout(8000) : undefined,
        })
        // The plan is written by now (or the webhook will write it). Read it,
        // so this page stops describing a member as someone yet to choose.
        const uid = data.session?.user?.id
        if (uid) {
          // A start on our own page normally has the plan written already; if
          // that write failed, the webhook does it a moment later, so look twice more.
          for (let attempt = 0; attempt < (startedHere ? 3 : 1); attempt++) {
            if (attempt > 0) await new Promise((r) => setTimeout(r, 1500))
            const { data: profile, error: planError } = await supabase.from('ss_user_profiles').select('plan').eq('user_id', uid).maybeSingle()
            if (!planError && profile?.plan && profile.plan !== 'free') {
              setIsMember(true)
              return true
            }
          }
        }
        // Read and not a member: say so, or the page would stay on "unknown".
        if (startedHere) setIsMember(false)
        return false
      } catch (err) {
        console.error('[onboarding] payment confirm failed:', err)
        return false
      }
    })()
  }, [])

  useEffect(() => {
    scrollToBottom()
  }, [messages, scrollToBottom])

  const getToken = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('Not authenticated')
    return token
  }, [])

  // Parse SSE stream events
  const parseSSEStream = useCallback(
    async (
      response: Response,
      onText: (text: string) => void,
      onDone?: (data: Record<string, unknown>) => void,
      onProgress?: (data: Record<string, unknown>) => void,
      onMeta?: (data: Record<string, unknown>) => void
    ) => {
      if (!response.body) throw new Error('No response body')

      const reader = response.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() || ''

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue
          const jsonStr = line.slice(6).trim()
          if (!jsonStr) continue

          try {
            const event = JSON.parse(jsonStr)

            if (event.type === 'text') {
              onText(event.content)
            } else if (event.type === 'done') {
              onDone?.(event)
            } else if (event.type === 'progress') {
              onProgress?.(event)
            } else if (event.type === 'meta') {
              onMeta?.(event)
            } else if (event.type === 'error') {
              throw new Error(event.message)
            }
          } catch (parseError) {
            if (parseError instanceof Error && parseError.message !== jsonStr) {
              throw parseError
            }
          }
        }
      }
    },
    []
  )

  // Start onboarding on mount
  useEffect(() => {
    // Guard against React Strict Mode's double-invoke and fast re-mounts: only
    // the first run may fire start_onboarding. The server also claims the
    // greeting atomically (defense in depth), but stopping the duplicate POST
    // here avoids a wasted request + a discarded Claude generation.
    if (carryChoice === 'pending' || carryChoice === 'ask') return
    if (startedRef.current) return
    startedRef.current = true

    let cancelled = false

    async function init() {
      try {
        const token = await getToken()
        const response = await fetch('/api/yuri/onboarding', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ action: 'start_onboarding', widget_visitor_id: consentedVisitorId(userId) }),
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Failed to start onboarding' }))
          throw new Error(err.error || `HTTP ${response.status}`)
        }

        const contentType = response.headers.get('Content-Type') || ''

        // SSE stream (new conversation, Yuri sends opening message)
        if (contentType.includes('text/event-stream')) {
          if (cancelled) return

          // Add streaming placeholder
          const assistantMsg: ChatMessageType = {
            id: `onboarding-greeting-${Date.now()}`,
            role: 'assistant',
            content: '',
            specialist_type: null,
            image_urls: [],
            timestamp: new Date().toISOString(),
            isStreaming: true,
          }
          setMessages([assistantMsg])
          setIsLoading(false)

          await parseSSEStream(
            response,
            (text) => {
              if (cancelled) return
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last && last.isStreaming) {
                  updated[updated.length - 1] = {
                    ...last,
                    content: last.content + text,
                  }
                }
                return updated
              })
            },
            (doneData) => {
              if (cancelled) return
              setMessages((prev) => {
                const updated = [...prev]
                const last = updated[updated.length - 1]
                if (last && last.isStreaming) {
                  updated[updated.length - 1] = { ...last, isStreaming: false }
                }
                return updated
              })
              if (doneData.conversation_id) {
                setConversationId(doneData.conversation_id as string)
              }
            },
            undefined,
            (meta) => {
              if (cancelled) return
              if (meta.conversation_id) setConversationId(meta.conversation_id as string)
              if (typeof meta.progress === 'number') setProgress(meta.progress as number)
            }
          )
        } else {
          // JSON response (existing conversation)
          const data = await response.json()

          if (cancelled) return

          if (data.status === 'completed') {
            // A just-paid member waits for the payment check first, so the
            // member chat does not open while the plan still reads "free" and
            // send them to the membership page.
            let member = true
            if (justPaidRef.current && confirmedRef.current) {
              member = await confirmedRef.current
              if (cancelled) return
            }
            // Back from Stripe, the member chat is opened even if the check
            // did not confirm (the webhook may be seconds behind). With
            // ?started=1 there is no such lag to allow for: not a member means
            // the address was typed, and they go where anyone else does.
            router.replace(
              justPaidRef.current && (member || !startedHereRef.current)
                ? `/yuri?ask=${encodeURIComponent(FIRST_MEMBER_ASK)}`
                : '/dashboard'
            )
            return
          }

          // Someone who skipped this chat and has just started membership is
          // not put back in front of it: they go to the member chat, with no
          // prefilled message (the usual one speaks of "what you learned in my
          // setup chat", which may be nothing). Only once the plan is confirmed;
          // otherwise, or if the confirm takes more than 8 seconds, they stay,
          // and the chat is still usable.
          if (data.status === 'skipped' && justPaidRef.current && confirmedRef.current) {
            const member = await confirmedRef.current
            if (cancelled) return
            if (member) {
              router.replace('/yuri')
              return
            }
          }

          if (data.conversation_id) setConversationId(data.conversation_id)
          if (typeof data.progress === 'number') setProgress(data.progress)
          if (data.is_complete) setIsComplete(true)
          if (typeof data.quality_score === 'number') setQualityScore(data.quality_score)

          // Convert existing messages
          if (data.messages && data.messages.length > 0) {
            setMessages(
              data.messages.map(
                (m: { id: string; role: string; content: string; created_at: string }) =>
                  ({
                    id: m.id,
                    role: m.role as 'user' | 'assistant',
                    content: m.content,
                    specialist_type: null,
                    image_urls: [],
                    timestamp: m.created_at,
                  }) satisfies ChatMessageType
              )
            )
          }

          setIsLoading(false)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to start onboarding')
          setIsLoading(false)
        }
      }
    }

    init()
    return () => { cancelled = true }
  }, [getToken, router, parseSSEStream, carryChoice, userId])

  // Send a message
  const sendMessage = useCallback(
    async (message: string) => {
      if (isStreaming) return

      setError(null)
      setIsStreaming(true)

      const userMsg: ChatMessageType = {
        id: `user-${Date.now()}`,
        role: 'user',
        content: message,
        specialist_type: null,
        image_urls: [],
        timestamp: new Date().toISOString(),
      }

      const assistantMsg: ChatMessageType = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        specialist_type: null,
        image_urls: [],
        timestamp: new Date().toISOString(),
        isStreaming: true,
      }

      setMessages((prev) => [...prev, userMsg, assistantMsg])

      try {
        const token = await getToken()
        abortControllerRef.current = new AbortController()

        const response = await fetch('/api/yuri/onboarding', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            action: 'send_message',
            message,
            // Carries the free-preview conversation into onboarding, only after
            // the person said it was theirs (CarryoverPrompt).
            widget_visitor_id: consentedVisitorId(userId),
            // A creator code this browser remembers, so Yuri states this
            // person's real price. The server confirms it with Stripe.
            ...(getOfferCode() ? { offer_code: getOfferCode() } : {}),
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(err.error || `HTTP ${response.status}`)
        }

        await parseSSEStream(
          response,
          (text) => {
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last && last.isStreaming) {
                updated[updated.length - 1] = {
                  ...last,
                  content: last.content + text,
                }
              }
              return updated
            })
          },
          () => {
            setMessages((prev) => {
              const updated = [...prev]
              const last = updated[updated.length - 1]
              if (last && last.isStreaming) {
                updated[updated.length - 1] = { ...last, isStreaming: false }
              }
              return updated
            })
          },
          (progressData) => {
            if (typeof progressData.percentage === 'number') {
              setProgress(progressData.percentage as number)
            }
            if (progressData.is_complete) {
              setIsComplete(true)
            }
            if (typeof progressData.quality_score === 'number') {
              setQualityScore(progressData.quality_score as number)
            }
          }
        )
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return

        setError(err instanceof Error ? err.message : 'Failed to send message')
        setMessages((prev) => prev.filter((m) => !m.isStreaming))
      } finally {
        setIsStreaming(false)
        abortControllerRef.current = null
      }
    },
    [isStreaming, getToken, parseSSEStream, userId]
  )

  // Complete onboarding
  const handleComplete = useCallback(async () => {
    try {
      const token = await getToken()
      const response = await fetch('/api/yuri/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'complete_onboarding' }),
      })

      if (!response.ok) {
        const err = await response.json().catch(() => ({ error: 'Failed to complete onboarding' }))
        throw new Error(err.error || 'Failed to complete onboarding')
      }

      // Priority 2 — the VALUE MOMENT. Onboarding is done: Yuri has the
      // visitor's skin profile and has given them their first move. She has NOT
      // built a routine (the onboarding prompt keeps the complete build for
      // members; an earlier version of this comment and of the paywall copy
      // said she had). Route to '/subscribe', which shows what she has on file
      // and says the routine is built first once they are a member.
      // Self-correcting: '/subscribe' checks the plan on mount
      // and bounces an already-paid user (insiders) straight to '/dashboard' or
      // '/yuri', so this single route is correct for both free and paid.
      // '?from=onboarding' lets the subscribe page open on continuation framing
      // (the earned value moment) rather than the cold pricing wall.
      // A member (their free week started at sign-up) goes straight to the
      // first member chat, with the routine request ready to send.
      router.push(isMember === true ? `/yuri?ask=${encodeURIComponent(FIRST_MEMBER_ASK)}` : '/subscribe?from=onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding')
    }
  }, [getToken, router, isMember])

  // Skip onboarding
  const handleSkip = useCallback(async () => {
    try {
      const token = await getToken()
      await fetch('/api/yuri/onboarding', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ action: 'skip_onboarding' }),
      })
      // Where the link says it goes. A member goes to Yuri. Anyone else goes
      // to the membership page (AppShell would send a free account there
      // anyway, and that page sends a member onward if the plan was not known
      // here).
      router.push(isMember === true ? '/yuri' : '/subscribe')
    } catch {
      router.push(isMember === true ? '/yuri' : '/subscribe')
    }
  }, [getToken, router, isMember])

  if (carryChoice === 'ask') {
    return (
      <CarryoverPrompt
        previewedAt={previewedAt()}
        fromEmail={previewCameFromEmail()}
        onChoose={(choice) => {
          setCarryoverChoice(userId, choice)
          setCarryChoice(choice)
        }}
      />
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-seoul-darker flex items-center justify-center">
        <div className="text-center">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-gradient-to-br from-gold to-gold-light shadow-glow-gold mb-4 animate-pulse">
            <Sparkles className="w-8 h-8 text-seoul-dark" />
          </div>
          <p className="text-white/40 text-sm">Yuri is getting ready...</p>
        </div>
      </div>
    )
  }

  return (
    // Exactly the screen that is left under the app's top bar and the free-week
    // notice (which reports its height in --trial-notice-h), so the page never
    // scrolls as a whole and the messages scroll inside it. It used to be a
    // full screen tall on top of both: the first scroll-to-newest pushed the
    // notice, with the day the free week ends, out of view (seen in a browser
    // Nov 16 2026, the first time a new member's setup chat had a notice).
    <div className="h-[calc(100vh-64px-var(--trial-notice-h,0px))] supports-[height:100dvh]:h-[calc(100dvh-64px-var(--trial-notice-h,0px))] bg-seoul-darker flex flex-col">
      {/* Header */}
      {/* top-16: sits under the app's 64px top bar. At top-0 it slid beneath it. */}
      <div className="sticky top-16 z-10 bg-seoul-card/90 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold to-gold-light flex items-center justify-center shadow-glow-gold">
              <Sparkles className="w-4.5 h-4.5 text-seoul-dark" />
            </div>
            <div>
              <h1 className="font-display text-base font-semibold text-white">
                Meet Yuri
              </h1>
              <p className="text-xs text-white/40">Your AI K-beauty advisor</p>
              {/* What this chat is, and for someone who is not a member, that
                  the free week has not started (offers.ts). */}
              <p className="text-xs text-white/60">{setupChatLine(isMember, freeWeekJustStarted)}</p>
              {startNote && <p className="text-xs text-white/80 mt-1" role="status">{startNote}</p>}
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 min-h-0 overflow-y-auto px-4 py-4">
        <div className="max-w-2xl mx-auto space-y-4">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}

          {/* Completion prompt */}
          {isComplete && !isStreaming && qualityScore >= 65 && (
            <div className="flex justify-center py-6">
              <button
                onClick={handleComplete}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-sm font-semibold shadow-glow-gold hover:shadow-glow-gold-lg hover:scale-[1.02] transition-all duration-200"
              >
                <Sparkles className="w-4 h-4" />
                {isMember === false ? 'Finish setup and see membership' : 'Finish setup'}
              </button>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="px-4 pb-2">
          <div className="max-w-2xl mx-auto p-3 rounded-xl bg-red-500/10 border border-red-500/20">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        </div>
      )}

      {/* Input */}
      <div className="sticky bottom-0 max-w-2xl mx-auto w-full">
        <ChatInput
          onSend={sendMessage}
          disabled={isStreaming}
          placeholder="Tell Yuri about your skin..."
          showImageUpload={false}
          restoredValue={carriedAsk}
          onRestoreConsumed={() => setCarriedAsk(null)}
        />
      </div>

      {/* Skip link */}
      <div className="bg-seoul-card/90 backdrop-blur-md border-t border-white/10 py-2 text-center">
        <button
          onClick={handleSkip}
          className="inline-flex items-center gap-1.5 text-xs text-white/30 hover:text-white/60 transition-colors"
        >
          <SkipForward className="w-3 h-3" />
          {skipSetupLabel(isMember)}
        </button>
      </div>
    </div>
  )
}
