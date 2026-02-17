'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

const COOKIE_KEY = 'yuri_widget_session'
const MAX_FREE_MESSAGES = 5

interface WidgetMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

function getMessageCount(): number {
  if (typeof document === 'undefined') return 0
  const match = document.cookie
    .split('; ')
    .find((c) => c.startsWith(`${COOKIE_KEY}=`))
  return match ? parseInt(match.split('=')[1], 10) || 0 : 0
}

function setMessageCount(count: number) {
  // Cookie expires in 24 hours
  const expires = new Date(Date.now() + 86400000).toUTCString()
  document.cookie = `${COOKIE_KEY}=${count};expires=${expires};path=/;SameSite=Lax`
}

export default function YuriBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<WidgetMessage[]>([])
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [messageCount, setMessageCountState] = useState(0)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setMessageCountState(getMessageCount())
  }, [])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus()
    }
  }, [isOpen])

  const isAtLimit = messageCount >= MAX_FREE_MESSAGES

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || isAtLimit) return

      const trimmed = text.trim()
      const newCount = messageCount + 1
      setMessageCount(newCount)
      setMessageCountState(newCount)

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
        })

        if (!response.ok || !response.body) {
          throw new Error('Failed to get response')
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
              // skip malformed events
            }
          }
        }
      } catch {
        setMessages((prev) => prev.filter((m) => !m.isStreaming))
      } finally {
        setIsStreaming(false)
      }
    },
    [isStreaming, isAtLimit, messageCount, messages]
  )

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
            className="fixed bottom-5 right-5 z-50 w-14 h-14 rounded-full bg-gradient-to-br from-rose-gold to-glass-500 text-white shadow-glass-lg flex items-center justify-center hover:shadow-glass-xl hover:scale-105 transition-all duration-300 group"
            aria-label="Chat with Yuri"
          >
            <MessageCircle className="w-6 h-6" />
            <span className="absolute -top-10 right-0 bg-white/95 backdrop-blur-sm text-seoul-charcoal text-xs font-medium px-3 py-1.5 rounded-full shadow-glass whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
              Ask me about K-beauty
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
            className="fixed bottom-5 right-5 z-50 w-[calc(100vw-2.5rem)] max-w-[400px] h-[500px] md:h-[500px] max-h-[calc(100vh-6rem)] rounded-2xl overflow-hidden bg-white/95 backdrop-blur-xl border border-white/50 shadow-glass-xl flex flex-col"
          >
            {/* Header */}
            <div className="flex items-center gap-3 px-4 py-3 bg-gradient-to-r from-rose-gold/10 to-glass-100/50 border-b border-white/50">
              <div className="w-8 h-8 rounded-full bg-gradient-to-br from-rose-gold to-glass-500 flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-seoul-charcoal">
                  Yuri <span className="text-rose-gold">(유리)</span>
                </p>
                <p className="text-xs text-seoul-soft">K-Beauty Advisor</p>
              </div>
              <button
                onClick={() => setIsOpen(false)}
                className="w-8 h-8 rounded-full hover:bg-white/50 flex items-center justify-center transition-colors"
                aria-label="Close chat"
              >
                <X className="w-4 h-4 text-seoul-soft" />
              </button>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-gradient-to-br from-rose-gold/20 to-glass-100 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6 text-rose-gold" />
                  </div>
                  <p className="text-sm font-medium text-seoul-charcoal mb-1">
                    Hi! I&apos;m Yuri
                  </p>
                  <p className="text-xs text-seoul-soft max-w-[240px] mx-auto leading-relaxed">
                    Ask me anything about Korean skincare — ingredients, routines, trending products, or authenticity.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2 justify-center">
                    {[
                      'Best serum for glass skin?',
                      'Is this sunscreen legit?',
                      'Build me a routine',
                    ].map((q) => (
                      <button
                        key={q}
                        onClick={() => sendMessage(q)}
                        className="text-xs px-3 py-1.5 rounded-full bg-seoul-blush/50 text-rose-dark hover:bg-seoul-blush transition-colors"
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
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-rose-gold to-glass-500 text-white'
                        : 'bg-white/80 border border-white/50 text-seoul-charcoal shadow-glass'
                    }`}
                  >
                    {msg.content}
                    {msg.isStreaming && (
                      <span className="inline-block w-1 h-3 bg-rose-gold/60 animate-pulse ml-0.5 align-middle" />
                    )}
                  </div>
                </div>
              ))}

              {/* Conversion prompt when at limit */}
              {isAtLimit && (
                <div className="bg-gradient-to-br from-seoul-blush/30 to-glass-100/30 rounded-2xl p-4 border border-white/50 text-center">
                  <p className="text-xs text-seoul-charcoal font-medium mb-1">
                    I could help you so much more with a skin profile!
                  </p>
                  <p className="text-xs text-seoul-soft mb-3">
                    Create your free account for unlimited Yuri, personalized routines, and 6 specialist agents.
                  </p>
                  <a
                    href="/register"
                    className="inline-block glass-button-primary text-xs py-2 px-5"
                  >
                    Start Free
                  </a>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            {!isAtLimit && (
              <div className="flex items-end gap-2 p-3 border-t border-white/50 bg-white/60">
                <textarea
                  ref={inputRef}
                  value={input}
                  onChange={(e) => setInput(e.target.value)}
                  onKeyDown={handleKeyDown}
                  placeholder="Ask about K-beauty..."
                  disabled={isStreaming}
                  rows={1}
                  className="flex-1 resize-none text-sm py-2 px-3 rounded-xl bg-white/70 border border-white/50 focus:outline-none focus:ring-2 focus:ring-glass-500/30 placeholder:text-seoul-soft/50"
                  aria-label="Message Yuri"
                />
                <button
                  onClick={() => sendMessage(input)}
                  disabled={isStreaming || !input.trim()}
                  className="flex-shrink-0 w-9 h-9 rounded-full bg-gradient-to-br from-rose-gold to-rose-light text-white flex items-center justify-center transition-all hover:shadow-glass disabled:opacity-40"
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
                <p className="text-[10px] text-seoul-soft/60">
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

/**
 * Increments the shared widget message count from outside (e.g., Layer 2 TryYuriSection).
 */
export function incrementWidgetMessageCount(): number {
  const current = getMessageCount()
  const next = current + 1
  setMessageCount(next)
  return next
}

export function getRemainingWidgetMessages(): number {
  return MAX_FREE_MESSAGES - getMessageCount()
}
