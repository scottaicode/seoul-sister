'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { MessageCircle, X, Send, Loader2, Sparkles } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  getMessageCount,
  setMessageCount,
  MAX_FREE_MESSAGES,
  onMessageCountChange,
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
    if (line.trim() === '') return <div key={i} className="h-2" />
    return <span key={i}>{parts}{i < lines.length - 1 ? ' ' : ''}</span>
  })
}

interface WidgetMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
}

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
    // Only save completed messages (not streaming)
    sessionStorage.setItem(
      SESSION_MESSAGES_KEY,
      JSON.stringify(msgs.filter((m) => !m.isStreaming))
    )
  } catch { /* storage full */ }
}

export default function YuriBubble() {
  const [isOpen, setIsOpen] = useState(false)
  const [messages, setMessages] = useState<WidgetMessage[]>(loadSessionMessages)
  const [input, setInput] = useState('')
  const [isStreaming, setIsStreaming] = useState(false)
  const [messageCount, setMessageCountState] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    setMessageCountState(getMessageCount())
    // Sync count across tabs
    return onMessageCountChange((count) => setMessageCountState(count))
  }, [])

  // Persist messages to sessionStorage whenever they change
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

  const isAtLimit = messageCount >= MAX_FREE_MESSAGES

  const sendMessage = useCallback(
    async (text: string) => {
      if (!text.trim() || isStreaming || isAtLimit) return

      const trimmed = text.trim()
      setError(null)

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
          const errBody = await response.json().catch(() => null)
          throw new Error(errBody?.error || 'Failed to get response')
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
        // Increment count only after successful stream
        const newCount = messageCount + 1
        setMessageCount(newCount)
        setMessageCountState(newCount)
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
            className="fixed bottom-4 right-4 md:bottom-5 md:right-5 z-50 w-12 h-12 md:w-14 md:h-14 rounded-full bg-gradient-to-br from-gold to-gold-light text-seoul-dark shadow-glow-gold flex items-center justify-center hover:shadow-glow-gold-lg hover:scale-105 transition-all duration-300 group"
            aria-label="Chat with Yuri"
          >
            <MessageCircle className="w-6 h-6" />
            <span className="absolute -top-10 right-0 bg-seoul-card text-white text-xs font-medium px-3 py-1.5 rounded-full shadow-glass whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none border border-white/10">
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
            className="fixed bottom-4 right-4 md:bottom-5 md:right-5 z-50 w-[calc(100vw-2rem)] max-w-[400px] h-[70vh] md:h-[500px] max-h-[calc(100vh-6rem)] rounded-2xl overflow-hidden bg-seoul-card/95 backdrop-blur-xl border border-white/10 shadow-glow-gold flex flex-col"
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
            <div className="flex-1 overflow-y-auto p-4 space-y-3 scrollbar-hide">
              {messages.length === 0 && (
                <div className="text-center py-8">
                  <div className="w-12 h-12 rounded-full bg-gold/10 flex items-center justify-center mx-auto mb-3">
                    <Sparkles className="w-6 h-6 text-gold" />
                  </div>
                  <p className="text-sm font-medium text-white mb-1">
                    Hi! I&apos;m Yuri
                  </p>
                  <p className="text-xs text-white/40 max-w-[240px] mx-auto leading-relaxed">
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
                    className={`max-w-[85%] rounded-2xl px-3.5 py-2.5 text-xs leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-gradient-to-br from-gold to-gold-light text-seoul-dark'
                        : 'bg-white/5 border border-white/10 text-white/80'
                    }`}
                  >
                    {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
                    {msg.isStreaming && (
                      <span className="inline-block w-1 h-3 bg-gold/60 animate-pulse ml-0.5 align-middle" />
                    )}
                  </div>
                </div>
              ))}

              {/* Conversion prompt when at limit */}
              {isAtLimit && (
                <div className="bg-gold/5 rounded-2xl p-4 border border-gold/20 text-center">
                  <p className="text-xs text-white font-medium mb-1">
                    I could help you so much more with a skin profile!
                  </p>
                  <p className="text-xs text-white/40 mb-3">
                    Subscribe to Seoul Sister Pro for full Yuri conversations, personalized routines, and all 6 specialist agents.
                  </p>
                  <a
                    href="/register"
                    className="inline-block glass-button-primary text-xs py-2 px-5"
                  >
                    Get Started
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
                  placeholder="Ask about K-beauty..."
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
