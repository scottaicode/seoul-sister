'use client'

import { useState, useEffect } from 'react'
import { useSkinProfile, usePersonalizedRecommendations, useIngredientAnalysis } from '@/hooks/useSkinProfile'
import SkinProfileManager from '@/components/SkinProfileManager'
import { useProducts } from '@/hooks/useProducts'
import Link from 'next/link'
import Image from 'next/image'

export default function PersonalizedDashboard() {
  const [whatsappNumber, setWhatsappNumber] = useState('')
  const [activeTab, setActiveTab] = useState<'profile' | 'recommendations' | 'analysis'>('profile')
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null)

  const { profile, loading: profileLoading, hasProfile } = useSkinProfile(whatsappNumber)
  const { recommendations, loading: recsLoading, generateCustomRecommendations } = usePersonalizedRecommendations(whatsappNumber)
  const { analysis, loading: analysisLoading, analyzeIngredients } = useIngredientAnalysis()
  const { products } = useProducts()

  useEffect(() => {
    const storedNumber = localStorage.getItem('whatsapp_number') || '+1234567890'
    setWhatsappNumber(storedNumber)
  }, [])

  const handlePhoneNumberChange = (number: string) => {
    setWhatsappNumber(number)
    localStorage.setItem('whatsapp_number', number)
  }

  const handleAnalyzeProduct = async (productId: string) => {
    setSelectedProductId(productId)
    await analyzeIngredients(productId, whatsappNumber)
  }

  const tabs = [
    { id: 'profile', label: '👤 My Profile', description: 'Manage your skin profile' },
    { id: 'recommendations', label: '✨ Recommendations', description: 'Personalized product matches' },
    { id: 'analysis', label: '🔬 Ingredient Analysis', description: 'Safety and compatibility check' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-luxury-charcoal to-black">
      <div className="container mx-auto px-4 py-8">
        <div className="text-center mb-8">
          <p className="text-caption mb-4 text-luxury-gold tracking-widest">AI-POWERED BEAUTY INTELLIGENCE</p>
          <h1 className="text-4xl md:text-5xl font-light text-white mb-4 tracking-wide">
            Your Personalized Beauty Hub
          </h1>
          <div className="gold-line mx-auto mb-6"></div>
          <p className="text-lg font-light text-gray-300 max-w-3xl mx-auto mb-6">
            AI-powered skincare recommendations, ingredient analysis, and personalized product matching
            for your unique skin needs.
          </p>

          <div className="flex justify-center items-center gap-4 mb-6">
            <label className="text-sm font-medium text-luxury-gold tracking-wide">WhatsApp Number:</label>
            <input
              type="text"
              value={whatsappNumber}
              onChange={(e) => handlePhoneNumberChange(e.target.value)}
              placeholder="+1234567890"
              className="px-4 py-2 bg-luxury-charcoal/50 border border-luxury-gold/30 rounded-lg focus:outline-none focus:ring-2 focus:ring-luxury-gold/50 text-white placeholder-gray-400"
            />
          </div>
        </div>

        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-6 py-3 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-luxury-gold text-black shadow-lg font-medium'
                  : 'bg-luxury-charcoal/30 text-gray-300 hover:bg-luxury-charcoal/50 border border-luxury-gold/20 hover:border-luxury-gold/40'
              }`}
            >
              <div className="font-semibold tracking-wide">{tab.label}</div>
              <div className="text-xs opacity-75 font-light">{tab.description}</div>
            </button>
          ))}
        </div>

        {activeTab === 'profile' && (
          <div>
            {whatsappNumber ? (
              <SkinProfileManager
                whatsappNumber={whatsappNumber}
                onProfileUpdate={(profile) => {
                  console.log('Profile updated:', profile)
                }}
              />
            ) : (
              <div className="text-center py-12">
                <div className="text-6xl mb-4">📱</div>
                <h3 className="text-lg font-semibold text-white mb-2">
                  Enter Your WhatsApp Number
                </h3>
                <p className="text-gray-300">
                  We need your WhatsApp number to save and sync your skin profile
                </p>
              </div>
            )}
          </div>
        )}

        {activeTab === 'recommendations' && (
          <div className="space-y-6">
            <div className="bg-luxury-charcoal/20 rounded-2xl p-6 border border-luxury-gold/20">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-2xl font-bold text-white">
                  AI Recommendations for You
                </h2>
                <button
                  onClick={() => generateCustomRecommendations()}
                  disabled={recsLoading || !hasProfile}
                  className="px-4 py-2 bg-luxury-gold text-black rounded-lg hover:bg-luxury-gold/90 disabled:opacity-50 disabled:cursor-not-allowed font-medium tracking-wide"
                >
                  {recsLoading ? 'Generating...' : 'Refresh Recommendations'}
                </button>
              </div>

              {!hasProfile ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">👤</div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Create Your Profile First
                  </h3>
                  <p className="text-gray-300 mb-4">
                    To get personalized recommendations, please create your skin profile first
                  </p>
                  <button
                    onClick={() => setActiveTab('profile')}
                    className="px-6 py-3 bg-luxury-gold text-black rounded-xl hover:bg-luxury-gold/90 font-medium tracking-wide"
                  >
                    Create Profile
                  </button>
                </div>
              ) : recsLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-pink-500 mx-auto mb-4"></div>
                  <p className="text-gray-300">Analyzing your skin profile and generating recommendations...</p>
                </div>
              ) : recommendations.length > 0 ? (
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {recommendations.map((rec: any) => {
                    const product = rec.product
                    return (
                      <div key={rec.productId} className="bg-luxury-charcoal/10 rounded-xl p-6 border">
                        {product && (
                          <>
                            <div className="aspect-square bg-luxury-charcoal/20 rounded-lg mb-4 overflow-hidden">
                              <Image
                                src={product.image_url || 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=300&h=300&fit=crop'}
                                alt={product.name}
                                width={300}
                                height={300}
                                className="w-full h-full object-cover"
                              />
                            </div>
                            <h3 className="font-semibold text-white mb-2">{product.name}</h3>
                            <p className="text-sm text-gray-300 mb-2">{product.brand}</p>
                            <div className="flex justify-between items-center mb-3">
                              <span className="text-luxury-gold font-bold">${product.seoul_price}</span>
                              <span className="text-xs bg-green-900/30 text-green-400 px-2 py-1 rounded border border-green-700/30">
                                {product.savings_percentage}% savings
                              </span>
                            </div>
                            <div className="space-y-2 mb-4">
                              <div className="flex items-center gap-2">
                                <span className="text-sm font-medium">Match Score:</span>
                                <div className="flex-1 bg-luxury-charcoal/30 rounded-full h-2">
                                  <div
                                    className="bg-luxury-gold h-2 rounded-full"
                                    style={{ width: `${(rec.matchScore || 0) * 100}%` }}
                                  ></div>
                                </div>
                                <span className="text-sm text-gray-300">
                                  {Math.round((rec.matchScore || 0) * 100)}%
                                </span>
                              </div>
                            </div>
                            {rec.reasons && rec.reasons.length > 0 && (
                              <div className="mb-4">
                                <p className="text-xs font-medium text-gray-700 mb-1">Why it's perfect for you:</p>
                                <ul className="text-xs text-gray-300 space-y-1">
                                  {rec.reasons.slice(0, 2).map((reason: string, idx: number) => (
                                    <li key={idx}>• {reason}</li>
                                  ))}
                                </ul>
                              </div>
                            )}
                            <button
                              onClick={() => handleAnalyzeProduct(product.id)}
                              className="w-full text-sm bg-luxury-gold/20 text-luxury-gold py-2 rounded-lg hover:bg-luxury-gold/30 transition-colors border border-luxury-gold/30 font-medium"
                            >
                              Analyze Ingredients
                            </button>
                          </>
                        )}
                      </div>
                    )
                  })}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🤔</div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    No Recommendations Yet
                  </h3>
                  <p className="text-gray-300">
                    Click "Refresh Recommendations" to get AI-powered product matches
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {activeTab === 'analysis' && (
          <div className="space-y-6">
            <div className="bg-luxury-charcoal/20 rounded-2xl p-6 border border-luxury-gold/20">
              <h2 className="text-2xl font-bold text-white mb-6">
                Ingredient Safety Analysis
              </h2>

              {!selectedProductId ? (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">🔬</div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Select a Product to Analyze
                  </h3>
                  <p className="text-gray-300 mb-6">
                    Go to recommendations and click "Analyze Ingredients" on any product
                  </p>
                  <button
                    onClick={() => setActiveTab('recommendations')}
                    className="px-6 py-3 bg-purple-500 text-white rounded-xl hover:bg-purple-600"
                  >
                    View Recommendations
                  </button>
                </div>
              ) : analysisLoading ? (
                <div className="text-center py-12">
                  <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
                  <p className="text-gray-300">Analyzing ingredients for safety and compatibility...</p>
                </div>
              ) : analysis ? (
                <div className="space-y-6">
                  {analysis.product && (
                    <div className="bg-luxury-charcoal/10 rounded-xl p-6">
                      <h3 className="text-xl font-semibold text-white mb-2">
                        {analysis.product.name}
                      </h3>
                      <p className="text-gray-300 mb-4">by {analysis.product.brand}</p>
                    </div>
                  )}

                  {analysis.analysis && (
                    <div className="grid md:grid-cols-2 gap-6">
                      <div className="bg-green-50 rounded-xl p-6 border border-green-100">
                        <h4 className="text-lg font-semibold text-green-800 mb-4 flex items-center gap-2">
                          ✅ Safety Score
                        </h4>
                        <div className="text-3xl font-bold text-green-600 mb-2">
                          {Math.round((analysis.analysis.overallSafety || 0) * 100)}%
                        </div>
                        <p className="text-sm text-green-700">Overall safety rating</p>
                      </div>

                      <div className="bg-blue-50 rounded-xl p-6 border border-blue-100">
                        <h4 className="text-lg font-semibold text-blue-800 mb-4 flex items-center gap-2">
                          🧬 Compatibility
                        </h4>
                        <div className="text-3xl font-bold text-blue-600 mb-2">
                          {Math.round((analysis.analysis.compatibilityScore || 0) * 100)}%
                        </div>
                        <p className="text-sm text-blue-700">Skin compatibility score</p>
                      </div>
                    </div>
                  )}

                  {analysis.analysis?.summary && (
                    <div className="bg-luxury-charcoal/10 rounded-xl p-6">
                      <h4 className="text-lg font-semibold text-white mb-3">
                        Analysis Summary
                      </h4>
                      <p className="text-gray-700">{analysis.analysis.summary}</p>
                    </div>
                  )}

                  {analysis.analysis?.personalizedNote && (
                    <div className="bg-pink-50 rounded-xl p-6 border border-pink-100">
                      <h4 className="text-lg font-semibold text-pink-800 mb-3">
                        Personalized Note
                      </h4>
                      <p className="text-pink-700">{analysis.analysis.personalizedNote}</p>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="text-6xl mb-4">⚠️</div>
                  <h3 className="text-lg font-semibold text-white mb-2">
                    Analysis Failed
                  </h3>
                  <p className="text-gray-300">
                    Unable to analyze this product. Please try another one.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        <div className="mt-12 text-center">
          <div className="bg-luxury-charcoal/20 rounded-2xl p-8 border border-luxury-gold/20">
            <h3 className="text-xl font-semibold text-white mb-4">
              Ready to Shop Your Perfect Match? 🛍️
            </h3>
            <p className="text-gray-300 mb-6">
              Browse our full collection of authentic Korean beauty products with wholesale pricing
            </p>
            <Link
              href="/"
              className="inline-block px-8 py-4 bg-luxury-gold text-black font-semibold rounded-xl hover:bg-luxury-gold/90 transition-all shadow-lg tracking-wide"
            >
              Shop Korean Beauty Products
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}