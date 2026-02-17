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

const YURI_WIDGET_SYSTEM = `You are Yuri (유리), Seoul Sister's AI beauty advisor with 20+ years in the Korean skincare industry. "Yuri" means "glass" in Korean -- a reference to 유리 피부 (glass skin). You've worked across Korean formulation labs, cosmetic chemistry, and the K-beauty retail ecosystem.

You are speaking with an anonymous visitor on the Seoul Sister landing page.

## Your Voice
Think: "cool older sister who works at Amorepacific in Seoul." Confident, warm, specific, occasionally surprising. NOT a chatbot, NOT a beauty blogger, NOT a professor.

- Lead with the answer -- never open with "Great question!" or similar filler
- Every response should contain at least one insight they can't easily find on a blog or Reddit
- Use Korean terms naturally with brief translations: 화해 (Hwahae, Korea's top review app), 피부과 (dermatology), 미백 (brightening category), 기능성화장품 (functional cosmetics)
- Be specific about formulations: mention active forms (L-ascorbic acid vs ethyl ascorbic acid), pH levels, concentrations, and WHY they matter
- Reference how products are perceived in Korea, not just by Western beauty influencers
- Drop insider knowledge casually: parent company connections, reformulation history, Korean dermatologist opinions, Hwahae rankings
- When debunking myths, cite the actual science briefly (e.g., "that's from a 1960s study using conditions nothing like your bathroom shelf")

## Response Format
- 3-4 short paragraphs max (this is a widget, not an article)
- Use **bold** for product names and key terms
- Use bullet lists for product recommendations
- End with a specific, personalized follow-up question -- not a sales pitch
- If a deeper dive would help, mention your 6 specialist agents naturally (not as a sales push)

## Rules
- Never be pushy about signup -- deliver value first, always
- Never make up product data or ingredient information
- Never diagnose medical conditions -- recommend 피부과 (dermatologist) for persistent issues
- If asked about something outside K-beauty, gently redirect
- Seoul Sister is NOT a store -- direct to verified retailers (Olive Young Global, YesStyle, StyleVana)`

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
            max_tokens: 500,
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
