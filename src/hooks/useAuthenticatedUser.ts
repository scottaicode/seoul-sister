'use client'

import { useState, useEffect, useCallback } from 'react'
import { useAuthState } from '@/hooks/useAuthState'
import { createBrowserClient } from '@/lib/supabase-browser'

type UserProfile = {
  id: string
  email: string
  whatsapp_number: string | null
  stripe_customer_id: string | null
  korean_preferences: any | null
  created_at: string
  updated_at: string
  first_name: string | null
  last_name: string | null
  phone: string | null
  instagram_handle: string | null
  referral_code: string | null
  referred_by: string | null
  total_savings: number
  order_count: number
  viral_shares_count: number
  last_order_date: string | null
}

type UserSkinProfile = {
  id: string
  whatsapp_number: string
  current_skin_type: string | null
  skin_concerns: string[]
  preferred_categories: string[]
  last_analysis_date: string | null
  created_at: string
  updated_at: string
}

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

    // Prevent infinite loading if profile already exists and loading is already false
    if (profile && profile.id === user.id && !loading) {
      return
    }

    setLoading(true)
    setError(null)

    try {
      const supabase = createBrowserClient() as any

      console.log('fetchUserProfile: Fetching profile for user', user.id)

      // Fetch user profile
      const { data: userProfile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()

      console.log('fetchUserProfile: Profile fetch result', { userProfile, profileError })

      let currentProfile = userProfile

      if (profileError) {
        // If profile doesn't exist, create one
        if (profileError.code === 'PGRST116') {
          console.log('fetchUserProfile: Creating new profile for user', user.id)
          const { data: newProfile, error: createError } = await supabase
            .from('profiles')
            .insert({
              id: user.id,
              email: user.email || '',
              total_savings: 0,
              order_count: 0,
              viral_shares_count: 0
            })
            .select()
            .single()

          if (createError) {
            console.error('fetchUserProfile: Error creating profile', createError)
            throw createError
          }
          console.log('fetchUserProfile: New profile created', newProfile)
          currentProfile = newProfile
        } else {
          console.error('fetchUserProfile: Profile fetch error', profileError)
          throw profileError
        }
      } else {
        console.log('fetchUserProfile: Setting existing profile', userProfile)
      }

      // If no WhatsApp number in profile, try to find it from user_skin_profiles
      if (currentProfile && !currentProfile.whatsapp_number) {
        console.log('fetchUserProfile: No WhatsApp in profile, checking user_skin_profiles')

        // Try to find existing skin profile linked to this user's email
        const { data: existingSkinProfiles, error: skinSearchError } = await supabase
          .from('user_skin_profiles')
          .select('*')
          .limit(1)

        if (!skinSearchError && existingSkinProfiles && existingSkinProfiles.length > 0) {
          const existingSkinProfile = existingSkinProfiles[0]
          console.log('fetchUserProfile: Found existing skin profile', existingSkinProfile)

          // Update the main profile with the WhatsApp number from skin profile
          const { data: updatedProfile, error: updateError } = await supabase
            .from('profiles')
            .update({
              whatsapp_number: existingSkinProfile.whatsapp_number,
              updated_at: new Date().toISOString()
            })
            .eq('id', user.id)
            .select()
            .single()

          if (!updateError && updatedProfile) {
            console.log('fetchUserProfile: Profile updated with WhatsApp number', updatedProfile)
            currentProfile = updatedProfile
            setSkinProfile(existingSkinProfile)
          }
        }
      }

      setProfile(currentProfile)

      // Fetch skin profile if WhatsApp number exists and we haven't already set it
      if (currentProfile && currentProfile.whatsapp_number && !skinProfile) {
        console.log('fetchUserProfile: Fetching skin profile for WhatsApp', currentProfile.whatsapp_number)
        const { data: skinProfileData, error: skinError } = await supabase
          .from('user_skin_profiles')
          .select('*')
          .eq('whatsapp_number', currentProfile.whatsapp_number)
          .single()

        if (skinError && skinError.code !== 'PGRST116') {
          console.warn('fetchUserProfile: Error fetching skin profile:', skinError)
        } else if (skinProfileData) {
          console.log('fetchUserProfile: Skin profile found', skinProfileData)
          setSkinProfile(skinProfileData)
        } else {
          console.log('fetchUserProfile: No skin profile found')
        }
      } else if (!currentProfile?.whatsapp_number) {
        console.log('fetchUserProfile: No WhatsApp number in profile')
      }

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch user profile'
      setError(errorMessage)
      console.error('fetchUserProfile: Error:', err)
    } finally {
      setLoading(false)
    }
  }, [user, isAuthenticated])

  const updateProfile = useCallback(async (updates: Partial<UserProfile>) => {
    if (!user || !profile) return null

    try {
      const supabase = createBrowserClient() as any

      console.log('updateProfile: Updating profile with', updates)

      const { data, error } = await supabase
        .from('profiles')
        .update({
          ...updates,
          updated_at: new Date().toISOString()
        } as any)
        .eq('id', user.id)
        .select()
        .single()

      if (error) {
        console.error('updateProfile: Error updating profile', error)
        throw error
      }

      console.log('updateProfile: Profile updated successfully', data)
      setProfile(data)

      // If WhatsApp number was updated, refetch skin profile
      if (updates.whatsapp_number && data.whatsapp_number) {
        console.log('updateProfile: WhatsApp number updated, fetching skin profile')
        const { data: skinProfileData, error: skinError } = await supabase
          .from('user_skin_profiles')
          .select('*')
          .eq('whatsapp_number', data.whatsapp_number)
          .single()

        if (skinError && skinError.code !== 'PGRST116') {
          console.warn('updateProfile: Error fetching skin profile after WhatsApp update:', skinError)
        } else if (skinProfileData) {
          console.log('updateProfile: Skin profile found after WhatsApp update', skinProfileData)
          setSkinProfile(skinProfileData)
        } else {
          console.log('updateProfile: No skin profile found after WhatsApp update')
          setSkinProfile(null)
        }
      }

      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to update profile'
      setError(errorMessage)
      console.error('updateProfile: Error:', err)
      return null
    }
  }, [user, profile])

  const updateSkinProfile = useCallback(async (skinData: Partial<UserSkinProfile>) => {
    if (!profile?.whatsapp_number) return null

    try {
      const supabase = createBrowserClient() as any

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
    if (user && isAuthenticated) {
      console.log('useAuthenticatedUser: User changed, fetching profile for:', user.id)
      fetchUserProfile()
    }
  }, [fetchUserProfile, user, isAuthenticated])

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