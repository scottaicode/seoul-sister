// Seoul Sister Real-Time Ingredient Conflict Detection
// Advanced conflict analysis for safe skincare layering

export interface ConflictRule {
  ingredient1: string
  ingredient2: string
  severity: 'low' | 'medium' | 'high' | 'dangerous'
  reason: string
  solution: string
  timeGap?: number // minutes to wait between application
  alternatives?: string[]
}

export interface RoutineConflict {
  conflictId: string
  products: string[]
  ingredients: string[]
  severity: 'low' | 'medium' | 'high' | 'dangerous'
  issue: string
  recommendation: string
  canUseAlternately: boolean
  timeGapRequired?: number
}

export interface ConflictAnalysisResult {
  hasConflicts: boolean
  conflicts: RoutineConflict[]
  safetyScore: number // 0-100
  recommendations: string[]
  optimizedRoutine?: {
    morning: string[]
    evening: string[]
    warnings: string[]
  }
}

// Comprehensive conflict rules database
const CONFLICT_RULES: ConflictRule[] = [
  // High-Risk Conflicts
  {
    ingredient1: 'retinol',
    ingredient2: 'vitamin-c',
    severity: 'high',
    reason: 'pH incompatibility and increased irritation risk',
    solution: 'Use vitamin C in morning, retinol in evening',
    timeGap: 720, // 12 hours
    alternatives: ['niacinamide', 'hyaluronic-acid']
  },
  {
    ingredient1: 'retinol',
    ingredient2: 'aha',
    severity: 'high',
    reason: 'Extreme irritation and barrier damage risk',
    solution: 'Alternate nights - never use together',
    timeGap: 1440, // 24 hours
    alternatives: ['gentle-enzyme-exfoliant']
  },
  {
    ingredient1: 'retinol',
    ingredient2: 'bha',
    severity: 'high',
    reason: 'Over-exfoliation and severe irritation',
    solution: 'Use BHA 2-3x per week, retinol on alternate nights',
    timeGap: 1440,
    alternatives: ['niacinamide', 'azelaic-acid']
  },
  {
    ingredient1: 'vitamin-c',
    ingredient2: 'aha',
    severity: 'medium',
    reason: 'pH conflict reduces vitamin C effectiveness',
    solution: 'Use vitamin C in morning, AHA in evening',
    timeGap: 480, // 8 hours
    alternatives: ['azelaic-acid']
  },
  {
    ingredient1: 'vitamin-c',
    ingredient2: 'bha',
    severity: 'medium',
    reason: 'pH incompatibility',
    solution: 'Wait 15-20 minutes between application',
    timeGap: 20,
    alternatives: ['niacinamide']
  },
  {
    ingredient1: 'vitamin-c',
    ingredient2: 'niacinamide',
    severity: 'low',
    reason: 'Potential for niacin formation (outdated concern)',
    solution: 'Safe to use together - wait 10 minutes if concerned',
    timeGap: 10,
    alternatives: []
  },
  {
    ingredient1: 'benzoyl-peroxide',
    ingredient2: 'retinol',
    severity: 'dangerous',
    reason: 'Extreme irritation and chemical burns possible',
    solution: 'NEVER use together - alternate days minimum',
    timeGap: 1440,
    alternatives: ['azelaic-acid', 'niacinamide']
  },
  {
    ingredient1: 'tretinoin',
    ingredient2: 'aha',
    severity: 'dangerous',
    reason: 'Severe barrier damage and chemical burns',
    solution: 'Use tretinoin alone - discontinue AHA',
    timeGap: 2880, // 48 hours minimum
    alternatives: ['gentle-moisturizers-only']
  },

  // Korean Beauty Specific Conflicts
  {
    ingredient1: 'snail-mucin',
    ingredient2: 'aha',
    severity: 'low',
    reason: 'Acid may denature proteins in snail mucin',
    solution: 'Apply snail mucin after acid fully absorbs',
    timeGap: 20,
    alternatives: ['hyaluronic-acid']
  },
  {
    ingredient1: 'fermented-rice-water',
    ingredient2: 'vitamin-c',
    severity: 'low',
    reason: 'Potential pH buffering effect',
    solution: 'Apply vitamin C first, wait 10 minutes',
    timeGap: 10,
    alternatives: ['arbutin']
  },

  // Pregnancy Safety Conflicts
  {
    ingredient1: 'retinol',
    ingredient2: 'pregnancy',
    severity: 'dangerous',
    reason: 'Teratogenic risk during pregnancy',
    solution: 'Discontinue all retinoids during pregnancy',
    alternatives: ['bakuchiol', 'vitamin-c', 'niacinamide']
  },
  {
    ingredient1: 'salicylic-acid',
    ingredient2: 'pregnancy',
    severity: 'medium',
    reason: 'High concentrations may be absorbed systemically',
    solution: 'Limit to 0.5% concentration, avoid large areas',
    alternatives: ['lactic-acid', 'azelaic-acid']
  }
]

// Real-time conflict detection
export function detectConflicts(routine: {
  morning: string[]
  evening: string[]
  products?: { name: string; ingredients: string[] }[]
}): ConflictAnalysisResult {
  const conflicts: RoutineConflict[] = []
  const allIngredients = [
    ...routine.morning,
    ...routine.evening,
    ...(routine.products?.flatMap(p => p.ingredients) || [])
  ]

  // Check for direct ingredient conflicts
  for (const rule of CONFLICT_RULES) {
    const hasIngredient1 = allIngredients.some(ing =>
      normalizeIngredientName(ing) === rule.ingredient1
    )
    const hasIngredient2 = allIngredients.some(ing =>
      normalizeIngredientName(ing) === rule.ingredient2
    )

    if (hasIngredient1 && hasIngredient2) {
      conflicts.push({
        conflictId: `${rule.ingredient1}-${rule.ingredient2}`,
        products: findProductsWithIngredients(routine.products || [], [rule.ingredient1, rule.ingredient2]),
        ingredients: [rule.ingredient1, rule.ingredient2],
        severity: rule.severity,
        issue: rule.reason,
        recommendation: rule.solution,
        canUseAlternately: rule.timeGap ? rule.timeGap >= 480 : false,
        timeGapRequired: rule.timeGap
      })
    }
  }

  // Check for same-time-of-day conflicts
  const morningConflicts = checkTimeSpecificConflicts(routine.morning, 'morning')
  const eveningConflicts = checkTimeSpecificConflicts(routine.evening, 'evening')

  conflicts.push(...morningConflicts, ...eveningConflicts)

  // Calculate safety score
  const safetyScore = calculateSafetyScore(conflicts)

  // Generate recommendations
  const recommendations = generateRecommendations(conflicts)

  // Create optimized routine if conflicts exist
  const optimizedRoutine = conflicts.length > 0
    ? optimizeRoutine(routine, conflicts)
    : undefined

  return {
    hasConflicts: conflicts.length > 0,
    conflicts,
    safetyScore,
    recommendations,
    optimizedRoutine
  }
}

function checkTimeSpecificConflicts(ingredients: string[], timeOfDay: string): RoutineConflict[] {
  const conflicts: RoutineConflict[] = []

  // Check for multiple actives in same routine
  const actives = ingredients.filter(ing =>
    ['retinol', 'tretinoin', 'aha', 'bha', 'vitamin-c', 'benzoyl-peroxide'].includes(
      normalizeIngredientName(ing)
    )
  )

  if (actives.length > 1) {
    conflicts.push({
      conflictId: `multiple-actives-${timeOfDay}`,
      products: [],
      ingredients: actives,
      severity: 'high',
      issue: `Multiple active ingredients in ${timeOfDay} routine`,
      recommendation: `Reduce to one active ingredient per ${timeOfDay} routine`,
      canUseAlternately: true,
      timeGapRequired: 1440
    })
  }

  // Check for wrong time of day usage
  if (timeOfDay === 'morning') {
    const nightOnlyIngredients = ingredients.filter(ing =>
      ['retinol', 'tretinoin', 'aha'].includes(normalizeIngredientName(ing))
    )

    if (nightOnlyIngredients.length > 0) {
      conflicts.push({
        conflictId: `morning-night-only`,
        products: [],
        ingredients: nightOnlyIngredients,
        severity: 'medium',
        issue: 'Using photosensitizing ingredients in morning',
        recommendation: 'Move these ingredients to evening routine',
        canUseAlternately: false
      })
    }
  }

  return conflicts
}

function findProductsWithIngredients(products: { name: string; ingredients: string[] }[], targetIngredients: string[]): string[] {
  return products
    .filter(product =>
      targetIngredients.some(target =>
        product.ingredients.some(ing =>
          normalizeIngredientName(ing) === target
        )
      )
    )
    .map(product => product.name)
}

function calculateSafetyScore(conflicts: RoutineConflict[]): number {
  if (conflicts.length === 0) return 100

  let score = 100

  for (const conflict of conflicts) {
    switch (conflict.severity) {
      case 'dangerous':
        score -= 40
        break
      case 'high':
        score -= 25
        break
      case 'medium':
        score -= 15
        break
      case 'low':
        score -= 5
        break
    }
  }

  return Math.max(0, score)
}

function generateRecommendations(conflicts: RoutineConflict[]): string[] {
  const recommendations: string[] = []

  if (conflicts.length === 0) {
    recommendations.push('✅ Your routine looks safe with no major conflicts detected')
    return recommendations
  }

  // Prioritize by severity
  const dangerousConflicts = conflicts.filter(c => c.severity === 'dangerous')
  const highConflicts = conflicts.filter(c => c.severity === 'high')

  if (dangerousConflicts.length > 0) {
    recommendations.push('🚨 URGENT: Stop using these combinations immediately')
    dangerousConflicts.forEach(conflict => {
      recommendations.push(`• ${conflict.recommendation}`)
    })
  }

  if (highConflicts.length > 0) {
    recommendations.push('⚠️ High priority adjustments needed:')
    highConflicts.forEach(conflict => {
      recommendations.push(`• ${conflict.recommendation}`)
    })
  }

  recommendations.push('💡 Consider introducing new actives gradually')
  recommendations.push('📅 Track your skin\'s response for 2-4 weeks')

  return recommendations
}

function optimizeRoutine(
  routine: { morning: string[]; evening: string[] },
  conflicts: RoutineConflict[]
): { morning: string[]; evening: string[]; warnings: string[] } {
  const warnings: string[] = []
  let morning = [...routine.morning]
  let evening = [...routine.evening]

  // Move photosensitizing ingredients to evening
  const photosensitizers = ['retinol', 'tretinoin', 'aha']
  photosensitizers.forEach(ingredient => {
    const index = morning.findIndex(ing => normalizeIngredientName(ing) === ingredient)
    if (index !== -1) {
      const moved = morning.splice(index, 1)[0]
      evening.push(moved)
      warnings.push(`Moved ${ingredient} to evening routine`)
    }
  })

  // Separate conflicting actives
  const actives = ['retinol', 'aha', 'bha', 'vitamin-c']
  const activeIngredients = actives.filter(active =>
    [...morning, ...evening].some(ing => normalizeIngredientName(ing) === active)
  )

  if (activeIngredients.length > 1) {
    warnings.push('Consider alternating active ingredients on different days')
  }

  return { morning, evening, warnings }
}

function normalizeIngredientName(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

// Live conflict checking for product addition
export function checkNewProductConflicts(
  newProduct: { name: string; ingredients: string[] },
  currentRoutine: { morning: string[]; evening: string[]; products: { name: string; ingredients: string[] }[] }
): {
  safe: boolean
  conflicts: RoutineConflict[]
  suggestions: string[]
} {
  const updatedRoutine = {
    ...currentRoutine,
    products: [...currentRoutine.products, newProduct]
  }

  const analysis = detectConflicts(updatedRoutine)

  // Filter for conflicts involving the new product
  const newProductConflicts = analysis.conflicts.filter(conflict =>
    conflict.products.includes(newProduct.name) ||
    conflict.ingredients.some(ing =>
      newProduct.ingredients.some(newIng =>
        normalizeIngredientName(newIng) === ing
      )
    )
  )

  const suggestions = newProductConflicts.length > 0
    ? [
        'Consider using this product on alternate days',
        'Introduce gradually to monitor skin response',
        'Apply at a different time of day',
        'Use a lower concentration version'
      ]
    : ['Safe to add to your routine!']

  return {
    safe: newProductConflicts.length === 0,
    conflicts: newProductConflicts,
    suggestions
  }
}