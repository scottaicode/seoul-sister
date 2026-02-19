import type {
  CyclePhase,
  CyclePhaseInfo,
  CycleRoutineAdjustment,
  SkinProfile,
} from '@/types/database'

// ---------------------------------------------------------------------------
// Phase boundaries (day ranges within a cycle)
// ---------------------------------------------------------------------------

interface PhaseBounds {
  phase: CyclePhase
  /** Fraction of cycle length where the phase starts (inclusive) */
  startFraction: number
  /** Fraction of cycle length where the phase ends (exclusive) */
  endFraction: number
}

const PHASE_BOUNDS: PhaseBounds[] = [
  { phase: 'menstrual', startFraction: 0, endFraction: 5 / 28 },
  { phase: 'follicular', startFraction: 5 / 28, endFraction: 13 / 28 },
  { phase: 'ovulatory', startFraction: 13 / 28, endFraction: 16 / 28 },
  { phase: 'luteal', startFraction: 16 / 28, endFraction: 1 },
]

// ---------------------------------------------------------------------------
// Phase metadata
// ---------------------------------------------------------------------------

const PHASE_META: Record<
  CyclePhase,
  { skin_behavior: string; recommendations: string[] }
> = {
  menstrual: {
    skin_behavior:
      'Estrogen and progesterone are at their lowest. Skin tends to be drier, more sensitive, and can look dull. Inflammation may increase.',
    recommendations: [
      'Focus on gentle hydration — hyaluronic acid, ceramides, squalane',
      'Avoid strong actives (retinoids, high-concentration AHAs/BHAs)',
      'Use a richer moisturizer than usual',
      'Soothing ingredients like centella, aloe, and panthenol are your friends',
      'Skip physical exfoliation — skin barrier is more fragile',
    ],
  },
  follicular: {
    skin_behavior:
      'Estrogen is rising. Skin starts to improve — better hydration, more elasticity, clearer complexion. This is a great time to try new products.',
    recommendations: [
      'Reintroduce actives gradually — vitamin C in the AM, retinoid in the PM',
      'Lighter moisturizer as skin becomes less dry',
      'Good time to try new products — skin is most resilient',
      'Exfoliation is well-tolerated — gentle AHA or enzyme mask',
      'Focus on brightening and glow-boosting ingredients (niacinamide, vitamin C)',
    ],
  },
  ovulatory: {
    skin_behavior:
      'Estrogen peaks. Skin is at its best — naturally glowing, plump, and clear. Pores may appear slightly larger due to increased sebum.',
    recommendations: [
      'Maintenance routine — your skin is doing well on its own',
      'Lightweight, non-comedogenic products to prevent pore congestion',
      'This is the best time for photos — your skin has natural glow',
      'Light mattifying products if you notice extra shine',
      'Continue full active routine — skin tolerates everything well',
    ],
  },
  luteal: {
    skin_behavior:
      'Progesterone rises and then both hormones drop. Increased oil production, higher likelihood of breakouts (especially along the jawline and chin). Skin may become more reactive.',
    recommendations: [
      'Increase BHA/salicylic acid frequency for oil and breakout control',
      'Niacinamide to regulate sebum and minimize pores',
      'Switch to lighter-texture moisturizer (gel or water-based)',
      'Keep spot treatments ready — tea tree, centella, pimple patches',
      'Avoid heavy, occlusive products that could trap excess oil',
      'Clay masks 1-2x per week for oil absorption',
    ],
  },
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

/**
 * Calculate the current cycle phase based on the most recent cycle start date
 * and cycle length.
 */
export function getCyclePhase(
  cycleStartDate: string,
  cycleLength: number
): CyclePhaseInfo {
  const start = new Date(cycleStartDate)
  const now = new Date()

  // Calculate day in cycle (1-indexed)
  const diffMs = now.getTime() - start.getTime()
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
  // Wrap around if past cycle length (user may not have logged new cycle)
  const dayInCycle = (diffDays % cycleLength) + 1

  // Determine phase
  const dayFraction = (dayInCycle - 1) / cycleLength
  let currentPhase: CyclePhase = 'luteal' // default fallback
  for (const bounds of PHASE_BOUNDS) {
    if (dayFraction >= bounds.startFraction && dayFraction < bounds.endFraction) {
      currentPhase = bounds.phase
      break
    }
  }

  // Calculate days until next phase
  const phaseIndex = PHASE_BOUNDS.findIndex((b) => b.phase === currentPhase)
  const nextPhaseIndex = (phaseIndex + 1) % PHASE_BOUNDS.length
  const nextPhaseStartDay = Math.round(
    PHASE_BOUNDS[nextPhaseIndex].startFraction * cycleLength
  )
  const currentDay0 = dayInCycle - 1
  const daysUntilNext =
    nextPhaseIndex === 0
      ? cycleLength - currentDay0
      : nextPhaseStartDay - currentDay0

  const meta = PHASE_META[currentPhase]

  return {
    phase: currentPhase,
    day_in_cycle: dayInCycle,
    days_until_next_phase: Math.max(1, daysUntilNext),
    cycle_length: cycleLength,
    skin_behavior: meta.skin_behavior,
    recommendations: meta.recommendations,
  }
}

/**
 * Generate specific routine adjustments based on cycle phase and skin type.
 */
export function getRoutineAdjustments(
  phaseInfo: CyclePhaseInfo,
  skinProfile: SkinProfile | null,
  currentRoutineProducts: string[]
): CycleRoutineAdjustment[] {
  const adjustments: CycleRoutineAdjustment[] = []
  const skinType = skinProfile?.skin_type ?? 'combination'
  const phase = phaseInfo.phase

  if (phase === 'menstrual') {
    adjustments.push({
      type: 'avoid',
      product_category: 'exfoliator',
      reason: 'Skin barrier is more fragile during menstruation',
      suggestion: 'Skip chemical exfoliants (AHA/BHA) for a few days',
    })
    adjustments.push({
      type: 'emphasize',
      product_category: 'moisturizer',
      reason: 'Drier skin from low estrogen',
      suggestion: 'Use a richer cream or add a hydrating layer (essence/serum with hyaluronic acid)',
    })
    if (skinType === 'sensitive' || skinType === 'dry') {
      adjustments.push({
        type: 'add',
        product_category: 'essence',
        reason: 'Extra sensitive skin needs barrier support',
        suggestion: 'Add a centella or ceramide essence for barrier repair',
      })
    }
  }

  if (phase === 'follicular') {
    adjustments.push({
      type: 'add',
      product_category: 'serum',
      reason: 'Rising estrogen makes skin more resilient',
      suggestion: 'Great time to use vitamin C serum in the morning for brightening',
    })
    if (currentRoutineProducts.some((p) => p.toLowerCase().includes('retinol') || p.toLowerCase().includes('retinoid'))) {
      adjustments.push({
        type: 'emphasize',
        product_category: 'spot_treatment',
        reason: 'Skin tolerates actives well in the follicular phase',
        suggestion: 'Resume or increase retinoid frequency if you had paused',
      })
    }
  }

  if (phase === 'ovulatory') {
    if (skinType === 'oily' || skinType === 'combination') {
      adjustments.push({
        type: 'swap',
        product_category: 'moisturizer',
        reason: 'Sebum production peaks around ovulation',
        suggestion: 'Switch to a lighter gel moisturizer to avoid clogged pores',
      })
    }
  }

  if (phase === 'luteal') {
    adjustments.push({
      type: 'add',
      product_category: 'exfoliator',
      reason: 'Increased oil and breakout risk from rising progesterone',
      suggestion: 'Use BHA (salicylic acid) 2-3 times per week to keep pores clear',
    })
    adjustments.push({
      type: 'swap',
      product_category: 'moisturizer',
      reason: 'Skin produces more oil in the luteal phase',
      suggestion: 'Switch to a lighter, water-based moisturizer',
    })
    if (skinType === 'oily' || skinType === 'combination') {
      adjustments.push({
        type: 'add',
        product_category: 'mask',
        reason: 'Excess oil buildup during luteal phase',
        suggestion: 'Clay mask 1-2x per week to absorb excess sebum',
      })
    }
    adjustments.push({
      type: 'emphasize',
      product_category: 'spot_treatment',
      reason: 'Hormonal breakouts are most likely now',
      suggestion: 'Keep pimple patches and tea tree spot treatment ready',
    })
  }

  return adjustments
}

/**
 * Get a short label for display in the UI.
 */
export function getPhaseLabel(phase: CyclePhase): string {
  const labels: Record<CyclePhase, string> = {
    menstrual: 'Menstrual Phase',
    follicular: 'Follicular Phase',
    ovulatory: 'Ovulatory Phase',
    luteal: 'Luteal Phase',
  }
  return labels[phase]
}

/**
 * Get the emoji icon for each phase.
 */
export function getPhaseEmoji(phase: CyclePhase): string {
  const emojis: Record<CyclePhase, string> = {
    menstrual: '\uD83C\uDF19',   // crescent moon
    follicular: '\uD83C\uDF31',  // seedling
    ovulatory: '\u2728',         // sparkles
    luteal: '\uD83C\uDF3F',     // herb
  }
  return emojis[phase]
}
