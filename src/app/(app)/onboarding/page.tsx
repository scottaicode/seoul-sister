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
import { getOfferCode } from '@/lib/offers'
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
  // it grants nothing to someone who simply types the URL. Fire-and-forget —
  // onboarding must never be blocked by it, because the webhook is still a
  // second chance and /subscribe self-corrects.
  useEffect(() => {
    const sessionId = new URLSearchParams(window.location.search).get('session_id')
    if (!sessionId) return
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
    ;(async () => {
      try {
        const { data } = await supabase.auth.getSession()
        const token = data.session?.access_token
        if (!token) return
        await fetch('/api/stripe/confirm', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ session_id: sessionId }),
        })
      } catch (err) {
        console.error('[onboarding] payment confirm failed:', err)
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
            router.replace(
              justPaidRef.current
                ? `/yuri?ask=${encodeURIComponent(FIRST_MEMBER_ASK)}`
                : '/dashboard'
            )
            return
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
      router.push('/subscribe?from=onboarding')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to complete onboarding')
    }
  }, [getToken, router])

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
      // Priority 2 — a free user who skips onboarding still can't enter the paid
      // app; AppShell gates '/dashboard' behind a non-free plan and would bounce
      // them to '/subscribe' regardless. Route there directly (self-correcting:
      // paid insiders are bounced onward by the subscribe page's plan check).
      router.push('/subscribe')
    } catch {
      router.push('/subscribe')
    }
  }, [getToken, router])

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
    <div className="min-h-screen bg-seoul-darker flex flex-col">
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
            </div>
          </div>

          {/* Subtle status dot — no numeric progress */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-gold/60 animate-pulse" />
            <span className="text-xs text-white/30">Listening</span>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4">
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
                Finish setup and see membership
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
          Skip for now -- you can complete your profile anytime
        </button>
      </div>
    </div>
  )
}
