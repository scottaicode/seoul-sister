import type { Product } from '@/hooks/useProducts'
import type { UserProfile } from '@/types/user'

// Comprehensive allergen database with severity levels and cross-reactions
export const ALLERGEN_DATABASE = {
  // Common cosmetic allergens
  fragrances: {
    aliases: [
      'fragrance', 'parfum', 'perfume', 'aromatic compounds',
      'essential oil', 'natural fragrance', 'synthetic fragrance'
    ],
    severity: 'high',
    category: 'fragrance',
    description: 'Can cause contact dermatitis and sensitization',
    alternatives: 'Look for fragrance-free products',
    prevalence: 0.12 // 12% of population
  },

  essential_oils: {
    aliases: [
      'lavender oil', 'tea tree oil', 'eucalyptus oil', 'peppermint oil',
      'rosemary oil', 'citrus oil', 'bergamot oil', 'geranium oil',
      'ylang ylang oil', 'lemon oil', 'orange oil'
    ],
    severity: 'medium',
    category: 'fragrance',
    description: 'Natural but can cause allergic reactions',
    alternatives: 'Synthetic alternatives or fragrance-free options',
    prevalence: 0.08
  },

  preservatives: {
    aliases: [
      'parabens', 'methylparaben', 'propylparaben', 'butylparaben',
      'formaldehyde', 'dmdm hydantoin', 'quaternium-15',
      'methylisothiazolinone', 'methylchloroisothiazolinone'
    ],
    severity: 'high',
    category: 'preservative',
    description: 'Can cause contact dermatitis and sensitization',
    alternatives: 'Products with alternative preservative systems',
    prevalence: 0.06
  },

  sulfates: {
    aliases: [
      'sodium lauryl sulfate', 'sls', 'sodium laureth sulfate', 'sles',
      'ammonium lauryl sulfate', 'als', 'sodium dodecyl sulfate'
    ],
    severity: 'medium',
    category: 'surfactant',
    description: 'Can cause dryness and irritation',
    alternatives: 'Sulfate-free cleansers with gentle surfactants',
    prevalence: 0.15
  },

  alcohols: {
    aliases: [
      'alcohol denat', 'ethyl alcohol', 'sd alcohol', 'isopropyl alcohol',
      'denatured alcohol', 'alcohol', 'ethanol'
    ],
    severity: 'medium',
    category: 'solvent',
    description: 'Can cause dryness and irritation, especially for sensitive skin',
    alternatives: 'Alcohol-free formulations',
    prevalence: 0.20
  },

  lanolin: {
    aliases: [
      'lanolin', 'wool wax', 'wool alcohol', 'lanolin alcohol',
      'acetylated lanolin', 'ethoxylated lanolin'
    ],
    severity: 'medium',
    category: 'emollient',
    description: 'Derived from sheep wool, can cause allergic reactions',
    alternatives: 'Plant-based emollients like squalane or jojoba oil',
    prevalence: 0.04
  },

  dyes: {
    aliases: [
      'ci 19140', 'yellow 5', 'ci 16035', 'red 40', 'ci 42090', 'blue 1',
      'fd&c yellow', 'fd&c red', 'fd&c blue', 'artificial color'
    ],
    severity: 'medium',
    category: 'colorant',
    description: 'Artificial colors can cause contact dermatitis',
    alternatives: 'Products without artificial colors',
    prevalence: 0.03
  },

  // Korean-specific allergens
  bee_products: {
    aliases: [
      'honey', 'propolis', 'bee venom', 'royal jelly', 'beeswax',
      'mel extract', 'propolis extract'
    ],
    severity: 'high',
    category: 'natural',
    description: 'Popular in Korean skincare but high allergen potential',
    alternatives: 'Synthetic alternatives or plant-based ingredients',
    prevalence: 0.05
  },

  plant_extracts: {
    aliases: [
      'ginseng extract', 'green tea extract', 'licorice root extract',
      'ginkgo extract', 'bamboo extract', 'lotus extract'
    ],
    severity: 'low',
    category: 'botanical',
    description: 'Generally safe but can cause reactions in sensitive individuals',
    alternatives: 'Synthetic alternatives or patch testing first',
    prevalence: 0.02
  },

  citrus_ingredients: {
    aliases: [
      'citrus extract', 'lemon extract', 'orange extract', 'grapefruit extract',
      'lime extract', 'citrus peel oil', 'limonene', 'citral'
    ],
    severity: 'medium',
    category: 'natural',
    description: 'Can cause photosensitivity and contact dermatitis',
    alternatives: 'Non-citrus brightening ingredients like arbutin',
    prevalence: 0.07
  }
}

// Cross-reaction mapping
export const CROSS_REACTIONS = {
  essential_oils: ['fragrances', 'citrus_ingredients'],
  bee_products: ['plant_extracts'],
  citrus_ingredients: ['essential_oils'],
  preservatives: ['formaldehyde_releasers']
}

export interface AllergenAlert {
  allergen: string
  severity: 'low' | 'medium' | 'high'
  category: string
  description: string
  foundIngredients: string[]
  alternatives: string
  crossReactions: string[]
  riskScore: number // 0-100
}

export interface AllergenAnalysisResult {
  overallRiskLevel: 'low' | 'medium' | 'high'
  overallRiskScore: number
  alerts: AllergenAlert[]
  safetyRecommendations: string[]
  patchTestRecommended: boolean
  alternativeProducts: string[]
}

export class AllergenDetector {
  /**
   * Analyze a product for potential allergens based on user profile
   */
  static analyzeProduct(
    product: Product,
    userProfile: UserProfile
  ): AllergenAnalysisResult {
    const ingredients = this.parseIngredients(product.ingredients || '')
    const userAllergens = userProfile.ingredient_allergies.map(a => a.toLowerCase())
    const alerts: AllergenAlert[] = []

    // Check for user-specific allergens
    const userSpecificAlerts = this.checkUserSpecificAllergens(ingredients, userAllergens)
    alerts.push(...userSpecificAlerts)

    // Check for common allergens
    const commonAllergenAlerts = this.checkCommonAllergens(ingredients, userProfile)
    alerts.push(...commonAllergenAlerts)

    // Calculate overall risk
    const overallRiskScore = this.calculateOverallRisk(alerts)
    const overallRiskLevel = this.determineRiskLevel(overallRiskScore)

    // Generate recommendations
    const safetyRecommendations = this.generateSafetyRecommendations(alerts, userProfile)
    const patchTestRecommended = this.shouldRecommendPatchTest(alerts, userProfile)

    return {
      overallRiskLevel,
      overallRiskScore,
      alerts,
      safetyRecommendations,
      patchTestRecommended,
      alternativeProducts: [] // Would be populated by recommendation engine
    }
  }

  /**
   * Check for user's specific known allergens
   */
  private static checkUserSpecificAllergens(
    ingredients: string[],
    userAllergens: string[]
  ): AllergenAlert[] {
    const alerts: AllergenAlert[] = []

    userAllergens.forEach(allergen => {
      const foundIngredients = ingredients.filter(ingredient =>
        ingredient.includes(allergen) ||
        this.isAllergenVariant(ingredient, allergen)
      )

      if (foundIngredients.length > 0) {
        alerts.push({
          allergen: allergen,
          severity: 'high',
          category: 'user_specific',
          description: `You've marked ${allergen} as a known allergen`,
          foundIngredients,
          alternatives: 'Avoid this product and look for allergen-free alternatives',
          crossReactions: this.getCrossReactions(allergen),
          riskScore: 95
        })
      }
    })

    return alerts
  }

  /**
   * Check for common cosmetic allergens
   */
  private static checkCommonAllergens(
    ingredients: string[],
    userProfile: UserProfile
  ): AllergenAlert[] {
    const alerts: AllergenAlert[] = []

    Object.entries(ALLERGEN_DATABASE).forEach(([allergenKey, allergenData]) => {
      const foundIngredients = ingredients.filter(ingredient =>
        allergenData.aliases.some(alias => ingredient.includes(alias.toLowerCase()))
      )

      if (foundIngredients.length > 0) {
        // Adjust severity based on user's skin type and sensitivity
        let adjustedSeverity = allergenData.severity
        let riskScore = this.calculateRiskScore(allergenData, userProfile, foundIngredients.length)

        if (userProfile.skin_type === 'sensitive') {
          riskScore += 15
          if (allergenData.severity === 'medium') adjustedSeverity = 'high'
        }

        alerts.push({
          allergen: allergenKey,
          severity: adjustedSeverity as 'low' | 'medium' | 'high',
          category: allergenData.category,
          description: allergenData.description,
          foundIngredients,
          alternatives: allergenData.alternatives,
          crossReactions: CROSS_REACTIONS[allergenKey as keyof typeof CROSS_REACTIONS] || [],
          riskScore: Math.min(100, riskScore)
        })
      }
    })

    return alerts
  }

  /**
   * Calculate risk score for an allergen
   */
  private static calculateRiskScore(
    allergenData: any,
    userProfile: UserProfile,
    occurrenceCount: number
  ): number {
    let baseScore = 30

    // Severity multiplier
    const severityMultiplier = {
      'low': 1.0,
      'medium': 1.5,
      'high': 2.0
    }

    baseScore *= severityMultiplier[allergenData.severity as keyof typeof severityMultiplier]

    // Prevalence factor
    baseScore *= (allergenData.prevalence * 100)

    // Multiple occurrences increase risk
    baseScore += (occurrenceCount - 1) * 10

    // User-specific adjustments
    if (userProfile.skin_type === 'sensitive') baseScore += 20
    if (userProfile.skincare_experience === 'beginner') baseScore += 10

    return Math.min(100, baseScore)
  }

  /**
   * Calculate overall risk score from all alerts
   */
  private static calculateOverallRisk(alerts: AllergenAlert[]): number {
    if (alerts.length === 0) return 0

    // Find highest individual risk
    const maxRisk = Math.max(...alerts.map(alert => alert.riskScore))

    // Add cumulative risk for multiple allergens
    const cumulativeRisk = alerts.reduce((sum, alert) => sum + alert.riskScore * 0.1, 0)

    return Math.min(100, maxRisk + cumulativeRisk)
  }

  /**
   * Determine overall risk level
   */
  private static determineRiskLevel(riskScore: number): 'low' | 'medium' | 'high' {
    if (riskScore >= 70) return 'high'
    if (riskScore >= 40) return 'medium'
    return 'low'
  }

  /**
   * Generate safety recommendations
   */
  private static generateSafetyRecommendations(
    alerts: AllergenAlert[],
    userProfile: UserProfile
  ): string[] {
    const recommendations: string[] = []

    // User-specific allergen warnings
    const userSpecificAlerts = alerts.filter(alert => alert.category === 'user_specific')
    if (userSpecificAlerts.length > 0) {
      recommendations.push('⚠️ This product contains ingredients you\'ve marked as allergens - avoid use')
    }

    // High-risk alerts
    const highRiskAlerts = alerts.filter(alert => alert.severity === 'high')
    if (highRiskAlerts.length > 0 && userSpecificAlerts.length === 0) {
      recommendations.push('🚨 High allergen risk detected - patch test strongly recommended')
    }

    // Sensitive skin specific advice
    if (userProfile.skin_type === 'sensitive') {
      recommendations.push('🌿 Consider fragrance-free and hypoallergenic alternatives for sensitive skin')
    }

    // Beginner advice
    if (userProfile.skincare_experience === 'beginner') {
      recommendations.push('👆 Start with patch testing on a small area before full application')
    }

    // Multiple allergen warning
    if (alerts.length > 3) {
      recommendations.push('⚠️ Multiple potential allergens detected - consider seeking dermatologist advice')
    }

    // Fragrance-specific advice
    const fragranceAlerts = alerts.filter(alert =>
      alert.category === 'fragrance' || alert.allergen.includes('fragrance')
    )
    if (fragranceAlerts.length > 0) {
      recommendations.push('🌸 Look for fragrance-free alternatives to reduce irritation risk')
    }

    return recommendations.length > 0 ? recommendations : ['✅ Low allergen risk detected - generally safe for most users']
  }

  /**
   * Determine if patch testing should be recommended
   */
  private static shouldRecommendPatchTest(
    alerts: AllergenAlert[],
    userProfile: UserProfile
  ): boolean {
    // Always recommend for user-specific allergens
    if (alerts.some(alert => alert.category === 'user_specific')) {
      return true
    }

    // Recommend for high-risk alerts
    if (alerts.some(alert => alert.severity === 'high')) {
      return true
    }

    // Recommend for sensitive skin with medium-risk alerts
    if (userProfile.skin_type === 'sensitive' &&
        alerts.some(alert => alert.severity === 'medium')) {
      return true
    }

    // Recommend for multiple allergens
    if (alerts.length > 2) {
      return true
    }

    return false
  }

  /**
   * Parse ingredients from product string
   */
  private static parseIngredients(ingredientString: string): string[] {
    if (!ingredientString) return []

    return ingredientString
      .toLowerCase()
      .split(/[,;]/)
      .map(ingredient => ingredient.trim())
      .filter(ingredient => ingredient.length > 0)
  }

  /**
   * Check if an ingredient is a variant of a known allergen
   */
  private static isAllergenVariant(ingredient: string, allergen: string): boolean {
    // Check for common variations
    const variations = [
      `${allergen} extract`,
      `${allergen} oil`,
      `${allergen} acid`,
      `${allergen} alcohol`,
      `sodium ${allergen}`,
      `potassium ${allergen}`
    ]

    return variations.some(variation => ingredient.includes(variation))
  }

  /**
   * Get cross-reaction allergens
   */
  private static getCrossReactions(allergen: string): string[] {
    const allergenKey = Object.keys(ALLERGEN_DATABASE).find(key =>
      ALLERGEN_DATABASE[key as keyof typeof ALLERGEN_DATABASE].aliases.includes(allergen)
    )

    if (allergenKey) {
      return CROSS_REACTIONS[allergenKey as keyof typeof CROSS_REACTIONS] || []
    }

    return []
  }

  /**
   * Get allergen-free product recommendations
   */
  static getAllergenFreeAlternatives(
    products: Product[],
    userAllergens: string[],
    category?: string
  ): Product[] {
    return products.filter(product => {
      const ingredients = this.parseIngredients(product.ingredients || '')

      // Check if product contains any user allergens
      const hasAllergens = userAllergens.some(allergen =>
        ingredients.some(ingredient =>
          ingredient.includes(allergen.toLowerCase()) ||
          this.isAllergenVariant(ingredient, allergen.toLowerCase())
        )
      )

      // Filter by category if specified
      if (category && product.category.toLowerCase() !== category.toLowerCase()) {
        return false
      }

      return !hasAllergens
    })
  }
}