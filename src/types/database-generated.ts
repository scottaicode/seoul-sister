// Generated database types based on the price intelligence migration
// This provides complete type safety for all tables

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      products: {
        Row: {
          id: string
          name_korean: string
          name_english: string
          brand: string
          seoul_price: number | null // Deprecated
          best_price_found: number | null
          best_retailer: string | null
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
          price_last_updated: string | null
          price_comparison: Json | null
        }
        Insert: {
          id?: string
          name_korean: string
          name_english: string
          brand: string
          seoul_price?: number | null
          best_price_found?: number | null
          best_retailer?: string | null
          us_price: number
          savings_percentage?: number
          category: string
          description?: string | null
          image_url?: string | null
          korean_site_url?: string | null
          us_site_url?: string | null
          ingredients?: string | null
          skin_type?: string | null
          created_at?: string
          updated_at?: string
          in_stock?: boolean
          popularity_score?: number
          price_last_updated?: string | null
          price_comparison?: Json | null
        }
        Update: {
          id?: string
          name_korean?: string
          name_english?: string
          brand?: string
          seoul_price?: number | null
          best_price_found?: number | null
          best_retailer?: string | null
          us_price?: number
          savings_percentage?: number
          category?: string
          description?: string | null
          image_url?: string | null
          korean_site_url?: string | null
          us_site_url?: string | null
          ingredients?: string | null
          skin_type?: string | null
          created_at?: string
          updated_at?: string
          in_stock?: boolean
          popularity_score?: number
          price_last_updated?: string | null
          price_comparison?: Json | null
        }
      }
      retailer_trust_scores: {
        Row: {
          id: string
          retailer_name: string
          authenticity_score: number | null
          shipping_score: number | null
          customer_service_score: number | null
          overall_trust_rating: number | null
          total_reviews: number
          last_updated: string
          created_at: string
        }
        Insert: {
          id?: string
          retailer_name: string
          authenticity_score?: number | null
          shipping_score?: number | null
          customer_service_score?: number | null
          overall_trust_rating?: number | null
          total_reviews?: number
          last_updated?: string
          created_at?: string
        }
        Update: {
          id?: string
          retailer_name?: string
          authenticity_score?: number | null
          shipping_score?: number | null
          customer_service_score?: number | null
          overall_trust_rating?: number | null
          total_reviews?: number
          last_updated?: string
          created_at?: string
        }
      }
      price_tracking_history: {
        Row: {
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
        Insert: {
          id?: string
          product_id: string
          retailer: string
          price: number
          currency?: string
          availability?: boolean
          shipping_cost?: number | null
          total_cost?: number | null
          promotion_info?: string | null
          tracked_at?: string
          created_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          retailer?: string
          price?: number
          currency?: string
          availability?: boolean
          shipping_cost?: number | null
          total_cost?: number | null
          promotion_info?: string | null
          tracked_at?: string
          created_at?: string
        }
      }
      affiliate_links: {
        Row: {
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
        Insert: {
          id?: string
          product_id: string
          retailer: string
          affiliate_url: string
          direct_url: string
          commission_rate?: number
          is_active?: boolean
          click_count?: number
          conversion_count?: number
          total_revenue?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          product_id?: string
          retailer?: string
          affiliate_url?: string
          direct_url?: string
          commission_rate?: number
          is_active?: boolean
          click_count?: number
          conversion_count?: number
          total_revenue?: number
          created_at?: string
          updated_at?: string
        }
      }
      deal_alerts: {
        Row: {
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
        Insert: {
          id?: string
          user_id: string
          product_id: string
          target_price?: number | null
          alert_when_available?: boolean
          alert_on_any_discount?: boolean
          is_active?: boolean
          last_triggered?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          target_price?: number | null
          alert_when_available?: boolean
          alert_on_any_discount?: boolean
          is_active?: boolean
          last_triggered?: string | null
          created_at?: string
        }
      }
      wishlists: {
        Row: {
          id: string
          user_id: string
          product_id: string
          added_at: string
          notes: string | null
          priority: number
        }
        Insert: {
          id?: string
          user_id: string
          product_id: string
          added_at?: string
          notes?: string | null
          priority?: number
        }
        Update: {
          id?: string
          user_id?: string
          product_id?: string
          added_at?: string
          notes?: string | null
          priority?: number
        }
      }
      // Existing tables
      profiles: {
        Row: {
          id: string
          email: string
          whatsapp_number: string | null
          stripe_customer_id: string | null
          korean_preferences: Json | null
          created_at: string
          updated_at: string
          first_name: string | null
          last_name: string | null
          phone: string | null
          instagram_handle: string | null
          referral_code: string | null
          referred_by: string | null
          total_savings: number
          order_count: number
          viral_shares_count: number
          last_order_date: string | null
          stripe_subscription_id: string | null
          subscription_status: string | null
          trial_end: string | null
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean | null
        }
        Insert: {
          id?: string
          email: string
          whatsapp_number?: string | null
          stripe_customer_id?: string | null
          korean_preferences?: Json | null
          created_at?: string
          updated_at?: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          instagram_handle?: string | null
          referral_code?: string | null
          referred_by?: string | null
          total_savings?: number
          order_count?: number
          viral_shares_count?: number
          last_order_date?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          trial_end?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean | null
        }
        Update: {
          id?: string
          email?: string
          whatsapp_number?: string | null
          stripe_customer_id?: string | null
          korean_preferences?: Json | null
          created_at?: string
          updated_at?: string
          first_name?: string | null
          last_name?: string | null
          phone?: string | null
          instagram_handle?: string | null
          referral_code?: string | null
          referred_by?: string | null
          total_savings?: number
          order_count?: number
          viral_shares_count?: number
          last_order_date?: string | null
          stripe_subscription_id?: string | null
          subscription_status?: string | null
          trial_end?: string | null
          current_period_start?: string | null
          current_period_end?: string | null
          cancel_at_period_end?: boolean | null
        }
      }
    }
    Views: {
      price_intelligence_summary: {
        Row: {
          id: string
          name_english: string
          brand: string
          best_price_found: number | null
          best_retailer: string | null
          msrp: number
          savings_percentage: number | null
          price_last_updated: string | null
          retailers_tracked: number
          lowest_price_30d: number | null
          highest_price_30d: number | null
          average_price_30d: number | null
        }
      }
    }
    Functions: {
      update_best_price: {
        Args: Record<string, never>
        Returns: void
      }
    }
    Enums: {
      [_ in never]: never
    }
  }
}