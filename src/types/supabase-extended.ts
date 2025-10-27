// Extended Supabase types for new tables
// This file supplements the auto-generated types until they can be regenerated

export interface PriceTrackingHistory {
  id: string
  product_id: string
  retailer: string
  price: number
  currency: string
  availability: boolean
  shipping_cost: number | null
  total_cost: number | null
  promotion_info: string | null
  tracked_at: string
  created_at: string
}

export interface AffiliateLink {
  id: string
  product_id: string
  retailer: string
  affiliate_url: string
  direct_url: string
  commission_rate: number
  is_active: boolean
  click_count: number
  conversion_count: number
  total_revenue: number
  created_at: string
  updated_at: string
}

export interface RetailerTrustScore {
  id: string
  retailer_name: string
  authenticity_score: number
  shipping_score: number
  customer_service_score: number
  overall_trust_rating: number
  total_reviews: number
  last_updated: string
  created_at: string
}

export interface DealAlert {
  id: string
  user_id: string
  product_id: string
  target_price: number | null
  alert_when_available: boolean
  alert_on_any_discount: boolean
  is_active: boolean
  last_triggered: string | null
  created_at: string
}

export interface Wishlist {
  id: string
  user_id: string
  product_id: string
  added_at: string
  notes: string | null
  priority: number
}

// Extended product type with new fields
export interface ProductExtended {
  id: string
  name_korean: string
  name_english: string
  brand: string
  seoul_price?: number // Deprecated
  best_price_found: number
  best_retailer: string
  us_price: number
  savings_percentage: number
  category: string
  description: string | null
  image_url: string | null
  korean_site_url: string | null
  us_site_url: string | null
  ingredients: string | null
  skin_type: string | null
  created_at: string
  updated_at: string
  in_stock: boolean
  popularity_score: number
  price_last_updated: string
  price_comparison: any | null
}