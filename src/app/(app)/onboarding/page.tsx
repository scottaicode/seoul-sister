'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { Sparkles, SkipForward } from 'lucide-react'
import { supabase } from '@/lib/supabase'
import ChatMessage from '@/components/yuri/ChatMessage'
import ChatInput from '@/components/yuri/ChatInput'
import type { ChatMessage as ChatMessageType } from '@/types/yuri'

export default function OnboardingPage() {
  const router = useRouter()
  const [messages, setMessages] = useState<ChatMessageType[]>([])
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  // progress tracked internally for completion detection only
  const [progress, setProgress] = useState(0)
  const [isComplete, setIsComplete] = useState(false)
  const [conversationId, setConversationId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const scrollToBottom = useCallback(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
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
          body: JSON.stringify({ action: 'start_onboarding' }),
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
            router.replace('/dashboard')
            return
          }

          if (data.conversation_id) setConversationId(data.conversation_id)
          if (typeof data.progress === 'number') setProgress(data.progress)

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
  }, [getToken, router, parseSSEStream])

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
    [isStreaming, getToken, parseSSEStream]
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

      router.push('/yuri')
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
      router.push('/dashboard')
    } catch {
      router.push('/dashboard')
    }
  }, [getToken, router])

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
      <div className="sticky top-0 z-10 bg-seoul-card/90 backdrop-blur-md border-b border-white/10 px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-gold to-gold-light flex items-center justify-center shadow-glow-gold">
              <Sparkles className="w-4.5 h-4.5 text-seoul-dark" />
            </div>
            <div>
              <h1 className="font-display text-base font-semibold text-white">
                Meet Yuri
              </h1>
              <p className="text-xs text-white/40">Your K-beauty advisor</p>
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
          {isComplete && !isStreaming && (
            <div className="flex justify-center py-6">
              <button
                onClick={handleComplete}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-sm font-semibold shadow-glow-gold hover:shadow-glow-gold-lg hover:scale-[1.02] transition-all duration-200"
              >
                <Sparkles className="w-4 h-4" />
                See My Personalized Recommendations
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
