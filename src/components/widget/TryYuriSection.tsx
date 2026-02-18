'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { Sparkles, Send, Loader2, ArrowRight } from 'lucide-react'
import { motion } from 'framer-motion'
import {
  getMessageCount,
  setMessageCount,
  MAX_FREE_MESSAGES,
} from '@/lib/utils/widget-session'

/** Lightweight markdown: **bold**, *italic*, `- ` list items, paragraph spacing */
function renderMarkdown(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const isList = line.trimStart().startsWith('- ')
    const content = isList ? line.replace(/^\s*-\s*/, '') : line

    const parts = content.split(/(\*\*[^*]+\*\*|\*[^*]+\*)/).map((seg, j) => {
      if (seg.startsWith('**') && seg.endsWith('**')) {
        return <strong key={j} className="font-semibold text-white">{seg.slice(2, -2)}</strong>
      }
      if (seg.startsWith('*') && seg.endsWith('*')) {
        return <em key={j}>{seg.slice(1, -1)}</em>
      }
      return seg
    })

    if (isList) {
      return <li key={i} className="ml-3 list-disc list-inside">{parts}</li>
    }
    if (line.trim() === '') return <div key={i} className="h-2.5" />
    return <span key={i}>{parts}{i < lines.length - 1 ? ' ' : ''}</span>
  })
}

interface TryYuriMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

const fadeUp = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: 'easeOut' } },
}

export default function TryYuriSection() {
  const [messages, setMessages] = useState<TryYuriMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [messageCount, setMessageCountState] = useState(0)
  const [showLive, setShowLive] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const messagesContainerRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setMessageCountState(getMessageCount())
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
      const newCount = messageCount + 1
      setMessageCount(newCount)
      setMessageCountState(newCount)

      const userMsg: TryYuriMessage = {
        id: `u-${Date.now()}`,
        role: 'user',
        content: trimmed,
      }
      const assistantMsg: TryYuriMessage = {
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
        })

        if (!response.ok || !response.body) {
          const errBody = await response.json().catch(() => null)
          throw new Error(errBody?.error || 'Request failed')
        }

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
            try {
              const event = JSON.parse(line.slice(6))
              if (event.type === 'text') {
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last?.isStreaming) {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + event.content,
                    }
                  }
                  return updated
                })
              } else if (event.type === 'done') {
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last?.isStreaming) {
                    updated[updated.length - 1] = { ...last, isStreaming: false }
                  }
                  return updated
                })
              }
            } catch {
              // skip
            }
          }
        }
      } catch (err) {
        setMessages((prev) => prev.filter((m) => !m.isStreaming))
        setError(
          err instanceof Error && err.message.includes('Rate limit')
            ? 'Too many requests. Please try again later.'
            : 'Something went wrong. Please try again.'
        )
      } finally {
        setIsStreaming(false)
      }
    },
    [isStreaming, isAtLimit, messageCount, messages]
  )

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
          className="dark-card-gold p-6 md:p-8 shadow-glow-gold"
        >
          {/* Demo conversation (pre-populated, always visible) */}
          {!showLive && (
            <div className="space-y-3 mb-6">
              <div className="flex justify-end">
                <div className="max-w-[80%] rounded-2xl px-4 py-3 text-xs leading-relaxed bg-gradient-to-br from-gold to-gold-light text-seoul-dark">
                  <p className="font-semibold mb-1 opacity-60">Visitor</p>
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
            </div>
          )}

          {/* Live messages */}
          {showLive && (
            <div ref={messagesContainerRef} className="space-y-3 mb-6 max-h-[400px] overflow-y-auto scrollbar-hide">
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
                    {msg.isStreaming && (
                      <span className="inline-block w-1 h-3 bg-gold/60 animate-pulse ml-0.5 align-middle" />
                    )}
                  </div>
                </div>
              ))}

              {isAtLimit && (
                <div className="bg-gold/5 rounded-2xl p-4 border border-gold/20 text-center">
                  <p className="text-xs text-white font-medium mb-1">
                    Want the full Yuri experience?
                  </p>
                  <p className="text-xs text-white/40 mb-3">
                    Subscribe to Seoul Sister Pro for unlimited conversations, personalized routines, and all 6 specialist agents.
                  </p>
                  <a
                    href="/register"
                    className="inline-flex items-center gap-1.5 glass-button-primary text-xs py-2 px-5"
                  >
                    Get Started <ArrowRight className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          )}

          {/* Error banner */}
          {error && (
            <div className="mb-3 px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
              <p className="text-xs text-red-400 text-center">{error}</p>
            </div>
          )}

          {/* Input */}
          {!isAtLimit && (
            <div className="flex items-center gap-2">
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
                className="dark-input flex-1 text-sm py-3 px-4"
                aria-label="Ask Yuri a question"
              />
              <button
                onClick={() => sendMessage(input)}
                disabled={isStreaming || !input.trim()}
                className="flex-shrink-0 w-11 h-11 rounded-xl bg-gradient-to-br from-gold to-gold-light text-seoul-dark flex items-center justify-center transition-all hover:shadow-glow-gold disabled:opacity-40"
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
            <p className="text-center text-[10px] text-white/30 mt-2">
              {MAX_FREE_MESSAGES - messageCount} free message{MAX_FREE_MESSAGES - messageCount !== 1 ? 's' : ''} remaining
            </p>
          )}
        </motion.div>
      </div>
    </section>
  )
}
