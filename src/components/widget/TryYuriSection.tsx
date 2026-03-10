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
} from '@/lib/utils/widget-session'
import { renderMarkdown, parseWidgetStream } from '@/lib/utils/widget-shared'
import type { WidgetMessage } from '@/lib/utils/widget-shared'

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

const QUICK_PROMPTS = [
  'Is my COSRX Snail Mucin real?',
  'Best serum for glass skin?',
  'Build me a routine',
  'Find me a sunscreen dupe',
]

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
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  useEffect(() => {
    setMessageCountState(getMessageCount())
    return onMessageCountChange((count) => setMessageCountState(count))
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

        const response = await fetch('/api/widget/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: trimmed, history }),
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
          onDone(cleanedMessage) {
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
            err instanceof Error && err.message.includes('Rate limit')
              ? 'Too many requests. Please try again later.'
              : 'Something went wrong. Please try again.'
          )
        }
      } finally {
        setIsStreaming(false)
      }
    },
    [isStreaming, isAtLimit, messageCount, messages]
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
          <p className="text-xs text-white/40">K-Beauty AI Advisor — ask me anything</p>
        </div>
        <span className="badge-gold text-[10px] animate-pulse-soft">Live</span>
      </div>

      {/* Messages area */}
      <div className="flex-1 overflow-y-auto scrollbar-hide">
        {/* Demo conversation (before first interaction) */}
        {!showLive && (
          <div className="p-4 space-y-3">
            <div className="flex justify-end">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed bg-gradient-to-br from-gold to-gold-light text-seoul-dark">
                Is the COSRX Snail Mucin I bought on Amazon real? The texture feels different.
              </div>
            </div>
            <div className="flex justify-start">
              <div className="max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed bg-white/5 border border-white/10 text-white/80">
                <div className="flex items-center gap-1.5 mb-1">
                  <Sparkles className="w-3 h-3 text-gold" />
                  <p className="font-semibold text-gold">Yuri</p>
                </div>
                Great question! Here&apos;s what to check: 1) The holographic sticker on the box should shift colors when tilted — fakes often have a static print. 2) Real COSRX has a subtle honey-like scent, not fragrance-free. 3) Check the batch code on the bottom — I can verify it if you share a photo. Amazon has had counterfeit issues with this product specifically. Want me to walk you through a full authenticity check?
              </div>
            </div>

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
                  Subscribe — $39.99/mo <ArrowRight className="w-3 h-3" />
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
            placeholder="Ask Yuri anything about K-beauty..."
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
            Ask her anything about Korean skincare — no signup required.
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
