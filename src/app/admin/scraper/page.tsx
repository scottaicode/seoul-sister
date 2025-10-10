'use client'

import { useState } from 'react'
import Link from 'next/link'

interface PriceComparison {
  product: string
  brand: string
  prices: {
    us: {
      average: number | null
      sephora: number | null
      ulta: number | null
    }
    korea: {
      average: number | null
      seoul: number | null
      oliveyoung: number | null
      yesstyle: number | null
    }
    savings: {
      amount: number | null
      percentage: number
    }
  }
  timestamp: string
}

export default function ScraperDashboard() {
  const [productName, setProductName] = useState('')
  const [brand, setBrand] = useState('')
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<PriceComparison | null>(null)
  const [recentScrapings, setRecentScrapings] = useState<any[]>([])

  // Popular products for quick scraping
  const popularProducts = [
    { brand: 'Sulwhasoo', name: 'First Care Activating Serum' },
    { brand: 'COSRX', name: 'Snail 96 Mucin Essence' },
    { brand: 'Laneige', name: 'Water Sleeping Mask' },
    { brand: 'Beauty of Joseon', name: 'Glow Deep Serum' },
    { brand: 'Innisfree', name: 'Green Tea Seed Serum' },
    { brand: 'Etude House', name: 'SoonJung pH 5.5 Relief Toner' }
  ]

  async function handleScrape() {
    if (!productName || !brand) {
      alert('Please enter both product name and brand')
      return
    }

    setLoading(true)
    setResults(null)

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName, brand })
      })

      const data = await response.json()
      if (data.success) {
        setResults(data)
      } else {
        alert('Failed to scrape prices. Please try again.')
      }
    } catch (error) {
      console.error('Scraping error:', error)
      alert('An error occurred while scraping prices.')
    } finally {
      setLoading(false)
    }
  }

  async function quickScrape(product: { brand: string, name: string }) {
    setProductName(product.name)
    setBrand(product.brand)

    // Trigger scrape automatically
    setLoading(true)
    setResults(null)

    try {
      const response = await fetch('/api/scrape', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productName: product.name, brand: product.brand })
      })

      const data = await response.json()
      if (data.success) {
        setResults(data)
      }
    } catch (error) {
      console.error('Scraping error:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      {/* Header with navigation */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-light text-[#D4A574] tracking-wider">
            PRICE SCRAPER
          </h1>
          <p className="text-sm text-[#D4A574]/60 mt-1">
            Real-time price comparison across US and Korean retailers
          </p>
        </div>
        <Link
          href="/admin"
          className="px-6 py-2 border border-[#D4A574] text-[#D4A574] hover:bg-[#D4A574] hover:text-black transition-all duration-300 text-sm tracking-wider"
        >
          BACK TO DASHBOARD
        </Link>
      </div>

      {/* Scraping Form */}
      <div className="bg-zinc-900/50 border border-[#D4A574]/20 rounded-lg p-8 mb-8">
        <h2 className="text-xl font-light text-[#D4A574] tracking-wider mb-6">
          SCRAPE NEW PRODUCT
        </h2>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
          <div>
            <label className="block text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">
              Brand Name
            </label>
            <input
              type="text"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              placeholder="e.g., COSRX"
              className="w-full bg-black border border-[#D4A574]/20 text-white px-4 py-3 rounded focus:border-[#D4A574] outline-none"
            />
          </div>

          <div>
            <label className="block text-xs text-[#D4A574]/60 uppercase tracking-wider mb-2">
              Product Name
            </label>
            <input
              type="text"
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
              placeholder="e.g., Snail 96 Mucin Essence"
              className="w-full bg-black border border-[#D4A574]/20 text-white px-4 py-3 rounded focus:border-[#D4A574] outline-none"
            />
          </div>

          <div className="flex items-end">
            <button
              onClick={handleScrape}
              disabled={loading}
              className={`w-full px-6 py-3 ${
                loading
                  ? 'bg-[#D4A574]/20 text-[#D4A574]/40 cursor-not-allowed'
                  : 'bg-[#D4A574] text-black hover:bg-[#D4A574]/80'
              } transition-all duration-300 text-sm tracking-wider font-medium rounded`}
            >
              {loading ? 'SCRAPING...' : 'SCRAPE PRICES'}
            </button>
          </div>
        </div>

        {/* Quick Scrape Buttons */}
        <div className="border-t border-[#D4A574]/10 pt-6">
          <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider mb-3">
            Quick Scrape Popular Products
          </p>
          <div className="flex flex-wrap gap-2">
            {popularProducts.map((product) => (
              <button
                key={`${product.brand}-${product.name}`}
                onClick={() => quickScrape(product)}
                className="px-4 py-2 bg-black border border-[#D4A574]/20 text-[#D4A574]/80 hover:border-[#D4A574] hover:text-[#D4A574] transition-all duration-300 text-xs rounded"
              >
                {product.brand} - {product.name}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Results Display */}
      {results && (
        <div className="bg-zinc-900/50 border border-[#D4A574]/20 rounded-lg p-8 mb-8">
          <h2 className="text-xl font-light text-[#D4A574] tracking-wider mb-6">
            PRICE COMPARISON RESULTS
          </h2>

          <div className="mb-6">
            <h3 className="text-lg text-white mb-2">
              {results.brand} - {results.product}
            </h3>
            <p className="text-xs text-[#D4A574]/40">
              Scraped at {new Date(results.timestamp).toLocaleString()}
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* US Prices */}
            <div className="bg-black/50 border border-red-500/20 p-6 rounded">
              <h4 className="text-sm text-red-400 uppercase tracking-wider mb-4">
                US RETAIL PRICES
              </h4>
              <div className="space-y-2">
                {results.prices.us.sephora && (
                  <div className="flex justify-between">
                    <span className="text-white/60">Sephora</span>
                    <span className="text-white font-mono">${results.prices.us.sephora}</span>
                  </div>
                )}
                {results.prices.us.ulta && (
                  <div className="flex justify-between">
                    <span className="text-white/60">Ulta</span>
                    <span className="text-white font-mono">${results.prices.us.ulta}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-red-500/20">
                  <div className="flex justify-between">
                    <span className="text-red-400 font-medium">Average</span>
                    <span className="text-red-400 font-mono font-bold">
                      ${results.prices.us.average || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Korean Prices */}
            <div className="bg-black/50 border border-green-500/20 p-6 rounded">
              <h4 className="text-sm text-green-400 uppercase tracking-wider mb-4">
                KOREAN PRICES
              </h4>
              <div className="space-y-2">
                {results.prices.korea.seoul && (
                  <div className="flex justify-between">
                    <span className="text-white/60">Seoul Street</span>
                    <span className="text-white font-mono">${results.prices.korea.seoul}</span>
                  </div>
                )}
                {results.prices.korea.oliveyoung && (
                  <div className="flex justify-between">
                    <span className="text-white/60">Olive Young</span>
                    <span className="text-white font-mono">${results.prices.korea.oliveyoung}</span>
                  </div>
                )}
                {results.prices.korea.yesstyle && (
                  <div className="flex justify-between">
                    <span className="text-white/60">YesStyle</span>
                    <span className="text-white font-mono">${results.prices.korea.yesstyle}</span>
                  </div>
                )}
                <div className="pt-2 border-t border-green-500/20">
                  <div className="flex justify-between">
                    <span className="text-green-400 font-medium">Average</span>
                    <span className="text-green-400 font-mono font-bold">
                      ${results.prices.korea.average || 'N/A'}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Savings */}
            <div className="bg-gradient-to-br from-[#D4A574]/20 to-[#D4A574]/10 border border-[#D4A574]/30 p-6 rounded">
              <h4 className="text-sm text-[#D4A574] uppercase tracking-wider mb-4">
                YOUR SAVINGS
              </h4>
              <div className="space-y-4">
                <div>
                  <p className="text-3xl font-light text-white">
                    {results.prices.savings.percentage}%
                  </p>
                  <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider mt-1">
                    Percentage Saved
                  </p>
                </div>
                {results.prices.savings.amount && (
                  <div>
                    <p className="text-2xl font-light text-[#D4A574]">
                      ${results.prices.savings.amount.toFixed(2)}
                    </p>
                    <p className="text-xs text-[#D4A574]/60 uppercase tracking-wider mt-1">
                      Amount Saved
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-4 mt-6">
            <button className="px-6 py-2 bg-[#D4A574] text-black hover:bg-[#D4A574]/80 transition-all duration-300 text-sm tracking-wider font-medium">
              ADD TO INVENTORY
            </button>
            <button className="px-6 py-2 border border-[#D4A574] text-[#D4A574] hover:bg-[#D4A574] hover:text-black transition-all duration-300 text-sm tracking-wider">
              UPDATE EXISTING PRODUCT
            </button>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="bg-zinc-900/50 border border-[#D4A574]/20 rounded-lg p-6">
        <h3 className="text-sm text-[#D4A574] uppercase tracking-wider mb-3">
          How It Works
        </h3>
        <div className="text-sm text-white/60 space-y-2">
          <p>• Automatically scrapes prices from Sephora, Ulta, YesStyle, and Korean retailers</p>
          <p>• Calculates average prices and savings percentage in real-time</p>
          <p>• Updates database with latest pricing information</p>
          <p>• Helps identify the best arbitrage opportunities</p>
        </div>
      </div>
    </div>
  )
}