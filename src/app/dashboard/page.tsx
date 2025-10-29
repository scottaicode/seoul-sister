'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useAuth } from '@/contexts/AuthContext'
import AuthHeader from '@/components/AuthHeader'
import {
  Brain,
  TrendingUp,
  ShoppingBag,
  Camera,
  BarChart3,
  Calendar,
  AlertTriangle,
  Search,
  DollarSign,
  Star
} from 'lucide-react'

export default function UnifiedDashboard() {
  const { user, loading } = useAuth()
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'overview' | 'advisor' | 'intelligence' | 'shopping'>('overview')

  useEffect(() => {
    if (!loading && !user) {
      router.push('/signup')
    }
  }, [user, loading, router])

  // Handle URL parameters for tab switching
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search)
    const tab = urlParams.get('tab')
    if (tab && ['advisor', 'intelligence', 'shopping'].includes(tab)) {
      setActiveTab(tab as 'advisor' | 'intelligence' | 'shopping')
    } else if (!tab) {
      // No tab parameter means show overview (My Dashboard)
      setActiveTab('overview')
    }
  }, [])

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-luxury-gold"></div>
      </div>
    )
  }

  if (!user) return null

  return (
    <main className="min-h-screen bg-black text-white">
      <AuthHeader />

      {/* Dashboard Header */}
      <section className="border-b border-luxury-gold/20 py-8 pt-24">
        <div className="max-w-7xl mx-auto px-8">
          <div className="text-center mb-8">
            <h1 className="text-4xl font-light mb-2">Welcome back, {user.email?.split('@')[0]}</h1>
            <p className="text-gray-400">Your AI-powered beauty intelligence hub</p>
          </div>

          {/* Tab Navigation - Only show when not on overview */}
          {activeTab !== 'overview' && (
            <div className="flex justify-center gap-8">
              <button
                onClick={() => setActiveTab('advisor')}
                className={`px-6 py-3 font-light transition-all ${
                  activeTab === 'advisor'
                    ? 'text-luxury-gold border-b-2 border-luxury-gold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <Brain className="inline-block w-5 h-5 mr-2" />
                AI Beauty Advisor
              </button>
              <button
                onClick={() => setActiveTab('intelligence')}
                className={`px-6 py-3 font-light transition-all ${
                  activeTab === 'intelligence'
                    ? 'text-luxury-gold border-b-2 border-luxury-gold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <TrendingUp className="inline-block w-5 h-5 mr-2" />
                Seoul Intelligence
              </button>
              <button
                onClick={() => setActiveTab('shopping')}
                className={`px-6 py-3 font-light transition-all ${
                  activeTab === 'shopping'
                    ? 'text-luxury-gold border-b-2 border-luxury-gold'
                    : 'text-gray-400 hover:text-white'
                }`}
              >
                <ShoppingBag className="inline-block w-5 h-5 mr-2" />
                Smart Shopping
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Tab Content */}
      <section className="py-12">
        <div className="max-w-7xl mx-auto px-8">
          {/* Dashboard Overview */}
          {activeTab === 'overview' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard
                icon={<Camera />}
                title="Product Scanner"
                description="AI-powered ingredient analysis and compatibility checking"
                href="/bailey-features?feature=product-scanner"
                color="from-blue-500 to-purple-500"
              />
              <FeatureCard
                icon={<BarChart3 />}
                title="Routine Analyzer"
                description="Optimize your skincare routine with AI recommendations"
                href="/bailey-features?feature=routine-analyzer"
                color="from-green-500 to-blue-500"
              />
              <FeatureCard
                icon={<Calendar />}
                title="Progress Tracking"
                description="Monitor your skin improvements over time"
                href="/bailey-features?feature=progress-tracking"
                color="from-teal-500 to-green-500"
              />
              <FeatureCard
                icon={<AlertTriangle />}
                title="Irritation Analysis"
                description="AI diagnosis of skin reactions and treatment plans"
                href="/bailey-features?feature=irritation-analysis"
                color="from-red-500 to-pink-500"
              />
              <FeatureCard
                icon={<Brain />}
                title="Skin Profile"
                description="Complete AI skin analysis and personalized recommendations"
                href="/bailey-onboarding"
                color="from-purple-500 to-pink-500"
              />
              <FeatureCard
                icon={<Star />}
                title="AI Recommendations"
                description="Personalized product suggestions based on your skin"
                href="/skin-analysis"
                color="from-amber-500 to-orange-500"
              />
            </div>
          )}

          {/* AI Beauty Advisor Tab */}
          {activeTab === 'advisor' && (
            <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
              <FeatureCard
                icon={<Camera />}
                title="Product Scanner"
                description="AI-powered ingredient analysis and compatibility checking"
                href="/bailey-features?feature=product-scanner"
                color="from-blue-500 to-purple-500"
              />
              <FeatureCard
                icon={<BarChart3 />}
                title="Routine Analyzer"
                description="Optimize your skincare routine with AI recommendations"
                href="/bailey-features?feature=routine-analyzer"
                color="from-green-500 to-blue-500"
              />
              <FeatureCard
                icon={<Calendar />}
                title="Progress Tracking"
                description="Monitor your skin improvements over time"
                href="/bailey-features?feature=progress-tracking"
                color="from-teal-500 to-green-500"
              />
              <FeatureCard
                icon={<AlertTriangle />}
                title="Irritation Analysis"
                description="AI diagnosis of skin reactions and treatment plans"
                href="/bailey-features?feature=irritation-analysis"
                color="from-red-500 to-pink-500"
              />
              <FeatureCard
                icon={<Brain />}
                title="Skin Profile"
                description="Complete AI skin analysis and personalized recommendations"
                href="/bailey-onboarding"
                color="from-purple-500 to-pink-500"
              />
              <FeatureCard
                icon={<Star />}
                title="AI Recommendations"
                description="Personalized product suggestions based on your skin"
                href="/skin-analysis"
                color="from-yellow-500 to-orange-500"
              />
            </div>
          )}

          {/* Seoul Intelligence Tab */}
          {activeTab === 'intelligence' && (
            <div className="grid md:grid-cols-2 gap-6">
              <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6 hover:border-[#d4a574]/40 hover:bg-black/60 transition-all backdrop-blur-sm">
                <h3 className="text-xl font-light mb-4 text-[#d4a574]">Korean Beauty Trends</h3>
                <p className="text-gray-400 mb-4">
                  Real-time analysis of trending products, ingredients, and techniques from Seoul
                </p>
                <a href="/intelligence/enhanced#trends" className="text-[#d4a574] hover:text-[#d4a574]/80 transition-colors font-light">
                  View Trending Analysis →
                </a>
              </div>

              <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6 hover:border-[#d4a574]/40 hover:bg-black/60 transition-all backdrop-blur-sm">
                <h3 className="text-xl font-light mb-4 text-[#d4a574]">Influencer Monitoring</h3>
                <p className="text-gray-400 mb-4">
                  Track what Korean beauty influencers are using and recommending
                </p>
                <a href="/intelligence/enhanced#influencers" className="text-[#d4a574] hover:text-[#d4a574]/80 transition-colors font-light">
                  Monitor Influencers →
                </a>
              </div>

              <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6 hover:border-[#d4a574]/40 hover:bg-black/60 transition-all backdrop-blur-sm">
                <h3 className="text-xl font-light mb-4 text-[#d4a574]">Ingredient Trends</h3>
                <p className="text-gray-400 mb-4">
                  Discover emerging ingredients before they hit mainstream markets
                </p>
                <a href="/intelligence/enhanced#ingredients" className="text-[#d4a574] hover:text-[#d4a574]/80 transition-colors font-light">
                  Explore Ingredients →
                </a>
              </div>

              <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6 hover:border-[#d4a574]/40 hover:bg-black/60 transition-all backdrop-blur-sm">
                <h3 className="text-xl font-light mb-4 text-[#d4a574]">Viral Products</h3>
                <p className="text-gray-400 mb-4">
                  Early access to products going viral in Korea
                </p>
                <a href="/intelligence/enhanced#viral" className="text-[#d4a574] hover:text-[#d4a574]/80 transition-colors font-light">
                  See Viral Products →
                </a>
              </div>
            </div>
          )}

          {/* Smart Shopping Tab */}
          {activeTab === 'shopping' && (
            <div className="space-y-8">
              {/* Price Comparison Widget */}
              <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-8 hover:bg-black/60 transition-all backdrop-blur-sm">
                <h3 className="text-2xl font-light mb-6 text-[#d4a574]">
                  <DollarSign className="inline-block w-6 h-6 mr-2" />
                  Price Intelligence
                </h3>
                <p className="text-gray-400 mb-6">
                  AI finds the best prices across Sephora, Ulta, YesStyle, Amazon, and more
                </p>

                <div className="grid md:grid-cols-3 gap-4 mb-6">
                  <div className="text-center">
                    <div className="text-3xl font-light text-[#d4a574] mb-2">15+</div>
                    <p className="text-sm text-gray-400">Retailers Tracked</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-light text-[#d4a574] mb-2">24/7</div>
                    <p className="text-sm text-gray-400">Price Monitoring</p>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-light text-[#d4a574] mb-2">70%</div>
                    <p className="text-sm text-gray-400">Max Savings Found</p>
                  </div>
                </div>

                <button className="w-full bg-[#d4a574] text-black py-3 rounded hover:bg-[#d4a574]/90 transition-colors font-light">
                  <Search className="inline-block w-5 h-5 mr-2" />
                  Search for Product Deals
                </button>
              </div>

              {/* Retailer Trust Scores */}
              <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-8 hover:bg-black/60 transition-all backdrop-blur-sm">
                <h3 className="text-2xl font-light mb-6 text-[#d4a574]">
                  <Star className="inline-block w-6 h-6 mr-2" />
                  Trusted Retailers
                </h3>
                <div className="space-y-4">
                  <RetailerScore name="YesStyle" score={95} />
                  <RetailerScore name="Olive Young Global" score={93} />
                  <RetailerScore name="Sephora" score={90} />
                  <RetailerScore name="iHerb K-Beauty" score={88} />
                  <RetailerScore name="Amazon (Verified Sellers)" score={85} />
                </div>
              </div>

              {/* Deal Alerts */}
              <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-8 hover:bg-black/60 transition-all backdrop-blur-sm">
                <h3 className="text-2xl font-light mb-6 text-[#d4a574]">Recent Deal Alerts</h3>
                <p className="text-gray-400 mb-4">
                  Products from your wishlist that dropped in price
                </p>
                <button className="text-[#d4a574] hover:text-[#d4a574]/80 transition-colors font-light">
                  Set up deal alerts →
                </button>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

// Feature Card Component
function FeatureCard({
  icon,
  title,
  description,
  href,
  color
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  color: string
}) {
  return (
    <a href={href} className="block group">
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6 hover:border-[#d4a574]/40 transition-all hover:bg-black/60 backdrop-blur-sm">
        <div className="w-12 h-12 bg-[#d4a574]/10 border border-[#d4a574]/30 rounded-lg flex items-center justify-center mb-4 text-[#d4a574] group-hover:bg-[#d4a574]/20 transition-all">
          {icon}
        </div>
        <h3 className="text-lg font-light mb-2 text-white group-hover:text-[#d4a574] transition-colors">
          {title}
        </h3>
        <p className="text-sm text-gray-400">
          {description}
        </p>
      </div>
    </a>
  )
}

// Retailer Score Component
function RetailerScore({ name, score }: { name: string; score: number }) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-gray-300 font-light">{name}</span>
      <div className="flex items-center gap-2">
        <div className="w-32 bg-gray-800 rounded-full h-2 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-[#d4a574] to-[#d4a574]/60"
            style={{ width: `${score}%` }}
          />
        </div>
        <span className="text-[#d4a574] text-sm font-light">{score}%</span>
      </div>
    </div>
  )
}