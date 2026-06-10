/**
 * Lead email generation — Yuri's voice, AI-generated from real conversation facts.
 *
 * AI-First (binding notes from /ai-first-guard, v10.13.2 + v10.13.3): the body,
 * subject, AND the send/no-send decision of a lead email belong to the model.
 * Yuri writes the follow-up from the SPECIFIC visitor's actual conversation —
 * NOT a hardcoded template, NOT a template with filled slots — and she also
 * judges CONSENT: whether the visitor shared their own address wanting
 * follow-up, vs. mentioning a third-party address incidentally ("I ordered
 * via support@yesstyle.com"), quoting an email thread, or testing the widget.
 * The regex in the widget route stays detection-only ("an address was typed");
 * every judgment lives here, with the model, with full conversational context.
 *
 * Grounding (v10.13.3 fix): v10.13.2 grounded ONLY in visitor.ai_memory, which
 * is generated every 3rd message and loaded at request start — empty for
 * virtually all first-session captures, so the email silently never fired in
 * the most common case. Now the CURRENT session conversation is passed in as
 * primary grounding, with ai_memory (prior sessions) as supplementary context.
 *
 * Fail-safe discipline: on ANY failure — generation error, unparseable JSON,
 * missing should_send — we send NOTHING. A consent judgment that defaults to
 * "send" on error is worse than no judgment. A fabricated-personalization
 * template is worse than silence. (Yuri's tool-call honesty, applied to email.)
 * Suppressed sends are LOGGED (console.warn + zero-cost ss_ai_usage breadcrumb)
 * so the silent path stays visible — the v10.3.4 lesson.
 */

import { getAnthropicClient, MODELS, callAnthropicWithRetry } from '@/lib/anthropic'
import { logAIUsage } from '@/lib/ai-usage-logger'

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

/** Keep the prompt bounded: most-recent turns, generous per-turn cap so Yuri
 *  writes from sentences, not fragments (mechanical context-budgeting only). */
const MAX_TURNS = 12
const MAX_TURN_CHARS = 500

const LEAD_EMAIL_SYSTEM = `You are Yuri (유리), Seoul Sister's K-beauty advisor. Someone just typed an email address during a conversation with you on the Seoul Sister website. You have two jobs, in order.

JOB 1 — Decide whether to send anything at all (should_send).
Send ONLY when the visitor shared their OWN address because they want to stay in touch or pick the conversation back up. Do NOT send when:
- The address belongs to someone or something else (a retailer's support address, a quoted order confirmation, an address they're asking about, a friend's email).
- They typed it for an unrelated reason and a follow-up email would feel uninvited.
- The conversation is too thin or off-topic for a follow-up to feel like a real continuation rather than spam.
When you don't send, say why in "reason" — briefly, for the operations log.

JOB 2 — If (and only if) sending, write ONE short, warm follow-up email — the kind a knowledgeable friend who happens to work in a Korean skincare lab would actually send.

What this email IS:
- A genuine continuation of YOUR conversation with THIS person, grounded in what they actually told you (their concern, the products they were curious about, where you left off).
- An open door back to the conversation — they get unlimited chats, a routine that remembers them, and progress tracking if they subscribe ($39.99/mo), but lead with the relationship, not the pitch.

What this email is NOT:
- Not a generic newsletter. Not a hard sell. Not a list of features. Not "Dear valued customer."
- Do NOT invent details you weren't told. If the facts are thin but a send is still warranted, keep it warm and light rather than fabricating specifics.

Return STRICT JSON only, no markdown fence:
{"should_send": true|false, "reason": "<one short sentence explaining the decision>", "subject": "<a short, human subject line — lowercase-casual is fine, no emoji spam>", "body_html": "<the email body as simple HTML: a few <p> paragraphs, maybe one link to https://seoulsister.com — no <html>/<head>/<body> tags, no inline styles, just <p> and <a>>"}
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
 * Generate a lead follow-up email in Yuri's voice from the visitor's real
 * conversation, with Yuri also judging consent (should_send).
 * Returns null when nothing should be sent — for ANY reason (judged no-send,
 * generation failure, parse failure). Caller sends nothing on null.
 */
export async function generateLeadEmail(
  facts: VisitorMemoryFacts,
  conversation: ConversationTurn[],
  capturedEmail: string,
  visitorId: string
): Promise<GeneratedLeadEmail | null> {
  // Existence check ONLY (binding note from /ai-first-guard): is there anything
  // at all to reason about? Whether it's good enough to ground an email is
  // Yuri's judgment via should_send, not this gate's.
  const hasMemorySubstance =
    !!facts.summary ||
    (facts.skin_concerns?.length ?? 0) > 0 ||
    (facts.products_interested_in?.length ?? 0) > 0
  const hasConversation = conversation.some((t) => t.role === 'user')
  if (!hasMemorySubstance && !hasConversation) return null

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

  const userPrompt = `${sections.join('\n\n')}\n\nFirst decide should_send, then (only if sending) write the follow-up, grounded ONLY in the facts above. Return strict JSON.`

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
    if (!text) return null

    // Parse the JSON (tolerate an accidental ```json fence).
    const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '').trim()
    const parsed = JSON.parse(cleaned) as {
      should_send?: boolean
      reason?: string
      subject?: string
      body_html?: string
    }

    // Fail-safe: anything other than an explicit true is a no-send.
    if (parsed.should_send !== true) {
      console.warn(
        `[email] lead email suppressed for visitor ${visitorId}: ${parsed.reason || 'no reason given'}`
      )
      // Zero-cost breadcrumb so suppressions are queryable, not just in logs.
      void logAIUsage({
        feature: 'lead_email_suppressed',
        model: 'n/a',
        inputTokens: 0,
        outputTokens: 0,
        cached: true,
      }).catch(() => {})
      return null
    }

    if (!parsed.subject || !parsed.body_html) return null
    return { subject: parsed.subject, bodyHtml: parsed.body_html }
  } catch (err) {
    console.error(`[email] generateLeadEmail failed for visitor ${visitorId}:`, err)
    return null // Send nothing rather than a fabricated template.
  }
}
