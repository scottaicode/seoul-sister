'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthState } from '@/hooks/useAuthState'
import { createBrowserClient } from '@/lib/supabase-browser'
import type { Database } from '@/types/database'

type UserProfile = Database['public']['Tables']['profiles']['Row']
type UserSkinProfile = Database['public']['Tables']['user_skin_profiles']['Row']

export function useAuthenticatedUser() {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [skinProfile, setSkinProfile] = useState<UserSkinProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const { user, isAuthenticated } = useAuthState()

  const fetchUserProfile = useCallback(async () => {
    if (!user || !isAuthenticated) {
      setProfile(null)
      setSkinProfile(null)
      setLoading(false)
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createBrowserClient()

      // Fetch user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      if (profileError) {
        // If profile doesn't exist, create one
        if (profileError.code === 'PGRST116') {
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email || '',
              created_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
              total_savings: 0,
              order_count: 0,
              viral_shares_count: 0
            })
            .select()
            .single()

          if (createError) {
            throw createError
          }
          setProfile(newProfile)
        } else {
          throw profileError
        }
      } else {
        setProfile(userProfile)
      }

      // Fetch skin profile if WhatsApp number exists
      if (userProfile?.whatsapp_number) {
        const { data: skinProfileData, error: skinError } = await supabase
          .from('user_skin_profiles')
          .select('*')
          .eq('whatsapp_number', userProfile.whatsapp_number)
          .single()

        if (skinError && skinError.code !== 'PGRST116') {
          console.warn('Error fetching skin profile:', skinError)
        } else {
          setSkinProfile(skinProfileData)
        }
      }

    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user profile')
      console.error('Error fetching user profile:', err)
    } finally {
      setLoading(false)
    }
  }, [user, isAuthenticated])

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user || !profile) return null

    try {
      const supabase = createBrowserClient()

      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        })
        .eq('id', user.id)
        .select()
        .single()

      if (error) {
        throw error
      }

      setProfile(data)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update profile')
      console.error('Error updating profile:', err)
      return null
    }
  }, [user, profile])

  const updateSkinProfile = useCallback(async (skinData: Partial<UserSkinProfile>) => {
    if (!profile?.whatsapp_number) return null

    try {
      const supabase = createBrowserClient()

      // Try to update existing skin profile
      const { data: existingProfile } = await supabase
        .from('user_skin_profiles')
        .select('id')
        .eq('whatsapp_number', profile.whatsapp_number)
        .single()

      let result
      if (existingProfile) {
        // Update existing
        const { data, error } = await supabase
          .from('user_skin_profiles')
          .update({
            ...skinData,
            updated_at: new Date().toISOString()
          })
          .eq('whatsapp_number', profile.whatsapp_number)
          .select()
          .single()

        if (error) throw error
        result = data
      } else {
        // Create new
        const { data, error } = await supabase
          .from('user_skin_profiles')
          .insert({
            whatsapp_number: profile.whatsapp_number,
            ...skinData,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .select()
          .single()

        if (error) throw error
        result = data
      }

      setSkinProfile(result)
      return result
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update skin profile')
      console.error('Error updating skin profile:', err)
      return null
    }
  }, [profile])

  useEffect(() => {
    fetchUserProfile()
  }, [fetchUserProfile])

  return {
    profile,
    skinProfile,
    loading,
    error,
    isAuthenticated,
    fetchUserProfile,
    updateProfile,
    updateSkinProfile,
    whatsappNumber: profile?.whatsapp_number || null,
    hasProfile: !!profile,
    hasSkinProfile: !!skinProfile
  }
}