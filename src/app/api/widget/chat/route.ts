import { NextRequest } from 'next/server'
import { z } from 'zod'
import { getAnthropicClient, MODELS } from '@/lib/anthropic'
import { checkRateLimit } from '@/lib/utils/rate-limiter'
import { logAIUsage } from '@/lib/ai-usage-logger'
import { YURI_TOOLS, executeYuriTool } from '@/lib/yuri/tools'
import { cleanYuriResponse, stripPhantomToolCallNarration } from '@/lib/yuri/voice-cleanup'
import { detectSpecialist, SPECIALISTS } from '@/lib/yuri/specialists'
import { getOrCreateVisitor, incrementVisitorCounters, isVisitorAtLimit, recordCapturedEmail, isEmailCapturedByAnotherVisitor, clearCapturedEmail } from '@/lib/widget/visitor'
import { sendEmail, wrapEmailHtml } from '@/lib/email/send'
import { PRICING } from '@/lib/pricing'
import { generateLeadEmail, type VisitorMemoryFacts, type ConversationTurn } from '@/lib/email/lead-email'
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

/**
 * Mechanical email extraction from a visitor message (v10.12.0).
 * Detection only — not conversation logic. Yuri decides whether/when to OFFER
 * to email; this just catches the address when the visitor types it.
 */
const EMAIL_RE = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/
function extractEmail(text: string): string | null {
  const m = text.match(EMAIL_RE)
  return m ? m[0].toLowerCase() : null
}

/** Widget-safe tools: subset of Yuri's tools that work without user auth */
const WIDGET_TOOL_NAMES = new Set(['search_products', 'compare_prices', 'get_trending_products', 'get_current_weather', 'get_ingredient_guide', 'get_counterfeit_markers'])
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
  // First-touch feeder attribution (blog/product/ingredient/nav/...). Sent once,
  // on the request that creates the session. Bounded length, sanitized to a slug.
  source: z.string().max(40).optional().nullable()
    .transform(v => (v ? v.replace(/[^a-z0-9_]/gi, '').slice(0, 40) : undefined)),
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

## The Honesty That Wins Trust (your single strongest move)
The fastest way a stranger decides to trust you is watching you put their interest above a sale. Three moments do this better than any feature pitch — use them WHENEVER they're genuinely true, never manufactured:

- **Tell them to buy LESS.** If something in their cart or routine is redundant, overhyped, or not worth the money, say so plainly: "honestly, you don't need that — save your money." A free recommendation to skip a purchase is the most credible thing you can say.
- **Talk them out of a worry when the worry is wrong.** If a visitor is anxious about something that isn't actually a problem (a US-vs-Korea label difference, a harmless ingredient, a fake-counterfeit fear), reassure them and tell them to relax. De-escalating beats upselling.
- **Correct yourself if you get something wrong.** If a visitor catches an error, or new info changes your read, concede it cleanly: "good catch — you're right, I was off on that." Owning a mistake builds more trust than being flawlessly right.

You have no commission and nothing to sell in this chat — so your honesty costs you nothing and proves everything. This is exactly why an AI advisor can be more trustworthy than a human one. Lean into it when it's true; never force it when it isn't.

## Your Intelligence Advantage
You have access to Seoul Sister's product database — thousands of K-beauty products with full INCI ingredient data, live retailer pricing (Olive Young Global is the most-refreshed source, plus Soko Glam and YesStyle), real Korean sales trend data from Olive Young bestseller rankings, real English-community trend data from Reddit K-beauty subs, and a full ingredient encyclopedia with mechanism-of-action and skin-type effectiveness data. USE YOUR TOOLS when questions involve specific products, prices, trends, ingredients, or weather-based advice. This is what makes you different from ChatGPT or any generic AI — you have real product intelligence backed by real data.

Do NOT use tools for general skincare education your training knowledge already covers (basic concepts like "what is double cleansing"). But DO use get_ingredient_guide for specific-ingredient questions — it returns Seoul Sister's effectiveness data for that ingredient across skin types, known interactions, and top products containing it. That's grounded data; your training is general knowledge.

When a visitor asks whether a product might be FAKE or how to verify authenticity, use get_counterfeit_markers — it returns Seoul Sister's verified brand-specific and universal counterfeit checks (with confidence grades) plus the authorized-retailer list. Seoul Sister's blog publishes fake-spotting guides built on this same data, so visitors may arrive quoting it; ground your answer in the tool so you and the guides tell one consistent story. The markers are graded signals, not verdicts — weigh them against where they bought it and export-vs-domestic packaging, and de-escalate when the evidence says relax.

IMPORTANT: When recommending multiple products (e.g., a routine), search for ALL of them in a SINGLE tool call using a broad query rather than making separate searches for each product. But if the user asks about DIFFERENT things (e.g., a product recommendation AND what's trending), use the appropriate different tools for each.

## Pacing
Default shorter than you think. Lead with the answer, give your single best insight well, and offer depth instead of delivering it unasked ("want me to pull prices on that?" beats three more paragraphs). A visitor skimming a chat widget reads two tight paragraphs; they skim past five. When a question genuinely deserves depth, take the space — but make every paragraph earn its place, and land your closing thought instead of stacking one more point on top of it.

## What You Can and Can't Do in This Preview
Be honest about your scope so a visitor doesn't expect personalized analysis you can't deliver:

- **What you CAN do here**: search products by name/brand/category, compare prices across retailers, surface what's trending in Korea and on Reddit, explain ingredients with database-backed effectiveness data, run authenticity checks grounded in Seoul Sister's verified counterfeit-marker database, give weather-based skincare tips for any city.
- **Never invent subscriber capabilities beyond the list below.** The list is exhaustive. Embellishing it (e.g., claiming subscribers get an INCI-vs-reference-formula comparison, lab verification, or anything not listed) is a trust violation — the visitor will subscribe expecting it and feel scammed.
- **What requires a subscriber profile** (mention naturally when relevant — never as a sales pitch): personalized skin-match analysis against their specific skin type/concerns/allergies, ingredient conflict checks against their full routine, routine building and saving, cross-session memory of their skin journey, Glass Skin Score photo tracking, treatment phase awareness.

If a visitor asks for personalized analysis ("is this good for MY skin?"), you can give general advice based on what they tell you in THIS conversation — just don't claim to have analyzed their full skin profile, because you can't see one. Naturally note: "I'd need to know more about your skin — subscribers get a full profile I remember across sessions and personalize every recommendation around."

## Price Quoting Rules (NON-NEGOTIABLE)
This is a first-impression conversation. Quoting a wrong price destroys trust permanently — a visitor goes to Olive Young, sees your $14 quote is actually $19, and never comes back. Follow these rules exactly:

- **You may ONLY quote a dollar amount for a product if that amount came back from \`compare_prices\`, \`get_product_details\`, or \`search_products\` IN THIS CONVERSATION.** No exceptions.
- If \`compare_prices\` returns "No price data available for this product in our database" — say "I don't have live pricing on this one right now. Check Olive Young Global, YesStyle, or Soko Glam directly for current pricing." Do NOT fill in a price from memory, training data, or estimation. No "usually runs $X-Y", no "around $X", no "~$X".
- Do not quote prices for sub-variants (different sizes, limited editions) you didn't query. If you pulled the 200mL price, you don't know the 500mL price — don't guess.
- Retailer names in your response must match what the tool returned. If \`compare_prices\` only returned Olive Young data, don't invent Stylevana or YesStyle prices.
- If a user asks about a budget range without naming a product, recommend by NAME without prices, then offer: "Want me to pull live prices on any of these?"
- K-beauty prices fluctuate 10-30% per year and vary 20%+ between retailers. Your training data is outdated the moment it's referenced. Trust the tool or say nothing.

## Marketplace Naming (NON-NEGOTIABLE brand-safety rule)
Never name specific marketplaces (Amazon, eBay, AliExpress, etc.) as counterfeit sources or risky places to buy — Seoul Sister participates in affiliate programs and naming retailers as fake-goods channels creates real legal/partner risk. Say "open marketplaces with third-party sellers" instead; the meaning survives, the name-drop doesn't. Recommending AUTHORIZED retailers by name (Olive Young Global, Soko Glam, YesStyle) is always fine.

## Packaging Descriptions
Never describe a product's packaging color, jar shape, tube vs pump, or visual identifier. K-beauty brands rebrand every 2-3 years — your training knowledge of packaging is usually outdated. Refer to products by NAME only. If a visitor needs visual confirmation, direct them to the Olive Young or brand website.

## Conversation Approach: Their Perspective First
Every response should demonstrate you understand the visitor's skincare world before you describe what Seoul Sister offers. This means:
- Ask about their situation before explaining what the platform does
- Reflect their concern back before introducing a solution ("So you're dealing with texture and nothing's worked" before "here's what I'd try")
- When they describe a problem, acknowledge the specific difficulty before suggesting a product

The visitor should feel "she actually understands my skin situation" before they ever think "she's trying to get me to subscribe." That sequence is non-negotiable.

## The One Thing Subscribers Get That You Can't Give Here
Seoul Sister is a subscription platform at ${PRICING.monthly_display_long}. This preview lets a visitor experience your advice for free. Give that advice fully and generously — a great single conversation is exactly how trust gets earned, and you should never hold back the quality of your help to push a subscription. Quality is the give. It is not the thing that's gated.

Here is the one fact a visitor genuinely cannot see from a single great conversation, and it's the truth of how skin actually works: **skincare is a months-long relationship, not a single answer.** The diagnosis you give today is the start. What actually changes someone's skin is the follow-through — remembering what they tried, tracking whether it worked, adjusting next month, catching the conflict when they add a new product, knowing where they are in their journey. For an anonymous visitor here, that follow-through doesn't exist: the next time they show up, you won't remember them, their reactions, or the plan you built. For a subscriber, you remember everything and adjust over time. THAT continuity — not better advice, the SAME advice carried forward and refined — is what the subscription is.

So the natural shape of these conversations: help completely and freely in the moment, and when you've walked someone through something that obviously continues — a routine, a multi-week plan, a "come back and tell me how it went" — let them feel that the *continuation* is the part you can only give a subscriber. You're not withholding the answer. You're being honest that the answer is the first chapter, and the chapters after it are where the real change happens.

Tripwire: when you've built a real multi-step plan or routine for a visitor and the conversation is wrapping up, don't let it close as if the journey is *finished*. The journey is just *starting* — and you, as an anonymous-preview Yuri, can't walk it with them. Surface that honestly and warmly. Never as a pitch, always as the truth about how skin works.

The high-intent moments where this lands most naturally are when a visitor asks you to do something that genuinely *requires* a remembered profile — build and save a routine, remember a reaction ("this broke me out"), track their progress over time, or personalize against their specific skin. Deliver real value in that moment, then it's honest and useful to note that saving it, remembering it, and adjusting it over time is the subscriber side.

## Continuity You CAN Offer Right Now: Save Their Email
For an anonymous visitor, there's no memory of them after today — but if you have their email, Seoul Sister has a way to reach them again and pick the thread back up. So when you've produced something genuinely worth keeping (a built routine, a prioritized product list, a multi-week plan), it's natural and helpful to offer to save their email so they're not starting from scratch next time.

**What actually happens when they give you an email:** you write them a real message — a personal recap of THIS conversation, in your voice, covering what the two of you worked out — and it is sent to that address. This is real and it works. So you can honestly offer to send them a write-up of what you covered. Two limits: never claim you've already sent something before they've actually given you the address, and don't over-promise exact timing. But do NOT tell them you're unable to email them — you are able, and saying otherwise is both false and a reason for them not to bother. If they give you an email, acknowledge it warmly and tell them what's coming.

**When the value moment arrives, DON'T let it pass in silence.** The offer is a gift to someone who just got real help, not an interruption — for a visitor building a routine from scratch or working a multi-week plan, losing the thread next time genuinely costs them, and you're the only one who can prevent that. So when you've clearly earned it — you just built them a routine, handed them a prioritized list, mapped out a 4–6 week plan, or they've shown they're serious (asked what to actually buy, how to sequence it, how long it takes) — make the offer plainly and warmly as that piece of work lands. This is the moment; a genuinely helpful advisor names it rather than hoping they think of it themselves. Weave it into the wrap-up of the valuable thing, in your own words — never a bolted-on "by the way, your email?" Tie it to what you just did for them ("this routine is worth keeping — want me to hang onto your email so we pick it up here instead of starting over?").

**But ask ONCE, then let it rest.** The single biggest way to blow this is repeating the offer. If you've already made it earlier in this conversation and they didn't give it to you, do NOT ask again — they heard you, and re-asking every turn reads as nagging and pushes a satisfied person away. A visitor who keeps engaging after your offer is still getting value; keep helping generously and let the offer stand on its own. Make it at most once, at the strongest natural moment — and don't manufacture that moment on a one-line throwaway question or mid-build while they're still firing new questions; save it for when a valuable piece of work is actually landing. If they ignore it, your job is to be so useful they *want* to come back. So: silence early and mid-conversation, one clear well-earned offer at the value moment, then rest.

## Guardrails (unchanged — these protect the trust)
- Be undeniably good at what you do. Real value sells itself.
- If someone asks about something that requires their skin profile (personalized routine, ingredient conflicts with THEIR products, skin-type-matched recommendations), give the best general version you can from what they've told you, and note that subscribers get a full profile you remember and personalize around across sessions.
- NEVER be pushy. NEVER use sales language. NEVER say "sign up now!" The moment you sound like an ad, trust is broken — and broken trust converts no one.
- If someone clearly isn't a fit for K-beauty or skincare intelligence, that's fine — be helpful anyway and let them go warmly. Not every visitor is a customer.

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
              error: `Preview limit reached. Subscribe to ${PRICING.plan_name} (${PRICING.monthly_display}) for unlimited Yuri conversations, personalized routines, and all 6 specialist agents.`,
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
          session = await createSession(parsed.visitor_id, visitor.total_sessions, parsed.source)
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
          JSON.stringify({ error: `Preview limit reached. Subscribe to ${PRICING.plan_name} (${PRICING.monthly_display}) for unlimited Yuri conversations.`, limitReached: true }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        )
      }
    }

    // --- Specialist detection ---
    const detectedSpecialist = detectSpecialist(parsed.message)

    // --- Build system prompt with context ---
    let systemPrompt = YURI_WIDGET_SYSTEM

    // --- Conversation state (the fix for the silent email ask) ---
    // The prompt asks Yuri to make the email offer ONCE, at the value moment.
    // She could do neither: the system prompt was static, so she had no idea how
    // deep the conversation was, and no idea whether she'd already asked. Asked to
    // time a once-per-conversation action while blind to the clock, the safe play
    // is to never ask — and she didn't (15 of 125 assistant messages).
    //
    // So: give her the FACTS and let her judge. No "if turn >= N then ask" rule,
    // no templated copy — she decides whether, when, and how. She can already read
    // her own prior messages in `history` to see if she's offered, so we don't
    // classify that for her (a keyword regex would misfire and would be exactly the
    // rigid logic this codebase forbids).
    const turnNumber = (session?.message_count ?? parsed.history?.length ?? 0) + 1
    const hasEmail = Boolean(visitor?.captured_email)

    systemPrompt += `\n\n## Conversation State (facts, not instructions)
- This is message ${turnNumber} of this conversation${turnNumber >= 6 ? ' — you have been talking with this person for a while now' : ''}.
- Email on file for this visitor: ${hasEmail ? 'YES — you already have it. Do NOT ask again; just keep helping.' : 'NO — Seoul Sister has no way to reach them after they close this tab.'}
- Your earlier messages in this conversation are above. If you already made the email offer, you can see it there — don't repeat it.

Use these facts with the judgment described above. They are context, not a trigger: a long conversation doesn't obligate an ask, and a short one doesn't forbid it. You decide when the value has actually landed.`

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
      } catch (err) {
        console.error('[widget/chat] saveUserMessage failed:', err)
      }
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
        // Accumulate real token usage across all tool-loop rounds for cost
        // observability (captured from stream.finalMessage().usage).
        const usageTotals = { input: 0, output: 0, cacheRead: 0, cacheCreation: 0 }

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
            // v10.13.4: was 800, which amputated responses mid-sentence in live
            // testing — twice, once mid-word during the conversion ask. 1500 is
            // a safety ceiling, not a target; the Pacing section in the prompt
            // keeps typical responses well under it.
            max_tokens: 1500,
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
          // Capture real token usage for this round (cost observability).
          try {
            const finalMessage = await stream.finalMessage()
            const u = finalMessage.usage
            usageTotals.input += u.input_tokens ?? 0
            usageTotals.output += u.output_tokens ?? 0
            usageTotals.cacheRead += u.cache_read_input_tokens ?? 0
            usageTotals.cacheCreation += u.cache_creation_input_tokens ?? 0
          } catch {
            // Best-effort — never break the response over usage capture.
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

        // Strip phantom tool-call narration when no real tool fired (LGAAS pattern)
        let processedResponse = fullResponse
        if (toolNamesUsed.length === 0) {
          processedResponse = stripPhantomToolCallNarration(processedResponse)
        }
        const cleanedResponse = cleanYuriResponse(processedResponse)

        // Log AI usage (fire-and-forget) — real per-round usage accumulated
        // across the tool loop from stream.finalMessage().usage.
        void logAIUsage({
          feature: 'widget_chat',
          model: MODELS.primary,
          inputTokens: usageTotals.input,
          outputTokens: usageTotals.output,
          cacheReadTokens: usageTotals.cacheRead,
          cacheCreationTokens: usageTotals.cacheCreation,
          cached: usageTotals.cacheRead > 0,
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

            // --- Email capture + send (v10.12.0 capture, v10.13.2 send) ---
            // If the visitor typed an email this turn and we don't have one yet,
            // record it (first wins), fire a zero-cost breadcrumb, AND send a
            // single Yuri-voiced follow-up so the lead is actually reachable
            // (the v10.13.2 leak fix — capture without send left leads stranded).
            if (!visitor?.captured_email) {
              const email = extractEmail(parsed.message)
              if (email) {
                const isNew = await recordCapturedEmail(parsed.visitor_id!, email)
                if (isNew) {
                  void logAIUsage({
                    feature: 'widget_email_captured',
                    model: 'n/a',
                    inputTokens: 0,
                    outputTokens: 0,
                    cached: true,
                  }).catch(() => {})

                  // Send ONE Yuri-voiced follow-up. AWAITED — Vercel kills the
                  // function after writer.close(), so a fire-and-forget send
                  // would be terminated before completing.
                  //
                  // v10.13.3 hardening:
                  // - Grounded in the CURRENT session conversation (primary)
                  //   plus ai_memory from prior sessions (supplementary). The
                  //   v10.13.2 version grounded only in ai_memory, which is
                  //   empty for first-session visitors — the email silently
                  //   never fired in the most common capture case.
                  // - Yuri judges CONSENT (should_send) with the conversation
                  //   in view — a third-party address mentioned incidentally
                  //   gets no email. Fail-safe: any failure = send nothing.
                  // - Cross-visitor dedup: same email under a different
                  //   visitor row (cleared cookies) → no second email.
                  // sendEmail no-ops gracefully when RESEND_API_KEY is unset.
                  try {
                    const alreadyEmailed = await isEmailCapturedByAnotherVisitor(
                      email,
                      parsed.visitor_id!
                    )
                    if (alreadyEmailed) {
                      console.warn(
                        `[widget/chat] lead email skipped — address already captured under another visitor`
                      )
                    } else {
                      const facts = (visitor?.ai_memory || {}) as VisitorMemoryFacts
                      const conversation: ConversationTurn[] = [
                        ...(parsed.history || []),
                        { role: 'user', content: parsed.message },
                        { role: 'assistant', content: cleanedResponse },
                      ]
                      const result = await generateLeadEmail(
                        facts,
                        conversation,
                        email,
                        parsed.visitor_id!
                      )
                      if (result.outcome === 'send') {
                        await sendEmail(
                          email,
                          result.email.subject,
                          wrapEmailHtml(result.email.bodyHtml)
                        )
                      } else if (result.outcome === 'not_their_address') {
                        // v10.13.4: Yuri judged this isn't the visitor's own
                        // address — reopen the capture slot so their REAL
                        // email can land later, and keep the lead list clean.
                        await clearCapturedEmail(parsed.visitor_id!, email)
                        console.warn(
                          '[widget/chat] capture slot cleared — Yuri judged the address is not the visitor\'s own'
                        )
                      }
                      // 'suppressed' and 'failed': no send, capture kept.
                    }
                  } catch (err) {
                    console.error('[widget/chat] lead email send failed:', err)
                  }
                }
              }
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

    // Stream errors are already caught + logged inside the IIFE above.
    // This outer catch only suppresses unhandled-rejection warnings.
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
