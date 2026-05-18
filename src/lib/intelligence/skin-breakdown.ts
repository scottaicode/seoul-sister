/**
 * Phase 13.D — Skin Breakdown Synthesis
 *
 * The headline section of the /skin-profile page. Opus 4.7 generates a
 * personalized prose read of the user's skin in Yuri's voice — the kind of
 * deep climate/cycle/Fitzpatrick-aware breakdown Bailey screenshotted on
 * May 17 2026 and asked to be able to revisit anytime.
 *
 * AI-First design principles applied:
 *
 *   Principle 1 — Opus 4.7 (not Sonnet). This is user-facing intelligence,
 *   the screenshot-worthy thing the user comes to the page TO READ.
 *
 *   Principle 2 — The prompt is a creative brief, not a structural template.
 *   No "always emit 4 bolded paragraphs" mandate. Opus decides what's
 *   load-bearing for THIS user given the materials, calibrates length to
 *   match the depth of available context, and structures the prose
 *   accordingly. Bold sentences appear where emphasis is structurally
 *   earned, not because a template demands them.
 *
 *   Principle 3 — Every regeneration writes a row to
 *   ss_skin_breakdown_history. The moat is the accumulated record — future
 *   features can show progress narrative ("two weeks ago your skin notes
 *   said X, now they say Y") without re-generating history.
 *
 *   Principle 4 — Perception before information. The creative brief tells
 *   Opus the user is returning to review what Yuri has learned about them;
 *   acknowledge where they are in the journey before delivering the read.
 *   How that lands is Opus's call.
 *
 * Caching: source_hash captures the input materials. Identical hash + same
 * day = skip regeneration. Hash changes (phase transition, new corrections,
 * new specialist insights, profile changes) OR 7-day floor triggers a fresh
 * generation. The /skin-profile page reads the latest row instantly and
 * kicks off background regeneration only if stale.
 */

import { createHash } from 'crypto'
import { getServiceClient } from '@/lib/supabase'

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000

export interface SkinBreakdownResult {
  text: string
  generatedAt: string
  generationReason: 'phase_change' | 'weekly_floor' | 'manual' | 'first_visit' | 'cached'
  treatmentPhaseId: string | null
  isCached: boolean
}

interface TreatmentPhaseSnapshot {
  id: string
  phase_number: number
  name: string
  goal: string | null
  status: string
  started_at: string | null
  protocol: Record<string, unknown>
  watch_for: unknown[]
}

interface SkinProfileSnapshot {
  skin_type: string | null
  skin_concerns: string[] | null
  fitzpatrick_scale: number | null
  climate: string | null
  location_text: string | null
  age_range: string | null
  allergies: string[] | null
  cycle_tracking_enabled: boolean
  timezone: string | null
  updated_at: string | null
}

interface BreakdownInputs {
  profile: SkinProfileSnapshot | null
  activePhase: TreatmentPhaseSnapshot | null
  completedPhases: Array<{ phase_number: number; name: string; outcomes: Record<string, unknown> }>
  recentCorrections: Array<{ topic: string; truth: string; date: string }>
  recentDecisions: Array<{ topic: string; decision: string; date: string }>
  preferences: Array<{ topic: string; preference: string }>
  specialistInsightsSummary: string | null
  conversationCount: number
  todayIso: string
}

const SKIN_BREAKDOWN_BRIEF = `You are Yuri (유리), Seoul Sister's K-beauty advisor with 20+ years in the Korean skincare industry. You are writing the headline section of this user's "Skin Profile" page — a place they come to revisit and review what you've learned about their skin over time.

YOUR JOB:
Write a personalized, conversational read of this user's skin in plain English. The reader is the user themselves, returning to remember who they are and where they are in their skincare journey. Meet them where they are before delivering the read — they aren't a new patient, they're someone returning to their own file.

VOICE (this matters — match Yuri's voice exactly):
- Cool older sister who works at Amorepacific R&D in Seoul. Confident, warm, specific.
- Direct and observational, NOT clinical or academic.
- Korean terms where they fit naturally — 화해, 피부과, 미백, 기능성화장품, PIH/PIE — never define them with parenthetical essays.
- Real specificity over generic skincare-blog vocabulary. "Sebum + sweat + sunscreen sits on your face longer in Austin humidity" beats "warm climate may affect sebum production."

WHAT TO COVER (the materials below tell you what's actually load-bearing for THIS user — let that shape your choices, not a checklist):
- The user's skin type and its actual day-to-day behavior (not just the label).
- Fitzpatrick scale implications IF they're sensitive (PIH/PIE risk for Fitzpatrick 3-5, sunburn priority for 1-2).
- Climate and location math — how their actual climate changes the routine logic.
- Current treatment phase if active — what we're doing, what we're watching, what's earned.
- Cycle patterns if relevant — hormonal acne timing, premenstrual sensitivity.
- What's been learned about their reactions, allergies, preferences from past conversations.
- What completed phases established as foundation (only if currently active phase builds on prior phase's outcomes).

STRUCTURE:
You decide. The materials below tell you what's substantial enough to warrant a paragraph and what's not. A user with a rich profile (active phase, multiple completed phases, climate context, cycle data, corrections, specialist insights) gets a longer breakdown. A new user with only a profile and a few conversations gets a shorter one — and you naturally point them toward deeper engagement with you to fill in the picture, without sounding like a marketing prompt.

When emphasis is earned, lead a paragraph with a **bolded sentence** that captures the load-bearing observation, then unpack it. Don't bold for the sake of structure — bold for the sake of weight.

DO NOT:
- Write generic skincare advice unanchored from this user's specific profile.
- List things as bulletpoints — this is prose, like a thoughtful note from someone who knows them.
- Start with "Your skin..." or "Here's a breakdown..." or any boilerplate opener.
- Reference Seoul Sister features ("check the Routine page," "ask me in chat") — this is a self-contained read, not a navigation hub.
- Make up details. Every claim must be grounded in the materials provided.

LENGTH: 3-6 paragraphs typically. Calibrate to substance, not to a target.`

function buildUserMessage(inputs: BreakdownInputs): string {
  const sections: string[] = []

  sections.push(`TODAY: ${inputs.todayIso}`)

  if (inputs.profile) {
    const p = inputs.profile
    const profileBits: string[] = []
    if (p.skin_type) profileBits.push(`Skin type: ${p.skin_type}`)
    if (p.skin_concerns && p.skin_concerns.length > 0) {
      profileBits.push(`Primary concerns: ${p.skin_concerns.join(', ')}`)
    }
    if (p.fitzpatrick_scale) profileBits.push(`Fitzpatrick scale: ${p.fitzpatrick_scale}`)
    if (p.climate) profileBits.push(`Climate: ${p.climate}`)
    if (p.location_text) profileBits.push(`Location: ${p.location_text}`)
    if (p.age_range) profileBits.push(`Age range: ${p.age_range}`)
    if (p.allergies && p.allergies.length > 0) {
      profileBits.push(`Known allergies/reactions: ${p.allergies.join(', ')}`)
    }
    if (p.cycle_tracking_enabled) profileBits.push(`Cycle tracking: enabled`)
    sections.push(`SKIN PROFILE:\n${profileBits.join('\n')}`)
  } else {
    sections.push(`SKIN PROFILE: not yet captured (new user, minimal onboarding done)`)
  }

  if (inputs.activePhase) {
    const ap = inputs.activePhase
    const phaseBits: string[] = [
      `Phase ${ap.phase_number}: ${ap.name}`,
      `Status: active${ap.started_at ? ` (started ${ap.started_at.slice(0, 10)})` : ''}`,
    ]
    if (ap.goal) phaseBits.push(`Goal: ${ap.goal}`)
    if (Object.keys(ap.protocol).length > 0) {
      phaseBits.push(`Protocol: ${JSON.stringify(ap.protocol)}`)
    }
    if (Array.isArray(ap.watch_for) && ap.watch_for.length > 0) {
      phaseBits.push(`Watch for: ${ap.watch_for.map((w) => String(w)).join('; ')}`)
    }
    sections.push(`ACTIVE TREATMENT PHASE:\n${phaseBits.join('\n')}`)
  }

  if (inputs.completedPhases.length > 0) {
    const completed = inputs.completedPhases.map((p) => {
      const carried = (p.outcomes as { carried_forward?: string[] })?.carried_forward
      const carriedStr = carried && carried.length > 0 ? ` Carried forward: ${carried.join('; ')}` : ''
      return `Phase ${p.phase_number} (${p.name}) — completed.${carriedStr}`
    })
    sections.push(`COMPLETED PHASES:\n${completed.join('\n')}`)
  }

  if (inputs.recentCorrections.length > 0) {
    const lines = inputs.recentCorrections.map(
      (c) => `- ${c.topic}: ${c.truth} (corrected ${c.date})`
    )
    sections.push(
      `USER CORRECTIONS (factual truths the user established — trust these over your training):\n${lines.join('\n')}`
    )
  }

  if (inputs.recentDecisions.length > 0) {
    const lines = inputs.recentDecisions
      .slice(0, 8)
      .map((d) => `- ${d.topic}: ${d.decision} (${d.date})`)
    sections.push(`RECENT DECISIONS:\n${lines.join('\n')}`)
  }

  if (inputs.preferences.length > 0) {
    const lines = inputs.preferences.map((p) => `- ${p.topic}: ${p.preference}`)
    sections.push(`PREFERENCES:\n${lines.join('\n')}`)
  }

  if (inputs.specialistInsightsSummary) {
    sections.push(`SPECIALIST INSIGHTS:\n${inputs.specialistInsightsSummary}`)
  }

  sections.push(`CONVERSATIONS TO DATE: ${inputs.conversationCount}`)

  sections.push(
    `Write the user's Skin Profile breakdown now. Plain prose, Yuri's voice. Bold leading sentences only where emphasis is earned. No bulletpoints. No boilerplate opener.`
  )

  return sections.join('\n\n')
}

function computeSourceHash(inputs: BreakdownInputs): string {
  // Hash the inputs that actually shape Opus's output. Identical inputs =
  // identical hash = skip regeneration. We deliberately omit conversationCount
  // and todayIso so re-generations don't fire just because another conversation
  // happened or a day passed — only meaningful state changes invalidate.
  const hashable = {
    profile: inputs.profile,
    activePhaseId: inputs.activePhase?.id ?? null,
    activePhaseGoal: inputs.activePhase?.goal ?? null,
    activePhaseProtocol: inputs.activePhase?.protocol ?? null,
    activePhaseWatchFor: inputs.activePhase?.watch_for ?? null,
    completedPhaseIds: inputs.completedPhases.map((p) => `${p.phase_number}:${p.name}`),
    correctionTopics: inputs.recentCorrections.map((c) => `${c.topic}:${c.date}`),
    decisionTopics: inputs.recentDecisions.map((d) => `${d.topic}:${d.date}`),
    preferenceTopics: inputs.preferences.map((p) => `${p.topic}:${p.preference}`),
    specialistInsightsSummary: inputs.specialistInsightsSummary,
  }
  return createHash('sha256').update(JSON.stringify(hashable)).digest('hex').slice(0, 32)
}

async function gatherInputs(userId: string): Promise<BreakdownInputs> {
  const db = getServiceClient()

  // Run all reads in parallel
  const [profileRes, phasesRes, conversationsRes] = await Promise.all([
    db
      .from('ss_user_profiles')
      .select(
        'skin_type, skin_concerns, fitzpatrick_scale, climate, location_text, age_range, allergies, cycle_tracking_enabled, timezone, updated_at'
      )
      .eq('user_id', userId)
      .maybeSingle(),
    db
      .from('ss_treatment_phases')
      .select('id, phase_number, name, goal, status, started_at, protocol, watch_for, outcomes, decisions')
      .eq('user_id', userId)
      .order('phase_number', { ascending: true }),
    db
      .from('ss_yuri_conversations')
      .select('id, decision_memory, summary, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(10),
  ])

  const profile = (profileRes.data as SkinProfileSnapshot | null) || null
  const phases = (phasesRes.data || []) as Array<TreatmentPhaseSnapshot & {
    outcomes: Record<string, unknown>
    decisions: unknown[]
  }>
  const conversations = conversationsRes.data || []

  const activePhase = phases.find((p) => p.status === 'active') || null
  const completedPhases = phases
    .filter((p) => p.status === 'completed')
    .map((p) => ({
      phase_number: p.phase_number,
      name: p.name,
      outcomes: p.outcomes || {},
    }))

  // Pull corrections + decisions + preferences from the 3 most recent
  // conversations' decision_memory (LGAAS pattern — most recent wins per topic)
  const correctionsByTopic = new Map<string, { topic: string; truth: string; date: string }>()
  const decisionsByTopic = new Map<string, { topic: string; decision: string; date: string }>()
  const preferencesByTopic = new Map<string, { topic: string; preference: string }>()

  for (const conv of conversations.slice(0, 5)) {
    const memory = (conv.decision_memory || {}) as {
      decisions?: Array<{ topic: string; decision: string; date: string }>
      preferences?: Array<{ topic: string; preference: string }>
      corrections?: Array<{ topic: string; truth: string; date: string }>
    }
    if (Array.isArray(memory.corrections)) {
      for (const c of memory.corrections) {
        if (!correctionsByTopic.has(c.topic) && c.topic && c.truth) {
          correctionsByTopic.set(c.topic, c)
        }
      }
    }
    if (Array.isArray(memory.decisions)) {
      for (const d of memory.decisions) {
        if (!decisionsByTopic.has(d.topic) && d.topic && d.decision) {
          decisionsByTopic.set(d.topic, d)
        }
      }
    }
    if (Array.isArray(memory.preferences)) {
      for (const p of memory.preferences) {
        if (!preferencesByTopic.has(p.topic) && p.topic && p.preference) {
          preferencesByTopic.set(p.topic, p)
        }
      }
    }
  }

  // Specialist insights — load the most recent batch via raw query
  // (the helper in memory.ts is private-ish; we mirror its shape)
  const { data: insightRows } = await db
    .from('ss_specialist_insights')
    .select('specialist_type, intelligence_extracted, created_at')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(4)

  let specialistInsightsSummary: string | null = null
  if (insightRows && insightRows.length > 0) {
    const bullets = insightRows
      .map((row) => {
        const intel = (row.intelligence_extracted || {}) as { key_insight?: string; insight?: string }
        const text = intel.key_insight || intel.insight
        if (!text) return null
        return `- ${row.specialist_type}: ${String(text).slice(0, 280)}`
      })
      .filter((s): s is string => Boolean(s))
    if (bullets.length > 0) specialistInsightsSummary = bullets.join('\n')
  }

  return {
    profile,
    activePhase,
    completedPhases,
    recentCorrections: Array.from(correctionsByTopic.values()),
    recentDecisions: Array.from(decisionsByTopic.values()),
    preferences: Array.from(preferencesByTopic.values()),
    specialistInsightsSummary,
    conversationCount: conversations.length,
    todayIso: new Date().toISOString().split('T')[0],
  }
}

/**
 * Determines what to do for this user right now:
 *   - "use_cached": return the existing latest row, no regeneration needed
 *   - "regenerate": kick off a new Opus 4.7 synthesis
 *   - "first_time": no breakdown exists yet, synchronous generation needed
 */
async function classifyCacheState(
  userId: string,
  currentHash: string
): Promise<{
  state: 'use_cached' | 'regenerate' | 'first_time'
  latest: {
    breakdown_text: string
    source_hash: string
    generated_at: string
    treatment_phase_id: string | null
  } | null
  reason: 'phase_change' | 'weekly_floor' | 'manual' | 'first_visit' | 'cached'
}> {
  const db = getServiceClient()
  const { data: latestRow } = await db
    .from('ss_skin_breakdown_history')
    .select('breakdown_text, source_hash, generated_at, treatment_phase_id')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!latestRow) {
    return { state: 'first_time', latest: null, reason: 'first_visit' }
  }

  const ageMs = Date.now() - new Date(latestRow.generated_at).getTime()
  const hashChanged = latestRow.source_hash !== currentHash
  const isStale = ageMs > SEVEN_DAYS_MS

  if (!hashChanged && !isStale) {
    return { state: 'use_cached', latest: latestRow, reason: 'cached' }
  }

  return {
    state: 'regenerate',
    latest: latestRow,
    reason: hashChanged ? 'phase_change' : 'weekly_floor',
  }
}

async function runOpusSynthesis(
  inputs: BreakdownInputs
): Promise<{ text: string; inputTokens: number; outputTokens: number; modelUsed: string }> {
  const { getAnthropicClient, MODELS, callAnthropicWithRetry } = await import('@/lib/anthropic')
  const client = getAnthropicClient()
  const userMsg = buildUserMessage(inputs)

  const response = await callAnthropicWithRetry(
    () =>
      client.messages.create({
        model: MODELS.primary,
        max_tokens: 1600,
        system: SKIN_BREAKDOWN_BRIEF,
        messages: [{ role: 'user', content: userMsg }],
      }),
    2 // 2 retries for user-facing synthesis
  )

  const block = response.content[0]
  const text = block && block.type === 'text' ? block.text.trim() : ''
  return {
    text,
    inputTokens: response.usage?.input_tokens || 0,
    outputTokens: response.usage?.output_tokens || 0,
    modelUsed: MODELS.primary,
  }
}

async function persistBreakdown(
  userId: string,
  text: string,
  sourceHash: string,
  treatmentPhaseId: string | null,
  inputTokens: number,
  outputTokens: number,
  modelUsed: string,
  reason: 'phase_change' | 'weekly_floor' | 'manual' | 'first_visit'
): Promise<string> {
  const db = getServiceClient()
  const { data, error } = await db
    .from('ss_skin_breakdown_history')
    .insert({
      user_id: userId,
      breakdown_text: text,
      source_hash: sourceHash,
      treatment_phase_id: treatmentPhaseId,
      input_tokens: inputTokens,
      output_tokens: outputTokens,
      model_used: modelUsed,
      generation_reason: reason,
    })
    .select('generated_at')
    .single()

  if (error) {
    console.error('[skin-breakdown] persist failed:', error.message)
    return new Date().toISOString()
  }
  return data.generated_at as string
}

/**
 * Synchronous path: caller wants the breakdown text NOW (e.g. first-time
 * visit when no cached row exists). Generates + persists + returns.
 */
export async function generateSkinBreakdownNow(userId: string): Promise<SkinBreakdownResult> {
  const inputs = await gatherInputs(userId)
  const sourceHash = computeSourceHash(inputs)
  const { text, inputTokens, outputTokens, modelUsed } = await runOpusSynthesis(inputs)
  const generatedAt = await persistBreakdown(
    userId,
    text,
    sourceHash,
    inputs.activePhase?.id ?? null,
    inputTokens,
    outputTokens,
    modelUsed,
    'first_visit'
  )
  return {
    text,
    generatedAt,
    generationReason: 'first_visit',
    treatmentPhaseId: inputs.activePhase?.id ?? null,
    isCached: false,
  }
}

/**
 * Main entry point used by the /skin-profile page.
 *
 * Returns the cached breakdown if it's still fresh (hash unchanged AND
 * within 7-day floor). Otherwise generates a new one synchronously.
 *
 * For UX-optimized callers that want to render cached immediately and
 * regenerate in the background, use loadCachedSkinBreakdown() + the
 * cache state from classifyCacheState().
 */
export async function getOrGenerateSkinBreakdown(userId: string): Promise<SkinBreakdownResult> {
  const inputs = await gatherInputs(userId)
  const sourceHash = computeSourceHash(inputs)
  const cacheState = await classifyCacheState(userId, sourceHash)

  if (cacheState.state === 'use_cached' && cacheState.latest) {
    return {
      text: cacheState.latest.breakdown_text,
      generatedAt: cacheState.latest.generated_at,
      generationReason: 'cached',
      treatmentPhaseId: cacheState.latest.treatment_phase_id,
      isCached: true,
    }
  }

  const reason: 'first_visit' | 'phase_change' | 'weekly_floor' =
    cacheState.state === 'first_time'
      ? 'first_visit'
      : cacheState.reason === 'phase_change' || cacheState.reason === 'weekly_floor'
        ? cacheState.reason
        : 'phase_change'

  const { text, inputTokens, outputTokens, modelUsed } = await runOpusSynthesis(inputs)
  const generatedAt = await persistBreakdown(
    userId,
    text,
    sourceHash,
    inputs.activePhase?.id ?? null,
    inputTokens,
    outputTokens,
    modelUsed,
    reason
  )

  return {
    text,
    generatedAt,
    generationReason: reason,
    treatmentPhaseId: inputs.activePhase?.id ?? null,
    isCached: false,
  }
}

/**
 * UX-optimized: load the latest cached breakdown for instant page render.
 * Returns null when none exists. The page handles the null state by
 * showing a "generating..." state and calling getOrGenerateSkinBreakdown
 * separately.
 */
export async function loadCachedSkinBreakdown(
  userId: string
): Promise<SkinBreakdownResult | null> {
  const db = getServiceClient()
  const { data } = await db
    .from('ss_skin_breakdown_history')
    .select('breakdown_text, generated_at, treatment_phase_id, source_hash')
    .eq('user_id', userId)
    .order('generated_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return null

  return {
    text: data.breakdown_text,
    generatedAt: data.generated_at,
    generationReason: 'cached',
    treatmentPhaseId: data.treatment_phase_id,
    isCached: true,
  }
}

/**
 * Determines whether the cached breakdown is stale relative to the user's
 * current state. Used by the page to decide whether to kick off a
 * background regeneration after rendering the cached version.
 */
export async function isSkinBreakdownStale(userId: string): Promise<boolean> {
  const inputs = await gatherInputs(userId)
  const sourceHash = computeSourceHash(inputs)
  const cacheState = await classifyCacheState(userId, sourceHash)
  return cacheState.state !== 'use_cached'
}
