export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          email: string
          whatsapp_number: string | null
          stripe_customer_id: string | null
          korean_preferences: any | null
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
        }
        Insert: {
          id?: string
          email: string
          whatsapp_number?: string | null
          stripe_customer_id?: string | null
          korean_preferences?: any | null
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
        }
        Update: {
          id?: string
          email?: string
          whatsapp_number?: string | null
          stripe_customer_id?: string | null
          korean_preferences?: any | null
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
        }
      }
      products: {
        Row: {
          id: string
          name_korean: string
          name_english: string
          brand: string
          seoul_price: number
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
        }
        Insert: {
          id?: string
          name_korean: string
          name_english: string
          brand: string
          seoul_price: number
          us_price: number
          savings_percentage: number
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
        }
        Update: {
          id?: string
          name_korean?: string
          name_english?: string
          brand?: string
          seoul_price?: number
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
        }
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
        Insert: {
          id?: string
          customer_id: string
          product_id?: string | null
          product_name: string
          seoul_price: number
          service_fee: number
          total_amount: number
          status?: 'pending' | 'confirmed' | 'purchased' | 'shipped' | 'delivered' | 'cancelled'
          tracking_number?: string | null
          whatsapp_conversation_id?: string | null
          stripe_payment_intent_id?: string | null
          created_at?: string
          updated_at?: string
          estimated_delivery?: string | null
          notes?: string | null
          quantity?: number
          ai_confidence_score?: number | null
        }
        Update: {
          id?: string
          customer_id?: string
          product_id?: string | null
          product_name?: string
          seoul_price?: number
          service_fee?: number
          total_amount?: number
          status?: 'pending' | 'confirmed' | 'purchased' | 'shipped' | 'delivered' | 'cancelled'
          tracking_number?: string | null
          whatsapp_conversation_id?: string | null
          stripe_payment_intent_id?: string | null
          created_at?: string
          updated_at?: string
          estimated_delivery?: string | null
          notes?: string | null
          quantity?: number
          ai_confidence_score?: number | null
        }
      }
      ai_customer_insights: {
        Row: {
          id: string
          user_id: string
          skin_analysis: any | null
          preference_vector: any | null
          predicted_purchases: any | null
          conversation_history: any | null
          sentiment_analysis: any | null
          reorder_predictions: any | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          skin_analysis?: any | null
          preference_vector?: any | null
          predicted_purchases?: any | null
          conversation_history?: any | null
          sentiment_analysis?: any | null
          reorder_predictions?: any | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string
          skin_analysis?: any | null
          preference_vector?: any | null
          predicted_purchases?: any | null
          conversation_history?: any | null
          sentiment_analysis?: any | null
          reorder_predictions?: any | null
          created_at?: string
          updated_at?: string
        }
      }
      korean_suppliers: {
        Row: {
          id: string
          company_name: string
          contact_info: any | null
          product_categories: string[]
          wholesale_pricing: any | null
          relationship_status: 'prospect' | 'contacted' | 'negotiating' | 'active' | 'inactive'
          ai_communication_log: any | null
          performance_metrics: any | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          company_name: string
          contact_info?: any | null
          product_categories: string[]
          wholesale_pricing?: any | null
          relationship_status?: 'prospect' | 'contacted' | 'negotiating' | 'active' | 'inactive'
          ai_communication_log?: any | null
          performance_metrics?: any | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          company_name?: string
          contact_info?: any | null
          product_categories?: string[]
          wholesale_pricing?: any | null
          relationship_status?: 'prospect' | 'contacted' | 'negotiating' | 'active' | 'inactive'
          ai_communication_log?: any | null
          performance_metrics?: any | null
          created_at?: string
          updated_at?: string
        }
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
  }
}