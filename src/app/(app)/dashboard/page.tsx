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
  Droplets,
  Sun,
  MapPin,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import { supabase } from '@/lib/supabase'
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

interface SkinProfile {
  skin_type: string
  skin_concerns: string[]
  climate: string
  onboarding_completed: boolean
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
      className={`flex-shrink-0 w-40 md:w-auto rounded-2xl border p-4 flex flex-col gap-3 transition-all duration-300 group ${
        accent
          ? 'border-gold/30 bg-gold/5 hover:bg-gold/10 hover:shadow-glow-gold'
          : 'border-white/10 bg-white/5 hover:bg-white/10 hover:border-white/20'
      }`}
    >
      <div
        className={`flex items-center justify-center w-10 h-10 rounded-xl transition-colors duration-200 ${
          accent
            ? 'bg-gradient-to-br from-gold to-gold-light text-seoul-dark'
            : 'bg-white/10 text-gold group-hover:bg-gold/15'
        }`}
      >
        <Icon className="w-5 h-5" strokeWidth={1.75} />
      </div>
      <div>
        <p className="font-display font-semibold text-sm text-white">{label}</p>
        <p className="text-xs text-white/40 mt-0.5 leading-snug">{description}</p>
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex items-center gap-3 hover:bg-white/10 transition-all duration-300">
      <div className="flex-shrink-0 w-12 h-12 rounded-xl bg-white/5 flex items-center justify-center">
        <Package className="w-5 h-5 text-gold/60" strokeWidth={1.5} />
      </div>

      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-sm text-white truncate">
          {product.name}
        </p>
        <p className="text-xs text-white/40">{product.brand}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-gold/10 text-gold-light border border-gold/20 inline-flex items-center gap-1">
            <Flame className="w-2.5 h-2.5" />
            {product.trendSignal}
          </span>
          <span className="flex items-center gap-0.5 text-[10px] text-white/40">
            <Star className="w-2.5 h-2.5 fill-gold text-gold" />
            {product.rating}
          </span>
        </div>
      </div>

      <ChevronRight className="flex-shrink-0 w-4 h-4 text-white/20" />
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
    <div className="rounded-2xl border border-white/10 bg-white/5 p-4 flex gap-3">
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-gold/10 flex items-center justify-center text-gold">
        <InsightIcon type={insight.type} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-sm text-white">
          {insight.title}
        </p>
        <p className="text-xs text-white/40 mt-0.5 leading-snug">
          {insight.description}
        </p>
        {insight.sample_size > 0 && (
          <div className="flex items-center gap-2 mt-2">
            <div className="h-1 flex-1 bg-white/10 rounded-full overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-gold to-gold-light rounded-full transition-all duration-500"
                style={{ width: `${Math.round(insight.confidence * 100)}%` }}
              />
            </div>
            <span className="text-[10px] text-white/30 whitespace-nowrap">
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
      const session = await supabase.auth.getSession()
      const token = session.data.session?.access_token
      if (!token) return

      const res = await fetch('/api/learning/recommendations', {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (res.ok) {
        const data = await res.json()
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
      // Non-critical
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
          <div key={i} className="rounded-2xl border border-white/10 bg-white/5 p-4 animate-pulse">
            <div className="flex gap-3">
              <div className="w-9 h-9 rounded-lg bg-white/10" />
              <div className="flex-1 space-y-2">
                <div className="h-3 bg-white/10 rounded w-2/3" />
                <div className="h-2 bg-white/10 rounded w-full" />
              </div>
            </div>
          </div>
        ))}
      </div>
    )
  }

  if (insights.length === 0) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 text-center">
        <Brain className="w-8 h-8 text-gold/30 mx-auto mb-2" strokeWidth={1.5} />
        <p className="font-display font-semibold text-sm text-white">
          Yuri is learning
        </p>
        <p className="text-xs text-white/40 mt-1">
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
// Skin Profile Widget (shows data if complete, CTA if not)
// ---------------------------------------------------------------------------

function SkinProfileWidget() {
  const { user } = useAuth()
  const [profile, setProfile] = useState<SkinProfile | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (!user) return
    async function load() {
      try {
        const { data } = await supabase
          .from('ss_user_profiles')
          .select('skin_type, skin_concerns, climate, onboarding_completed')
          .eq('user_id', user!.id)
          .maybeSingle()
        setProfile(data as SkinProfile | null)
      } catch {
        // Non-critical
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [user])

  if (loading) {
    return (
      <div className="rounded-2xl border border-white/10 bg-white/5 p-5 animate-pulse">
        <div className="flex gap-4">
          <div className="w-12 h-12 rounded-xl bg-white/10" />
          <div className="flex-1 space-y-2">
            <div className="h-3 bg-white/10 rounded w-1/2" />
            <div className="h-2 bg-white/10 rounded w-3/4" />
          </div>
        </div>
      </div>
    )
  }

  // Profile complete — show summary
  if (profile?.onboarding_completed) {
    const skinType = profile.skin_type
      ? profile.skin_type.charAt(0).toUpperCase() + profile.skin_type.slice(1)
      : 'Normal'
    const concerns = profile.skin_concerns?.length
      ? profile.skin_concerns.slice(0, 3).join(', ')
      : 'None set'
    const climate = profile.climate
      ? profile.climate.charAt(0).toUpperCase() + profile.climate.slice(1)
      : 'Temperate'

    return (
      <div className="rounded-2xl border border-gold/20 bg-gold/5 p-5">
        <div className="flex items-center gap-2 mb-4">
          <Sparkles className="w-4 h-4 text-gold" />
          <p className="font-display font-semibold text-sm text-gold-light">Profile Complete</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <Droplets className="w-4 h-4 text-gold/60" />
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Skin Type</p>
              <p className="text-sm text-white font-medium">{skinType}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <Sun className="w-4 h-4 text-gold/60" />
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Concerns</p>
              <p className="text-sm text-white font-medium">{concerns}</p>
            </div>
          </div>
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center">
              <MapPin className="w-4 h-4 text-gold/60" />
            </div>
            <div>
              <p className="text-[10px] text-white/30 uppercase tracking-wider">Climate</p>
              <p className="text-sm text-white font-medium">{climate}</p>
            </div>
          </div>
        </div>
        <div className="mt-4 pt-3 border-t border-white/5">
          <Link
            href="/profile"
            className="text-xs text-gold-light hover:text-gold transition-colors"
          >
            Edit profile &rarr;
          </Link>
        </div>
      </div>
    )
  }

  // Not complete — show CTA
  return (
    <div className="dark-card-gold p-5 flex flex-col sm:flex-row items-start sm:items-center gap-4">
      <div className="flex items-center justify-center w-12 h-12 rounded-xl bg-gradient-to-br from-gold to-gold-light flex-shrink-0">
        <Sparkles className="w-5 h-5 text-seoul-dark" strokeWidth={1.75} />
      </div>
      <div className="flex-1 min-w-0">
        <p className="font-display font-semibold text-sm text-white">
          Complete your skin profile
        </p>
        <p className="text-xs text-white/40 mt-0.5">
          Unlock personalized recommendations, conflict detection, and skin-matched reviews.
        </p>
      </div>
      <Link
        href="/onboarding"
        className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gradient-to-br from-gold to-gold-light text-seoul-dark text-sm font-semibold hover:shadow-glow-gold transition-all duration-200 whitespace-nowrap flex-shrink-0"
      >
        Get started
      </Link>
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
      {/* Greeting */}
      <section>
        <h1 className="font-display font-bold text-2xl text-white">
          {displayName ? (
            <>
              {greeting},{' '}
              <span className="bg-gradient-to-r from-gold to-gold-light bg-clip-text text-transparent">{displayName}</span>{' '}
              <Sparkles className="w-5 h-5 text-gold inline -mt-1" />
            </>
          ) : (
            <>
              Welcome to{' '}
              <span className="bg-gradient-to-r from-gold to-gold-light bg-clip-text text-transparent">Seoul Sister</span>
            </>
          )}
        </h1>
        <p className="text-white/40 text-sm mt-1">
          Your K-beauty intelligence advisor is ready.
        </p>
      </section>

      {/* Quick Actions */}
      <section>
        <h2 className="font-display font-semibold text-base text-white mb-3">
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

      {/* Yuri's Insights */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Brain className="w-4 h-4 text-gold" strokeWidth={1.75} />
            <h2 className="font-display font-semibold text-base text-white">
              Yuri&apos;s Insights
            </h2>
          </div>
          <Link
            href="/yuri"
            className="text-xs text-gold-light font-medium hover:text-gold transition-colors duration-200 flex items-center gap-0.5"
          >
            Ask Yuri <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <YuriInsightsWidget />
      </section>

      {/* Skin Profile */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-base text-white">
            Your Skin Profile
          </h2>
        </div>

        <SkinProfileWidget />
      </section>

      {/* Trending in Korea */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-base text-white">
            Trending in Korea
          </h2>
          <Link
            href="/trending"
            className="text-xs text-gold-light font-medium hover:text-gold transition-colors duration-200 flex items-center gap-0.5"
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

      {/* Recent Scans */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-base text-white">
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

      {/* Bottom spacer for mobile nav */}
      <div className="h-4" />
    </div>
  )
}
