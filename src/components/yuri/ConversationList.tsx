'use client'

import { useEffect } from 'react'
import { formatDistanceToNow } from 'date-fns'
import { MessageCircle, Plus, ChevronLeft } from 'lucide-react'
import SpecialistBadge from './SpecialistBadge'
import type { ConversationSummary } from '@/types/yuri'

interface ConversationListProps {
  conversations: ConversationSummary[]
  currentConversationId: string | null
  onSelect: (conversationId: string) => void
  onNew: () => void
  onClose: () => void
  onLoad: () => void
}

export default function ConversationList({
  conversations,
  currentConversationId,
  onSelect,
  onNew,
  onClose,
  onLoad,
}: ConversationListProps) {
  useEffect(() => {
    onLoad()
  }, [onLoad])

  return (
    <div className="flex flex-col h-full bg-white/10 backdrop-blur-md">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-white/10">
        <button
          onClick={onClose}
          className="flex items-center gap-1 text-sm text-white/40 hover:text-white transition-colors"
          aria-label="Close conversation list"
        >
          <ChevronLeft className="w-4 h-4" />
          Back
        </button>
        <h2 className="font-display font-semibold text-sm text-white">
          Conversations
        </h2>
        <button
          onClick={onNew}
          className="flex items-center gap-1 text-sm text-gold hover:text-gold transition-colors"
          aria-label="New conversation"
        >
          <Plus className="w-4 h-4" />
          New
        </button>
      </div>

      {/* List */}
      <div className="flex-1 overflow-y-auto">
        {conversations.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <MessageCircle className="w-10 h-10 text-white/30 mb-3" strokeWidth={1.5} />
            <p className="text-sm text-white/40">No conversations yet</p>
            <p className="text-xs text-white/30 mt-1">Start chatting with Yuri!</p>
          </div>
        ) : (
          <ul className="divide-y divide-white/10">
            {conversations.map((conv) => {
              const isActive = conv.id === currentConversationId
              return (
                <li key={conv.id}>
                  <button
                    onClick={() => {
                      onSelect(conv.id)
                      onClose()
                    }}
                    className={`w-full text-left px-4 py-3 transition-colors duration-200 hover:bg-white/5 ${
                      isActive ? 'bg-gold/10' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium text-sm text-white truncate">
                          {conv.title || 'New conversation'}
                        </p>
                        {conv.specialist_type && (
                          <div className="mt-1">
                            <SpecialistBadge type={conv.specialist_type} size="sm" />
                          </div>
                        )}
                      </div>
                      <div className="flex flex-col items-end gap-1 flex-shrink-0">
                        <span className="text-[10px] text-white/40">
                          {formatDistanceToNow(new Date(conv.updated_at), {
                            addSuffix: true,
                          })}
                        </span>
                        <span className="text-[10px] text-white/30">
                          {conv.message_count} msg{conv.message_count !== 1 ? 's' : ''}
                        </span>
                      </div>
                    </div>
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </div>
  )
}
