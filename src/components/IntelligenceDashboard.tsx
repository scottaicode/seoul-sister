'use client'

import { useState, useEffect } from 'react'
import { TrendingUp, Zap, Users, Calendar, AlertTriangle, Star, Globe } from 'lucide-react'

interface TrendData {
  products: Array<{
    id: string
    product_name: string
    brand_name: string
    category: string
    mention_count: number
    sentiment_score: number
    virality_score: number
    analyzed_at: string
  }>
  ingredients: Array<{
    id: string
    ingredient_name: string
    korean_name?: string
    category: string
    virality_score: number
    skin_type_compatibility: string[]
    safety_concerns: string[]
  }>
  emergingTrends: Array<{
    name: string
    category: string
    description: string
    confidenceScore: number
    momentum: string
    koreanOrigin: boolean
    estimatedUSArrival: string
    relatedKeywords: string[]
  }>
  marketPredictions: {
    nextBigTrend?: string
    trendsToWatch: string[]
    usMarketTimeline: Array<{
      trend: string
      estimatedArrival: string
      preparationAdvice: string
    }>
  }
  summary: {
    totalTrendingProducts: number
    totalTrendingIngredients: number
    totalEmergingTrends: number
  }
}

interface DashboardOverview {
  totalInfluencers: number
  totalContent: number
  activeTrends: number
  lastUpdate: string
}

export default function IntelligenceDashboard() {
  const [trendData, setTrendData] = useState<TrendData | null>(null)
  const [overview, setOverview] = useState<DashboardOverview | null>(null)
  const [timeframe, setTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('weekly')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchIntelligenceData()
  }, [timeframe])

  const fetchIntelligenceData = async () => {
    try {
      setLoading(true)

      // Fetch trends data
      const trendsResponse = await fetch(`/api/intelligence/trends?timeframe=${timeframe}&limit=20`)
      const trendsData = await trendsResponse.json()

      // Fetch dashboard overview
      const overviewResponse = await fetch(`/api/intelligence/monitor?timeframe=${timeframe}`)
      const overviewData = await overviewResponse.json()

      if (trendsData.success) {
        setTrendData(trendsData.data)
      }

      if (overviewData.success) {
        setOverview(overviewData.data.overview)
      }

      setError(null)
    } catch (err) {
      console.error('Failed to fetch intelligence data:', err)
      setError('Failed to load intelligence data')
    } finally {
      setLoading(false)
    }
  }

  const runIntelligenceCycle = async () => {
    try {
      setLoading(true)
      const response = await fetch('/api/intelligence/monitor', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          maxContentPerInfluencer: 15,
          includeTranscription: true,
          generateTrendReport: true
        })
      })

      const result = await response.json()

      if (result.success) {
        await fetchIntelligenceData() // Refresh data
        alert(`Intelligence cycle completed! Analyzed ${result.data.summary.contentScraped} pieces of content.`)
      } else {
        throw new Error(result.error)
      }
    } catch (error) {
      console.error('Intelligence cycle failed:', error)
      alert('Intelligence cycle failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (loading && !trendData) {
    return (
      <div className="bg-luxury-charcoal/20 rounded-xl p-8 border border-luxury-gold/20 backdrop-blur-sm">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luxury-gold"></div>
          <span className="ml-3 text-white">Loading Korean Beauty Intelligence...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="bg-red-500/10 border border-red-400/30 rounded-xl p-6">
        <div className="flex items-center space-x-2 text-red-300">
          <AlertTriangle size={20} />
          <span>{error}</span>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h2 className="text-2xl font-light text-white tracking-wide">
            🇰🇷 Seoul Sister Intelligence
          </h2>
          <p className="text-gray-400 font-light">
            Real-time Korean beauty trend analysis powered by AI
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-3">
          {/* Timeframe Selector */}
          <select
            value={timeframe}
            onChange={(e) => setTimeframe(e.target.value as any)}
            className="px-4 py-2 bg-luxury-charcoal/50 border border-luxury-gold/30 rounded-lg text-white"
            disabled={loading}
          >
            <option value="daily">Last 24 Hours</option>
            <option value="weekly">Last Week</option>
            <option value="monthly">Last Month</option>
          </select>

          {/* Manual Refresh Button */}
          <button
            onClick={runIntelligenceCycle}
            disabled={loading}
            className="px-4 py-2 bg-luxury-gold/20 hover:bg-luxury-gold/30 border border-luxury-gold/30 rounded-lg text-luxury-gold font-medium transition-all disabled:opacity-50"
          >
            {loading ? 'Analyzing...' : 'Run Fresh Analysis'}
          </button>
        </div>
      </div>

      {/* Overview Stats */}
      {overview && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-luxury-charcoal/20 rounded-xl p-4 border border-luxury-gold/20">
            <div className="flex items-center space-x-2 mb-2">
              <Users className="text-luxury-gold" size={20} />
              <span className="text-sm text-gray-400">Influencers</span>
            </div>
            <div className="text-2xl font-semibold text-white">{overview.totalInfluencers}</div>
          </div>

          <div className="bg-luxury-charcoal/20 rounded-xl p-4 border border-luxury-gold/20">
            <div className="flex items-center space-x-2 mb-2">
              <Globe className="text-luxury-gold" size={20} />
              <span className="text-sm text-gray-400">Content Analyzed</span>
            </div>
            <div className="text-2xl font-semibold text-white">{overview.totalContent}</div>
          </div>

          <div className="bg-luxury-charcoal/20 rounded-xl p-4 border border-luxury-gold/20">
            <div className="flex items-center space-x-2 mb-2">
              <TrendingUp className="text-luxury-gold" size={20} />
              <span className="text-sm text-gray-400">Active Trends</span>
            </div>
            <div className="text-2xl font-semibold text-white">{overview.activeTrends}</div>
          </div>

          <div className="bg-luxury-charcoal/20 rounded-xl p-4 border border-luxury-gold/20">
            <div className="flex items-center space-x-2 mb-2">
              <Calendar className="text-luxury-gold" size={20} />
              <span className="text-sm text-gray-400">Last Update</span>
            </div>
            <div className="text-sm font-medium text-white">
              {new Date(overview.lastUpdate).toLocaleDateString()}
            </div>
          </div>
        </div>
      )}

      {trendData && (
        <>
          {/* Emerging Trends */}
          {trendData.emergingTrends.length > 0 && (
            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20">
              <div className="flex items-center space-x-2 mb-4">
                <Zap className="text-luxury-gold" size={24} />
                <h3 className="text-xl font-semibold text-white">Emerging Trends</h3>
                <span className="text-sm text-gray-400">({trendData.emergingTrends.length})</span>
              </div>

              <div className="grid gap-4">
                {trendData.emergingTrends.slice(0, 6).map((trend, index) => (
                  <div key={index} className="p-4 bg-luxury-gold/5 border border-luxury-gold/20 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium text-white">{trend.name}</h4>
                        {trend.koreanOrigin && (
                          <span className="text-xs bg-luxury-gold/20 text-luxury-gold px-2 py-1 rounded">
                            🇰🇷 Korean Origin
                          </span>
                        )}
                      </div>
                      <div className="flex items-center space-x-2">
                        <span className={`text-xs px-2 py-1 rounded ${
                          trend.momentum === 'rising' ? 'bg-green-500/20 text-green-300' :
                          trend.momentum === 'stable' ? 'bg-blue-500/20 text-blue-300' :
                          'bg-red-500/20 text-red-300'
                        }`}>
                          {trend.momentum}
                        </span>
                        <span className="text-xs text-gray-400">{trend.confidenceScore}% confidence</span>
                      </div>
                    </div>
                    <p className="text-gray-300 text-sm mb-2">{trend.description}</p>
                    <div className="flex justify-between items-center">
                      <div className="flex flex-wrap gap-1">
                        {trend.relatedKeywords.slice(0, 4).map((keyword, i) => (
                          <span key={i} className="text-xs bg-luxury-charcoal/50 text-gray-400 px-2 py-1 rounded">
                            {keyword}
                          </span>
                        ))}
                      </div>
                      <span className="text-xs text-luxury-gold">
                        US Arrival: {trend.estimatedUSArrival}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trending Products */}
          {trendData.products.length > 0 && (
            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20">
              <div className="flex items-center space-x-2 mb-4">
                <Star className="text-luxury-gold" size={24} />
                <h3 className="text-xl font-semibold text-white">Trending Products</h3>
                <span className="text-sm text-gray-400">({trendData.products.length})</span>
              </div>

              <div className="grid gap-3">
                {trendData.products.slice(0, 8).map((product) => (
                  <div key={product.id} className="flex justify-between items-center p-3 bg-luxury-gold/5 border border-luxury-gold/20 rounded-lg">
                    <div>
                      <div className="font-medium text-white">{product.product_name}</div>
                      <div className="text-sm text-gray-400">{product.brand_name} • {product.category}</div>
                      <div className="text-xs text-gray-500">{product.mention_count} mentions</div>
                    </div>
                    <div className="text-right">
                      <div className="text-luxury-gold font-semibold">{product.virality_score}/100</div>
                      <div className={`text-xs ${
                        product.sentiment_score > 0.1 ? 'text-green-300' :
                        product.sentiment_score < -0.1 ? 'text-red-300' : 'text-gray-400'
                      }`}>
                        {product.sentiment_score > 0.1 ? '😊 Positive' :
                         product.sentiment_score < -0.1 ? '😞 Negative' : '😐 Neutral'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Trending Ingredients */}
          {trendData.ingredients.length > 0 && (
            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20">
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-2xl">🧪</span>
                <h3 className="text-xl font-semibold text-white">Trending Ingredients</h3>
                <span className="text-sm text-gray-400">({trendData.ingredients.length})</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {trendData.ingredients.slice(0, 6).map((ingredient) => (
                  <div key={ingredient.id} className="p-3 bg-luxury-gold/5 border border-luxury-gold/20 rounded-lg">
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-medium text-white">{ingredient.ingredient_name}</div>
                        {ingredient.korean_name && (
                          <div className="text-xs text-gray-400">{ingredient.korean_name}</div>
                        )}
                        <div className="text-xs text-gray-500 capitalize">{ingredient.category}</div>
                      </div>
                      <div className="text-luxury-gold font-semibold text-sm">
                        {ingredient.virality_score}/100
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1 mb-2">
                      {ingredient.skin_type_compatibility.slice(0, 3).map((type, i) => (
                        <span key={i} className="text-xs bg-green-500/20 text-green-300 px-2 py-1 rounded">
                          {type}
                        </span>
                      ))}
                    </div>
                    {ingredient.safety_concerns.length > 0 && (
                      <div className="text-xs text-orange-300">
                        ⚠️ {ingredient.safety_concerns.length} safety note(s)
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Market Predictions */}
          {trendData.marketPredictions && (
            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20">
              <div className="flex items-center space-x-2 mb-4">
                <span className="text-2xl">🔮</span>
                <h3 className="text-xl font-semibold text-white">Market Predictions</h3>
              </div>

              <div className="space-y-4">
                {trendData.marketPredictions.nextBigTrend && (
                  <div className="p-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg">
                    <div className="text-sm text-luxury-gold font-medium mb-1">Next Big Trend</div>
                    <div className="text-white">{trendData.marketPredictions.nextBigTrend}</div>
                  </div>
                )}

                {trendData.marketPredictions.trendsToWatch.length > 0 && (
                  <div>
                    <div className="text-sm text-gray-400 mb-2">Trends to Watch</div>
                    <div className="flex flex-wrap gap-2">
                      {trendData.marketPredictions.trendsToWatch.slice(0, 8).map((trend, index) => (
                        <span key={index} className="text-xs bg-luxury-charcoal/50 text-gray-300 px-3 py-1 rounded-full">
                          {trend}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {trendData.marketPredictions.usMarketTimeline.length > 0 && (
                  <div>
                    <div className="text-sm text-gray-400 mb-2">US Market Timeline</div>
                    <div className="space-y-2">
                      {trendData.marketPredictions.usMarketTimeline.slice(0, 3).map((item, index) => (
                        <div key={index} className="flex justify-between items-center p-2 bg-luxury-charcoal/30 rounded">
                          <span className="text-white text-sm">{item.trend}</span>
                          <span className="text-luxury-gold text-xs">{item.estimatedArrival}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </>
      )}

      {/* Footer Note */}
      <div className="text-center text-xs text-gray-500 p-4">
        Intelligence powered by Claude Opus 4.1 • Data from {overview?.totalInfluencers || 0} Korean beauty influencers
        <br />
        Last updated: {overview ? new Date(overview.lastUpdate).toLocaleString() : 'Loading...'}
      </div>
    </div>
  )
}