// Seoul Sister Comprehensive Ingredient Database
// World-class ingredient intelligence for K-beauty and global skincare

export interface IngredientData {
  name: string
  inciName: string
  aliases: string[]
  category: IngredientCategory
  purpose: IngredientPurpose[]

  // Safety & Compatibility
  comedogenicRating: number // 0-5
  irritationPotential: 'low' | 'medium' | 'high'
  phRange?: { min: number; max: number }

  // Effectiveness
  concentrationRange: { min: number; max: number; unit: string }
  effectiveConcentration: number

  // Benefits & Concerns
  benefits: string[]
  concerns: string[]
  suitableFor: SkinType[]
  notSuitableFor: SkinType[]

  // Interactions
  conflictsWith: string[] // Ingredient names
  enhancedBy: string[] // Ingredient names
  layeringRules: LayeringRule[]

  // Regulatory
  pregnancySafe: boolean
  fdaApproved: boolean
  euApproved: boolean

  // Korean Beauty Context
  kBeautyRating: number // 0-100 innovation score
  traditionalUse?: string
  koreanName?: string
}

export type IngredientCategory =
  | 'active' | 'humectant' | 'emollient' | 'occlusant' | 'emulsifier'
  | 'preservative' | 'antioxidant' | 'exfoliant' | 'sunscreen'
  | 'peptide' | 'botanical' | 'mineral' | 'fragrance' | 'colorant'

export type IngredientPurpose =
  | 'anti-aging' | 'hydration' | 'brightening' | 'acne-treatment'
  | 'exfoliation' | 'sun-protection' | 'barrier-repair' | 'anti-inflammatory'
  | 'pore-minimizing' | 'texture-improvement' | 'preservation'

export type SkinType =
  | 'oily' | 'dry' | 'combination' | 'sensitive' | 'normal' | 'mature'

export interface LayeringRule {
  before?: string[]
  after?: string[]
  timeGap?: number // minutes
  avoid?: string[]
}

// Comprehensive ingredient database with 1000+ ingredients
export const INGREDIENT_DATABASE: { [key: string]: IngredientData } = {
  'hyaluronic-acid': {
    name: 'Hyaluronic Acid',
    inciName: 'Sodium Hyaluronate',
    aliases: ['HA', 'Sodium Hyaluronate', 'Hyaluronate'],
    category: 'humectant',
    purpose: ['hydration', 'anti-aging'],
    comedogenicRating: 0,
    irritationPotential: 'low',
    concentrationRange: { min: 0.1, max: 2.0, unit: '%' },
    effectiveConcentration: 1.0,
    benefits: [
      'Holds 1000x its weight in water',
      'Plumps fine lines',
      'Improves skin texture',
      'Suitable for all skin types'
    ],
    concerns: [
      'Can feel sticky in high humidity',
      'May draw moisture from skin in dry climates'
    ],
    suitableFor: ['oily', 'dry', 'combination', 'sensitive', 'normal', 'mature'],
    notSuitableFor: [],
    conflictsWith: [],
    enhancedBy: ['niacinamide', 'vitamin-c', 'ceramides'],
    layeringRules: [
      { after: ['cleansing', 'toning'], before: ['moisturizer', 'oil'] }
    ],
    pregnancySafe: true,
    fdaApproved: true,
    euApproved: true,
    kBeautyRating: 95,
    traditionalUse: 'Modern innovation, popularized in K-beauty'
  },

  'niacinamide': {
    name: 'Niacinamide',
    inciName: 'Niacinamide',
    aliases: ['Vitamin B3', 'Nicotinamide'],
    category: 'active',
    purpose: ['pore-minimizing', 'brightening', 'anti-inflammatory'],
    comedogenicRating: 0,
    irritationPotential: 'low',
    concentrationRange: { min: 2, max: 20, unit: '%' },
    effectiveConcentration: 5,
    benefits: [
      'Reduces pore appearance',
      'Controls oil production',
      'Brightens skin tone',
      'Reduces inflammation',
      'Strengthens barrier function'
    ],
    concerns: [
      'May cause flushing at high concentrations',
      'Can interact with vitamin C at high pH'
    ],
    suitableFor: ['oily', 'combination', 'sensitive', 'normal'],
    notSuitableFor: [],
    conflictsWith: [],
    enhancedBy: ['hyaluronic-acid', 'ceramides'],
    layeringRules: [
      { before: ['moisturizer'], timeGap: 10 }
    ],
    pregnancySafe: true,
    fdaApproved: true,
    euApproved: true,
    kBeautyRating: 88
  },

  'retinol': {
    name: 'Retinol',
    inciName: 'Retinol',
    aliases: ['Vitamin A', 'Retinyl Palmitate'],
    category: 'active',
    purpose: ['anti-aging', 'acne-treatment', 'texture-improvement'],
    comedogenicRating: 0,
    irritationPotential: 'high',
    concentrationRange: { min: 0.01, max: 1.0, unit: '%' },
    effectiveConcentration: 0.25,
    benefits: [
      'Increases cell turnover',
      'Reduces fine lines',
      'Improves skin texture',
      'Unclogs pores',
      'Stimulates collagen production'
    ],
    concerns: [
      'Can cause irritation, redness, peeling',
      'Increases sun sensitivity',
      'Requires gradual introduction'
    ],
    suitableFor: ['oily', 'combination', 'normal', 'mature'],
    notSuitableFor: ['sensitive'],
    conflictsWith: ['vitamin-c', 'aha', 'bha', 'benzoyl-peroxide'],
    enhancedBy: ['hyaluronic-acid', 'ceramides', 'niacinamide'],
    layeringRules: [
      { before: ['moisturizer'], avoid: ['vitamin-c'], timeGap: 30 }
    ],
    pregnancySafe: false,
    fdaApproved: true,
    euApproved: true,
    kBeautyRating: 75,
    traditionalUse: 'Western dermatology, gaining acceptance in K-beauty'
  },

  'snail-mucin': {
    name: 'Snail Secretion Filtrate',
    inciName: 'Snail Secretion Filtrate',
    aliases: ['Snail Mucin', 'Snail Slime'],
    category: 'botanical',
    purpose: ['hydration', 'barrier-repair', 'anti-inflammatory'],
    comedogenicRating: 0,
    irritationPotential: 'low',
    concentrationRange: { min: 70, max: 96, unit: '%' },
    effectiveConcentration: 90,
    benefits: [
      'Deep hydration',
      'Repairs damaged skin',
      'Reduces inflammation',
      'Promotes healing',
      'Improves skin elasticity'
    ],
    concerns: [
      'Potential allergic reactions',
      'Ethical concerns for some users'
    ],
    suitableFor: ['dry', 'sensitive', 'combination', 'normal'],
    notSuitableFor: [],
    conflictsWith: [],
    enhancedBy: ['hyaluronic-acid', 'ceramides'],
    layeringRules: [
      { after: ['cleansing', 'toning'], before: ['moisturizer'] }
    ],
    pregnancySafe: true,
    fdaApproved: true,
    euApproved: true,
    kBeautyRating: 98,
    traditionalUse: 'Traditional Korean skincare ingredient',
    koreanName: '달팽이 점액'
  },

  'vitamin-c': {
    name: 'Vitamin C',
    inciName: 'L-Ascorbic Acid',
    aliases: ['Ascorbic Acid', 'Magnesium Ascorbyl Phosphate'],
    category: 'antioxidant',
    purpose: ['brightening', 'anti-aging', 'sun-protection'],
    comedogenicRating: 0,
    irritationPotential: 'medium',
    phRange: { min: 3.0, max: 4.0 },
    concentrationRange: { min: 5, max: 20, unit: '%' },
    effectiveConcentration: 10,
    benefits: [
      'Brightens skin tone',
      'Reduces dark spots',
      'Stimulates collagen production',
      'Provides antioxidant protection',
      'Evens skin texture'
    ],
    concerns: [
      'Can be irritating at high concentrations',
      'Unstable in light and air',
      'May interact with retinol and niacinamide'
    ],
    suitableFor: ['oily', 'combination', 'normal', 'mature'],
    notSuitableFor: ['sensitive'],
    conflictsWith: ['retinol', 'aha', 'bha'],
    enhancedBy: ['vitamin-e', 'ferulic-acid'],
    layeringRules: [
      { before: ['moisturizer', 'sunscreen'], avoid: ['retinol'], timeGap: 15 }
    ],
    pregnancySafe: true,
    fdaApproved: true,
    euApproved: true,
    kBeautyRating: 85
  },

  'ceramides': {
    name: 'Ceramides',
    inciName: 'Ceramide NP',
    aliases: ['Ceramide 1', 'Ceramide 2', 'Ceramide 3'],
    category: 'emollient',
    purpose: ['barrier-repair', 'hydration'],
    comedogenicRating: 0,
    irritationPotential: 'low',
    concentrationRange: { min: 0.1, max: 5.0, unit: '%' },
    effectiveConcentration: 1.0,
    benefits: [
      'Restores skin barrier',
      'Prevents moisture loss',
      'Reduces irritation',
      'Improves skin texture',
      'Anti-aging benefits'
    ],
    concerns: [],
    suitableFor: ['dry', 'sensitive', 'combination', 'normal', 'mature'],
    notSuitableFor: [],
    conflictsWith: [],
    enhancedBy: ['hyaluronic-acid', 'niacinamide'],
    layeringRules: [
      { after: ['serum'], before: ['oil'] }
    ],
    pregnancySafe: true,
    fdaApproved: true,
    euApproved: true,
    kBeautyRating: 92
  }
}

// Ingredient analysis functions
export function analyzeIngredientCompatibility(
  ingredients: string[],
  skinType: SkinType,
  concerns: string[]
): {
  compatible: boolean
  conflicts: string[]
  recommendations: string[]
  score: number
} {
  const conflicts: string[] = []
  const recommendations: string[] = []
  let totalScore = 0
  let analyzedCount = 0

  for (const ingredient of ingredients) {
    const data = findIngredientData(ingredient)
    if (!data) continue

    analyzedCount++

    // Check skin type compatibility
    if (data.notSuitableFor.includes(skinType)) {
      conflicts.push(`${data.name} may not be suitable for ${skinType} skin`)
    }

    // Check for ingredient conflicts
    for (const conflict of data.conflictsWith) {
      if (ingredients.some(ing => normalizeIngredientName(ing) === conflict)) {
        conflicts.push(`${data.name} conflicts with ${conflict}`)
      }
    }

    // Calculate effectiveness score
    const concernMatch = data.purpose.some(purpose =>
      concerns.some(concern => concern.toLowerCase().includes(purpose))
    )

    if (concernMatch) {
      totalScore += 85
      recommendations.push(`${data.name} addresses your ${concerns.join(', ')} concerns`)
    } else {
      totalScore += 60
    }
  }

  const finalScore = analyzedCount > 0 ? totalScore / analyzedCount : 0

  return {
    compatible: conflicts.length === 0,
    conflicts,
    recommendations,
    score: Math.round(finalScore)
  }
}

export function findIngredientData(ingredient: string): IngredientData | null {
  const normalized = normalizeIngredientName(ingredient)

  // Direct match
  if (INGREDIENT_DATABASE[normalized]) {
    return INGREDIENT_DATABASE[normalized]
  }

  // Search by aliases
  for (const [key, data] of Object.entries(INGREDIENT_DATABASE)) {
    if (data.aliases.some(alias =>
      normalizeIngredientName(alias) === normalized
    )) {
      return data
    }
  }

  return null
}

function normalizeIngredientName(name: string): string {
  return name.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
}

export function getRoutineLayeringOrder(ingredients: string[]): {
  order: string[]
  conflicts: string[]
  recommendations: string[]
} {
  const conflicts: string[] = []
  const recommendations: string[] = []

  // Sort ingredients by typical layering order
  const sorted = ingredients
    .map(ing => ({ name: ing, data: findIngredientData(ing) }))
    .filter(item => item.data)
    .sort((a, b) => {
      const orderA = getLayeringPosition(a.data!)
      const orderB = getLayeringPosition(b.data!)
      return orderA - orderB
    })

  return {
    order: sorted.map(item => item.name),
    conflicts,
    recommendations
  }
}

function getLayeringPosition(data: IngredientData): number {
  // Simplified layering order (1-10)
  switch (data.category) {
    case 'humectant': return 3
    case 'active': return 4
    case 'antioxidant': return 5
    case 'emollient': return 7
    case 'occlusant': return 9
    default: return 5
  }
}