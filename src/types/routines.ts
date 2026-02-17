import type { Product } from './database'

export interface RoutineStep {
  order: number
  product: Product
  category: string
  timing: string
  frequency: 'daily' | 'every_other_day' | 'twice_week' | 'weekly'
  notes: string | null
  wait_time_seconds: number | null
}

export interface RoutineRecommendation {
  am_routine: RoutineStep[]
  pm_routine: RoutineStep[]
  weekly_treatments: RoutineStep[]
  skin_cycling_schedule: SkinCyclingDay[] | null
  conflicts_detected: IngredientConflictWarning[]
  rationale: string
}

export interface SkinCyclingDay {
  day_number: number
  day_name: string
  focus: 'exfoliation' | 'retinoid' | 'recovery' | 'hydration'
  products: RoutineStep[]
}

export interface IngredientConflictWarning {
  ingredient_a: string
  ingredient_b: string
  severity: 'low' | 'medium' | 'high' | 'critical'
  description: string
  recommendation: string
  affected_products: string[]
}
