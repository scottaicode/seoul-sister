'use client'

import { useState } from 'react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { AllergenDetector } from '@/lib/allergen-detector'
import { SkinConcernMatcher } from '@/lib/skin-concern-matcher'
import type { Product } from '@/hooks/useProducts'
import type { PersonalizedRecommendation } from '@/types/user'

interface SkinAnalysisHubProps {
  userEmail?: string
  products: Product[]
}

export default function SkinAnalysisHub({ userEmail, products }: SkinAnalysisHubProps) {
  const { profile, loading: profileLoading } = useUserProfile(userEmail)
  const [activeTab, setActiveTab] = useState<'recommendations' | 'concerns' | 'allergens'>('recommendations')
  const [recommendations, setRecommendations] = useState<PersonalizedRecommendation[]>([])
  const [loading, setLoading] = useState(false)
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [allergenAnalysis, setAllergenAnalysis] = useState<any>(null)

  const tabs = [
    { id: 'recommendations', label: '🎯 Personalized', description: 'AI-powered recommendations just for you' },
    { id: 'concerns', label: '🎭 Skin Concerns', description: 'Products targeting your specific needs' },
    { id: 'allergens', label: '🛡️ Safety Check', description: 'Allergen detection and safe alternatives' }
  ]

  // Fetch personalized recommendations
  const fetchRecommendations = async () => {
    if (!profile?.id) return

    setLoading(true)
    try {
      const response = await fetch(`/api/personalized-recommendations?user_id=${profile.id}&limit=8`)
      const data = await response.json()
      setRecommendations(data.recommendations || [])
    } catch (error) {
      console.error('Error fetching recommendations:', error)
    } finally {
      setLoading(false)
    }
  }

  // Check product for allergens
  const checkAllergens = async (product: Product) => {
    if (!profile?.id) return

    setSelectedProduct(product)
    setLoading(true)
    try {
      const response = await fetch('/api/allergen-check', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: profile.id,
          product_id: product.id
        })
      })
      const data = await response.json()
      setAllergenAnalysis(data)
    } catch (error) {
      console.error('Error checking allergens:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get skin concern matches
  const getConcernMatches = () => {
    if (!profile?.skin_concerns?.length) return []

    return SkinConcernMatcher.matchProductsToConcerns(
      products,
      profile.skin_concerns,
      profile
    )
  }

  if (profileLoading) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-6"></div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[1, 2, 3].map(i => (
              <div key={i} className="h-48 bg-gray-200 rounded-lg"></div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="max-w-4xl mx-auto p-6 text-center">
        <div className="bg-gradient-to-r from-pink-50 to-purple-50 rounded-2xl p-8 border border-pink-100">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">🌸 Create Your Skin Profile</h2>
          <p className="text-gray-600 mb-6">
            Unlock personalized Korean skincare recommendations powered by AI
          </p>
          <button className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-8 py-3 rounded-full font-medium hover:shadow-lg transition-all">
            Get Started →
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🔬 AI Skin Analysis Hub
        </h1>
        <p className="text-gray-600">
          Personalized Korean skincare powered by advanced AI analysis
        </p>
      </div>

      {/* Profile Summary */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl p-6 mb-8 border border-blue-100">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-2">Your Skin Profile</h3>
            <div className="flex flex-wrap gap-3">
              {profile.skin_type && (
                <span className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                  {profile.skin_type} skin
                </span>
              )}
              {profile.skin_concerns?.map(concern => (
                <span key={concern} className="bg-purple-100 text-purple-800 px-3 py-1 rounded-full text-sm">
                  {concern}
                </span>
              ))}
            </div>
          </div>
          <div className="text-right">
            <div className="text-sm text-gray-500">Experience Level</div>
            <div className="font-medium text-gray-800">{profile.skincare_experience || 'Not set'}</div>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-col sm:flex-row gap-4 mb-8">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 p-4 rounded-xl border transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white border-transparent shadow-lg'
                : 'bg-white text-gray-700 border-gray-200 hover:border-pink-300 hover:shadow-md'
            }`}
          >
            <div className="text-lg font-medium mb-1">{tab.label}</div>
            <div className={`text-sm ${activeTab === tab.id ? 'text-pink-100' : 'text-gray-500'}`}>
              {tab.description}
            </div>
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="min-h-96">
        {activeTab === 'recommendations' && (
          <div>
            <div className="flex justify-between items-center mb-6">
              <h2 className="text-xl font-semibold text-gray-800">Personalized Recommendations</h2>
              <button
                onClick={fetchRecommendations}
                disabled={loading}
                className="bg-pink-500 text-white px-6 py-2 rounded-lg hover:bg-pink-600 disabled:opacity-50"
              >
                {loading ? 'Analyzing...' : 'Get Recommendations'}
              </button>
            </div>

            {recommendations.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {recommendations.map((rec, index) => (
                  <div key={index} className="bg-white rounded-xl border border-gray-200 overflow-hidden hover:shadow-lg transition-shadow">
                    <div className="p-6">
                      <div className="flex justify-between items-start mb-3">
                        <h3 className="font-semibold text-gray-800 text-lg">Product Match</h3>
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                          rec.confidence_level === 'high' ? 'bg-green-100 text-green-800' :
                          rec.confidence_level === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                          'bg-gray-100 text-gray-800'
                        }`}>
                          {rec.compatibility_score}% match
                        </span>
                      </div>
                      <div className="space-y-2">
                        {rec.recommendation_reason.map((reason, i) => (
                          <div key={i} className="text-sm text-gray-600 flex items-start">
                            <span className="text-green-500 mr-2">✓</span>
                            {reason}
                          </div>
                        ))}
                      </div>
                      {rec.personalized_benefits.length > 0 && (
                        <div className="mt-4 pt-4 border-t border-gray-100">
                          <div className="text-sm font-medium text-gray-700 mb-2">Expected Benefits:</div>
                          <div className="flex flex-wrap gap-2">
                            {rec.personalized_benefits.map((benefit, i) => (
                              <span key={i} className="bg-blue-50 text-blue-700 px-2 py-1 rounded text-xs">
                                {benefit}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">🎯</div>
                <p>Click "Get Recommendations" to see your personalized matches</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'concerns' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Products for Your Skin Concerns</h2>

            {profile.skin_concerns?.length ? (
              <div className="space-y-8">
                {getConcernMatches().map(concernGroup => (
                  <div key={concernGroup.concern} className="bg-white rounded-xl border border-gray-200 p-6">
                    <h3 className="text-lg font-semibold text-gray-800 mb-4 capitalize">
                      🎭 {concernGroup.concern} Solutions
                    </h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {concernGroup.matchedProducts.slice(0, 6).map((match, index) => (
                        <div key={index} className="border border-gray-100 rounded-lg p-4 hover:shadow-md transition-shadow">
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-medium text-gray-800">{match.product.name_english}</h4>
                            <span className="text-sm text-gray-500">{match.product.brand}</span>
                          </div>
                          <div className="text-sm text-gray-600 mb-3">
                            Match Score: {Math.round(match.matchScore * 100)}%
                          </div>
                          <div className="space-y-1">
                            {match.expectedBenefits.slice(0, 2).map((benefit, i) => (
                              <div key={i} className="text-xs text-blue-600 flex items-center">
                                <span className="mr-1">•</span>
                                {benefit}
                              </div>
                            ))}
                          </div>
                          <div className="mt-3 text-xs text-gray-500">
                            Expected results: {match.timeToResults}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">🎭</div>
                <p>Add skin concerns to your profile to see targeted product recommendations</p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'allergens' && (
          <div>
            <h2 className="text-xl font-semibold text-gray-800 mb-6">Allergen Safety Check</h2>

            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mb-8">
              {products.slice(0, 12).map(product => (
                <button
                  key={product.id}
                  onClick={() => checkAllergens(product)}
                  className="p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-all text-left"
                >
                  <div className="font-medium text-gray-800 text-sm mb-1">{product.name_english}</div>
                  <div className="text-xs text-gray-500">{product.brand}</div>
                  <div className="text-xs text-pink-600 mt-2">Check Safety →</div>
                </button>
              ))}
            </div>

            {allergenAnalysis && selectedProduct && (
              <div className="bg-white rounded-xl border border-gray-200 p-6">
                <h3 className="text-lg font-semibold text-gray-800 mb-4">
                  Safety Analysis: {selectedProduct.name_english}
                </h3>

                <div className={`p-4 rounded-lg mb-6 ${
                  allergenAnalysis.allergen_analysis.overallRiskLevel === 'low' ? 'bg-green-50 border border-green-200' :
                  allergenAnalysis.allergen_analysis.overallRiskLevel === 'medium' ? 'bg-yellow-50 border border-yellow-200' :
                  'bg-red-50 border border-red-200'
                }`}>
                  <div className="flex items-center justify-between mb-2">
                    <span className="font-medium">Overall Risk Level</span>
                    <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                      allergenAnalysis.allergen_analysis.overallRiskLevel === 'low' ? 'bg-green-100 text-green-800' :
                      allergenAnalysis.allergen_analysis.overallRiskLevel === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                      'bg-red-100 text-red-800'
                    }`}>
                      {allergenAnalysis.allergen_analysis.overallRiskLevel.toUpperCase()}
                    </span>
                  </div>
                  <p className="text-sm text-gray-700">{allergenAnalysis.recommendation}</p>
                </div>

                {allergenAnalysis.allergen_analysis.alerts.length > 0 && (
                  <div className="mb-6">
                    <h4 className="font-medium text-gray-800 mb-3">Detected Concerns:</h4>
                    <div className="space-y-3">
                      {allergenAnalysis.allergen_analysis.alerts.map((alert: any, index: number) => (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg">
                          <div className="flex justify-between items-start mb-2">
                            <span className="font-medium text-gray-800 capitalize">{alert.allergen.replace('_', ' ')}</span>
                            <span className={`px-2 py-1 rounded text-xs ${
                              alert.severity === 'high' ? 'bg-red-100 text-red-800' :
                              alert.severity === 'medium' ? 'bg-yellow-100 text-yellow-800' :
                              'bg-blue-100 text-blue-800'
                            }`}>
                              {alert.severity}
                            </span>
                          </div>
                          <p className="text-sm text-gray-600 mb-2">{alert.description}</p>
                          <div className="text-xs text-gray-500">
                            Found: {alert.foundIngredients.join(', ')}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div>
                  <h4 className="font-medium text-gray-800 mb-3">Safety Recommendations:</h4>
                  <div className="space-y-2">
                    {allergenAnalysis.allergen_analysis.safetyRecommendations.map((rec: string, index: number) => (
                      <div key={index} className="text-sm text-gray-600 flex items-start">
                        <span className="mr-2">•</span>
                        {rec}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {profile.ingredient_allergies?.length > 0 && (
              <div className="mt-8 bg-blue-50 rounded-xl p-6 border border-blue-200">
                <h4 className="font-medium text-gray-800 mb-3">Your Known Allergens:</h4>
                <div className="flex flex-wrap gap-2">
                  {profile.ingredient_allergies.map(allergen => (
                    <span key={allergen} className="bg-red-100 text-red-800 px-3 py-1 rounded-full text-sm">
                      {allergen}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}