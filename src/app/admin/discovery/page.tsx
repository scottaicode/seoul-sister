'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface DiscoveryStats {
  total_products: number
  last_discovery: string
  trending_topics_count: number
  daily_limit: number
  batch_size: number
}

interface TrendingProduct {
  name_english: string
  brand: string
  seoul_price: number
  us_price: number
  savings_percentage: number
  category: string
  popularity_score?: number
  created_at: string
}

interface TrendingTopic {
  topic: string
  platform: string
  relevance_score: number
  expires_at: string
}

export default function DiscoveryDashboard() {
  const [discoveryStats, setDiscoveryStats] = useState<DiscoveryStats | null>(null)
  const [recentProducts, setRecentProducts] = useState<TrendingProduct[]>([])
  const [trendingTopics, setTrendingTopics] = useState<TrendingTopic[]>([])
  const [isDiscovering, setIsDiscovering] = useState(false)
  const [discoveryResult, setDiscoveryResult] = useState<any>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetchDiscoveryStatus()
    fetchTrendingData()
  }, [])

  async function fetchDiscoveryStatus() {
    try {
      const response = await fetch('/api/discover-products?action=status')
      const data = await response.json()
      setDiscoveryStats(data.system_health)
      setRecentProducts(data.recent_products || [])
    } catch (error) {
      console.error('Error fetching discovery status:', error)
    }
  }

  async function fetchTrendingData() {
    try {
      const response = await fetch('/api/discover-products?action=trending')
      const data = await response.json()
      setTrendingTopics(data.trending_topics || [])
    } catch (error) {
      console.error('Error fetching trending data:', error)
    } finally {
      setLoading(false)
    }
  }

  async function runDiscovery(count: number = 10) {
    setIsDiscovering(true)
    setDiscoveryResult(null)

    try {
      const response = await fetch('/api/discover-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mode: 'manual', count })
      })

      const result = await response.json()
      setDiscoveryResult(result)

      // Refresh data
      await fetchDiscoveryStatus()
      await fetchTrendingData()
    } catch (error) {
      console.error('Error running discovery:', error)
    } finally {
      setIsDiscovering(false)
    }
  }

  async function addKoreanProducts(count: number = 10) {
    setIsDiscovering(true)
    setDiscoveryResult(null)

    try {
      const response = await fetch('/api/add-korean-products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count })
      })

      const result = await response.json()
      setDiscoveryResult(result)

      // Refresh data
      await fetchDiscoveryStatus()
    } catch (error) {
      console.error('Error adding Korean products:', error)
    } finally {
      setIsDiscovering(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-light text-[#D4A574] tracking-wider mb-2">
          KOREAN DISCOVERY DASHBOARD
        </h1>
        <p className="text-[#D4A574]/60 text-sm">
          Monitor and manage Korean product discovery system
        </p>
      </div>

      {/* Discovery Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <div className="bg-zinc-900/50 border border-[#D4A574]/20 p-6 rounded-lg">
          <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">Total Products</p>
          <p className="text-3xl font-light text-white">{discoveryStats?.total_products || 0}</p>
          <p className="text-xs text-green-400 mt-2">
            {discoveryStats?.total_products ? 'Up from 4 original' : 'Loading...'}
          </p>
        </div>

        <div className="bg-zinc-900/50 border border-[#D4A574]/20 p-6 rounded-lg">
          <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">Last Discovery</p>
          <p className="text-lg font-light text-white">
            {discoveryStats?.last_discovery
              ? new Date(discoveryStats.last_discovery).toLocaleDateString()
              : 'Never'
            }
          </p>
          <p className="text-xs text-[#D4A574]/60 mt-2">Automated daily runs</p>
        </div>

        <div className="bg-zinc-900/50 border border-[#D4A574]/20 p-6 rounded-lg">
          <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">Trending Topics</p>
          <p className="text-3xl font-light text-white">{trendingTopics.length}</p>
          <p className="text-xs text-[#D4A574]/60 mt-2">Active trends</p>
        </div>

        <div className="bg-zinc-900/50 border border-[#D4A574]/20 p-6 rounded-lg">
          <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">Daily Limit</p>
          <p className="text-3xl font-light text-white">{discoveryStats?.daily_limit || 100}</p>
          <p className="text-xs text-[#D4A574]/60 mt-2">Max new products/day</p>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <button
          onClick={() => runDiscovery(10)}
          disabled={isDiscovering}
          className="bg-[#D4A574] text-black px-6 py-4 rounded-lg hover:bg-[#D4A574]/80 transition-all duration-300 disabled:opacity-50 font-medium tracking-wider"
        >
          {isDiscovering ? 'DISCOVERING...' : 'RUN DISCOVERY (10 PRODUCTS)'}
        </button>

        <button
          onClick={() => addKoreanProducts(15)}
          disabled={isDiscovering}
          className="border border-[#D4A574] text-[#D4A574] px-6 py-4 rounded-lg hover:bg-[#D4A574] hover:text-black transition-all duration-300 disabled:opacity-50 font-medium tracking-wider"
        >
          {isDiscovering ? 'ADDING...' : 'ADD CURATED PRODUCTS (15)'}
        </button>

        <Link
          href="/admin"
          className="border border-[#D4A574]/40 text-[#D4A574]/60 px-6 py-4 rounded-lg hover:border-[#D4A574] hover:text-[#D4A574] transition-all duration-300 font-medium tracking-wider text-center"
        >
          BACK TO ADMIN
        </Link>
      </div>

      {/* Discovery Result */}
      {discoveryResult && (
        <div className="bg-zinc-900/50 border border-[#D4A574]/20 rounded-lg p-6 mb-8">
          <h3 className="text-xl font-light text-[#D4A574] tracking-wider mb-4">
            DISCOVERY RESULT
          </h3>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
            <div className="text-center p-4 bg-black/20 rounded">
              <p className="text-2xl font-light text-green-400">{discoveryResult.discovered || discoveryResult.added_count || 0}</p>
              <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider">Products Found</p>
            </div>
            <div className="text-center p-4 bg-black/20 rounded">
              <p className="text-2xl font-light text-[#D4A574]">{discoveryResult.saved || discoveryResult.added_count || 0}</p>
              <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider">Products Added</p>
            </div>
            <div className="text-center p-4 bg-black/20 rounded">
              <p className="text-2xl font-light text-white">{discoveryResult.total_products || discoveryStats?.total_products || 0}</p>
              <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider">Total Products</p>
            </div>
          </div>

          {discoveryResult.added_products && discoveryResult.added_products.length > 0 && (
            <div>
              <h4 className="text-lg font-light text-[#D4A574] mb-3">NEW PRODUCTS ADDED:</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {discoveryResult.added_products.slice(0, 6).map((product: any, index: number) => (
                  <div key={index} className="bg-black/20 p-3 rounded">
                    <p className="text-white font-medium">{product.brand} {product.name}</p>
                    <p className="text-sm text-[#D4A574]/60">{product.category}</p>
                    <p className="text-sm text-green-400">${product.seoul_price} Seoul → ${product.us_price} US</p>
                    <p className="text-sm text-[#D4A574] font-bold">{product.savings_percentage}% savings</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          <p className="text-[#D4A574]/80 mt-4 text-sm">{discoveryResult.message}</p>
        </div>
      )}

      {/* Recent Products Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Recently Added Products */}
        <div className="bg-zinc-900/50 border border-[#D4A574]/20 rounded-lg p-6">
          <h3 className="text-xl font-light text-[#D4A574] tracking-wider mb-6">
            RECENTLY DISCOVERED
          </h3>

          {loading ? (
            <p className="text-[#D4A574]/60 text-center py-8">Loading recent products...</p>
          ) : recentProducts.length === 0 ? (
            <p className="text-[#D4A574]/60 text-center py-8">No recent discoveries</p>
          ) : (
            <div className="space-y-4">
              {recentProducts.slice(0, 8).map((product, index) => (
                <div key={index} className="border-b border-[#D4A574]/10 pb-4 last:border-b-0">
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-white font-medium">{product.name_english}</p>
                      <p className="text-sm text-[#D4A574]/60">{product.brand} • {product.category}</p>
                      <p className="text-xs text-[#D4A574]/40 mt-1">
                        Added {new Date(product.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-green-400">${product.seoul_price}</p>
                      <p className="text-xs text-red-400 line-through">${product.us_price}</p>
                      <p className="text-sm text-[#D4A574] font-bold">{product.savings_percentage}%</p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Trending Topics */}
        <div className="bg-zinc-900/50 border border-[#D4A574]/20 rounded-lg p-6">
          <h3 className="text-xl font-light text-[#D4A574] tracking-wider mb-6">
            TRENDING TOPICS
          </h3>

          {loading ? (
            <p className="text-[#D4A574]/60 text-center py-8">Loading trending topics...</p>
          ) : trendingTopics.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-[#D4A574]/60 mb-4">No trending topics found</p>
              <button
                onClick={() => runDiscovery(5)}
                className="text-[#D4A574] hover:text-white transition-colors text-sm border border-[#D4A574]/40 px-4 py-2 rounded"
              >
                Generate Topics
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {trendingTopics.slice(0, 10).map((topic, index) => (
                <div key={index} className="flex justify-between items-center p-3 bg-black/20 rounded">
                  <div>
                    <p className="text-white font-medium">#{topic.topic}</p>
                    <p className="text-xs text-[#D4A574]/60 capitalize">{topic.platform}</p>
                  </div>
                  <div className="text-right">
                    <div className="w-16 bg-[#D4A574]/20 rounded-full h-2 mb-1">
                      <div
                        className="bg-[#D4A574] h-2 rounded-full"
                        style={{width: `${topic.relevance_score * 100}%`}}
                      />
                    </div>
                    <p className="text-xs text-[#D4A574]/60">{Math.round(topic.relevance_score * 100)}%</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Korean Discovery System Status */}
      <div className="mt-8 bg-zinc-900/50 border border-[#D4A574]/20 rounded-lg p-6">
        <h3 className="text-xl font-light text-[#D4A574] tracking-wider mb-4">
          SYSTEM STATUS
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="text-center p-4 bg-black/20 rounded">
            <div className="w-3 h-3 bg-green-400 rounded-full mx-auto mb-2"></div>
            <p className="text-sm text-white">Discovery System</p>
            <p className="text-xs text-green-400">Operational</p>
          </div>

          <div className="text-center p-4 bg-black/20 rounded">
            <div className="w-3 h-3 bg-green-400 rounded-full mx-auto mb-2"></div>
            <p className="text-sm text-white">Automated Cron</p>
            <p className="text-xs text-green-400">Daily 6 AM UTC</p>
          </div>

          <div className="text-center p-4 bg-black/20 rounded">
            <div className="w-3 h-3 bg-[#D4A574] rounded-full mx-auto mb-2"></div>
            <p className="text-sm text-white">API Keys</p>
            <p className="text-xs text-[#D4A574]">Configured</p>
          </div>
        </div>

        <div className="mt-4 p-4 bg-black/10 rounded">
          <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">CAPABILITIES</p>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm text-white/80">
            <p>• Korean beauty site monitoring (Olive Young, Hwahae)</p>
            <p>• AI-powered trend analysis with Claude 4.1</p>
            <p>• Automated product classification and pricing</p>
            <p>• Real-time trending topic tracking</p>
            <p>• Smart duplicate detection and brand prioritization</p>
            <p>• Automatic US price estimation based on Seoul prices</p>
          </div>
        </div>
      </div>
    </div>
  )
}