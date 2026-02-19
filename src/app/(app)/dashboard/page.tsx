'use client'

import { useMemo, useState, useEffect } from 'react'
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
import EmptyState from '@/components/ui/EmptyState'
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
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    async function load() {
      try {
        const res = await fetch('/api/trending?limit=3')
        const data = await res.json()
        const items = (data.trending ?? []).map((t: Record<string, unknown>) => ({
          id: (t.product as Record<string, unknown>)?.id ?? t.product_id,
          name: (t.product as Record<string, unknown>)?.name_en ?? 'Unknown Product',
          brand: (t.product as Record<string, unknown>)?.brand_en ?? '',
          category: (t.product as Record<string, unknown>)?.category ?? '',
          trendSignal: `${t.source ?? 'Trending'} · ${t.mention_count ?? 0} mentions`,
          rating: (t.product as Record<string, unknown>)?.average_rating ?? null,
        }))
        setTrending(items)
      } catch {
        setTrending([])
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [])

  return { trending, loading }
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function DashboardPage() {
  const { user } = useAuth()
  const { trending, loading: trendingLoading } = useTrendingProducts()

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
              <TrendingProductCard key={product.id} product={product} />
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
