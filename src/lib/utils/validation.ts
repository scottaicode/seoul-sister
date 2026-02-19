import { z } from 'zod'

export const emailSchema = z.string().email('Invalid email address')

export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
  .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
  .regex(/[0-9]/, 'Password must contain at least one number')
  .regex(/[^A-Za-z0-9]/, 'Password must contain at least one special character')

export const skinProfileSchema = z.object({
  skin_type: z.enum(['oily', 'dry', 'combination', 'normal', 'sensitive']),
  skin_concerns: z.array(z.string()).min(1, 'Select at least one concern'),
  allergies: z.array(z.string()),
  fitzpatrick_scale: z.number().min(1).max(6),
  climate: z.enum(['humid', 'dry', 'temperate', 'tropical', 'cold']),
  age_range: z.enum(['13-17', '18-24', '25-30', '31-40', '41-50', '51+']),
  budget_range: z.enum(['budget', 'mid', 'premium', 'luxury']),
  experience_level: z.enum(['beginner', 'intermediate', 'advanced', 'expert']),
})

export type SkinProfileInput = z.infer<typeof skinProfileSchema>

export const reviewSchema = z.object({
  product_id: z.string().uuid(),
  rating: z.number().min(1).max(5),
  title: z.string().min(3).max(200),
  body: z.string().min(10).max(5000),
  reaction: z.enum(['holy_grail', 'good', 'okay', 'bad', 'broke_me_out']).optional(),
  would_repurchase: z.boolean().optional(),
  usage_duration: z.string().optional(),
})

export const reviewFilterSchema = z.object({
  product_id: z.string().uuid().optional(),
  skin_type: z.string().optional(),
  fitzpatrick_scale: z.number().min(1).max(6).optional(),
  age_range: z.string().optional(),
  concern: z.string().optional(),
  reaction: z.enum(['holy_grail', 'good', 'okay', 'bad', 'broke_me_out']).optional(),
  sort_by: z.enum(['newest', 'oldest', 'highest_rated', 'lowest_rated', 'most_helpful']).optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(50).optional().default(20),
})

export const trendingSearchSchema = z.object({
  query: z.string().min(1).max(200),
})

export const dupeFinderSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  max_dupes: z.number().min(1).max(20).optional().default(5),
  min_match_score: z.number().min(0).max(1).optional().default(0.3),
})

export const dupeAiSchema = z.object({
  product_name: z.string().min(1, 'Product name is required').max(200),
  budget_range: z.enum(['budget', 'mid', 'premium']).optional(),
})

export const trackingCreateSchema = z.object({
  product_id: z.string().uuid('Invalid product ID').optional(),
  custom_product_name: z.string().min(1).max(200).optional(),
  pao_months: z.number().int().min(1).max(60).optional(),
  opened_date: z.string().optional(),
  purchase_date: z.string().optional(),
  manufacture_date: z.string().optional(),
  batch_code: z.string().max(50).optional(),
  notes: z.string().max(500).optional(),
}).refine(
  (data) => data.product_id || data.custom_product_name,
  { message: 'Either product_id or custom_product_name is required' }
)

export const trackingUpdateSchema = z.object({
  status: z.enum(['active', 'expired', 'finished', 'discarded']).optional(),
  opened_date: z.string().optional(),
  pao_months: z.number().int().min(1).max(60).optional(),
  notes: z.string().max(500).optional(),
  batch_code: z.string().max(50).optional(),
})

export const sunscreenSearchSchema = z.object({
  skin_type: z.enum(['oily', 'dry', 'combination', 'sensitive', 'normal']).optional(),
  pa_rating: z.enum(['PA+', 'PA++', 'PA+++', 'PA++++']).optional(),
  white_cast: z.enum(['none', 'minimal', 'moderate', 'heavy']).optional(),
  finish: z.enum(['matte', 'dewy', 'natural', 'satin']).optional(),
  sunscreen_type: z.enum(['chemical', 'physical', 'hybrid']).optional(),
  under_makeup: z.boolean().optional(),
  water_resistant: z.boolean().optional(),
  activity: z.enum(['daily', 'outdoor', 'water_sports']).optional(),
  min_spf: z.number().min(1).optional(),
  sort_by: z.enum(['rating', 'price_asc', 'price_desc', 'spf']).optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(50).optional().default(20),
})

export const reformulationReportSchema = z.object({
  product_id: z.string().uuid('Invalid product ID'),
  change_type: z.enum(['reformulation', 'packaging', 'both', 'minor_tweak']),
  change_date: z.string().optional(),
  change_summary: z.string().max(500).optional(),
  ingredients_added: z.array(z.string()).optional().default([]),
  ingredients_removed: z.array(z.string()).optional().default([]),
  ingredients_reordered: z.boolean().optional().default(false),
})

export const productSearchSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  min_price: z.number().min(0).optional(),
  max_price: z.number().min(0).optional(),
  min_rating: z.number().min(1).max(5).optional(),
  skin_type: z.string().optional(),
  concern: z.string().optional(),
  include_ingredients: z.string().optional(),
  exclude_ingredients: z.string().optional(),
  fragrance_free: z.boolean().optional(),
  comedogenic_max: z.number().min(0).max(5).optional(),
  sort_by: z.enum(['price_asc', 'price_desc', 'rating', 'newest', 'trending']).optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(50).optional().default(20),
})
