/**
 * Lead email generation — Yuri's voice, AI-generated from real conversation facts.
 *
 * AI-First (binding notes from /ai-first-guard, v10.13.2–v10.13.4): the body,
 * subject, the send/no-send decision, AND the whose-address-is-this judgment
 * of a lead email all belong to the model. Yuri writes the follow-up from the
 * SPECIFIC visitor's actual conversation — NOT a template — and she judges:
 *   - CONSENT (should_send): did the visitor share an address wanting follow-up?
 *   - OWNERSHIP (address_is_visitors_own): is this THEIR address, or a
 *     third-party one mentioned incidentally ("I ordered via support@yesstyle.com")?
 * The ownership verdict drives capture-slot cleanup in the route (deterministic
 * execution of model judgment — the v10.7.0 corrections-drive-cleanup pattern).
 *
 * HUMAN VOICE (v10.13.4, Scott's direct ask): outbound lead email is the one
 * surface where AI tells measurably hurt — a cold lead who smells "automated"
 * deletes. Two layers, adapted from LGAAS's production-validated system
 * (<0.3% AI-detection on 222+ Reddit posts):
 *   Layer 1 — prevention: the VOICE section in the system prompt (creative-brief
 *     principles; the writing stays fully the model's).
 *   Layer 2 — cleanup: scrubEmailVoice(), a STRICTLY punctuation-level scrub
 *     (em/en-dash artifacts only — the same pattern voice-cleanup.ts has run on
 *     chat since v13.6). NO word swaps, NO content rewriting: if vocabulary
 *     leaks, the fix is prompt iteration, never a substitution regex.
 *
 * Fail-safe discipline: on ANY failure we send NOTHING, and we KEEP the capture
 * slot (clearing only happens on Yuri's explicit address_is_visitors_own=false —
 * the destructive direction never runs on uncertainty). Suppressed sends and
 * slot-clears are logged (console + zero-cost breadcrumb) — the v10.3.4 lesson.
 */

import { getAnthropicClient, MODELS, callAnthropicWithRetry } from '@/lib/anthropic'
import { logAIUsage } from '@/lib/ai-usage-logger'
import { PRICING } from '@/lib/pricing'

export interface VisitorMemoryFacts {
  summary?: string
  skin_concerns?: string[]
  products_interested_in?: string[]
  interest_level?: string
}

export interface ConversationTurn {
  role: 'user' | 'assistant'
  content: string
}

export interface GeneratedLeadEmail {
  subject: string
  bodyHtml: string
}

/**
 * Discriminated result so the caller can act on Yuri's judgments:
 *  - send:              deliver the email
 *  - suppressed:        their address (or unknown), but no email warranted — keep capture
 *  - not_their_address: Yuri judged the address is NOT the visitor's own —
 *                       caller clears the capture slot so the real email can land later
 *  - failed:            generation/parse error — keep capture, send nothing
 */
export type LeadEmailResult =
  | { outcome: 'send'; email: GeneratedLeadEmail }
  | { outcome: 'suppressed' }
  | { outcome: 'not_their_address' }
  | { outcome: 'failed' }

/** Keep the prompt bounded: most-recent turns, generous per-turn cap so Yuri
 *  writes from sentences, not fragments (mechanical context-budgeting only). */
const MAX_TURNS = 12
const MAX_TURN_CHARS = 500

const LEAD_EMAIL_SYSTEM = `You are Yuri (유리), Seoul Sister's K-beauty advisor. Someone just typed an email address during a conversation with you on the Seoul Sister website. You have two jobs, in order.

JOB 1 — Judge the address and decide whether to send (should_send + address_is_visitors_own).
First: is this the visitor's OWN address, shared because they want to stay in touch or pick the conversation back up? Or is it someone else's — a retailer's support address, an address quoted from an order confirmation, an address they're asking about, a friend's email? Set address_is_visitors_own accordingly.
Send ONLY when it's their own address shared with follow-up intent. Do NOT send when:
- The address isn't theirs (set address_is_visitors_own to false).
- They typed it for an unrelated reason and a follow-up email would feel uninvited.
- The conversation is too thin or off-topic for a follow-up to feel like a real continuation rather than spam.
When you don't send, say why in "reason" — briefly, for the operations log.

JOB 2 — If (and only if) sending, write ONE short, warm follow-up email — the kind a knowledgeable friend who happens to work in a Korean skincare lab would actually send.

What this email IS:
- A genuine continuation of YOUR conversation with THIS person, grounded in what they actually told you (their concern, the products they were curious about, where you left off).
- An open door back to the conversation — they get unlimited chats, a routine that remembers them, and progress tracking if they subscribe (${PRICING.monthly_display}), but lead with the relationship, not the pitch.

What this email is NOT:
- Not a generic newsletter. Not a hard sell. Not a list of features. Not "Dear valued customer."
- Do NOT invent details you weren't told. If the facts are thin but a send is still warranted, keep it warm and light rather than fabricating specifics.

VOICE — the email must read like a human wrote it (non-negotiable).
The reader may know Yuri is an AI; that's fine. But an email full of AI tells reads as automated marketing and gets deleted. Write like you'd text a smart friend who asked for the recap:
- NEVER connect thoughts with em dashes (—) or double hyphens (--). Use a period, a comma, or "and"/"but"/"so" instead. This is the single biggest giveaway.
- Contractions everywhere (it's, don't, you're, that's).
- Vary sentence length like a person does: some long, some short, none staccato. No "Short. Punchy. Impact." rhythm. No "Not X. Not Y. THIS." parallel structures. Don't build to a mic-drop closing line.
- Skip AI-favorite words: unlock, elevate, leverage, delve, seamless, game-changer, transformative, "your skincare journey".
- No filler openers ("Here's the thing:", "The truth is:") and no keynote energy. Plain, warm, specific.
- A slightly imperfect, conversational sentence beats a polished one.

Return STRICT JSON only, no markdown fence:
{"should_send": true|false, "address_is_visitors_own": true|false, "reason": "<one short sentence explaining the decision>", "subject": "<a short, human subject line — lowercase-casual is fine, no emoji spam>", "body_html": "<the email body as simple HTML: a few <p> paragraphs, maybe one link to https://seoulsister.com — no <html>/<head>/<body> tags, no inline styles, just <p> and <a>>"}
When should_send is false, set subject and body_html to empty strings.`

function buildTranscript(conversation: ConversationTurn[]): string {
  return conversation
    .slice(-MAX_TURNS)
    .map((t) => {
      const text =
        t.content.length > MAX_TURN_CHARS
          ? `${t.content.slice(0, MAX_TURN_CHARS)}…`
          : t.content
      return `${t.role === 'user' ? 'Visitor' : 'You (Yuri)'}: ${text}`
    })
    .join('\n')
}

/**
 * Layer-2 mechanical voice scrub — STRICTLY punctuation-level (binding note
 * from /ai-first-guard). Catches dash artifacts that leak past the prompt;
 * vocabulary and structure remain the model's responsibility via Layer 1.
 * HTML-safe: none of these patterns touch tags or attributes.
 * Same family as voice-cleanup.ts (chat, since v13.6) and LGAAS Layer 1.5.
 */
export function scrubEmailVoice(text: string): string {
  return (
    text
      // HTML entity forms of the em dash first
      .replace(/\s*&(?:mdash|#8212);\s*/g, ', ')
      // word—word parenthetical-aside pattern → comma
      .replace(/(\w)—(\w)/g, '$1, $2')
      // any remaining em dashes (spaced or not) → comma
      .replace(/\s*—\s*/g, ', ')
      // double hyphens used connectively
      .replace(/(\w)--(\w)/g, '$1, $2')
      .replace(/\s+--\s+/g, ', ')
      // en dash ONLY when spaced (connective use); "5–10%" ranges survive
      .replace(/\s+–\s+/g, ', ')
      // tidy any doubled commas the swaps may have produced
      .replace(/,\s*,/g, ',')
  )
}

/**
 * Generate a lead follow-up email in Yuri's voice from the visitor's real
 * conversation, with Yuri judging consent (should_send) and address ownership
 * (address_is_visitors_own). See LeadEmailResult for caller semantics.
 */
export async function generateLeadEmail(
  facts: VisitorMemoryFacts,
  conversation: ConversationTurn[],
  capturedEmail: string,
  visitorId: string
): Promise<LeadEmailResult> {
  // Existence check ONLY (binding note from /ai-first-guard): is there anything
  // at all to reason about? Whether it's good enough to ground an email is
  // Yuri's judgment via should_send, not this gate's.
  const hasMemorySubstance =
    !!facts.summary ||
    (facts.skin_concerns?.length ?? 0) > 0 ||
    (facts.products_interested_in?.length ?? 0) > 0
  const hasConversation = conversation.some((t) => t.role === 'user')
  if (!hasMemorySubstance && !hasConversation) return { outcome: 'suppressed' }

  const sections: string[] = []

  if (hasConversation) {
    sections.push(
      `## The conversation that just happened (most recent turns)\n${buildTranscript(conversation)}`
    )
  }

  if (hasMemorySubstance) {
    const factLines: string[] = []
    if (facts.summary) factLines.push(`- Prior conversations summary: ${facts.summary}`)
    if (facts.skin_concerns?.length)
      factLines.push(`- Their skin concerns: ${facts.skin_concerns.join(', ')}`)
    if (facts.products_interested_in?.length)
      factLines.push(`- Products they were curious about: ${facts.products_interested_in.join(', ')}`)
    if (facts.interest_level)
      factLines.push(`- How engaged they've seemed: ${facts.interest_level}`)
    sections.push(`## What you know from earlier visits\n${factLines.join('\n')}`)
  }

  sections.push(`## The address they typed\n${capturedEmail}`)

  const userPrompt = `${sections.join('\n\n')}\n\nFirst judge the address and decide should_send, then (only if sending) write the follow-up, grounded ONLY in the facts above. Return strict JSON.`

  try {
    const client = getAnthropicClient()
    const response = await callAnthropicWithRetry(() =>
      client.messages.create({
        model: MODELS.primary, // user-facing outbound in Yuri's voice → Opus (Principle 1)
        max_tokens: 800,
        system: LEAD_EMAIL_SYSTEM,
        messages: [{ role: 'user', content: userPrompt }],
      })
    )

    // Log cost (real usage — non-streaming, so usage is directly available).
    void logAIUsage({
      feature: 'content_generation',
      model: MODELS.primary,
      inputTokens: response.usage.input_tokens,
      outputTokens: response.usage.output_tokens,
      cacheReadTokens: response.usage.cache_read_input_tokens ?? 0,
      cacheCreationTokens: response.usage.cache_creation_input_tokens ?? 0,
    })

    const textBlock = response.content.find((b) => b.type === 'text')
    const text = textBlock && textBlock.type === 'text' ? textBlock.text : ''
    if (!text) return { outcome: 'failed' }

    // Parse the JSON (tolerate an accidental ```json fence).
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned) as {
      should_send?: boolean
      address_is_visitors_own?: boolean
      reason?: string
      subject?: string
      body_html?: string
    }

    // Ownership verdict: ONLY an explicit false triggers slot-clearing
    // (binding note — the destructive direction never runs on uncertainty).
    const notTheirAddress = parsed.address_is_visitors_own === false

    // Fail-safe: anything other than an explicit should_send true is a no-send.
    if (parsed.should_send !== true) {
      console.warn(
        `[email] lead email ${notTheirAddress ? 'suppressed (not visitor\'s own address)' : 'suppressed'} for visitor ${visitorId}: ${parsed.reason || 'no reason given'}`
      )
      // Zero-cost breadcrumb so suppressions are queryable, not just in logs.
      void logAIUsage({
        feature: 'lead_email_suppressed',
        model: 'n/a',
        inputTokens: 0,
        outputTokens: 0,
        cached: true,
      }).catch(() => {})
      return notTheirAddress ? { outcome: 'not_their_address' } : { outcome: 'suppressed' }
    }

    if (!parsed.subject || !parsed.body_html) return { outcome: 'failed' }

    // Layer-2 mechanical voice scrub (punctuation-level only).
    return {
      outcome: 'send',
      email: {
        subject: scrubEmailVoice(parsed.subject),
        bodyHtml: scrubEmailVoice(parsed.body_html),
      },
    }
  } catch (err) {
    console.error(`[email] generateLeadEmail failed for visitor ${visitorId}:`, err)
    return { outcome: 'failed' } // Send nothing, keep the capture slot.
  }
}
