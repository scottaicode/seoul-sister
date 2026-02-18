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

export const productSearchSchema = z.object({
  query: z.string().optional(),
  category: z.string().optional(),
  brand: z.string().optional(),
  min_price: z.number().min(0).optional(),
  max_price: z.number().min(0).optional(),
  min_rating: z.number().min(1).max(5).optional(),
  skin_type: z.string().optional(),
  concern: z.string().optional(),
  sort_by: z.enum(['price_asc', 'price_desc', 'rating', 'newest', 'trending']).optional(),
  page: z.number().min(1).optional().default(1),
  limit: z.number().min(1).max(50).optional().default(20),
})
