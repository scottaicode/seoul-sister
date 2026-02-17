import { NextRequest } from 'next/server'
import { z } from 'zod'
import { streamAdvisorResponse } from '@/lib/yuri/advisor'
import { loadConversationMessages, createConversation } from '@/lib/yuri/memory'
import { AppError } from '@/lib/utils/error-handler'
import { supabase, getServiceClient } from '@/lib/supabase'
import type { SpecialistType } from '@/types/database'

const chatSchema = z.object({
  message: z.string().min(1).max(10000),
  conversation_id: z.string().uuid().optional(),
  image_urls: z.array(z.string().url()).max(4).optional(),
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

    // Create a readable stream for SSE
    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
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

          for await (const chunk of generator) {
            const data = JSON.stringify({ type: 'text', content: chunk })
            controller.enqueue(encoder.encode(`data: ${data}\n\n`))
          }

          // Send completion event with metadata
          const meta = JSON.stringify({
            type: 'done',
            conversation_id: conversationId,
          })
          controller.enqueue(encoder.encode(`data: ${meta}\n\n`))
          controller.close()
        } catch (err) {
          console.error(`[yuri/chat] Stream error for user ${user.id}, conv ${conversationId}:`, err)
          const errMsg =
            err instanceof AppError
              ? err.message
              : err instanceof Error
                ? err.message
                : 'Stream error'
          const errorData = JSON.stringify({ type: 'error', message: errMsg })
          controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
          controller.close()
        }
      },
    })

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
