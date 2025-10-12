import { useState, useEffect } from 'react'
import type { UserProfile, CreateUserProfileRequest, UpdateUserProfileRequest } from '@/types/user'

export function useUserProfile(email?: string, userId?: string) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = async () => {
    if (!email && !userId) {
      setLoading(false)
      return
    }

    try {
      setLoading(true)
      const params = new URLSearchParams()
      if (email) params.append('email', email)
      if (userId) params.append('id', userId)

      const response = await fetch(`/api/user-profile?${params}`)

      if (response.status === 404) {
        setProfile(null)
        setError(null)
        return
      }

      if (!response.ok) {
        throw new Error('Failed to fetch user profile')
      }

      const data = await response.json()
      setProfile(data.profile)
      setError(null)
    } catch (err) {
      console.error('Error fetching user profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to load user profile')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchProfile()
  }, [email, userId])

  const createProfile = async (data: CreateUserProfileRequest): Promise<UserProfile | null> => {
    try {
      setLoading(true)
      const response = await fetch('/api/user-profile', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to create user profile')
      }

      const result = await response.json()
      setProfile(result.profile)
      setError(null)
      return result.profile
    } catch (err) {
      console.error('Error creating user profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to create user profile')
      return null
    } finally {
      setLoading(false)
    }
  }

  const updateProfile = async (data: UpdateUserProfileRequest): Promise<UserProfile | null> => {
    try {
      setLoading(true)
      const response = await fetch('/api/user-profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(data),
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to update user profile')
      }

      const result = await response.json()
      setProfile(result.profile)
      setError(null)
      return result.profile
    } catch (err) {
      console.error('Error updating user profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to update user profile')
      return null
    } finally {
      setLoading(false)
    }
  }

  const deleteProfile = async (profileId: string): Promise<boolean> => {
    try {
      setLoading(true)
      const response = await fetch(`/api/user-profile?id=${profileId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to delete user profile')
      }

      setProfile(null)
      setError(null)
      return true
    } catch (err) {
      console.error('Error deleting user profile:', err)
      setError(err instanceof Error ? err.message : 'Failed to delete user profile')
      return false
    } finally {
      setLoading(false)
    }
  }

  return {
    profile,
    loading,
    error,
    createProfile,
    updateProfile,
    deleteProfile,
    refetch: fetchProfile
  }
}

// Hook for managing user profile creation flow
export function useProfileCreation() {
  const [step, setStep] = useState(1)
  const [profileData, setProfileData] = useState<Partial<CreateUserProfileRequest>>({})

  const updateProfileData = (data: Partial<CreateUserProfileRequest>) => {
    setProfileData(prev => ({ ...prev, ...data }))
  }

  const nextStep = () => setStep(prev => prev + 1)
  const prevStep = () => setStep(prev => Math.max(1, prev - 1))
  const resetFlow = () => {
    setStep(1)
    setProfileData({})
  }

  return {
    step,
    profileData,
    updateProfileData,
    nextStep,
    prevStep,
    resetFlow,
    isComplete: step > 4 // Assuming 4-step profile creation
  }
}