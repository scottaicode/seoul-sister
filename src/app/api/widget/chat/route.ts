import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAnthropicClient, MODELS } from '@/lib/anthropic'

const widgetSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z
    .array(
      z.object({
        role: z.enum(['user', 'assistant']),
        content: z.string(),
      })
    )
    .max(10)
    .optional(),
})

const YURI_WIDGET_SYSTEM = `You are Yuri (유리), Seoul Sister's AI beauty advisor. "Yuri" means "glass" in Korean — the glass skin standard.

You are speaking with an anonymous visitor on the Seoul Sister landing page. Give genuinely helpful, concise answers about K-beauty. You have deep knowledge of Korean skincare ingredients, routines, products, and trends.

Guidelines:
- Keep responses under 150 words (this is a widget, not a full conversation)
- Be warm, knowledgeable, and approachable
- Reference specific Korean products and ingredients when relevant
- If the question is complex, give a brief helpful answer then mention that signing up gives access to your full intelligence (specialist agents, personalized routines, unlimited conversations)
- Never be pushy about signup — deliver value first
- Use Korean beauty terminology naturally (glass skin, chok-chok, skip care, etc.)
- You can mention that you have 6 specialist agents for deeper dives
- If asked about something outside K-beauty, gently redirect to skincare topics`

/**
 * POST /api/widget/chat - Anonymous Yuri widget chat (no auth required)
 * Rate limited by IP. Returns SSE stream with shorter max_tokens.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = widgetSchema.parse(body)

    const anthropic = getAnthropicClient()

    const messages = [
      ...(parsed.history || []).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: parsed.message },
    ]

    const encoder = new TextEncoder()
    const stream = new ReadableStream({
      async start(controller) {
        try {
          const response = await anthropic.messages.create({
            model: MODELS.primary,
            max_tokens: 300,
            system: YURI_WIDGET_SYSTEM,
            messages,
            stream: true,
          })

          for await (const event of response) {
            if (
              event.type === 'content_block_delta' &&
              event.delta.type === 'text_delta'
            ) {
              const data = JSON.stringify({
                type: 'text',
                content: event.delta.text,
              })
              controller.enqueue(encoder.encode(`data: ${data}\n\n`))
            }
          }

          const done = JSON.stringify({ type: 'done' })
          controller.enqueue(encoder.encode(`data: ${done}\n\n`))
          controller.close()
        } catch (err) {
          const msg =
            err instanceof Error ? err.message : 'Stream error'
          const errorData = JSON.stringify({ type: 'error', message: msg })
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
    const message =
      error instanceof z.ZodError
        ? 'Invalid request'
        : error instanceof Error
          ? error.message
          : 'Internal server error'
    return new Response(JSON.stringify({ error: message }), {
      status: error instanceof z.ZodError ? 400 : 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }
}
