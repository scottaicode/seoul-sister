'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { usePathname } from 'next/navigation'
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '@/hooks/useAuth'
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

const SESSION_MESSAGES_KEY = 'yuri_widget_messages'

function loadSessionMessages(): WidgetMessage[] {
  if (typeof sessionStorage === 'undefined') return []
  try {
    const raw = sessionStorage.getItem(SESSION_MESSAGES_KEY)
    return raw ? JSON.parse(raw) : []
  } catch { return [] }
}

function saveSessionMessages(msgs: WidgetMessage[]) {
  if (typeof sessionStorage === 'undefined') return
  try {
    sessionStorage.setItem(
      SESSION_MESSAGES_KEY,
      JSON.stringify(msgs.filter((m) => !m.isStreaming))
    )
  } catch { /* storage full */ }
}

export default function YuriBubble() {
  const pathname = usePathname()
  const { user, loading: authLoading } = useAuth()
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<WidgetMessage[]>(loadSessionMessages)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [messageCount, setMessageCountState] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setMessageCountState(getMessageCount())
    return onMessageCountChange((count) => setMessageCountState(count))
  }, [])

  // Abort any in-flight stream when component unmounts or widget closes
  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    saveSessionMessages(messages)
  }, [messages])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  // Capture the feeder source from ?from= on mount so a visitor who arrives via
  // a tagged link (e.g. /?from=blog) and opens the BUBBLE — not the hero — is
  // still attributed. Falls back to 'landing' for untagged arrivals.
  useEffect(() => {
    const from = new URLSearchParams(window.location.search).get('from')
    sourceRef.current = from || 'landing'
  }, [])

  // A prefill question queued by an 'open-yuri' event (blog CTAs), sent once the
  // bubble has opened. Held in a ref so the listener effect stays stable.
  const pendingPrefillRef = useRef<string | null>(null)

  // First-touch feeder source (blog/ingredient/nav/...) so bubble conversations
  // are attributed like the hero widget. Read from ?from= on mount; an
  // 'open-yuri' event may override it (event.detail.source). Sent once, on the
  // request that creates the session. Mirrors TryYuriSection's source handling
  // so both entry surfaces attribute identically instead of the bubble path
  // silently writing NULL. Untagged visitors get 'landing' (an honest value,
  // distinct from server-side organic NULL on sessions never touched here).
  const sourceRef = useRef<string | null>(null)
  const sourceSentRef = useRef(false)

  const isAtLimit = messageCount >= MAX_FREE_MESSAGES

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || isAtLimit) return

      const trimmed = text.trim()
      setError(null)

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

        // First-touch feeder attribution: send the source once, on the request
        // that will create the session (server persists it on create only).
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
            ...(includeSource ? { source: sourceRef.current } : {}),
          }),
          signal: controller.signal,
        })

        if (!response.ok || !response.body) {
          const errBody = await response.json().catch(() => null)
          throw new Error(errBody?.error || 'Failed to get response')
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
          // User closed widget or navigated away — mark partial content
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
            updated[updated.length - 1] = { ...last, isStreaming: false, isIncomplete: true }
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
    [isStreaming, isAtLimit, messageCount, messages]
  )

  // Listen for 'open-yuri' events from other components (blog CTAs, nav, etc.).
  // Optional event.detail.prefill carries the VISITOR's opening question so a
  // reader coming from a blog post lands in a warm, in-progress conversation
  // instead of a blank box (the re-type-from-scratch wall is the blog→Yuri leak).
  // Yuri still reasons and answers freely — the prefill is just the user's first
  // message, equivalent to them typing it themselves.
  useEffect(() => {
    const handleOpenYuri = (e: Event) => {
      setIsOpen(true)
      const detail = (e as CustomEvent<{ prefill?: string; source?: string }>).detail
      const prefill = detail?.prefill
      if (prefill && messageCount === 0) pendingPrefillRef.current = prefill.trim()
      // A feeder may name itself more specifically than ?from= (e.g. an inline
      // blog CTA passing source:'blog'). Honor it only before the session is
      // attributed, so first-touch attribution stays stable.
      if (detail?.source && !sourceSentRef.current) sourceRef.current = detail.source
    }
    window.addEventListener('open-yuri', handleOpenYuri)
    return () => window.removeEventListener('open-yuri', handleOpenYuri)
  }, [messageCount])

  // Once the bubble is open and not at the limit, fire any queued prefill once.
  useEffect(() => {
    if (isOpen && pendingPrefillRef.current && !isStreaming && !isAtLimit) {
      const q = pendingPrefillRef.current
      pendingPrefillRef.current = null
      sendMessage(q)
    }
  }, [isOpen, isStreaming, isAtLimit, sendMessage])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        sendMessage(input)
      }
    },
    [sendMessage, input]
  )

  const remainingMessages = MAX_FREE_MESSAGES - messageCount

  // Don't render for signed-in users — they have the full Yuri at /yuri.
  // Skip during auth bootstrap to avoid a flash of the anonymous widget.
  if (authLoading || user) return null

  // Suppress the floating bubble on the homepage — the hero widget
  // (TryYuriSection) is already the primary Yuri surface there, and a second
  // floating chat collides with it and creates "which box do I use?" confusion.
  if (pathname === '/') return null

  return (
    <>
      {/* Bubble Button */}
      <AnimatePresence>
        {!isOpen && (
          <motion.button
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0, opacity: 0 }}
            onClick={() => setIsOpen(true)}
            className="fixed bottom-4 right-4 md:bottom-5 md:right-5 z-50 w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-gold to-gold-light text-seoul-dark shadow-glow-gold flex items-center justify-center hover:shadow-glow-gold-lg hover:scale-105 transition-all duration-300 group"
            aria-label="Chat with Yuri"
          >
            <MessageCircle className="w-6 h-6" />
            <span className="absolute -top-10 right-0 bg-seoul-card text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-glass whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10">
Ask me anything about K-beauty
            </span>
          </motion.button>
        )}
      </AnimatePresence>

      {/* Chat Window */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className="fixed bottom-4 right-4 md:bottom-5 md:right-5 z-50 w-[calc(100vw-2rem)] max-w-[440px] h-[70vh] md:h-[600px] max-h-[calc(100vh-6rem)] rounded-2xl overflow-hidden bg-seoul-card/95 backdrop-blur-xl border border-white/10 shadow-glow-gold flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gold/5 border-b border-white/10">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold to-gold-light flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-seoul-dark" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-white">
                  Yuri <span className="text-gold">(유리)</span>
                </p>
                <p className="text-xs text-white/40">K-Beauty Advisor</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center transition-colors"
                aria-label="Close chat"
              >
                <X className="w-4 h-4 text-white/40" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-3 scrollbar-hide">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6 text-gold" />
                  </div>
                  <p className="text-base font-semibold text-white mb-1">
                    Hi! I&apos;m Yuri
                  </p>
                  <p className="text-sm text-white/50 max-w-[280px] mx-auto leading-relaxed">
                    Your honest K-beauty friend in Seoul. Tell me what you&apos;re using and I&apos;ll tell you what&apos;s actually working, what&apos;s a waste, and what&apos;s fake.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {[
                      'What actually works for glass skin?',
                      'Did I buy a fake?',
                      'Am I overpaying? Find me a dupe',
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="text-xs px-3 py-1.5 rounded-full bg-gold/10 text-gold-light hover:bg-gold/20 transition-colors border border-gold/20"
                      >
                        {q}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {messages.map((msg) => (
                <div
                  key={msg.id}
                  className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
                >
                  <div
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-gold to-gold-light text-seoul-dark'
                        : 'bg-white/5 border border-white/10 text-white/80'
                    }`}
                  >
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

              {/* Conversion prompt when at limit */}
              {isAtLimit && (
                <div className="bg-gold/5 rounded-2xl p-4 border border-gold/20 text-center">
                  <p className="text-sm text-white font-medium mb-1">
                    This is just the preview.
                  </p>
                  <p className="text-xs text-white/50 mb-3">
                    Subscribers get unlimited Yuri conversations, a personalized skin profile she remembers across sessions, 6 specialist agents, routine building with ingredient conflict detection, and more.
                  </p>
                  <a
                    href="/register?plan=pro_monthly"
                    className="inline-block glass-button-primary text-xs py-2 px-5"
                  >
                    Subscribe for {PRICING.monthly_display}
                  </a>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Error banner */}
            {error && (
              <div className="px-3 py-2 bg-red-500/10 border-t border-red-500/20">
                <p className="text-[11px] text-red-400 text-center">{error}</p>
              </div>
            )}

            {/* Input */}
            {!isAtLimit && (
              <div className="flex items-end gap-2 p-3 border-t border-white/10 bg-seoul-card/80">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask me anything... what you're using, what's not working..."
                  disabled={isStreaming}
                  rows={1}
                  className="flex-1 resize-none text-sm py-2 px-3 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:ring-2 focus:ring-gold/30 placeholder:text-white/30"
                  aria-label="Message Yuri"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={isStreaming || !input.trim()}
                  className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-gold to-gold-light text-seoul-dark flex items-center justify-center transition-all hover:shadow-glow-gold disabled:opacity-40"
                  aria-label="Send"
                >
                  {isStreaming ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Send className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            )}

            {/* Message counter */}
            {!isAtLimit && messages.length > 0 && (
              <div className="px-4 pb-2 text-center">
                <p className="text-[10px] text-white/30">
                  {remainingMessages} free message{remainingMessages !== 1 ? 's' : ''} remaining
                </p>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}

// Re-export shared utilities for backwards compatibility
export {
  incrementWidgetMessageCount,
  getRemainingWidgetMessages,
} from '@/lib/utils/widget-session'
