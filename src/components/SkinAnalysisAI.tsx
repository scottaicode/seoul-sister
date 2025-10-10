'use client'

import { useState, useRef, useCallback } from 'react'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

interface SkinAnalysisResult {
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
  recommendations: Array<{
    product: any
    matchScore: number
    reason: string
    expectedImprovement: Record<string, string>
  }>
}

export default function SkinAnalysisAI() {
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [analysisResult, setAnalysisResult] = useState<SkinAnalysisResult | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [showCamera, setShowCamera] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  // Handle file upload
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (file) {
      const reader = new FileReader()
      reader.onloadend = () => {
        setImagePreview(reader.result as string)
        setShowCamera(false)
      }
      reader.readAsDataURL(file)
    }
  }

  // Start camera for selfie
  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: 1280, height: 720 }
      })
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        setShowCamera(true)
      }
    } catch (error) {
      console.error('Camera access error:', error)
      alert('Unable to access camera. Please upload a photo instead.')
    }
  }

  // Capture photo from camera
  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d')
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth
        canvasRef.current.height = videoRef.current.videoHeight
        context.drawImage(videoRef.current, 0, 0)

        canvasRef.current.toBlob((blob) => {
          if (blob) {
            const reader = new FileReader()
            reader.onloadend = () => {
              setImagePreview(reader.result as string)
              stopCamera()
            }
            reader.readAsDataURL(blob)
          }
        })
      }
    }
  }

  // Stop camera
  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream
      stream.getTracks().forEach(track => track.stop())
      setShowCamera(false)
    }
  }

  // Analyze skin with AI
  const analyzeSkin = async () => {
    if (!imagePreview) {
      alert('Please upload or take a photo first')
      return
    }

    setIsAnalyzing(true)
    setUploadProgress(10)

    try {
      // Upload image to Supabase Storage
      setUploadProgress(30)
      const imageBlob = await fetch(imagePreview).then(r => r.blob())
      const fileName = `skin-analysis-${Date.now()}.jpg`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from('skin-analysis')
        .upload(fileName, imageBlob)

      if (uploadError) throw uploadError
      setUploadProgress(50)

      // Get public URL
      const { data: { publicUrl } } = supabase.storage
        .from('skin-analysis')
        .getPublicUrl(fileName)

      // Call AI analysis API
      setUploadProgress(70)
      const response = await fetch('/api/skin-analysis', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageUrl: publicUrl })
      })

      if (!response.ok) throw new Error('Analysis failed')

      const result = await response.json()
      setUploadProgress(100)

      // Store analysis for learning
      await storeAnalysisForLearning(result)

      setAnalysisResult(result)
    } catch (error) {
      console.error('Analysis error:', error)
      alert('Failed to analyze skin. Please try again.')
    } finally {
      setIsAnalyzing(false)
      setUploadProgress(0)
    }
  }

  // Store analysis results for machine learning
  const storeAnalysisForLearning = async (result: SkinAnalysisResult) => {
    try {
      // Store in skin_analyses table
      const { data: analysis, error } = await supabase
        .from('skin_analyses')
        .insert({
          session_id: `session_${Date.now()}`,
          image_url: imagePreview,
          skin_type: result.skinType,
          skin_tone: result.skinTone,
          age_range: result.ageRange,
          concerns: result.concerns,
          concern_scores: result.concernScores,
          hydration_level: result.hydrationLevel,
          oil_level: result.oilLevel,
          texture_score: result.textureScore,
          elasticity_score: result.elasticityScore,
          brightness_score: result.brightnessScore,
          ai_confidence: result.aiConfidence,
          ai_model_version: 'claude-opus-4.1',
          analysis_raw: result
        })
        .select()
        .single()

      if (error) throw error

      // Store recommendations
      if (analysis && result.recommendations) {
        for (const rec of result.recommendations) {
          await supabase
            .from('skin_recommendations')
            .insert({
              analysis_id: analysis.id,
              product_id: rec.product.id,
              match_score: rec.matchScore,
              reason: rec.reason,
              expected_improvement: rec.expectedImprovement
            })
        }
      }

      // Update user skin profile
      await updateUserSkinProfile(result)

    } catch (error) {
      console.error('Error storing analysis:', error)
    }
  }

  // Update user's evolving skin profile
  const updateUserSkinProfile = async (result: SkinAnalysisResult) => {
    try {
      const { data: existingProfile } = await supabase
        .from('user_skin_profiles')
        .select('*')
        .single()

      if (existingProfile) {
        // Update existing profile with new data
        await supabase
          .from('user_skin_profiles')
          .update({
            current_skin_type: result.skinType,
            current_concerns: result.concerns,
            skin_type_history: [...(existingProfile.skin_type_history || []), {
              date: new Date().toISOString(),
              type: result.skinType
            }],
            concern_evolution: [...(existingProfile.concern_evolution || []), {
              date: new Date().toISOString(),
              concerns: result.concerns
            }],
            total_analyses: (existingProfile.total_analyses || 0) + 1,
            last_analysis_date: new Date().toISOString()
          })
          .eq('id', existingProfile.id)
      } else {
        // Create new profile
        await supabase
          .from('user_skin_profiles')
          .insert({
            current_skin_type: result.skinType,
            current_concerns: result.concerns,
            total_analyses: 1,
            last_analysis_date: new Date().toISOString()
          })
      }
    } catch (error) {
      console.error('Error updating skin profile:', error)
    }
  }

  return (
    <div className="min-h-screen bg-black py-20">
      <div className="max-w-4xl mx-auto px-4">
        {/* Header */}
        <div className="text-center mb-12">
          <p className="text-xs text-[#D4A574]/60 uppercase tracking-widest mb-4">
            AI-Powered Skin Intelligence
          </p>
          <h1 className="text-5xl md:text-6xl font-light text-white mb-6 tracking-wide">
            Your Personalized
            <span className="block text-[#D4A574] mt-2">K-Beauty Journey</span>
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto">
            Our AI analyzes 250+ skin characteristics to create your perfect Seoul beauty routine.
            Every analysis makes our recommendations 10% smarter.
          </p>
        </div>

        {/* Upload Section */}
        {!analysisResult && (
          <div className="bg-zinc-900/50 border border-[#D4A574]/20 rounded-2xl p-8">
            {!imagePreview ? (
              <div className="space-y-6">
                <div className="text-center">
                  <h3 className="text-xl text-white mb-4">Choose Your Method</h3>
                  <p className="text-white/60 text-sm mb-8">
                    For best results, use natural lighting and no makeup
                  </p>
                </div>

                <div className="grid md:grid-cols-2 gap-4">
                  {/* Take Selfie Option */}
                  <button
                    onClick={startCamera}
                    className="p-8 bg-black border border-[#D4A574]/20 rounded-xl hover:border-[#D4A574] transition-all group"
                  >
                    <div className="text-4xl mb-4">📸</div>
                    <h4 className="text-white mb-2">Take Selfie</h4>
                    <p className="text-white/60 text-sm">Use your camera for instant analysis</p>
                  </button>

                  {/* Upload Photo Option */}
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="p-8 bg-black border border-[#D4A574]/20 rounded-xl hover:border-[#D4A574] transition-all group"
                  >
                    <div className="text-4xl mb-4">📤</div>
                    <h4 className="text-white mb-2">Upload Photo</h4>
                    <p className="text-white/60 text-sm">Choose from your gallery</p>
                  </button>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>
            ) : (
              <div className="space-y-6">
                <div className="relative aspect-square max-w-md mx-auto rounded-xl overflow-hidden">
                  <img
                    src={imagePreview}
                    alt="Skin analysis preview"
                    className="w-full h-full object-cover"
                  />
                  {isAnalyzing && (
                    <div className="absolute inset-0 bg-black/80 flex flex-col items-center justify-center">
                      <div className="w-20 h-20 border-4 border-[#D4A574] border-t-transparent rounded-full animate-spin mb-4" />
                      <p className="text-[#D4A574] text-sm">Analyzing your skin...</p>
                      <div className="w-48 h-2 bg-zinc-800 rounded-full mt-4 overflow-hidden">
                        <div
                          className="h-full bg-[#D4A574] transition-all duration-500"
                          style={{ width: `${uploadProgress}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={() => {
                      setImagePreview(null)
                      setAnalysisResult(null)
                    }}
                    className="flex-1 py-3 border border-[#D4A574]/20 text-[#D4A574] hover:bg-[#D4A574]/10 transition-all rounded-lg"
                  >
                    Retake Photo
                  </button>
                  <button
                    onClick={analyzeSkin}
                    disabled={isAnalyzing}
                    className="flex-1 py-3 bg-[#D4A574] text-black hover:bg-[#D4A574]/80 transition-all rounded-lg font-medium disabled:opacity-50"
                  >
                    {isAnalyzing ? 'Analyzing...' : 'Analyze My Skin'}
                  </button>
                </div>
              </div>
            )}

            {/* Camera View */}
            {showCamera && (
              <div className="fixed inset-0 bg-black z-50 flex flex-col">
                <div className="flex-1 relative">
                  <video
                    ref={videoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  <canvas ref={canvasRef} className="hidden" />

                  {/* Camera overlay */}
                  <div className="absolute inset-0 pointer-events-none">
                    <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-64 h-64 border-2 border-[#D4A574] rounded-full" />
                  </div>
                </div>

                <div className="p-8 flex gap-4">
                  <button
                    onClick={stopCamera}
                    className="flex-1 py-4 border border-[#D4A574]/20 text-[#D4A574] rounded-lg"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={capturePhoto}
                    className="flex-1 py-4 bg-[#D4A574] text-black rounded-lg font-medium"
                  >
                    Take Photo
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Analysis Results */}
        {analysisResult && (
          <div className="space-y-8">
            {/* Skin Profile Card */}
            <div className="bg-zinc-900/50 border border-[#D4A574]/20 rounded-2xl p-8">
              <h2 className="text-2xl text-white mb-6">Your Skin Profile</h2>

              <div className="grid md:grid-cols-2 gap-6">
                <div>
                  <p className="text-[#D4A574]/60 text-xs uppercase tracking-wider mb-2">Skin Type</p>
                  <p className="text-white text-lg capitalize">{analysisResult.skinType}</p>
                </div>
                <div>
                  <p className="text-[#D4A574]/60 text-xs uppercase tracking-wider mb-2">Skin Tone</p>
                  <p className="text-white text-lg">{analysisResult.skinTone}</p>
                </div>
                <div>
                  <p className="text-[#D4A574]/60 text-xs uppercase tracking-wider mb-2">Age Range</p>
                  <p className="text-white text-lg">{analysisResult.ageRange}</p>
                </div>
                <div>
                  <p className="text-[#D4A574]/60 text-xs uppercase tracking-wider mb-2">AI Confidence</p>
                  <p className="text-white text-lg">{(analysisResult.aiConfidence * 100).toFixed(0)}%</p>
                </div>
              </div>

              {/* Skin Metrics */}
              <div className="mt-8 space-y-4">
                <h3 className="text-lg text-white mb-4">Skin Health Metrics</h3>

                {[
                  { label: 'Hydration', value: analysisResult.hydrationLevel, color: 'bg-blue-500' },
                  { label: 'Oil Balance', value: analysisResult.oilLevel, color: 'bg-yellow-500' },
                  { label: 'Texture', value: analysisResult.textureScore, color: 'bg-purple-500' },
                  { label: 'Elasticity', value: analysisResult.elasticityScore, color: 'bg-pink-500' },
                  { label: 'Brightness', value: analysisResult.brightnessScore, color: 'bg-green-500' }
                ].map((metric) => (
                  <div key={metric.label}>
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-white/60">{metric.label}</span>
                      <span className="text-white">{(metric.value * 100).toFixed(0)}%</span>
                    </div>
                    <div className="w-full h-2 bg-zinc-800 rounded-full overflow-hidden">
                      <div
                        className={`h-full ${metric.color} transition-all duration-1000`}
                        style={{ width: `${metric.value * 100}%` }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* Skin Concerns */}
              <div className="mt-8">
                <h3 className="text-lg text-white mb-4">Primary Concerns</h3>
                <div className="flex flex-wrap gap-2">
                  {analysisResult.concerns.map((concern) => (
                    <span
                      key={concern}
                      className="px-4 py-2 bg-black border border-[#D4A574]/20 text-[#D4A574] rounded-full text-sm"
                    >
                      {concern}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Personalized Recommendations */}
            <div className="bg-zinc-900/50 border border-[#D4A574]/20 rounded-2xl p-8">
              <h2 className="text-2xl text-white mb-6">Your Personalized K-Beauty Routine</h2>

              <div className="space-y-6">
                {analysisResult.recommendations.map((rec, index) => (
                  <div
                    key={index}
                    className="bg-black border border-[#D4A574]/10 rounded-xl p-6 hover:border-[#D4A574]/30 transition-all"
                  >
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-white text-lg mb-1">{rec.product.name}</h4>
                        <p className="text-[#D4A574] text-sm">{rec.product.brand}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-white/60 text-xs line-through">${rec.product.usPrice}</p>
                        <p className="text-[#D4A574] text-xl font-light">${rec.product.seoulPrice}</p>
                        <p className="text-green-400 text-xs">Save {rec.product.savings}%</p>
                      </div>
                    </div>

                    <div className="mb-4">
                      <p className="text-white/60 text-sm">{rec.reason}</p>
                    </div>

                    <div className="flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-[#D4A574]/60">Match Score</span>
                        <span className="text-[#D4A574] font-medium">{(rec.matchScore * 100).toFixed(0)}%</span>
                      </div>
                      <button className="px-4 py-2 bg-[#D4A574] text-black text-sm rounded-lg hover:bg-[#D4A574]/80 transition-all">
                        Add to Routine
                      </button>
                    </div>

                    {/* Expected Improvements */}
                    {rec.expectedImprovement && (
                      <div className="mt-4 pt-4 border-t border-zinc-800">
                        <p className="text-xs text-white/60 mb-2">Expected Improvements:</p>
                        <div className="flex flex-wrap gap-2">
                          {Object.entries(rec.expectedImprovement).map(([key, value]) => (
                            <span key={key} className="text-xs bg-zinc-900 px-2 py-1 rounded text-green-400">
                              {key}: {value}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>

              {/* Total Savings */}
              <div className="mt-8 p-6 bg-gradient-to-r from-[#D4A574]/10 to-[#D4A574]/5 rounded-xl border border-[#D4A574]/20">
                <div className="flex justify-between items-center">
                  <div>
                    <p className="text-white text-lg mb-1">Total Routine Value</p>
                    <p className="text-white/60 text-sm">Sephora Price vs Seoul Price</p>
                  </div>
                  <div className="text-right">
                    <p className="text-white/60 line-through text-lg">$247</p>
                    <p className="text-[#D4A574] text-3xl font-light">$68</p>
                    <p className="text-green-400 text-sm">You save $179 (72%)</p>
                  </div>
                </div>

                <button className="w-full mt-6 py-4 bg-[#D4A574] text-black rounded-lg font-medium hover:bg-[#D4A574]/80 transition-all">
                  Get My Complete Routine via WhatsApp
                </button>
              </div>
            </div>

            {/* Progress Tracking Teaser */}
            <div className="bg-zinc-900/50 border border-[#D4A574]/20 rounded-2xl p-8 text-center">
              <h3 className="text-xl text-white mb-4">Track Your Skin Transformation</h3>
              <p className="text-white/60 mb-6">
                Take another analysis in 30 days to see your improvement journey.
                Our AI gets smarter with every analysis.
              </p>
              <button className="px-8 py-3 border border-[#D4A574] text-[#D4A574] rounded-lg hover:bg-[#D4A574]/10 transition-all">
                Set Reminder
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}