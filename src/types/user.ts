export interface UserProfile {
  id: string
  email: string
  name?: string
  created_at: string
  updated_at: string

  // Skin Type Classification
  skin_type?: 'oily' | 'dry' | 'combination' | 'sensitive' | 'normal'
  skin_tone?: 'light' | 'medium' | 'tan' | 'deep'

  // Primary Skin Concerns
  skin_concerns: string[]

  // Ingredient Preferences and Allergies
  ingredient_allergies: string[]
  preferred_ingredients: string[]
  ingredients_to_avoid: string[]

  // Product Preferences
  preferred_texture?: 'gel' | 'cream' | 'serum' | 'oil' | 'lotion' | 'essence'
  price_range_min: number
  price_range_max: number

  // User Experience Level
  skincare_experience?: 'beginner' | 'intermediate' | 'advanced'

  // Routine Preferences
  routine_complexity?: 'minimal' | 'moderate' | 'extensive'
  time_commitment?: '5min' | '10min' | '15min' | '20min+'

  // Personalization Data
  product_history: Record<string, any>
  skin_analysis_history: Record<string, any>
  recommendation_feedback: Record<string, any>
}

export interface SkinAnalysisResult {
  id: string
  user_id: string
  product_id: string
  created_at: string

  // Analysis Results
  compatibility_score: number // 0-100
  risk_level: 'low' | 'medium' | 'high'

  // Detailed Analysis
  beneficial_ingredients: string[]
  concerning_ingredients: string[]
  allergen_warnings: string[]
  skin_concern_match: string[]

  // AI Analysis
  ai_recommendation: string
  confidence_score: number // 0-100
  analysis_reasoning: string
}

export interface UserProductInteraction {
  id: string
  user_id: string
  product_id: string
  interaction_type: 'viewed' | 'analyzed' | 'wishlisted' | 'purchased' | 'reviewed'
  created_at: string

  // Interaction Data
  interaction_data: Record<string, any>
  rating?: number // 1-5
  review_text?: string
  skin_improvement_noted: boolean
}

export interface CreateUserProfileRequest {
  email: string
  name?: string
  skin_type?: UserProfile['skin_type']
  skin_tone?: UserProfile['skin_tone']
  skin_concerns?: string[]
  ingredient_allergies?: string[]
  preferred_ingredients?: string[]
  preferred_texture?: UserProfile['preferred_texture']
  price_range_min?: number
  price_range_max?: number
  skincare_experience?: UserProfile['skincare_experience']
  routine_complexity?: UserProfile['routine_complexity']
  time_commitment?: UserProfile['time_commitment']
}

export interface UpdateUserProfileRequest extends Partial<CreateUserProfileRequest> {
  id: string
}

export interface SkinAnalysisRequest {
  user_id: string
  product_id: string
}

export interface PersonalizedRecommendation {
  product_id: string
  compatibility_score: number
  recommendation_reason: string[]
  risk_factors: string[]
  personalized_benefits: string[]
  confidence_level: 'high' | 'medium' | 'low'
}