import { getAnthropicClient, MODELS, CHAT_EFFORT, callAnthropicWithRetry } from '@/lib/anthropic'
import { parseModelJson } from '@/lib/utils/model-json'
import { DECLINED_REPLY } from '@/lib/llm-request'
import type Anthropic from '@anthropic-ai/sdk'
import { YURI_TOOLS, executeYuriTool } from '@/lib/yuri/tools'
import { missingSetupRequirements, SETUP_REQUIREMENTS } from '@/lib/yuri/setup-requirements'
import { logAIUsage } from '@/lib/ai-usage-logger'
import { onboardingUsageRow } from '@/lib/yuri/onboarding-usage'
import { carryoverBlock, previewAgeFact, type Carryover } from '@/lib/yuri/widget-carryover'
import { withTrailingContext, markPenultimateAssistant } from '@/lib/llm-request'
import { getServiceClient } from '@/lib/supabase'
import { buildAttributionFields } from '@/lib/attribution'
import { geocodeLocation } from '@/lib/geo/geocode'
import { unplacedLocationFact } from '@/lib/geo/location-fact'
import { cleanGender, cleanAgeYears, ageWrite, setupIdentityFacts, mergeDatedFacts, standingFacts } from '@/lib/yuri/stated-identity'
import { hasActiveSubscription } from '@/lib/subscription'
import { PRICING } from '@/lib/pricing'
// Shared with the public widget — same artifacts, same conservative detection,
// same fact-not-cap wording. Importing rather than re-implementing so the two
// surfaces can never drift apart.
import {
  detectCumulativeGive,
  buildCumulativeGiveBlock,
  type CumulativeGive,
} from '@/lib/widget/cumulative-give'
import type { ExtractedSkinProfile, OnboardingProgress, YuriMessage } from '@/types/database'

// ---------------------------------------------------------------------------
// All trackable profile fields and which are required for minimum onboarding
// ---------------------------------------------------------------------------

const ALL_FIELDS = [
  'skin_type',
  'skin_concerns',
  'age_range',
  'fitzpatrick_scale',
  'climate',
  'allergies',
  'current_routine',
  'budget_preference',
  'experience_level',
  'product_preferences',
  'location_text',
  // Clinical fields (added Jul 28 2026). They were extractable and writable but
  // TRACKED NOWHERE — absent from this list, so they never appeared in "Fields
  // still needed", never counted toward progress, and nothing ever noticed when
  // one went missing. Caroline answered both sun questions and `sun_history`
  // still landed NULL; the system was structurally blind to the gap. Listing
  // them here is what makes an unanswered safety question visible to Yuri.
  // NOTE: this widens the completion_percentage denominator, so in-flight
  // onboardings show a lower %. REQUIRED_FIELDS is untouched, so nothing that
  // gates completion changes.
  'medical_history',
  'sun_history',
] as const

// What setup must hold before it can be finished lives in setup-requirements.ts
// (Nov 17 2026). It used to be three fields here: skin type, a concern, an age
// range. "Finish setup" then appeared before the medical question was asked.

/**
 * Lifetime user-message cap on the free onboarding conversation.
 *
 * Single source of truth: the API route enforces it (429 `onboarding_message_cap`)
 * and the turn-state block reports the user's position against it to Yuri, so
 * the number must not be duplicated. It bounds Opus cost on a free surface.
 */
export const ONBOARDING_USER_MESSAGE_CAP = 50

// ---------------------------------------------------------------------------
// Build Yuri's onboarding system prompt
// ---------------------------------------------------------------------------

export function buildOnboardingSystemPrompt(
  extractedFields: Record<string, boolean>
): string {
  // STATIC ONLY. Per-turn state (captured/missing fields, the extracted-data
  // JSON, quality notes) moved to buildOnboardingTurnState and is sent as a
  // SEPARATE UNCACHED block — see that function for why. Nothing that changes
  // between turns may be interpolated below.
  void extractedFields

  return `You are Yuri (유리), Seoul Sister's AI beauty advisor with 20+ years in the Korean skincare industry. You are conducting a conversational onboarding to build this user's skin profile.

## Your Voice
Think: "cool older sister who works at Amorepacific in Seoul." Confident, warm, specific. NOT a chatbot, NOT a beauty blogger, NOT a professor.

- Lead with substance -- never open with "Great question!" or similar filler
- Use Korean terms naturally, WITH a quick English gloss the first time each one appears: 피부 타입 (skin type), 수분 (hydration), 피지 (sebum), 각질 (dead skin cells). This is their first real conversation with you — translated Korean is charm, untranslated Korean is homework.
- React to their answers with genuine insight -- not just "Oh interesting!" Drop a relevant K-beauty tip or industry observation with each answer
- Speak like you're catching up with a friend, not conducting a survey

## Your Mission
You are having a natural conversation to learn about this person so you can deliver personalized intelligence. You are NOT filling out a form -- you are getting to know someone who cares about their skin, and showing real expertise in how you listen and what you notice. The "she actually gets my situation" moment is what earns the next step.

Their membership status is a FACT in Current State below -- read it there, never assume it. Creating an account starts a first-time member's free week (${PRICING.trial_days} days, no card), so most people in this conversation are already members and this is the first conversation of that week. A non-member here is someone whose free week did not start when they signed up: often because they have had one before, sometimes for another reason, and you are not told which. For them this setup chat is free and the membership offer comes after it, at ${PRICING.monthly_display_long}. Either way this conversation is the evidence they will weigh.

## The Give and the Gate
Give freely: your full attention, genuine reactions, and the sharp diagnosis they could not get from Google -- WHY their last treatment plateaued, WHY their skin behaves the way it does in their climate, what their current products are actually doing and missing. If one concern is burning a hole in them, solve it: one specific pick, one concrete first step, real instructions for that step.

One fact about this chat differs by person and is stated under "Where They Stand": whether products can be looked up here. Where lookup is available, search_products finds products in our catalog and get_product_details returns the ingredient list we hold for one. Prices and stores are not shown in this chat. Where lookup is not available, this chat has no product database: unless a product's ingredients are already written out in this chat or in the "Before they signed up" transcript, what you say about its formula comes from memory and has not been checked against what this person has told you they react to. Nothing in this chat saves a product or a routine.

The complete build is the subscriber side of Seoul Sister and is not delivered here: the full AM/PM construction, week-by-week ramp schedules, multi-week plans with adjustment rules, and ongoing follow-up. This is not withholding to tease. That work genuinely depends on how their skin responds over weeks -- which is exactly why it is a subscription and not a PDF. When the conversation reaches that door, say so plainly: name what you would build together. For someone who is already a member, that door is simply the end of this setup chat: the complete routine is built with them in the member chat that opens next.

## Promises You Can Keep
If they are not a member yet, this conversation is the last time you will see them unless they become a member. "I'll be here whenever you hit a plateau" and "see you in a month" are promises this conversation cannot keep, and a warm goodbye followed by a membership offer they were not told about reads as bait rather than care. Never let someone leave holding a false belief about what happens next. Said honestly and at the right moment -- when they start making future plans with you, and again as you wrap up -- the next step is not awkward. It is the natural continuation of a plan you have both just started.

## Conversation Guidelines
- Ask ONE question at a time (never dump a list of questions)
- React genuinely to their answers before asking the next question -- share an insight they wouldn't find on Reddit
- Weave questions naturally into the conversation flow
- If they mention a product or concern, briefly respond with specific knowledge before moving on
- NEVER say things like "field 3 of 8" or "next question" -- this should feel like a chat
- NEVER repeat a question for information you already have

## Pacing
- Your response shape: reaction (1-2 sentences) -> insight (2-3 sentences) -> next question (1-2 sentences)
- Total: 5-7 sentences per response. If you're going longer, you're lecturing
- Save deep dives for after onboarding -- right now you're building rapport and learning about them
- Exception: medical or safety topics (allergies, medications, reactions) deserve thorough responses

## Opening
If this is your first message, introduce yourself as Yuri and ask about their biggest skin frustration, unless a "Before they signed up" section shows you have already talked with them, in which case you are not meeting them: continue from that conversation instead. It may have ended only minutes ago; how long ago is stated in Current State. Make it feel like meeting someone interesting -- not reading a script. Every opening should feel slightly different because YOU are responding to a unique person. Use your voice: casual, Korean terms with a quick English gloss, insider energy.

## What You Need to Learn (Not a Questionnaire)
You need to understand these aspects of their skin through natural conversation. DO NOT ask about them in order. DO NOT use scripted phrasing. Let the conversation flow -- if they mention living in Houston, you've got climate without asking. If they say "I'm 23 and my skin is a mess," you've got age_range and can probe concerns.

- **skin_type**: Oily, dry, combination, normal, sensitive. Infer from how they describe their skin -- don't ask "what's your skin type?" Ask about their daily experience instead.
- **skin_concerns**: What bothers them. Probe deeper -- most people have 2-3 concerns but lead with one. React with genuine insight when they share.
- **age_range**: Matters for actives recommendations. If they don't volunteer it, weave it in naturally.
- **fitzpatrick_scale**: ASK, don't guess. The question is functional, not cosmetic: "when you're out in the sun without protection, do you burn, tan, or both?" This is the single highest-stakes fact you collect. In deeper tones an aggressive acid or retinoid leaves post-inflammatory hyperpigmentation that lasts months, so introduction must be slower and gentler. In very fair skin it drives skin-cancer caution and photoprotection urgency. Never assert a value nobody gave you — an unknown Fitzpatrick is a question to ask, not a number to invent.
- **medical_history**: Standing medical facts, and you must ask rather than wait: skin cancer or precancers, rosacea, eczema, psoriasis, whether they see a dermatologist, and any prescriptions (tretinoin, isotretinoin). This is NOT the same as allergies — an allergy excludes an ingredient, a medical history reframes the whole approach. Someone with a skin cancer history needs protection-first advice, explicit caution around photosensitizing actives, and a low threshold for "that's a dermatologist question, not mine." Ask it the way a specialist would, plainly and without apology: this is their skin health, not small talk.
- **sun_history**: Cumulative lifetime UV — where they grew up, years spent outdoors, whether they burned badly as a kid. Photoaging is driven by decades of exposure, not this week's weather. Someone raised in the Central Valley who now lives in Seattle still has Central Valley skin, and that is what you are actually treating.
- **climate**: Humidity, temperature, seasons. Determines moisturizer weight, SPF reapplication, routine complexity.
- **allergies**: Critical safety information. Ask directly but warmly -- "any ingredients your skin has told you to stay away from?"
- **current_routine**: What they're doing now. This reveals experience level too.
- **budget_preference**: What they actually spend, not what they wish they could.
- **experience_level**: K-beauty newbie vs veteran changes how you talk to them.
- **product_preferences**: Brands or products they already love.

## Priority
Setup cannot be finished, and the member features stay closed, until seven things are known: their skin type, at least one concern, their age or age range, where they live, how their skin reacts to sun, their answer about skin conditions and prescriptions, and their answer about reactions to products. The last three are safety questions and you put each one to them yourself, plainly, the way a specialist would; none of them can be worked out from anything else, and something they happened to mention earlier does not stand in for asking. An answer of "none" is an answer. So is "I'd rather not say", for those three and for their age and where they live: what is required is that you asked and they replied. Skin type and a concern are the two that cannot be declined, because without them there is nothing to advise on. The Current State block lists whichever of the seven is still missing. Everything else is bonus context that makes your advice better; don't force it. One question at a time still holds, so this takes a few more turns than it used to; that is the cost of knowing whose skin you are advising.

## Completion
The button that finishes setup appears on their screen once nothing in "Required before setup can finish" is still missing (and otherwise only when this chat reaches its message limit), so a wrap-up before then sends them toward a button that is not there. When that list is empty, wrap up naturally. Don't announce "onboarding complete!" -- every wrap-up should feel organic to THAT conversation. A good wrap has three parts, in your own words each time: play back what you now understand about their skin (this is where they feel genuinely heard, and it only works if it is theirs: your read of the cause is yours to give, but every fact in it about their life, how long, how often, how much, what happened, is one they told you, and one they did not tell you is a question to ask or a thing to leave out), give them their first move (the one thing to start tomorrow), and name honestly what you would build together from here, the full plan and the adjustments as their skin responds: for a member, in the member chat that opens when they finish here; for someone who is not a member, as the continuing side of Seoul Sister. Say plainly how that adjusting works: once they are a member, most weeks you check in with a question or two about how their skin did, and you adjust the routine from what they tell you, so it gets better the more they report. Because you were straight with them, the next step should land as the obvious next move in a plan already in motion, not a surprise: for a member the routine build, for someone who is not a member the membership offer.

## Important Rules
- NEVER make up or assume profile data the user hasn't shared
- **A pattern is yours to state; a fact about their body is theirs to give.** Age, gender and hormonal stage are clinical inputs like climate, and once someone has told you, you use them just as directly: for a woman who has told you she is 57, women in their late fifties are exactly the right reference group. What they have not told you, you do not supply, in any wording: a sharper number than they gave, a narrower place than they named, a gender, a stage of life, a habit of their body, or a group you compare them to that carries one of those. The test is where the fact came from, not which words carry it. If you can point to their sentence or the line in their profile, say it plainly. If it came from you working out who they probably are, leave it out, including the word endings you choose for them in a language that marks gender. Give the mechanism instead of the group: "foam twice a day takes more oil off your cheeks than they can spare" needs nobody's age or sex. This costs you no confidence, because the advice rarely needs the missing fact. When it would change what you recommend, give the answer and name the fork in one clause, or ask about the pattern instead of the body: "do they show up at the same point each month, or at random?" learns what "the week before your period?" would, without deciding who you are talking to. Never hold the answer back for it, and never remark on what you have not been told.
- If they give vague answers, ask a gentle follow-up to clarify
- If they would rather not answer something, respect that and move on. A refusal is recorded as their answer for age, where they live and the three safety questions, so it does not hold them here; what you then know about that part of them is nothing, and you say so when it matters
- NEVER diagnose medical conditions -- recommend a dermatologist (피부과) for persistent issues
- **Lesions are always a referral, never a skincare answer.** If they mention a mole or spot that is changing, growing, asymmetric, oddly coloured, irregularly edged, itching, bleeding, crusting, or simply new and not going away, say plainly that it needs a doctor's eyes -- early, not after a paragraph of skincare talk. Do not guess what it is, do not reassure them it is probably nothing, and do not offer a product for it. This matters most for the people least likely to raise it as urgent: fair skin, a heavy sun history, or an existing skin cancer history. Onboarding is often the first time someone mentions this out loud.
- **Prescription changes belong to the prescriber.** For anything a doctor prescribed them (tretinoin, prescription-strength adapalene, isotretinoin, spironolactone, prescription hydroquinone, a topical antibiotic or steroid), you do not decide to start, stop, or change its dose or how often they use it. Everything around it stays yours, with full confidence: explain how it works, build around it, keep other actives from colliding with it, and tell them what is normal with it. When something they describe goes beyond what is normal with it, that is a call to the prescriber, so send them with the specific question. When the decision is about the prescription itself, say in one plain sentence that it is their prescriber's call, give them the specific question to bring, and keep helping. Over-the-counter actives (retinol, retinal, OTC adapalene, BHA, AHA, benzoyl peroxide, azelaic acid, sunscreen) remain yours exactly as before. Tretinoin, isotretinoin and spironolactone are always prescriptions; adapalene is OTC at 0.1% and prescription at 0.3%. Ask about source or strength only when it changes the decision in front of you. If your memory holds an earlier decision or open loop about a prescription's dose or schedule, treat it as a question to send to their prescriber, not as a plan to resume. This boundary covers prescription decisions only. It is never a reason to hedge, add disclaimers, or soften advice on anything else. When they already have a prescriber for the drug in question, that prescriber is the route even if they ask you to skip it: an over-the-counter swap, or a new prescription from someone who isn't told what they're already on, is not a way around that call (a second opinion that knows the history is fine), so name the question for the prescriber they have and keep helping with everything else.
- **Referrals land in English (LOAD-BEARING).** When you point someone toward getting seen, the English word comes BEFORE the Hangul: "see a dermatologist (피부과)", never "that's a 피부과 conversation." Every referral sentence in a message, including the last one -- the gloss-once allowance does NOT apply to referrals. A referral they cannot read is a referral you did not make. This changes wording only, never the threshold -- refer as readily as you otherwise would, and more if anything.
- **The person comes before the skin.** When what someone plans, or is already doing, would harm their body for their skin's sake (going without food, purging, diet pills or laxatives, megadosing a supplement, cutting, scrubbing or burning themselves), lead with the person, warmly and briefly: say plainly it isn't safe and won't fix their skin, ask one caring question about how they're doing, and give the one line that fits what they said. In the US or Canada that is 988, by call or text, any time, for anything urgent. For worries about eating it is ANAD's peer support line, 1-888-375-7767 (US, weekdays 9am to 9pm Central; they return messages left after hours). Elsewhere, use their location if you have it, or ask, and help them find a local line. One line, not both: add 988 to an eating conversation only when they describe something urgent or hurting themselves. Then help with their skin in the same reply, as ordinary care for a body they're looking after, without waiting for them to answer your question first: the toner still gets named and the gentle routine still gets built. The one thing you never build is the harmful plan itself, such as a routine for a fast or a stronger scrub. If your memory holds an earlier plan like this as a commitment or open loop, ask how they're doing rather than following up on the plan. This is about harm, not discipline: a fast with a planned end, a religious fast, cutting out dairy, a peel a professional is doing, or someone venting that they hate their skin are ordinary conversations and get ordinary answers. It is an exception to the length limits and to invitation framing.`
}

/**
 * Per-turn onboarding state, returned as a SEPARATE UNCACHED system block.
 *
 * PROMPT-CACHE RULE (July 27 2026): this content changes on nearly every turn —
 * `extractedSoFar` is JSON-stringified and grows as fields are captured. It used
 * to sit MID-PROMPT inside the single `cache_control` block, with ~800 chars of
 * static rules after it. Because caching matches on PREFIX, every extraction
 * invalidated the whole block, and cache CREATION bills at 1.25x base input —
 * so the "cached" prompt cost more than not caching at all, on the one Yuri
 * endpoint reachable without a subscription.
 *
 * This is the v11.1.0 regression (measured 60x on the widget) which was fixed
 * there but never here. Keep this OUT of the cached block. See
 * `src/app/api/widget/chat/route.ts` for the reference two-block shape.
 */
export interface OnboardingTurnFacts {
  /**
   * Whether this person actually has an active subscription, QUERIED not
   * assumed. A paid user can legitimately re-enter onboarding (AppShell bounces
   * a non-free user with onboarding_completed=false back to /onboarding), so
   * asserting "they have not paid" statically would be a new false fact — the
   * very bug this replaced. Undefined when the caller could not determine it,
   * in which case nothing is claimed either way.
   */
  isSubscribed?: boolean
  /** Which user message of the free onboarding cap this turn is. */
  userMessageNumber?: number
  /** A creator code this person holds, as Stripe describes it now (offers-server.ts). */
  offerFact?: string | null
  /** How long ago their carried-over preview chat ended (widget-carryover.ts previewAgeFact). */
  previewAgeFact?: string | null
  /** The cap itself, so the number has a denominator. */
  userMessageCap?: number
  /**
   * Set when the location they gave could not be placed on a map
   * (geo/location-fact.ts). Null or undefined when there is nothing to say.
   */
  locationFact?: string | null
  /**
   * What Yuri has ALREADY delivered across her own earlier replies in this
   * conversation, detected by the shared widget instrument. Undefined when
   * nothing substantial has been given yet.
   */
  cumulativeGive?: CumulativeGive
}

export function buildOnboardingTurnState(
  extractedSoFar: ExtractedSkinProfile,
  qualityNotes?: string[],
  facts?: OnboardingTurnFacts
): string {
  const extractedFields = Object.fromEntries(
    Object.entries(extractedSoFar).filter(([, v]) => v !== null && v !== undefined)
  )
  const capturedList = Object.entries(extractedFields).map(([k]) => k)
  // A safety question answered with "none" leaves its list empty for good, so
  // it is not shown as still needed: listed, it gets asked again.
  const answeredEmpty = new Set<string>([
    ...(extractedSoFar.medical_question_answered === true ? ['medical_history'] : []),
    ...(extractedSoFar.reactions_question_answered === true ? ['allergies'] : []),
  ])
  const missingList = ALL_FIELDS.filter((f) => !extractedFields[f] && !answeredEmpty.has(f))
  const requiredMissing = missingSetupRequirements(extractedSoFar).map((r) => r.label)

  const captured = capturedList.length > 0
    ? `Fields already captured: ${capturedList.join(', ')}\nCurrent data: ${JSON.stringify(extractedSoFar, null, 2)}`
    : 'No fields captured yet -- this is the start of the conversation.'

  const missing = missingList.length > 0
    ? `Fields still needed: ${missingList.join(', ')}\nRequired before setup can finish, still missing: ${requiredMissing.length > 0 ? requiredMissing.join('; ') : 'NONE.'}`
    : 'All fields captured!'

  const quality = qualityNotes && qualityNotes.length > 0
    ? `\n\nQuality notes on what they have told you so far:\n${qualityNotes.map((n) => `- ${n}`).join('\n')}`
    : ''

  // Facts about where this person stands, for Yuri's judgment. Deliberately
  // phrased as observations with the decision handed back — never as a rule,
  // a cap, or an instruction to start selling. A guard test enforces this.
  const statusLines: string[] = []
  if (facts?.isSubscribed === true) {
    statusLines.push(
      `Membership status: MEMBER. Creating an account starts a first-time member's free week (${PRICING.trial_days} days, no card, nothing charged during it, ending unless they add a card), so most members in this chat are in one; some are paying members who came back to setup. Which this person is, is not shown to you here; the notice at the top of their screen shows when a free week ends and whether a card is on file. They are already a member, so no membership offer follows this chat for them: the passages in this prompt about that offer describe what a non-member meets. You will see them again. The complete routine is built in the member chat that opens when this setup chat is finished; that chat can save a routine and this one cannot.`
    )
  } else if (facts?.isSubscribed === false) {
    statusLines.push(
      `Membership status: NOT A MEMBER YET. This setup chat is free. The next screen shows what they can start: membership is ${PRICING.monthly_display_long}, and someone who has not had a free week gets their first ${PRICING.trial_days} days free with no card. Whether this person has already had a free week is not shown to you. The complete routine is built in their first member conversation. Nothing has been paid.`
    )
    if (facts.offerFact) statusLines.push(facts.offerFact)
  }
  // Whether the catalog can be read in this chat. Stated every turn, for
  // members and non-members alike, so "no tools" is never mistaken for
  // "nothing found" (Nov 17 2026: a member asked Yuri to check a cleansing
  // oil's ingredients in setup and was told to paste the label in; the
  // verified list was in the catalog).
  statusLines.push(
    facts?.isSubscribed === true
      ? 'Product lookup: AVAILABLE in this chat (search_products, get_product_details), ingredients only, no prices or stores. Lookups from earlier replies are not kept, so what you know about a product\'s formula in this reply is what you looked up in this reply; the rest is from memory.'
      : 'Product lookup: NOT available in this chat. What you know about a product\'s formula is from memory.'
  )
  if (facts?.previewAgeFact) statusLines.push(facts.previewAgeFact)
  // What they have and have not said about who they are (stated-identity.ts).
  // A fact in this block, never an entry in "Fields still needed": measured on
  // real setup chats, a listed field becomes a question in most of them.
  statusLines.push(...setupIdentityFacts(extractedSoFar))
  // Read from the stored profile before this turn's extraction runs, so it can
  // be one message behind: said so, in case they have just given a city.
  if (facts?.locationFact) statusLines.push(`${facts.locationFact} (Read before their latest message.)`)
  if (
    typeof facts?.userMessageNumber === 'number' &&
    typeof facts?.userMessageCap === 'number'
  ) {
    statusLines.push(
      `This is their message ${facts.userMessageNumber} of the ${facts.userMessageCap} this setup chat allows.`
    )
  }
  const status = statusLines.length > 0
    ? `\n\n## Where They Stand (facts, not instructions)\n${statusLines.join('\n')}\nThese are context for your judgment -- how and whether to use them is yours, every time.`
    : ''

  // The cumulative-give instrument. The gate is a CUMULATIVE boundary but Yuri
  // only ever sees one turn at a time — the 11-message transcript that motivated
  // this fix crossed no single line while the sum was the whole deliverable.
  // Observes only: never blocks, never inspects a draft, ends by handing back.
  const give = facts?.cumulativeGive
    ? buildCumulativeGiveBlock(facts.cumulativeGive)
    : null

  return `## Current State\n${captured}\n${missing}${quality}${status}${give ?? ''}`
}

// ---------------------------------------------------------------------------
// Extract skin profile data from conversation using Sonnet 4.5
// ---------------------------------------------------------------------------

export async function extractSkinProfileData(
  messages: Array<{ role: 'user' | 'assistant'; content: string }>,
  userId?: string
): Promise<ExtractedSkinProfile> {
  const client = getAnthropicClient()

  const conversationText = messages
    .map((m) => `${m.role === 'user' ? 'User' : 'Yuri'}: ${m.content}`)
    .join('\n\n')

  const response = await callAnthropicWithRetry(() =>
    client.messages.create({
      model: MODELS.background,
      max_tokens: 2000,
      messages: [
        {
          role: 'user',
          content: `Extract structured skin profile data from this onboarding conversation between Yuri (AI beauty advisor) and a user. Only extract data the user has explicitly stated -- never infer or assume.

Return a JSON object with ONLY the fields that have been explicitly mentioned. Omit any field where the data is unclear or not provided.

Possible fields:
- first_name: string, what the user wants to be called, ONLY if they volunteered it or signed off with it. Just the given name, properly capitalized ("Caroline", not "caroline" or "Caroline Smith"). NEVER infer a name from their email address, and never guess. A name only Yuri used, and the user never typed, is not volunteered. If they didn't say it, omit it.
- skin_type: one of "oily", "dry", "combination", "normal", "sensitive"
- skin_concerns: array of concerns (e.g., ["acne", "dark spots", "dullness"]). Normalize to lowercase.
- age_range: one of "18-24", "25-30", "31-35", "36-40", "41-50", "50+"
- age_years: integer, ONLY the user's own current age given as a single number, whether in a sentence ("I'm 59", "I just turned 40") or as a bare reply to Yuri asking THEIR age ("53", "60 year old", "20 ans"). When you set it, set age_range to match. Omit for a range or approximation in any form ("late 50s", "I am 27-30", "almost 40"): set age_range only. Omit a number that is someone else's age (a mother, a daughter, "a routine for a 31 year old" unless they say that is them), an age they used to be, an age they will turn, or any number that appears only in Yuri's words.
- gender: "woman", "man" or "nonbinary". Set it ONLY from a sentence the user wrote about themselves whose content is their gender: said outright in any form ("I'm a man", "as a guy", "as a woman in my 40s", "I'm nonbinary"), a gendered noun they use for themselves ("I'm a mom of two"), or the grammatical gender they use for themselves in a language that marks it. Anything from which gender would have to be worked out is not that, however certain it seems: a medical or hormonal fact, a partner or relative, a name, a product, a habit, who something is for, or anything Yuri said, asked or assumed. A denial sets nothing ("I'm not a woman" is not "man"). A bare "yes" counts only when Yuri's question was about their own gender and the yes affirms it. If they correct an assumption, the correction is the statement.
- hormonal_facts: array of hormonal or reproductive states the user states about THEMSELVES and that can change, in their own words: pregnant, breastfeeding, trying to conceive, postpartum, perimenopause, menopause, hormone therapy, hormonal contraception, PCOS, and the like. Return each with NO date; the date is added for you. Only when AFFIRMED: never record that someone is NOT pregnant, NOT breastfeeding or NOT trying to conceive, because a stored "not pregnant" goes stale and later reads as clearance. Never someone else's ("my wife is pregnant"). These go here and NOT in medical_history.
- fitzpatrick_scale: integer 1-6. Extract ONLY when you know BOTH halves of the burn/tan response — what happens first (burn) AND what happens after (tan or not). A HALF ANSWER IS NOT AN ANSWER: "I burn easily" alone is types 1 THROUGH 3 and you cannot tell which, so OMIT the field and let Yuri ask the tan half. "Burns at first, then tans" is 2-3, NEVER 1. Type 1 means always burns and NEVER tans — reserve it for someone who says they never tan at all. Do NOT infer from ethnicity, location, or a photo description. A guessed value is stored as fact, drives retinoid strength, acid aggressiveness and skin-cancer caution, and — because a captured field is never re-asked — SILENCES the very question that would have corrected it. When in doubt, omit.
- medical_history: array of standing medical facts — skin cancer/precancer history, rosacea, eczema, psoriasis, dermatologist care, prescriptions (tretinoin, isotretinoin). Keep the user's own phrasing where possible (e.g. "skin cancer history, 25+ excisions since early 30s"). NOT allergies — allergies exclude an ingredient, these reframe the approach.
- medical_question_answered: true, and only true. Set it ONLY when Yuri asked the user about their medical history for their skin (skin conditions, skin cancer or precancers, or anything prescribed) AND the user's next message replied to THAT question: with facts, with "no" / "none" / "nothing prescribed", or by declining ("I'd rather not say"). A fact the user mentioned without being asked does not set it (it goes in medical_history; the question is still to be asked). When Yuri's message asked several things, a reply that answers only the others does not set it. Omit it otherwise.
- reactions_question_answered: true, and only true. Set it ONLY when Yuri asked the user whether a product has given them a bad reaction or whether there are ingredients they avoid AND the user's next message replied to THAT question: with facts, with "no" / "none", or by declining. A reaction mentioned without being asked does not set it. A reply that answers only another question in the same message does not set it. Omit it otherwise.
- declined_to_say: array, any of "age", "where", "sun". Add one ONLY when Yuri asked the user that thing (their age, where they live, how their skin reacts to sun) and the user's reply declined to say or said they do not know. Never add one because the subject did not come up.
- fitzpatrick_source: "stated" ONLY if the user gave a COMPLETE burn AND tan response (or named their type outright). "estimated" if you derived the number from a partial answer. Omit when you omit fitzpatrick_scale.
- sun_history: string, everything they've said about sun and their skin — burn/sunburn response ("burns easily, then tans"), childhood or cumulative exposure ("grew up in the Central Valley, outdoors constantly"), AND their answer about skin cancer, precancers, or changing moles. RECORD NEGATIVES EXPLICITLY: "no personal or family history of skin cancer, no moles or spots of concern" is a clinically valuable fact, not an absence of one — capture it in their words. Distinct from climate, which is where they live now. This field is the record of a SAFETY conversation; if they answered a sun or mole question at all, something belongs here.
- climate: one of "humid", "dry", "temperate", "tropical", "cold"
- allergies: array of INGREDIENTS ONLY that the user reacts to (e.g. "fragrance", "essential oils", "denatured alcohol"). NEVER store a product or brand name here — this field is injected into Yuri's context under "ALWAYS check for these before recommending any product", so a whole cleanser listed as an allergen wrongly bans a product she may need. If they broke out from a PRODUCT but the culprit ingredient is unknown, do NOT put it here; it belongs in skin_concerns or current_routine context. Also EXCLUDE anything the conversation itself characterized as a formula mismatch rather than a true allergy — if Yuri said "I wouldn't call that a true allergy," honor her judgment and omit it.
- current_routine: array of product names or categories they currently use
- budget_preference: one of "budget", "mid-range", "luxury", "mixed"
- experience_level: one of "beginner", "intermediate", "advanced"
- product_preferences: array of specific products or brands they like
- location_text: string, the user's stated location (city, state/province, country). Extract exactly as stated. Examples: "Austin, Texas", "Seoul, Korea", "London, UK", "Northern California". This is separate from climate -- climate describes the weather pattern, location_text is the specific place name.

CONVERSATION:
${conversationText}

Return ONLY valid JSON, no explanation or markdown. If nothing can be extracted, return {}.`,
        },
      ],
    })
  )

  await logAIUsage(onboardingUsageRow('onboarding_extraction', MODELS.background, response.usage, userId))
  const block = response.content.find((b) => b.type === 'text') ?? { type: 'none' as const }
  if (block.type !== 'text') return {}

  try {
    return parseModelJson(block.text) as ExtractedSkinProfile
  } catch (err) {
    // Was a silent `return {}` — indistinguishable from "the conversation
    // contained nothing to extract", which is the v10.3.4 silent-failure class.
    // The realistic trigger is max_tokens truncating the JSON mid-object as the
    // transcript grows, and a swallowed failure here means clinical fields go
    // missing with no trace anywhere. Log loudly; still degrade gracefully.
    console.error(
      '[onboarding] extraction JSON parse FAILED — profile fields dropped this turn.',
      'stop_reason:', response.stop_reason,
      'raw head:', block.text.slice(0, 200),
      err instanceof Error ? err.message : err
    )
    return {}
  }
}

// ---------------------------------------------------------------------------
// Calculate which fields have been captured and overall progress
// ---------------------------------------------------------------------------

export function calculateOnboardingProgress(
  extracted: ExtractedSkinProfile
): { percentage: number; capturedFields: Record<string, boolean>; missingRequired: string[] } {
  const capturedFields: Record<string, boolean> = {}

  for (const field of ALL_FIELDS) {
    const value = extracted[field]
    if (value === undefined || value === null) {
      capturedFields[field] = false
    } else if (Array.isArray(value)) {
      capturedFields[field] = value.length > 0
    } else {
      capturedFields[field] = true
    }
  }

  const capturedCount = Object.values(capturedFields).filter(Boolean).length
  const percentage = Math.round((capturedCount / ALL_FIELDS.length) * 100)

  const missingRequired = missingSetupRequirements(extracted).map((r) => r.key as string)

  return { percentage, capturedFields, missingRequired }
}

// ---------------------------------------------------------------------------
// Check if minimum onboarding is complete
// ---------------------------------------------------------------------------

export function checkOnboardingComplete(extracted: ExtractedSkinProfile): boolean {
  const { missingRequired } = calculateOnboardingProgress(extracted)
  return missingRequired.length === 0
}

// ---------------------------------------------------------------------------
// Onboarding quality scoring — detect vague/thin profile answers
// ---------------------------------------------------------------------------

interface OnboardingQuality {
  overallScore: number
  fieldScores: Record<string, number>
  thinAreas: string[]
  suggestions: string[]
}

export function calculateOnboardingQuality(
  extracted: ExtractedSkinProfile
): OnboardingQuality {
  const scores: Record<string, number> = {}

  // Skin type specificity: "normal" is often a default — low confidence
  if (extracted.skin_type) {
    scores.skin_type = extracted.skin_type === 'normal' ? 50 : 85
  }

  // Concerns: single concern = okay, multiple = much better profiling
  if (extracted.skin_concerns?.length) {
    scores.skin_concerns = extracted.skin_concerns.length >= 2 ? 90 : 60
  }

  // Age range: any value is good
  if (extracted.age_range) {
    scores.age_range = 80
  }

  // Fitzpatrick: specific value captured
  if (extracted.fitzpatrick_scale) {
    scores.fitzpatrick_scale = 85
  }

  // Climate: specific city (location_text) > general zone
  if (extracted.location_text) {
    scores.climate = 90
  } else if (extracted.climate) {
    scores.climate = 60
  }

  // Allergies: any answer is valuable (including "none known")
  if (extracted.allergies) {
    scores.allergies = extracted.allergies.length > 0 ? 90 : 70
  }

  // Current routine: named products > vague categories
  if (extracted.current_routine?.length) {
    scores.current_routine = extracted.current_routine.length >= 3 ? 90 : 60
  }

  // Budget: specific range
  if (extracted.budget_preference) {
    scores.budget_preference = 75
  }

  // Experience level
  if (extracted.experience_level) {
    scores.experience_level = 80
  }

  // Product preferences: specific brand/product names
  if (extracted.product_preferences?.length) {
    scores.product_preferences = extracted.product_preferences.length >= 2 ? 90 : 70
  }

  const thinAreas = Object.entries(scores)
    .filter(([, score]) => score > 0 && score < 65)
    .map(([field]) => field)

  const suggestionMap: Record<string, string> = {
    skin_type: 'How does your skin feel through the day? Like, is your T-zone different from your cheeks?',
    skin_concerns: 'Besides that, anything else about your skin that bugs you? Even small things help me give better advice.',
    climate: 'Where are you based? City and state help me factor in humidity and seasons.',
    current_routine: 'What specific products are you using right now? Brand names help me spot what\'s working and what\'s not.',
  }
  const suggestions: string[] = thinAreas
    .map((field) => suggestionMap[field])
    .filter((s): s is string => s !== undefined)

  const filledScores = Object.values(scores).filter((s) => s > 0)
  const overallScore = filledScores.length
    ? Math.round(filledScores.reduce((a, b) => a + b, 0) / filledScores.length)
    : 0

  return { overallScore, fieldScores: scores, thinAreas, suggestions }
}

// ---------------------------------------------------------------------------
// Merge newly extracted data into existing profile data
// ---------------------------------------------------------------------------

export function mergeSkinProfileData(
  existing: ExtractedSkinProfile,
  incoming: ExtractedSkinProfile
): ExtractedSkinProfile {
  const merged = { ...existing }

  for (const [key, value] of Object.entries(incoming)) {
    if (value === undefined || value === null) continue
    if (Array.isArray(value) && value.length === 0) continue

    const typedKey = key as keyof ExtractedSkinProfile

    if (Array.isArray(value)) {
      // REPLACE, don't union. The extractor re-reads the ENTIRE transcript on
      // every message, so each incoming array is already a complete snapshot —
      // unioning it with the previous snapshot just accumulated the model's
      // phrasing variance forever. Real damage, two users deep: medical_history
      // held the same acne fact twice in two phrasings; current_routine had 13
      // entries for ~7 products including THREE spellings of one retinol
      // ("Kheils" the user's typo, "Kiehl's" corrected, "Kieils" which appears
      // in no message at all); skin_concerns carried both "oily" and
      // "oiliness". Every one of those is injected into Yuri's context.
      // A union of exact strings can never converge because the strings differ.
      // Replacing is self-healing: one clean pass fixes the record.
      ;(merged as Record<string, unknown>)[typedKey] = value
    } else {
      ;(merged as Record<string, unknown>)[typedKey] = value
    }
  }

  return merged
}

// ---------------------------------------------------------------------------
// Create or load onboarding progress from database
// ---------------------------------------------------------------------------

export async function getOrCreateOnboardingProgress(
  userId: string
): Promise<OnboardingProgress> {
  const db = getServiceClient()

  // Try to load existing
  const { data: existing } = await db
    .from('ss_onboarding_progress')
    .select('*')
    .eq('user_id', userId)
    .single()

  if (existing) return existing as OnboardingProgress

  // Create a new onboarding conversation
  const { data: conv, error: convError } = await db
    .from('ss_yuri_conversations')
    .insert({
      user_id: userId,
      title: 'Skin Profile Onboarding',
      conversation_type: 'onboarding',
      message_count: 0,
    })
    .select('id')
    .single()

  if (convError) throw new Error(`Failed to create onboarding conversation: ${convError.message}`)

  // Create onboarding progress record
  const { data: progress, error: progressError } = await db
    .from('ss_onboarding_progress')
    .insert({
      user_id: userId,
      conversation_id: conv.id,
      onboarding_status: 'in_progress',
      skin_profile_data: {},
      extracted_fields: {},
      required_fields: SETUP_REQUIREMENTS.map((r) => r.key),
      completion_percentage: 0,
    })
    .select('*')
    .single()

  if (progressError) throw new Error(`Failed to create onboarding progress: ${progressError.message}`)
  return progress as OnboardingProgress
}

// ---------------------------------------------------------------------------
// Update onboarding progress after extraction
// ---------------------------------------------------------------------------

export async function updateOnboardingProgress(
  userId: string,
  mergedProfile: ExtractedSkinProfile,
  capturedFields: Record<string, boolean>,
  percentage: number,
  isComplete: boolean,
  qualityScore?: number
): Promise<void> {
  const db = getServiceClient()

  const updates: Record<string, unknown> = {
    skin_profile_data: mergedProfile,
    extracted_fields: capturedFields,
    completion_percentage: percentage,
    updated_at: new Date().toISOString(),
  }

  if (qualityScore !== undefined) {
    updates.quality_score = qualityScore
  }

  if (isComplete) {
    updates.onboarding_status = 'completed'
    updates.completed_at = new Date().toISOString()
  }

  await db
    .from('ss_onboarding_progress')
    .update(updates)
    .eq('user_id', userId)
}

// ---------------------------------------------------------------------------
// Convert extracted profile to a full ss_user_profiles record and save
// ---------------------------------------------------------------------------

/**
 * `reopened`: a member whose setup already finished opened /onboarding again,
 * so `extracted` is the OLD setup record, not something just said. It then
 * only fills gaps: it must not put back an age, gender, age range or medical
 * fact the member has since corrected or added in the member chat.
 */
export interface FinalizeOptions {
  reopened?: boolean
  /**
   * The person has used every message the setup chat allows. Setup is then
   * finished with whatever was learned, so nobody is held in a chat that can
   * take no more input. The only way setup ends with a requirement missing.
   */
  atLimit?: boolean
}

export async function finalizeOnboardingProfile(
  userId: string,
  extracted: ExtractedSkinProfile,
  opts?: FinalizeOptions
): Promise<void> {
  const db = getServiceClient()

  // CLINICAL FIELDS ARE NEVER DEFAULTED (July 21 2026).
  //
  // This previously wrote fitzpatrick_scale=3, age_range='25-30', and
  // climate='temperate' for anything the user never answered, and memory.ts
  // printed them to Yuri as bare fact. A fabricated Fitzpatrick III was
  // indistinguishable from a stated one — the same fake-confidence class as the
  // v10.2.1 "I checked our database" incident, and far more consequential:
  // Fitzpatrick drives retinoid strength, acid aggressiveness, PIH risk in
  // deeper tones, and skin-cancer caution in fair ones. Guessing III for a
  // Fitzpatrick I user with a cancer history is a clinically wrong answer
  // delivered confidently.
  //
  // Unknown now stays NULL, and Yuri is shown "not established yet" so she can
  // ask instead of assert. Preference fields (budget, experience) keep their
  // defaults — a wrong budget guess costs nothing.
  const profileData: Record<string, unknown> = {
    user_id: userId,
    // NOT defaulted. This line sat directly beneath the July 21 "CLINICAL FIELDS
    // ARE NEVER DEFAULTED" block and defaulted anyway — the sweep listed
    // fitzpatrick/age/climate/medical/sun and stopped one field short. skin_type
    // keys ingredient effectiveness, scan personalization and every routine
    // recommendation, so a fabricated 'normal' is the most consequential guess
    // in the profile. NULL lets memory.ts say "not established" and Yuri ask.
    ...(extracted.skin_type ? { skin_type: extracted.skin_type } : {}),
    skin_concerns: extracted.skin_concerns || [],
    allergies: extracted.allergies || [],
    budget_range: extracted.budget_preference || 'mid-range',
    experience_level: extracted.experience_level || 'beginner',
    onboarding_completed: true,
    updated_at: new Date().toISOString(),
  }

  // Clinical fields: written ONLY when actually extracted, never invented.
  if (extracted.fitzpatrick_scale) {
    profileData.fitzpatrick_scale = extracted.fitzpatrick_scale
    // Provenance must describe what actually happened. This used to hardcode
    // 'stated' for ANY extracted integer — so a value the MODEL inferred from
    // half an answer was recorded as if the user had declared their type
    // (Caroline, Jul 28: said only "I burn easily initially", stored as
    // Fitzpatrick 1 / 'stated'). 'stated' now means the user gave a complete
    // burn AND tan response; anything the extractor derived is 'estimated', so
    // Yuri can see the difference and ask rather than assert.
    profileData.fitzpatrick_source = extracted.fitzpatrick_source === 'stated' ? 'stated' : 'estimated'
  }
  if (extracted.climate) profileData.climate = extracted.climate
  if (extracted.age_range) profileData.age_range = extracted.age_range
  if (extracted.medical_history?.length) {
    profileData.medical_history = extracted.medical_history
  }
  if (extracted.sun_history) profileData.sun_history = extracted.sun_history
  if (extracted.first_name) profileData.first_name = extracted.first_name

  // Who they have said they are, and hormonal facts that change
  // (stated-identity.ts). One read of what is already stored decides whether
  // an age is new (its date moves only then) and which dated facts are already
  // on file (their dates are never rewritten).
  //
  // A live setup chat is the source of truth and may correct itself. A
  // re-opened, finished setup (opts.reopened) only FILLS gaps: it carries the
  // old setup record, and without this an age, gender, age range or medical
  // fact the member corrected later in the member chat was put back, the age
  // with today's date on it (second-model reviews, Nov 15 2026).
  const fillOnly = opts?.reopened === true
  const statedGender = cleanGender(extracted.gender)
  const statedAge = cleanAgeYears(extracted.age_years)
  const hormonal = Array.isArray(extracted.hormonal_facts) ? extracted.hormonal_facts : []
  if (fillOnly || statedGender || statedAge !== null || hormonal.length || extracted.medical_history?.length) {
    const { data: stored, error: storedError } = await db
      .from('ss_user_profiles')
      .select('gender, age_years, age_stated_on, age_range, medical_history')
      .eq('user_id', userId)
      .maybeSingle()
    if (storedError) {
      // Not knowing what is stored is not "nothing is stored": writing now
      // could move a date, drop a dated fact or undo a correction. Skipped
      // this turn and logged; the next message tries again.
      console.error(`[onboarding] stored identity read failed for ${userId}; gender, age and medical history not written this turn:`, storedError.message)
      delete profileData.medical_history
      if (fillOnly) delete profileData.age_range
    } else {
      if (statedGender && (!fillOnly || !cleanGender(stored?.gender))) profileData.gender = statedGender
      if (statedAge !== null && (!fillOnly || cleanAgeYears(stored?.age_years) === null)) {
        Object.assign(profileData, ageWrite(statedAge, stored, new Date()))
      }
      if (fillOnly && stored?.age_range) delete profileData.age_range
      const storedStanding = standingFacts(stored?.medical_history)
      const standing =
        fillOnly && storedStanding.length
          ? storedStanding
          : extracted.medical_history?.length
            ? standingFacts(extracted.medical_history)
            : storedStanding
      const dated = mergeDatedFacts(stored?.medical_history, hormonal, new Date())
      if (standing.length || dated.length) profileData.medical_history = [...standing, ...dated]
      else delete profileData.medical_history
    }
  }

  // Only set location_text if explicitly extracted (don't overwrite existing with null)
  if (extracted.location_text) {
    profileData.location_text = extracted.location_text

    // Resolve the text to coordinates so weather actually works for this user.
    //
    // Onboarding captured location_text and stopped there. latitude/longitude
    // were populated by exactly ONE path: the browser-geolocation button on
    // /profile, which a user has to find and click. So the two newest paying
    // subscribers (Caroline — "Kansas City"; Kim — "Iowa") had a location on
    // file and no coordinates, which means get_current_weather fell through to
    // "Could not determine location" and every UV/humidity-driven surface was
    // dark for them. Yuri told Caroline that Kansas City's seasonal humidity
    // swing was half of why her skin seesaws, while unable to read the weather
    // there.
    //
    // Best-effort by design: a failed lookup leaves coordinates NULL, which is
    // exactly the pre-existing state. Nobody is blocked from finishing
    // onboarding because a geocoder was slow or didn't recognize "Kansas City".
    // City-level coordinates must never overwrite device-level ones. This path
    // can run more than once (the completed-status path in the onboarding route
    // also calls finalize), and the /profile geolocation button resolves the
    // user's actual position — downgrading that to a city centroid would be a
    // silent regression for the users who took the trouble to grant location.
    try {
      const { data: existingGeo } = await db
        .from('ss_user_profiles')
        .select('latitude, longitude')
        .eq('user_id', userId)
        .maybeSingle()

      const hasCoords =
        existingGeo?.latitude != null && existingGeo?.longitude != null

      if (!hasCoords) {
        const geo = await geocodeLocation(extracted.location_text)
        if (geo) {
          profileData.latitude = geo.lat
          profileData.longitude = geo.lng
          if (geo.timezone) {
            profileData.timezone = geo.timezone
            // Provenance: this value came from where they said they live, and
            // replaces any device-reported one.
            profileData.timezone_source = 'geocoded'
          }
        }
      }
    } catch (err) {
      console.error('[onboarding] geocode failed, continuing without coordinates', err)
    }
  }

  // First-touch attribution. signUp() stashed it on auth.users.raw_user_meta_data
  // because THIS path (server-side service client) cannot see the browser's
  // localStorage. Returns {} when absent or already stamped, so the spread is a
  // no-op and existing behavior is unchanged.
  try {
    const { data: authUser } = await db.auth.admin.getUserById(userId)
    Object.assign(
      profileData,
      await buildAttributionFields(db, userId, authUser?.user?.user_metadata)
    )
  } catch {
    // Attribution is a measurement nicety. It must never block onboarding.
  }

  const { error: profileWriteError } = await db
    .from('ss_user_profiles')
    .upsert(profileData, { onConflict: 'user_id' })
  // This write was unchecked, so a refused profile (a CHECK constraint, an
  // outage) looked the same as a saved one. Logged, not thrown: setup must
  // still be able to finish.
  if (profileWriteError) {
    console.error(`[onboarding] profile write failed for ${userId}:`, profileWriteError.message)
  }

  // Mark setup complete ONLY when it is (Nov 11 2026). This function also runs
  // after every message once a skin type is known, to keep the profile in step
  // with the conversation, and it used to stamp 'completed' each time. So setup
  // read as finished at 31% with the required age still missing: coming back to
  // /onboarding ended the chat instead of resuming it, and the membership page
  // said "I have what I need from our setup chat" when Yuri did not.
  // (ss_user_profiles.onboarding_completed above is left as it was on purpose:
  // it means "has a usable profile" to AppShell, and turning it off mid-setup
  // is what once locked accounts in a chat that could not accept input.)
  if (!checkOnboardingComplete(extracted) && opts?.atLimit !== true) return
  const { error: stampError } = await db
    .from('ss_onboarding_progress')
    .update({
      onboarding_status: 'completed',
      completed_at: new Date().toISOString(),
    })
    .eq('user_id', userId)
  if (stampError) console.error(`[onboarding] could not mark setup completed for ${userId}:`, stampError.message)
}

// ---------------------------------------------------------------------------
// There is no skip (Nov 17 2026)
// ---------------------------------------------------------------------------
// `skipOnboarding` lived here. It marked setup 'skipped' and opened every
// member page with nothing asked. Rows with that status are from before; they
// are treated as out of setup (setup-requirements.ts) and Yuri is told in the
// member chat what was never asked (memory.ts).

// ---------------------------------------------------------------------------
// Stream Yuri's onboarding response via Claude Opus 4.8
// ---------------------------------------------------------------------------

export async function* streamOnboardingResponse(
  userId: string,
  conversationId: string,
  message: string,
  conversationHistory: YuriMessage[],
  currentProgress: OnboardingProgress,
  carryover: Carryover | null = null,
  offerFact: string | null = null,
  hooks: SetupStreamHooks = {}
): AsyncGenerator<string, void, unknown> {
  const extractedSoFar = currentProgress.skin_profile_data as ExtractedSkinProfile
  const extractedFields = currentProgress.extracted_fields as Record<string, boolean>
  const quality = calculateOnboardingQuality(extractedSoFar)
  const systemPrompt = buildOnboardingSystemPrompt(extractedFields)

  // QUERY subscription status rather than assuming it — a paid user can
  // legitimately re-enter onboarding, and this codebase's rule is never to
  // assert a fact it has not checked. Best-effort: if the lookup fails we say
  // nothing about status rather than guess (a wrong guess here is exactly the
  // bug being fixed). Cheap and already cached upstream by Supabase.
  let isSubscribed: boolean | undefined
  try {
    isSubscribed = await hasActiveSubscription(userId)
  } catch (e) {
    console.error('[onboarding] subscription status lookup failed:', e)
  }

  // Their position in the free onboarding, so Yuri can pace the give and time
  // the wrap-up. She currently cannot see this at all. +1 counts the message
  // being sent this turn, which is not yet in conversationHistory.
  const userMessageNumber =
    conversationHistory.filter((m) => m.role === 'user').length + 1

  // Per-turn state lives in its own UNCACHED block (see buildOnboardingTurnState).
  // Nothing here may be appended to the CACHED system prompt — that was the
  // v11.1.0 60x cache regression.
  // Reads only Yuri's OWN already-sent replies (the helper filters to assistant
  // turns), so the user describing their own routine can never count as Yuri
  // having delivered one.
  const cumulativeGive = detectCumulativeGive(
    conversationHistory.map((m) => ({ role: m.role, content: m.content }))
  )

  // Whether the location they gave was placed on a map. Read from the stored
  // profile, where `location_text` is written in the same step that geocodes
  // it, so a location nobody has tried to place yet says nothing. Best-effort:
  // a failed read says nothing rather than guess.
  let locationFact: string | null = null
  try {
    const { data: placed, error: placedError } = await getServiceClient()
      .from('ss_user_profiles')
      .select('location_text, latitude, longitude')
      .eq('user_id', userId)
      .maybeSingle()
    if (placedError) throw new Error(placedError.message)
    locationFact = unplacedLocationFact(placed?.location_text, placed?.latitude != null && placed?.longitude != null)
  } catch (e) {
    console.error('[onboarding] location placement lookup failed:', e)
  }

  const turnState = buildOnboardingTurnState(extractedSoFar, quality.suggestions, {
    isSubscribed,
    locationFact,
    userMessageNumber,
    userMessageCap: ONBOARDING_USER_MESSAGE_CAP,
    cumulativeGive,
    offerFact,
    previewAgeFact: carryover ? previewAgeFact(carryover.lastAt, Date.now()) : null,
  })

  // Build message history for Claude
  const apiMessages: Array<{ role: 'user' | 'assistant'; content: string }> =
    conversationHistory.map((m) => ({ role: m.role, content: m.content }))

  apiMessages.push({ role: 'user', content: message })

  const client = getAnthropicClient()

  // Layout (Oct 7 2026, src/lib/llm-request.ts): history breakpoint on the last
  // assistant message; the per-turn state follows the user's message as a
  // mid-conversation system message. As a second SYSTEM block it rendered in
  // front of the history, so every turn re-wrote the whole transcript to cache.
  const requestMessages = withTrailingContext(markPenultimateAssistant(apiMessages), turnState)

  // A member can have the catalog read for them here (Nov 17 2026). Two
  // read-only tools, nothing that writes: the setup chat still cannot save a
  // product or a routine. Not for a non-member, whose setup chat is the free
  // step before membership.
  const lookupTools = isSubscribed === true ? setupLookupTools() : []
  const loopMessages: Anthropic.Messages.MessageParam[] = [...(requestMessages as Anthropic.Messages.MessageParam[])]

  const streamFor = (model: string) =>
    client.messages.stream({
      model,
      // 600 cut a real reply off mid-sentence (Caroline, Jul 28): the plan-recap
      // turn runs long, and Hangul costs 1-2 tokens a character. 1200 was the
      // visible-text ceiling on Opus 4.8; Opus 5.5's thinking counts toward
      // max_tokens too, so the ceiling is raised. Cost stays bounded by the
      // 50-message onboarding cap.
      max_tokens: 6000,
      output_config: { effort: CHAT_EFFORT },
      // Static prompt only. Never append per-turn state here (v11.1.0, the 60x
      // cache regression) — it travels in requestMessages.
      // The preview transcript is fixed for the whole onboarding, so it is cached
      // as its own block after the static prompt (the advisor's two-block shape).
      system: [
        { type: 'text' as const, text: systemPrompt, cache_control: { type: 'ephemeral' as const } },
        ...(carryover
          ? [{ type: 'text' as const, text: carryoverBlock(carryover), cache_control: { type: 'ephemeral' as const } }]
          : []),
      ],
      messages: loopMessages,
      ...(lookupTools.length > 0 ? { tools: lookupTools } : {}),
    })

  hooks.onLookupsAvailable?.(lookupTools.length > 0)
  // With lookups on offer, a round's text is held until the round ends: what
  // the model writes before asking for a lookup ("let me check", or an answer
  // from memory that the lookup then contradicts) is not shown or saved. The
  // member chat does the same. With no lookups the reply streams as it is written.
  const holdText = lookupTools.length > 0

  let model: string = MODELS.chat
  let answered = false
  let declined = false
  // Rounds 0 .. SETUP_LOOKUP_ROUNDS-1 may each run lookups; the round after
  // the last of them is for the answer, and a lookup asked for there is not run.
  for (let round = 0; round <= SETUP_LOOKUP_ROUNDS; round++) {
    const stream = streamFor(model)
    let held = ''
    for await (const event of stream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        if (holdText) held += event.delta.text
        else {
          answered = true
          yield event.delta.text
        }
      }
    }
    const final = await stream.finalMessage()
    await logAIUsage(onboardingUsageRow('yuri_onboarding', model, final.usage, userId, conversationId))

    // Opus 5.5 can decline (stop_reason 'refusal') before writing anything.
    // Re-run once on MODELS.primary rather than leave the user with an empty
    // reply; a second refusal is said as one (DECLINED_REPLY), never as silence.
    if (final.stop_reason === 'refusal' && !answered) {
      if (model === MODELS.chat) {
        console.warn('[onboarding] chat model declined; re-running on', MODELS.primary)
        model = MODELS.primary
        round--
        continue
      }
      declined = true
      break
    }

    const uses = final.content.filter((b): b is Anthropic.Messages.ToolUseBlock => b.type === 'tool_use')
    if (final.stop_reason !== 'tool_use' || uses.length === 0) {
      if (held) {
        answered = true
        yield held
      }
      break
    }
    if (round === SETUP_LOOKUP_ROUNDS) break
    // The model's turn goes back unchanged: Opus 5.5's thinking blocks are
    // invalid if edited (.claude/rules/ai-models.md).
    loopMessages.push({ role: 'assistant', content: final.content as unknown as Anthropic.Messages.ContentBlockParam[] })
    const results: Anthropic.Messages.ToolResultBlockParam[] = []
    for (const use of uses) {
      const input = use.input as Record<string, unknown>
      const result = await runSetupLookup(use.name, input, userId)
      // On the record: a reply that says "I checked" has the lookup behind it.
      hooks.onLookup?.({ name: use.name, input, result_summary: result.slice(0, 1000) })
      results.push({ type: 'tool_result', tool_use_id: use.id, content: result })
    }
    loopMessages.push({
      role: 'user',
      content: round === SETUP_LOOKUP_ROUNDS - 1
        ? [...results, { type: 'text', text: 'That was the last lookup available for this reply.' }]
        : results,
    })
  }
  if (!answered) yield declined ? DECLINED_REPLY : SETUP_NO_ANSWER_REPLY
}

/** What the route is told while a setup reply is made. */
export interface SetupStreamHooks {
  /** Each lookup that ran, for the saved message's tool record. */
  onLookup?: (log: { name: string; input: Record<string, unknown>; result_summary: string }) => void
  /** Whether this person's setup chat can look products up, known once membership is read. */
  onLookupsAvailable?: (available: boolean) => void
}

/** Said when every round asked for another lookup, or a reply came back empty. */
export const SETUP_NO_ANSWER_REPLY = 'I could not finish that just now. Ask me again and I will try once more.'

/** How many rounds of lookups one setup reply may make before it must answer. */
export const SETUP_LOOKUP_ROUNDS = 3

/** The only tools the setup chat has: both read the catalog, neither writes. */
export const SETUP_LOOKUP_TOOL_NAMES = ['search_products', 'get_product_details'] as const

function setupLookupTools(): Anthropic.Messages.Tool[] {
  return (YURI_TOOLS as unknown as Anthropic.Messages.Tool[]).filter((t) => (SETUP_LOOKUP_TOOL_NAMES as readonly string[]).includes(t.name))
}

/** Runs one of the two lookups. Anything else is refused here, whatever the model asked for. */
export async function runSetupLookup(name: string, input: Record<string, unknown>, userId: string): Promise<string> {
  if (!(SETUP_LOOKUP_TOOL_NAMES as readonly string[]).includes(name)) {
    return JSON.stringify({ error: `${name} is not available in the setup chat. Only search_products and get_product_details are.` })
  }
  return setupLookupResult(await executeYuriTool(name, input, userId))
}

/**
 * A lookup result as the setup chat gets it: what a product is and what is in
 * it. Prices, stores and counterfeit notes are taken out, because the rules
 * for reading them (which store ships where, how old a price is, which
 * retailers are recommended) are the member chat's and are not in the setup
 * prompt; second-model review, Nov 17 2026. A product with no ingredient list
 * on file says so, so an empty list is not read as "nothing in it".
 */
const NOT_SHOWN_IN_SETUP = new Set(['prices', 'prices_error', 'price_usd', 'price', 'counterfeit_markers', 'other_listings', 'listings_note', 'community'])
const NO_LIST_ON_FILE = 'No ingredient list is on file for this product. That is different from it containing nothing of concern.'

export function setupLookupResult(raw: string): string {
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    // Not JSON: nothing in it can be trusted to be free of prices.
    return JSON.stringify({ error: 'The lookup did not return a readable result.' })
  }
  const clean = (value: unknown): unknown => {
    if (Array.isArray(value)) return value.map(clean)
    if (value === null || typeof value !== 'object') return value
    const out: Record<string, unknown> = {}
    for (const [key, v] of Object.entries(value as Record<string, unknown>)) {
      if (!NOT_SHOWN_IN_SETUP.has(key)) out[key] = clean(v)
    }
    if (out.ingredients_total === 0) out.ingredients_note = NO_LIST_ON_FILE
    return out
  }
  return JSON.stringify(clean(parsed))
}
