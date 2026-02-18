'use client'

import { memo } from 'react'
import { Sparkles, User } from 'lucide-react'
import SpecialistBadge from './SpecialistBadge'
import type { ChatMessage as ChatMessageType } from '@/types/yuri'

interface ChatMessageProps {
  message: ChatMessageType
}

/**
 * Render markdown-light formatting:
 * - **bold** -> <strong>
 * - *italic* -> <em>
 * - `code` -> <code>
 * - Bullet lists (- item)
 * - Newlines -> <br />
 */
function formatContent(content: string): React.ReactNode[] {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []

  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={`list-${elements.length}`} className="list-disc list-inside space-y-1 my-2">
          {listItems.map((item, i) => (
            <li key={i}>{formatInline(item)}</li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  function formatInline(text: string): React.ReactNode {
    // Process bold, italic, code inline markers
    const parts: React.ReactNode[] = []
    // Simple regex-based inline formatting
    const regex = /(\*\*(.+?)\*\*)|(\*(.+?)\*)|(`(.+?)`)/g
    let lastIndex = 0
    let match: RegExpExecArray | null

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index))
      }
      if (match[2]) {
        parts.push(<strong key={match.index} className="font-semibold text-white">{match[2]}</strong>)
      } else if (match[4]) {
        parts.push(<em key={match.index}>{match[4]}</em>)
      } else if (match[6]) {
        parts.push(
          <code
            key={match.index}
            className="bg-white/10 px-1.5 py-0.5 rounded text-[13px] font-mono text-gold-light"
          >
            {match[6]}
          </code>
        )
      }
      lastIndex = match.index + match[0].length
    }
    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex))
    }
    return parts.length > 0 ? parts : text
  }

  for (const line of lines) {
    const trimmed = line.trim()

    // Heading (## or ###)
    if (trimmed.startsWith('### ')) {
      flushList()
      elements.push(
        <h4 key={elements.length} className="font-display font-semibold text-sm text-white mt-3 mb-1">
          {formatInline(trimmed.slice(4))}
        </h4>
      )
    } else if (trimmed.startsWith('## ')) {
      flushList()
      elements.push(
        <h3 key={elements.length} className="font-display font-semibold text-base text-white mt-3 mb-1">
          {formatInline(trimmed.slice(3))}
        </h3>
      )
    } else if (/^[-*] /.test(trimmed)) {
      listItems.push(trimmed.slice(2))
    } else if (/^\d+\. /.test(trimmed)) {
      flushList()
      // Numbered list items
      elements.push(
        <div key={elements.length} className="my-0.5">
          {formatInline(trimmed)}
        </div>
      )
    } else if (trimmed === '') {
      flushList()
      elements.push(<div key={elements.length} className="h-2" />)
    } else {
      flushList()
      elements.push(
        <p key={elements.length} className="my-0.5 leading-relaxed">
          {formatInline(trimmed)}
        </p>
      )
    }
  }

  flushList()
  return elements
}

function ChatMessageComponent({ message }: ChatMessageProps) {
  const isUser = message.role === 'user'

  return (
    <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div
        className={`flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center ${
          isUser
            ? 'bg-white/10'
            : 'bg-gradient-to-br from-gold to-gold-light'
        }`}
      >
        {isUser ? (
          <User className="w-4 h-4 text-white/50" strokeWidth={2} />
        ) : (
          <Sparkles className="w-4 h-4 text-seoul-dark" strokeWidth={2} />
        )}
      </div>

      {/* Message bubble */}
      <div
        className={`max-w-[85%] min-w-0 ${
          isUser
            ? 'bg-gradient-to-br from-gold to-gold-light text-seoul-dark rounded-2xl rounded-tr-md px-4 py-3'
            : 'bg-seoul-card/80 backdrop-blur-md border border-white/10 rounded-2xl rounded-tl-md px-4 py-3'
        }`}
      >
        {/* Specialist badge for assistant messages */}
        {!isUser && message.specialist_type && (
          <div className="mb-2">
            <SpecialistBadge type={message.specialist_type} size="sm" />
          </div>
        )}

        {/* Content */}
        <div
          className={`text-sm ${
            isUser ? 'text-seoul-dark' : 'text-white/80'
          }`}
        >
          {isUser ? (
            <p className="leading-relaxed">{message.content}</p>
          ) : (
            <div className="space-y-0">{formatContent(message.content)}</div>
          )}

          {/* Streaming indicator */}
          {message.isStreaming && message.content.length > 0 && (
            <span className="inline-block w-1.5 h-4 bg-gold/60 animate-pulse ml-0.5 -mb-0.5 rounded-sm" />
          )}
          {message.isStreaming && message.content.length === 0 && (
            <div className="flex items-center gap-1.5 py-1">
              <span className="w-1.5 h-1.5 rounded-full bg-gold/40 animate-pulse" />
              <span className="w-1.5 h-1.5 rounded-full bg-gold/40 animate-pulse [animation-delay:150ms]" />
              <span className="w-1.5 h-1.5 rounded-full bg-gold/40 animate-pulse [animation-delay:300ms]" />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default memo(ChatMessageComponent)
