// Bailey's Enhanced User Profile Types
// Comprehensive lifestyle and environmental factors for truly personalized skincare

export interface BaileyUserProfile {
  // Basic Information
  id: string
  email: string
  name?: string
  age: string | number // Support both age ranges and numbers
  birthDate: Date
  ethnicity?: string

  // Location & Environment
  location: {
    city: string
    state: string
    country: string
    climate: 'tropical' | 'dry' | 'temperate' | 'continental' | 'polar'
    currentSeason?: 'spring' | 'summer' | 'fall' | 'winter'
    humidity?: 'low' | 'moderate' | 'high'
  }

  // Lifestyle Factors (Bailey's comprehensive list)
  lifestyle: {
    smokingStatus: 'never' | 'former' | 'occasional' | 'regular'
    alcoholConsumption: 'none' | 'occasional' | 'moderate' | 'frequent'
    exerciseFrequency: 'sedentary' | '1-2x/week' | '3-4x/week' | 'daily'
    exerciseType?: string[] // ['cardio', 'strength', 'yoga', 'outdoor']
    sleepHours: number
    sleepQuality: 'poor' | 'fair' | 'good' | 'excellent'
    stressLevel: 'low' | 'moderate' | 'high' | 'very-high'
    waterIntake: 'insufficient' | 'moderate' | 'adequate' | 'excellent'
    diet: {
      type: 'standard' | 'vegetarian' | 'vegan' | 'keto' | 'paleo' | 'other'
      dairyConsumption: boolean
      sugarIntake: 'low' | 'moderate' | 'high'
      processedFoods: 'rarely' | 'sometimes' | 'often'
    }
    sunExposure: 'minimal' | 'moderate' | 'high'
    screenTime: number // hours per day
    occupation?: string
    outdoorTime: number // hours per day
  }

  // Medical Information
  medical: {
    currentMedications: string[]
    skinMedications?: string[] // Specifically for Accutane, tretinoin, etc.
    allergies: string[]
    medicalConditions: string[]
    hormoneStatus?: 'regular' | 'irregular' | 'pregnancy' | 'menopause' | 'birth-control'
    lastDermatologistVisit?: Date
  }

  // Skin Profile
  skin: {
    type: 'oily' | 'dry' | 'combination' | 'sensitive' | 'normal'
    tone: 'fair' | 'light' | 'medium' | 'olive' | 'tan' | 'deep'
    undertone?: 'cool' | 'warm' | 'neutral'
    concerns: string[] // From Bailey's list
    sensitivities: string[]
    currentCondition: 'excellent' | 'good' | 'fair' | 'poor'
  }

  // Skincare Goals (What Bailey's users want)
  goals: {
    primary: string // Main goal they want to achieve
    secondary: string[]
    timeline: '1-month' | '3-months' | '6-months' | '1-year'
    commitment: 'minimal' | 'moderate' | 'dedicated'
    willingToInvest: boolean
  }

  // Preferences
  preferences: {
    budgetRange: 'budget' | 'mid-range' | 'luxury' | 'no-limit'
    monthlyBudget?: number
    preferClean: boolean
    preferKBeauty: boolean
    preferFragranceFree: boolean
    preferCrueltyFree: boolean
    texturePreferences: string[] // ['gel', 'cream', 'oil', 'serum']
    brandPreferences?: string[]
    avoidIngredients: string[]
  }
}

export interface CurrentRoutineProduct {
  id: string
  userId: string
  productName: string
  brand?: string
  productType: 'cleanser' | 'toner' | 'serum' | 'moisturizer' | 'sunscreen' | 'treatment' | 'mask' | 'other'
  productImageUrl?: string
  ingredients?: string
  cleanlinessScore?: number // Bailey's clean rating
  ingredientAnalysis?: {
    beneficial: string[]
    concerning: string[]
    purpose: Record<string, string> // ingredient -> why it's included
  }
  usageFrequency: 'daily-am' | 'daily-pm' | 'daily-both' | 'weekly' | 'as-needed'
  userRating?: number
  purchasePrice?: number
  purchaseLocation?: string
  startedUsing?: Date
  notes?: string
  aiReview?: {
    effectiveness: number
    cleanliness: number
    valueForMoney: number
    suitability: number
    recommendations: string
  }
  replacementSuggestions?: {
    betterOption?: ProductSuggestion
    cleanerOption?: ProductSuggestion
    cheaperOption?: ProductSuggestion
  }
}

export interface ProductSuggestion {
  productId: string
  name: string
  brand: string
  reason: string
  improvements: string[]
  price: number
  cleanlinessScore: number
}

export interface RoutineAnalysis {
  id: string
  userId: string
  analysisDate: Date
  overallScore: number

  // Bailey's comprehensive routine rating
  scores: {
    completeness: number // Are all necessary steps covered?
    compatibility: number // Do products work well together?
    cleanliness: number // How clean are the ingredients?
    effectiveness: number // Will this achieve their goals?
    value: number // Good value for money?
  }

  // What's missing from their routine (Bailey's insight)
  gaps: {
    missingCategories: string[]
    missingForGoals: string[] // Based on what they want to achieve
    recommendations: ProductSuggestion[]
  }

  // Product conflicts (Bailey's warning system)
  conflicts: {
    products: string[]
    reason: string
    solution: string
  }[]

  // Proper order (Bailey's layering rules)
  recommendedOrder: {
    morning: string[]
    evening: string[]
  }

  // Specific product guidance
  productGuidance: {
    [productId: string]: {
      whenToUse: 'am' | 'pm' | 'both'
      frequency: string
      layeringPosition: number
      specialInstructions?: string
    }
  }

  improvements: string[]
  aiDetailedAnalysis: string
}

export interface GradualIntroductionPlan {
  id: string
  userId: string
  planName: string
  totalDurationDays: number
  currentDay: number
  currentPhase: 'preparation' | 'week1' | 'week2' | 'week3' | 'week4' | 'maintenance'

  // Bailey's gradual introduction strategy
  schedule: {
    week1: {
      products: string[]
      instructions: string
      watchFor: string[] // Reactions to monitor
    }
    week2: {
      products: string[]
      instructions: string
      watchFor: string[]
    }
    week3: {
      products: string[]
      instructions: string
      watchFor: string[]
    }
    week4: {
      products: string[]
      instructions: string
      watchFor: string[]
    }
  }

  // Purging period management (Bailey's insight)
  purgingExpectations: {
    likely: boolean
    products: string[]
    duration: string
    symptoms: string[]
    reassurance: string
  }

  status: 'not-started' | 'active' | 'paused' | 'completed'
  startDate?: Date
  expectedEndDate?: Date
}

export interface WeeklyProgressUpdate {
  id: string
  userId: string
  checkInDate: Date
  weekNumber: number
  photoUrl?: string

  // Bailey's progress tracking
  skinCondition: {
    overall: number // 1-10
    improvements: string[]
    newConcerns: string[]
    unchanged: string[]
  }

  // Product reactions (Bailey's monitoring)
  reactions: {
    positive: {
      product: string
      improvement: string
    }[]
    negative: {
      product: string
      reaction: string
      severity: 'mild' | 'moderate' | 'severe'
    }[]
    purging: {
      active: boolean
      areas: string[]
      improving: boolean
    }
  }

  // User feedback
  satisfaction: number // 1-5
  notes: string
  questionsForAI: string[]

  // AI Analysis
  aiAnalysis: {
    progressScore: number
    observations: string[]
    adjustments: string[]
    encouragement: string
    nextSteps: string[]
  }
}

export interface IrritationAnalysis {
  id: string
  userId: string
  photoUrl: string

  // Bailey's irritation identification
  identification: {
    type: 'redness' | 'bumps' | 'acne' | 'dryness' | 'peeling' | 'burning' | 'itching' | 'hives' | 'other'
    severity: 'mild' | 'moderate' | 'severe'
    affectedAreas: string[]
    pattern: string // Description of the pattern
  }

  // Cause analysis (Bailey's detective work)
  causes: {
    mostLikely: 'product-reaction' | 'hormonal' | 'weather' | 'stress' | 'diet' | 'unknown'
    explanation: string
    suspectedProducts?: string[]
    timeline: string // When did it start relative to product use
  }

  // Treatment recommendations
  treatment: {
    immediate: string[] // Stop using X, apply Y
    spotTreatments: ProductSuggestion[]
    healingProducts: ProductSuggestion[]
    avoidIngredients: string[]
    expectedRecovery: string
  }

  // Prevention for future
  prevention: {
    recommendations: string[]
    productsToAdd: ProductSuggestion[]
    lifestyleChanges: string[]
  }

  createdAt: Date
}

export interface ScannedProduct {
  id: string
  userId: string
  barcode: string

  // Product information
  product: {
    name: string
    brand: string
    category: string
    size: string
    retailPrice: number
    storeLocation: string
  }

  // Bailey's price intelligence
  priceComparison: {
    inStore: number
    online: {
      amazon?: number
      sephora?: number
      ulta?: number
      brand?: number
      lowest: {
        price: number
        retailer: string
        savings: number
      }
    }
    verdict: 'good-deal' | 'overpriced' | 'fair'
  }

  // Bailey's ingredient analysis
  ingredients: {
    list: string
    cleanlinessScore: number
    beneficial: string[]
    concerning: string[]
    userAllergies?: string[] // Flagged based on user profile
  }

  // Bailey's personalized recommendation
  recommendation: {
    userNeedsThis: boolean
    reason: string
    similarOwned?: CurrentRoutineProduct[]
    betterAlternatives?: ProductSuggestion[]
    duplicateIngredients?: string[]
    wouldConflictWith?: string[]
  }

  scannedAt: Date
}