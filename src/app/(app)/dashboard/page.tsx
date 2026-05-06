'use client'

import { useCallback, useMemo, useState, useEffect } from 'react'
import Link from 'next/link'
import {
  Camera,
  Clock,
  CloudSun,
  Layers,
  MessageCircle,
  TrendingUp,
  Sparkles,
  ChevronRight,
  Lightbulb,
  Loader2,
  FlaskConical,
} from 'lucide-react'
import { useAuth } from '@/hooks/useAuth'
import QuickActionCard from '@/components/dashboard/QuickActionCard'
import TrendingProductCard from '@/components/dashboard/TrendingProductCard'
import type { TrendingProduct } from '@/components/dashboard/TrendingProductCard'
import YuriInsightsWidget from '@/components/dashboard/YuriInsightsWidget'
import SkinProfileWidget from '@/components/dashboard/SkinProfileWidget'
import ExpiringProductsWidget from '@/components/dashboard/ExpiringProductsWidget'
import ReformulationAlertWidget from '@/components/dashboard/ReformulationAlert'
import GlassSkinWidget from '@/components/dashboard/GlassSkinWidget'
import WeatherRoutineWidget from '@/components/dashboard/WeatherRoutineWidget'
import ShelfScanWidget from '@/components/dashboard/ShelfScanWidget'
import IntelligenceWidgets from '@/components/dashboard/IntelligenceWidgets'
import RecentScansWidget from '@/components/dashboard/RecentScansWidget'
import ScannerDiscoveryBanner from '@/components/dashboard/ScannerDiscoveryBanner'

// ---------------------------------------------------------------------------
// Helpers & data
// ---------------------------------------------------------------------------

function getGreeting() {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function useTrendingProducts() {
  const [trending, setTrending] = useState<TrendingProduct[]>([])
  const [emergingCount, setEmergingCount] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        // Fetch top 3 trending + check for emerging products in parallel
        const [trendingRes, emergingRes] = await Promise.all([
          fetch('/api/trending?limit=3'),
          fetch('/api/trending?tab=emerging&limit=1'),
        ])
        const trendingData = await trendingRes.json()
        const emergingData = await emergingRes.json()

        setEmergingCount((emergingData.trending ?? []).length)

        const items = (trendingData.trending ?? []).map((t: Record<string, unknown>) => {
          const product = t.product as Record<string, unknown> | null
          const source = t.source as string
          const isOliveYoung = source === 'olive_young'
          const rankPos = t.rank_position as number | null
          const gapScore = t.gap_score as number | null
          const isEmerging = (gapScore ?? 0) > 50

          let signal: string
          if (isEmerging) {
            signal = `Emerging · #${rankPos ?? '?'} in Korea`
          } else if (isOliveYoung && rankPos) {
            signal = `#${rankPos} on Olive Young`
          } else {
            signal = `${source ?? 'Trending'} · ${t.mention_count ?? 0} mentions`
          }

          return {
            id: product?.id ?? t.product_id ?? t.id,
            name: product?.name_en ?? t.source_product_name ?? 'Unknown Product',
            brand: product?.brand_en ?? t.source_product_brand ?? '',
            category: product?.category ?? '',
            trendSignal: signal,
            rating: product?.average_rating ?? null,
            isEmerging,
          }
        })
        setTrending(items)
      } catch {
        setTrending([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { trending, emergingCount, loading }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { user } = useAuth()
  const { trending, emergingCount, loading: trendingLoading } = useTrendingProducts()
  const [relevantTrendingIds, setRelevantTrendingIds] = useState<Set<string>>(new Set())

  const handleRelevantTrendingIds = useCallback((ids: string[]) => {
    setRelevantTrendingIds(new Set(ids))
  }, [])

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

      {/* One-time scanner discovery callout (only shows for users with 0 scans this period) */}
      <ScannerDiscoveryBanner />

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
            <Lightbulb className="w-4 h-4 text-gold" strokeWidth={1.75} />
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

      {/* Intelligence Widgets (Top Ingredients + Seasonal Tip) */}
      <IntelligenceWidgets onRelevantTrendingIds={handleRelevantTrendingIds} />

      {/* Skin Profile */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-base text-white">
            Your Skin Profile
          </h2>
        </div>

        <SkinProfileWidget />
      </section>

      {/* Expiring Products */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" strokeWidth={1.75} />
            <h2 className="font-display font-semibold text-base text-white">
              Expiring Soon
            </h2>
          </div>
          <Link
            href="/tracking"
            className="text-xs text-gold-light font-medium hover:text-gold transition-colors duration-200 flex items-center gap-0.5"
          >
            View all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <ExpiringProductsWidget />
      </section>

      {/* Reformulation Alerts */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <FlaskConical className="w-4 h-4 text-amber-400" strokeWidth={1.75} />
            <h2 className="font-display font-semibold text-base text-white">
              Formula Changes
            </h2>
          </div>
        </div>

        <ReformulationAlertWidget />
      </section>

      {/* Glass Skin Score */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-gold" strokeWidth={1.75} />
            <h2 className="font-display font-semibold text-base text-white">
              Glass Skin Score
            </h2>
          </div>
          <Link
            href="/glass-skin"
            className="text-xs text-gold-light font-medium hover:text-gold transition-colors duration-200 flex items-center gap-0.5"
          >
            Track <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <GlassSkinWidget />
      </section>

      {/* Weather Routine Tips */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <CloudSun className="w-4 h-4 text-sky-400" strokeWidth={1.75} />
            <h2 className="font-display font-semibold text-base text-white">
              Weather & Skincare
            </h2>
          </div>
          <Link
            href="/profile"
            className="text-xs text-gold-light font-medium hover:text-gold transition-colors duration-200 flex items-center gap-0.5"
          >
            Settings <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <WeatherRoutineWidget />
      </section>

      {/* Shelf Scan */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Layers className="w-4 h-4 text-gold" strokeWidth={1.75} />
            <h2 className="font-display font-semibold text-base text-white">
              Collection Analysis
            </h2>
          </div>
          <Link
            href="/shelf-scan"
            className="text-xs text-gold-light font-medium hover:text-gold transition-colors duration-200 flex items-center gap-0.5"
          >
            Scan <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <ShelfScanWidget />
      </section>

      {/* Trending in Korea */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <h2 className="font-display font-semibold text-base text-white">
              Trending in Korea
            </h2>
            {emergingCount > 0 && (
              <Link
                href="/trending"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30 transition-colors"
              >
                <Sparkles className="w-2.5 h-2.5" />
                Emerging
              </Link>
            )}
          </div>
          <Link
            href="/trending"
            className="text-xs text-gold-light font-medium hover:text-gold transition-colors duration-200 flex items-center gap-0.5"
          >
            See all <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        {trendingLoading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-5 h-5 animate-spin text-gold/40" />
          </div>
        ) : trending.length === 0 ? (
          <div className="glass-card p-4 text-center">
            <p className="text-sm text-white/40">No trending products yet. Check back soon!</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {trending.map((product) => (
              <TrendingProductCard
                key={product.id}
                product={product}
                skinRelevant={relevantTrendingIds.has(String(product.id))}
              />
            ))}
          </div>
        )}
      </section>

      {/* Recent Scans */}
      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-base text-white">
            Recent Scans
          </h2>
          <Link
            href="/scan"
            className="text-xs text-gold-light font-medium hover:text-gold transition-colors duration-200 flex items-center gap-0.5"
          >
            Scan <ChevronRight className="w-3 h-3" />
          </Link>
        </div>

        <RecentScansWidget />
      </section>

      {/* Bottom spacer for mobile nav */}
      <div className="h-4" />
    </div>
  )
}
