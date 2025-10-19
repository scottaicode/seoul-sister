'use client'

import { useState, useEffect } from 'react'
import { Zap, TrendingUp, Users, Hash, Clock, RefreshCw } from 'lucide-react'

interface TrendAnalysisData {
  hashtagTrends: {
    hashtag: string
    frequency: number
    totalEngagement: number
    averageEngagement: number
    trendDirection: 'rising' | 'stable' | 'declining'
    influencersUsing: string[]
  }[]
  influencerPerformance: {
    handle: string
    totalPosts: number
    averageEngagement: number
    topPerformingPost: {
      id: string
      engagement: number
      caption: string
    }
    trendingHashtags: string[]
  }[]
  engagementPatterns: {
    averageLikes: number
    averageComments: number
    highPerformingThreshold: number
    topPerformingPosts: {
      id: string
      handle: string
      engagement: number
      publishedAt: string
    }[]
  }
  timeBasedInsights: {
    postsLast24h: number
    postsLast7d: number
    engagementGrowth: number
    mostActiveInfluencer: string
  }
  koreanBeautyTerms: {
    term: string
    frequency: number
    associatedHashtags: string[]
    engagementImpact: number
  }[]
}

interface ProcessedContent {
  id: string
  platform: string
  authorHandle: string
  url: string
  caption: string
  hashtags?: string[]
  metrics: {
    likes: number | null
    comments: number | null
    views: number | null
    shares: number | null
  }
  publishedAt: string
  scrapedAt: string
  intelligenceScore: number | null
  priorityLevel: string | null
}

interface TrendAnalysisTabProps {
  latestContent: ProcessedContent[]
}

export default function TrendAnalysisTab({ latestContent }: TrendAnalysisTabProps) {
  const [trendData, setTrendData] = useState<TrendAnalysisData | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const fetchTrendAnalysis = async () => {
    setIsLoading(true)
    setError(null)
    try {
      const response = await fetch('/api/intelligence/analyze-trends', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      if (!response.ok) {
        throw new Error(`Analysis failed: ${response.status}`)
      }

      const result = await response.json()
      if (result.success) {
        setTrendData(result.analysis)
      } else {
        throw new Error(result.error || 'Analysis failed')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch trend analysis')
    } finally {
      setIsLoading(false)
    }
  }

  useEffect(() => {
    if (latestContent.length > 0) {
      fetchTrendAnalysis()
    }
  }, [latestContent.length])

  return (
    <div className="bg-luxury-charcoal/20 rounded-xl p-8 border border-luxury-gold/20 backdrop-blur-sm">
      <div className="text-center mb-6">
        <Zap className="text-luxury-gold mx-auto mb-4" size={48} />
        <h3 className="text-2xl font-semibold text-white mb-2 tracking-wide">
          Real-Time Trend Analysis
        </h3>
        <p className="text-gray-300 font-light">
          AI-powered analysis of collected Instagram data from Korean beauty influencers
        </p>
      </div>

      {/* Refresh Button */}
      <div className="flex justify-center mb-6">
        <button
          onClick={fetchTrendAnalysis}
          disabled={isLoading}
          className="inline-flex items-center gap-2 px-4 py-2 bg-luxury-gold/20 hover:bg-luxury-gold/30 text-luxury-gold rounded-lg font-medium transition-all disabled:opacity-50"
        >
          <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
          {isLoading ? 'Analyzing...' : 'Refresh Analysis'}
        </button>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
          <div className="text-red-400 text-sm">❌ {error}</div>
        </div>
      )}

      {isLoading ? (
        <div className="text-center py-12">
          <div className="text-luxury-gold text-lg mb-2">🧠 Analyzing Trend Data...</div>
          <div className="text-gray-400 text-sm">Processing {latestContent.length} posts for insights</div>
        </div>
      ) : trendData ? (
        <div className="space-y-6">
          {/* Hashtag Trends */}
          <div className="bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Hash className="text-luxury-gold" size={24} />
              <h4 className="text-white font-semibold">Hashtag Trends</h4>
            </div>

            {trendData.hashtagTrends.length > 0 ? (
              <div className="grid gap-3">
                {trendData.hashtagTrends.slice(0, 10).map((trend, index) => (
                  <div key={trend.hashtag} className="flex items-center justify-between p-3 bg-luxury-charcoal/30 rounded">
                    <div className="flex items-center gap-3">
                      <span className="text-luxury-gold font-mono text-sm">#{trend.hashtag}</span>
                      <span className={`px-2 py-1 rounded text-xs ${
                        trend.trendDirection === 'rising' ? 'bg-green-500/20 text-green-400' :
                        trend.trendDirection === 'declining' ? 'bg-red-500/20 text-red-400' :
                        'bg-blue-500/20 text-blue-400'
                      }`}>
                        {trend.trendDirection}
                      </span>
                    </div>
                    <div className="text-right">
                      <div className="text-white text-sm">{trend.frequency} posts</div>
                      <div className="text-gray-400 text-xs">{trend.averageEngagement} avg engagement</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-400 text-sm">No hashtag data available</div>
            )}
          </div>

          {/* Influencer Performance */}
          <div className="bg-purple-500/10 border border-purple-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Users className="text-purple-400" size={24} />
              <h4 className="text-white font-semibold">Top Performing Influencers</h4>
            </div>

            {trendData.influencerPerformance.length > 0 ? (
              <div className="grid gap-3">
                {trendData.influencerPerformance.slice(0, 8).map((influencer, index) => (
                  <div key={influencer.handle} className="flex items-center justify-between p-3 bg-luxury-charcoal/30 rounded">
                    <div>
                      <div className="text-white font-medium">@{influencer.handle}</div>
                      <div className="text-gray-400 text-xs">
                        {influencer.totalPosts} posts • Top hashtags: {influencer.trendingHashtags.slice(0, 3).join(', ')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-purple-400 text-sm">{influencer.averageEngagement.toLocaleString()}</div>
                      <div className="text-gray-400 text-xs">avg engagement</div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-gray-400 text-sm">No influencer performance data available</div>
            )}
          </div>

          {/* Engagement Patterns */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <TrendingUp className="text-blue-400" size={24} />
              <h4 className="text-white font-semibold">Engagement Patterns</h4>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
              <div className="bg-luxury-charcoal/30 rounded p-3 text-center">
                <div className="text-blue-400 text-lg font-bold">{trendData.engagementPatterns.averageLikes.toLocaleString()}</div>
                <div className="text-gray-400 text-sm">Avg Likes</div>
              </div>
              <div className="bg-luxury-charcoal/30 rounded p-3 text-center">
                <div className="text-blue-400 text-lg font-bold">{trendData.engagementPatterns.averageComments.toLocaleString()}</div>
                <div className="text-gray-400 text-sm">Avg Comments</div>
              </div>
              <div className="bg-luxury-charcoal/30 rounded p-3 text-center">
                <div className="text-blue-400 text-lg font-bold">{trendData.engagementPatterns.highPerformingThreshold.toLocaleString()}</div>
                <div className="text-gray-400 text-sm">High Performance Threshold</div>
              </div>
            </div>

            {trendData.engagementPatterns.topPerformingPosts.length > 0 && (
              <div>
                <h5 className="text-white font-medium mb-3">Top Performing Posts</h5>
                <div className="space-y-2">
                  {trendData.engagementPatterns.topPerformingPosts.slice(0, 5).map((post, index) => (
                    <div key={post.id} className="flex items-center justify-between p-2 bg-luxury-charcoal/30 rounded">
                      <div className="text-white text-sm">@{post.handle}</div>
                      <div className="text-blue-400 text-sm">{post.engagement.toLocaleString()} engagement</div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Time-Based Insights */}
          <div className="bg-green-500/10 border border-green-500/30 rounded-lg p-6">
            <div className="flex items-center gap-3 mb-4">
              <Clock className="text-green-400" size={24} />
              <h4 className="text-white font-semibold">Time-Based Insights</h4>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="bg-luxury-charcoal/30 rounded p-3 text-center">
                <div className="text-green-400 text-lg font-bold">{trendData.timeBasedInsights.postsLast24h}</div>
                <div className="text-gray-400 text-sm">Posts (24h)</div>
              </div>
              <div className="bg-luxury-charcoal/30 rounded p-3 text-center">
                <div className="text-green-400 text-lg font-bold">{trendData.timeBasedInsights.postsLast7d}</div>
                <div className="text-gray-400 text-sm">Posts (7d)</div>
              </div>
              <div className="bg-luxury-charcoal/30 rounded p-3 text-center">
                <div className="text-green-400 text-lg font-bold">{trendData.timeBasedInsights.engagementGrowth}%</div>
                <div className="text-gray-400 text-sm">Growth Rate</div>
              </div>
              <div className="bg-luxury-charcoal/30 rounded p-3 text-center">
                <div className="text-green-400 text-sm font-bold">@{trendData.timeBasedInsights.mostActiveInfluencer}</div>
                <div className="text-gray-400 text-sm">Most Active</div>
              </div>
            </div>
          </div>

          {/* Korean Beauty Terms */}
          {trendData.koreanBeautyTerms.length > 0 && (
            <div className="bg-luxury-gold/5 border border-luxury-gold/20 rounded-lg p-6">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-luxury-gold text-xl">🇰🇷</span>
                <h4 className="text-white font-semibold">Korean Beauty Terms Analysis</h4>
              </div>

              <div className="grid gap-3">
                {trendData.koreanBeautyTerms.slice(0, 8).map((term, index) => (
                  <div key={term.term} className="flex items-center justify-between p-3 bg-luxury-charcoal/30 rounded">
                    <div>
                      <div className="text-luxury-gold font-medium">{term.term}</div>
                      <div className="text-gray-400 text-xs">
                        Associated: {term.associatedHashtags.slice(0, 3).join(', ')}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-white text-sm">{term.frequency} mentions</div>
                      <div className="text-gray-400 text-xs">{term.engagementImpact} avg impact</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : latestContent.length > 0 ? (
        <div className="grid gap-4 text-left">
          <div className="p-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-white">Basic Hashtag Analysis</h4>
              <span className="text-luxury-gold text-sm">From Collected Data</span>
            </div>
            <p className="text-gray-300 text-sm mb-2">
              Analysis of hashtags from {latestContent.length} collected posts across {new Set(latestContent.map(c => c.authorHandle)).size} influencers
            </p>
            <div className="flex flex-wrap gap-2">
              {Array.from(new Set(latestContent.flatMap(c => c.hashtags || []))).slice(0, 8).map((hashtag, i) => (
                <span key={i} className="text-xs bg-luxury-gold/20 text-luxury-gold px-2 py-1 rounded">
                  #{hashtag}
                </span>
              ))}
            </div>
          </div>

          <div className="p-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg">
            <div className="flex justify-between items-center mb-2">
              <h4 className="font-medium text-white">Basic Engagement Patterns</h4>
              <span className="text-luxury-gold text-sm">Real Data</span>
            </div>
            <p className="text-gray-300 text-sm mb-2">
              Average engagement across tracked influencers with video content analysis
            </p>
            <div className="text-xs text-gray-400">
              Posts analyzed: {latestContent.length} •
              Video content: {latestContent.filter(c => (c as any).transcriptText).length} •
              Platforms: {new Set(latestContent.map(c => c.platform)).size}
            </div>
          </div>

          <div className="mt-4 text-center">
            <button
              onClick={fetchTrendAnalysis}
              className="px-6 py-3 bg-luxury-gold hover:bg-luxury-gold/90 text-black rounded-lg font-semibold transition-all"
            >
              🧠 Run Advanced Trend Analysis
            </button>
            <p className="text-gray-400 text-sm mt-2">
              Get detailed insights with hashtag trends, influencer performance, and Korean beauty term analysis
            </p>
          </div>
        </div>
      ) : (
        <div className="p-8 bg-orange-500/10 border border-orange-500/20 rounded-lg text-center">
          <div className="text-orange-400 mb-2">⚠️ No Data Available</div>
          <p className="text-gray-300 text-sm">
            Data analysis will be available after the next daily collection cycle (9 AM Pacific)
          </p>
        </div>
      )}

      {/* Analysis Status */}
      <div className="mt-6 p-4 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg">
        <div className="text-sm text-gray-400 mb-2">
          📊 Analysis Status
        </div>
        <div className="text-white text-sm">
          {trendData ? (
            `Analysis completed on ${latestContent.length} posts from ${new Set(latestContent.map(c => c.authorHandle)).size} influencers`
          ) : (
            'Daily automated collection from 12 Korean beauty influencers at 9 AM Pacific. Analysis will run on collected data.'
          )}
        </div>
      </div>
    </div>
  )
}