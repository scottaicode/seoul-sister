'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft, Sparkles } from 'lucide-react'
import AuthHeader from '@/components/AuthHeader'
import PhotoUpload from '@/components/PhotoUpload'
import SkinAnalysisResults from '@/components/SkinAnalysisResults'
import PremiumGate from '@/components/PremiumGate'
import { useAuth } from '@/contexts/AuthContext'
import { useSubscription } from '@/hooks/useSubscription'

interface PhotoMetadata {
  captureMethod: 'camera' | 'upload'
  timestamp: string
  lighting?: 'natural' | 'indoor' | 'outdoor' | 'artificial'
  skinArea?: 'face' | 'specific_concern'
  notes?: string
}

interface SkinAnalysis {
  skinType: string
  primaryConcerns: string[]
  secondaryConcerns: string[]
  recommendations: string[]
  compatibleIngredients: string[]
  ingredientsToAvoid: string[]
  confidenceScore: number
  analysisDetails: {
    poreSize: 'small' | 'medium' | 'large'
    oiliness: 'low' | 'moderate' | 'high'
    hydration: 'low' | 'moderate' | 'high'
    sensitivity: 'low' | 'moderate' | 'high'
    pigmentation: 'none' | 'mild' | 'moderate' | 'significant'
    aging: 'minimal' | 'early' | 'moderate' | 'advanced'
  }
  productRecommendations: {
    cleanser: string[]
    moisturizer: string[]
    treatment: string[]
    sunscreen: string[]
  }
}

export default function SkinAnalysisPage() {
  const { user } = useAuth()
  const { canAccessPremium } = useSubscription()
  const [step, setStep] = useState<'upload' | 'analyzing' | 'results'>('upload')
  const [analysis, setAnalysis] = useState<SkinAnalysis | null>(null)
  const [productRecommendations, setProductRecommendations] = useState<any[]>([])
  const [error, setError] = useState<string | null>(null)

  const handlePhotoUpload = async (file: File, metadata?: PhotoMetadata) => {
    if (!user) {
      setError('Please sign in to use AI skin analysis')
      return
    }

    setStep('analyzing')
    setError(null)

    try {
      const formData = new FormData()
      formData.append('photo', file)
      formData.append('userId', user.id)
      if (metadata) {
        formData.append('metadata', JSON.stringify(metadata))
      }

      const response = await fetch('/api/ai/skin-analysis', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to analyze skin')
      }

      setAnalysis(data.analysis)
      setProductRecommendations(data.productRecommendations || [])
      setStep('results')

    } catch (err) {
      console.error('Skin analysis error:', err)
      setError(err instanceof Error ? err.message : 'Failed to analyze skin')
      setStep('upload')
    }
  }

  const handleShareResults = () => {
    if (!analysis) return

    const message = `🔬 My Seoul Sister Skin Analysis Results:

🧴 Skin Type: ${analysis.skinType}
⚠️ Main Concerns: ${analysis.primaryConcerns.slice(0, 2).join(', ')}
✅ Confidence Score: ${analysis.confidenceScore}%

🌸 Ready to get personalized K-beauty recommendations at wholesale prices!

Get your analysis: ${window.location.origin}/skin-analysis`

    if (navigator.share) {
      navigator.share({
        title: 'My Seoul Sister Skin Analysis',
        text: message,
        url: window.location.href
      })
    } else {
      // Fallback to copy to clipboard
      navigator.clipboard.writeText(message)
      alert('Results copied to clipboard!')
    }
  }

  const handleRequestProducts = () => {
    if (!analysis) return

    const whatsappMessage = `Hi! I just completed my Seoul Sister skin analysis:

🔬 Skin Type: ${analysis.skinType}
⚠️ Primary Concerns: ${analysis.primaryConcerns.join(', ')}
✅ Confidence Score: ${analysis.confidenceScore}%

Could you help me find the perfect K-beauty products for my skin? I'm especially interested in products that contain ${analysis.compatibleIngredients.slice(0, 3).join(', ')} and avoid ${analysis.ingredientsToAvoid.slice(0, 2).join(', ')}.

Thank you! 💕`

    const encodedMessage = encodeURIComponent(whatsappMessage)
    window.open(`https://wa.me/1234567890?text=${encodedMessage}`, '_blank')
  }

  const handleStartOver = () => {
    setStep('upload')
    setAnalysis(null)
    setProductRecommendations([])
    setError(null)
  }

  // For Seoul Sister's $20/month model, all logged-in users get full access
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-luxury-charcoal to-black">
        <AuthHeader />
        <div className="container mx-auto px-4 pt-24 pb-8">
          <div className="mb-6">
            <Link
              href="/personalized-dashboard"
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-luxury-gold transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="font-medium">Back to Dashboard</span>
            </Link>
          </div>

          <PremiumGate
            featureName="AI Skin Analysis"
            showUpgradePrompt={true}
          >
            <div className="bg-luxury-charcoal/20 rounded-xl p-8 border border-luxury-gold/20 backdrop-blur-sm text-center">
              <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
                🔬 AI Skin Analysis
              </h3>
              <p className="text-gray-300 font-light mb-6">
                Upload a photo to get personalized skincare recommendations powered by AI
              </p>
              <div className="grid grid-cols-1 gap-3 mb-6">
                {[
                  'AI-powered skin type analysis',
                  'Personalized ingredient recommendations',
                  'Compatible K-beauty product suggestions',
                  'Skin concern identification and tracking',
                  'Progress monitoring over time'
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-2 p-3 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg">
                    <span className="text-luxury-gold">✨</span>
                    <span className="text-white font-light">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </PremiumGate>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-luxury-charcoal to-black">
      <AuthHeader />

      <div className="container mx-auto px-4 pt-24 pb-8">
        {/* Back button */}
        <div className="mb-6">
          <Link
            href="/personalized-dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-luxury-gold transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Dashboard</span>
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-luxury-gold/20 border border-luxury-gold/30 rounded-full mb-6">
            <Sparkles className="text-luxury-gold" size={32} />
          </div>
          <h1 className="text-4xl font-light text-white mb-4 tracking-wide">
            🔬 AI Skin Analysis
          </h1>
          <p className="text-lg font-light text-gray-300 max-w-2xl mx-auto">
            Upload your photo to receive personalized skincare recommendations powered by advanced AI technology
          </p>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step === 'upload' ? 'bg-luxury-gold text-black' :
              ['analyzing', 'results'].includes(step) ? 'bg-green-500 text-white' : 'bg-luxury-charcoal text-gray-400'
            }`}>
              1
            </div>
            <div className={`w-16 h-1 ${
              ['analyzing', 'results'].includes(step) ? 'bg-luxury-gold' : 'bg-luxury-charcoal'
            }`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step === 'analyzing' ? 'bg-luxury-gold text-black' :
              step === 'results' ? 'bg-green-500 text-white' : 'bg-luxury-charcoal text-gray-400'
            }`}>
              2
            </div>
            <div className={`w-16 h-1 ${
              step === 'results' ? 'bg-luxury-gold' : 'bg-luxury-charcoal'
            }`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step === 'results' ? 'bg-luxury-gold text-black' : 'bg-luxury-charcoal text-gray-400'
            }`}>
              3
            </div>
          </div>
        </div>

        {/* Step Labels */}
        <div className="flex justify-center mb-8">
          <div className="flex items-center space-x-16 text-sm">
            <div className={`text-center ${step === 'upload' ? 'text-luxury-gold' : 'text-gray-400'}`}>
              <div className="font-medium">Upload Photo</div>
              <div className="text-xs opacity-75">Take or select image</div>
            </div>
            <div className={`text-center ${step === 'analyzing' ? 'text-luxury-gold' : 'text-gray-400'}`}>
              <div className="font-medium">AI Analysis</div>
              <div className="text-xs opacity-75">Processing image</div>
            </div>
            <div className={`text-center ${step === 'results' ? 'text-luxury-gold' : 'text-gray-400'}`}>
              <div className="font-medium">Results</div>
              <div className="text-xs opacity-75">Recommendations</div>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-4xl mx-auto">
          {error && (
            <div className="mb-6 p-4 bg-red-500/10 border border-red-400/30 rounded-lg">
              <p className="text-red-300">{error}</p>
            </div>
          )}

          {step === 'upload' && (
            <PhotoUpload
              onPhotoCapture={handlePhotoUpload}
              maxFileSize={10}
              acceptedFormats={['image/jpeg', 'image/png', 'image/webp']}
            />
          )}

          {step === 'analyzing' && (
            <div className="bg-luxury-charcoal/20 rounded-xl p-8 border border-luxury-gold/20 backdrop-blur-sm text-center">
              <div className="inline-flex items-center justify-center w-16 h-16 bg-luxury-gold/20 border border-luxury-gold/30 rounded-full mb-6">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luxury-gold"></div>
              </div>
              <h3 className="text-xl font-semibold text-white mb-2 tracking-wide">
                🔬 Analyzing Your Skin
              </h3>
              <p className="text-gray-300 font-light mb-4">
                Our AI is examining your photo to provide personalized recommendations
              </p>
              <div className="text-sm text-gray-400">
                This may take 10-30 seconds...
              </div>
            </div>
          )}

          {step === 'results' && analysis && (
            <div className="space-y-6">
              <SkinAnalysisResults
                analysis={analysis}
                productRecommendations={productRecommendations}
                onShareResults={handleShareResults}
                onRequestProducts={handleRequestProducts}
              />

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 justify-center">
                <button
                  onClick={handleStartOver}
                  className="px-6 py-3 bg-luxury-charcoal/50 hover:bg-luxury-charcoal/70 text-gray-300 border border-luxury-gold/30 rounded-lg font-medium transition-all"
                >
                  Analyze Another Photo
                </button>

                <Link
                  href="/personalized-dashboard"
                  className="px-6 py-3 bg-luxury-gold hover:bg-luxury-gold/90 text-black rounded-lg font-medium transition-all text-center"
                >
                  Back to Dashboard
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Benefits Section */}
        {step === 'upload' && (
          <div className="mt-12 max-w-4xl mx-auto">
            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white mb-4 tracking-wide text-center">
                ✨ What You'll Get
              </h3>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                <div className="text-center">
                  <div className="text-2xl mb-2">🎯</div>
                  <div className="font-medium text-white text-sm">Skin Type Analysis</div>
                  <div className="text-xs text-gray-400 font-light">Precise identification</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-2">🧪</div>
                  <div className="font-medium text-white text-sm">Ingredient Guide</div>
                  <div className="text-xs text-gray-400 font-light">What works for you</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-2">🛍️</div>
                  <div className="font-medium text-white text-sm">Product Matches</div>
                  <div className="text-xs text-gray-400 font-light">Personalized K-beauty</div>
                </div>
                <div className="text-center">
                  <div className="text-2xl mb-2">📱</div>
                  <div className="font-medium text-white text-sm">WhatsApp Access</div>
                  <div className="text-xs text-gray-400 font-light">Order recommendations</div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}