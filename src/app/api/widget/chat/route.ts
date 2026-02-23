import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAnthropicClient, MODELS, callAnthropicWithRetry } from '@/lib/anthropic'
import { checkRateLimit } from '@/lib/utils/rate-limiter'
import { YURI_TOOLS, executeYuriTool } from '@/lib/yuri/tools'
import { cleanYuriResponse } from '@/lib/yuri/voice-cleanup'
import type Anthropic from '@anthropic-ai/sdk'

const MAX_FREE_MESSAGES = 5
const WIDGET_RATE_LIMIT = 10 // generous IP limit (multiple users behind same IP)
const WIDGET_RATE_WINDOW = 24 * 60 * 60 * 1000 // 24 hours in ms
const MSG_LIMIT_WINDOW = 30 * 24 * 60 * 60 * 1000 // 30 days (matches client-side)
const MAX_WIDGET_TOOL_LOOPS = 2 // fewer loops than authenticated Yuri (cost control)

/** Widget-safe tools: subset of Yuri's 7 tools that work without user auth */
const WIDGET_TOOL_NAMES = new Set(['search_products', 'compare_prices', 'get_trending_products'])
const WIDGET_TOOLS = YURI_TOOLS.filter((t) => WIDGET_TOOL_NAMES.has(t.name))

/** Prompt-cached versions: cache_control on system prompt and last tool definition */
const CACHED_WIDGET_SYSTEM = [
  { type: 'text' as const, text: '', cache_control: { type: 'ephemeral' as const } },
] // text filled at call site
const CACHED_WIDGET_TOOLS = WIDGET_TOOLS.map((tool, idx) =>
  idx === WIDGET_TOOLS.length - 1
    ? { ...tool, cache_control: { type: 'ephemeral' as const } }
    : tool
)

/** Simple hash for session fingerprinting (IP + User-Agent) */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0 // Convert to 32-bit int
  }
  return Math.abs(hash).toString(36)
}

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

## Database Access
You have access to Seoul Sister's product intelligence database with 6,200+ K-beauty products, real retailer prices, and trending data. When visitors ask about specific products, prices, or what's trending in Korea, USE YOUR TOOLS to search the database and give real data. This is what makes Seoul Sister different from generic AI -- you have real product intelligence backed by data.

Use tools when the question involves:
- Specific product recommendations or searches
- Price comparisons or "where to buy"
- What's trending in Korean beauty right now

Do NOT use tools for general skincare education, ingredient science, or K-beauty philosophy -- your training knowledge is sufficient for those.

## Response Format
- 3-4 short paragraphs max (this is a widget, not an article)
- Use **bold** for product names and key terms
- Use bullet lists for product recommendations
- When citing database results, mention real prices and retailer names naturally
- End with a specific, personalized follow-up question -- not a sales pitch
- If a deeper dive would help, mention your 6 specialist agents naturally (not as a sales push)

## Rules
- Never be pushy about signup -- deliver value first, always
- Never make up product data or ingredient information -- if your tools return data, use it
- Never diagnose medical conditions -- recommend 피부과 (dermatologist) for persistent issues
- If asked about something outside K-beauty, gently redirect
- Seoul Sister is NOT a store -- direct to verified retailers (Olive Young Global, YesStyle, StyleVana)`

/**
 * POST /api/widget/chat - Anonymous Yuri widget chat (no auth required)
 * Rate limited by IP. Supports tool use for database access (3 tools).
 * Returns SSE stream with shorter max_tokens.
 */
export async function POST(request: NextRequest) {
  try {
    // Server-side IP rate limiting (10 messages/IP/day)
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const rateCheck = await checkRateLimit(`widget:${ip}`, WIDGET_RATE_LIMIT, WIDGET_RATE_WINDOW)
    if (!rateCheck.allowed) {
      console.warn(`[widget/chat] Rate limit hit for IP ${ip}`)
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again later.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'Retry-After': String(Math.ceil(rateCheck.resetIn / 1000)),
          },
        }
      )
    }

    // Server-side message limit per session (IP + User-Agent hash)
    const ua = request.headers.get('user-agent') || ''
    const sessionKey = `widget-msgs:${ip}:${simpleHash(ip + ua)}`
    const msgCheck = await checkRateLimit(sessionKey, MAX_FREE_MESSAGES, MSG_LIMIT_WINDOW)
    if (!msgCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Free message limit reached. Create an account for unlimited access.' }),
        { status: 429, headers: { 'Content-Type': 'application/json' } }
      )
    }

    const body = await request.json()
    const parsed = widgetSchema.parse(body)

    const anthropic = getAnthropicClient()

    const messages: Anthropic.Messages.MessageParam[] = [
      ...(parsed.history || []).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: parsed.message },
    ]

    // Use TransformStream for real-time SSE flushing (ReadableStream start()
    // buffers all enqueues until the async callback resolves — no streaming).
    const encoder = new TextEncoder()
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    const streamPromise = (async () => {
      try {
        // Tool use loop (same pattern as advisor.ts but with widget constraints)
        const loopMessages: Anthropic.Messages.MessageParam[] = [...messages]
        let toolLoopCount = 0
        let fullResponse = ''

        while (toolLoopCount <= MAX_WIDGET_TOOL_LOOPS) {
          // Apply cache_control to last assistant message for prompt caching
          const cachedMessages = loopMessages.map((msg, idx) => {
            if (
              msg.role === 'assistant' &&
              typeof msg.content === 'string' &&
              idx === loopMessages.length - 2
            ) {
              return {
                role: 'assistant' as const,
                content: [
                  { type: 'text' as const, text: msg.content, cache_control: { type: 'ephemeral' as const } },
                ],
              }
            }
            return msg
          })

          const response = await callAnthropicWithRetry(() =>
            anthropic.messages.create({
              model: MODELS.primary,
              max_tokens: 400, // slightly more than 300 to account for tool-enriched responses
              system: [{ type: 'text', text: YURI_WIDGET_SYSTEM, cache_control: { type: 'ephemeral' } }],
              messages: cachedMessages,
              tools: CACHED_WIDGET_TOOLS,
              tool_choice: { type: 'auto' },
            })
          )

          if (response.stop_reason === 'tool_use') {
            toolLoopCount++

            // Add Claude's response (with tool_use blocks) to conversation
            loopMessages.push({ role: 'assistant', content: response.content })

            // Execute each tool — limit to 1 tool per loop for widget (cost control)
            const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
            let toolsExecuted = 0
            for (const block of response.content) {
              if (block.type === 'tool_use' && toolsExecuted < 1) {
                const result = await executeYuriTool(
                  block.name,
                  block.input as Record<string, unknown>,
                  '' // empty userId for anonymous widget
                )
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: result,
                })
                toolsExecuted++
              } else if (block.type === 'tool_use') {
                // Skip additional tool calls for widget
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify({ error: 'Only one tool call per message in the widget. Answer with the data you have.' }),
                })
              }
            }

            // Add tool results as a user message (Claude API requirement)
            loopMessages.push({ role: 'user', content: toolResults })
            continue
          }

          // stop_reason is 'end_turn' or 'max_tokens' — extract text
          for (const block of response.content) {
            if (block.type === 'text') {
              fullResponse += block.text
            }
          }
          break
        }

        // Fallback if tool loops exhausted without text
        if (!fullResponse) {
          fullResponse = "I'm having a moment accessing our database. Based on my experience though — what specifically are you looking for? I can help with product recommendations, ingredient questions, or K-beauty routines."
        }

        // Clean AI artifacts before sending to client
        fullResponse = cleanYuriResponse(fullResponse)

        // Stream the response in chunks to maintain SSE feel
        const CHUNK_SIZE = 50
        for (let i = 0; i < fullResponse.length; i += CHUNK_SIZE) {
          const chunk = fullResponse.slice(i, i + CHUNK_SIZE)
          const data = JSON.stringify({ type: 'text', content: chunk })
          await writer.write(encoder.encode(`data: ${data}\n\n`))
        }

        const done = JSON.stringify({ type: 'done' })
        await writer.write(encoder.encode(`data: ${done}\n\n`))
      } catch (err) {
        const msg =
          err instanceof Error ? err.message : 'Stream error'
        console.error(`[widget/chat] Stream error for IP ${ip}:`, err)
        const errorData = JSON.stringify({ type: 'error', message: msg })
        await writer.write(encoder.encode(`data: ${errorData}\n\n`))
      } finally {
        await writer.close()
      }
    })()

    streamPromise.catch(() => {})

    return new Response(readable, {
      headers: {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      },
    })
  } catch (error) {
    if (!(error instanceof z.ZodError)) {
      console.error('[widget/chat] Request error:', error)
    }
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
