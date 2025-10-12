'use client'

import { useState, useRef, useCallback } from 'react'
import { useUserProfile } from '@/hooks/useUserProfile'
import Image from 'next/image'

interface PhotoAnalysisResult {
  skinType: string
  skinTone: string
  ageRange: string
  concerns: string[]
  concernScores: Record<string, number>
  hydrationLevel: number
  oilLevel: number
  textureScore: number
  elasticityScore: number
  brightnessScore: number
  aiConfidence: number
  detailedAnalysis: string
  primaryRecommendations: string[]
  recommendations: Array<{
    product: {
      id: string
      name: string
      brand: string
      seoulPrice: number
      usPrice: number
      savings: number
    }
    matchScore: number
    reason: string
    expectedImprovement: Record<string, string>
  }>
}

interface PhotoSkinAnalysisProps {
  userEmail?: string
}

export default function PhotoSkinAnalysis({ userEmail }: PhotoSkinAnalysisProps) {
  const { profile } = useUserProfile(userEmail)
  const [uploading, setUploading] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [analysisResult, setAnalysisResult] = useState<PhotoAnalysisResult | null>(null)
  const [uploadedImage, setUploadedImage] = useState<string | null>(null)
  const [previousAnalyses, setPreviousAnalyses] = useState<any[]>([])
  const [showProgressComparison, setShowProgressComparison] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // Handle file upload
  const handleFileUpload = useCallback(async (file: File) => {
    if (!file) return

    // Validate file type
    if (!file.type.startsWith('image/')) {
      alert('Please upload an image file')
      return
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      alert('Image must be less than 5MB')
      return
    }

    setUploading(true)
    try {
      // Convert to base64 for immediate display
      const reader = new FileReader()
      reader.onload = (e) => {
        setUploadedImage(e.target?.result as string)
      }
      reader.readAsDataURL(file)

      // Upload to temporary storage or convert to base64 for API
      const formData = new FormData()
      formData.append('file', file)

      // For now, we'll use a data URL. In production, upload to cloud storage
      const dataUrl = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => resolve(e.target?.result as string)
        reader.readAsDataURL(file)
      })

      // Start analysis
      await performSkinAnalysis(dataUrl)

    } catch (error) {
      console.error('Error uploading file:', error)
      alert('Failed to upload image. Please try again.')
    } finally {
      setUploading(false)
    }
  }, [])

  // Perform AI skin analysis
  const performSkinAnalysis = async (imageUrl: string) => {
    setAnalyzing(true)
    try {
      const response = await fetch('/api/skin-analysis', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ imageUrl }),
      })

      if (!response.ok) {
        throw new Error('Analysis failed')
      }

      const result = await response.json()
      setAnalysisResult(result)

      // Save analysis to user's history if profile exists
      if (profile?.id) {
        await saveAnalysisToHistory(result, imageUrl)
      }

    } catch (error) {
      console.error('Error analyzing image:', error)
      alert('Failed to analyze image. Please try again.')
    } finally {
      setAnalyzing(false)
    }
  }

  // Save analysis to user history
  const saveAnalysisToHistory = async (analysis: PhotoAnalysisResult, imageUrl: string) => {
    try {
      await fetch('/api/photo-analysis-history', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          user_id: profile?.id,
          analysis_data: analysis,
          photo_url: imageUrl
        }),
      })

      // Fetch updated history
      fetchAnalysisHistory()
    } catch (error) {
      console.error('Error saving analysis:', error)
    }
  }

  // Fetch user's analysis history
  const fetchAnalysisHistory = async () => {
    if (!profile?.id) return

    try {
      const response = await fetch(`/api/photo-analysis-history?user_id=${profile.id}`)
      const data = await response.json()
      setPreviousAnalyses(data.analyses || [])
    } catch (error) {
      console.error('Error fetching history:', error)
    }
  }

  // Handle drag and drop
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    const files = Array.from(e.dataTransfer.files)
    if (files[0]) {
      handleFileUpload(files[0])
    }
  }

  // Handle click upload
  const handleClickUpload = () => {
    fileInputRef.current?.click()
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleFileUpload(file)
    }
  }

  // Render concern score
  const renderConcernScore = (concern: string, score: number) => {
    const percentage = Math.round(score * 100)
    const intensity = score > 0.7 ? 'high' : score > 0.4 ? 'medium' : 'low'

    return (
      <div key={concern} className="flex items-center justify-between py-2">
        <span className="text-sm font-medium text-gray-700 capitalize">
          {concern.replace('_', ' ')}
        </span>
        <div className="flex items-center gap-2">
          <div className="w-20 bg-gray-200 rounded-full h-2">
            <div
              className={`h-2 rounded-full ${
                intensity === 'high' ? 'bg-red-500' :
                intensity === 'medium' ? 'bg-yellow-500' :
                'bg-green-500'
              }`}
              style={{ width: `${percentage}%` }}
            ></div>
          </div>
          <span className="text-xs text-gray-500 w-8">{percentage}%</span>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          📸 AI Photo Skin Analysis
        </h1>
        <p className="text-gray-600">
          Upload a photo for instant AI-powered skin analysis and personalized K-beauty recommendations
        </p>
      </div>

      {/* Upload Area */}
      {!uploadedImage && (
        <div className="mb-8">
          <div
            className="border-2 border-dashed border-gray-300 rounded-xl p-12 text-center hover:border-pink-400 transition-colors cursor-pointer"
            onDragOver={handleDragOver}
            onDrop={handleDrop}
            onClick={handleClickUpload}
          >
            <div className="text-6xl mb-4">📷</div>
            <h3 className="text-xl font-medium text-gray-800 mb-2">
              Upload Your Selfie
            </h3>
            <p className="text-gray-600 mb-4">
              Drag and drop or click to upload a clear, well-lit photo of your face
            </p>
            <div className="text-sm text-gray-500 space-y-1">
              <p>• Use natural lighting for best results</p>
              <p>• Face the camera directly</p>
              <p>• Remove makeup if possible</p>
              <p>• Max file size: 5MB</p>
            </div>
            <button
              className="mt-6 bg-gradient-to-r from-pink-500 to-purple-600 text-white px-8 py-3 rounded-full font-medium hover:shadow-lg transition-all"
              disabled={uploading}
            >
              {uploading ? 'Uploading...' : 'Choose Photo'}
            </button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileChange}
            className="hidden"
          />
        </div>
      )}

      {/* Uploaded Image and Analysis */}
      {uploadedImage && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          {/* Image Display */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">Your Photo</h3>
            <div className="relative aspect-square rounded-lg overflow-hidden bg-gray-100">
              <Image
                src={uploadedImage}
                alt="Uploaded selfie"
                fill
                className="object-cover"
              />
            </div>
            <div className="mt-4 flex gap-2">
              <button
                onClick={handleClickUpload}
                className="flex-1 bg-gray-100 text-gray-700 py-2 px-4 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Upload New Photo
              </button>
              {analysisResult && (
                <button
                  onClick={() => setShowProgressComparison(true)}
                  className="flex-1 bg-blue-500 text-white py-2 px-4 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Compare Progress
                </button>
              )}
            </div>
          </div>

          {/* Analysis Results */}
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {analyzing ? 'Analyzing...' : 'Analysis Results'}
            </h3>

            {analyzing && (
              <div className="space-y-4">
                <div className="flex items-center gap-3">
                  <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-pink-500"></div>
                  <span className="text-gray-600">AI is analyzing your skin...</span>
                </div>
                <div className="bg-blue-50 p-4 rounded-lg">
                  <p className="text-sm text-blue-800">
                    Our advanced AI is examining your skin for type, tone, concerns, and personalized recommendations. This usually takes 10-15 seconds.
                  </p>
                </div>
              </div>
            )}

            {analysisResult && !analyzing && (
              <div className="space-y-6">
                {/* Basic Info */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Skin Type</div>
                    <div className="text-lg font-medium capitalize">{analysisResult.skinType}</div>
                  </div>
                  <div className="bg-gray-50 p-3 rounded-lg">
                    <div className="text-xs text-gray-500 uppercase tracking-wide">Skin Tone</div>
                    <div className="text-lg font-medium capitalize">{analysisResult.skinTone}</div>
                  </div>
                </div>

                {/* AI Confidence */}
                <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-green-800">AI Confidence</span>
                    <span className="text-lg font-bold text-green-600">
                      {Math.round(analysisResult.aiConfidence * 100)}%
                    </span>
                  </div>
                  <div className="mt-2 w-full bg-green-200 rounded-full h-2">
                    <div
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${analysisResult.aiConfidence * 100}%` }}
                    ></div>
                  </div>
                </div>

                {/* Primary Concerns */}
                <div>
                  <h4 className="font-medium text-gray-800 mb-3">Detected Skin Concerns</h4>
                  <div className="space-y-1">
                    {Object.entries(analysisResult.concernScores)
                      .filter(([_, score]) => score > 0.2)
                      .sort(([_, a], [__, b]) => b - a)
                      .map(([concern, score]) => renderConcernScore(concern, score))
                    }
                  </div>
                </div>

                {/* Overall Health Metrics */}
                <div>
                  <h4 className="font-medium text-gray-800 mb-3">Skin Health Metrics</h4>
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div>
                      <span className="text-gray-600">Hydration:</span>
                      <span className="ml-2 font-medium">{Math.round(analysisResult.hydrationLevel * 100)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Oil Level:</span>
                      <span className="ml-2 font-medium">{Math.round(analysisResult.oilLevel * 100)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Texture:</span>
                      <span className="ml-2 font-medium">{Math.round(analysisResult.textureScore * 100)}%</span>
                    </div>
                    <div>
                      <span className="text-gray-600">Brightness:</span>
                      <span className="ml-2 font-medium">{Math.round(analysisResult.brightnessScore * 100)}%</span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Personalized Recommendations */}
      {analysisResult?.recommendations && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-6">
            🎯 Personalized Product Recommendations
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {analysisResult.recommendations.map((rec, index) => (
              <div key={index} className="border border-gray-100 rounded-lg p-4 hover:shadow-md transition-shadow">
                <div className="flex justify-between items-start mb-3">
                  <h4 className="font-medium text-gray-800">{rec.product.name}</h4>
                  <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                    {Math.round(rec.matchScore * 100)}% match
                  </span>
                </div>
                <div className="text-sm text-gray-600 mb-2">{rec.product.brand}</div>
                <div className="text-sm text-blue-600 mb-3">{rec.reason}</div>
                <div className="flex justify-between items-center text-sm">
                  <span className="font-bold text-pink-600">${rec.product.seoulPrice}</span>
                  <span className="text-gray-500 line-through">${rec.product.usPrice}</span>
                  <span className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                    {rec.product.savings}% off
                  </span>
                </div>
                {Object.keys(rec.expectedImprovement).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-100">
                    <div className="text-xs text-gray-500 mb-1">Expected improvements:</div>
                    <div className="flex flex-wrap gap-1">
                      {Object.entries(rec.expectedImprovement).map(([metric, improvement]) => (
                        <span key={metric} className="text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded">
                          {metric}: {improvement}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Detailed Analysis */}
      {analysisResult?.detailedAnalysis && (
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl border border-purple-200 p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-4">
            🔬 Detailed AI Analysis
          </h3>
          <p className="text-gray-700 leading-relaxed">{analysisResult.detailedAnalysis}</p>

          {analysisResult.primaryRecommendations.length > 0 && (
            <div className="mt-4">
              <h4 className="font-medium text-gray-800 mb-2">Key Recommendations:</h4>
              <ul className="space-y-2">
                {analysisResult.primaryRecommendations.map((rec, index) => (
                  <li key={index} className="flex items-start gap-2">
                    <span className="text-purple-500 mt-1">•</span>
                    <span className="text-gray-700">{rec}</span>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Progress Tracking CTA */}
      {analysisResult && profile && (
        <div className="bg-gradient-to-r from-blue-500 to-purple-600 text-white rounded-xl p-6 text-center">
          <h3 className="text-xl font-bold mb-2">📈 Track Your Skin Progress</h3>
          <p className="mb-4 opacity-90">
            Take photos regularly to see how your Korean skincare routine improves your skin over time
          </p>
          <button className="bg-white text-blue-600 px-6 py-2 rounded-full font-medium hover:bg-gray-100 transition-colors">
            Set Reminder for Next Photo
          </button>
        </div>
      )}
    </div>
  )
}