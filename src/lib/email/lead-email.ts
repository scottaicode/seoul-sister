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

import { noCardTrialEnabled } from '@/lib/trial'
import { getAnthropicClient, MODELS, callAnthropicWithRetry } from '@/lib/anthropic'
import { logAIUsage } from '@/lib/ai-usage-logger'
import { PRICING } from '@/lib/pricing'
import { normalizeOfferCode } from '@/lib/offers'

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
 * The link placed below the recap (Nov 7 2026). `resumes` is true only when the
 * URL carries a signed resume token (src/lib/widget/resume-token.ts), i.e. the
 * click really reopens this conversation. Recaps used to promise "pick the
 * conversation right back up" while linking to the bare homepage, which opened
 * an empty chat for anyone clicking more than an hour later or on another
 * device. Yuri is told which of the two links she has, as a fact, so the email
 * never promises continuity the link cannot deliver.
 */
export interface RecapLink {
  url: string
  resumes: boolean
  /**
   * Free preview messages the visitor has left (server ledger), or null when
   * unknown. A reopened conversation with none left shows the subscribe card
   * instead of a reply box, so Yuri must not imply they can just keep chatting.
   */
  remainingMessages?: number | null
  /**
   * Which fixed account line goes under the button. 'member' when this inbox
   * has already used its free trial. Defaults to 'free_week'.
   */
  accountLine?: AccountLineKind
  /**
   * The creator code this lead arrived with, or null. Added to the account
   * link so the discount follows the lead to whichever browser opens the
   * email. (The button's own `url` is built with it by widgetEmailLink.)
   */
  offerCode?: string | null
}

const HOMEPAGE_RECAP_LINK: RecapLink = { url: 'https://www.seoulsister.com/?from=recap', resumes: false }

export const RECAP_BUTTON_TEXT_RESUME = 'Continue our conversation'
export const RECAP_BUTTON_TEXT_HOMEPAGE = 'Chat with Yuri'

/** The visitor's remaining free messages, stated as a fact (empty when unknown). */
function remainingFact(remaining: number | null | undefined): string {
  if (typeof remaining !== 'number') return ''
  if (remaining <= 0) {
    return ' They have used all of their free preview messages, so the conversation they come back to can be read but not continued there; continuing means the free account and free week linked under your email.'
  }
  return ` They have ${remaining} free preview message${remaining === 1 ? '' : 's'} left; after that, continuing means the free account and free week linked under your email.`
}

/** What the button below the email does, stated as a fact for Yuri. */
export function recapLinkFact(link: RecapLink): string {
  const base = link.resumes
    ? `A button labelled "${RECAP_BUTTON_TEXT_RESUME}" is placed below your email. It reopens this exact conversation on the Seoul Sister homepage, with everything the two of you said still on screen, for the next 30 days and on any device. That button is their way back, so don't add a seoulsister.com link of your own.`
    : `A button labelled "${RECAP_BUTTON_TEXT_HOMEPAGE}" is placed below your email. It opens the free chat on the Seoul Sister homepage. Only the browser they chatted in, within about an hour, still shows this conversation; on another device or later, a new conversation starts and this transcript will not be there. So it would not be true to promise that the link picks this conversation back up or brings them back to where you left off. Don't add a seoulsister.com link of your own.`
  return `${base}${remainingFact(link.remainingMessages)} ${accountLineFact(link.accountLine ?? 'free_week', noCardTrialEnabled())}`
}

/**
 * The fixed line under the recap button (Nov 10 2026). The preview now stops
 * at the diagnosis and the routine is built in a member's first week, so the
 * recap is where a lead is shown the way in. Deterministic, not written by
 * Yuri: she is told what it says (accountLineFact) so she neither repeats it
 * nor has to explain how to sign up.
 *
 * Which line, and whether there is one at all, depends on the recipient:
 *   - 'free_week': someone who can still have the free week. The card wording
 *     follows the trial setting (noCardTrialEnabled), so the email can never
 *     promise "no card" while the checkout asks for one.
 *   - 'member': this inbox already used its trial. Saying "that week is free"
 *     would be false, so the line names membership and no free week.
 *   - none: the visitor said they are under 13 (the widget prompt forbids
 *     pointing a child at an account; this line must not do it for her).
 */
export type AccountLineKind = 'free_week' | 'member'
export const ACCOUNT_LINK_LABEL = 'Create your free account'
export const ACCOUNT_LINK_URL = 'https://www.seoulsister.com/register?plan=monthly&from=recap&utm_source=recap&utm_medium=email'

/** The sentence itself. Pure given the two inputs, exported for tests. */
export function accountLineText(kind: AccountLineKind, noCard: boolean): string {
  if (kind === 'member') return 'Your routine is built with Yuri once you are a member.'
  return noCard
    ? `Your routine is built in your first week as a member. For a new member that week is free, with no card needed to start.`
    : `Your routine is built in your first week as a member. For a new member that week is free; a card is needed to start it, and nothing is charged if you cancel before it ends.`
}

/** What Yuri is told about the line. */
export function accountLineFact(kind: AccountLineKind, noCard: boolean): string {
  return `Under that button Seoul Sister adds one fixed line: "${accountLineText(kind, noCard)}" with a link labelled "${ACCOUNT_LINK_LABEL}". So you do not need to explain how to sign up or what it costs, and you should not paste a link. The line is left off when the visitor said they are under 13.`
}

/**
 * Where "Create your free account" goes. With the recap's resume token it
 * carries the same proof the button does, so the sign-up page can hand this
 * conversation to the setup chat from ANY browser (Nov 11 2026). Without it the
 * chat followed the browser only: a lead who chatted in one browser and opened
 * the email in another (the owner's first walkthrough did exactly this) was
 * greeted by the setup chat as a stranger. Only a token made by
 * createResumeToken is accepted; anything else leaves the plain link.
 */
export function accountLinkUrl(resumeToken: string | null | undefined, offerCode?: string | null): string {
  const code = normalizeOfferCode(offerCode)
  const base = code ? `${ACCOUNT_LINK_URL}&code=${code}` : ACCOUNT_LINK_URL
  if (!resumeToken || !/^[A-Za-z0-9_-]{20,1000}$/.test(resumeToken)) return base
  return `${base}&resume=${resumeToken}`
}

/** The resume token inside a recap link, or null (a plain homepage link has none). */
export function resumeTokenOf(link: RecapLink): string | null {
  if (!link.resumes) return null
  try {
    return new URL(link.url).searchParams.get('resume')
  } catch {
    return null
  }
}

/** The fixed line as HTML, appended below the button. */
export function accountLineHtml(kind: AccountLineKind, noCard: boolean, resumeToken?: string | null, offerCode?: string | null): string {
  return `<p style="margin:16px 0 0;font-size:14px;color:#444;">${accountLineText(kind, noCard)} <a href="${escapeAttr(accountLinkUrl(resumeToken, offerCode))}" style="color:#8a6a1f;font-weight:600;">${ACCOUNT_LINK_LABEL}</a></p>`
}

/**
 * The recap's own footer (Nov 11 2026). It used the shared default, which says
 * "Just ignore this and we won't follow up". That is false: an address given
 * to Yuri is enrolled in the follow-up emails. This says what happens.
 */
export const RECAP_FOOTER_HTML = `<p style="font-size:12px;color:#999;margin:0;">Yuri is Seoul Sister's AI K-beauty advisor. You're receiving this because you gave Yuri this address while chatting at seoulsister.com. We may send you a few short follow-ups, and each of those has a one-click unsubscribe link.</p>`

function escapeAttr(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** The fixed button appended below Yuri's body (same style as lead-reengage.ts). */
export function recapLinkButtonHtml(link: RecapLink): string {
  const text = link.resumes ? RECAP_BUTTON_TEXT_RESUME : RECAP_BUTTON_TEXT_HOMEPAGE
  return `<p style="margin:22px 0 0;"><a href="${escapeAttr(link.url)}" style="display:inline-block;background:#C9A55C;color:#111;font-weight:600;padding:10px 22px;border-radius:10px;text-decoration:none;">${text}</a></p>`
}

/**
 * Yuri's body, the button, then the fixed account line (left off for a visitor
 * who said they are under 13). Exported so the test executes the real
 * composition: a source-text check passed with the line removed from the body.
 */
export function composeRecapBody(bodyHtml: string, link: RecapLink, visitorSaidUnder13: boolean): string {
  const line = visitorSaidUnder13 ? '' : `\n${accountLineHtml(link.accountLine ?? 'free_week', noCardTrialEnabled(), resumeTokenOf(link), link.offerCode)}`
  return `${bodyHtml}\n${recapLinkButtonHtml(link)}${line}`
}

/**
 * Discriminated result so the caller can act on Yuri's judgments:
 *  - send:              deliver the email
 *  - suppressed:        their address (or unknown), but no email warranted — keep capture
 *  - not_their_address: Yuri judged the address is NOT the visitor's own —
 *                       caller clears the capture slot so the real email can land later
 *  - failed:            generation/parse error — keep capture, send nothing
 */
/**
 * `reason` is Yuri's own one-line justification, which the prompt has always
 * asked for and which was previously written to console and then dropped. A
 * suppressed send with no recorded reason is indistinguishable from a broken
 * one, so it is now carried on every outcome and persisted by the caller.
 */
export type LeadEmailResult =
  | { outcome: 'send'; email: GeneratedLeadEmail; reason?: string }
  | { outcome: 'suppressed'; reason?: string }
  | { outcome: 'not_their_address'; reason?: string }
  | { outcome: 'failed'; reason?: string }

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
- A genuine continuation of YOUR conversation with THIS person, grounded in what they actually told you (their concern, the products they were curious about, where you left off). The address they typed is not a name: the part before the @ is often a nickname, a role or someone else's name. Use a name only if they told you one in the conversation.
- A recap of their SITUATION and what you gave them: the diagnosis and the single highest-leverage change (and the product pick, if one was needed). That's the whole recap.
- An open door back to the conversation (the facts below say exactly what the button and the line under your email do; describe them only as that). What comes next for them is the routine itself, built with you in a free first week and adjusted from what they tell you most weeks after. Lead with the relationship, not the pitch, and leave the price and the sign-up steps to the line Seoul Sister adds.

What this email is NOT:
- NOT a complete take-home routine. Even if the conversation covered many products and steps, do NOT compile a full AM/PM routine, a multi-week schedule, or a complete shopping list into the email. The recap gives them the diagnosis and the one change that matters most, and names what the routine would cover; building it together and adjusting it is what their free week is for. Say that plainly and warmly in one sentence, in your own words. A "complete plan" email is a stale snapshot with no one there to adjust it; the honest gift is the priority plus the open door.
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
{"should_send": true|false, "address_is_visitors_own": true|false, "visitor_said_under_13": true|false, "reason": "<one short sentence explaining the decision>", "subject": "<a short, human subject line — lowercase-casual is fine, no emoji spam>", "body_html": "<the email body as simple HTML: a few <p> paragraphs, no links (a fixed button is added below your email), no <html>/<head>/<body> tags, no inline styles>"}
When should_send is false, set subject and body_html to empty strings. Set visitor_said_under_13 to true only when the visitor themselves said they are under 13 in the conversation; otherwise false.`

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
  visitorId: string,
  /** Defaults to the plain homepage chat, so an omitted link never promises continuity. */
  link: RecapLink = HOMEPAGE_RECAP_LINK
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

  sections.push(`## The link below your email\n${recapLinkFact(link)}`)

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
      visitor_said_under_13?: boolean
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
      return notTheirAddress
        ? { outcome: 'not_their_address', reason: parsed.reason }
        : { outcome: 'suppressed', reason: parsed.reason }
    }

    if (!parsed.subject || !parsed.body_html) return { outcome: 'failed' }

    // Layer-2 mechanical voice scrub (punctuation-level only).
    return {
      outcome: 'send',
      reason: parsed.reason,
      email: {
        subject: scrubEmailVoice(parsed.subject),
        bodyHtml: composeRecapBody(scrubEmailVoice(parsed.body_html), link, parsed.visitor_said_under_13 === true),
      },
    }
  } catch (err) {
    console.error(`[email] generateLeadEmail failed for visitor ${visitorId}:`, err)
    return { outcome: 'failed' } // Send nothing, keep the capture slot.
  }
}
