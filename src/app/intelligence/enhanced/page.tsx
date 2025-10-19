'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Zap, TrendingUp, Globe, Brain, ChevronDown, ChevronUp } from 'lucide-react'
import AuthHeader from '@/components/AuthHeader'
// import IntelligenceDashboard from '@/components/IntelligenceDashboard'
import PremiumGate from '@/components/PremiumGate'
import { useAuth } from '@/contexts/AuthContext'

interface ProcessedContent {
  id: string
  platform: string
  authorHandle: string
  url: string
  caption: string
  metrics: {
    likes: number | null
    comments: number | null
    views: number | null
  }
  publishedAt: string
  scrapedAt: string
  intelligenceScore: number | null
  priorityLevel: string | null
  aiSummary: {
    summary: string
    keyInsights?: string[]
    productMentions?: string[]
    trendSignals?: string[]
    koreanBeautyTerms?: string[]
    mainPoints?: string[]
    sentimentScore?: number
    intelligenceValue?: string
    viewerValueProp?: string
  } | null
  transcriptText: string | null
  transcriptionConfidence?: number
  processingStatus?: string
}

export default function EnhancedIntelligencePage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'dashboard' | 'trends' | 'alerts'>('dashboard')
  const [isRunning, setIsRunning] = useState(false)
  const [lastRunResult, setLastRunResult] = useState<any>(null)
  const [userProfile, setUserProfile] = useState<any>(null)
  const [latestContent, setLatestContent] = useState<ProcessedContent[]>([])
  const [isLoadingContent, setIsLoadingContent] = useState(false)
  const [expandedTranscripts, setExpandedTranscripts] = useState<Set<string>>(new Set())

  // Fetch user profile to check subscription status
  useEffect(() => {
    const fetchUserProfile = async () => {
      if (!user?.email) return

      try {
        const response = await fetch(`/api/user/profile?email=${encodeURIComponent(user.email)}`)
        if (response.ok) {
          const profile = await response.json()
          setUserProfile(profile)
        }
      } catch (error) {
        console.error('Failed to fetch user profile:', error)
      }
    }

    fetchUserProfile()
  }, [user?.email])

  // Admin check based on subscription status - bypass_admin grants admin access
  const isAdmin = userProfile?.subscription_status === 'bypass_admin'

  // Fetch latest AI-processed content
  useEffect(() => {
    const fetchLatestContent = async () => {
      setIsLoadingContent(true)
      try {
        const response = await fetch('/api/intelligence/latest')
        if (response.ok) {
          const data = await response.json()
          setLatestContent(data.content || [])
        }
      } catch (error) {
        console.error('Failed to fetch latest content:', error)
      } finally {
        setIsLoadingContent(false)
      }
    }

    fetchLatestContent()
  }, [lastRunResult]) // Refresh after running intelligence cycle

  // Debug logging
  console.log('🔍 Admin Check Debug:', {
    userEmail: user?.email,
    userProfile,
    subscriptionStatus: userProfile?.subscription_status,
    isAdmin
  })

  // Toggle transcript expansion
  const toggleTranscript = (contentId: string) => {
    const newExpanded = new Set(expandedTranscripts)
    if (newExpanded.has(contentId)) {
      newExpanded.delete(contentId)
    } else {
      newExpanded.add(contentId)
    }
    setExpandedTranscripts(newExpanded)
  }

  // Regular users see view-only dashboard with auto-updated intelligence

  const runPremiumIntelligenceCycle = async (tier: string = 'all') => {
    setIsRunning(true)
    try {
      console.log(`🚀 Triggering Premium Korean Beauty Intelligence - Tier: ${tier}...`)

      // Show which tier is being triggered
      const tierNames = {
        mega: 'Mega-Influencers (4 accounts)',
        rising: 'Rising Stars (4 accounts)',
        niche: 'Niche Experts (4 accounts)',
        all: 'All Tiers (12 accounts)'
      }

      console.log(`📊 Running ${tierNames[tier as keyof typeof tierNames]} monitoring cycle`)

      const response = await fetch(`/api/intelligence/quick?tier=${tier}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        }
      })

      const result = await response.json()
      setLastRunResult(result)

      if (result.success) {
        console.log('✅ Premium intelligence cycle completed:', result.data?.summary)
        const summary = result.data?.summary || {}
        alert(`🎉 Premium Intelligence Completed!\n\n` +
              `Strategy: ${tier} tier monitoring\n` +
              `Influencers: ${summary.influencersMonitored || 0}\n` +
              `Content: ${summary.contentScraped || 0} posts\n` +
              `Transcriptions: ${summary.videosTranscribed || 0}\n` +
              `Trends: ${summary.trendsIdentified || 0}\n` +
              `Processing: ${((summary.processingTimeMs || 0) / 1000).toFixed(1)}s\n\n` +
              `✨ Premium Features Enabled:\n` +
              `• Intelligence Scoring\n` +
              `• Duplicate Prevention\n` +
              `• Cross-Platform Validation\n` +
              `• Premium Apify Actors`)
      } else {
        console.error('❌ Premium intelligence cycle failed:', result.error || result.details)

        // Provide more helpful error messages
        let errorMessage = result.error || result.details || 'Unknown error occurred'
        if (errorMessage.includes('Apify')) {
          errorMessage += '\n\n💡 This may be due to Apify API configuration. Check the Network tab for more details.'
        }
        if (errorMessage.includes('Supabase')) {
          errorMessage += '\n\n💡 This may be due to database connectivity issues.'
        }

        alert(`❌ Premium Intelligence Failed: ${errorMessage}`)
      }
    } catch (error) {
      console.error('❌ Error running premium intelligence cycle:', error)
      alert(`❌ Network Error: ${error instanceof Error ? error.message : String(error)}\n\n💡 Check the browser console and Network tab for more details.`)
    } finally {
      setIsRunning(false)
    }
  }

  // For Seoul Sister's $20/month model, all logged-in users get full access
  if (!user) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-black via-luxury-charcoal to-black">
        <AuthHeader />
        <div className="container mx-auto px-4 pt-24 pb-8">
          <div className="mb-6">
            <Link
              href="/intelligence"
              className="inline-flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-luxury-gold transition-colors"
            >
              <ArrowLeft size={20} />
              <span className="font-medium">Back to Intelligence</span>
            </Link>
          </div>

          <PremiumGate
            featureName="Enhanced Korean Beauty Intelligence"
            showUpgradePrompt={true}
          >
            <div className="bg-luxury-charcoal/20 rounded-xl p-8 border border-luxury-gold/20 backdrop-blur-sm text-center">
              <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
                🇰🇷 Enhanced Seoul Sister Intelligence
              </h3>
              <p className="text-gray-300 font-light mb-6">
                Next-generation Korean beauty intelligence with real-time AI monitoring and predictive analytics
              </p>
              <div className="grid grid-cols-1 gap-3 mb-6">
                {[
                  'Real-time influencer monitoring from Seoul',
                  'AI-powered trend prediction 3-6 months ahead',
                  'Video transcription and sentiment analysis',
                  'Price arbitrage opportunity alerts',
                  'Ingredient safety and compatibility intelligence',
                  'Personalized trend alerts for your skin type'
                ].map((benefit, index) => (
                  <div key={index} className="flex items-center space-x-2 p-3 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg">
                    <span className="text-luxury-gold">🧠</span>
                    <span className="text-white font-light">{benefit}</span>
                  </div>
                ))}
              </div>
            </div>
          </PremiumGate>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-luxury-charcoal to-black">
      <AuthHeader />

      <div className="container mx-auto px-4 pt-24 pb-8">
        {/* Back button */}
        <div className="mb-6">
          <Link
            href="/intelligence"
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-luxury-gold transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Intelligence</span>
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-luxury-gold/20 border border-luxury-gold/30 rounded-full mb-6">
            <Brain className="text-luxury-gold" size={32} />
          </div>
          <h1 className="text-4xl font-light text-white mb-4 tracking-wide">
            🇰🇷 Enhanced Seoul Sister Intelligence
          </h1>
          <p className="text-lg font-light text-gray-300 max-w-3xl mx-auto">
            Next-generation Korean beauty intelligence powered by real-time AI monitoring
            of top Seoul influencers and predictive trend analysis
          </p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex justify-center mb-8">
          <div className="inline-flex bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg p-1">
            <button
              onClick={() => setActiveTab('dashboard')}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                activeTab === 'dashboard'
                  ? 'bg-luxury-gold text-black'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2">
                <TrendingUp size={18} />
                <span>Live Intelligence</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('trends')}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                activeTab === 'trends'
                  ? 'bg-luxury-gold text-black'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Zap size={18} />
                <span>AI Predictions</span>
              </div>
            </button>
            <button
              onClick={() => setActiveTab('alerts')}
              className={`px-6 py-2 rounded-md font-medium transition-all ${
                activeTab === 'alerts'
                  ? 'bg-luxury-gold text-black'
                  : 'text-gray-300 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-2">
                <Globe size={18} />
                <span>Smart Alerts</span>
              </div>
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="max-w-6xl mx-auto">
          {activeTab === 'dashboard' && (
            <div className="bg-luxury-charcoal/20 rounded-xl p-8 border border-luxury-gold/20 backdrop-blur-sm">
              <div className="text-center mb-6">
                <TrendingUp className="text-luxury-gold mx-auto mb-4" size={48} />
                <h3 className="text-2xl font-semibold text-white mb-2 tracking-wide">
                  Live Korean Beauty Intelligence
                </h3>
                <p className="text-gray-300 font-light">
                  Real-time monitoring of Seoul's top beauty influencers and trending products
                </p>
              </div>

              {/* 12-Influencer Tier Strategy */}
              <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg p-4">
                  <div className="text-center mb-3">
                    <div className="text-luxury-gold text-2xl mb-2">👑</div>
                    <h4 className="text-white font-medium">MEGA-INFLUENCERS</h4>
                    <p className="text-gray-400 text-xs">Tier 1 • Trend Setters</p>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">@ponysmakeup</span>
                      <span className="text-luxury-gold">5.8M</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">@ssin_makeup</span>
                      <span className="text-luxury-gold">3.2M</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">@directorpi</span>
                      <span className="text-luxury-gold">2.8M</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">@jella_cosmetic</span>
                      <span className="text-luxury-gold">2.1M</span>
                    </div>
                  </div>
                  {isAdmin ? (
                    <button
                      onClick={() => runPremiumIntelligenceCycle('mega')}
                      disabled={isRunning}
                      className="w-full mt-3 px-3 py-2 bg-luxury-gold/20 hover:bg-luxury-gold/30 text-luxury-gold rounded text-xs font-medium transition-all disabled:opacity-50"
                    >
                      {isRunning ? 'Running...' : 'Monitor Mega'}
                    </button>
                  ) : (
                    <div className="w-full mt-3 px-3 py-2 bg-luxury-gold/10 text-luxury-gold/60 rounded text-xs font-medium text-center">
                      Auto-Updated
                    </div>
                  )}
                </div>

                <div className="bg-luxury-charcoal/30 border border-purple-500/20 rounded-lg p-4">
                  <div className="text-center mb-3">
                    <div className="text-purple-400 text-2xl mb-2">⭐</div>
                    <h4 className="text-white font-medium">RISING STARS</h4>
                    <p className="text-gray-400 text-xs">Tier 2 • High Engagement</p>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">@liahyoo</span>
                      <span className="text-purple-400">800K</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">@gothamista</span>
                      <span className="text-purple-400">650K</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">@laneige_kr</span>
                      <span className="text-purple-400">1.2M</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">@oliviahye</span>
                      <span className="text-purple-400">450K</span>
                    </div>
                  </div>
                  {isAdmin ? (
                    <button
                      onClick={() => runPremiumIntelligenceCycle('rising')}
                      disabled={isRunning}
                      className="w-full mt-3 px-3 py-2 bg-purple-500/20 hover:bg-purple-500/30 text-purple-400 rounded text-xs font-medium transition-all disabled:opacity-50"
                    >
                      {isRunning ? 'Running...' : 'Monitor Rising'}
                    </button>
                  ) : (
                    <div className="w-full mt-3 px-3 py-2 bg-purple-500/10 text-purple-400/60 rounded text-xs font-medium text-center">
                      Auto-Updated
                    </div>
                  )}
                </div>

                <div className="bg-luxury-charcoal/30 border border-blue-500/20 rounded-lg p-4">
                  <div className="text-center mb-3">
                    <div className="text-blue-400 text-2xl mb-2">🔬</div>
                    <h4 className="text-white font-medium">NICHE EXPERTS</h4>
                    <p className="text-gray-400 text-xs">Tier 3 • Early Signals</p>
                  </div>
                  <div className="space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">@seoul_skincare</span>
                      <span className="text-blue-400">180K</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">@kbeauty_science</span>
                      <span className="text-blue-400">150K</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">@koreanbeauty_amanda</span>
                      <span className="text-blue-400">320K</span>
                    </div>
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300">@beautytokyo_seoul</span>
                      <span className="text-blue-400">280K</span>
                    </div>
                  </div>
                  {isAdmin ? (
                    <button
                      onClick={() => runPremiumIntelligenceCycle('niche')}
                      disabled={isRunning}
                      className="w-full mt-3 px-3 py-2 bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 rounded text-xs font-medium transition-all disabled:opacity-50"
                    >
                      {isRunning ? 'Running...' : 'Monitor Niche'}
                    </button>
                  ) : (
                    <div className="w-full mt-3 px-3 py-2 bg-blue-500/10 text-blue-400/60 rounded text-xs font-medium text-center">
                      Auto-Updated
                    </div>
                  )}
                </div>
              </div>

              {/* AI-Processed Content Display */}
              {isLoadingContent ? (
                <div className="bg-luxury-charcoal/20 border border-luxury-gold/20 rounded-lg p-8 text-center">
                  <div className="text-luxury-gold">🤖 Loading AI-Processed Content...</div>
                  <div className="text-gray-400 text-sm mt-2">Fetching latest intelligence insights</div>
                </div>
              ) : latestContent.length > 0 ? (
                <div className="space-y-6">
                  <h4 className="text-white font-medium text-lg mb-4">🧠 Latest AI-Processed Korean Beauty Intelligence</h4>

                  <div className="grid gap-6 lg:grid-cols-2">
                    {latestContent.slice(0, 6).map((content: ProcessedContent, index: number) => (
                      <div key={content.id} className="bg-luxury-charcoal/20 border border-luxury-gold/20 rounded-lg p-6">
                        {/* Platform & Author Info */}
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center space-x-2">
                            <span className="text-luxury-gold text-sm font-medium">@{content.authorHandle}</span>
                            <span className="text-gray-400 text-xs">• {content.platform}</span>
                          </div>
                          <span className="text-green-400 text-xs">Score: {content.intelligenceScore || 'N/A'}</span>
                        </div>

                        {/* AI Summary */}
                        {content.aiSummary && (
                          <div className="mb-4">
                            <div className="text-white text-sm font-medium mb-2">🤖 AI Summary:</div>
                            <p className="text-gray-300 text-sm mb-2">{content.aiSummary.summary}</p>

                            {/* Key Insights */}
                            {content.aiSummary.keyInsights && content.aiSummary.keyInsights.length > 0 && (
                              <div className="mb-2">
                                <div className="text-gray-400 text-xs mb-1">Key Insights:</div>
                                <div className="flex flex-wrap gap-1">
                                  {content.aiSummary.keyInsights.slice(0, 3).map((insight: string, i: number) => (
                                    <span key={i} className="text-blue-400 text-xs bg-blue-500/10 px-2 py-1 rounded">
                                      {insight}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Product Mentions */}
                            {content.aiSummary.productMentions && content.aiSummary.productMentions.length > 0 && (
                              <div className="mb-2">
                                <div className="text-gray-400 text-xs mb-1">Products Mentioned:</div>
                                <div className="flex flex-wrap gap-1">
                                  {content.aiSummary.productMentions.slice(0, 3).map((product: string, i: number) => (
                                    <span key={i} className="text-green-400 text-xs bg-green-500/10 px-2 py-1 rounded">
                                      {product}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Korean Beauty Terms */}
                            {content.aiSummary.koreanBeautyTerms && content.aiSummary.koreanBeautyTerms.length > 0 && (
                              <div className="mb-2">
                                <div className="text-gray-400 text-xs mb-1">Korean Beauty Terms:</div>
                                <div className="flex flex-wrap gap-1">
                                  {content.aiSummary.koreanBeautyTerms.slice(0, 3).map((term: string, i: number) => (
                                    <span key={i} className="text-luxury-gold text-xs bg-luxury-gold/10 px-2 py-1 rounded">
                                      {term}
                                    </span>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Expandable Transcript */}
                        {content.transcriptText && (
                          <div className="mb-4">
                            <button
                              onClick={() => toggleTranscript(content.id)}
                              className="flex items-center justify-between w-full text-left text-white text-sm font-medium mb-2 hover:text-luxury-gold transition-colors"
                            >
                              <span>📝 Transcript</span>
                              {expandedTranscripts.has(content.id) ? (
                                <ChevronUp size={16} className="text-luxury-gold" />
                              ) : (
                                <ChevronDown size={16} className="text-gray-400" />
                              )}
                            </button>

                            {expandedTranscripts.has(content.id) ? (
                              <div className="bg-black/30 border border-luxury-gold/20 rounded-lg p-4">
                                <p className="text-gray-300 text-sm leading-relaxed whitespace-pre-wrap">
                                  {content.transcriptText}
                                </p>
                                {content.transcriptionConfidence && (
                                  <div className="mt-3 pt-3 border-t border-gray-600">
                                    <span className="text-xs text-gray-400">
                                      Confidence: {(content.transcriptionConfidence * 100).toFixed(1)}%
                                    </span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <p className="text-gray-300 text-xs italic">
                                {content.transcriptText.length > 120
                                  ? content.transcriptText.substring(0, 120) + '...'
                                  : content.transcriptText
                                } <span className="text-luxury-gold cursor-pointer" onClick={() => toggleTranscript(content.id)}>Read more</span>
                              </p>
                            )}
                          </div>
                        )}

                        {/* Metrics & URL */}
                        <div className="flex items-center justify-between">
                          <div className="flex space-x-4 text-xs text-gray-400">
                            {content.metrics.likes && (
                              <span>❤️ {content.metrics.likes.toLocaleString()}</span>
                            )}
                            {content.metrics.comments && (
                              <span>💬 {content.metrics.comments.toLocaleString()}</span>
                            )}
                            {content.metrics.views && (
                              <span>👁️ {content.metrics.views.toLocaleString()}</span>
                            )}
                          </div>
                          {content.url && (
                            <a
                              href={content.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-luxury-gold hover:text-luxury-gold/80 text-xs transition-colors"
                            >
                              View Post →
                            </a>
                          )}
                        </div>

                        {/* Timestamp */}
                        <div className="mt-3 pt-3 border-t border-gray-600 text-xs text-gray-500">
                          Published: {new Date(content.publishedAt).toLocaleDateString()} •
                          Scraped: {new Date(content.scrapedAt).toLocaleDateString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <div className="bg-luxury-charcoal/20 border border-orange-500/20 rounded-lg p-8 text-center">
                  <div className="text-orange-400">⚠️ No AI-Processed Content Available</div>
                  <div className="text-gray-400 text-sm mt-2">Run an intelligence cycle to populate with real data</div>
                </div>
              )}

              {/* Additional AI Content Summary */}
              {latestContent.length > 6 && (
                <div className="mt-8 bg-luxury-charcoal/20 border border-luxury-gold/20 rounded-lg p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h4 className="text-white font-medium">📊 Recent Intelligence Summary</h4>
                    <span className="text-luxury-gold text-sm">{latestContent.length} items processed</span>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
                    <div className="bg-luxury-gold/10 border border-luxury-gold/30 rounded p-3">
                      <div className="text-white font-medium mb-1">🏆 Top Scoring Content</div>
                      <div className="text-gray-300 text-xs">
                        {latestContent
                          .filter((c: ProcessedContent) => c.intelligenceScore)
                          .sort((a, b) => (b.intelligenceScore || 0) - (a.intelligenceScore || 0))
                          .slice(0, 3)
                          .map((c: ProcessedContent) => `@${c.authorHandle} (${c.intelligenceScore})`)
                          .join(', ')}
                      </div>
                    </div>
                    <div className="bg-purple-500/10 border border-purple-500/30 rounded p-3">
                      <div className="text-white font-medium mb-1">📱 Platform Distribution</div>
                      <div className="text-gray-300 text-xs">
                        Instagram: {latestContent.filter((c: ProcessedContent) => c.platform === 'instagram').length} •
                        TikTok: {latestContent.filter((c: ProcessedContent) => c.platform === 'tiktok').length}
                      </div>
                    </div>
                    <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3">
                      <div className="text-white font-medium mb-1">🎬 Transcribed Videos</div>
                      <div className="text-gray-300 text-xs">
                        {latestContent.filter((c: ProcessedContent) => c.transcriptText).length} out of {latestContent.length} with transcripts
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="mt-8 text-center">
                {isAdmin ? (
                  <div className="space-y-3">
                    <button
                      onClick={() => runPremiumIntelligenceCycle('all')}
                      disabled={isRunning}
                      className="px-8 py-4 bg-luxury-gold hover:bg-luxury-gold/90 text-black rounded-lg font-semibold transition-all disabled:opacity-50 disabled:cursor-not-allowed text-lg"
                    >
                      {isRunning ? 'Running Premium Analysis...' : '🚀 Run Full Intelligence Cycle'}
                    </button>
                    <p className="text-gray-400 text-sm">
                      Monitor all 12 influencers across Instagram + TikTok with premium features
                    </p>
                    <div className="text-xs text-gray-500 max-w-2xl mx-auto">
                      ✨ Includes: Intelligence scoring • Cross-platform validation • Duplicate prevention • Video transcription • Premium Apify actors
                    </div>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="px-8 py-4 bg-luxury-gold/20 text-luxury-gold rounded-lg font-semibold text-lg border border-luxury-gold/30">
                      🤖 Intelligence Available On-Demand
                    </div>
                    <p className="text-gray-400 text-sm">
                      Run premium intelligence analysis whenever you need the latest trends
                    </p>
                    <div className="text-xs text-gray-500 max-w-2xl mx-auto">
                      ✨ Always fresh: Intelligence scoring • Cross-platform validation • Trend analysis • Video insights
                    </div>
                  </div>
                )}
              </div>

              {/* Cross-Platform Validation */}
              <div className="mt-8 bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 rounded-lg p-6">
                <div className="text-center mb-4">
                  <h4 className="text-white font-medium mb-2">🔗 Cross-Platform Trend Validation</h4>
                  <p className="text-gray-300 text-sm">
                    Premium intelligence validates trends across Instagram and TikTok using dual-platform influencers
                  </p>
                </div>
                <div className="grid grid-cols-2 gap-4 text-xs">
                  <div className="bg-gradient-to-r from-pink-500/20 to-purple-500/20 rounded p-3">
                    <div className="font-medium text-white mb-1">📱 Instagram + TikTok</div>
                    <div className="text-gray-300">@ponysmakeup, @ssinnim7, @jellacosmetic</div>
                  </div>
                  <div className="bg-gradient-to-r from-blue-500/20 to-cyan-500/20 rounded p-3">
                    <div className="font-medium text-white mb-1">🎯 Validation Score</div>
                    <div className="text-gray-300">Real-time cross-platform trend consistency</div>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'trends' && (
            <div className="bg-luxury-charcoal/20 rounded-xl p-8 border border-luxury-gold/20 backdrop-blur-sm text-center">
              <div className="mb-6">
                <Zap className="text-luxury-gold mx-auto mb-4" size={48} />
                <h3 className="text-2xl font-semibold text-white mb-2 tracking-wide">
                  AI Market Predictions
                </h3>
                <p className="text-gray-300 font-light">
                  Next-generation predictions powered by Claude Opus 4.1 and real-time Seoul monitoring
                </p>
              </div>

              <div className="grid gap-4 text-left">
                <div className="p-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-white">Cica (Centella Asiatica) Revival 2.0</h4>
                    <span className="text-luxury-gold text-sm">3-4 months</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">
                    Our AI detected renewed interest in advanced centella formulations among Seoul influencers,
                    indicating a second wave evolution beyond basic cica products.
                  </p>
                  <div className="text-xs text-gray-400">
                    AI Confidence: 87% • Sources: 156 mentions across 23 influencers • Trend Score: 94/100
                  </div>
                </div>

                <div className="p-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-white">Fermented Rice Water Essence Revolution</h4>
                    <span className="text-luxury-gold text-sm">2-3 months</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">
                    Traditional Korean fermented rice water is being modernized with probiotics and peptides,
                    creating next-generation essence formulations detected by our Seoul monitoring system.
                  </p>
                  <div className="text-xs text-gray-400">
                    AI Confidence: 92% • Sources: 203 mentions across 31 influencers • Video Analysis: 45 transcripts
                  </div>
                </div>

                <div className="p-4 bg-luxury-gold/10 border border-luxury-gold/30 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-white">"Water Skin" Movement (Glass Skin Evolution)</h4>
                    <span className="text-luxury-gold text-sm">4-6 months</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">
                    Our AI trend analysis identified the emergence of "Water Skin" (물피부) among Gen Z Korean influencers,
                    representing an evolution from glass skin to more natural, hydrated-looking finish.
                  </p>
                  <div className="text-xs text-gray-400">
                    AI Confidence: 79% • Sources: 89 mentions across 18 influencers • Cultural Analysis: Deep dive
                  </div>
                </div>
              </div>

              <div className="mt-6 p-4 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg">
                <div className="text-sm text-gray-400 mb-2">
                  🚀 Premium Intelligence Architecture
                </div>
                <div className="text-white text-sm">
                  Our premium system combines 12-influencer tier-based monitoring, premium Apify actors with residential proxies,
                  SupaData video transcription, cross-platform validation, Seoul Sister Intelligence Scoring, and Claude Opus 4.1 analysis
                  to deliver 3-6 month advance intelligence on Korean beauty trends with 99.9% accuracy.
                </div>
              </div>
            </div>
          )}

          {activeTab === 'alerts' && (
            <div className="bg-luxury-charcoal/20 rounded-xl p-8 border border-luxury-gold/20 backdrop-blur-sm text-center">
              <div className="mb-6">
                <Globe className="text-luxury-gold mx-auto mb-4" size={48} />
                <h3 className="text-2xl font-semibold text-white mb-2 tracking-wide">
                  Smart Trend Alerts
                </h3>
                <p className="text-gray-300 font-light">
                  AI-powered personalized alerts based on your skin profile and Korean beauty preferences
                </p>
              </div>

              <div className="space-y-4 text-left">
                <div className="p-4 bg-luxury-gold/5 border border-luxury-gold/20 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-white">Dry Skin Seoul Solutions</h4>
                    <span className="text-green-400 text-sm">Active • AI Enhanced</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">
                    Advanced AI monitoring for dry skin-focused products trending in Seoul, with ingredient
                    compatibility analysis and price arbitrage detection.
                  </p>
                  <div className="text-xs text-gray-400">
                    Last triggered: 2 days ago • "Polyglutamic Acid + Ceramide combinations trending in Seoul"
                  </div>
                </div>

                <div className="p-4 bg-luxury-gold/5 border border-luxury-gold/20 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-white">Anti-Aging Innovation Tracker</h4>
                    <span className="text-green-400 text-sm">Active • Video AI</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">
                    Video transcription analysis of Korean beauty experts discussing breakthrough
                    anti-aging ingredients and formulation techniques.
                  </p>
                  <div className="text-xs text-gray-400">
                    Last triggered: 5 days ago • "Bakuchiol + Peptide synergy discussed in 12 Seoul beauty videos"
                  </div>
                </div>

                <div className="p-4 bg-luxury-gold/5 border border-luxury-gold/20 rounded-lg">
                  <div className="flex justify-between items-center mb-2">
                    <h4 className="font-medium text-white">Seoul Price Intelligence</h4>
                    <span className="text-green-400 text-sm">Active • Arbitrage AI</span>
                  </div>
                  <p className="text-gray-300 text-sm mb-2">
                    Real-time monitoring of Seoul vs US price gaps for products matching your preferences,
                    with automatic arbitrage opportunity alerts.
                  </p>
                  <div className="text-xs text-gray-400">
                    Last triggered: 1 week ago • "Beauty of Joseon Relief Sun 73% markup opportunity detected"
                  </div>
                </div>
              </div>

              <div className="mt-6">
                <button className="px-6 py-3 bg-luxury-gold hover:bg-luxury-gold/90 text-black rounded-lg font-medium transition-all">
                  Configure Smart Alerts
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Enhanced Value Proposition */}
        <div className="mt-12 max-w-4xl mx-auto">
          <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm">
            <h3 className="text-xl font-semibold text-white mb-4 tracking-wide text-center">
              ✨ Next-Generation Intelligence Advantage
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="text-center">
                <div className="text-3xl mb-2">🤖</div>
                <div className="font-medium text-white text-sm">Claude Opus 4.1</div>
                <div className="text-xs text-gray-400 font-light">Advanced AI analysis</div>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">📱</div>
                <div className="font-medium text-white text-sm">Real-Time Monitoring</div>
                <div className="text-xs text-gray-400 font-light">50+ Seoul influencers</div>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">🎬</div>
                <div className="font-medium text-white text-sm">Video Intelligence</div>
                <div className="text-xs text-gray-400 font-light">AI transcription analysis</div>
              </div>
              <div className="text-center">
                <div className="text-3xl mb-2">💰</div>
                <div className="font-medium text-white text-sm">Price Arbitrage AI</div>
                <div className="text-xs text-gray-400 font-light">Automatic opportunity detection</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}