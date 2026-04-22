import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { checkRateLimit } from '@/lib/utils/rate-limiter'
import { logAIUsage } from '@/lib/ai-usage-logger'
import { YURI_TOOLS, executeYuriTool } from '@/lib/yuri/tools'
import { cleanYuriResponse } from '@/lib/yuri/voice-cleanup'
import { detectSpecialist, SPECIALISTS } from '@/lib/yuri/specialists'
import { getOrCreateVisitor, incrementVisitorCounters, isVisitorAtLimit } from '@/lib/widget/visitor'
import { createSession, getSession, incrementSessionCounters, updateSessionMetadata } from '@/lib/widget/session'
import {
  saveUserMessage,
  saveAssistantMessage,
  truncateToolResult,
  getPreviousConversationContext,
  generateAndSaveMemory,
  type ToolCallLog,
} from '@/lib/widget/persistence'
import { detectAndRecordSignals, type SignalContext } from '@/lib/widget/signals'
import type Anthropic from '@anthropic-ai/sdk'

const WIDGET_RATE_LIMIT = 25
const WIDGET_RATE_WINDOW = 24 * 60 * 60 * 1000
const MAX_WIDGET_TOOL_LOOPS = 3

/** Widget-safe tools: subset of Yuri's tools that work without user auth */
const WIDGET_TOOL_NAMES = new Set(['search_products', 'compare_prices', 'get_trending_products', 'get_current_weather', 'get_ingredient_guide'])
const WIDGET_TOOLS = YURI_TOOLS.filter((t) => WIDGET_TOOL_NAMES.has(t.name))

/** Prompt-cached versions */
const CACHED_WIDGET_TOOLS = WIDGET_TOOLS.map((tool, idx) =>
  idx === WIDGET_TOOLS.length - 1
    ? { ...tool, cache_control: { type: 'ephemeral' as const } }
    : tool
)

/** Simple hash for IP abuse detection */
function simpleHash(str: string): string {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash |= 0
  }
  return Math.abs(hash).toString(36)
}

const widgetSchema = z.object({
  message: z.string().min(1).max(2000),
  history: z.array(z.object({
    role: z.enum(['user', 'assistant']),
    content: z.string(),
  })).max(40).optional(),
  visitor_id: z.string().min(1).max(100).optional().nullable().transform(v => v ?? undefined),
  session_id: z.string().uuid().optional().nullable().transform(v => v ?? undefined),
})

// ---------------------------------------------------------------------------
// Intent detection: mirrors advisor.ts shouldForceToolUse()
// ---------------------------------------------------------------------------
function shouldWidgetForceToolUse(message: string): boolean {
  const msg = message.toLowerCase()

  if (/^(hi|hey|hello|thanks|thank you|bye|ok|okay|cool)\b/i.test(message)) return false
  if (/^(what is|explain|how does|tell me about)\s+(skincare|k-beauty|glass skin|double cleansing|layering)/i.test(message)) return false

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

  if (/\b(how much|price|cost|cheap|where.{0,15}buy|retailer|deal)\b/i.test(msg)) return true
  if (/\b(trending|trend|what's new|popular|bestseller|viral|emerging)\b/i.test(msg)) return true
  if (/\b(do you have|search for|find me|recommend.{0,20}(product|serum|cream|sunscreen|cleanser|toner|moisturizer|mask))\b/i.test(msg)) return true
  if (/\b(best|top|good)\s+(serum|sunscreen|cleanser|toner|moisturizer|cream|mask|essence)\b/i.test(msg)) return true
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
You have access to Seoul Sister's product database — 5,800+ K-beauty products with real Olive Young prices on 5,000+ products, plus Soko Glam and YesStyle pricing, and live Korean trend data from Olive Young bestseller rankings and Reddit K-beauty communities. USE YOUR TOOLS when questions involve specific products, prices, trends, or weather-based advice. This is what makes you different from ChatGPT or any generic AI — you have real product intelligence. When your tools return data, cite real prices and retailer names naturally.

Do NOT use tools for general skincare education or ingredient science — your training knowledge handles those.

IMPORTANT: When recommending multiple products (e.g., a routine), search for ALL of them in a SINGLE tool call using a broad query rather than making separate searches for each product. But if the user asks about DIFFERENT things (e.g., a product recommendation AND what's trending), use the appropriate different tools for each.

## Price Quoting Rules (NON-NEGOTIABLE)
This is a first-impression conversation. Quoting a wrong price destroys trust permanently — a visitor goes to Olive Young, sees your $14 quote is actually $19, and never comes back. Follow these rules exactly:

- **You may ONLY quote a dollar amount for a product if that amount came back from \`compare_prices\`, \`get_product_details\`, or \`search_products\` IN THIS CONVERSATION.** No exceptions.
- If \`compare_prices\` returns "No price data available for this product in our database" — say "I don't have live pricing on this one right now. Check Olive Young Global, YesStyle, or Soko Glam directly for current pricing." Do NOT fill in a price from memory, training data, or estimation. No "usually runs $X-Y", no "around $X", no "~$X".
- Do not quote prices for sub-variants (different sizes, limited editions) you didn't query. If you pulled the 200mL price, you don't know the 500mL price — don't guess.
- Retailer names in your response must match what the tool returned. If \`compare_prices\` only returned Olive Young data, don't invent Stylevana or YesStyle prices.
- If a user asks about a budget range without naming a product, recommend by NAME without prices, then offer: "Want me to pull live prices on any of these?"
- K-beauty prices fluctuate 10-30% per year and vary 20%+ between retailers. Your training data is outdated the moment it's referenced. Trust the tool or say nothing.

## Packaging Descriptions
Never describe a product's packaging color, jar shape, tube vs pump, or visual identifier. K-beauty brands rebrand every 2-3 years — your training knowledge of packaging is usually outdated. Refer to products by NAME only. If a visitor needs visual confirmation, direct them to the Olive Young or brand website.

## Conversation Approach: Their Perspective First
Every response should demonstrate you understand the visitor's skincare world before you describe what Seoul Sister offers. This means:
- Ask about their situation before explaining what the platform does
- Reflect their concern back before introducing a solution ("So you're dealing with texture and nothing's worked" before "here's what I'd try")
- When they describe a problem, acknowledge the specific difficulty before suggesting a product

The visitor should feel "she actually understands my skin situation" before they ever think "she's trying to get me to subscribe." That sequence is non-negotiable.

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
- Only ask a follow-up question when you genuinely need info to help further (e.g., "Is it on your lid or under your eye? That changes the answer"). Do NOT end every response with rapport-seeking closers like "Sound good?", "Does that feel doable?", "Want me to...?", "Make sense?" — these are the #1 AI tell and they sound like validation-begging. A confident recommendation doesn't need a check-in. Ending on your final sentence is fine.

## Rules
- Never make up product data — use tools or say you're not sure
- Never diagnose medical conditions — recommend 피부과 (dermatologist) for persistent issues
- Seoul Sister is NOT a store — direct to verified retailers (Olive Young Global, YesStyle, StyleVana)
- Gently redirect non-K-beauty questions`

/**
 * POST /api/widget/chat - Anonymous Yuri widget chat with full persistence.
 * Rate limited by IP + visitor identity. Supports tool use for database access.
 * Returns SSE stream with session_id in done event.
 */
export async function POST(request: NextRequest) {
  try {
    // IP rate limiting (25/IP/day abuse prevention)
    const ip =
      request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const rateCheck = await checkRateLimit(`widget:${ip}`, WIDGET_RATE_LIMIT, WIDGET_RATE_WINDOW)
    if (!rateCheck.allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit reached. You\'ve used all your free preview messages for today. Subscribe for unlimited Yuri conversations.' }),
        { status: 429, headers: { 'Content-Type': 'application/json', 'Retry-After': String(Math.ceil(rateCheck.resetIn / 1000)) } }
      )
    }

    const body = await request.json()
    const parsed = widgetSchema.parse(body)

    const ua = request.headers.get('user-agent') || ''
    const ipHash = simpleHash(ip)
    const uaHash = simpleHash(ua)

    // --- Visitor identity & rate limiting ---
    let visitor = null
    let sessionId = parsed.session_id || null
    let session = null

    if (parsed.visitor_id) {
      try {
        visitor = await getOrCreateVisitor(parsed.visitor_id, ipHash, uaHash)

        if (isVisitorAtLimit(visitor)) {
          return new Response(
            JSON.stringify({
              error: 'Preview limit reached. Subscribe to Seoul Sister Pro ($39.99/mo) for unlimited Yuri conversations, personalized routines, and all 6 specialist agents.',
              limitReached: true,
            }),
            { status: 429, headers: { 'Content-Type': 'application/json' } }
          )
        }

        // Load or create session
        if (sessionId) {
          session = await getSession(sessionId)
        }
        if (!session) {
          session = await createSession(parsed.visitor_id, visitor.total_sessions)
          sessionId = session.id
        }
      } catch (err) {
        console.error('[widget/chat] Visitor/session setup failed:', err)
        // Continue without persistence — don't break the conversation
      }
    }

    // Fallback rate limit for visitors without visitor_id (old clients)
    if (!visitor) {
      const sessionKey = `widget-msgs:${ip}:${simpleHash(ip + ua)}`
      const msgCheck = await checkRateLimit(sessionKey, 20, 30 * 24 * 60 * 60 * 1000)
      if (!msgCheck.allowed) {
        return new Response(
          JSON.stringify({ error: 'Preview limit reached. Subscribe to Seoul Sister Pro ($39.99/mo) for unlimited Yuri conversations.', limitReached: true }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // --- Specialist detection ---
    const detectedSpecialist = detectSpecialist(parsed.message)

    // --- Build system prompt with context ---
    let systemPrompt = YURI_WIDGET_SYSTEM

    // Inject returning visitor memory
    if (visitor?.ai_memory) {
      const context = await getPreviousConversationContext(parsed.visitor_id!, visitor.ai_memory)
      if (context) systemPrompt += context
    }

    // Inject specialist preview (Feature 14.3)
    if (detectedSpecialist && SPECIALISTS[detectedSpecialist]) {
      const specialistName = SPECIALISTS[detectedSpecialist].name
      systemPrompt += `\n\n## Specialist Knowledge Available
This question touches on ${specialistName} territory. You have deep expertise here and can give a solid answer. But subscribers get access to a dedicated ${specialistName} mode with even deeper analysis — ingredient-level formulation breakdowns, personalized conflict detection against their full routine, and intelligence extraction that improves over time.

When answering, naturally weave in ONE brief mention of what the specialist mode adds. Keep it to ONE sentence, naturally embedded. Not a sales pitch. Just a glimpse of depth.`
    }

    const anthropic = getAnthropicClient()

    const messages: Anthropic.Messages.MessageParam[] = [
      ...(parsed.history || []).map((m) => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user' as const, content: parsed.message },
    ]

    // --- Save user message (fire-and-forget if no session) ---
    let userMessageId = ''
    if (sessionId && parsed.visitor_id) {
      try {
        userMessageId = await saveUserMessage(
          sessionId,
          parsed.visitor_id,
          parsed.message,
          detectedSpecialist,
          []
        )
      } catch { /* persistence failure is non-critical */ }
    }

    // --- SSE Streaming with tool use loop ---
    const encoder = new TextEncoder()
    const { readable, writable } = new TransformStream()
    const writer = writable.getWriter()

    const streamPromise = (async () => {
      try {
        const loopMessages: Anthropic.Messages.MessageParam[] = [...messages]
        let toolLoopCount = 0
        let fullResponse = ''
        const forceToolUse = shouldWidgetForceToolUse(parsed.message)
        const toolCallLogs: ToolCallLog[] = []
        const toolNamesUsed: string[] = []

        function applyCacheControl(msgs: Anthropic.Messages.MessageParam[]) {
          return msgs.map((msg, idx) => {
            if (msg.role === 'assistant' && typeof msg.content === 'string' && idx === msgs.length - 2) {
              return {
                role: 'assistant' as const,
                content: [{ type: 'text' as const, text: msg.content, cache_control: { type: 'ephemeral' as const } }],
              }
            }
            return msg
          })
        }

        while (toolLoopCount <= MAX_WIDGET_TOOL_LOOPS) {
          const cachedMessages = applyCacheControl(loopMessages)
          const toolChoice: Anthropic.Messages.MessageCreateParams['tool_choice'] =
            forceToolUse && toolLoopCount === 0 ? { type: 'any' } : { type: 'auto' }

          const toolUseBlocks: Array<{ id: string; name: string; input: string }> = []
          let currentToolBlock: { id: string; name: string; input: string } | null = null
          const textChunks: string[] = []

          const stream = anthropic.messages.stream({
            model: MODELS.primary,
            max_tokens: 800,
            system: [{ type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } }],
            messages: cachedMessages,
            tools: CACHED_WIDGET_TOOLS,
            tool_choice: toolChoice,
          })

          for await (const event of stream) {
            if (event.type === 'content_block_start') {
              if (event.content_block.type === 'tool_use') {
                currentToolBlock = { id: event.content_block.id, name: event.content_block.name, input: '' }
              }
            } else if (event.type === 'content_block_delta') {
              if (event.delta.type === 'text_delta') {
                textChunks.push(event.delta.text)
              } else if (event.delta.type === 'input_json_delta' && currentToolBlock) {
                currentToolBlock.input += event.delta.partial_json
              }
            } else if (event.type === 'content_block_stop' && currentToolBlock) {
              toolUseBlocks.push(currentToolBlock)
              currentToolBlock = null
            }
          }

          // No tools — send all buffered text as the final response
          if (toolUseBlocks.length === 0) {
            for (const chunk of textChunks) {
              fullResponse += chunk
              const data = JSON.stringify({ type: 'text', content: chunk })
              await writer.write(encoder.encode(`data: ${data}\n\n`))
            }
            break
          }

          // Tools found — discard narration text, execute tools, and loop
          toolLoopCount++
          const assistantContent: Anthropic.Messages.ContentBlockParam[] = []
          for (const tb of toolUseBlocks) {
            let parsedInput: unknown = {}
            try { parsedInput = JSON.parse(tb.input || '{}') } catch { /* keep empty */ }
            assistantContent.push({ type: 'tool_use' as const, id: tb.id, name: tb.name, input: parsedInput as Record<string, unknown> })
          }
          loopMessages.push({ role: 'assistant', content: assistantContent })

          const toolResults: Anthropic.Messages.ToolResultBlockParam[] = []
          for (const tb of toolUseBlocks) {
            let parsedInput: Record<string, unknown> = {}
            try { parsedInput = JSON.parse(tb.input || '{}') } catch { /* keep empty */ }
            const result = await executeYuriTool(tb.name, parsedInput, '')
            toolResults.push({ type: 'tool_result', tool_use_id: tb.id, content: result })
            toolNamesUsed.push(tb.name)
            toolCallLogs.push({
              name: tb.name,
              input: parsedInput,
              result_summary: truncateToolResult(result),
            })
          }
          loopMessages.push({ role: 'user', content: toolResults })
        }

        // Fallback
        if (!fullResponse) {
          fullResponse = "I'm having a moment accessing our database. Based on my experience though, what specifically are you looking for? I can help with product recommendations, ingredient questions, or K-beauty routines."
          const data = JSON.stringify({ type: 'text', content: fullResponse })
          await writer.write(encoder.encode(`data: ${data}\n\n`))
        }

        const cleanedResponse = cleanYuriResponse(fullResponse)

        // Log AI usage (fire-and-forget)
        void logAIUsage({
          feature: 'widget_chat',
          model: MODELS.primary,
          inputTokens: 0,
          outputTokens: Math.ceil(fullResponse.length / 4),
          cached: true,
        })

        // Include session_id in done event so client can send it back
        const done = JSON.stringify({ type: 'done', message: cleanedResponse, session_id: sessionId })
        await writer.write(encoder.encode(`data: ${done}\n\n`))

        // --- Post-stream persistence ---
        // Critical persistence (message save + counter increments) is AWAITED
        // so it completes before writer.close(). Vercel can kill the function
        // after the stream closes, so fire-and-forget operations get terminated.
        if (sessionId && parsed.visitor_id) {
          try {
            // Save assistant message + increment counters (critical)
            await saveAssistantMessage(
              sessionId!,
              parsed.visitor_id!,
              cleanedResponse,
              toolCallLogs,
              null
            )
            await incrementVisitorCounters(parsed.visitor_id!, 1, toolCallLogs.length)
            await incrementSessionCounters(sessionId!, toolCallLogs.length)

            // Update session metadata with specialist + signals (critical)
            if (detectedSpecialist) {
              await updateSessionMetadata(sessionId!, [detectedSpecialist], [])
            }

            // Detect and record intent signals (critical)
            const signalContext: SignalContext = {
              messageNumber: (session?.message_count || 0) + 1,
              totalVisitorMessages: visitor?.total_messages || 0,
              toolsUsedThisSession: toolNamesUsed,
              specialistsDetected: detectedSpecialist ? [detectedSpecialist] : [],
            }
            const signalTypes = await detectAndRecordSignals(
              parsed.message, signalContext, parsed.visitor_id!, sessionId!, userMessageId
            )
            if (signalTypes.length > 0) {
              await updateSessionMetadata(sessionId!, [], signalTypes)
            }

            // Generate AI memory every 3rd message
            // MUST be awaited — Vercel kills the function after writer.close(),
            // so fire-and-forget Sonnet calls get terminated before completing.
            const msgCount = (session?.message_count || 0) + 1
            if (msgCount % 3 === 0) {
              const sessionMessages = [
                ...(parsed.history || []),
                { role: 'user', content: parsed.message },
                { role: 'assistant', content: cleanedResponse },
              ]
              try {
                await generateAndSaveMemory(parsed.visitor_id!, sessionMessages)
              } catch (err) {
                console.error('[widget/chat] Memory generation failed:', err)
              }
            }
          } catch (err) {
            console.error('[widget/chat] Post-stream persistence error:', err)
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : 'Stream error'
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
