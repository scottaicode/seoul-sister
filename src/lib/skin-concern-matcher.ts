import type { Product } from '@/hooks/useProducts'
import type { UserProfile } from '@/types/user'

// Comprehensive skin concern mapping for Korean skincare ingredients
export const SKIN_CONCERN_DATABASE = {
  acne: {
    primary_ingredients: [
      'salicylic acid',
      'benzoyl peroxide',
      'niacinamide',
      'tea tree oil',
      'zinc oxide',
      'sulfur'
    ],
    korean_specialties: [
      'centella asiatica',
      'snail secretion filtrate',
      'propolis',
      'green tea extract',
      'willow bark extract'
    ],
    product_categories: ['serum', 'essence', 'toner', 'spot treatment'],
    effectiveness_score: 0.85,
    time_to_see_results: '2-4 weeks'
  },

  aging: {
    primary_ingredients: [
      'retinol',
      'peptides',
      'vitamin c',
      'alpha hydroxy acids',
      'collagen',
      'coenzyme q10'
    ],
    korean_specialties: [
      'ginseng extract',
      'fermented rice water',
      'adenosine',
      'ceramides',
      'snail mucin',
      'bee venom'
    ],
    product_categories: ['serum', 'cream', 'eye cream', 'mask'],
    effectiveness_score: 0.80,
    time_to_see_results: '4-8 weeks'
  },

  hyperpigmentation: {
    primary_ingredients: [
      'vitamin c',
      'kojic acid',
      'arbutin',
      'hydroquinone',
      'azelaic acid',
      'glycolic acid'
    ],
    korean_specialties: [
      'licorice root extract',
      'rice bran extract',
      'mulberry extract',
      'niacinamide',
      'alpha arbutin',
      'tranexamic acid'
    ],
    product_categories: ['serum', 'essence', 'spot treatment', 'mask'],
    effectiveness_score: 0.75,
    time_to_see_results: '6-12 weeks'
  },

  dryness: {
    primary_ingredients: [
      'hyaluronic acid',
      'ceramides',
      'glycerin',
      'squalane',
      'shea butter',
      'urea'
    ],
    korean_specialties: [
      'snail secretion filtrate',
      'honey extract',
      'rice water',
      'camellia oil',
      'sea buckthorn',
      'fermented ingredients'
    ],
    product_categories: ['cream', 'essence', 'sleeping mask', 'serum'],
    effectiveness_score: 0.90,
    time_to_see_results: '1-2 weeks'
  },

  sensitivity: {
    primary_ingredients: [
      'centella asiatica',
      'aloe vera',
      'chamomile',
      'panthenol',
      'allantoin',
      'oat extract'
    ],
    korean_specialties: [
      'centella asiatica',
      'calendula extract',
      'madecassoside',
      'asiaticoside',
      'cica complex',
      'heartleaf extract'
    ],
    product_categories: ['essence', 'toner', 'cream', 'mask'],
    effectiveness_score: 0.88,
    time_to_see_results: '1-3 weeks'
  },

  dullness: {
    primary_ingredients: [
      'vitamin c',
      'alpha hydroxy acids',
      'beta hydroxy acids',
      'enzymes',
      'retinol',
      'exfoliating acids'
    ],
    korean_specialties: [
      'rice bran extract',
      'pearl powder',
      'ginseng extract',
      'fermented rice water',
      'vitamin e',
      'niacinamide'
    ],
    product_categories: ['serum', 'essence', 'exfoliator', 'mask'],
    effectiveness_score: 0.82,
    time_to_see_results: '2-4 weeks'
  },

  enlarged_pores: {
    primary_ingredients: [
      'niacinamide',
      'salicylic acid',
      'retinol',
      'alpha hydroxy acids',
      'zinc',
      'clay minerals'
    ],
    korean_specialties: [
      'egg white extract',
      'charcoal powder',
      'green tea extract',
      'centella asiatica',
      'snail mucin',
      'volcanic ash'
    ],
    product_categories: ['serum', 'toner', 'mask', 'essence'],
    effectiveness_score: 0.70,
    time_to_see_results: '3-6 weeks'
  },

  oiliness: {
    primary_ingredients: [
      'niacinamide',
      'salicylic acid',
      'zinc oxide',
      'clay minerals',
      'witch hazel',
      'tea tree oil'
    ],
    korean_specialties: [
      'green tea extract',
      'centella asiatica',
      'volcanic ash',
      'charcoal',
      'sebum control powder',
      'jeju clay'
    ],
    product_categories: ['toner', 'serum', 'mask', 'essence'],
    effectiveness_score: 0.85,
    time_to_see_results: '2-4 weeks'
  }
}

export class SkinConcernMatcher {
  /**
   * Match products to specific skin concerns
   */
  static matchProductsToConcerns(
    products: Product[],
    concerns: string[],
    userProfile?: UserProfile
  ): {
    concern: string
    matchedProducts: Array<{
      product: Product
      matchScore: number
      matchingIngredients: string[]
      expectedBenefits: string[]
      timeToResults: string
    }>
  }[] {
    const results = concerns.map(concern => ({
      concern,
      matchedProducts: this.findProductsForConcern(products, concern, userProfile)
    }))

    return results
  }

  /**
   * Find products that target a specific skin concern
   */
  private static findProductsForConcern(
    products: Product[],
    concern: string,
    userProfile?: UserProfile
  ) {
    const concernData = SKIN_CONCERN_DATABASE[concern as keyof typeof SKIN_CONCERN_DATABASE]
    if (!concernData) return []

    const scoredProducts = products
      .map(product => {
        const score = this.calculateConcernMatch(product, concern, concernData)
        if (score.matchScore < 0.3) return null // Filter out poor matches

        return {
          product,
          matchScore: score.matchScore,
          matchingIngredients: score.matchingIngredients,
          expectedBenefits: this.generateExpectedBenefits(concern, score.matchingIngredients),
          timeToResults: concernData.time_to_see_results
        }
      })
      .filter(Boolean) as any[]

    // Sort by match score and apply user preferences
    let sortedProducts = scoredProducts.sort((a, b) => b.matchScore - a.matchScore)

    // Apply user-specific filtering
    if (userProfile) {
      sortedProducts = this.applyUserPreferences(sortedProducts, userProfile)
    }

    return sortedProducts.slice(0, 6) // Return top 6 matches
  }

  /**
   * Calculate how well a product matches a specific concern
   */
  private static calculateConcernMatch(
    product: Product,
    concern: string,
    concernData: any
  ): {
    matchScore: number
    matchingIngredients: string[]
  } {
    const ingredients = (product.ingredients || '').toLowerCase()
    const productCategory = product.category.toLowerCase()

    let score = 0
    const matchingIngredients: string[] = []

    // Check primary ingredients (higher weight)
    concernData.primary_ingredients.forEach((ingredient: string) => {
      if (ingredients.includes(ingredient.toLowerCase())) {
        score += 0.25
        matchingIngredients.push(ingredient)
      }
    })

    // Check Korean specialty ingredients (medium weight)
    concernData.korean_specialties.forEach((ingredient: string) => {
      if (ingredients.includes(ingredient.toLowerCase())) {
        score += 0.15
        matchingIngredients.push(ingredient)
      }
    })

    // Category bonus
    if (concernData.product_categories.includes(productCategory)) {
      score += 0.1
    }

    // Brand reputation bonus for specific concerns
    const brandBonus = this.getBrandBonusForConcern(product.brand, concern)
    score += brandBonus

    // Ingredient synergy bonus
    if (matchingIngredients.length > 2) {
      score += 0.05 * (matchingIngredients.length - 2)
    }

    return {
      matchScore: Math.min(score, 1.0),
      matchingIngredients
    }
  }

  /**
   * Get brand reputation bonus for specific concerns
   */
  private static getBrandBonusForConcern(brand: string, concern: string): number {
    const brandSpecialties: Record<string, string[]> = {
      'COSRX': ['acne', 'sensitivity', 'oiliness'],
      'Beauty of Joseon': ['aging', 'dullness', 'hyperpigmentation'],
      'Laneige': ['dryness', 'hydration'],
      'Sulwhasoo': ['aging', 'dullness'],
      'Torriden': ['sensitivity', 'dryness'],
      'Purito': ['sensitivity', 'acne'],
      'Some By Mi': ['acne', 'hyperpigmentation'],
      'Klairs': ['sensitivity', 'dryness']
    }

    const specialties = brandSpecialties[brand] || []
    return specialties.includes(concern) ? 0.05 : 0
  }

  /**
   * Generate expected benefits based on matching ingredients
   */
  private static generateExpectedBenefits(
    concern: string,
    matchingIngredients: string[]
  ): string[] {
    const benefitMappings: Record<string, Record<string, string[]>> = {
      acne: {
        'salicylic acid': ['Unclogs pores', 'Reduces blackheads'],
        'niacinamide': ['Controls oil production', 'Minimizes pore appearance'],
        'centella asiatica': ['Calms inflammation', 'Promotes healing'],
        'snail secretion filtrate': ['Repairs acne scars', 'Hydrates without clogging'],
        'tea tree oil': ['Antimicrobial action', 'Reduces redness']
      },
      aging: {
        'retinol': ['Stimulates collagen', 'Reduces fine lines'],
        'peptides': ['Firms skin', 'Improves elasticity'],
        'vitamin c': ['Brightens skin', 'Protects from damage'],
        'ginseng extract': ['Boosts circulation', 'Revitalizes skin'],
        'adenosine': ['Smooths wrinkles', 'Improves texture']
      },
      hyperpigmentation: {
        'vitamin c': ['Brightens dark spots', 'Evens skin tone'],
        'arbutin': ['Inhibits melanin', 'Lightens pigmentation'],
        'niacinamide': ['Reduces transfer of pigment', 'Brightens complexion'],
        'licorice root extract': ['Natural brightening', 'Soothes irritation']
      },
      dryness: {
        'hyaluronic acid': ['Deep hydration', 'Plumps skin'],
        'ceramides': ['Repairs skin barrier', 'Locks in moisture'],
        'snail secretion filtrate': ['Intense hydration', 'Healing properties'],
        'glycerin': ['Draws moisture', 'Softens skin']
      }
    }

    const concernBenefits = benefitMappings[concern] || {}
    const benefits: string[] = []

    matchingIngredients.forEach(ingredient => {
      const ingredientBenefits = concernBenefits[ingredient]
      if (ingredientBenefits) {
        benefits.push(...ingredientBenefits)
      }
    })

    return [...new Set(benefits)] // Remove duplicates
  }

  /**
   * Apply user preferences to filter and sort products
   */
  private static applyUserPreferences(
    products: any[],
    userProfile: UserProfile
  ): any[] {
    return products
      .filter(item => {
        // Price range filter
        if (userProfile.price_range_min && userProfile.price_range_max) {
          const price = item.product.seoul_price
          if (price < userProfile.price_range_min || price > userProfile.price_range_max) {
            return false
          }
        }

        // Texture preference
        if (userProfile.preferred_texture) {
          const productCategory = item.product.category.toLowerCase()
          if (userProfile.preferred_texture !== productCategory) {
            // Allow some flexibility in texture matching
            const textureMap: Record<string, string[]> = {
              'serum': ['serum', 'essence'],
              'cream': ['cream', 'moisturizer'],
              'gel': ['gel', 'essence'],
              'oil': ['oil', 'serum'],
              'essence': ['essence', 'serum', 'toner']
            }

            const acceptableCategories = textureMap[userProfile.preferred_texture] || []
            if (!acceptableCategories.includes(productCategory)) {
              item.matchScore *= 0.8 // Reduce score but don't eliminate
            }
          }
        }

        // Experience level adjustments
        if (userProfile.skincare_experience === 'beginner') {
          // Penalize complex ingredients for beginners
          const complexIngredients = ['retinol', 'alpha hydroxy', 'beta hydroxy']
          const hasComplexIngredients = complexIngredients.some(ingredient =>
            (item.product.ingredients || '').toLowerCase().includes(ingredient)
          )

          if (hasComplexIngredients) {
            item.matchScore *= 0.7
          }
        }

        return true
      })
      .sort((a, b) => b.matchScore - a.matchScore)
  }

  /**
   * Get personalized routine suggestions based on concerns
   */
  static getRoutineSuggestions(
    concerns: string[],
    userProfile: UserProfile
  ): {
    morning: string[]
    evening: string[]
    frequency: Record<string, string>
    tips: string[]
  } {
    const routine = {
      morning: ['cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen'],
      evening: ['cleanser', 'toner', 'treatment', 'serum', 'moisturizer'],
      frequency: {} as Record<string, string>,
      tips: [] as string[]
    }

    // Adjust routine based on concerns
    concerns.forEach(concern => {
      switch (concern) {
        case 'acne':
          routine.morning.splice(2, 0, 'spot treatment')
          routine.frequency['exfoliation'] = '2-3 times per week'
          routine.tips.push('Always apply spot treatment to clean skin')
          break

        case 'aging':
          routine.evening.splice(3, 0, 'retinol serum')
          routine.frequency['retinol'] = 'Start 1x per week, gradually increase'
          routine.tips.push('Use retinol at night and always follow with sunscreen the next day')
          break

        case 'hyperpigmentation':
          routine.morning.splice(2, 0, 'vitamin c serum')
          routine.frequency['brightening mask'] = 'Once per week'
          routine.tips.push('Vitamin C works best in the morning under sunscreen')
          break

        case 'dryness':
          routine.morning.splice(3, 0, 'hydrating essence')
          routine.evening.splice(4, 0, 'sleeping mask')
          routine.tips.push('Layer hydrating products from thinnest to thickest')
          break
      }
    })

    // Adjust for experience level
    if (userProfile.skincare_experience === 'beginner') {
      routine.tips.push('Start with one new product at a time')
      routine.tips.push('Patch test new products on your inner wrist first')
    }

    // Adjust for time commitment
    if (userProfile.time_commitment === '5min') {
      routine.morning = routine.morning.slice(0, 4)
      routine.evening = routine.evening.slice(0, 4)
      routine.tips.push('Focus on the essentials: cleanse, treat, moisturize, protect')
    }

    return routine
  }
}