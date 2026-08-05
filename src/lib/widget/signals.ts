/**
 * Widget intent signal detection engine.
 * ~15 consumer skincare signals detected from message patterns.
 * All detection is regex/keyword-based — no AI calls.
 */

import { getServiceClient } from '@/lib/supabase'

export interface SignalContext {
  messageNumber: number
  totalVisitorMessages: number
  toolsUsedThisSession: string[]
  specialistsDetected: string[]
}

export interface SignalMatch {
  signal_type: string
  signal_data: Record<string, unknown>
}

interface SignalDefinition {
  type: string
  category: 'skin_awareness' | 'product_interest' | 'purchase_intent' | 'engagement'
  detect: (message: string, context: SignalContext) => SignalMatch | null
}

const SIGNAL_DEFINITIONS: SignalDefinition[] = [
  // --- Skin Awareness ---
  {
    type: 'described_skin_type',
    category: 'skin_awareness',
    detect: (msg) => {
      const match = msg.match(/\b(my skin is|i have)\s+(oily|dry|combo|combination|sensitive|normal|dehydrated)\b/i)
      if (match) return { signal_type: 'described_skin_type', signal_data: { skin_type: match[2] } }
      return null
    },
  },
  {
    type: 'described_skin_concern',
    category: 'skin_awareness',
    detect: (msg) => {
      const concerns = ['acne', 'wrinkles', 'dark spots', 'redness', 'dehydration', 'pores', 'texture', 'hyperpigmentation', 'fine lines', 'dullness', 'aging', 'breakout', 'scarring', 'acne scar']
      const found = concerns.filter(c => msg.toLowerCase().includes(c))
      if (found.length > 0) return { signal_type: 'described_skin_concern', signal_data: { concerns: found } }
      return null
    },
  },
  {
    type: 'mentioned_current_routine',
    category: 'skin_awareness',
    detect: (msg) => {
      if (/\b(i use|my routine|currently using|i've been using|i apply|i started using)\b/i.test(msg)) {
        return { signal_type: 'mentioned_current_routine', signal_data: {} }
      }
      return null
    },
  },
  {
    type: 'mentioned_skin_reaction',
    category: 'skin_awareness',
    detect: (msg) => {
      if (/\b(broke me out|irritat|redness from|allergic to|reaction|burning|stinging|sensitivity)\b/i.test(msg)) {
        return { signal_type: 'mentioned_skin_reaction', signal_data: {} }
      }
      return null
    },
  },

  // --- Product Interest ---
  {
    type: 'asked_about_specific_product',
    category: 'product_interest',
    detect: (msg, ctx) => {
      // Detected via tool forcing (brand mention) or explicit product name
      if (ctx.toolsUsedThisSession.includes('search_products') || ctx.toolsUsedThisSession.includes('compare_prices')) {
        return { signal_type: 'asked_about_specific_product', signal_data: {} }
      }
      return null
    },
  },
  {
    type: 'asked_product_comparison',
    category: 'product_interest',
    detect: (msg) => {
      if (/\b(vs\.?|versus|or|better|difference between|compare|which one)\b/i.test(msg) && msg.length > 20) {
        return { signal_type: 'asked_product_comparison', signal_data: {} }
      }
      return null
    },
  },
  {
    type: 'asked_product_price',
    category: 'product_interest',
    detect: (msg) => {
      if (/\b(how much|price|cost|where to buy|cheapest|deal|affordable)\b/i.test(msg)) {
        return { signal_type: 'asked_product_price', signal_data: {} }
      }
      return null
    },
  },
  {
    type: 'asked_for_recommendation',
    category: 'product_interest',
    detect: (msg) => {
      if (/\b(recommend|suggest|best|what should i|what do you recommend|which .{0,20} should|top)\b/i.test(msg)) {
        return { signal_type: 'asked_for_recommendation', signal_data: {} }
      }
      return null
    },
  },
  {
    type: 'asked_about_authenticity',
    category: 'product_interest',
    detect: (msg) => {
      if (/\b(fake|real|authentic|counterfeit|legit|genuine|knock.?off)\b/i.test(msg)) {
        return { signal_type: 'asked_about_authenticity', signal_data: {} }
      }
      return null
    },
  },

  // --- Purchase Intent ---
  {
    type: 'asked_where_to_buy',
    category: 'purchase_intent',
    detect: (msg) => {
      if (/\b(where (can i|to|do i) buy|which retailer|olive young|yesstyle|soko glam|amazon|stylevana)\b/i.test(msg)) {
        return { signal_type: 'asked_where_to_buy', signal_data: {} }
      }
      return null
    },
  },
  {
    // Outside-US shopper (Aug 5 2026).
    //
    // A woman in Kolkata with PCOS got a genuinely good routine off her own
    // shelf, then asked for something she could actually buy. Our price feeds
    // are Olive Young Global / Soko Glam / iHerb — US and Korea-direct — so the
    // honest answer was "I can't quote you rupee prices without guessing." That
    // left a motivated person with no purchase path.
    //
    // The reasoning travels everywhere (INCI is INCI, and Yuri read her Plum,
    // Re'equil and Pond's products correctly). Only the last mile breaks. The
    // open question is HOW OFTEN, and grep on chat logs can't answer it: it
    // only finds visitors who volunteered a location, and 3 hits out of 58
    // visitors cannot distinguish 5% from 15%.
    //
    // So record it as a signal with the region attached. In a month this is a
    // number that decides whether real regional retailer coverage is worth
    // building — instead of the same three anecdotes we're reasoning from now.
    // Detection is deliberately narrow: a named place, not a guess from
    // language or spelling.
    type: 'shopper_outside_us',
    category: 'purchase_intent',
    detect: (msg) => {
      const REGIONS: Array<[RegExp, string]> = [
        [/\b(india|kolkata|mumbai|delhi|bangalore|bengaluru|chennai|hyderabad|pune|vijayawada|nykaa)\b/i, 'india'],
        [/\b(singapore|malaysia|kuala lumpur|philippines|manila|indonesia|jakarta|vietnam|hanoi|ho chi minh|thailand|bangkok|shopee|lazada)\b/i, 'southeast_asia'],
        [/\b(uk|united kingdom|london|manchester|ireland|dublin|scotland)\b/i, 'uk'],
        [/\b(germany|france|spain|italy|netherlands|poland|sweden|norway|denmark|portugal|belgium|austria)\b/i, 'eu'],
        [/\b(australia|sydney|melbourne|brisbane|perth|new zealand|auckland)\b/i, 'anz'],
        [/\b(canada|toronto|vancouver|montreal|calgary|ottawa)\b/i, 'canada'],
        [/\b(uae|dubai|abu dhabi|saudi|riyadh|qatar|doha|kuwait|bahrain)\b/i, 'gulf'],
        [/\b(brazil|sao paulo|mexico|mexico city|argentina|buenos aires|chile|colombia|bogota)\b/i, 'latam'],
        [/\b(nigeria|lagos|kenya|nairobi|south africa|johannesburg|cape town|ghana|accra|egypt|cairo)\b/i, 'africa_me'],
      ]
      for (const [re, region] of REGIONS) {
        const m = msg.match(re)
        if (m) {
          return {
            signal_type: 'shopper_outside_us',
            // The matched term is kept so a later reader can tell a real
            // location mention from an incidental one ("Korea" in a product
            // name would not reach here, but ambiguity elsewhere is possible).
            signal_data: { region, matched: m[0].toLowerCase() },
          }
        }
      }
      return null
    },
  },
  {
    type: 'asked_about_subscription',
    category: 'purchase_intent',
    detect: (msg) => {
      if (/\b(subscri|subscription|\$39|pro plan|seoul sister pro|how much is seoul|sign up|what do i get)\b/i.test(msg)) {
        return { signal_type: 'asked_about_subscription', signal_data: {} }
      }
      return null
    },
  },
  {
    type: 'deep_routine_question',
    category: 'purchase_intent',
    detect: (msg) => {
      if (/\b(what order|layering|can i use .{3,30} with|am and pm|morning.{0,10}night|routine.{0,20}step|double cleanse)\b/i.test(msg)) {
        return { signal_type: 'deep_routine_question', signal_data: {} }
      }
      return null
    },
  },
  {
    type: 'multiple_product_questions',
    category: 'purchase_intent',
    detect: (_msg, ctx) => {
      // 3+ product-related tool calls in one session
      const productTools = ctx.toolsUsedThisSession.filter(t =>
        t === 'search_products' || t === 'compare_prices'
      )
      if (productTools.length >= 3) {
        return { signal_type: 'multiple_product_questions', signal_data: { tool_count: productTools.length } }
      }
      return null
    },
  },

  // --- Engagement ---
  {
    type: 'returned_visitor',
    category: 'engagement',
    detect: (_msg, ctx) => {
      if (ctx.totalVisitorMessages > 0 && ctx.messageNumber === 1) {
        return { signal_type: 'returned_visitor', signal_data: {} }
      }
      return null
    },
  },
  {
    type: 'long_conversation',
    category: 'engagement',
    detect: (_msg, ctx) => {
      if (ctx.messageNumber >= 8) {
        return { signal_type: 'long_conversation', signal_data: { message_count: ctx.messageNumber } }
      }
      return null
    },
  },
]

/**
 * Detect all matching signals from a message + context.
 */
export function detectSignals(message: string, context: SignalContext): SignalMatch[] {
  const matches: SignalMatch[] = []

  for (const def of SIGNAL_DEFINITIONS) {
    const match = def.detect(message, context)
    if (match) matches.push(match)
  }

  return matches
}

/**
 * Record detected signals to the database. Fire-and-forget.
 */
export async function recordSignals(
  signals: SignalMatch[],
  visitorId: string,
  sessionId: string,
  messageId: string
): Promise<void> {
  if (signals.length === 0) return

  try {
    const supabase = getServiceClient()

    // Batch insert signals
    const rows = signals.map(s => ({
      visitor_id: visitorId,
      session_id: sessionId,
      message_id: messageId || null,
      signal_type: s.signal_type,
      signal_data: s.signal_data,
    }))

    await supabase.from('ss_widget_intent_signals').insert(rows)

    // Update message intent_signals array
    if (messageId) {
      await supabase
        .from('ss_widget_messages')
        .update({ intent_signals: signals.map(s => s.signal_type) })
        .eq('id', messageId)
    }
  } catch (err) {
    console.error('[widget/signals] Failed to record signals:', err)
    // Non-critical — never break the conversation
  }
}

/**
 * Detect and record signals in one call. Fire-and-forget.
 */
export async function detectAndRecordSignals(
  message: string,
  context: SignalContext,
  visitorId: string,
  sessionId: string,
  messageId: string
): Promise<string[]> {
  const signals = detectSignals(message, context)
  if (signals.length > 0) {
    await recordSignals(signals, visitorId, sessionId, messageId)
  }
  return signals.map(s => s.signal_type)
}
