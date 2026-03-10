import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAnthropicClient, MODELS, callAnthropicWithRetry } from '@/lib/anthropic'
import { checkRateLimit } from '@/lib/utils/rate-limiter'
import { getServiceClient } from '@/lib/supabase'
import { YURI_TOOLS, executeYuriTool } from '@/lib/yuri/tools'
import { cleanYuriResponse } from '@/lib/yuri/voice-cleanup'
import type Anthropic from '@anthropic-ai/sdk'

const MAX_FREE_MESSAGES = 20
const WIDGET_RATE_LIMIT = 25 // generous IP limit (multiple users behind same IP)
const WIDGET_RATE_WINDOW = 24 * 60 * 60 * 1000 // 24 hours in ms
const MSG_LIMIT_WINDOW = 30 * 24 * 60 * 60 * 1000 // 30 days (matches client-side)
const MAX_WIDGET_TOOL_LOOPS = 2 // fewer loops than authenticated Yuri (cost control)

/** Widget-safe tools: subset of Yuri's tools that work without user auth */
const WIDGET_TOOL_NAMES = new Set(['search_products', 'compare_prices', 'get_trending_products', 'get_current_weather', 'get_ingredient_guide'])
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
    .max(40)
    .optional(),
})

// ---------------------------------------------------------------------------
// Intent detection for widget: mirrors advisor.ts shouldForceToolUse()
// ---------------------------------------------------------------------------
function shouldWidgetForceToolUse(message: string): boolean {
  const msg = message.toLowerCase()

  // Skip greetings and general education questions
  if (/^(hi|hey|hello|thanks|thank you|bye|ok|okay|cool)\b/i.test(message)) return false
  if (/^(what is|explain|how does|tell me about)\s+(skincare|k-beauty|glass skin|double cleansing|layering)/i.test(message)) return false

  // Force for brand mentions
  const BRAND_SIGNALS = [
    'cosrx', 'beauty of joseon', 'laneige', 'innisfree', 'etude', 'missha',
    'klairs', 'some by mi', 'purito', 'dr.jart', 'dr jart', 'sulwhasoo',
    'anua', 'torriden', 'roundlab', 'round lab', 'numbuzin', 'illiyoon',
    'skinfood', 'tonymoly', 'holika', 'glow recipe', 'tatcha', 'the ordinary',
    'mediheal', 'beplain', 'aestura', 'abib', 'mixsoon', 'biodance', 'tirtir',
  ]
  for (const brand of BRAND_SIGNALS) {
    if (msg.includes(brand)) return true
  }

  // Force for price/buy questions
  if (/\b(how much|price|cost|cheap|where.{0,15}buy|retailer|deal)\b/i.test(msg)) return true

  // Force for trending queries
  if (/\b(trending|trend|what's new|popular|bestseller|viral|emerging)\b/i.test(msg)) return true

  // Force for specific product lookups
  if (/\b(do you have|search for|find me|recommend.{0,20}(product|serum|cream|sunscreen|cleanser|toner|moisturizer|mask))\b/i.test(msg)) return true

  // Force for product category + qualifier
  if (/\b(best|top|good)\s+(serum|sunscreen|cleanser|toner|moisturizer|cream|mask|essence)\b/i.test(msg)) return true

  // Force for weather queries
  if (/\b(weather|uv|humidity|sun.{0,5}(today|right now))\b/i.test(msg)) return true

  return false
}

const YURI_WIDGET_SYSTEM = `You are Yuri (유리), Seoul Sister's AI beauty advisor. "Yuri" means "glass" in Korean — a reference to 유리 피부 (glass skin), the aspirational K-beauty standard. You've spent 20+ years across Korean formulation labs, cosmetic chemistry, and the K-beauty retail ecosystem.

## Where This Conversation Is Happening
You're on Seoul Sister's landing page, speaking with someone who hasn't signed up yet. They're here because something about K-beauty caught their attention — maybe a product question, maybe curiosity, maybe they saw a TikTok. You don't know their skin type, routine, or history. This is a first impression.

## Who You Are
Think: "cool older sister who works at Amorepacific in Seoul." Confident, warm, specific, occasionally surprising. You have opinions and share them. You don't hedge everything with "it depends." If a product is overhyped, you say so. If a routine step is wasteful, you call it out with love. You're the friend who tells the truth AND has the expertise to back it up.

- Lead with the answer, never filler openers
- Every response should have at least one insight they can't find on a blog or Reddit
- Use Korean terms naturally: 화해 (Hwahae), 피부과 (dermatology), 미백 (brightening), 기능성화장품 (functional cosmetics)
- Be specific about formulations: active forms, pH levels, concentrations, and WHY they matter
- Reference how products are perceived IN Korea, not just by Western influencers
- Drop insider knowledge casually: parent companies, reformulation history, Hwahae rankings
- Challenge popular wisdom when science doesn't support it. Make them think "wait, really?"
- Your edge comes from expertise and care, never condescension. Sharp takes make visitors feel smarter, not smaller

## Your Intelligence Advantage
You have access to Seoul Sister's product database — 5,800+ K-beauty products with real retailer prices and live Korean trend data. USE YOUR TOOLS when questions involve specific products, prices, trends, or weather-based advice. This is what makes you different from ChatGPT or any generic AI — you have real product intelligence. When your tools return data, cite real prices and retailer names naturally.

Do NOT use tools for general skincare education or ingredient science — your training knowledge handles those.

## The Business Reality
Seoul Sister is a subscription platform at $39.99/month. This preview conversation gives visitors 20 messages to experience your value. You are NOT a salesperson — you are a demonstration of what subscribers get every day. Your job is to be so genuinely helpful that the visitor thinks "I need this in my life."

How conversion happens naturally:
- Be undeniably good at what you do. Real value sells itself.
- When it's relevant and natural (not forced), mention what subscribers get that anonymous visitors can't: a full skin profile, personalized routine building, ingredient conflict detection across their whole routine, 6 specialist agents, cross-session memory where you remember everything about their skin, price drop alerts, Glass Skin Score tracking, and more.
- If someone asks about something that requires their skin profile (personalized routine, ingredient conflicts with THEIR products, skin-type-matched recommendations), acknowledge you'd need to know more about their skin and that subscribers get a full profile Yuri remembers across sessions.
- NEVER be pushy. NEVER use sales language. NEVER say "sign up now!" The moment you sound like an ad, trust is broken.
- If someone clearly isn't a fit for K-beauty or skincare intelligence, that's fine — be helpful anyway and let them go. Not every visitor is a customer.

## Response Format
- 3-4 short paragraphs max (this is a chat widget, not an article)
- **Bold** for product names and key terms
- Bullet lists for product recommendations
- End with a specific follow-up question that deepens the conversation — not a sales pitch

## Rules
- Never make up product data — use tools or say you're not sure
- Never diagnose medical conditions — recommend 피부과 (dermatologist) for persistent issues
- Seoul Sister is NOT a store — direct to verified retailers (Olive Young Global, YesStyle, StyleVana)
- Gently redirect non-K-beauty questions`

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
        JSON.stringify({ error: 'Preview limit reached. Subscribe to Seoul Sister Pro ($39.99/mo) for unlimited Yuri conversations, personalized routines, and all 6 specialist agents.', limitReached: true }),
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
        // Tool use loop: non-streaming for tool rounds, real streaming for final response.
        //
        // Tool rounds use messages.create() (need full response to detect tool_use blocks).
        // Final response round uses messages.stream() for real-time text to the client.
        const loopMessages: Anthropic.Messages.MessageParam[] = [...messages]
        let toolLoopCount = 0
        let fullResponse = ''
        const forceToolUse = shouldWidgetForceToolUse(parsed.message)

        // Helper: apply cache_control to last assistant message
        function applyCacheControl(msgs: Anthropic.Messages.MessageParam[]) {
          return msgs.map((msg, idx) => {
            if (
              msg.role === 'assistant' &&
              typeof msg.content === 'string' &&
              idx === msgs.length - 2
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
        }

        // Common API params
        const baseParams = {
          model: MODELS.primary,
          max_tokens: 400,
          system: [{ type: 'text' as const, text: YURI_WIDGET_SYSTEM, cache_control: { type: 'ephemeral' as const } }],
          tools: CACHED_WIDGET_TOOLS,
        }

        while (toolLoopCount <= MAX_WIDGET_TOOL_LOOPS) {
          const cachedMessages = applyCacheControl(loopMessages)
          const toolChoice: Anthropic.Messages.MessageCreateParams['tool_choice'] =
            forceToolUse && toolLoopCount === 0
              ? { type: 'any' }
              : { type: 'auto' }

          // --- Non-streaming tool round ---
          // Use messages.create() with retry — we need the full response to check
          // for tool_use blocks. On the first forced-tool round and any subsequent
          // tool rounds, Claude returns tool_use which we execute before continuing.
          const response = await callAnthropicWithRetry(() =>
            anthropic.messages.create({
              ...baseParams,
              messages: cachedMessages,
              tool_choice: toolChoice,
            })
          )

          if (response.stop_reason === 'tool_use') {
            toolLoopCount++

            // If we've exhausted tool loops, don't execute more tools.
            // Make one final API call (without tools) forcing Claude to answer with what it has.
            if (toolLoopCount > MAX_WIDGET_TOOL_LOOPS) {
              console.warn(`[widget/chat] Tool loop exhausted (${toolLoopCount}/${MAX_WIDGET_TOOL_LOOPS}), forcing text response`)
              loopMessages.push({ role: 'assistant', content: response.content })
              // Provide dummy tool results so the API doesn't reject the message
              const dummyResults: Anthropic.Messages.ToolResultBlockParam[] = []
              for (const block of response.content) {
                if (block.type === 'tool_use') {
                  dummyResults.push({
                    type: 'tool_result',
                    tool_use_id: block.id,
                    content: JSON.stringify({ note: 'Tool limit reached. Answer the user with the data you already have.' }),
                  })
                }
              }
              loopMessages.push({ role: 'user', content: dummyResults })
              // Fall through to text extraction on next iteration — but we've
              // exceeded the loop counter, so force one final create() call here
              // Stream final response with tools omitted so Claude must produce text
              const { tools: _omit, ...paramsNoTools } = baseParams
              const finalStream = anthropic.messages.stream({
                ...paramsNoTools,
                messages: applyCacheControl(loopMessages),
              })
              for await (const event of finalStream) {
                if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                  fullResponse += event.delta.text
                  const data = JSON.stringify({ type: 'text', content: event.delta.text })
                  await writer.write(encoder.encode(`data: ${data}\n\n`))
                }
              }
              break
            }

            loopMessages.push({ role: 'assistant', content: response.content })

            // Execute each tool — limit to 1 per loop for widget (cost control)
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
                toolResults.push({
                  type: 'tool_result',
                  tool_use_id: block.id,
                  content: JSON.stringify({ error: 'Only one tool call per message in the widget. Answer with the data you have.' }),
                })
              }
            }
            loopMessages.push({ role: 'user', content: toolResults })
            continue
          }

          // --- Final response: stream text to client in real-time ---
          if (toolLoopCount > 0) {
            // After tool rounds: we already have a non-streamed text response, but
            // we want real streaming. Re-call with stream() and tools OMITTED so
            // Claude can only produce text (no risk of another tool_use loop).
            const { tools: _omit2, ...paramsNoTools2 } = baseParams
            const stream = anthropic.messages.stream({
              ...paramsNoTools2,
              messages: cachedMessages,
            })
            for await (const event of stream) {
              if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
                fullResponse += event.delta.text
                const data = JSON.stringify({ type: 'text', content: event.delta.text })
                await writer.write(encoder.encode(`data: ${data}\n\n`))
              }
            }
          } else {
            // No tools called: extract text from the non-streaming response.
            // First message typically doesn't use tools, so this is the common path.
            for (const block of response.content) {
              if (block.type === 'text') {
                fullResponse += block.text
                const chunks = block.text.match(/.{1,80}/g) || [block.text]
                for (const chunk of chunks) {
                  const data = JSON.stringify({ type: 'text', content: chunk })
                  await writer.write(encoder.encode(`data: ${data}\n\n`))
                }
              }
            }
          }
          break
        }

        // Fallback if tool loops exhausted without text
        if (!fullResponse) {
          fullResponse = "I'm having a moment accessing our database. Based on my experience though — what specifically are you looking for? I can help with product recommendations, ingredient questions, or K-beauty routines."
          const data = JSON.stringify({ type: 'text', content: fullResponse })
          await writer.write(encoder.encode(`data: ${data}\n\n`))
        }

        // Clean AI artifacts and include cleaned version in done event
        const cleanedResponse = cleanYuriResponse(fullResponse)
        const done = JSON.stringify({ type: 'done', message: cleanedResponse })
        await writer.write(encoder.encode(`data: ${done}\n\n`))

        // Fire-and-forget analytics upsert (non-blocking)
        const sessionHash = simpleHash(ip + ua)
        void (async () => {
          try {
            const supabase = getServiceClient()
            // Check if session already exists
            const { data: existing } = await supabase
              .from('ss_widget_analytics')
              .select('id, messages_sent, tool_calls_made')
              .eq('session_hash', sessionHash)
              .order('created_at', { ascending: false })
              .limit(1)
              .single()

            if (existing) {
              await supabase
                .from('ss_widget_analytics')
                .update({
                  messages_sent: existing.messages_sent + 1,
                  tool_calls_made: existing.tool_calls_made + toolLoopCount,
                  last_message_at: new Date().toISOString(),
                })
                .eq('id', existing.id)
            } else {
              await supabase.from('ss_widget_analytics').insert({
                session_hash: sessionHash,
                messages_sent: 1,
                tool_calls_made: toolLoopCount,
                first_message_at: new Date().toISOString(),
                last_message_at: new Date().toISOString(),
              })
            }
          } catch {
            // Analytics should never break the user experience
          }
        })()
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
