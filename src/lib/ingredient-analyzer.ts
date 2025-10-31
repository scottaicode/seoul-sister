/**
 * Ingredient Compatibility & Safety Analyzer
 * Analyzes product ingredients for skin compatibility and interactions
 */

interface IngredientProfile {
  name: string
  category: string
  benefits: string[]
  suitableFor: string[]
  notSuitableFor: string[]
  pH?: { min: number; max: number }
  concentration?: { min: number; max: number; unit: string }
  interactions: {
    positive: string[] // Ingredients that work well together
    negative: string[] // Ingredients that shouldn't be combined
  }
}

// Core ingredient database
const INGREDIENT_DATABASE: Record<string, IngredientProfile> = {
  'niacinamide': {
    name: 'Niacinamide (Vitamin B3)',
    category: 'vitamin',
    benefits: ['brightening', 'pore-minimizing', 'oil-control', 'anti-inflammatory'],
    suitableFor: ['all', 'oily', 'combination', 'acne-prone'],
    notSuitableFor: [],
    pH: { min: 5.0, max: 7.0 },
    concentration: { min: 2, max: 10, unit: '%' },
    interactions: {
      positive: ['hyaluronic acid', 'ceramides', 'peptides', 'retinol'],
      negative: ['vitamin c (L-ascorbic acid)', 'aha', 'bha'] // At high concentrations
    }
  },
  'retinol': {
    name: 'Retinol (Vitamin A)',
    category: 'vitamin',
    benefits: ['anti-aging', 'cell-turnover', 'collagen-boost', 'acne-treatment'],
    suitableFor: ['normal', 'oily', 'combination'],
    notSuitableFor: ['sensitive', 'rosacea'],
    concentration: { min: 0.01, max: 1, unit: '%' },
    interactions: {
      positive: ['niacinamide', 'hyaluronic acid', 'peptides'],
      negative: ['vitamin c', 'benzoyl peroxide', 'aha', 'bha']
    }
  },
  'hyaluronic acid': {
    name: 'Hyaluronic Acid',
    category: 'humectant',
    benefits: ['hydration', 'plumping', 'barrier-repair'],
    suitableFor: ['all'],
    notSuitableFor: [],
    interactions: {
      positive: ['niacinamide', 'vitamin c', 'retinol', 'ceramides'],
      negative: []
    }
  },
  'vitamin c': {
    name: 'Vitamin C (L-Ascorbic Acid)',
    category: 'vitamin',
    benefits: ['brightening', 'antioxidant', 'collagen-synthesis', 'sun-damage-repair'],
    suitableFor: ['normal', 'dry', 'combination'],
    notSuitableFor: ['very-sensitive'],
    pH: { min: 2.0, max: 3.5 },
    concentration: { min: 5, max: 20, unit: '%' },
    interactions: {
      positive: ['vitamin e', 'ferulic acid', 'hyaluronic acid'],
      negative: ['retinol', 'benzoyl peroxide', 'niacinamide']
    }
  },
  'salicylic acid': {
    name: 'Salicylic Acid (BHA)',
    category: 'exfoliant',
    benefits: ['exfoliation', 'pore-clearing', 'acne-treatment', 'oil-control'],
    suitableFor: ['oily', 'combination', 'acne-prone'],
    notSuitableFor: ['dry', 'sensitive'],
    pH: { min: 3.0, max: 4.0 },
    concentration: { min: 0.5, max: 2, unit: '%' },
    interactions: {
      positive: ['niacinamide', 'hyaluronic acid'],
      negative: ['retinol', 'vitamin c', 'benzoyl peroxide']
    }
  },
  'glycolic acid': {
    name: 'Glycolic Acid (AHA)',
    category: 'exfoliant',
    benefits: ['exfoliation', 'brightening', 'texture-improvement', 'anti-aging'],
    suitableFor: ['normal', 'oily', 'combination'],
    notSuitableFor: ['sensitive', 'rosacea'],
    pH: { min: 3.0, max: 4.0 },
    concentration: { min: 5, max: 10, unit: '%' },
    interactions: {
      positive: ['hyaluronic acid', 'ceramides'],
      negative: ['retinol', 'vitamin c', 'salicylic acid']
    }
  },
  'ceramides': {
    name: 'Ceramides',
    category: 'lipid',
    benefits: ['barrier-repair', 'hydration', 'anti-aging', 'soothing'],
    suitableFor: ['all'],
    notSuitableFor: [],
    interactions: {
      positive: ['niacinamide', 'hyaluronic acid', 'cholesterol', 'fatty acids'],
      negative: []
    }
  },
  'centella asiatica': {
    name: 'Centella Asiatica (Cica)',
    category: 'botanical',
    benefits: ['healing', 'soothing', 'anti-inflammatory', 'collagen-synthesis'],
    suitableFor: ['all', 'sensitive', 'acne-prone'],
    notSuitableFor: [],
    interactions: {
      positive: ['niacinamide', 'hyaluronic acid', 'ceramides', 'green tea'],
      negative: []
    }
  },
  'snail mucin': {
    name: 'Snail Secretion Filtrate',
    category: 'animal-derived',
    benefits: ['healing', 'hydration', 'anti-aging', 'brightening'],
    suitableFor: ['all'],
    notSuitableFor: ['vegan-preferences'],
    interactions: {
      positive: ['hyaluronic acid', 'niacinamide', 'peptides'],
      negative: []
    }
  }
}

export class IngredientAnalyzer {
  /**
   * Parse ingredient list from product
   */
  parseIngredients(ingredientString: string): string[] {
    if (!ingredientString) return []

    // Split by common delimiters and clean up
    return ingredientString
      .toLowerCase()
      .split(/[,;]/)
      .map(ing => ing.trim())
      .filter(ing => ing.length > 0)
  }

  /**
   * Analyze ingredient compatibility for a user's skin type
   */
  analyzeCompatibility(
    ingredients: string[],
    skinType: string,
    concerns: string[] = []
  ): {
    compatible: boolean
    score: number
    warnings: string[]
    benefits: string[]
    keyIngredients: string[]
  } {
    const warnings: string[] = []
    const benefits: string[] = []
    const keyIngredients: string[] = []
    let score = 70 // Base score

    ingredients.forEach(ingredient => {
      const profile = this.findIngredientProfile(ingredient)
      if (!profile) return

      keyIngredients.push(profile.name)

      // Check skin type compatibility
      if (profile.notSuitableFor.includes(skinType)) {
        warnings.push(`${profile.name} may not be suitable for ${skinType} skin`)
        score -= 15
      } else if (profile.suitableFor.includes('all') || profile.suitableFor.includes(skinType)) {
        score += 5
      }

      // Add benefits relevant to concerns
      profile.benefits.forEach(benefit => {
        if (concerns.some(concern => benefit.includes(concern.toLowerCase()))) {
          benefits.push(`${profile.name}: ${benefit}`)
          score += 3
        }
      })
    })

    // Check for problematic ingredients
    const problematicIngredients = [
      'alcohol denat',
      'sodium lauryl sulfate',
      'mineral oil',
      'fragrance',
      'essential oils'
    ]

    ingredients.forEach(ing => {
      if (problematicIngredients.some(prob => ing.includes(prob))) {
        warnings.push(`Contains ${ing} which may cause irritation`)
        score -= 10
      }
    })

    return {
      compatible: warnings.length === 0,
      score: Math.max(0, Math.min(100, score)),
      warnings,
      benefits: [...new Set(benefits)], // Remove duplicates
      keyIngredients
    }
  }

  /**
   * Check if two products can be used together
   */
  checkProductInteraction(
    product1Ingredients: string[],
    product2Ingredients: string[]
  ): {
    canCombine: boolean
    warnings: string[]
    synergies: string[]
  } {
    const warnings: string[] = []
    const synergies: string[] = []
    let canCombine = true

    const ingredients1 = product1Ingredients.map(ing => this.findIngredientProfile(ing)).filter(Boolean)
    const ingredients2 = product2Ingredients.map(ing => this.findIngredientProfile(ing)).filter(Boolean)

    ingredients1.forEach(ing1 => {
      if (!ing1) return

      ingredients2.forEach(ing2 => {
        if (!ing2) return

        // Check negative interactions
        if (ing1.interactions.negative.some(neg =>
          ing2.name.toLowerCase().includes(neg) ||
          neg.includes(ing2.category)
        )) {
          warnings.push(`⚠️ ${ing1.name} and ${ing2.name} may reduce effectiveness when used together`)
          canCombine = false
        }

        // Check positive interactions
        if (ing1.interactions.positive.some(pos =>
          ing2.name.toLowerCase().includes(pos) ||
          pos.includes(ing2.category)
        )) {
          synergies.push(`✨ ${ing1.name} and ${ing2.name} work great together`)
        }
      })
    })

    // pH compatibility check
    const pH1 = this.estimateProductPH(ingredients1)
    const pH2 = this.estimateProductPH(ingredients2)

    if (pH1 && pH2) {
      const pHDiff = Math.abs(pH1.avg - pH2.avg)
      if (pHDiff > 3) {
        warnings.push(`Large pH difference may reduce effectiveness`)
      }
    }

    return { canCombine, warnings, synergies }
  }

  /**
   * Build a compatible routine from multiple products
   */
  buildCompatibleRoutine(
    products: Array<{ id: string; name: string; ingredients: string; category: string }>,
    timeOfDay: 'morning' | 'evening'
  ): {
    recommendedOrder: string[]
    warnings: string[]
    tips: string[]
  } {
    const order: string[] = []
    const warnings: string[] = []
    const tips: string[] = []

    // Define optimal product order
    const categoryOrder = timeOfDay === 'morning'
      ? ['cleanser', 'toner', 'essence', 'serum', 'eye-cream', 'moisturizer', 'sunscreen']
      : ['oil-cleanser', 'cleanser', 'exfoliant', 'toner', 'essence', 'serum', 'eye-cream', 'moisturizer', 'treatment']

    // Sort products by category order
    const sortedProducts = products.sort((a, b) => {
      const indexA = categoryOrder.indexOf(a.category)
      const indexB = categoryOrder.indexOf(b.category)
      return (indexA === -1 ? 999 : indexA) - (indexB === -1 ? 999 : indexB)
    })

    // Check interactions between consecutive products
    for (let i = 0; i < sortedProducts.length; i++) {
      order.push(sortedProducts[i].name)

      if (i > 0) {
        const interaction = this.checkProductInteraction(
          this.parseIngredients(sortedProducts[i-1].ingredients),
          this.parseIngredients(sortedProducts[i].ingredients)
        )

        if (!interaction.canCombine) {
          warnings.push(...interaction.warnings)
          tips.push(`Wait 5-10 minutes between ${sortedProducts[i-1].name} and ${sortedProducts[i].name}`)
        }

        if (interaction.synergies.length > 0) {
          tips.push(...interaction.synergies)
        }
      }
    }

    // Add general tips
    if (timeOfDay === 'morning') {
      tips.push('Always finish with SPF during the day')
    } else {
      tips.push('Apply treatments (retinol, acids) after cleansing for best absorption')
    }

    return { recommendedOrder: order, warnings, tips }
  }

  /**
   * Find ingredient profile in database
   */
  private findIngredientProfile(ingredientName: string): IngredientProfile | null {
    const normalized = ingredientName.toLowerCase().trim()

    for (const [key, profile] of Object.entries(INGREDIENT_DATABASE)) {
      if (normalized.includes(key) || profile.name.toLowerCase().includes(normalized)) {
        return profile
      }
    }

    return null
  }

  /**
   * Estimate product pH based on ingredients
   */
  private estimateProductPH(ingredients: (IngredientProfile | null)[]): { min: number; max: number; avg: number } | null {
    const pHRanges = ingredients
      .filter(ing => ing?.pH)
      .map(ing => ing!.pH!)

    if (pHRanges.length === 0) return null

    const minPH = Math.min(...pHRanges.map(r => r.min))
    const maxPH = Math.max(...pHRanges.map(r => r.max))
    const avgPH = pHRanges.reduce((sum, r) => sum + (r.min + r.max) / 2, 0) / pHRanges.length

    return { min: minPH, max: maxPH, avg: avgPH }
  }
}

// Export singleton instance
export const ingredientAnalyzer = new IngredientAnalyzer()