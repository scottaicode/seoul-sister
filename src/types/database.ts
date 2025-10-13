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
      whatsapp_messages: {
        Row: {
          id: string
          phone_number: string
          message_text: string
          message_type: string
          message_id: string
          timestamp: string
          metadata: any | null
          created_at: string
        }
        Insert: {
          id?: string
          phone_number: string
          message_text: string
          message_type: string
          message_id: string
          timestamp: string
          metadata?: any | null
          created_at?: string
        }
        Update: {
          id?: string
          phone_number?: string
          message_text?: string
          message_type?: string
          message_id?: string
          timestamp?: string
          metadata?: any | null
          created_at?: string
        }
      }
      user_skin_profiles: {
        Row: {
          id: string
          whatsapp_number: string
          current_skin_type: string | null
          skin_concerns: string[]
          preferred_categories: string[]
          last_analysis_date: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          whatsapp_number: string
          current_skin_type?: string | null
          skin_concerns?: string[]
          preferred_categories?: string[]
          last_analysis_date?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          whatsapp_number?: string
          current_skin_type?: string | null
          skin_concerns?: string[]
          preferred_categories?: string[]
          last_analysis_date?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      conversation_context: {
        Row: {
          id: string
          phone_number: string
          context_type: string
          context_data: any | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          phone_number: string
          context_type: string
          context_data?: any | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          phone_number?: string
          context_type?: string
          context_data?: any | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
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
        Insert: {
          id?: string
          phone_number: string
          product_brand?: string | null
          product_name?: string | null
          category?: string | null
          timestamp?: string
        }
        Update: {
          id?: string
          phone_number?: string
          product_brand?: string | null
          product_name?: string | null
          category?: string | null
          timestamp?: string
        }
      }
      whatsapp_conversations: {
        Row: {
          id: string
          phone_number: string
          message_type: string | null
          message_content: any | null
          timestamp: string
        }
        Insert: {
          id?: string
          phone_number: string
          message_type?: string | null
          message_content?: any | null
          timestamp?: string
        }
        Update: {
          id?: string
          phone_number?: string
          message_type?: string | null
          message_content?: any | null
          timestamp?: string
        }
      }
      whatsapp_outbound_queue: {
        Row: {
          id: string
          to: string
          message: string
          status: string
          attempts: number
          last_attempt: string | null
          created_at: string
        }
        Insert: {
          id?: string
          to: string
          message: string
          status?: string
          attempts?: number
          last_attempt?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          to?: string
          message?: string
          status?: string
          attempts?: number
          last_attempt?: string | null
          created_at?: string
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