'use client'

import { useState, useRef } from 'react'
import { Camera, Upload, Loader2, Check, AlertCircle } from 'lucide-react'
import { useSkinAnalysis } from '@/hooks/useSkinAnalysis'

export default function SkinAnalysisUpload({ userId }: { userId?: string }) {
  const [selectedImage, setSelectedImage] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const { analysis, loading, error, analyzeSkin } = useSkinAnalysis()

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file)
      const reader = new FileReader()
      reader.onloadend = () => {
        setPreviewUrl(reader.result as string)
      }
      reader.readAsDataURL(file)
    }
  }

  const handleAnalyze = async () => {
    if (!selectedImage) return
    await analyzeSkin(selectedImage, userId)
  }

  const handleReset = () => {
    setSelectedImage(null)
    setPreviewUrl(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  if (analysis) {
    return (
      <div className="max-w-4xl mx-auto p-6 bg-black/40 border border-[#d4a574]/20 rounded-lg">
        {/* Analysis Results */}
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-light text-[#d4a574]">Your Skin Analysis</h2>
            <button
              onClick={handleReset}
              className="text-sm text-gray-400 hover:text-white transition-colors"
            >
              Analyze Again
            </button>
          </div>

          {/* Skin Type & Scores */}
          <div className="grid md:grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Skin Type</div>
              <div className="text-xl font-light text-white capitalize">{analysis.skinType}</div>
              <div className="text-xs text-[#d4a574] mt-1">
                {analysis.confidenceScore * 100}% confidence
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Hydration Level</div>
              <div className="text-xl font-light text-white">{analysis.hydrationLevel}/10</div>
              <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                <div
                  className="bg-[#d4a574] h-1 rounded-full"
                  style={{ width: `${analysis.hydrationLevel * 10}%` }}
                />
              </div>
            </div>
            <div className="bg-gray-800/50 rounded-lg p-4">
              <div className="text-xs text-gray-400 mb-1">Skin Clarity</div>
              <div className="text-xl font-light text-white">{analysis.clarityScore}/10</div>
              <div className="w-full bg-gray-700 rounded-full h-1 mt-2">
                <div
                  className="bg-[#d4a574] h-1 rounded-full"
                  style={{ width: `${analysis.clarityScore * 10}%` }}
                />
              </div>
            </div>
          </div>

          {/* Concerns */}
          <div className="mb-6">
            <h3 className="text-sm font-medium text-gray-400 mb-3">Detected Concerns</h3>
            <div className="flex flex-wrap gap-2">
              {analysis.concerns.map((concern, i) => (
                <span
                  key={i}
                  className="bg-gray-800/50 text-white text-sm px-3 py-1 rounded-full border border-gray-700"
                >
                  {concern}
                </span>
              ))}
            </div>
          </div>

          {/* Recommended Routine */}
          <div className="grid md:grid-cols-2 gap-6 mb-6">
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Morning Routine</h3>
              <ol className="space-y-2">
                {analysis.recommendations.routine.morning.map((step, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-[#d4a574] text-xs mr-2">{i + 1}.</span>
                    <span className="text-sm text-white">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
            <div>
              <h3 className="text-sm font-medium text-gray-400 mb-3">Evening Routine</h3>
              <ol className="space-y-2">
                {analysis.recommendations.routine.evening.map((step, i) => (
                  <li key={i} className="flex items-start">
                    <span className="text-[#d4a574] text-xs mr-2">{i + 1}.</span>
                    <span className="text-sm text-white">{step}</span>
                  </li>
                ))}
              </ol>
            </div>
          </div>

          {/* Ingredients */}
          <div className="grid md:grid-cols-2 gap-6">
            <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-4">
              <h3 className="text-sm font-medium text-green-400 mb-3">
                <Check className="inline-block w-4 h-4 mr-1" />
                Beneficial Ingredients
              </h3>
              <div className="flex flex-wrap gap-2">
                {analysis.recommendations.ingredients.beneficial.map((ing, i) => (
                  <span key={i} className="text-xs text-gray-300">
                    {ing}
                  </span>
                ))}
              </div>
            </div>
            <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4">
              <h3 className="text-sm font-medium text-red-400 mb-3">
                <AlertCircle className="inline-block w-4 h-4 mr-1" />
                Ingredients to Avoid
              </h3>
              <div className="flex flex-wrap gap-2">
                {analysis.recommendations.ingredients.avoid.map((ing, i) => (
                  <span key={i} className="text-xs text-gray-300">
                    {ing}
                  </span>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button className="flex-1 bg-[#d4a574] text-black py-3 rounded-lg font-light hover:bg-[#d4a574]/90 transition-colors">
            View Recommended Products
          </button>
          <button className="flex-1 border border-[#d4a574] text-[#d4a574] py-3 rounded-lg font-light hover:bg-[#d4a574]/10 transition-colors">
            Save Analysis
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-2xl mx-auto p-6 bg-black/40 border border-[#d4a574]/20 rounded-lg">
      <h2 className="text-2xl font-light text-[#d4a574] mb-6 text-center">
        AI Skin Analysis
      </h2>

      {/* Upload Area */}
      <div className="mb-6">
        {previewUrl ? (
          <div className="relative">
            <img
              src={previewUrl}
              alt="Skin analysis preview"
              className="w-full h-64 object-cover rounded-lg"
            />
            <button
              onClick={handleReset}
              className="absolute top-2 right-2 bg-black/50 text-white p-2 rounded-full hover:bg-black/70 transition-colors"
            >
              ×
            </button>
          </div>
        ) : (
          <label className="block cursor-pointer">
            <div className="border-2 border-dashed border-[#d4a574]/30 rounded-lg p-12 text-center hover:border-[#d4a574]/50 transition-colors">
              <Camera className="w-12 h-12 text-[#d4a574] mx-auto mb-4" />
              <p className="text-white mb-2">Click to upload a photo</p>
              <p className="text-gray-400 text-sm">
                Take a clear, front-facing selfie in good lighting
              </p>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-900/20 border border-red-700/30 rounded-lg p-4 mb-6">
          <p className="text-red-400 text-sm">{error}</p>
        </div>
      )}

      {/* Instructions */}
      <div className="bg-gray-800/30 rounded-lg p-4 mb-6">
        <h3 className="text-sm font-medium text-gray-400 mb-2">For Best Results:</h3>
        <ul className="space-y-1 text-xs text-gray-500">
          <li>• Remove makeup and cleanse your face</li>
          <li>• Use natural lighting (avoid harsh shadows)</li>
          <li>• Face the camera directly</li>
          <li>• Keep a neutral expression</li>
        </ul>
      </div>

      {/* Analyze Button */}
      <button
        onClick={handleAnalyze}
        disabled={!selectedImage || loading}
        className={`w-full py-3 rounded-lg font-light transition-colors ${
          selectedImage && !loading
            ? 'bg-[#d4a574] text-black hover:bg-[#d4a574]/90'
            : 'bg-gray-800 text-gray-500 cursor-not-allowed'
        }`}
      >
        {loading ? (
          <>
            <Loader2 className="inline-block w-4 h-4 mr-2 animate-spin" />
            Analyzing your skin...
          </>
        ) : (
          'Analyze My Skin'
        )}
      </button>

      {/* Privacy Notice */}
      <p className="text-xs text-gray-500 text-center mt-4">
        Your photo is processed securely and never stored
      </p>
    </div>
  )
}