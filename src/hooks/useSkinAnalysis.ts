import { useState } from 'react'

interface SkinAnalysisData {
  skinType: 'dry' | 'oily' | 'combination' | 'normal' | 'sensitive'
  concerns: string[]
  tone: string
  hydrationLevel: number
  textureScore: number
  clarityScore: number
  recommendations: {
    routine: {
      morning: string[]
      evening: string[]
    }
    ingredients: {
      beneficial: string[]
      avoid: string[]
    }
    keyProducts: string[]
  }
  confidenceScore: number
}

export function useSkinAnalysis() {
  const [loading, setLoading] = useState(false)
  const [analysis, setAnalysis] = useState<SkinAnalysisData | null>(null)
  const [error, setError] = useState<string | null>(null)

  const analyzeSkin = async (imageFile: File, userId?: string) => {
    setLoading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append('image', imageFile)
      if (userId) {
        formData.append('userId', userId)
      }

      const response = await fetch('/api/skin-analysis', {
        method: 'POST',
        body: formData
      })

      if (!response.ok) {
        throw new Error('Analysis failed')
      }

      const data = await response.json()
      setAnalysis(data.analysis)
      return data
    } catch (err) {
      setError('Failed to analyze skin. Please try again.')
      console.error('Skin analysis error:', err)

      // Return demo data as fallback
      const demoAnalysis: SkinAnalysisData = {
        skinType: 'combination',
        concerns: ['mild acne', 'uneven texture', 'occasional dryness'],
        tone: 'warm undertone with medium complexion',
        hydrationLevel: 7,
        textureScore: 6,
        clarityScore: 7,
        recommendations: {
          routine: {
            morning: [
              'Gentle foam cleanser',
              'Hydrating toner',
              'Niacinamide serum',
              'Lightweight moisturizer',
              'SPF 50+ sunscreen'
            ],
            evening: [
              'Oil cleanser',
              'Water-based cleanser',
              'BHA toner',
              'Snail mucin essence',
              'Retinol serum',
              'Night moisturizer'
            ]
          },
          ingredients: {
            beneficial: [
              'Niacinamide',
              'Hyaluronic Acid',
              'Centella Asiatica',
              'Snail Mucin',
              'Green Tea Extract'
            ],
            avoid: [
              'Heavy oils',
              'Alcohol denat',
              'Strong fragrances'
            ]
          },
          keyProducts: ['cleanser', 'toner', 'serum', 'moisturizer', 'sunscreen']
        },
        confidenceScore: 0.85
      }
      setAnalysis(demoAnalysis)
      return { analysis: demoAnalysis, recommendedProducts: [] }
    } finally {
      setLoading(false)
    }
  }

  const getProgressData = (userId: string) => {
    // This would fetch historical analysis data
    return {
      improvements: [
        { date: '2024-09', score: 65 },
        { date: '2024-10', score: 72 },
        { date: '2024-11', score: 78 },
        { date: '2024-12', score: 85 }
      ],
      currentScore: 85,
      trend: 'improving'
    }
  }

  return {
    analysis,
    loading,
    error,
    analyzeSkin,
    getProgressData
  }
}