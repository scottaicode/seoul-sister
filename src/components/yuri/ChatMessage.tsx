'use client'

import { memo } from 'react'
import { Sparkles, User } from 'lucide-react'
import SpecialistBadge from './SpecialistBadge'
import type { ChatMessage as ChatMessageType } from '@/types/yuri'

interface ChatMessageProps {
  message: ChatMessageType
}

/**
 * Render markdown formatting for Yuri's responses:
 * - # / ## / ### headings
 * - **bold**, *italic*, `code`
 * - Bullet lists (- item, * item)
 * - Numbered lists (1. item)
 * - > blockquotes
 * - --- horizontal rules
 * - | tables (mobile-responsive)
 * - Blank lines as spacing
 */
function formatContent(content: string): React.ReactNode[] {
  const lines = content.split('\n')
  const elements: React.ReactNode[] = []
  let listItems: string[] = []
  let numberedItems: string[] = []
  let blockquoteLines: string[] = []
  let tableRows: string[][] = []
  let tableAlignRow = -1

  let keyIdx = 0
  const nextKey = () => `el-${keyIdx++}`

  // ── Inline formatting ──────────────────────────────────────────────
  function formatInline(text: string): React.ReactNode {
    const parts: React.ReactNode[] = []
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
          <code key={match.index} className="bg-white/10 px-1.5 py-0.5 rounded text-[13px] font-mono text-gold-light">
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

  // ── Flush accumulators ──────────────────────────────────────────────
  function flushList() {
    if (listItems.length > 0) {
      elements.push(
        <ul key={nextKey()} className="list-disc list-inside space-y-1 my-2">
          {listItems.map((item, i) => (
            <li key={i}>{formatInline(item)}</li>
          ))}
        </ul>
      )
      listItems = []
    }
  }

  function flushNumberedList() {
    if (numberedItems.length > 0) {
      elements.push(
        <ol key={nextKey()} className="list-decimal list-inside space-y-1 my-2">
          {numberedItems.map((item, i) => (
            <li key={i}>{formatInline(item)}</li>
          ))}
        </ol>
      )
      numberedItems = []
    }
  }

  function flushBlockquote() {
    if (blockquoteLines.length > 0) {
      elements.push(
        <blockquote key={nextKey()} className="border-l-2 border-gold/40 pl-3 my-2 text-white/60 italic">
          {blockquoteLines.map((line, i) => (
            <p key={i} className="my-0.5 leading-relaxed">{formatInline(line)}</p>
          ))}
        </blockquote>
      )
      blockquoteLines = []
    }
  }

  function flushTable() {
    if (tableRows.length === 0) return

    // Find header and data rows (skip alignment row)
    const header = tableRows[0]
    const dataRows = tableRows.filter((_, i) => i !== 0 && i !== tableAlignRow)

    elements.push(
      <div key={nextKey()} className="overflow-x-auto my-3 -mx-1 px-1 scrollbar-hide">
        <table className="w-full text-xs border-collapse">
          <thead>
            <tr className="border-b border-white/15">
              {header.map((cell, i) => (
                <th key={i} className="text-left font-semibold text-white py-1.5 px-2 whitespace-nowrap">
                  {formatInline(cell.trim())}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dataRows.map((row, ri) => (
              <tr key={ri} className="border-b border-white/5">
                {row.map((cell, ci) => (
                  <td key={ci} className="py-1.5 px-2 text-white/70 whitespace-nowrap">
                    {formatInline(cell.trim())}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )
    tableRows = []
    tableAlignRow = -1
  }

  function flushAll() {
    flushList()
    flushNumberedList()
    flushBlockquote()
    flushTable()
  }

  // ── Main line parser ────────────────────────────────────────────────
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()

    // Table row: starts and ends with | or has multiple |
    const isTableRow = /^\|(.+)\|$/.test(trimmed)
    const isAlignRow = /^\|[\s:|-]+\|$/.test(trimmed)

    if (isTableRow) {
      // Flush non-table accumulators before starting table
      if (tableRows.length === 0) {
        flushList()
        flushNumberedList()
        flushBlockquote()
      }
      const cells = trimmed.slice(1, -1).split('|')
      if (isAlignRow) {
        tableAlignRow = tableRows.length
      }
      tableRows.push(cells)
      continue
    }

    // If we were accumulating table rows and hit a non-table line, flush
    if (tableRows.length > 0) {
      flushTable()
    }

    // Horizontal rule
    if (/^-{3,}$/.test(trimmed) || /^\*{3,}$/.test(trimmed)) {
      flushAll()
      elements.push(<hr key={nextKey()} className="border-white/10 my-3" />)
      continue
    }

    // Headings (# ## ###)
    if (trimmed.startsWith('### ')) {
      flushAll()
      elements.push(
        <h4 key={nextKey()} className="font-display font-semibold text-sm text-white mt-3 mb-1">
          {formatInline(trimmed.slice(4))}
        </h4>
      )
    } else if (trimmed.startsWith('## ')) {
      flushAll()
      elements.push(
        <h3 key={nextKey()} className="font-display font-semibold text-base text-white mt-3 mb-1">
          {formatInline(trimmed.slice(3))}
        </h3>
      )
    } else if (trimmed.startsWith('# ')) {
      flushAll()
      elements.push(
        <h2 key={nextKey()} className="font-display font-bold text-lg text-white mt-3 mb-1">
          {formatInline(trimmed.slice(2))}
        </h2>
      )
    }
    // Blockquote
    else if (trimmed.startsWith('> ')) {
      flushList()
      flushNumberedList()
      blockquoteLines.push(trimmed.slice(2))
    }
    // Unordered list
    else if (/^[-*] /.test(trimmed)) {
      flushNumberedList()
      flushBlockquote()
      listItems.push(trimmed.slice(2))
    }
    // Numbered list
    else if (/^\d+\. /.test(trimmed)) {
      flushList()
      flushBlockquote()
      const numMatch = trimmed.match(/^\d+\.\s+(.*)$/)
      numberedItems.push(numMatch ? numMatch[1] : trimmed)
    }
    // Blank line
    else if (trimmed === '') {
      flushAll()
      elements.push(<div key={nextKey()} className="h-2" />)
    }
    // Regular paragraph
    else {
      flushAll()
      elements.push(
        <p key={nextKey()} className="my-0.5 leading-relaxed">
          {formatInline(trimmed)}
        </p>
      )
    }
  }

  flushAll()
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

        {/* Images */}
        {message.image_urls && message.image_urls.length > 0 && (
          <div className={`flex flex-wrap gap-2 ${message.content ? 'mb-2' : ''}`}>
            {message.image_urls.map((url, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={url}
                alt={`Shared image ${i + 1}`}
                className="max-w-[200px] max-h-[200px] rounded-lg object-cover border border-white/10"
              />
            ))}
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
