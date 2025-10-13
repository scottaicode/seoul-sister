'use client'

import { useState, useEffect, useCallback } from 'react'
import { SkinProfileData, PersonalizedRecommendation } from '@/types/skin-analysis'

export function useSkinProfile(whatsappNumber?: string) {
  const [profile, setProfile] = useState<SkinProfileData | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchProfile = useCallback(async () => {
    if (!whatsappNumber) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/skin-profiles?whatsapp_number=${encodeURIComponent(whatsappNumber)}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch skin profile')
      }

      setProfile(data.profile)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Error fetching skin profile:', err)
    } finally {
      setLoading(false)
    }
  }, [whatsappNumber])

  const updateProfile = useCallback(async (profileData: Partial<SkinProfileData>) => {
    if (!whatsappNumber) return null

    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/skin-profiles', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsappNumber,
          ...profileData
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update skin profile')
      }

      setProfile(data.profile)
      return data.profile
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Error updating skin profile:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [whatsappNumber])

  useEffect(() => {
    fetchProfile()
  }, [fetchProfile])

  return {
    profile,
    loading,
    error,
    fetchProfile,
    updateProfile,
    hasProfile: !!profile
  }
}

export function usePersonalizedRecommendations(whatsappNumber?: string) {
  const [recommendations, setRecommendations] = useState<PersonalizedRecommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchRecommendations = useCallback(async (limit = 8) => {
    if (!whatsappNumber) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch(`/api/personalized-recommendations-v2?whatsapp_number=${encodeURIComponent(whatsappNumber)}&limit=${limit}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to fetch recommendations')
      }

      setRecommendations(data.recommendations || [])
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Error fetching recommendations:', err)
    } finally {
      setLoading(false)
    }
  }, [whatsappNumber])

  const generateCustomRecommendations = useCallback(async (preferences?: {
    budgetRange?: string
    routineComplexity?: string
    timeOfDay?: string
    specificConcerns?: string[]
  }) => {
    if (!whatsappNumber) return

    setLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/personalized-recommendations-v2', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          whatsappNumber,
          preferences,
          includeExplanation: true
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to generate recommendations')
      }

      setRecommendations(data.recommendations || [])
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Error generating custom recommendations:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [whatsappNumber])

  useEffect(() => {
    fetchRecommendations()
  }, [fetchRecommendations])

  return {
    recommendations,
    loading,
    error,
    fetchRecommendations,
    generateCustomRecommendations
  }
}

export function useIngredientAnalysis() {
  const [analysis, setAnalysis] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const analyzeIngredients = useCallback(async (
    productId?: string,
    whatsappNumber?: string,
    ingredients?: string
  ) => {
    if (!productId && !ingredients) return

    setLoading(true)
    setError(null)
    setAnalysis(null)

    try {
      const response = await fetch('/api/ingredient-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          whatsappNumber,
          ingredients
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze ingredients')
      }

      setAnalysis(data)
      return data
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
      console.error('Error analyzing ingredients:', err)
      return null
    } finally {
      setLoading(false)
    }
  }, [])

  return {
    analysis,
    loading,
    error,
    analyzeIngredients
  }
}