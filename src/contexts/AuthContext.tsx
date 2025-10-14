'use client'

import { createContext, useContext, useEffect, useState } from 'react'
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
    console.log('Signing out...')

    try {
      // Use Supabase's built-in signout which handles everything properly
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error('Supabase signout error:', error)
      }
    } catch (error) {
      console.error('Error during signout:', error)
    }

    // Clear local state
    setUser(null)
    setUserProfile(null)

    // Navigate to home page (let Supabase handle the cleanup)
    window.location.href = '/'
  }

  useEffect(() => {
    // Get initial session
    const getInitialSession = async () => {
      try {
        console.log('Getting initial session...')
        const { data: { session }, error } = await supabase.auth.getSession()
        console.log('Initial session result:', session?.user?.email, error)

        if (session?.user) {
          console.log('Setting user from initial session:', session.user.email)
          setUser(session.user)
          // Don't wait for profile - load it in background
          fetchUserProfile(session.user.id).then(profile => {
            console.log('Profile loaded:', profile?.name)
            setUserProfile(profile)
          })
        } else {
          console.log('No initial session found')
        }
      } catch (error) {
        console.log('Error getting initial session:', error)
      } finally {
        setLoading(false)
      }
    }

    getInitialSession()

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: any, session: any) => {
      console.log('🔑 Auth state change:', event, session?.user?.email || 'no user')

      if (event === 'SIGNED_OUT') {
        console.log('User was signed out - clearing state')
        setUser(null)
        setUserProfile(null)
      } else if (session?.user) {
        console.log('Setting user from auth change:', session.user.email)
        setUser(session.user)
        // Load profile in background, don't block
        fetchUserProfile(session.user.id).then(profile => {
          console.log('Profile loaded from auth change:', profile?.name)
          setUserProfile(profile)
        })
      } else {
        console.log('No session in auth change - clearing state')
        setUser(null)
        setUserProfile(null)
      }
      setLoading(false)
    })

    return () => subscription.unsubscribe()
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