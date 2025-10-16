'use client'

import { useState } from 'react'
import { Star, TrendingUp, AlertTriangle, CheckCircle, Info, Eye } from 'lucide-react'
import Link from 'next/link'

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

interface SkinAnalysisResultsProps {
  analysis: SkinAnalysis
  productRecommendations?: any[]
  onShareResults?: () => void
  onRequestProducts?: () => void
}

export default function SkinAnalysisResults({
  analysis,
  productRecommendations = [],
  onShareResults,
  onRequestProducts
}: SkinAnalysisResultsProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'details' | 'products' | 'ingredients'>('overview')

  const getSkinTypeColor = (skinType: string) => {
    const colors = {
      'oily': 'text-blue-400',
      'dry': 'text-yellow-400',
      'combination': 'text-purple-400',
      'sensitive': 'text-red-400',
      'normal': 'text-green-400'
    }
    return colors[skinType as keyof typeof colors] || 'text-gray-400'
  }

  const getConfidenceColor = (score: number) => {
    if (score >= 90) return 'text-green-400'
    if (score >= 80) return 'text-yellow-400'
    return 'text-red-400'
  }

  const formatConcernName = (concern: string) => {
    return concern.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const formatIngredientName = (ingredient: string) => {
    return ingredient.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }

  const tabs = [
    { id: 'overview', label: '📊 Overview', description: 'Key findings' },
    { id: 'details', label: '🔬 Analysis', description: 'Detailed results' },
    { id: 'products', label: '🛍️ Products', description: 'Recommendations' },
    { id: 'ingredients', label: '🧪 Ingredients', description: 'Compatibility guide' }
  ]

  const renderOverviewTab = () => (
    <div className="space-y-6">
      {/* Skin Type & Confidence */}
      <div className="bg-luxury-charcoal/30 rounded-xl p-6 border border-luxury-gold/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-xl font-semibold text-white tracking-wide">
            Your Skin Profile
          </h3>
          <div className="flex items-center space-x-2">
            <span className="text-sm text-gray-300">Confidence:</span>
            <span className={`font-bold ${getConfidenceColor(analysis.confidenceScore)}`}>
              {analysis.confidenceScore}%
            </span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-sm text-gray-400 mb-1">Skin Type</div>
            <div className={`text-lg font-semibold capitalize ${getSkinTypeColor(analysis.skinType)}`}>
              {analysis.skinType}
            </div>
          </div>
          <div>
            <div className="text-sm text-gray-400 mb-1">Primary Concerns</div>
            <div className="text-sm text-white">
              {analysis.primaryConcerns.slice(0, 2).map(concern => formatConcernName(concern)).join(', ')}
            </div>
          </div>
        </div>
      </div>

      {/* Key Recommendations */}
      <div className="bg-luxury-charcoal/30 rounded-xl p-6 border border-luxury-gold/20">
        <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
          ✨ Key Recommendations
        </h3>
        <div className="space-y-3">
          {analysis.recommendations.slice(0, 3).map((rec, index) => (
            <div key={index} className="flex items-start space-x-3">
              <div className="flex-shrink-0 w-6 h-6 bg-luxury-gold/20 border border-luxury-gold/30 rounded-full flex items-center justify-center mt-0.5">
                <span className="text-xs font-bold text-luxury-gold">{index + 1}</span>
              </div>
              <p className="text-gray-300 font-light">{rec}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="grid grid-cols-2 gap-4">
        <button
          onClick={onRequestProducts}
          className="p-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-xl hover:bg-luxury-gold/20 transition-colors"
        >
          <div className="text-luxury-gold text-2xl mb-2">🛒</div>
          <div className="text-white font-medium mb-1">Shop Products</div>
          <div className="text-gray-400 text-sm font-light">Get personalized K-beauty recommendations</div>
        </button>

        <button
          onClick={onShareResults}
          className="p-4 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-xl hover:bg-luxury-charcoal/50 transition-colors"
        >
          <div className="text-luxury-gold text-2xl mb-2">📱</div>
          <div className="text-white font-medium mb-1">Share Results</div>
          <div className="text-gray-400 text-sm font-light">Send via WhatsApp or save</div>
        </button>
      </div>
    </div>
  )

  const renderDetailsTab = () => (
    <div className="space-y-6">
      {/* Detailed Analysis */}
      <div className="bg-luxury-charcoal/30 rounded-xl p-6 border border-luxury-gold/20">
        <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
          🔬 Detailed Analysis
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(analysis.analysisDetails).map(([key, value]) => (
            <div key={key} className="bg-luxury-charcoal/20 rounded-lg p-3">
              <div className="text-sm text-gray-400 mb-1 capitalize">
                {key.replace(/([A-Z])/g, ' $1').trim()}
              </div>
              <div className="font-medium text-white capitalize">{value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Primary Concerns */}
      <div className="bg-luxury-charcoal/30 rounded-xl p-6 border border-luxury-gold/20">
        <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
          ⚠️ Primary Concerns
        </h3>
        <div className="grid grid-cols-1 gap-3">
          {analysis.primaryConcerns.map((concern, index) => (
            <div key={index} className="flex items-center space-x-3 p-3 bg-red-500/10 border border-red-400/30 rounded-lg">
              <AlertTriangle size={20} className="text-red-400" />
              <span className="text-white font-medium">{formatConcernName(concern)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Secondary Concerns */}
      {analysis.secondaryConcerns && analysis.secondaryConcerns.length > 0 && (
        <div className="bg-luxury-charcoal/30 rounded-xl p-6 border border-luxury-gold/20">
          <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
            📝 Secondary Concerns
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {analysis.secondaryConcerns.map((concern, index) => (
              <div key={index} className="flex items-center space-x-3 p-2 bg-yellow-500/10 border border-yellow-400/30 rounded-lg">
                <Info size={16} className="text-yellow-400" />
                <span className="text-gray-300">{formatConcernName(concern)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )

  const renderProductsTab = () => (
    <div className="space-y-6">
      {/* Product Categories */}
      <div className="bg-luxury-charcoal/30 rounded-xl p-6 border border-luxury-gold/20">
        <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
          🧴 Recommended Product Types
        </h3>
        <div className="grid grid-cols-2 gap-4">
          {Object.entries(analysis.productRecommendations).map(([category, products]) => (
            <div key={category} className="bg-luxury-charcoal/20 rounded-lg p-4">
              <div className="font-medium text-luxury-gold mb-2 capitalize">{category}</div>
              <div className="space-y-1">
                {products.map((product: string, index: number) => (
                  <div key={index} className="text-sm text-gray-300 font-light">
                    • {formatConcernName(product)}
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Personalized Product Recommendations */}
      {productRecommendations.length > 0 && (
        <div className="bg-luxury-charcoal/30 rounded-xl p-6 border border-luxury-gold/20">
          <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
            🎯 Personalized K-Beauty Matches
          </h3>
          <div className="grid grid-cols-1 gap-4">
            {productRecommendations.slice(0, 4).map((product, index) => (
              <div key={index} className="flex items-center space-x-4 p-4 bg-luxury-charcoal/20 rounded-lg">
                <div className="w-12 h-12 bg-luxury-gold/20 border border-luxury-gold/30 rounded-lg flex items-center justify-center">
                  <span className="text-luxury-gold font-bold">{index + 1}</span>
                </div>
                <div className="flex-1">
                  <div className="font-medium text-white">{product.name}</div>
                  <div className="text-sm text-gray-400">{product.brand}</div>
                  <div className="flex items-center space-x-2 mt-1">
                    <span className="text-luxury-gold font-bold">${product.price}</span>
                    {product.compatibilityScore && (
                      <span className="text-xs text-green-400">
                        {Math.round(product.compatibilityScore * 100)}% match
                      </span>
                    )}
                  </div>
                </div>
                <div className="text-right">
                  <button className="px-3 py-1 bg-luxury-gold hover:bg-luxury-gold/90 text-black text-sm rounded font-medium transition-colors">
                    Add to Cart
                  </button>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 text-center">
            <Link
              href="/products"
              className="inline-flex items-center gap-2 px-6 py-3 bg-luxury-charcoal/50 hover:bg-luxury-charcoal/70 text-gray-300 border border-luxury-gold/30 rounded-lg font-medium transition-all"
            >
              <Eye size={20} />
              View All Products
            </Link>
          </div>
        </div>
      )}
    </div>
  )

  const renderIngredientsTab = () => (
    <div className="space-y-6">
      {/* Compatible Ingredients */}
      <div className="bg-luxury-charcoal/30 rounded-xl p-6 border border-luxury-gold/20">
        <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
          ✅ Your Skin Loves These Ingredients
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {analysis.compatibleIngredients.map((ingredient, index) => (
            <div key={index} className="flex items-center space-x-2 p-3 bg-green-500/10 border border-green-400/30 rounded-lg">
              <CheckCircle size={16} className="text-green-400" />
              <span className="text-white font-light">{formatIngredientName(ingredient)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Ingredients to Avoid */}
      <div className="bg-luxury-charcoal/30 rounded-xl p-6 border border-luxury-gold/20">
        <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
          ❌ Ingredients to Avoid
        </h3>
        <div className="grid grid-cols-2 gap-3">
          {analysis.ingredientsToAvoid.map((ingredient, index) => (
            <div key={index} className="flex items-center space-x-2 p-3 bg-red-500/10 border border-red-400/30 rounded-lg">
              <AlertTriangle size={16} className="text-red-400" />
              <span className="text-white font-light">{formatIngredientName(ingredient)}</span>
            </div>
          ))}
        </div>

        <div className="mt-4 p-3 bg-blue-500/10 border border-blue-400/30 rounded-lg">
          <div className="flex items-start space-x-2">
            <Info size={16} className="text-blue-400 mt-0.5" />
            <div className="text-sm text-blue-200 font-light">
              These ingredients may cause irritation or aren't optimal for your skin type. Always patch test new products before full application.
            </div>
          </div>
        </div>
      </div>
    </div>
  )

  return (
    <div className="bg-luxury-charcoal/20 rounded-xl border border-luxury-gold/20 backdrop-blur-sm">
      {/* Header */}
      <div className="p-6 border-b border-luxury-gold/20">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-semibold text-white tracking-wide">
              🔬 Your Skin Analysis Results
            </h2>
            <p className="text-gray-300 font-light mt-1">
              Personalized insights powered by AI
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Star className="text-luxury-gold" size={20} />
            <span className={`font-bold text-lg ${getConfidenceColor(analysis.confidenceScore)}`}>
              {analysis.confidenceScore}%
            </span>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="px-6 pt-4">
        <div className="flex space-x-2 overflow-x-auto">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex-shrink-0 px-4 py-2 rounded-lg transition-all ${
                activeTab === tab.id
                  ? 'bg-luxury-gold text-black font-medium'
                  : 'bg-luxury-charcoal/30 text-gray-300 hover:bg-luxury-charcoal/50'
              }`}
            >
              <div className="font-medium text-sm">{tab.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="p-6">
        {activeTab === 'overview' && renderOverviewTab()}
        {activeTab === 'details' && renderDetailsTab()}
        {activeTab === 'products' && renderProductsTab()}
        {activeTab === 'ingredients' && renderIngredientsTab()}
      </div>
    </div>
  )
}