'use client'

import { useState, useEffect } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'

export function useAuthState() {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [initialized, setInitialized] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    let mounted = true

    const checkUser = async () => {
      try {
        // Check for existing session
        const { data: { session } } = await supabase.auth.getSession()

        if (mounted) {
          console.log('useAuthState: Session check:', {
            hasSession: !!session,
            email: session?.user?.email,
            path: window.location.pathname
          })

          if (session?.user) {
            setUser(session.user)
            // Also store in localStorage for quick access
            localStorage.setItem('auth_user_email', session.user.email || '')
            localStorage.setItem('auth_user_id', session.user.id)
          } else {
            setUser(null)
            localStorage.removeItem('auth_user_email')
            localStorage.removeItem('auth_user_id')
          }

          setLoading(false)
          setInitialized(true)
        }
      } catch (error) {
        console.error('useAuthState: Error checking session:', error)
        if (mounted) {
          setLoading(false)
          setInitialized(true)
        }
      }
    }

    // Initial check
    checkUser()

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log('useAuthState: Auth state changed:', event, session?.user?.email)

      if (mounted) {
        if (session?.user) {
          setUser(session.user)
          localStorage.setItem('auth_user_email', session.user.email || '')
          localStorage.setItem('auth_user_id', session.user.id)
        } else {
          setUser(null)
          localStorage.removeItem('auth_user_email')
          localStorage.removeItem('auth_user_id')
        }
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signOut = async () => {
    const supabase = createClient()
    try {
      await supabase.auth.signOut()
      setUser(null)
      localStorage.removeItem('auth_user_email')
      localStorage.removeItem('auth_user_id')
      window.location.href = '/'
    } catch (error) {
      console.error('Error signing out:', error)
      window.location.href = '/'
    }
  }

  const refresh = async () => {
    const supabase = createClient()
    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (session?.user) {
        setUser(session.user)
        localStorage.setItem('auth_user_email', session.user.email || '')
        localStorage.setItem('auth_user_id', session.user.id)
      } else {
        setUser(null)
        localStorage.removeItem('auth_user_email')
        localStorage.removeItem('auth_user_id')
      }
    } catch (error) {
      console.error('Error refreshing auth:', error)
    }
  }

  return {
    user,
    loading: !initialized || loading,
    signOut,
    refresh,
    isAuthenticated: !!user
  }
}