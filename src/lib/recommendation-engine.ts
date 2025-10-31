/**
 * AI-Powered Product Recommendation Engine
 * Personalizes product suggestions based on skin profile, purchase history, and trends
 */

import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

interface UserProfile {
  skinType: string
  concerns: string[]
  ingredients_to_avoid: string[]
  price_range: { min: number; max: number }
  preferred_brands: string[]
}

interface Product {
  id: string
  name_english: string
  brand: string
  category: string
  ingredients: string | null
  best_price_found: number
  popularity_score: number
  skin_type: string | null
}

interface RecommendationScore {
  productId: string
  score: number
  reasons: string[]
}

export class RecommendationEngine {
  private userProfile: UserProfile | null = null

  async loadUserProfile(userId: string): Promise<void> {
    const { data: profile } = await supabase
      .from('user_skin_profiles')
      .select('*')
      .eq('whatsapp_number', userId)
      .single() as any

    if (profile) {
      this.userProfile = {
        skinType: profile.current_skin_type || 'normal',
        concerns: profile.skin_concerns || [],
        ingredients_to_avoid: [],
        price_range: { min: 0, max: 100 },
        preferred_brands: []
      }
    }
  }

  async getPersonalizedRecommendations(
    userId: string,
    category?: string,
    limit: number = 12
  ): Promise<any[]> {
    await this.loadUserProfile(userId)

    // Fetch all products
    let query = supabase.from('products').select('*')

    if (category) {
      query = query.eq('category', category)
    }

    const { data: products } = await query as any

    if (!products || products.length === 0) {
      return []
    }

    // Score each product
    const scoredProducts = products.map((product: any) => ({
      product,
      score: this.calculateRecommendationScore(product)
    }))

    // Sort by score and return top products
    return scoredProducts
      .sort((a: any, b: any) => b.score.score - a.score.score)
      .slice(0, limit)
      .map((item: any) => item.product)
  }

  private calculateRecommendationScore(product: any): RecommendationScore {
    const reasons: string[] = []
    let score = 0

    if (!this.userProfile) {
      // Default scoring without profile
      score += product.popularity_score * 0.3
      if (product.best_price_found < 30) score += 20
      return { productId: product.id, score, reasons }
    }

    // Skin type compatibility (0-30 points)
    if (product.skin_type) {
      const skinTypes = product.skin_type.toLowerCase().split(',').map((s: any) => s.trim())
      if (skinTypes.includes(this.userProfile.skinType.toLowerCase())) {
        score += 30
        reasons.push('Perfect for your skin type')
      } else if (skinTypes.includes('all')) {
        score += 15
        reasons.push('Suitable for all skin types')
      }
    }

    // Concern matching (0-40 points)
    const concernScore = this.matchConcerns(product, this.userProfile.concerns)
    score += concernScore
    if (concernScore > 20) {
      reasons.push('Addresses your top concerns')
    }

    // Price range (0-20 points)
    if (product.best_price_found <= this.userProfile.price_range.max) {
      score += 20
      if (product.best_price_found <= this.userProfile.price_range.max * 0.5) {
        reasons.push('Great value')
      }
    }

    // Popularity boost (0-10 points)
    score += Math.min(product.popularity_score * 0.1, 10)
    if (product.popularity_score > 80) {
      reasons.push('Trending now')
    }

    // Ingredient safety check
    if (product.ingredients && !this.hasProblematicIngredients(product.ingredients)) {
      score += 10
      reasons.push('Clean ingredients')
    }

    return { productId: product.id, score, reasons }
  }

  private matchConcerns(product: any, concerns: string[]): number {
    const concernKeywords: Record<string, string[]> = {
      'acne': ['acne', 'blemish', 'breakout', 'salicylic', 'bha', 'tea tree'],
      'aging': ['anti-aging', 'wrinkle', 'fine line', 'retinol', 'peptide', 'collagen'],
      'dark spots': ['brightening', 'vitamin c', 'niacinamide', 'dark spot', 'hyperpigmentation'],
      'dryness': ['hydrating', 'moisturizing', 'hyaluronic', 'ceramide', 'barrier'],
      'sensitivity': ['gentle', 'sensitive', 'calming', 'soothing', 'fragrance-free'],
      'pores': ['pore', 'minimize', 'refining', 'clay', 'charcoal', 'bha']
    }

    let score = 0
    const productText = `${product.name_english} ${product.category} ${product.ingredients || ''}`.toLowerCase()

    concerns.forEach(concern => {
      const keywords = concernKeywords[concern.toLowerCase()] || [concern.toLowerCase()]
      const matches = keywords.filter(keyword => productText.includes(keyword))
      if (matches.length > 0) {
        score += 40 / concerns.length // Distribute 40 points across all concerns
      }
    })

    return score
  }

  private hasProblematicIngredients(ingredients: string): boolean {
    const problematic = [
      'alcohol denat',
      'sodium lauryl sulfate',
      'mineral oil',
      'paraben',
      'phthalate',
      'synthetic fragrance'
    ]

    const lowerIngredients = ingredients.toLowerCase()
    return problematic.some(ingredient => lowerIngredients.includes(ingredient))
  }

  async getTrendingProducts(limit: number = 8): Promise<any[]> {
    const { data } = await supabase
      .from('products')
      .select('*')
      .order('popularity_score', { ascending: false })
      .limit(limit) as any

    return data || []
  }

  async getSimilarProducts(productId: string, limit: number = 6): Promise<any[]> {
    // Get the reference product
    const { data: referenceProduct } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single() as any

    if (!referenceProduct) return []

    // Find similar products in same category and price range
    const { data: similarProducts } = await supabase
      .from('products')
      .select('*')
      .eq('category', referenceProduct.category)
      .neq('id', productId)
      .gte('best_price_found', referenceProduct.best_price_found * 0.7)
      .lte('best_price_found', referenceProduct.best_price_found * 1.3)
      .limit(limit) as any

    return similarProducts || []
  }

  async getComplementaryProducts(productId: string): Promise<any[]> {
    // Get the reference product
    const { data: referenceProduct } = await supabase
      .from('products')
      .select('*')
      .eq('id', productId)
      .single() as any

    if (!referenceProduct) return []

    // Define complementary categories
    const complementaryMap: Record<string, string[]> = {
      'cleanser': ['toner', 'moisturizer'],
      'toner': ['essence', 'serum'],
      'serum': ['moisturizer', 'eye-cream'],
      'moisturizer': ['sunscreen', 'face-oil'],
      'essence': ['serum', 'ampoule'],
      'sunscreen': ['cleanser', 'moisturizer'],
      'mask': ['serum', 'moisturizer'],
      'exfoliant': ['toner', 'serum']
    }

    const complementaryCategories = complementaryMap[referenceProduct.category] || []

    if (complementaryCategories.length === 0) return []

    const { data: complementaryProducts } = await supabase
      .from('products')
      .select('*')
      .in('category', complementaryCategories)
      .order('popularity_score', { ascending: false })
      .limit(4) as any

    return complementaryProducts || []
  }
}

// Singleton instance
let engineInstance: RecommendationEngine | null = null

export function getRecommendationEngine(): RecommendationEngine {
  if (!engineInstance) {
    engineInstance = new RecommendationEngine()
  }
  return engineInstance
}