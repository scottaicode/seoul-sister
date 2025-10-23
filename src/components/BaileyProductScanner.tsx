'use client'

import { useState, useRef } from 'react'
import { Camera, Upload, X, Check, AlertCircle, Sparkles, Search } from 'lucide-react'
import Image from 'next/image'

interface ProductScannerProps {
  onProductScanned?: (product: any) => void
  existingProducts?: any[]
  userId?: string
  whatsappNumber?: string
}

export default function BaileyProductScanner({
  onProductScanned,
  existingProducts = [],
  userId,
  whatsappNumber
}: ProductScannerProps) {
  const [isScanning, setIsScanning] = useState(false)
  const [scanResult, setScanResult] = useState<any>(null)
  const [previewImage, setPreviewImage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleImageUpload = async (file: File) => {
    setError(null)

    // Preview the image
    const reader = new FileReader()
    reader.onload = (e) => {
      setPreviewImage(e.target?.result as string)
    }
    reader.readAsDataURL(file)

    // Upload and analyze
    setIsScanning(true)
    try {
      // Convert to base64 for sending to API
      const base64 = await fileToBase64(file)

      const response = await fetch('/api/bailey-product-scanner', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: base64,
          userId,
          whatsappNumber,
          existingProducts
        })
      })

      const data = await response.json()

      if (data.success) {
        setScanResult(data)
        onProductScanned?.(data)
      } else {
        setError(data.error || 'Failed to analyze product')
      }
    } catch (err) {
      console.error('Error scanning product:', err)
      setError('Failed to scan product. Please try again.')
    } finally {
      setIsScanning(false)
    }
  }

  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.readAsDataURL(file)
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = (error) => reject(error)
    })
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (file) {
      handleImageUpload(file)
    }
  }

  const resetScanner = () => {
    setScanResult(null)
    setPreviewImage(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const getCleanlinessColor = (score: number) => {
    if (score >= 80) return 'text-green-600'
    if (score >= 60) return 'text-yellow-600'
    if (score >= 40) return 'text-orange-600'
    return 'text-red-600'
  }

  const getCleanlinessEmoji = (score: number) => {
    if (score >= 80) return '✨'
    if (score >= 60) return '👍'
    if (score >= 40) return '⚠️'
    return '❌'
  }

  return (
    <div className="bg-white rounded-2xl shadow-lg p-6">
      {/* Header */}
      <div className="mb-6">
        <h2 className="text-2xl font-semibold text-gray-800 mb-2">Product Scanner</h2>
        <p className="text-gray-600">Take a photo of any skincare product for instant analysis</p>
      </div>

      {!scanResult ? (
        <>
          {/* Upload Area */}
          {!previewImage ? (
            <div className="border-2 border-dashed border-gray-300 rounded-xl p-8 text-center">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelect}
                className="hidden"
              />

              <div className="space-y-4">
                <div className="w-20 h-20 bg-gradient-to-r from-purple-100 to-pink-100 rounded-full flex items-center justify-center mx-auto">
                  <Camera className="w-10 h-10 text-purple-600" />
                </div>

                <div>
                  <p className="text-lg font-medium text-gray-800 mb-2">
                    Scan Your Products
                  </p>
                  <p className="text-sm text-gray-600 mb-4">
                    Bailey will analyze ingredients, rate cleanliness, and check compatibility
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-3 justify-center">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all"
                  >
                    <Camera className="inline-block w-5 h-5 mr-2" />
                    Take Photo
                  </button>

                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="px-6 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
                  >
                    <Upload className="inline-block w-5 h-5 mr-2" />
                    Upload Image
                  </button>
                </div>
              </div>
            </div>
          ) : (
            /* Preview & Scanning */
            <div className="space-y-4">
              <div className="relative rounded-xl overflow-hidden bg-gray-100">
                <img
                  src={previewImage}
                  alt="Product preview"
                  className="w-full h-64 object-contain"
                />
                {isScanning && (
                  <div className="absolute inset-0 bg-black bg-opacity-50 flex items-center justify-center">
                    <div className="text-center text-white">
                      <div className="w-16 h-16 border-4 border-white border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
                      <p className="text-lg font-medium">Bailey is analyzing...</p>
                      <p className="text-sm opacity-90">Reading ingredients & checking compatibility</p>
                    </div>
                  </div>
                )}
              </div>

              {!isScanning && (
                <button
                  onClick={resetScanner}
                  className="w-full py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
                >
                  Scan Another Product
                </button>
              )}
            </div>
          )}

          {error && (
            <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
              <p className="text-red-700 flex items-center">
                <AlertCircle className="w-5 h-5 mr-2" />
                {error}
              </p>
            </div>
          )}
        </>
      ) : (
        /* Scan Results */
        <div className="space-y-6">
          {/* Product Info */}
          <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-xl p-6">
            <div className="flex items-start justify-between mb-4">
              <div>
                <h3 className="text-xl font-semibold text-gray-800">
                  {scanResult.product.productName}
                </h3>
                <p className="text-gray-600">{scanResult.product.brand}</p>
                <p className="text-sm text-gray-500 mt-1">
                  {scanResult.product.productType}
                </p>
              </div>
              <button
                onClick={resetScanner}
                className="p-2 hover:bg-white rounded-lg transition-all"
              >
                <X className="w-5 h-5 text-gray-500" />
              </button>
            </div>

            {/* Bailey's Message */}
            <div className="bg-white rounded-lg p-4 mb-4">
              <p className="text-gray-700 leading-relaxed">
                {scanResult.baileyMessage}
              </p>
            </div>

            {/* Cleanliness Score */}
            <div className="bg-white rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-sm font-medium text-gray-700">Ingredient Cleanliness</span>
                <span className={`text-2xl font-bold ${getCleanlinessColor(scanResult.analysis.cleanlinessScore)}`}>
                  {getCleanlinessEmoji(scanResult.analysis.cleanlinessScore)} {scanResult.analysis.cleanlinessScore}/100
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-3">
                <div
                  className={`h-3 rounded-full transition-all duration-500 ${
                    scanResult.analysis.cleanlinessScore >= 80 ? 'bg-green-500' :
                    scanResult.analysis.cleanlinessScore >= 60 ? 'bg-yellow-500' :
                    scanResult.analysis.cleanlinessScore >= 40 ? 'bg-orange-500' :
                    'bg-red-500'
                  }`}
                  style={{ width: `${scanResult.analysis.cleanlinessScore}%` }}
                />
              </div>
            </div>
          </div>

          {/* Ingredient Analysis */}
          <div className="bg-gray-50 rounded-xl p-6">
            <h4 className="font-semibold text-gray-800 mb-4">Ingredient Breakdown</h4>

            {/* Beneficial Ingredients */}
            {scanResult.analysis.ingredientAnalysis.beneficial.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-green-700 mb-2">
                  ✅ Beneficial Ingredients ({scanResult.analysis.ingredientAnalysis.beneficial.length})
                </p>
                <div className="space-y-2">
                  {scanResult.analysis.ingredientAnalysis.beneficial.slice(0, 3).map((ing: any, idx: number) => (
                    <div key={idx} className="bg-green-50 rounded-lg p-3">
                      <p className="font-medium text-green-800">{ing.name}</p>
                      <p className="text-sm text-green-600">{ing.purpose}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Concerning Ingredients */}
            {scanResult.analysis.ingredientAnalysis.concerning.length > 0 && (
              <div className="mb-4">
                <p className="text-sm font-medium text-red-700 mb-2">
                  ⚠️ Concerning Ingredients ({scanResult.analysis.ingredientAnalysis.concerning.length})
                </p>
                <div className="space-y-2">
                  {scanResult.analysis.ingredientAnalysis.concerning.map((ing: any, idx: number) => (
                    <div key={idx} className="bg-red-50 rounded-lg p-3">
                      <p className="font-medium text-red-800">{ing.name}</p>
                      <p className="text-sm text-red-600">{ing.purpose}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Duplicate Warning */}
          {scanResult.analysis.duplicateAnalysis?.hasDuplicates && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4">
              <p className="font-medium text-yellow-800 mb-2">
                <AlertCircle className="inline-block w-5 h-5 mr-2" />
                Similar Products in Your Routine
              </p>
              {scanResult.analysis.duplicateAnalysis.recommendations.map((rec: string, idx: number) => (
                <p key={idx} className="text-sm text-yellow-700">{rec}</p>
              ))}
            </div>
          )}

          {/* Personalized Recommendation */}
          <div className="bg-purple-50 rounded-xl p-6">
            <h4 className="font-semibold text-purple-900 mb-3">
              <Sparkles className="inline-block w-5 h-5 mr-2" />
              Bailey's Recommendation
            </h4>

            <div className="space-y-3">
              {scanResult.analysis.personalizedRecommendation?.userNeedsThis ? (
                <div className="bg-green-100 rounded-lg p-3">
                  <Check className="inline-block w-5 h-5 text-green-600 mr-2" />
                  <span className="text-green-800">Great addition to your routine!</span>
                </div>
              ) : (
                <div className="bg-yellow-100 rounded-lg p-3">
                  <AlertCircle className="inline-block w-5 h-5 text-yellow-600 mr-2" />
                  <span className="text-yellow-800">Consider alternatives for better results</span>
                </div>
              )}

              {scanResult.analysis.personalizedRecommendation?.reasons.map((reason: string, idx: number) => (
                <p key={idx} className="text-sm text-gray-700">• {reason}</p>
              ))}

              {scanResult.analysis.personalizedRecommendation?.warnings.map((warning: string, idx: number) => (
                <p key={idx} className="text-sm text-red-600">⚠️ {warning}</p>
              ))}
            </div>

            {/* Better Alternatives */}
            {scanResult.analysis.personalizedRecommendation?.betterAlternatives?.length > 0 && (
              <div className="mt-4 pt-4 border-t border-purple-200">
                <p className="text-sm font-medium text-purple-800 mb-2">Better Alternatives:</p>
                <div className="space-y-2">
                  {scanResult.analysis.personalizedRecommendation.betterAlternatives.map((alt: any, idx: number) => (
                    <div key={idx} className="bg-white rounded-lg p-3">
                      <p className="font-medium text-gray-800">{alt.name}</p>
                      <p className="text-sm text-gray-600">{alt.brand} - ${alt.price}</p>
                      <p className="text-xs text-purple-600 mt-1">{alt.reason}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <button
              onClick={() => {
                // Add to routine logic
                onProductScanned?.(scanResult)
              }}
              className="flex-1 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all"
            >
              Add to My Routine
            </button>
            <button
              onClick={resetScanner}
              className="flex-1 py-3 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-all"
            >
              Scan Another
            </button>
          </div>
        </div>
      )}
    </div>
  )
}