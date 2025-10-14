'use client'

import { createContext, useContext, useEffect, useState, useRef } from 'react'
import { createClient } from '@/lib/supabase'
import type { User } from '@supabase/supabase-js'
import type { UserProfile } from '@/types/user'

interface AuthContextType {
  user: User | null
  userProfile: UserProfile | null
  loading: boolean
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)

  const supabase = createClient()
  const initializationRef = useRef(false)
  const subscriptionRef = useRef<any>(null)

  console.log('🔄 AuthProvider component mounted/re-rendered', 'Already initialized:', initializationRef.current)

  const fetchUserProfile = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from('user_profiles')
        .select('*')
        .eq('id', userId)
        .single()

      if (error) {
        // Don't block authentication for profile errors
        console.log('Profile not found or error:', error.message)
        return null
      }

      return data
    } catch (error) {
      console.log('Error fetching user profile:', error)
      return null
    }
  }

  const refreshProfile = async () => {
    if (user) {
      const profile = await fetchUserProfile(user.id)
      setUserProfile(profile)
    }
  }

  const signOut = async () => {
    console.log('🚪 SIGNOUT CALLED - Manual logout initiated', 'URL:', window.location.href)
    console.trace('Signout call stack:')

    try {
      // Use Supabase's built-in signout which handles everything properly
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Supabase signout error:', error)
      } else {
        console.log('✅ Supabase signout successful')
      }
    } catch (error) {
      console.error('Error during signout:', error)
    }

    // Clear local state
    setUser(null)
    setUserProfile(null)

    // Navigate to home page (let Supabase handle the cleanup)
    console.log('🏠 Redirecting to homepage after signout')
    window.location.href = '/'
  }

  useEffect(() => {
    console.log('⚡ AuthProvider useEffect triggered - setting up auth listeners')

    // Prevent double initialization in StrictMode
    if (initializationRef.current) {
      console.log('🚫 Already initialized, skipping setup')
      return
    }

    initializationRef.current = true
    console.log('✅ First initialization, proceeding with setup')

    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('🚀 Getting initial session... URL:', window.location.href)
        const { data: { session }, error } = await supabase.auth.getSession()
        console.log('📊 Initial session result:', session?.user?.email, error, 'URL:', window.location.href)

        if (session?.user) {
          console.log('✅ Setting user from initial session:', session.user.email, 'URL:', window.location.href)
          setUser(session.user)
          // Don't wait for profile - load it in background
          fetchUserProfile(session.user.id).then(profile => {
            console.log('📋 Profile loaded from initial:', profile?.name)
            setUserProfile(profile)
          })
        } else {
          console.log('❌ No initial session found', 'URL:', window.location.href)
        }
      } catch (error) {
        console.log('⚠️ Error getting initial session:', error, 'URL:', window.location.href)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const authStateChange = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      console.log('🔑 Auth state change:', event, session?.user?.email || 'no user', 'URL:', window.location.href)

      if (event === 'SIGNED_OUT') {
        console.log('⚠️ SIGNED_OUT event triggered - clearing state', 'URL:', window.location.href)
        setUser(null)
        setUserProfile(null)
      } else if (session?.user) {
        console.log('✅ Setting user from auth change:', session.user.email, 'URL:', window.location.href)
        setUser(session.user)
        // Load profile in background, don't block
        fetchUserProfile(session.user.id).then(profile => {
          console.log('📋 Profile loaded from auth change:', profile?.name)
          setUserProfile(profile)
        })
      } else {
        console.log('❌ No session in auth change - clearing state', 'URL:', window.location.href)
        setUser(null)
        setUserProfile(null)
      }
      setLoading(false)
    })

    subscriptionRef.current = authStateChange.data.subscription

    return () => {
      console.log('🧹 AuthProvider cleanup - unsubscribing from auth changes')
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }
      initializationRef.current = false
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