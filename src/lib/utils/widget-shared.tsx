import React from 'react'

// ---------------------------------------------------------------------------
// Shared markdown renderer for widget components
// ---------------------------------------------------------------------------

/** Lightweight markdown: **bold**, *italic*, `- ` list items, paragraph spacing */
export function renderMarkdown(text: string) {
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

// ---------------------------------------------------------------------------
// Shared SSE stream parser for widget components
// ---------------------------------------------------------------------------

export interface WidgetMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  isStreaming?: boolean
  isIncomplete?: boolean
}

interface StreamCallbacks {
  onText: (text: string) => void
  onDone: (cleanedMessage?: string) => void
  onError: (error: Error) => void
}

/**
 * Parse an SSE ReadableStream from the widget chat API.
 * Handles text deltas, done events, and errors.
 * Respects the AbortSignal for cancellation.
 */
export async function parseWidgetStream(
  body: ReadableStream<Uint8Array>,
  signal: AbortSignal,
  callbacks: StreamCallbacks
): Promise<void> {
  const reader = body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  try {
    while (true) {
      if (signal.aborted) break

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
            callbacks.onText(event.content)
          } else if (event.type === 'done') {
            callbacks.onDone(event.message)
          } else if (event.type === 'error') {
            callbacks.onError(new Error(event.message))
          }
        } catch {
          // skip malformed events
        }
      }
    }
  } finally {
    reader.releaseLock()
  }
}
