'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import AuthHeader from '@/components/AuthHeader'
// import BaileyBarcodeScanner from '@/components/BaileyBarcodeScanner'
// import { useAuth } from '@/contexts/AuthContext'
import {
  Camera,
  BarChart3,
  Scan,
  Calendar,
  AlertTriangle,
  Zap,
  User,
  ArrowLeft,
  CheckCircle,
  Upload,
  Target
} from 'lucide-react'

function BaileyFeaturesContent() {
  const searchParams = useSearchParams()
  const feature = searchParams.get('feature')
  const [selectedFeature, setSelectedFeature] = useState(feature || 'overview')
  const [uploading, setUploading] = useState(false)
  const [uploadResult, setUploadResult] = useState<any>(null)
  // const { user } = useAuth()
  const user = { email: 'demo@user.com' } // Temporary for build

  const features = [
    {
      id: 'product-scanner',
      name: 'Product Photo Scanner',
      icon: Camera,
      description: 'AI-powered ingredient analysis and cleanliness scoring',
      color: 'from-blue-500 to-purple-500'
    },
    {
      id: 'routine-analyzer',
      name: 'Routine Analyzer',
      icon: BarChart3,
      description: 'Analyze product compatibility and layering order',
      color: 'from-green-500 to-blue-500'
    },
    {
      id: 'barcode-scanner',
      name: 'Barcode Scanner',
      icon: Scan,
      description: 'In-store price comparison and duplicate detection',
      color: 'from-orange-500 to-red-500'
    },
    {
      id: 'progress-tracking',
      name: 'Progress Tracking',
      icon: Calendar,
      description: 'Weekly skin analysis and improvement tracking',
      color: 'from-teal-500 to-green-500'
    },
    {
      id: 'irritation-analysis',
      name: 'Irritation Analysis',
      icon: AlertTriangle,
      description: 'AI diagnosis of skin reactions and treatment plans',
      color: 'from-red-500 to-pink-500'
    },
    {
      id: 'gradual-introduction',
      name: 'Gradual Introduction',
      icon: Zap,
      description: 'Week-by-week product introduction plans',
      color: 'from-purple-500 to-pink-500'
    }
  ]

  const handleFileUpload = async (file: File, endpoint: string) => {
    setUploading(true)
    setUploadResult(null)

    try {
      const formData = new FormData()
      formData.append('image', file)
      if (user?.email) {
        formData.append('userId', user.email)
      }

      const response = await fetch(endpoint, {
        method: 'POST',
        body: formData
      })

      const result = await response.json()
      setUploadResult(result)
    } catch (error) {
      console.error('Upload error:', error)
      setUploadResult({ error: 'Failed to analyze image' })
    } finally {
      setUploading(false)
    }
  }

  const renderFeatureContent = () => {
    const selectedFeatureData = features.find(f => f.id === selectedFeature)

    switch (selectedFeature) {
      case 'product-scanner':
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-blue-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Camera className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Product Photo Scanner</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Upload a photo of any skincare product to get AI-powered ingredient analysis,
                cleanliness scoring, and personalized compatibility assessment.
              </p>
            </div>

            <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-8">
              <div className="text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <label htmlFor="product-upload" className="cursor-pointer">
                  <span className="bg-blue-500 text-white px-6 py-3 rounded-lg hover:bg-blue-600 transition-colors inline-block">
                    Upload Product Photo
                  </span>
                  <input
                    id="product-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleFileUpload(file, '/api/bailey-product-scanner')
                      }
                    }}
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">
                  Take a clear photo of the product label showing ingredients
                </p>
              </div>
            </div>

            {uploading && (
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-6 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-blue-700">Analyzing product ingredients...</p>
              </div>
            )}

            {uploadResult && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-xl font-semibold mb-4">Analysis Results</h3>
                {uploadResult.error ? (
                  <p className="text-red-600">{uploadResult.error}</p>
                ) : (
                  <div className="space-y-4">
                    {uploadResult.productName && (
                      <div>
                        <h4 className="font-medium text-gray-800">Product Identified:</h4>
                        <p className="text-gray-600">{uploadResult.productName}</p>
                      </div>
                    )}
                    {uploadResult.cleanlinessScore && (
                      <div>
                        <h4 className="font-medium text-gray-800">Cleanliness Score:</h4>
                        <div className="flex items-center space-x-2">
                          <div className="w-32 bg-gray-200 rounded-full h-3">
                            <div
                              className={`h-3 rounded-full ${uploadResult.cleanlinessScore >= 70 ? 'bg-green-500' : uploadResult.cleanlinessScore >= 50 ? 'bg-yellow-500' : 'bg-red-500'}`}
                              style={{ width: `${uploadResult.cleanlinessScore}%` }}
                            ></div>
                          </div>
                          <span className="font-medium">{uploadResult.cleanlinessScore}/100</span>
                        </div>
                      </div>
                    )}
                    {uploadResult.baileyAnalysis && (
                      <div>
                        <h4 className="font-medium text-gray-800">Bailey's Analysis:</h4>
                        <p className="text-gray-600">{uploadResult.baileyAnalysis}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )

      case 'barcode-scanner':
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-orange-500 to-red-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Scan className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Barcode Scanner</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Scan product barcodes while shopping to compare prices across retailers,
                check for duplicates in your collection, and get Bailey's buying advice.
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-semibold mb-4">Barcode Scanner</h3>
              <p className="text-gray-600 mb-4">
                Barcode scanning feature is being prepared. Check back soon for in-store price comparison and duplicate detection.
              </p>
              <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
                <p className="text-orange-700 text-sm">
                  🚧 Feature coming soon - camera permissions and barcode scanning library being configured
                </p>
              </div>
            </div>
          </div>
        )

      case 'routine-analyzer':
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-green-500 to-blue-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <BarChart3 className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Routine Analyzer</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Upload photos of your current skincare routine to get comprehensive analysis
                on product compatibility, layering order, and optimization suggestions.
              </p>
            </div>

            <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-8">
              <div className="text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <label htmlFor="routine-upload" className="cursor-pointer">
                  <span className="bg-green-500 text-white px-6 py-3 rounded-lg hover:bg-green-600 transition-colors inline-block">
                    Upload Routine Photos
                  </span>
                  <input
                    id="routine-upload"
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => {
                      const files = Array.from(e.target.files || [])
                      if (files.length > 0) {
                        // For demo, just upload the first file
                        handleFileUpload(files[0], '/api/bailey-routine-analyzer')
                      }
                    }}
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">
                  Upload photos of all products in your current routine
                </p>
              </div>
            </div>

            {uploading && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-6 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-green-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-green-700">Analyzing routine compatibility...</p>
              </div>
            )}

            {uploadResult && (
              <div className="bg-white rounded-lg border border-gray-200 p-6">
                <h3 className="text-xl font-semibold mb-4">Routine Analysis</h3>
                {uploadResult.error ? (
                  <p className="text-red-600">{uploadResult.error}</p>
                ) : (
                  <div className="space-y-4">
                    {uploadResult.routineScore && (
                      <div>
                        <h4 className="font-medium text-gray-800">Overall Routine Score:</h4>
                        <div className="flex items-center space-x-2">
                          <div className="w-32 bg-gray-200 rounded-full h-3">
                            <div
                              className="h-3 rounded-full bg-green-500"
                              style={{ width: `${uploadResult.routineScore}%` }}
                            ></div>
                          </div>
                          <span className="font-medium">{uploadResult.routineScore}/100</span>
                        </div>
                      </div>
                    )}
                    {uploadResult.baileyAnalysis && (
                      <div>
                        <h4 className="font-medium text-gray-800">Bailey's Routine Analysis:</h4>
                        <p className="text-gray-600">{uploadResult.baileyAnalysis}</p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        )

      case 'progress-tracking':
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-teal-500 to-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Calendar className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Progress Tracking</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Take weekly progress photos to track skin improvements, detect purging phases,
                and get Bailey's analysis of your skincare journey.
              </p>
            </div>

            <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-8">
              <div className="text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <label htmlFor="progress-upload" className="cursor-pointer">
                  <span className="bg-teal-500 text-white px-6 py-3 rounded-lg hover:bg-teal-600 transition-colors inline-block">
                    Upload Progress Photo
                  </span>
                  <input
                    id="progress-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleFileUpload(file, '/api/bailey-progress-tracking')
                      }
                    }}
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">
                  Take a clear selfie in consistent lighting
                </p>
              </div>
            </div>

            {uploading && (
              <div className="bg-teal-50 border border-teal-200 rounded-lg p-6 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-teal-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-teal-700">Analyzing skin progress...</p>
              </div>
            )}
          </div>
        )

      case 'irritation-analysis':
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-red-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <AlertTriangle className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Irritation Analysis</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Upload photos of skin irritation or reactions to get AI diagnosis,
                identify potential causes, and receive Bailey's treatment recommendations.
              </p>
            </div>

            <div className="bg-white rounded-lg border-2 border-dashed border-gray-300 p-8">
              <div className="text-center">
                <Upload className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <label htmlFor="irritation-upload" className="cursor-pointer">
                  <span className="bg-red-500 text-white px-6 py-3 rounded-lg hover:bg-red-600 transition-colors inline-block">
                    Upload Irritation Photo
                  </span>
                  <input
                    id="irritation-upload"
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0]
                      if (file) {
                        handleFileUpload(file, '/api/bailey-irritation-analysis')
                      }
                    }}
                  />
                </label>
                <p className="text-sm text-gray-500 mt-2">
                  Photo of the affected skin area in good lighting
                </p>
              </div>
            </div>

            {uploading && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-6 text-center">
                <div className="animate-spin w-8 h-8 border-4 border-red-500 border-t-transparent rounded-full mx-auto mb-4"></div>
                <p className="text-red-700">Analyzing skin irritation...</p>
              </div>
            )}
          </div>
        )

      case 'gradual-introduction':
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-purple-500 to-pink-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <Zap className="w-10 h-10 text-white" />
              </div>
              <h2 className="text-3xl font-bold text-gray-800 mb-2">Gradual Introduction</h2>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Get personalized week-by-week plans for safely introducing new products
                to your routine, with purging predictions and Bailey's guidance.
              </p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-6">
              <h3 className="text-xl font-semibold mb-4">Create Introduction Plan</h3>
              <p className="text-gray-600 mb-4">
                Complete your Bailey profile first to generate personalized introduction plans.
              </p>
              <a href="/bailey-onboarding" className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors inline-block">
                Complete Bailey Profile
              </a>
            </div>
          </div>
        )

      default:
        return (
          <div className="space-y-8">
            <div className="text-center">
              <div className="w-20 h-20 bg-gradient-to-r from-pink-500 to-purple-500 rounded-full flex items-center justify-center mx-auto mb-4">
                <User className="w-10 h-10 text-white" />
              </div>
              <h1 className="text-4xl font-bold text-gray-800 mb-2">Bailey's AI Features</h1>
              <p className="text-gray-600 max-w-2xl mx-auto">
                Your comprehensive skincare intelligence platform. Choose a feature below to get started with Bailey's personalized analysis.
              </p>
            </div>

            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              {features.map((feature) => {
                const IconComponent = feature.icon
                return (
                  <div
                    key={feature.id}
                    onClick={() => setSelectedFeature(feature.id)}
                    className="bg-white rounded-lg border border-gray-200 p-6 cursor-pointer hover:shadow-lg transition-all hover:scale-105"
                  >
                    <div className={`w-16 h-16 bg-gradient-to-r ${feature.color} rounded-full flex items-center justify-center mb-4`}>
                      <IconComponent className="w-8 h-8 text-white" />
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800 mb-2">{feature.name}</h3>
                    <p className="text-gray-600 text-sm">{feature.description}</p>
                  </div>
                )
              })}
            </div>

            <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-lg border border-purple-200 p-6">
              <h3 className="text-xl font-semibold text-gray-800 mb-2">Getting Started</h3>
              <p className="text-gray-600 mb-4">
                For the most personalized experience, complete your comprehensive Bailey profile first.
                This enables all features to provide tailored recommendations based on your unique skin needs.
              </p>
              <a href="/bailey-onboarding" className="bg-purple-500 text-white px-6 py-3 rounded-lg hover:bg-purple-600 transition-colors inline-block">
                Complete Bailey Profile
              </a>
            </div>
          </div>
        )
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50">
      <AuthHeader />

      <div className="pt-24 pb-12">
        <div className="max-w-6xl mx-auto px-6">
          {selectedFeature !== 'overview' && (
            <button
              onClick={() => setSelectedFeature('overview')}
              className="flex items-center space-x-2 text-gray-600 hover:text-gray-800 mb-8 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Features</span>
            </button>
          )}

          {renderFeatureContent()}
        </div>
      </div>
    </div>
  )
}

export default function BaileyFeaturesPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center">
        <div className="text-center">
          <div className="w-16 h-16 border-4 border-purple-300 border-t-purple-600 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-gray-600">Loading Bailey's features...</p>
        </div>
      </div>
    }>
      <BaileyFeaturesContent />
    </Suspense>
  )
}