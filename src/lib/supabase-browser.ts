import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { Database } from '@/types/database'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Create a singleton instance with proper browser-specific settings
let browserClient: ReturnType<typeof createSupabaseClient<Database>> | null = null

export function createBrowserClient() {
  if (browserClient) {
    return browserClient
  }

  browserClient = createSupabaseClient<Database>(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: true,
      storage: {
        // Use localStorage with fallback to cookies for Firefox
        getItem: (key: string) => {
          if (typeof window === 'undefined') {
            return null
          }

          // Try localStorage first
          const item = window.localStorage.getItem(key)
          if (item) return item

          // Fallback to cookies for Firefox
          const cookies = document.cookie.split('; ')
          const cookie = cookies.find(c => c.startsWith(`${key}=`))
          return cookie ? decodeURIComponent(cookie.split('=')[1]) : null
        },
        setItem: (key: string, value: string) => {
          if (typeof window === 'undefined') {
            return
          }

          // Set in localStorage
          window.localStorage.setItem(key, value)

          // Also set as cookie for Firefox with SameSite=Lax
          document.cookie = `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`
        },
        removeItem: (key: string) => {
          if (typeof window === 'undefined') {
            return
          }

          // Remove from localStorage
          window.localStorage.removeItem(key)

          // Remove cookie
          document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax`
        }
      }
    }
  })

  return browserClient
}