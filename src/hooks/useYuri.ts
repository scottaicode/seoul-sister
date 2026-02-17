'use client'

import { useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import type { ChatMessage, ConversationSummary } from '@/types/yuri'
import type { SpecialistType } from '@/types/database'

interface UseYuriReturn {
  messages: ChatMessage[]
  conversations: ConversationSummary[]
  currentConversationId: string | null
  isStreaming: boolean
  isLoadingHistory: boolean
  error: string | null
  sendMessage: (
    message: string,
    options?: {
      imageUrls?: string[]
      specialistType?: SpecialistType | null
    }
  ) => Promise<void>
  loadConversations: () => Promise<void>
  loadConversation: (conversationId: string) => Promise<void>
  startNewConversation: (specialistType?: SpecialistType | null) => void
  clearError: () => void
}

export function useYuri(): UseYuriReturn {
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [isStreaming, setIsStreaming] = useState(false)
  const [isLoadingHistory, setIsLoadingHistory] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const abortControllerRef = useRef<AbortController | null>(null)

  const getToken = useCallback(async (): Promise<string> => {
    const { data } = await supabase.auth.getSession()
    const token = data.session?.access_token
    if (!token) throw new Error('Not authenticated')
    return token
  }, [])

  const sendMessage = useCallback(
    async (
      message: string,
      options?: {
        imageUrls?: string[]
        specialistType?: SpecialistType | null
      }
    ) => {
      if (isStreaming) return

      setError(null)
      setIsStreaming(true)

      // Add user message to UI immediately
      const userMessage: ChatMessage = {
        id: `temp-${Date.now()}`,
        role: 'user',
        content: message,
        specialist_type: options?.specialistType ?? null,
        image_urls: options?.imageUrls ?? [],
        timestamp: new Date().toISOString(),
      }

      // Add placeholder assistant message for streaming
      const assistantMessage: ChatMessage = {
        id: `temp-assistant-${Date.now()}`,
        role: 'assistant',
        content: '',
        specialist_type: null,
        image_urls: [],
        timestamp: new Date().toISOString(),
        isStreaming: true,
      }

      setMessages((prev) => [...prev, userMessage, assistantMessage])

      try {
        const token = await getToken()
        abortControllerRef.current = new AbortController()

        const response = await fetch('/api/yuri/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({
            message,
            conversation_id: currentConversationId || undefined,
            image_urls: options?.imageUrls,
            specialist_type: options?.specialistType,
          }),
          signal: abortControllerRef.current.signal,
        })

        if (!response.ok) {
          const err = await response.json().catch(() => ({ error: 'Request failed' }))
          throw new Error(err.error || `HTTP ${response.status}`)
        }

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
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last && last.role === 'assistant' && last.isStreaming) {
                    updated[updated.length - 1] = {
                      ...last,
                      content: last.content + event.content,
                    }
                  }
                  return updated
                })
              } else if (event.type === 'done') {
                // Finalize assistant message
                setMessages((prev) => {
                  const updated = [...prev]
                  const last = updated[updated.length - 1]
                  if (last && last.role === 'assistant') {
                    updated[updated.length - 1] = {
                      ...last,
                      isStreaming: false,
                    }
                  }
                  return updated
                })

                // Set conversation ID if this was a new conversation
                if (event.conversation_id && !currentConversationId) {
                  setCurrentConversationId(event.conversation_id)
                }
              } else if (event.type === 'error') {
                throw new Error(event.message)
              }
            } catch (parseError) {
              // Skip malformed events
              if (parseError instanceof Error && parseError.message !== jsonStr) {
                throw parseError
              }
            }
          }
        }
      } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') return

        const errMsg = err instanceof Error ? err.message : 'Failed to send message'
        setError(errMsg)

        // Remove the streaming assistant message on error
        setMessages((prev) => {
          const updated = prev.filter((m) => !m.isStreaming)
          return updated
        })
      } finally {
        setIsStreaming(false)
        abortControllerRef.current = null
      }
    },
    [isStreaming, currentConversationId, getToken]
  )

  const loadConversations = useCallback(async () => {
    try {
      const token = await getToken()
      const response = await fetch('/api/yuri/conversations?limit=20', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!response.ok) throw new Error('Failed to load conversations')

      const data = await response.json()
      setConversations(
        data.conversations.map(
          (c: Record<string, unknown>) =>
            ({
              id: c.id as string,
              title: c.title as string | null,
              specialist_type: c.specialist_type as SpecialistType | null,
              message_count: c.message_count as number,
              last_message_preview: null,
              updated_at: c.updated_at as string,
            }) satisfies ConversationSummary
        )
      )
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load conversations')
    }
  }, [getToken])

  const loadConversation = useCallback(
    async (conversationId: string) => {
      setIsLoadingHistory(true)
      setError(null)
      try {
        const token = await getToken()
        const response = await fetch(
          `/api/yuri/conversations/${conversationId}/messages`,
          {
            headers: { Authorization: `Bearer ${token}` },
          }
        )

        if (!response.ok) throw new Error('Failed to load conversation')

        const data = await response.json()
        setMessages(
          data.messages.map(
            (m: Record<string, unknown>) =>
              ({
                id: m.id as string,
                role: m.role as 'user' | 'assistant',
                content: m.content as string,
                specialist_type: m.specialist_type as SpecialistType | null,
                image_urls: (m.image_urls as string[]) || [],
                timestamp: m.created_at as string,
              }) satisfies ChatMessage
          )
        )
        setCurrentConversationId(conversationId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load conversation')
      } finally {
        setIsLoadingHistory(false)
      }
    },
    [getToken]
  )

  const startNewConversation = useCallback(
    (_specialistType?: SpecialistType | null) => {
      setMessages([])
      setCurrentConversationId(null)
      setError(null)
    },
    []
  )

  const clearError = useCallback(() => setError(null), [])

  return {
    messages,
    conversations,
    currentConversationId,
    isStreaming,
    isLoadingHistory,
    error,
    sendMessage,
    loadConversations,
    loadConversation,
    startNewConversation,
    clearError,
  }
}
