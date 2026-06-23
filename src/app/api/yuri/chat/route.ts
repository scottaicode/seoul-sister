export const maxDuration = 60

import { NextRequest } from 'next/server'
import { z } from 'zod'
import { streamAdvisorResponse } from '@/lib/yuri/advisor'
import { isRetryableError } from '@/lib/anthropic'
import { loadConversationMessages, createConversation } from '@/lib/yuri/memory'
import { cleanYuriResponse } from '@/lib/yuri/voice-cleanup'
import { supabase, getServiceClient } from '@/lib/supabase'
import { hasActiveSubscription } from '@/lib/subscription'
import { incrementYuriMessageCount } from '@/lib/usage'
import type { SpecialistType } from '@/types/database'

const chatSchema = z.object({
  message: z.string().min(1).max(10000),
  conversation_id: z.string().uuid().optional(),
  image_urls: z.array(z.string().min(1)).max(4).optional(),
  specialist_type: z
    .enum([
      'ingredient_analyst',
      'routine_architect',
      'authenticity_investigator',
      'trend_scout',
      'budget_optimizer',
      'sensitivity_guardian',
    ])
    .nullable()
    .optional(),
})

/**
 * POST /api/yuri/chat - Send a message to Yuri, receive streaming response
 *
 * Returns a ReadableStream of text chunks (Server-Sent Events format).
 * The final event includes the conversation_id and specialist_type metadata.
 */
export async function POST(request: NextRequest) {
  try {
    const token = request.headers.get('authorization')?.replace('Bearer ', '')
    if (!token) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)
    if (authError || !user) {
      return new Response(JSON.stringify({ error: 'Unauthorized' }), {
        status: 401,
        headers: { 'Content-Type': 'application/json' },
      })
    }

    // Check active subscription
    const isSubscribed = await hasActiveSubscription(user.id)
    if (!isSubscribed) {
      return new Response(
        JSON.stringify({ error: 'Active subscription required. Subscribe to use Yuri.' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      )
    }

    // Check and increment usage count
    const withinLimit = await incrementYuriMessageCount(user.id)
    if (!withinLimit) {
      return new Response(
        JSON.stringify({ error: "You've reached this month's message limit. It resets at the start of your next billing period." }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await request.json()
    const parsed = chatSchema.parse(body)

    // Get or create conversation
    let conversationId = parsed.conversation_id
    if (conversationId) {
      // Verify ownership
      const db = getServiceClient()
      const { data: conv } = await db
        .from('ss_yuri_conversations')
        .select('user_id')
        .eq('id', conversationId)
        .single()

      if (!conv || conv.user_id !== user.id) {
        return new Response(
          JSON.stringify({ error: 'Conversation not found' }),
          { status: 404, headers: { 'Content-Type': 'application/json' } }
        )
      }
    } else {
      conversationId = await createConversation(
        user.id,
        (parsed.specialist_type as SpecialistType) ?? null
      )
    }

    // Load conversation history
    const history = await loadConversationMessages(conversationId)

    // Create an SSE stream from the advisor async generator.
    //
    // IMPORTANT: We use a TransformStream instead of ReadableStream({ start })
    // because the start() pattern runs the entire async generator to completion
    // before flushing — the browser receives all chunks as one batch. The
    // TransformStream writable side flushes each write to the readable side
    // immediately, giving us real-time streaming to the client.
    const encoder = new TextEncoder()
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    // Run the generator in the background — each write flushes immediately
    const streamPromise = (async () => {
      try {
        const generator = streamAdvisorResponse({
          userId: user.id,
          conversationId,
          message: parsed.message,
          imageUrls: parsed.image_urls || [],
          conversationHistory: history,
          requestedSpecialist:
            parsed.specialist_type !== undefined
              ? (parsed.specialist_type as SpecialistType | null)
              : undefined,
        })

        let generatedTitle: string | undefined
        let fullResponse = ''
        for await (const chunk of generator) {
          // Check for title sentinel from advisor
          if (chunk.startsWith('__TITLE__')) {
            generatedTitle = chunk.slice(9)
            continue
          }
          fullResponse += chunk
          const data = JSON.stringify({ type: 'text', content: chunk })
          await writer.write(encoder.encode(`data: ${data}\n\n`))
        }

        // Send completion event with cleaned text so clients can swap out
        // any AI artifacts that were streamed in real-time
        const cleanedMessage = cleanYuriResponse(fullResponse)
        const meta = JSON.stringify({
          type: 'done',
          conversation_id: conversationId,
          ...(generatedTitle ? { title: generatedTitle } : {}),
          ...(cleanedMessage !== fullResponse ? { message: cleanedMessage } : {}),
        })
        await writer.write(encoder.encode(`data: ${meta}\n\n`))
      } catch (err) {
        // Full detail goes to the server logs (Vercel) for debugging.
        console.error(`[yuri/chat] Stream error for user ${user.id}, conv ${conversationId}:`, err)
        // The USER never sees a raw error object. Anthropic surfaces overloads
        // as a JSON string (`{"type":"error","error":{"type":"overloaded_error"...}}`)
        // in err.message; shipping that to the client produced the ugly red
        // `{"type":"error"...}` banner Bailey hit (Jun 23 2026) when Claude was
        // busy. The advisor now auto-retries transient overloads, so reaching
        // here means retries were exhausted (Claude still busy) or it's a genuine
        // failure. Either way, show a calm, honest, human message — and tell
        // retryable cases they can just resend.
        const friendlyMessage = isRetryableError(err)
          ? "Yuri's servers are unusually busy right now. Give it a moment and resend your message — it usually clears within a minute."
          : "Something went wrong on Yuri's end. Please resend your message, and if it keeps happening, try again in a few minutes."
        const errorData = JSON.stringify({ type: 'error', message: friendlyMessage })
        await writer.write(encoder.encode(`data: ${errorData}\n\n`))
      } finally {
        await writer.close()
      }
    })()

    // Prevent unhandled rejection if the stream errors after response is sent
    streamPromise.catch(() => {})

    const stream = readable

    return new Response(stream, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      console.error('[yuri/chat] Request error:', error)
    }
    const message =
      error instanceof z.ZodError
        ? 'Invalid request'
        : error instanceof Error
          ? error.message
          : 'Internal server error'
    const status = error instanceof z.ZodError ? 400 : 500
    return new Response(JSON.stringify({ error: message }), {
      status,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
