import type { UserProfile, SkinAnalysisResult, PersonalizedRecommendation } from '@/types/user'
import type { Product } from '@/hooks/useProducts'

// Comprehensive ingredient knowledge base for Korean skincare
const INGREDIENT_DATABASE = {
  // Beneficial ingredients by skin type
  beneficial: {
    oily: ['niacinamide', 'salicylic acid', 'tea tree oil', 'zinc oxide', 'clay', 'witch hazel'],
    dry: ['hyaluronic acid', 'ceramides', 'glycerin', 'squalane', 'shea butter', 'peptides'],
    sensitive: ['centella asiatica', 'aloe vera', 'chamomile', 'oat extract', 'panthenol', 'allantoin'],
    combination: ['niacinamide', 'hyaluronic acid', 'salicylic acid', 'ceramides', 'panthenol'],
    normal: ['vitamin c', 'retinol', 'peptides', 'hyaluronic acid', 'niacinamide']
  },

  // Ingredients to avoid by skin type
  avoid: {
    oily: ['heavy oils', 'petrolatum', 'lanolin', 'coconut oil'],
    dry: ['alcohol denat', 'menthol', 'strong acids', 'sulfates'],
    sensitive: ['fragrances', 'essential oils', 'alcohol', 'sulfates', 'parabens', 'dyes'],
    combination: ['heavy oils', 'alcohol denat', 'strong acids'],
    normal: ['excessive acids', 'high concentration actives']
  },

  // Common allergens
  allergens: [
    'fragrances', 'essential oils', 'parabens', 'sulfates', 'formaldehyde',
    'methylisothiazolinone', 'benzyl alcohol', 'citrus oils', 'lavender oil'
  ],

  // Skin concern targeted ingredients
  concerns: {
    acne: ['salicylic acid', 'benzoyl peroxide', 'niacinamide', 'tea tree oil', 'retinol'],
    aging: ['retinol', 'peptides', 'vitamin c', 'alpha hydroxy acids', 'antioxidants'],
    hyperpigmentation: ['vitamin c', 'kojic acid', 'arbutin', 'licorice root', 'niacinamide'],
    dryness: ['hyaluronic acid', 'ceramides', 'glycerin', 'squalane', 'urea'],
    sensitivity: ['centella asiatica', 'aloe vera', 'panthenol', 'allantoin', 'oat extract'],
    dullness: ['vitamin c', 'alpha hydroxy acids', 'beta hydroxy acids', 'enzymes']
  }
}

export class SkinAnalysisEngine {
  /**
   * Analyze product compatibility with user's skin profile
   */
  static analyzeProductCompatibility(
    product: Product,
    userProfile: UserProfile
  ): Promise<SkinAnalysisResult> {
    return new Promise((resolve) => {
      const ingredients = this.parseIngredients(product.ingredients || '')

      const analysis: Omit<SkinAnalysisResult, 'id' | 'created_at'> = {
        user_id: userProfile.id,
        product_id: product.id,
        compatibility_score: 0,
        risk_level: 'low',
        beneficial_ingredients: [],
        concerning_ingredients: [],
        allergen_warnings: [],
        skin_concern_match: [],
        ai_recommendation: '',
        confidence_score: 0,
        analysis_reasoning: ''
      }

      // Calculate compatibility score
      analysis.compatibility_score = this.calculateCompatibilityScore(
        ingredients,
        userProfile
      )

      // Identify beneficial ingredients
      analysis.beneficial_ingredients = this.findBeneficialIngredients(
        ingredients,
        userProfile
      )

      // Identify concerning ingredients
      analysis.concerning_ingredients = this.findConcerningIngredients(
        ingredients,
        userProfile
      )

      // Check for allergens
      analysis.allergen_warnings = this.checkAllergens(
        ingredients,
        userProfile.ingredient_allergies
      )

      // Match skin concerns
      analysis.skin_concern_match = this.matchSkinConcerns(
        ingredients,
        userProfile.skin_concerns
      )

      // Determine risk level
      analysis.risk_level = this.calculateRiskLevel(
        analysis.allergen_warnings,
        analysis.concerning_ingredients
      )

      // Set confidence score
      analysis.confidence_score = this.calculateConfidenceScore(
        ingredients,
        userProfile
      )

      // Generate reasoning
      analysis.analysis_reasoning = this.generateAnalysisReasoning(analysis, userProfile)

      resolve({
        ...analysis,
        id: `analysis_${Date.now()}`,
        created_at: new Date().toISOString()
      } as SkinAnalysisResult)
    })
  }

  /**
   * Generate AI-powered recommendation using Claude Opus
   */
  static async generateAIRecommendation(
    product: Product,
    userProfile: UserProfile,
    analysisResult: SkinAnalysisResult
  ): Promise<string> {
    try {
      const prompt = this.buildAIAnalysisPrompt(product, userProfile, analysisResult)

      const response = await fetch('/api/ai-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt,
          model: 'claude-opus-4-1-20250805'
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to generate AI recommendation')
      }

      const data = await response.json()
      return data.recommendation
    } catch (error) {
      console.error('Error generating AI recommendation:', error)
      return this.generateFallbackRecommendation(analysisResult, userProfile)
    }
  }

  /**
   * Parse ingredient list from product
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
   * Calculate overall compatibility score (0-100)
   */
  private static calculateCompatibilityScore(
    ingredients: string[],
    userProfile: UserProfile
  ): number {
    let score = 50 // Base score

    const skinType = userProfile.skin_type
    if (!skinType) return score

    // Beneficial ingredients boost
    const beneficialIngredients = INGREDIENT_DATABASE.beneficial[skinType] || []
    const beneficialMatches = ingredients.filter(ingredient =>
      beneficialIngredients.some(beneficial => ingredient.includes(beneficial))
    )
    score += beneficialMatches.length * 10

    // Avoid ingredients penalty
    const avoidIngredients = INGREDIENT_DATABASE.avoid[skinType] || []
    const avoidMatches = ingredients.filter(ingredient =>
      avoidIngredients.some(avoid => ingredient.includes(avoid))
    )
    score -= avoidMatches.length * 15

    // Allergen penalty
    const allergenMatches = ingredients.filter(ingredient =>
      userProfile.ingredient_allergies.some(allergen =>
        ingredient.includes(allergen.toLowerCase())
      )
    )
    score -= allergenMatches.length * 25

    // Skin concern match bonus
    const concernMatches = userProfile.skin_concerns.reduce((matches, concern) => {
      const concernIngredients = INGREDIENT_DATABASE.concerns[concern as keyof typeof INGREDIENT_DATABASE.concerns] || []
      return matches + ingredients.filter(ingredient =>
        concernIngredients.some(target => ingredient.includes(target))
      ).length
    }, 0)
    score += concernMatches * 8

    return Math.max(0, Math.min(100, score))
  }

  /**
   * Find beneficial ingredients for user's skin type
   */
  private static findBeneficialIngredients(
    ingredients: string[],
    userProfile: UserProfile
  ): string[] {
    if (!userProfile.skin_type) return []

    const beneficialIngredients = INGREDIENT_DATABASE.beneficial[userProfile.skin_type] || []

    return ingredients.filter(ingredient =>
      beneficialIngredients.some(beneficial => ingredient.includes(beneficial))
    )
  }

  /**
   * Find concerning ingredients for user's skin type
   */
  private static findConcerningIngredients(
    ingredients: string[],
    userProfile: UserProfile
  ): string[] {
    if (!userProfile.skin_type) return []

    const avoidIngredients = INGREDIENT_DATABASE.avoid[userProfile.skin_type] || []

    return ingredients.filter(ingredient =>
      avoidIngredients.some(avoid => ingredient.includes(avoid))
    )
  }

  /**
   * Check for user-specific allergens
   */
  private static checkAllergens(
    ingredients: string[],
    userAllergens: string[]
  ): string[] {
    return ingredients.filter(ingredient =>
      userAllergens.some(allergen =>
        ingredient.includes(allergen.toLowerCase())
      )
    )
  }

  /**
   * Match ingredients to user's skin concerns
   */
  private static matchSkinConcerns(
    ingredients: string[],
    skinConcerns: string[]
  ): string[] {
    const matches: string[] = []

    skinConcerns.forEach(concern => {
      const concernIngredients = INGREDIENT_DATABASE.concerns[concern as keyof typeof INGREDIENT_DATABASE.concerns] || []
      const ingredientMatches = ingredients.filter(ingredient =>
        concernIngredients.some(target => ingredient.includes(target))
      )
      matches.push(...ingredientMatches)
    })

    return [...new Set(matches)] // Remove duplicates
  }

  /**
   * Calculate risk level based on warnings and concerning ingredients
   */
  private static calculateRiskLevel(
    allergenWarnings: string[],
    concerningIngredients: string[]
  ): 'low' | 'medium' | 'high' {
    if (allergenWarnings.length > 0) return 'high'
    if (concerningIngredients.length > 2) return 'medium'
    return 'low'
  }

  /**
   * Calculate confidence score for the analysis
   */
  private static calculateConfidenceScore(
    ingredients: string[],
    userProfile: UserProfile
  ): number {
    let confidence = 70 // Base confidence

    // Higher confidence if user has complete profile
    if (userProfile.skin_type) confidence += 10
    if (userProfile.skin_concerns.length > 0) confidence += 10
    if (userProfile.ingredient_allergies.length > 0) confidence += 5
    if (userProfile.skincare_experience) confidence += 5

    // Higher confidence with more ingredients to analyze
    if (ingredients.length > 5) confidence += 10
    if (ingredients.length > 10) confidence += 5

    return Math.min(100, confidence)
  }

  /**
   * Generate human-readable analysis reasoning
   */
  private static generateAnalysisReasoning(
    analysis: Omit<SkinAnalysisResult, 'id' | 'created_at'>,
    userProfile: UserProfile
  ): string {
    const reasons: string[] = []

    if (analysis.beneficial_ingredients.length > 0) {
      reasons.push(`Contains ${analysis.beneficial_ingredients.length} beneficial ingredients for ${userProfile.skin_type} skin`)
    }

    if (analysis.concerning_ingredients.length > 0) {
      reasons.push(`Contains ${analysis.concerning_ingredients.length} ingredients that may not be ideal for ${userProfile.skin_type} skin`)
    }

    if (analysis.allergen_warnings.length > 0) {
      reasons.push(`Contains ${analysis.allergen_warnings.length} ingredients you've marked as allergens`)
    }

    if (analysis.skin_concern_match.length > 0) {
      reasons.push(`Contains ingredients that target your skin concerns: ${userProfile.skin_concerns.join(', ')}`)
    }

    return reasons.join('. ') || 'Standard compatibility analysis based on skin type and preferences.'
  }

  /**
   * Build prompt for AI analysis
   */
  private static buildAIAnalysisPrompt(
    product: Product,
    userProfile: UserProfile,
    analysisResult: SkinAnalysisResult
  ): string {
    return `As a Korean skincare expert, analyze this product for a user with the following profile:

PRODUCT: ${product.name_english} by ${product.brand}
INGREDIENTS: ${product.ingredients}

USER PROFILE:
- Skin Type: ${userProfile.skin_type}
- Skin Concerns: ${userProfile.skin_concerns.join(', ')}
- Experience Level: ${userProfile.skincare_experience}
- Allergies: ${userProfile.ingredient_allergies.join(', ')}

ANALYSIS RESULTS:
- Compatibility Score: ${analysisResult.compatibility_score}/100
- Risk Level: ${analysisResult.risk_level}
- Beneficial Ingredients: ${analysisResult.beneficial_ingredients.join(', ')}
- Concerning Ingredients: ${analysisResult.concerning_ingredients.join(', ')}
- Allergen Warnings: ${analysisResult.allergen_warnings.join(', ')}

Provide a personalized recommendation in 2-3 sentences explaining whether this product is suitable for this user and why. Focus on the most important factors for their specific skin type and concerns.`
  }

  /**
   * Generate fallback recommendation if AI fails
   */
  private static generateFallbackRecommendation(
    analysisResult: SkinAnalysisResult,
    userProfile: UserProfile
  ): string {
    if (analysisResult.compatibility_score >= 80) {
      return `This product appears to be an excellent match for your ${userProfile.skin_type} skin, with several beneficial ingredients and minimal concerns.`
    } else if (analysisResult.compatibility_score >= 60) {
      return `This product could work for your skin type, but consider patch testing first due to some potentially concerning ingredients.`
    } else {
      return `This product may not be the best match for your ${userProfile.skin_type} skin. Consider looking for alternatives better suited to your specific needs.`
    }
  }
}