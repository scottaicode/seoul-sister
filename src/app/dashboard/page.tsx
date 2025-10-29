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
            <div className="space-y-8">
              {/* Premium Value Header */}
              <div className="bg-gradient-to-r from-[#d4a574]/10 to-[#d4a574]/5 border border-[#d4a574]/20 rounded-lg p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-light text-[#d4a574]">Your Beauty Intelligence Hub</h2>
                  <div className="text-right">
                    <div className="text-2xl font-light text-[#d4a574]">$20/month</div>
                    <div className="text-sm text-gray-400">Professional-grade analysis</div>
                  </div>
                </div>

                {/* Value Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-light text-white mb-1">$247</div>
                    <div className="text-xs text-gray-400">Saved this month</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-light text-white mb-1">12</div>
                    <div className="text-xs text-gray-400">Products analyzed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-light text-white mb-1">89%</div>
                    <div className="text-xs text-gray-400">Skin improvement</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-light text-white mb-1">47</div>
                    <div className="text-xs text-gray-400">Deals found</div>
                  </div>
                </div>
              </div>

              {/* Core Features Grid */}
              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                <PremiumFeatureCard
                  icon={<Camera />}
                  title="AI Skin Analysis"
                  description="Professional-grade photo analysis with progress tracking"
                  href="/skin-analysis"
                  value="$200+ value"
                  badge="Most Popular"
                />
                <PremiumFeatureCard
                  icon={<DollarSign />}
                  title="Deal Hunter"
                  description="Real-time price monitoring across 15+ trusted retailers"
                  href="/dashboard?tab=shopping"
                  value="Save $50-200/mo"
                  badge="High ROI"
                />
                <PremiumFeatureCard
                  icon={<BarChart3 />}
                  title="Progress Tracking"
                  description="Visual skin improvement timeline with AI insights"
                  href="/bailey-features?feature=progress-tracking"
                  value="Dermatologist-level"
                  badge="Premium"
                />
                <PremiumFeatureCard
                  icon={<Search />}
                  title="Ingredient Scanner"
                  description="Instant compatibility analysis and allergen detection"
                  href="/bailey-features?feature=product-scanner"
                  value="Safety first"
                  badge="Essential"
                />
                <PremiumFeatureCard
                  icon={<TrendingUp />}
                  title="Korean Intelligence"
                  description="Early access to viral products and trend insights"
                  href="/dashboard?tab=intelligence"
                  value="3-6 months early"
                  badge="Exclusive"
                />
                <PremiumFeatureCard
                  icon={<Brain />}
                  title="AI Assistant"
                  description="Personal beauty advisor with recommendation engine"
                  href="/bailey-onboarding"
                  value="24/7 expert"
                  badge="AI-Powered"
                />
              </div>

              {/* Quick Actions */}
              <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6">
                <h3 className="text-lg font-medium text-[#d4a574] mb-4">Quick Actions</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <button className="bg-[#d4a574]/10 hover:bg-[#d4a574]/20 border border-[#d4a574]/30 rounded-lg p-4 text-left transition-all">
                    <Camera className="w-6 h-6 text-[#d4a574] mb-2" />
                    <div className="text-white font-medium text-sm">Analyze Skin</div>
                    <div className="text-gray-400 text-xs">Upload new photo</div>
                  </button>
                  <button className="bg-[#d4a574]/10 hover:bg-[#d4a574]/20 border border-[#d4a574]/30 rounded-lg p-4 text-left transition-all">
                    <Search className="w-6 h-6 text-[#d4a574] mb-2" />
                    <div className="text-white font-medium text-sm">Find Deals</div>
                    <div className="text-gray-400 text-xs">Check price drops</div>
                  </button>
                  <button className="bg-[#d4a574]/10 hover:bg-[#d4a574]/20 border border-[#d4a574]/30 rounded-lg p-4 text-left transition-all">
                    <BarChart3 className="w-6 h-6 text-[#d4a574] mb-2" />
                    <div className="text-white font-medium text-sm">View Progress</div>
                    <div className="text-gray-400 text-xs">Track improvements</div>
                  </button>
                  <button className="bg-[#d4a574]/10 hover:bg-[#d4a574]/20 border border-[#d4a574]/30 rounded-lg p-4 text-left transition-all">
                    <TrendingUp className="w-6 h-6 text-[#d4a574] mb-2" />
                    <div className="text-white font-medium text-sm">Discover</div>
                    <div className="text-gray-400 text-xs">Korean trends</div>
                  </button>
                </div>
              </div>
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
            <div className="space-y-8">
              {/* Intelligence Overview */}
              <div className="bg-gradient-to-r from-purple-500/10 to-[#d4a574]/10 border border-[#d4a574]/20 rounded-lg p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-light text-[#d4a574]">Korean Beauty Intelligence</h3>
                  <div className="text-right">
                    <div className="text-2xl font-light text-purple-400">47</div>
                    <div className="text-sm text-gray-400">Trending now</div>
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-light text-white mb-1">12</div>
                    <div className="text-xs text-gray-400">Viral products</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-light text-white mb-1">3</div>
                    <div className="text-xs text-gray-400">New ingredients</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-light text-white mb-1">89</div>
                    <div className="text-xs text-gray-400">Community posts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-light text-white mb-1">24h</div>
                    <div className="text-xs text-gray-400">Update frequency</div>
                  </div>
                </div>
              </div>

              {/* Trending Right Now */}
              <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-8">
                <h3 className="text-2xl font-light mb-6 text-[#d4a574]">🔥 Trending Right Now</h3>
                <div className="grid md:grid-cols-3 gap-6">
                  <TrendingCard
                    type="product"
                    title="PDRN Salmon Sperm Serums"
                    description="Korean celebrities are obsessing over PDRN for anti-aging"
                    trendScore={94}
                    source="TikTok • Reddit"
                    timeframe="Last 48 hours"
                  />
                  <TrendingCard
                    type="ingredient"
                    title="Marine Spicules"
                    description="Microscopic needles for deep ingredient penetration"
                    trendScore={87}
                    source="Korean Beauty Forums"
                    timeframe="This week"
                  />
                  <TrendingCard
                    type="technique"
                    title="7-Skin Method Plus"
                    description="Enhanced layering technique gaining popularity"
                    trendScore={76}
                    source="Instagram • YouTube"
                    timeframe="This month"
                  />
                </div>
              </div>

              {/* Intelligence Categories */}
              <div className="grid md:grid-cols-2 gap-6">
                <IntelligenceCard
                  icon="🔍"
                  title="Community Monitoring"
                  description="Real-time analysis of Korean beauty communities"
                  insights={[
                    "89 new product mentions today",
                    "12 viral before/after posts",
                    "5 ingredient discussions trending"
                  ]}
                  action="View Community Intel"
                />

                <IntelligenceCard
                  icon="📊"
                  title="Influencer Tracking"
                  description="Monitor top Korean beauty influencers"
                  insights={[
                    "34 new product recommendations",
                    "7 exclusive discount codes",
                    "15 routine reveals this week"
                  ]}
                  action="Track Influencers"
                />

                <IntelligenceCard
                  icon="🧪"
                  title="Ingredient Research"
                  description="Emerging ingredients before mainstream adoption"
                  insights={[
                    "3 new ingredients identified",
                    "PDRN trending +240%",
                    "Peptide innovations in R&D"
                  ]}
                  action="Research Ingredients"
                />

                <IntelligenceCard
                  icon="⚡"
                  title="Viral Prediction"
                  description="AI prediction of next viral products"
                  insights={[
                    "87% accuracy last quarter",
                    "12 products predicted to trend",
                    "Early access alerts active"
                  ]}
                  action="View Predictions"
                />
              </div>

              {/* Market Intelligence */}
              <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-8">
                <h3 className="text-2xl font-light mb-6 text-[#d4a574]">Market Intelligence</h3>
                <div className="space-y-4">
                  <MarketInsight
                    category="K-Beauty Growth"
                    stat="+43%"
                    description="US market growth year-over-year"
                    impact="High demand, pricing pressure"
                  />
                  <MarketInsight
                    category="Trending Categories"
                    stat="Serums"
                    description="Most discussed product type"
                    impact="Focus area for deal hunting"
                  />
                  <MarketInsight
                    category="Price Fluctuations"
                    stat="-15%"
                    description="Average discount from retail"
                    impact="Good buying opportunity"
                  />
                </div>
              </div>
            </div>
          )}

          {/* Smart Shopping Tab */}
          {activeTab === 'shopping' && (
            <div className="space-y-8">
              {/* Savings Dashboard */}
              <div className="bg-gradient-to-r from-green-500/10 to-[#d4a574]/10 border border-[#d4a574]/20 rounded-lg p-8">
                <div className="flex items-center justify-between mb-6">
                  <h3 className="text-2xl font-light text-[#d4a574]">Your Savings Dashboard</h3>
                  <div className="text-right">
                    <div className="text-3xl font-light text-green-400">$247</div>
                    <div className="text-sm text-gray-400">Saved this month</div>
                  </div>
                </div>

                <div className="grid md:grid-cols-4 gap-4">
                  <div className="text-center">
                    <div className="text-2xl font-light text-white mb-1">47</div>
                    <div className="text-xs text-gray-400">Active deals</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-light text-white mb-1">$127</div>
                    <div className="text-xs text-gray-400">Biggest saving</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-light text-white mb-1">8</div>
                    <div className="text-xs text-gray-400">Price alerts</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-light text-white mb-1">15+</div>
                    <div className="text-xs text-gray-400">Retailers tracked</div>
                  </div>
                </div>
              </div>

              {/* Active Deals */}
              <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-8">
                <h3 className="text-2xl font-light mb-6 text-[#d4a574]">🔥 Hot Deals</h3>
                <div className="space-y-4">
                  <DealCard
                    productName="COSRX Snail 96 Mucin Power Essence"
                    brand="COSRX"
                    originalPrice={25.00}
                    salePrice={18.99}
                    discount={24}
                    retailer="YesStyle"
                    trustScore={95}
                    expiry="2 days left"
                    badge="Flash Sale"
                  />
                  <DealCard
                    productName="Beauty of Joseon Glow Deep Serum"
                    brand="Beauty of Joseon"
                    originalPrice={17.00}
                    salePrice={12.75}
                    discount={25}
                    retailer="Olive Young Global"
                    trustScore={93}
                    expiry="1 day left"
                    badge="Clearance"
                  />
                  <DealCard
                    productName="Laneige Water Sleeping Mask"
                    brand="Laneige"
                    originalPrice={34.00}
                    salePrice={25.50}
                    discount={25}
                    retailer="Sephora"
                    trustScore={90}
                    expiry="4 days left"
                    badge="Seasonal"
                  />
                </div>
              </div>

              {/* Price Intelligence */}
              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-8">
                  <h3 className="text-xl font-light mb-4 text-[#d4a574]">
                    <Search className="inline-block w-5 h-5 mr-2" />
                    Price Tracker
                  </h3>
                  <p className="text-gray-400 mb-6">
                    Monitor any Korean beauty product across all major retailers
                  </p>
                  <div className="space-y-3">
                    <input
                      type="text"
                      placeholder="Enter product name or URL"
                      className="w-full px-4 py-3 bg-gray-800 border border-gray-700 text-white rounded-lg focus:ring-2 focus:ring-[#d4a574] focus:border-[#d4a574] transition-colors"
                    />
                    <button className="w-full bg-[#d4a574] text-black py-3 rounded hover:bg-[#d4a574]/90 transition-colors font-light">
                      Start Tracking
                    </button>
                  </div>
                </div>

                <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-8">
                  <h3 className="text-xl font-light mb-4 text-[#d4a574]">
                    <AlertTriangle className="inline-block w-5 h-5 mr-2" />
                    Price Alerts
                  </h3>
                  <p className="text-gray-400 mb-6">
                    Get notified when products hit your target price
                  </p>
                  <div className="space-y-3">
                    <div className="flex items-center justify-between p-3 bg-gray-800/50 rounded-lg">
                      <div>
                        <div className="text-white text-sm">COSRX BHA Liquid</div>
                        <div className="text-gray-400 text-xs">Target: $19.99</div>
                      </div>
                      <div className="text-green-400 text-xs">Active</div>
                    </div>
                    <button className="w-full border border-[#d4a574] text-[#d4a574] py-3 rounded hover:bg-[#d4a574]/10 transition-colors font-light">
                      Set New Alert
                    </button>
                  </div>
                </div>
              </div>

              {/* Trusted Retailers */}
              <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-8">
                <h3 className="text-2xl font-light mb-6 text-[#d4a574]">
                  <Star className="inline-block w-6 h-6 mr-2" />
                  Trusted Retailers
                </h3>
                <div className="grid md:grid-cols-2 gap-4">
                  <RetailerScore name="YesStyle" score={95} />
                  <RetailerScore name="Olive Young Global" score={93} />
                  <RetailerScore name="Sephora" score={90} />
                  <RetailerScore name="iHerb K-Beauty" score={88} />
                  <RetailerScore name="Amazon (Verified Sellers)" score={85} />
                  <RetailerScore name="Ulta Beauty" score={87} />
                </div>
              </div>
            </div>
          )}
        </div>
      </section>
    </main>
  )
}

// Premium Feature Card Component
function PremiumFeatureCard({
  icon,
  title,
  description,
  href,
  value,
  badge
}: {
  icon: React.ReactNode
  title: string
  description: string
  href: string
  value: string
  badge: string
}) {
  return (
    <a href={href} className="block group">
      <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6 hover:border-[#d4a574]/40 transition-all hover:bg-black/60 backdrop-blur-sm relative">
        {/* Badge */}
        <div className="absolute top-3 right-3 bg-[#d4a574] text-black text-xs px-2 py-1 rounded-full font-medium">
          {badge}
        </div>

        <div className="w-12 h-12 bg-[#d4a574]/10 border border-[#d4a574]/30 rounded-lg flex items-center justify-center mb-4 text-[#d4a574] group-hover:bg-[#d4a574]/20 transition-all">
          {icon}
        </div>
        <h3 className="text-lg font-light mb-2 text-white group-hover:text-[#d4a574] transition-colors">
          {title}
        </h3>
        <p className="text-sm text-gray-400 mb-3">
          {description}
        </p>
        <div className="text-xs text-[#d4a574] font-medium">
          {value}
        </div>
      </div>
    </a>
  )
}

// Feature Card Component (Legacy)
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

// Deal Card Component
function DealCard({
  productName,
  brand,
  originalPrice,
  salePrice,
  discount,
  retailer,
  trustScore,
  expiry,
  badge
}: {
  productName: string
  brand: string
  originalPrice: number
  salePrice: number
  discount: number
  retailer: string
  trustScore: number
  expiry: string
  badge: string
}) {
  const savings = originalPrice - salePrice

  return (
    <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4 hover:border-[#d4a574]/40 transition-all group">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="bg-red-500 text-white text-xs px-2 py-1 rounded font-medium">
            -{discount}%
          </span>
          <span className="bg-[#d4a574]/20 text-[#d4a574] text-xs px-2 py-1 rounded">
            {badge}
          </span>
        </div>
        <div className="text-xs text-gray-400">{expiry}</div>
      </div>

      <div className="mb-3">
        <h4 className="text-white font-medium text-sm mb-1">{productName}</h4>
        <p className="text-gray-400 text-xs">{brand} • {retailer}</p>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-2">
          <span className="text-lg font-medium text-[#d4a574]">${salePrice.toFixed(2)}</span>
          <span className="text-sm text-gray-400 line-through">${originalPrice.toFixed(2)}</span>
        </div>
        <div className="text-right">
          <div className="text-green-400 text-sm font-medium">Save ${savings.toFixed(2)}</div>
          <div className="text-xs text-gray-400">Trust: {trustScore}%</div>
        </div>
      </div>

      <button className="w-full mt-3 bg-[#d4a574]/10 hover:bg-[#d4a574]/20 text-[#d4a574] py-2 rounded text-sm transition-colors">
        View Deal
      </button>
    </div>
  )
}

// Trending Card Component
function TrendingCard({
  type,
  title,
  description,
  trendScore,
  source,
  timeframe
}: {
  type: string
  title: string
  description: string
  trendScore: number
  source: string
  timeframe: string
}) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'product': return '🛍️'
      case 'ingredient': return '🧪'
      case 'technique': return '✨'
      default: return '📈'
    }
  }

  const getScoreColor = (score: number) => {
    if (score >= 90) return 'text-red-400'
    if (score >= 80) return 'text-orange-400'
    if (score >= 70) return 'text-yellow-400'
    return 'text-gray-400'
  }

  return (
    <div className="bg-gray-800/30 border border-gray-700 rounded-lg p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center space-x-2">
          <span className="text-lg">{getTypeIcon(type)}</span>
          <span className="bg-[#d4a574]/20 text-[#d4a574] text-xs px-2 py-1 rounded capitalize">
            {type}
          </span>
        </div>
        <div className={`text-lg font-medium ${getScoreColor(trendScore)}`}>
          {trendScore}
        </div>
      </div>

      <h4 className="text-white font-medium text-sm mb-2">{title}</h4>
      <p className="text-gray-400 text-xs mb-3">{description}</p>

      <div className="flex items-center justify-between text-xs">
        <span className="text-gray-500">{source}</span>
        <span className="text-gray-500">{timeframe}</span>
      </div>
    </div>
  )
}

// Intelligence Card Component
function IntelligenceCard({
  icon,
  title,
  description,
  insights,
  action
}: {
  icon: string
  title: string
  description: string
  insights: string[]
  action: string
}) {
  return (
    <div className="bg-black/40 border border-[#d4a574]/20 rounded-lg p-6 hover:border-[#d4a574]/40 transition-all">
      <div className="flex items-center space-x-3 mb-4">
        <span className="text-2xl">{icon}</span>
        <div>
          <h4 className="text-lg font-medium text-[#d4a574]">{title}</h4>
          <p className="text-gray-400 text-sm">{description}</p>
        </div>
      </div>

      <div className="space-y-2 mb-4">
        {insights.map((insight, index) => (
          <div key={index} className="flex items-center space-x-2">
            <div className="w-1 h-1 bg-[#d4a574] rounded-full"></div>
            <span className="text-gray-300 text-sm">{insight}</span>
          </div>
        ))}
      </div>

      <button className="w-full bg-[#d4a574]/10 hover:bg-[#d4a574]/20 text-[#d4a574] py-2 rounded text-sm transition-colors">
        {action}
      </button>
    </div>
  )
}

// Market Insight Component
function MarketInsight({
  category,
  stat,
  description,
  impact
}: {
  category: string
  stat: string
  description: string
  impact: string
}) {
  return (
    <div className="flex items-center justify-between p-4 bg-gray-800/30 rounded-lg">
      <div>
        <h5 className="text-white font-medium text-sm">{category}</h5>
        <p className="text-gray-400 text-xs">{description}</p>
      </div>
      <div className="text-right">
        <div className="text-[#d4a574] font-medium">{stat}</div>
        <div className="text-gray-400 text-xs">{impact}</div>
      </div>
    </div>
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