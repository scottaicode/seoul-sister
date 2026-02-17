import type { Product, ProductCategory, Ingredient } from './database'

export interface ProductWithIngredients extends Product {
  ingredients: ProductIngredientDetail[]
}

export interface ProductIngredientDetail {
  ingredient: Ingredient
  position: number
  concentration_pct: number | null
}

export interface ProductSearchFilters {
  query?: string
  category?: ProductCategory
  brand?: string
  min_price?: number
  max_price?: number
  min_rating?: number
  skin_type?: string
  concern?: string
  sort_by?: 'price_asc' | 'price_desc' | 'rating' | 'newest' | 'trending'
  page?: number
  limit?: number
}

export interface ProductSearchResult {
  products: Product[]
  total: number
  page: number
  total_pages: number
}

export interface PriceComparison {
  product: Product
  prices: RetailerPrice[]
  best_deal: RetailerPrice | null
  korea_price_usd: number | null
  us_avg_price: number | null
  savings_pct: number | null
}

export interface RetailerPrice {
  retailer_name: string
  retailer_url: string
  price_usd: number
  in_stock: boolean
  is_affiliate: boolean
  last_checked: string
}

export interface ScanResult {
  extracted_text: string
  product_match: Product | null
  ingredients: ScannedIngredient[]
  safety_score: number
  conflicts: string[]
  recommendations: string[]
}

export interface ScannedIngredient {
  name_inci: string
  name_en: string
  name_ko: string | null
  function: string
  safety_rating: number
  comedogenic_rating: number
  concerns: string[]
}
