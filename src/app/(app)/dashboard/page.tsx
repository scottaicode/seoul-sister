'use client'

import { useMemo, useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import {
  Camera,
  Layers,
  MessageCircle,
  TrendingUp,
  Sparkles,
  ChevronRight,
  Flame,
  Star,
  Package,
  Brain,
  Beaker,
  Zap,
  BarChart3,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import EmptyState from '@/components/ui/EmptyState'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface LearningInsight {
  title: string
  description: string
  confidence: number
  sample_size: number
  type: 'ingredient' | 'routine' | 'trend' | 'price'
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function QuickActionCard({
  icon: Icon,
  label,
  description,
  href,
  accent = false,
}: {
  icon: React.ElementType
  label: string
  description: string
  href: string
  accent?: boolean
}) {
  return (
    <Link
      href={href}
      className={`flex-shrink-0 w-40 md:w-auto glass-card p-4 flex flex-col gap-3 hover:shadow-glass-lg transition-all duration-300 group ${
        accent ? 'border-rose-gold/30 bg-gradient-to-br from-white/80 to-seoul-blush/30' : ''
      }`}
    >
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors duration-200 ${
          accent
            ? 'bg-gradient-to-br from-rose-gold to-rose-light text-white'
            : 'bg-seoul-pearl text-rose-gold group-hover:bg-seoul-blush'
        }`}
      >
        <Icon className="w-5 h-5" strokeWidth={1.75} />
      </div>
      <div>
        <p className="font-display font-semibold text-sm text-seoul-charcoal">{label}</p>
        <p className="text-xs text-seoul-soft mt-0.5 leading-snug">{description}</p>
      </div>
    </Link>
  )
}

interface TrendingProduct {
  id: string
  name: string
  brand: string
  category: string
  trendSignal: string
  rating: number
}

const PLACEHOLDER_TRENDING: TrendingProduct[] = [
  {
    id: '1',
    name: 'Centella Blemish Serum',
    brand: 'COSRX',
    category: 'Serum',
    trendSignal: 'Viral on TikTok',
    rating: 4.8,
  },
  {
    id: '2',
    name: 'PDRN Recovery Ampoule',
    brand: 'Dr. Jart+',
    category: 'Ampoule',
    trendSignal: 'Trending in Seoul',
    rating: 4.7,
  },
  {
    id: '3',
    name: 'Glass Skin Essence',
    brand: 'Laneige',
    category: 'Essence',
    trendSignal: 'Top rated this week',
    rating: 4.6,
  },
]

function TrendingProductCard({ product }: { product: TrendingProduct }) {
  return (
    <div className="glass-card p-4 flex items-center gap-3 hover:shadow-glass-lg transition-all duration-300">
      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-seoul-pearl flex items-center justify-center">
        <Package className="w-5 h-5 text-rose-gold" strokeWidth={1.5} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-sm text-seoul-charcoal truncate">
          {product.name}
        </p>
        <p className="text-xs text-seoul-soft">{product.brand}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="badge-pink text-[10px] px-2 py-0.5 inline-flex items-center gap-1">
            <Flame className="w-2.5 h-2.5" />
            {product.trendSignal}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-seoul-soft">
            <Star className="w-2.5 h-2.5 fill-rose-gold text-rose-gold" />
            {product.rating}
          </span>
        </div>
      </div>

      <ChevronRight className="flex-shrink-0 w-4 h-4 text-seoul-soft/50" />
    </div>
  )
}

function InsightIcon({ type }: { type: LearningInsight['type'] }) {
  switch (type) {
    case 'ingredient':
      return <Beaker className="w-4 h-4" strokeWidth={1.75} />
    case 'routine':
      return <Layers className="w-4 h-4" strokeWidth={1.75} />
    case 'trend':
      return <Zap className="w-4 h-4" strokeWidth={1.75} />
    case 'price':
      return <BarChart3 className="w-4 h-4" strokeWidth={1.75} />
  }
}

function InsightCard({ insight }: { insight: LearningInsight }) {
  return (
    <div className="glass-card p-4 flex gap-3">
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gradient-to-br from-seoul-blush to-white flex items-center justify-center text-rose-gold">
        <InsightIcon type={insight.type} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-sm text-seoul-charcoal">
          {insight.title}
        </p>
        <p className="text-xs text-seoul-soft mt-0.5 leading-snug">
          {insight.description}
        </p>
        {insight.sample_size > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 flex-1 bg-seoul-pearl rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-rose-gold to-rose-light rounded-full transition-all duration-500"
                style={{ width: `${Math.round(insight.confidence * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-seoul-soft whitespace-nowrap">
              {Math.round(insight.confidence * 100)}% confidence
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

function YuriInsightsWidget() {
  const { user } = useAuth()
  const [insights, setInsights] = useState<LearningInsight[]>([])
  const [loading, setLoading] = useState(true)

  const fetchInsights = useCallback(async () => {
    if (!user) return

    try {
      const session = await (await import('@/lib/supabase')).supabase.auth.getSession()
      const token = session.data.session?.access_token
      if (!token) return

      const res = await fetch('/api/learning/recommendations', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
        // Transform recommendations into insights for display
        const recs = data.recommendations || []
        const mapped: LearningInsight[] = recs.slice(0, 3).map(
          (r: { product_name: string; brand: string; match_score: number; reasons: string[]; effectiveness_data: { score: number; sample_size: number } | null }) => ({
            title: `${r.product_name} by ${r.brand}`,
            description: r.reasons[0] || 'Recommended for your skin profile',
            confidence: (r.match_score || 50) / 100,
            sample_size: r.effectiveness_data?.sample_size || 0,
            type: 'ingredient' as const,
          })
        )
        setInsights(mapped)
      }
    } catch {
      // Non-critical; show empty state
    } finally {
      setLoading(false)
    }
  }, [user])

  useEffect(() => {
    fetchInsights()
  }, [fetchInsights])

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="glass-card p-4 animate-pulse">
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-lg bg-seoul-pearl" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-seoul-pearl rounded w-2/3" />
                <div className="h-2 bg-seoul-pearl rounded w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <div className="glass-card p-5 text-center">
        <Brain className="w-8 h-8 text-rose-gold/40 mx-auto mb-2" strokeWidth={1.5} />
        <p className="font-display font-semibold text-sm text-seoul-charcoal">
          Yuri is learning
        </p>
        <p className="text-xs text-seoul-soft mt-1">
          As more users share reviews and scan products, Yuri builds personalized
          insights for your skin type. Check back soon!
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      {insights.map((insight, idx) => (
        <InsightCard key={idx} insight={insight} />
      ))}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page component
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { user } = useAuth()

  const displayName = useMemo(() => {
    if (!user) return null
    return (
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      null
    )
  }, [user])

  const greeting = getGreeting()

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-8 animate-fade-in">
      {/* ------------------------------------------------------------------ */}
      {/* Greeting */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h1 className="font-display font-bold text-2xl text-seoul-charcoal">
          {displayName ? (
            <>
              {greeting},{' '}
              <span className="text-gradient">{displayName}</span> ✨
            </>
          ) : (
            <>
              Welcome to{' '}
              <span className="text-gradient">Seoul Sister</span>
            </>
          )}
        </h1>
        <p className="text-seoul-soft text-sm mt-1">
          Your K-beauty intelligence advisor is ready.
        </p>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Quick Actions */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <h2 className="font-display font-semibold text-base text-seoul-charcoal mb-3">
          Quick Actions
        </h2>

        <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide md:overflow-visible md:pb-0 md:grid md:grid-cols-4">
          <QuickActionCard
            icon={Camera}
            label="Scan Label"
            description="Decode any Korean product"
            href="/scan"
            accent
          />
          <QuickActionCard
            icon={Layers}
            label="My Routine"
            description="Build your AM/PM routine"
            href="/routine"
          />
          <QuickActionCard
            icon={MessageCircle}
            label="Ask Yuri"
            description="AI beauty advisor"
            href="/yuri"
          />
          <QuickActionCard
            icon={TrendingUp}
            label="Trending"
            description="Hot in Korea right now"
            href="/trending"
          />
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Yuri's Insights (Learning Engine) */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-rose-gold" strokeWidth={1.75} />
            <h2 className="font-display font-semibold text-base text-seoul-charcoal">
              Yuri&apos;s Insights
            </h2>
          </div>
          <Link
            href="/yuri"
            className="text-xs text-rose-gold font-medium hover:text-rose-dark transition-colors duration-200 flex items-center gap-0.5"
          >
            Ask Yuri <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <YuriInsightsWidget />
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Skin Profile Summary */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-base text-seoul-charcoal">
            Your Skin Profile
          </h2>
        </div>

        <div className="glass-card p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-rose-gold to-rose-light flex-shrink-0">
            <Sparkles className="w-5 h-5 text-white" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-display font-semibold text-sm text-seoul-charcoal">
              Complete your skin profile
            </p>
            <p className="text-xs text-seoul-soft mt-0.5">
              Unlock personalized recommendations, conflict detection, and skin-matched reviews.
            </p>
          </div>
          <Link
            href="/onboarding"
            className="glass-button-primary text-sm px-4 py-2 whitespace-nowrap flex-shrink-0"
          >
            Get started
          </Link>
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Trending in Korea */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-base text-seoul-charcoal">
            Trending in Korea
          </h2>
          <Link
            href="/trending"
            className="text-xs text-rose-gold font-medium hover:text-rose-dark transition-colors duration-200 flex items-center gap-0.5"
          >
            See all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <div className="flex flex-col gap-3">
          {PLACEHOLDER_TRENDING.map((product) => (
            <TrendingProductCard key={product.id} product={product} />
          ))}
        </div>
      </section>

      {/* ------------------------------------------------------------------ */}
      {/* Recent Scans */}
      {/* ------------------------------------------------------------------ */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-base text-seoul-charcoal">
            Recent Scans
          </h2>
        </div>

        <EmptyState
          icon={Camera}
          title="No scans yet"
          description="Scan a Korean product label to get instant ingredient analysis, safety scoring, and personalised insights."
          actionLabel="Scan a product"
          actionHref="/scan"
        />
      </section>

      {/* Bottom spacer so content clears mobile nav */}
      <div className="h-4" />
    </div>
  )
}
