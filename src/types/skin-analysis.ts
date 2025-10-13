export type SkinType =
  | 'oily'
  | 'dry'
  | 'combination'
  | 'sensitive'
  | 'normal'
  | 'mature'
  | 'acne-prone'

export type SkinConcern =
  | 'acne'
  | 'hyperpigmentation'
  | 'fine-lines'
  | 'wrinkles'
  | 'large-pores'
  | 'dullness'
  | 'dark-spots'
  | 'redness'
  | 'dryness'
  | 'oiliness'
  | 'sensitivity'
  | 'uneven-texture'
  | 'blackheads'
  | 'dehydration'

export type ProductCategory =
  | 'cleanser'
  | 'toner'
  | 'serum'
  | 'moisturizer'
  | 'sunscreen'
  | 'mask'
  | 'eye-cream'
  | 'exfoliant'
  | 'essence'
  | 'ampoule'
  | 'oil'
  | 'balm'

export interface SkinAnalysisResult {
  skinType: SkinType
  concerns: SkinConcern[]
  confidenceScore: number
  recommendedRoutine: {
    morning: ProductCategory[]
    evening: ProductCategory[]
  }
  ingredientsToAvoid: string[]
  ingredientsToSeek: string[]
  analysis: string
}

export interface IngredientAnalysis {
  name: string
  benefits: string[]
  suitableFor: SkinType[]
  concerns: SkinConcern[]
  potentialIrritants: string[]
  compatibility: number
}

export interface PersonalizedRecommendation {
  productId: string
  matchScore: number
  reasons: string[]
  concerns_addressed: SkinConcern[]
  routine_placement: 'morning' | 'evening' | 'both'
}

export interface SkinProfileData {
  id: string
  whatsappNumber: string
  currentSkinType: SkinType | null
  skinConcerns: SkinConcern[]
  preferredCategories: ProductCategory[]
  lastAnalysisDate: string | null
  createdAt: string
  updatedAt: string
}