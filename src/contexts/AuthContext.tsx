'use client'

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'

// Add immediate client-side debug
if (typeof window !== 'undefined') {
  console.log('🌐 AuthContext: Client-side script loaded')
}
import { createClient } from '@/lib/supabase'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { UserProfile } from '@/types/user'

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshAuth: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Create a stable Supabase client outside the component
const supabaseClient = createClient()

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const mountedRef = useRef(true)
  const authListenerRef = useRef<any>(null)

  // Simple timeout failsafe - 5 seconds max
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (mountedRef.current && loading) {
        console.log('Auth timeout reached, forcing loading to false')
        setLoading(false)
      }
    }, 5000)
    return () => clearTimeout(timeout)
  }, [])

  const fetchUserProfile = useCallback(async (userId: string) => {
    if (!mountedRef.current) return null

    try {
      const { data, error } = await supabaseClient
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        return null
      }

      return data
    } catch (error) {
      return null
    }
  }, [])

  const refreshProfile = useCallback(async () => {
    if (user && mountedRef.current) {
      const profile = await fetchUserProfile(user.id)
      if (mountedRef.current) {
        setUserProfile(profile)
      }
    }
  }, [user, fetchUserProfile])

  const refreshAuth = useCallback(async () => {
    try {
      const { data: { session }, error } = await supabaseClient.auth.getSession()

      if (session?.user && mountedRef.current) {
        setUser(session.user)
        const profile = await fetchUserProfile(session.user.id)
        if (mountedRef.current) {
          setUserProfile(profile)
        }
      } else {
        if (mountedRef.current) {
          setUser(null)
          setUserProfile(null)
        }
      }

      if (mountedRef.current) {
        setLoading(false)
      }
    } catch (error) {
      console.error('Error refreshing auth:', error)
      if (mountedRef.current) {
        setLoading(false)
      }
    }
  }, [fetchUserProfile])

  const signOut = useCallback(async () => {
    try {
      // Use Supabase's signout
      await supabaseClient.auth.signOut()

      // Clear local state
      setUser(null)
      setUserProfile(null)

      // Navigate to home page
      window.location.href = '/'
    } catch (error) {
      console.error('Error during signout:', error)
      // Even if there's an error, still navigate away
      window.location.href = '/'
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    const initializeAuth = async () => {
      console.log('InitializeAuth called at', window.location.pathname)
      try {
        // Get initial session - refresh it to ensure it's current
        const { data: { session }, error } = await supabaseClient.auth.getSession()
        console.log('InitializeAuth: Session check result:', {
          hasUser: !!session?.user,
          email: session?.user?.email,
          error
        })

        if (isCancelled) return

        if (session?.user && mountedRef.current) {
          console.log('InitializeAuth: Setting user state for', session.user.email)
          setUser(session.user)
          // Load profile in background
          fetchUserProfile(session.user.id).then(profile => {
            if (mountedRef.current && !isCancelled) {
              console.log('InitializeAuth: Profile loaded for', session.user.email)
              setUserProfile(profile)
            }
          })
        } else {
          console.log('InitializeAuth: No user found, clearing state')
          if (mountedRef.current) {
            setUser(null)
            setUserProfile(null)
          }
        }

        if (mountedRef.current) {
          console.log('InitializeAuth: Setting loading to false')
          setLoading(false)
        }
      } catch (error) {
        console.error('InitializeAuth error:', error)
        if (mountedRef.current) {
          setLoading(false)
        }
      }
    }

    // Setup auth state listener
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      console.log('Auth state change:', {
        event,
        hasUser: !!session?.user,
        email: session?.user?.email,
        path: window.location.pathname
      })
      if (isCancelled) return

      // Be more conservative about state changes to prevent accidental logouts
      if (event === 'SIGNED_OUT') {
        console.log('Auth: User signed out, clearing state')
        // Only clear state if it's an explicit signout, not a session refresh
        if (mountedRef.current) {
          setUser(null)
          setUserProfile(null)
        }
      } else if (event === 'SIGNED_IN' && session?.user) {
        console.log('Auth: User signed in, updating state for', session.user.email)
        if (mountedRef.current) {
          setUser(session.user)
          // Load profile in background
          fetchUserProfile(session.user.id).then(profile => {
            if (mountedRef.current && !isCancelled) {
              setUserProfile(profile)
            }
          })
        }
      } else if (event === 'TOKEN_REFRESHED' && session?.user) {
        console.log('Auth: Token refreshed, maintaining user state for', session.user.email)
        // Token refresh - keep user logged in
        if (mountedRef.current && !user) {
          setUser(session.user)
          fetchUserProfile(session.user.id).then(profile => {
            if (mountedRef.current && !isCancelled) {
              setUserProfile(profile)
            }
          })
        }
      } else if (session?.user && mountedRef.current) {
        console.log('Auth: Session exists, preserving user state for', session.user.email)
        // Session exists, preserve the user state
        setUser(session.user)
      }

      if (mountedRef.current) {
        console.log('Auth listener: Setting loading to false')
        setLoading(false)
      }
    })

    authListenerRef.current = subscription
    initializeAuth()

    return () => {
      isCancelled = true
      mountedRef.current = false
      if (authListenerRef.current) {
        authListenerRef.current.unsubscribe()
        authListenerRef.current = null
      }
    }
  }, [])

  const value = {
    user,
    userProfile,
    loading,
    signOut,
    refreshProfile,
    refreshAuth,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  console.log('🔍 useAuth: Hook called, context:', {
    contextExists: !!context,
    hasUser: !!context?.user,
    loading: context?.loading
  })
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}