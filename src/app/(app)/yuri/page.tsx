'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { History, Sparkles, X, AlertCircle } from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { useYuri } from '@/hooks/useYuri'
import ChatMessage from '@/components/yuri/ChatMessage'
import ChatInput from '@/components/yuri/ChatInput'
import ConversationList from '@/components/yuri/ConversationList'
import SpecialistPicker from '@/components/yuri/SpecialistPicker'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { SpecialistType } from '@/types/database'

const SUGGESTED_PROMPTS = [
  { text: 'Analyze my COSRX Snail Mucin ingredients', specialist: 'ingredient_analyst' as SpecialistType },
  { text: 'Build me a glass skin routine for oily skin', specialist: 'routine_architect' as SpecialistType },
  { text: "What's trending in Korea right now?", specialist: 'trend_scout' as SpecialistType },
  { text: 'Find me a budget dupe for Sulwhasoo', specialist: 'budget_optimizer' as SpecialistType },
]

export default function YuriPage() {
  const { user } = useAuth()
  const {
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
  } = useYuri()

  const [showHistory, setShowHistory] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Auto-scroll on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  const handleSend = useCallback(
    (message: string) => {
      sendMessage(message)
    },
    [sendMessage]
  )

  const handleSpecialistSelect = useCallback(
    (type: SpecialistType) => {
      const prompts: Record<SpecialistType, string> = {
        ingredient_analyst:
          "Hi! I'd like help analyzing some product ingredients. What should I share with you?",
        routine_architect:
          "I need help building a personalized K-beauty routine. Can you guide me through it?",
        authenticity_investigator:
          "I want to verify if a product I bought is authentic. How can we check?",
        trend_scout:
          "What are the hottest K-beauty trends right now? Anything exciting coming out of Seoul?",
        budget_optimizer:
          "I love K-beauty but I'm on a budget. Can you help me find affordable products that actually work?",
        sensitivity_guardian:
          "I have sensitive skin and I'm worried about reactions. Can you help me find safe products?",
      }
      sendMessage(prompts[type], { specialistType: type })
    },
    [sendMessage]
  )

  const handleSuggestedPrompt = useCallback(
    (prompt: string, specialist: SpecialistType) => {
      sendMessage(prompt, { specialistType: specialist })
    },
    [sendMessage]
  )

  if (!user) {
    return (
      <div className="flex items-center justify-center h-full p-6">
        <div className="text-center">
          <p className="text-seoul-soft">Please sign in to chat with Yuri.</p>
        </div>
      </div>
    )
  }

  const hasMessages = messages.length > 0

  return (
    <div className="flex flex-col h-[calc(100vh-64px)] md:h-[calc(100vh-0px)] relative">
      {/* Conversation history sidebar (mobile overlay) */}
      {showHistory && (
        <div className="absolute inset-0 z-30">
          <div
            className="absolute inset-0 bg-black/20 backdrop-blur-sm"
            onClick={() => setShowHistory(false)}
          />
          <div className="absolute inset-y-0 left-0 w-80 max-w-[85vw] z-40 shadow-xl">
            <ConversationList
              conversations={conversations}
              currentConversationId={currentConversationId}
              onSelect={loadConversation}
              onNew={() => {
                startNewConversation()
                setShowHistory(false)
              }}
              onClose={() => setShowHistory(false)}
              onLoad={loadConversations}
            />
          </div>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-white/80 backdrop-blur-md border-b border-white/50 flex-shrink-0">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setShowHistory(true)}
            className="w-8 h-8 rounded-full bg-seoul-pearl flex items-center justify-center hover:bg-seoul-blush transition-colors"
            aria-label="Conversation history"
          >
            <History className="w-4 h-4 text-seoul-soft" />
          </button>
          <div>
            <h1 className="font-display font-semibold text-base text-seoul-charcoal flex items-center gap-1.5">
              <Sparkles className="w-4 h-4 text-rose-gold" />
              Yuri
            </h1>
            <p className="text-[10px] text-seoul-soft">AI Beauty Advisor</p>
          </div>
        </div>

        {hasMessages && (
          <button
            onClick={() => startNewConversation()}
            className="text-xs text-rose-gold font-medium hover:text-rose-dark transition-colors"
          >
            New chat
          </button>
        )}
      </div>

      {/* Error banner */}
      {error && (
        <div className="flex items-center gap-2 px-4 py-2 bg-red-50 border-b border-red-100 text-red-700 text-sm">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1 truncate">{error}</span>
          <button onClick={clearError} aria-label="Dismiss error">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Chat messages area */}
      <div
        ref={chatContainerRef}
        className="flex-1 overflow-y-auto px-4 py-4"
      >
        {isLoadingHistory ? (
          <div className="flex items-center justify-center h-full">
            <LoadingSpinner size="lg" />
          </div>
        ) : hasMessages ? (
          <div className="max-w-2xl mx-auto space-y-4">
            {messages.map((msg) => (
              <ChatMessage key={msg.id} message={msg} />
            ))}
            <div ref={messagesEndRef} />
          </div>
        ) : (
          /* Welcome state */
          <div className="max-w-2xl mx-auto flex flex-col items-center justify-center h-full gap-8 animate-fade-in">
            {/* Yuri avatar */}
            <div className="flex flex-col items-center gap-3">
              <div className="w-16 h-16 rounded-full bg-gradient-to-br from-rose-gold to-rose-light flex items-center justify-center shadow-glass">
                <Sparkles className="w-7 h-7 text-white" strokeWidth={1.75} />
              </div>
              <div className="text-center">
                <h2 className="font-display font-bold text-xl text-seoul-charcoal">
                  Meet Yuri
                </h2>
                <p className="text-sm text-seoul-soft mt-1 max-w-xs">
                  Your AI beauty advisor backed by 6 specialist agents. Ask me anything about K-beauty.
                </p>
              </div>
            </div>

            {/* Specialist quick-start */}
            <div className="w-full">
              <p className="text-xs text-seoul-soft text-center mb-3 font-medium uppercase tracking-wide">
                Talk to a specialist
              </p>
              <SpecialistPicker onSelect={handleSpecialistSelect} />
            </div>

            {/* Suggested prompts */}
            <div className="w-full">
              <p className="text-xs text-seoul-soft text-center mb-3 font-medium uppercase tracking-wide">
                Or try asking
              </p>
              <div className="flex flex-col gap-2">
                {SUGGESTED_PROMPTS.map((prompt) => (
                  <button
                    key={prompt.text}
                    onClick={() =>
                      handleSuggestedPrompt(prompt.text, prompt.specialist)
                    }
                    className="glass-card px-4 py-3 text-left text-sm text-seoul-charcoal hover:shadow-glass-lg transition-all duration-300 hover:border-rose-gold/20"
                  >
                    {prompt.text}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Input area */}
      <div className="flex-shrink-0 pb-safe">
        <ChatInput onSend={handleSend} disabled={isStreaming} />
      </div>
    </div>
  )
}
