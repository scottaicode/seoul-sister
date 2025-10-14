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
      storage: typeof window !== 'undefined' ? {
        getItem: (key: string) => {
          try {
            // Try localStorage first
            const item = window.localStorage.getItem(key)
            if (item) return item

            // Fallback to cookies for Firefox
            const cookies = document.cookie.split('; ')
            const cookie = cookies.find(c => c.startsWith(`${key}=`))
            return cookie ? decodeURIComponent(cookie.split('=')[1]) : null
          } catch (error) {
            console.warn('Storage getItem error:', error)
            return null
          }
        },
        setItem: (key: string, value: string) => {
          try {
            // Set in localStorage
            window.localStorage.setItem(key, value)

            // Always set as cookie for better persistence
            const isSecure = window.location.protocol === 'https:'
            const cookieOptions = isSecure
              ? `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=None; Secure`
              : `${key}=${encodeURIComponent(value)}; path=/; max-age=31536000; SameSite=Lax`
            document.cookie = cookieOptions
          } catch (error) {
            console.warn('Storage setItem error:', error)
          }
        },
        removeItem: (key: string) => {
          try {
            // Remove from localStorage
            window.localStorage.removeItem(key)

            // Remove cookie
            document.cookie = `${key}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT`
          } catch (error) {
            console.warn('Storage removeItem error:', error)
          }
        }
      } : undefined
    }
  })

  return browserClient
}