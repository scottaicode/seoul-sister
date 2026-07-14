'use client'

import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import type { User, Session } from '@supabase/supabase-js'
import { supabase } from '@/lib/supabase'
import { captureAttribution, getAttribution } from '@/lib/attribution'

interface AuthContextType {
  user: User | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<Session | null>
  signUp: (email: string, password: string) => Promise<{ user: User | null; session: Session | null }>
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    // Record first-touch attribution on the visitor's FIRST landing — which is
    // usually long before they create an account. Idempotent; never overwrites
    // an existing first touch; fails silent if localStorage is unavailable.
    captureAttribution()

    supabase.auth.getSession().then(({ data: { session } }) => {
      setUser(session?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null)
        setLoading(false)
      }
    )

    return () => subscription.unsubscribe()
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    return data.session
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    // First-touch attribution rides along with account creation. This is the one
    // chokepoint EVERY signup passes through, regardless of which code path
    // later creates the ss_user_profiles row (the Yuri onboarding flow uses a
    // server-side service client and never sees the browser's localStorage).
    // Landing it in auth.users.raw_user_meta_data means it survives to be read
    // server-side, whichever path gets there.
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { attribution: getAttribution() ?? undefined } },
    })
    if (error) throw error
    return { user: data.user, session: data.session }
  }, [])

  const signInWithGoogle = useCallback(async () => {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
        // Same attribution payload on the OAuth path, so a Google signup from
        // Bailey's bio link is credited identically to an email signup.
        queryParams: {},
        data: { attribution: getAttribution() ?? undefined },
      } as Parameters<typeof supabase.auth.signInWithOAuth>[0]['options'],
    })
    if (error) throw error
  }, [])

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut()
    if (error) throw error
  }, [])

  return (
    <AuthContext.Provider value={{ user, loading, signIn, signUp, signInWithGoogle, signOut }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
