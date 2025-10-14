'use client'

import { createContext, useContext, useEffect, useState, useRef, useCallback } from 'react'
import { createClient } from '@/lib/supabase'
import type { User, AuthChangeEvent, Session } from '@supabase/supabase-js'
import type { UserProfile } from '@/types/user'

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
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
      try {
        // Get initial session
        const { data: { session }, error } = await supabaseClient.auth.getSession()

        if (isCancelled) return

        if (session?.user && mountedRef.current) {
          setUser(session.user)
          // Load profile in background
          fetchUserProfile(session.user.id).then(profile => {
            if (mountedRef.current && !isCancelled) {
              setUserProfile(profile)
            }
          })
        }

        if (mountedRef.current) {
          setLoading(false)
        }
      } catch (error) {
        if (mountedRef.current) {
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

  const value = {
    user,
    userProfile,
    loading,
    signOut,
    refreshProfile,
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