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
      // Clear local state immediately
      setUser(null)
      setUserProfile(null)
      setLoading(false)

      // Clear any localStorage data that might persist auth state
      if (typeof window !== 'undefined') {
        // Clear all localStorage entries that might contain auth data
        const keysToRemove = []
        for (let i = 0; i < localStorage.length; i++) {
          const key = localStorage.key(i)
          if (key && (key.includes('supabase') || key.includes('auth') || key.includes('session'))) {
            keysToRemove.push(key)
          }
        }
        keysToRemove.forEach(key => localStorage.removeItem(key))

        // Also clear sessionStorage
        sessionStorage.clear()
      }

      // Use Supabase's signout with scope: 'global' to clear all sessions
      await supabaseClient.auth.signOut({ scope: 'global' })

      // Force a complete page reload to ensure clean state
      window.location.replace('/')
    } catch (error) {
      console.error('Error during signout:', error)
      // Even if there's an error, force redirect
      window.location.replace('/')
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

      // Only handle SIGNED_IN and SIGNED_OUT events to avoid unnecessary updates
      if (event === 'SIGNED_OUT') {
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