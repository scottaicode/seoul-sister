/**
 * Database Type Definitions
 * Generated from Supabase schema
 */

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          whatsapp_number: string | null
          stripe_customer_id: string | null
          korean_preferences: Record<string, unknown> | null
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
          subscription_status: 'active' | 'trialing' | 'canceled' | 'past_due' | null
          trial_end: string | null
          current_period_start: string | null
          current_period_end: string | null
          cancel_at_period_end: boolean | null
          is_admin?: boolean
          is_super_admin?: boolean
        }
        Insert: Omit<Database['public']['Tables']['profiles']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['profiles']['Row']>
      }
      products: {
        Row: {
          id: string
          name_korean: string
          name_english: string
          brand: string
          seoul_price: number
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
          price_comparison: Record<string, {
            price: number
            url: string
            in_stock: boolean
            last_checked: string
          }> | null
        }
        Insert: Omit<Database['public']['Tables']['products']['Row'], 'id' | 'created_at' | 'updated_at' | 'popularity_score'> & {
          id?: string
          created_at?: string
          updated_at?: string
          popularity_score?: number
        }
        Update: Partial<Database['public']['Tables']['products']['Row']>
      }
      orders: {
        Row: {
          id: string
          customer_id: string
          product_id: string | null
          product_name: string
          seoul_price: number
          service_fee: number
          total_amount: number
          status: 'pending' | 'confirmed' | 'purchased' | 'shipped' | 'delivered' | 'cancelled'
          tracking_number: string | null
          whatsapp_conversation_id: string | null
          stripe_payment_intent_id: string | null
          created_at: string
          updated_at: string
          estimated_delivery: string | null
          notes: string | null
          quantity: number
          ai_confidence_score: number | null
        }
        Insert: Omit<Database['public']['Tables']['orders']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['orders']['Row']>
      }
      user_skin_profiles: {
        Row: {
          id: string
          whatsapp_number: string
          current_skin_type: 'dry' | 'oily' | 'combination' | 'normal' | 'sensitive' | null
          skin_concerns: string[]
          preferred_categories: string[]
          last_analysis_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: Omit<Database['public']['Tables']['user_skin_profiles']['Row'], 'id' | 'created_at' | 'updated_at'> & {
          id?: string
          created_at?: string
          updated_at?: string
        }
        Update: Partial<Database['public']['Tables']['user_skin_profiles']['Row']>
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
        Insert: Omit<Database['public']['Tables']['price_tracking_history']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['price_tracking_history']['Row']>
      }
      retailer_trust_scores: {
        Row: {
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
        Insert: Omit<Database['public']['Tables']['retailer_trust_scores']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['retailer_trust_scores']['Row']>
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
        Insert: Omit<Database['public']['Tables']['affiliate_links']['Row'], 'id' | 'created_at' | 'updated_at' | 'click_count' | 'conversion_count' | 'total_revenue'> & {
          id?: string
          created_at?: string
          updated_at?: string
          click_count?: number
          conversion_count?: number
          total_revenue?: number
        }
        Update: Partial<Database['public']['Tables']['affiliate_links']['Row']>
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
        Insert: Omit<Database['public']['Tables']['deal_alerts']['Row'], 'id' | 'created_at'> & {
          id?: string
          created_at?: string
        }
        Update: Partial<Database['public']['Tables']['deal_alerts']['Row']>
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
        Insert: Omit<Database['public']['Tables']['wishlists']['Row'], 'id' | 'added_at'> & {
          id?: string
          added_at?: string
        }
        Update: Partial<Database['public']['Tables']['wishlists']['Row']>
      }
      product_interests: {
        Row: {
          id: string
          phone_number: string
          product_brand: string | null
          product_name: string | null
          category: string | null
          timestamp: string
        }
        Insert: Omit<Database['public']['Tables']['product_interests']['Row'], 'id' | 'timestamp'> & {
          id?: string
          timestamp?: string
        }
        Update: Partial<Database['public']['Tables']['product_interests']['Row']>
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      subscription_status: 'active' | 'trialing' | 'canceled' | 'past_due'
      order_status: 'pending' | 'confirmed' | 'purchased' | 'shipped' | 'delivered' | 'cancelled'
      skin_type: 'dry' | 'oily' | 'combination' | 'normal' | 'sensitive'
    }
  }
}