import type { UserProfile, SkinAnalysisResult } from '@/types/user'
import type { Product } from '@/hooks/useProducts'

// Advanced ML insights engine for Seoul Sister
export class MLInsightsEngine {

  /**
   * Generate personalized insights based on user data and community patterns
   */
  static async generatePersonalizedInsights(
    userProfile: UserProfile,
    userAnalysisHistory: SkinAnalysisResult[],
    communityData: any[]
  ): Promise<MLInsight[]> {
    const insights: MLInsight[] = []

    // Progress tracking insights
    if (userAnalysisHistory.length >= 2) {
      const progressInsight = this.analyzeProgressTrends(userAnalysisHistory)
      if (progressInsight) insights.push(progressInsight)
    }

    // Community-based insights
    const similarUsers = this.findSimilarUsers(userProfile, communityData)
    if (similarUsers.length > 0) {
      const communityInsight = this.generateCommunityInsight(userProfile, similarUsers)
      if (communityInsight) insights.push(communityInsight)
    }

    // Seasonal recommendations
    const seasonalInsight = this.generateSeasonalInsight(userProfile)
    insights.push(seasonalInsight)

    // Ingredient compatibility insights
    const ingredientInsight = await this.analyzeIngredientPatterns(userProfile)
    if (ingredientInsight) insights.push(ingredientInsight)

    return insights
  }

  /**
   * Analyze skin improvement trends over time
   */
  private static analyzeProgressTrends(analysisHistory: SkinAnalysisResult[]): MLInsight | null {
    if (analysisHistory.length < 2) return null

    const latest = analysisHistory[0]
    const baseline = analysisHistory[analysisHistory.length - 1]

    // Calculate improvement metrics
    const improvements = {
      hydration: this.calculateImprovement(baseline.hydration_level, latest.hydration_level),
      brightness: this.calculateImprovement(baseline.brightness_score, latest.brightness_score),
      acne: this.calculateImprovement(baseline.acne_score, latest.acne_score, true), // Lower is better for acne
      wrinkles: this.calculateImprovement(baseline.wrinkles_score, latest.wrinkles_score, true)
    }

    const significantImprovements = Object.entries(improvements)
      .filter(([_, value]) => Math.abs(value) > 10)
      .sort(([_, a], [__, b]) => Math.abs(b) - Math.abs(a))

    if (significantImprovements.length === 0) {
      return {
        type: 'progress_tracking',
        title: 'Steady Progress',
        description: 'Your skin is maintaining stable condition. Consider adjusting your routine for more visible improvements.',
        confidence_score: 0.7,
        actionable_recommendations: [
          'Try incorporating a new active ingredient',
          'Consider increasing application frequency',
          'Ensure consistent daily routine adherence'
        ],
        data_source: 'photo_analysis',
        applicable_concerns: [],
        improvement_percentage: 0
      }
    }

    const topImprovement = significantImprovements[0]
    const improvementPercentage = Math.abs(topImprovement[1])

    return {
      type: 'progress_tracking',
      title: `${improvementPercentage.toFixed(0)}% Improvement in ${topImprovement[0].charAt(0).toUpperCase() + topImprovement[0].slice(1)}`,
      description: `Your ${topImprovement[0]} has ${topImprovement[1] > 0 ? 'improved' : 'declined'} by ${improvementPercentage.toFixed(0)}% over the past ${this.calculateTimespan(baseline.created_at, latest.created_at)} days.`,
      confidence_score: 0.85,
      actionable_recommendations: this.getProgressRecommendations(topImprovement[0], topImprovement[1]),
      data_source: 'photo_analysis',
      applicable_concerns: [topImprovement[0]],
      improvement_percentage: topImprovement[1]
    }
  }

  /**
   * Find users with similar skin profiles for community insights
   */
  private static findSimilarUsers(userProfile: UserProfile, communityData: any[]): any[] {
    return communityData.filter(user => {
      if (!user.skin_type || !user.skin_concerns) return false

      // Match skin type
      const skinTypeMatch = user.skin_type === userProfile.skin_type

      // Match at least one skin concern
      const concernMatch = userProfile.skin_concerns?.some(concern =>
        user.skin_concerns?.includes(concern)
      ) || false

      // Match age range (if available)
      const ageMatch = !user.age_range || !userProfile.estimated_age_range ||
        user.age_range === userProfile.estimated_age_range

      return skinTypeMatch && concernMatch && ageMatch
    }).slice(0, 50) // Limit to 50 similar users for performance
  }

  /**
   * Generate insights based on similar users' experiences
   */
  private static generateCommunityInsight(userProfile: UserProfile, similarUsers: any[]): MLInsight | null {
    // Analyze what products worked best for similar users
    const successfulProducts = this.analyzeCommunitySuccessPatterns(similarUsers)

    if (successfulProducts.length === 0) return null

    const topProduct = successfulProducts[0]

    return {
      type: 'community_recommendation',
      title: `Community Favorite: ${topProduct.name}`,
      description: `${topProduct.success_rate}% of users with ${userProfile.skin_type} skin and similar concerns report positive results with this product.`,
      confidence_score: Math.min(0.9, topProduct.sample_size / 100),
      actionable_recommendations: [
        `Consider trying ${topProduct.name} for ${topProduct.primary_benefit}`,
        'Start with patch testing as recommended by community',
        'Check for any ingredient allergies before use'
      ],
      data_source: 'community_data',
      applicable_concerns: topProduct.addresses_concerns,
      improvement_percentage: topProduct.avg_improvement
    }
  }

  /**
   * Generate seasonal skincare recommendations
   */
  private static generateSeasonalInsight(userProfile: UserProfile): MLInsight {
    const currentMonth = new Date().getMonth()
    const season = this.getCurrentSeason(currentMonth)

    const seasonalAdvice = {
      spring: {
        title: 'Spring Skincare Adjustment',
        description: 'As humidity increases, consider lighter formulations and focus on UV protection.',
        recommendations: [
          'Switch to lighter moisturizers',
          'Increase SPF protection',
          'Add gentle exfoliation for renewal'
        ]
      },
      summer: {
        title: 'Summer Protection Mode',
        description: 'High humidity and UV exposure require oil control and strong protection.',
        recommendations: [
          'Use oil-free formulations',
          'Reapply sunscreen every 2 hours',
          'Consider hydrating mists for midday refresh'
        ]
      },
      fall: {
        title: 'Fall Recovery & Repair',
        description: 'Perfect time to introduce stronger actives and repair summer damage.',
        recommendations: [
          'Introduce vitamin C or retinol',
          'Focus on hydration as humidity drops',
          'Consider professional treatments'
        ]
      },
      winter: {
        title: 'Winter Hydration Boost',
        description: 'Combat dry air with intensive moisture and barrier repair.',
        recommendations: [
          'Switch to cream-based products',
          'Add face oils or sleeping masks',
          'Use gentle, non-stripping cleansers'
        ]
      }
    }

    const advice = seasonalAdvice[season]

    return {
      type: 'seasonal_recommendation',
      title: advice.title,
      description: advice.description,
      confidence_score: 0.8,
      actionable_recommendations: advice.recommendations,
      data_source: 'seasonal_patterns',
      applicable_concerns: userProfile.skin_concerns || [],
      improvement_percentage: 15 // Expected seasonal adjustment benefit
    }
  }

  /**
   * Analyze ingredient patterns and compatibility
   */
  private static async analyzeIngredientPatterns(userProfile: UserProfile): Promise<MLInsight | null> {
    // Simulate ingredient analysis based on user's skin type and concerns
    const beneficialIngredients = this.getOptimalIngredients(userProfile)

    if (beneficialIngredients.length === 0) return null

    return {
      type: 'ingredient_optimization',
      title: 'Ingredient Compatibility Analysis',
      description: `Based on your ${userProfile.skin_type} skin and concerns, these ingredients show highest compatibility.`,
      confidence_score: 0.75,
      actionable_recommendations: [
        `Look for products containing ${beneficialIngredients[0]}`,
        `Avoid layering too many actives initially`,
        `Introduce new ingredients gradually`
      ],
      data_source: 'ingredient_analysis',
      applicable_concerns: userProfile.skin_concerns || [],
      improvement_percentage: 20,
      ingredient_focus: beneficialIngredients.slice(0, 3)
    }
  }

  /**
   * Predict optimal routine timing for user
   */
  static predictOptimalRoutineTiming(userProfile: UserProfile): RoutineTimingPrediction {
    const baseComplexity = userProfile.routine_complexity || 'moderate'
    const timeCommitment = userProfile.time_commitment || '10min'

    // ML model would analyze user behavior patterns here
    // For now, use rule-based predictions

    const predictions = {
      morning: {
        optimal_start_time: this.predictMorningStartTime(userProfile),
        estimated_duration: this.calculateRoutineDuration(baseComplexity, 'morning'),
        success_probability: 0.85
      },
      evening: {
        optimal_start_time: this.predictEveningStartTime(userProfile),
        estimated_duration: this.calculateRoutineDuration(baseComplexity, 'evening'),
        success_probability: 0.90
      }
    }

    return {
      predictions,
      adherence_likelihood: this.predictAdherenceLikelihood(userProfile),
      optimization_suggestions: this.generateTimingOptimizations(userProfile)
    }
  }

  /**
   * Analyze product effectiveness patterns across community
   */
  static analyzeProductEffectivenessPatterns(
    products: Product[],
    reviewData: any[],
    userProfiles: UserProfile[]
  ): ProductEffectivenessInsight[] {
    return products.map(product => {
      const productReviews = reviewData.filter(review => review.product_id === product.id)

      if (productReviews.length < 3) {
        return {
          product_id: product.id,
          overall_effectiveness: 0.5,
          skin_type_effectiveness: {},
          concern_effectiveness: {},
          confidence_level: 'low',
          sample_size: productReviews.length,
          predicted_user_satisfaction: 0.5
        }
      }

      const effectiveness = this.calculateProductEffectiveness(productReviews)
      const skinTypeBreakdown = this.analyzeEffectivenessBySkinType(productReviews)
      const concernBreakdown = this.analyzeEffectivenessByConcern(productReviews)

      return {
        product_id: product.id,
        overall_effectiveness: effectiveness.overall,
        skin_type_effectiveness: skinTypeBreakdown,
        concern_effectiveness: concernBreakdown,
        confidence_level: this.determineConfidenceLevel(productReviews.length),
        sample_size: productReviews.length,
        predicted_user_satisfaction: effectiveness.predicted_satisfaction
      }
    })
  }

  // Helper methods
  private static calculateImprovement(baseline: number, current: number, lowerIsBetter = false): number {
    const change = current - baseline
    const improvement = lowerIsBetter ? -change : change
    return (improvement / Math.max(baseline, 0.1)) * 100
  }

  private static calculateTimespan(startDate: string, endDate: string): number {
    return Math.floor((new Date(endDate).getTime() - new Date(startDate).getTime()) / (1000 * 60 * 60 * 24))
  }

  private static getProgressRecommendations(concern: string, improvementValue: number): string[] {
    const isImproving = improvementValue > 0

    const recommendations: Record<string, { improving: string[], declining: string[] }> = {
      hydration: {
        improving: ['Continue current hydrating routine', 'Consider adding a hydrating essence', 'Maintain consistent application'],
        declining: ['Increase moisturizer frequency', 'Add hyaluronic acid serum', 'Check for over-exfoliation']
      },
      brightness: {
        improving: ['Maintain vitamin C routine', 'Continue sun protection', 'Consider gentle exfoliation'],
        declining: ['Add vitamin C serum', 'Increase SPF protection', 'Consider brightening treatments']
      },
      acne: {
        improving: ['Continue current acne treatment', 'Maintain gentle cleansing', 'Don\'t over-treat cleared areas'],
        declining: ['Review current products for pore-clogging ingredients', 'Consider salicylic acid', 'Consult dermatologist if severe']
      }
    }

    return recommendations[concern]?.[isImproving ? 'improving' : 'declining'] || ['Continue monitoring progress']
  }

  private static analyzeCommunitySuccessPatterns(similarUsers: any[]): any[] {
    // Simulate community success analysis
    return [
      {
        name: 'COSRX Snail 96 Mucin Power Essence',
        success_rate: 87,
        sample_size: 45,
        primary_benefit: 'hydration and healing',
        addresses_concerns: ['dryness', 'irritation'],
        avg_improvement: 25
      }
    ]
  }

  private static getCurrentSeason(month: number): 'spring' | 'summer' | 'fall' | 'winter' {
    if (month >= 2 && month <= 4) return 'spring'
    if (month >= 5 && month <= 7) return 'summer'
    if (month >= 8 && month <= 10) return 'fall'
    return 'winter'
  }

  private static getOptimalIngredients(userProfile: UserProfile): string[] {
    const ingredientMap: Record<string, string[]> = {
      oily: ['niacinamide', 'salicylic acid', 'zinc oxide'],
      dry: ['hyaluronic acid', 'ceramides', 'squalane'],
      sensitive: ['centella asiatica', 'panthenol', 'allantoin'],
      combination: ['niacinamide', 'hyaluronic acid'],
      normal: ['vitamin c', 'retinol', 'peptides']
    }

    return ingredientMap[userProfile.skin_type || 'normal'] || []
  }

  private static predictMorningStartTime(userProfile: UserProfile): string {
    // ML model would analyze user behavior here
    return '7:00 AM' // Simplified prediction
  }

  private static predictEveningStartTime(userProfile: UserProfile): string {
    return '9:00 PM' // Simplified prediction
  }

  private static calculateRoutineDuration(complexity: string, timeOfDay: string): number {
    const baseTimes = {
      minimal: 5,
      moderate: 10,
      extensive: 15
    }

    const multiplier = timeOfDay === 'evening' ? 1.2 : 1.0
    return Math.round((baseTimes[complexity as keyof typeof baseTimes] || 10) * multiplier)
  }

  private static predictAdherenceLikelihood(userProfile: UserProfile): number {
    // Simplified adherence prediction based on complexity and time commitment
    const complexityScore = { minimal: 0.9, moderate: 0.8, extensive: 0.7 }[userProfile.routine_complexity || 'moderate'] || 0.8
    const experienceScore = { beginner: 0.7, intermediate: 0.8, advanced: 0.9 }[userProfile.skincare_experience || 'intermediate'] || 0.8

    return (complexityScore + experienceScore) / 2
  }

  private static generateTimingOptimizations(userProfile: UserProfile): string[] {
    return [
      'Consider splitting complex routines between morning and evening',
      'Prepare products the night before to save time',
      'Use multi-purpose products to reduce steps'
    ]
  }

  private static calculateProductEffectiveness(reviews: any[]): { overall: number, predicted_satisfaction: number } {
    const avgRating = reviews.reduce((sum, r) => sum + r.effectiveness_rating, 0) / reviews.length
    const wouldRecommendRate = reviews.filter(r => r.would_recommend).length / reviews.length

    return {
      overall: (avgRating / 5 + wouldRecommendRate) / 2,
      predicted_satisfaction: avgRating / 5
    }
  }

  private static analyzeEffectivenessBySkinType(reviews: any[]): Record<string, number> {
    const skinTypes = ['oily', 'dry', 'combination', 'sensitive', 'normal']
    const breakdown: Record<string, number> = {}

    skinTypes.forEach(skinType => {
      const typeReviews = reviews.filter(r => r.reviewer_skin_type === skinType)
      if (typeReviews.length > 0) {
        breakdown[skinType] = typeReviews.reduce((sum, r) => sum + r.effectiveness_rating, 0) / typeReviews.length / 5
      }
    })

    return breakdown
  }

  private static analyzeEffectivenessByConcern(reviews: any[]): Record<string, number> {
    const concerns = ['acne', 'aging', 'dryness', 'sensitivity', 'hyperpigmentation']
    const breakdown: Record<string, number> = {}

    concerns.forEach(concern => {
      const concernReviews = reviews.filter(r => r.reviewer_concerns?.includes(concern))
      if (concernReviews.length > 0) {
        breakdown[concern] = concernReviews.reduce((sum, r) => sum + r.effectiveness_rating, 0) / concernReviews.length / 5
      }
    })

    return breakdown
  }

  private static determineConfidenceLevel(sampleSize: number): 'low' | 'medium' | 'high' {
    if (sampleSize < 10) return 'low'
    if (sampleSize < 50) return 'medium'
    return 'high'
  }
}

// Type definitions for ML insights
export interface MLInsight {
  type: 'progress_tracking' | 'community_recommendation' | 'seasonal_recommendation' | 'ingredient_optimization'
  title: string
  description: string
  confidence_score: number
  actionable_recommendations: string[]
  data_source: string
  applicable_concerns: string[]
  improvement_percentage: number
  ingredient_focus?: string[]
}

export interface RoutineTimingPrediction {
  predictions: {
    morning: {
      optimal_start_time: string
      estimated_duration: number
      success_probability: number
    }
    evening: {
      optimal_start_time: string
      estimated_duration: number
      success_probability: number
    }
  }
  adherence_likelihood: number
  optimization_suggestions: string[]
}

export interface ProductEffectivenessInsight {
  product_id: string
  overall_effectiveness: number
  skin_type_effectiveness: Record<string, number>
  concern_effectiveness: Record<string, number>
  confidence_level: 'low' | 'medium' | 'high'
  sample_size: number
  predicted_user_satisfaction: number
}