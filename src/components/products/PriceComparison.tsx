'use client'

import { useState, useEffect } from 'react'
import { DollarSign, ExternalLink, TrendingDown, ShoppingBag, Loader2, Clock } from 'lucide-react'

interface RetailerPrice {
  retailer_name: string
  retailer_url: string
  price_usd: number
  price_krw: number | null
  in_stock: boolean
  trust_score: number | null
  country: string | null
  ships_international: boolean
  is_affiliate: boolean
  last_checked: string
}

interface PriceData {
  product: { name_en: string }
  prices: RetailerPrice[]
  best_deal: RetailerPrice | null
  korea_price_usd: number | null
  us_avg_price: number | null
  savings_pct: number | null
}

interface PriceComparisonProps {
  productId: string
}

export default function PriceComparison({ productId }: PriceComparisonProps) {
  const [data, setData] = useState<PriceData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchPrices() {
      try {
        const res = await fetch(`/api/prices?product_id=${productId}`)
        if (!res.ok) {
          if (res.status === 404) {
            setData(null)
            return
          }
          throw new Error('Failed to fetch prices')
        }
        const json = await res.json()
        setData(json)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load prices')
      } finally {
        setLoading(false)
      }
    }
    fetchPrices()
  }, [productId])

  if (loading) {
    return (
      <div className="glass-card p-4 flex items-center justify-center gap-2">
        <Loader2 className="w-4 h-4 animate-spin text-rose-gold" />
        <span className="text-sm text-seoul-soft">Loading prices...</span>
      </div>
    )
  }

  if (error || !data || data.prices.length === 0) {
    return (
      <div className="glass-card p-4 text-center">
        <DollarSign className="w-6 h-6 text-seoul-soft/40 mx-auto mb-2" />
        <p className="text-sm text-seoul-soft">No price comparison data available yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-seoul-charcoal">
          Price Comparison
        </h3>
        {data.savings_pct !== null && data.savings_pct > 0 && (
          <span className="flex items-center gap-1 badge-pink text-[10px]">
            <TrendingDown className="w-3 h-3" />
            Save up to {data.savings_pct}%
          </span>
        )}
      </div>

      {/* Best deal highlight */}
      {data.best_deal && (
        <div className="glass-card border-rose-gold/30 bg-gradient-to-r from-white/80 to-seoul-blush/20 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-rose-gold font-medium uppercase tracking-wider">Best Price</p>
              <p className="font-display font-bold text-lg text-seoul-charcoal">
                ${data.best_deal.price_usd.toFixed(2)}
              </p>
              <p className="text-xs text-seoul-soft">{data.best_deal.retailer_name}</p>
            </div>
            <a
              href={data.best_deal.retailer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-button-primary text-xs px-4 py-2 flex items-center gap-1.5"
            >
              <ShoppingBag className="w-3.5 h-3.5" />
              View Deal
            </a>
          </div>
        </div>
      )}

      {/* All retailers */}
      <div className="flex flex-col gap-1.5">
        {data.prices.map((price, idx) => {
          const freshness = getPriceFreshness(price.last_checked)
          return (
            <a
              key={idx}
              href={price.retailer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="glass-card p-3 flex items-center justify-between hover:shadow-glass-lg transition-all duration-200 group"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-seoul-pearl flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-seoul-soft" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-medium text-seoul-charcoal">{price.retailer_name}</p>
                  <div className="flex items-center gap-2">
                    {price.country && (
                      <span className="text-[10px] text-seoul-soft">
                        {price.country === 'KR' ? 'Korea' : price.country === 'US' ? 'US' : price.country}
                      </span>
                    )}
                    {!price.in_stock && (
                      <span className="text-[10px] text-red-500 font-medium">Out of Stock</span>
                    )}
                    <span className={`text-[10px] flex items-center gap-0.5 ${freshness.color}`}>
                      <Clock className="w-2.5 h-2.5" />
                      {freshness.label}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <span className={`font-display font-bold text-sm ${
                  idx === 0 ? 'text-green-600' : 'text-seoul-charcoal'
                }`}>
                  ${price.price_usd.toFixed(2)}
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-seoul-soft/40 group-hover:text-rose-gold transition-colors duration-200" />
              </div>
            </a>
          )
        })}
      </div>

      {/* Staleness warning if any price is >7 days old */}
      {data.prices.some(p => getPriceFreshness(p.last_checked).stale) && (
        <p className="text-[10px] text-amber-600/80 flex items-center gap-1 mt-1">
          <Clock className="w-3 h-3" />
          Some prices may be outdated. Prices are refreshed automatically every 6 hours.
        </p>
      )}
    </div>
  )
}

function getPriceFreshness(lastChecked: string): { label: string; color: string; stale: boolean } {
  const checkedAt = new Date(lastChecked)
  const ageMs = Date.now() - checkedAt.getTime()
  const ageHours = ageMs / (1000 * 60 * 60)
  const ageDays = ageHours / 24

  if (ageHours < 12) {
    return { label: 'Just checked', color: 'text-green-600', stale: false }
  }
  if (ageDays < 1) {
    return { label: 'Today', color: 'text-seoul-soft', stale: false }
  }
  if (ageDays < 3) {
    return { label: `${Math.floor(ageDays)}d ago`, color: 'text-seoul-soft', stale: false }
  }
  if (ageDays < 7) {
    return { label: `${Math.floor(ageDays)}d ago`, color: 'text-amber-500', stale: false }
  }
  return { label: `${Math.floor(ageDays)}d ago`, color: 'text-red-500', stale: true }
}
