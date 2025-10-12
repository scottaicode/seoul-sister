'use client'

import { useState, useEffect } from 'react'
import { useUserProfile } from '@/hooks/useUserProfile'
import { MLInsightsEngine, type MLInsight, type RoutineTimingPrediction } from '@/lib/ml-insights-engine'
import type { Product } from '@/hooks/useProducts'

interface AIInsightsDashboardProps {
  userEmail?: string
  products: Product[]
}

export default function AIInsightsDashboard({ userEmail, products }: AIInsightsDashboardProps) {
  const { profile } = useUserProfile(userEmail)
  const [insights, setInsights] = useState<MLInsight[]>([])
  const [routinePrediction, setRoutinePrediction] = useState<RoutineTimingPrediction | null>(null)
  const [loading, setLoading] = useState(false)
  const [activeInsightIndex, setActiveInsightIndex] = useState(0)

  useEffect(() => {
    if (profile) {
      generateInsights()
    }
  }, [profile])

  const generateInsights = async () => {
    if (!profile) return

    setLoading(true)
    try {
      // Fetch user's analysis history
      const analysisResponse = await fetch(`/api/photo-analysis-history?user_id=${profile.id}&limit=5`)
      const analysisData = await analysisResponse.json()

      // Fetch community data (simplified for demo)
      const communityData = await fetchCommunityData()

      // Generate ML insights
      const mlInsights = await MLInsightsEngine.generatePersonalizedInsights(
        profile,
        analysisData.analyses || [],
        communityData
      )

      // Generate routine timing predictions
      const timingPrediction = MLInsightsEngine.predictOptimalRoutineTiming(profile)

      setInsights(mlInsights)
      setRoutinePrediction(timingPrediction)
    } catch (error) {
      console.error('Error generating insights:', error)
    } finally {
      setLoading(false)
    }
  }

  const fetchCommunityData = async () => {
    // Simplified community data fetch - in production, this would be more comprehensive
    try {
      const response = await fetch('/api/community/insights')
      const data = await response.json()
      return data.community_patterns || []
    } catch (error) {
      console.error('Error fetching community data:', error)
      return []
    }
  }

  const getInsightIcon = (type: string) => {
    const icons = {
      progress_tracking: '📈',
      community_recommendation: '👥',
      seasonal_recommendation: '🌸',
      ingredient_optimization: '🧪'
    }
    return icons[type as keyof typeof icons] || '💡'
  }

  const getConfidenceColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-100'
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-100'
    return 'text-red-600 bg-red-100'
  }

  const formatConfidence = (score: number) => {
    return `${Math.round(score * 100)}% confidence`
  }

  if (!profile) {
    return (
      <div className="max-w-6xl mx-auto p-6">
        <div className="bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl p-8 border border-purple-200 text-center">
          <h2 className="text-2xl font-bold text-gray-800 mb-4">🤖 AI Insights Dashboard</h2>
          <p className="text-gray-600 mb-6">
            Create your profile to unlock personalized AI insights and predictions
          </p>
          <button className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-8 py-3 rounded-full font-medium hover:shadow-lg transition-all">
            Create Profile →
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
          🤖 AI Insights Dashboard
        </h1>
        <p className="text-gray-600">
          Personalized predictions and recommendations powered by machine learning
        </p>
      </div>

      {/* Loading State */}
      {loading && (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500 mx-auto mb-4"></div>
          <p className="text-gray-600">Analyzing your data and generating insights...</p>
        </div>
      )}

      {/* Insights Grid */}
      {!loading && insights.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-8">
          {/* Main Insight Display */}
          <div className="lg:col-span-2 bg-white rounded-xl border border-gray-200 p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-gray-800">Featured Insight</h3>
              <div className="flex gap-2">
                {insights.map((_, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveInsightIndex(index)}
                    className={`w-3 h-3 rounded-full transition-colors ${
                      index === activeInsightIndex ? 'bg-purple-500' : 'bg-gray-300'
                    }`}
                  />
                ))}
              </div>
            </div>

            {insights[activeInsightIndex] && (
              <div className="space-y-6">
                {/* Insight Header */}
                <div className="flex items-start gap-4">
                  <div className="text-4xl">
                    {getInsightIcon(insights[activeInsightIndex].type)}
                  </div>
                  <div className="flex-1">
                    <h4 className="text-lg font-semibold text-gray-800 mb-2">
                      {insights[activeInsightIndex].title}
                    </h4>
                    <p className="text-gray-600 leading-relaxed">
                      {insights[activeInsightIndex].description}
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-medium ${getConfidenceColor(insights[activeInsightIndex].confidence_score)}`}>
                    {formatConfidence(insights[activeInsightIndex].confidence_score)}
                  </div>
                </div>

                {/* Improvement Metric */}
                {insights[activeInsightIndex].improvement_percentage > 0 && (
                  <div className="bg-green-50 p-4 rounded-lg border border-green-200">
                    <div className="flex items-center gap-2">
                      <span className="text-green-600 text-xl">📊</span>
                      <span className="font-medium text-green-800">
                        Expected Improvement: +{insights[activeInsightIndex].improvement_percentage}%
                      </span>
                    </div>
                  </div>
                )}

                {/* Actionable Recommendations */}
                <div>
                  <h5 className="font-medium text-gray-800 mb-3">💡 Recommended Actions:</h5>
                  <div className="space-y-3">
                    {insights[activeInsightIndex].actionable_recommendations.map((rec, index) => (
                      <div key={index} className="flex items-start gap-3 p-3 bg-gray-50 rounded-lg">
                        <span className="text-purple-500 font-bold">{index + 1}.</span>
                        <span className="text-gray-700">{rec}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Ingredient Focus */}
                {insights[activeInsightIndex].ingredient_focus && (
                  <div>
                    <h5 className="font-medium text-gray-800 mb-3">🧪 Key Ingredients to Look For:</h5>
                    <div className="flex flex-wrap gap-2">
                      {insights[activeInsightIndex].ingredient_focus!.map(ingredient => (
                        <span key={ingredient} className="bg-blue-100 text-blue-800 px-3 py-1 rounded-full text-sm">
                          {ingredient}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Insights Summary */}
          <div className="space-y-6">
            {/* All Insights List */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">All Insights</h3>
              <div className="space-y-3">
                {insights.map((insight, index) => (
                  <button
                    key={index}
                    onClick={() => setActiveInsightIndex(index)}
                    className={`w-full text-left p-3 rounded-lg border transition-colors ${
                      index === activeInsightIndex
                        ? 'border-purple-300 bg-purple-50'
                        : 'border-gray-100 hover:bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xl">{getInsightIcon(insight.type)}</span>
                      <div className="flex-1">
                        <div className="font-medium text-gray-800 text-sm">{insight.title}</div>
                        <div className="text-xs text-gray-500 capitalize">{insight.type.replace('_', ' ')}</div>
                      </div>
                      {insight.improvement_percentage > 0 && (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded">
                          +{insight.improvement_percentage}%
                        </span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>

            {/* Quick Stats */}
            <div className="bg-white rounded-xl border border-gray-200 p-6">
              <h3 className="text-lg font-semibold text-gray-800 mb-4">Quick Stats</h3>
              <div className="space-y-4">
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Active Insights</span>
                  <span className="font-bold text-purple-600">{insights.length}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Avg. Confidence</span>
                  <span className="font-bold text-purple-600">
                    {Math.round(insights.reduce((sum, i) => sum + i.confidence_score, 0) / insights.length * 100)}%
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-gray-600">Data Sources</span>
                  <span className="font-bold text-purple-600">
                    {new Set(insights.map(i => i.data_source)).size}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Routine Timing Predictions */}
      {routinePrediction && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 mb-8">
          <h3 className="text-xl font-semibold text-gray-800 mb-6">⏰ Optimal Routine Timing</h3>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Morning Routine */}
            <div className="bg-yellow-50 p-4 rounded-lg border border-yellow-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🌅</span>
                <h4 className="font-semibold text-gray-800">Morning Routine</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Optimal Start Time:</span>
                  <span className="font-medium">{routinePrediction.predictions.morning.optimal_start_time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Estimated Duration:</span>
                  <span className="font-medium">{routinePrediction.predictions.morning.estimated_duration} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Success Probability:</span>
                  <span className="font-medium text-green-600">
                    {Math.round(routinePrediction.predictions.morning.success_probability * 100)}%
                  </span>
                </div>
              </div>
            </div>

            {/* Evening Routine */}
            <div className="bg-purple-50 p-4 rounded-lg border border-purple-200">
              <div className="flex items-center gap-2 mb-3">
                <span className="text-2xl">🌙</span>
                <h4 className="font-semibold text-gray-800">Evening Routine</h4>
              </div>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-600">Optimal Start Time:</span>
                  <span className="font-medium">{routinePrediction.predictions.evening.optimal_start_time}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Estimated Duration:</span>
                  <span className="font-medium">{routinePrediction.predictions.evening.estimated_duration} min</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Success Probability:</span>
                  <span className="font-medium text-green-600">
                    {Math.round(routinePrediction.predictions.evening.success_probability * 100)}%
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Adherence Prediction */}
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
            <div className="flex items-center justify-between mb-3">
              <h5 className="font-medium text-gray-800">📊 Predicted Adherence Rate</h5>
              <span className="text-xl font-bold text-blue-600">
                {Math.round(routinePrediction.adherence_likelihood * 100)}%
              </span>
            </div>
            <div className="w-full bg-blue-200 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full"
                style={{ width: `${routinePrediction.adherence_likelihood * 100}%` }}
              ></div>
            </div>
          </div>

          {/* Optimization Suggestions */}
          <div className="mt-6">
            <h5 className="font-medium text-gray-800 mb-3">🚀 Optimization Suggestions:</h5>
            <div className="space-y-2">
              {routinePrediction.optimization_suggestions.map((suggestion, index) => (
                <div key={index} className="flex items-start gap-2">
                  <span className="text-blue-500 mt-1">•</span>
                  <span className="text-gray-700 text-sm">{suggestion}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Refresh Button */}
      <div className="text-center">
        <button
          onClick={generateInsights}
          disabled={loading}
          className="bg-gradient-to-r from-purple-500 to-pink-600 text-white px-8 py-3 rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
        >
          {loading ? 'Generating...' : '🔄 Refresh Insights'}
        </button>
      </div>

      {/* No Insights State */}
      {!loading && insights.length === 0 && (
        <div className="text-center py-12 text-gray-500">
          <div className="text-4xl mb-4">🤖</div>
          <p className="mb-4">No insights available yet.</p>
          <p className="text-sm">Take some photos or use the platform more to generate personalized insights!</p>
        </div>
      )}
    </div>
  )
}