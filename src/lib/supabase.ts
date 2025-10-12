import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

let supabase: any = null
let supabaseAdmin: any = null

try {
  if (supabaseUrl && supabaseAnonKey) {
    supabase = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: true,
        persistSession: true,
        detectSessionInUrl: true
      }
    })

    // Only create admin client server-side
    if (typeof window === 'undefined' && process.env.SUPABASE_SERVICE_ROLE_KEY) {
      supabaseAdmin = createSupabaseClient<Database>(
        supabaseUrl,
        process.env.SUPABASE_SERVICE_ROLE_KEY,
        {
          auth: {
            autoRefreshToken: false,
            persistSession: false
          }
        }
      )
    }
  } else {
    console.warn('Supabase environment variables not configured:', {
      hasUrl: !!supabaseUrl,
      hasKey: !!supabaseAnonKey
    })
  }
} catch (error) {
  console.error('Failed to initialize Supabase client:', error)
}

// Export the clients
export { supabase, supabaseAdmin }

// Export a createClient function for auth components
export const createClient = () => {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Check environment variables.')
  }
  return supabase
}