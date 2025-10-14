'use client'

import { useState, useEffect, useCallback } from 'react'
import { createBrowserClient } from '@/lib/supabase-browser'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  const checkUser = useCallback(async () => {
    try {
      const supabase = createBrowserClient()

      // First try to get session immediately
      const { data: { session }, error } = await supabase.auth.getSession()

      if (error) {
        console.error('Error getting session:', error)
        setUser(null)
      } else if (session?.user) {
        setUser(session.user)
      } else {
        // Try to refresh session if no session found
        const { data: { session: refreshedSession }, error: refreshError } = await supabase.auth.refreshSession()

        if (refreshError) {
          console.warn('Session refresh failed:', refreshError)
          setUser(null)
        } else if (refreshedSession?.user) {
          setUser(refreshedSession.user)
        } else {
          setUser(null)
        }
      }
    } catch (error) {
      console.error('Error checking session:', error)
      setUser(null)
    } finally {
      setLoading(false)
      setInitialized(true)
    }
  }, [])

  useEffect(() => {
    let mounted = true

    // Add timeout to prevent infinite loading (especially for Firefox)
    const loadingTimeout = setTimeout(() => {
      if (mounted && loading) {
        console.log('Auth loading timeout reached, forcing loading to false')
        setLoading(false)
        setInitialized(true)
      }
    }, 3000) // 3 second timeout

    // Initial check
    checkUser()

    // Set up auth listener
    const supabase = createBrowserClient()
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event: AuthChangeEvent, session: Session | null) => {
        if (!mounted) return

        if (session?.user) {
          setUser(session.user)
        } else {
          setUser(null)
        }

        // Special handling for sign out
        if (event === 'SIGNED_OUT') {
          setUser(null)
        }

        // Ensure loading is set to false after any auth change
        setLoading(false)
        setInitialized(true)
      }
    )

    return () => {
      mounted = false
      clearTimeout(loadingTimeout)
      subscription.unsubscribe()
    }
  }, [checkUser])

  const signOut = async () => {
    try {
      const supabase = createBrowserClient()
      await supabase.auth.signOut()
      setUser(null)

      // Clear all auth-related storage
      if (typeof window !== 'undefined') {
        // Clear localStorage
        const keysToRemove = Object.keys(localStorage).filter(key =>
          key.startsWith('sb-') || key.includes('supabase')
        )
        keysToRemove.forEach(key => localStorage.removeItem(key))

        // Clear cookies
        document.cookie.split(';').forEach(cookie => {
          const [name] = cookie.split('=')
          if (name.trim().startsWith('sb-') || name.includes('supabase')) {
            document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/`
          }
        })

        // Redirect to home
        window.location.href = '/'
      }
    } catch (error) {
      console.error('Error signing out:', error)
      window.location.href = '/'
    }
  }

  const refresh = async () => {
    await checkUser()
  }

  return {
    user,
    loading: loading || !initialized,
    signOut,
    refresh,
    isAuthenticated: !!user && initialized
  }
}