'use client'

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import { handleAuthError, AuthenticationError } from '@/lib/auth-utils'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { UserProfile } from '@/types/user'

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  error: string | null
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
  refreshAuth: () => Promise<void>
  clearError: () => void
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

// Create a stable Supabase client outside the component
const supabaseClient = createClient()

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const mountedRef = useRef(true)
  const authListenerRef = useRef<any>(null)

  // Simple timeout failsafe - 5 seconds max
  useEffect(() => {
    const timeout = setTimeout(() => {
      if (mountedRef.current && loading) {
        setLoading(false)
      }
    }, 5000)
    return () => clearTimeout(timeout)
  }, [])

  const fetchUserProfile = useCallback(async (userId: string) => {
    if (!mountedRef.current) return null

    try {
      const { data, error } = await supabaseClient
        .from('profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        throw new AuthenticationError('Failed to fetch user profile', error.code, error)
      }

      return data
    } catch (err) {
      const authError = handleAuthError(err)
      if (mountedRef.current) {
        setError(authError.message)
      }
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

      if (error) {
        throw new AuthenticationError('Failed to get session', error.message)
      }

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
    } catch (err) {
      const authError = handleAuthError(err)
      if (mountedRef.current) {
        setError(authError.message)
        setLoading(false)
      }
    }
  }, [fetchUserProfile])

  const signOut = useCallback(async () => {
    try {
      const { error } = await supabaseClient.auth.signOut()

      if (error) {
        throw new AuthenticationError('Failed to sign out', error.message)
      }

      // Clear local state
      setUser(null)
      setUserProfile(null)
      setError(null)

      // Navigate to home page
      window.location.href = '/'
    } catch (err) {
      const authError = handleAuthError(err)
      setError(authError.message)
      // Even if there's an error, still navigate away
      window.location.href = '/'
    }
  }, [])

  useEffect(() => {
    let isCancelled = false

    const initializeAuth = async () => {
      try {
        // Get initial session - refresh it to ensure it's current
        const { data: { session }, error } = await supabaseClient.auth.getSession()

        if (error) {
          throw new AuthenticationError('Failed to initialize auth session', error.message)
        }

        if (isCancelled) return

        if (session?.user && mountedRef.current) {
          setUser(session.user)
          // Load profile in background
          fetchUserProfile(session.user.id).then(profile => {
            if (mountedRef.current && !isCancelled) {
              setUserProfile(profile)
            }
          })
        } else {
          if (mountedRef.current) {
            setUser(null)
            setUserProfile(null)
          }
        }

        if (mountedRef.current) {
          setLoading(false)
        }
      } catch (err) {
        const authError = handleAuthError(err)
        if (mountedRef.current) {
          setError(authError.message)
          setLoading(false)
        }
      }
    }

    // Setup auth state listener
    const { data: { subscription } } = supabaseClient.auth.onAuthStateChange(async (event: AuthChangeEvent, session: Session | null) => {
      if (isCancelled) return

      // Be more conservative about state changes to prevent accidental logouts
      if (event === 'SIGNED_OUT') {
        // Only clear state if it's an explicit signout, not a session refresh
        if (mountedRef.current) {
          setUser(null)
          setUserProfile(null)
        }
      } else if (event === 'SIGNED_IN' && session?.user) {
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
        // Session exists, preserve the user state
        setUser(session.user)
      }

      if (mountedRef.current) {
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

  const clearError = useCallback(() => {
    setError(null)
  }, [])

  const value = {
    user,
    userProfile,
    loading,
    error,
    signOut,
    refreshProfile,
    refreshAuth,
    clearError,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}