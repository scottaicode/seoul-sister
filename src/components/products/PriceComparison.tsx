'use client'

import { useState, useEffect } from 'react'
import { DollarSign, ExternalLink, ShoppingBag, Loader2, Clock } from 'lucide-react'
import Link from 'next/link'

interface RetailerPrice {
  retailer_name: string
  retailer_url: string
  price_usd: number
  price_krw: number | null
  in_stock: boolean
  trust_score: number | null
  country: string | null
  ships_international: boolean
  ships_to_us: boolean | null
  orderable_here: boolean
  is_affiliate: boolean
  last_checked: string
}

interface PriceData {
  product: { name_en: string; brand_en: string | null }
  prices: RetailerPrice[]
  best_deal: RetailerPrice | null
  shopper_in_us: boolean
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
        <span className="text-sm text-white/40">Loading prices...</span>
      </div>
    )
  }

  if (error || !data || data.prices.length === 0) {
    return (
      <div className="glass-card p-4 text-center">
        <DollarSign className="w-6 h-6 text-white/30 mx-auto mb-2" />
        <p className="text-sm text-white/40">No price comparison data available yet.</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-sm text-white">
          Where to buy
        </h3>
      </div>

      {/* Best deal highlight */}
      {data.best_deal && (
        <div className="glass-card border-rose-gold/30 bg-gradient-to-r from-gold/10 to-gold/5 p-3">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-[10px] text-gold font-medium uppercase tracking-wider">Recommended store that ships to you</p>
              <p className="font-display font-bold text-lg text-white">
                ${data.best_deal.price_usd.toFixed(2)}
              </p>
              <p className="text-xs text-white/50">{data.best_deal.retailer_name}</p>
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
                <div className="w-8 h-8 rounded-lg bg-white/10 flex items-center justify-center">
                  <ShoppingBag className="w-4 h-4 text-white/50" strokeWidth={1.5} />
                </div>
                <div>
                  <p className="text-sm font-medium text-white">{price.retailer_name}</p>
                  <div className="flex items-center gap-2">
                    {price.country && (
                      <span className="text-[10px] text-white/40">
                        {price.country === 'KR' ? 'Korea' : price.country === 'US' ? 'US' : price.country}
                      </span>
                    )}
                    {!price.in_stock && (
                      <span className="text-[10px] text-red-500 font-medium">Out of Stock</span>
                    )}
                    {!price.orderable_here && (
                      <span className="text-[10px] text-amber-500 font-medium">
                        International price · doesn&apos;t ship to the US
                      </span>
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
                  price.orderable_here && data.best_deal && price.retailer_url === data.best_deal.retailer_url
                    ? 'text-emerald-400'
                    : price.orderable_here ? 'text-white' : 'text-white/40'
                }`}>
                  ${price.price_usd.toFixed(2)}
                </span>
                <ExternalLink className="w-3.5 h-3.5 text-white/20 group-hover:text-gold transition-colors duration-200" />
              </div>
            </a>
          )
        })}
      </div>

      {/* A US shopper with only international listings still needs a way to buy.
          Where to get it in the US is a judgment (the brand may not be at Olive
          Young US at all), so it goes to Yuri rather than to a guessed link. */}
      {data.shopper_in_us && !data.prices.some(p => p.orderable_here) && (
        <Link
          href={`/yuri?ask=${encodeURIComponent(`Where can I buy ${data.product.brand_en ?? ''} ${data.product.name_en} in the US?`.replace(/\s+/g, ' '))}`}
          className="text-xs text-gold hover:underline flex items-center gap-1"
        >
          <ExternalLink className="w-3 h-3" />
          None of these ship to the US. Ask Yuri where to buy it
        </Link>
      )}

      {/* Staleness warning if any price is >7 days old */}
      {data.prices.some(p => getPriceFreshness(p.last_checked).stale) && (
        <p className="text-[10px] text-amber-600/80 flex items-center gap-1 mt-1">
          <Clock className="w-3 h-3" />
          Some prices may be outdated. Each price shows when we last checked it.
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
    return { label: 'Just checked', color: 'text-emerald-400', stale: false }
  }
  if (ageDays < 1) {
    return { label: 'Today', color: 'text-white/40', stale: false }
  }
  if (ageDays < 3) {
    return { label: `${Math.floor(ageDays)}d ago`, color: 'text-white/40', stale: false }
  }
  if (ageDays < 7) {
    return { label: `${Math.floor(ageDays)}d ago`, color: 'text-amber-500', stale: false }
  }
  return { label: `${Math.floor(ageDays)}d ago`, color: 'text-red-500', stale: true }
}
