'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

interface Product {
  id: string
  name_english: string
  brand: string
  seoul_price: number
  us_price: number
  savings_percentage: number
}

export default function CopyGeneratorPage() {
  const [platform, setPlatform] = useState('tiktok')
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [generatedCopy, setGeneratedCopy] = useState('')
  const [copied, setCopied] = useState(false)
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)

  // Load products with real scraped pricing data
  useEffect(() => {
    loadProductsWithRealPricing()
  }, [])

  const loadProductsWithRealPricing = async () => {
    try {
      console.log('Loading products with real-time pricing...')

      // Get base products from database
      const response = await fetch('/api/products?featured=true')
      const data = await response.json()

      let baseProducts = []
      if (data.products && data.products.length > 0) {
        baseProducts = data.products
      } else {
        // Fallback products if API fails
        baseProducts = [
          { id: '1', name_english: 'Glow Deep Serum', brand: 'Beauty of Joseon' },
          { id: '2', name_english: 'Snail 96 Mucin Essence', brand: 'COSRX' },
          { id: '3', name_english: 'First Care Activating Serum', brand: 'Sulwhasoo' },
          { id: '4', name_english: 'Water Sleeping Mask', brand: 'Laneige' }
        ]
      }

      // Enhance products with real-time scraped pricing
      const enhancedProducts = await Promise.all(
        baseProducts.slice(0, 4).map(async (product) => {
          try {
            console.log(`Scraping real prices for ${product.brand} ${product.name_english}...`)

            const scrapeResponse = await fetch('/api/scrape-v2', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                productName: product.name_english,
                brand: product.brand,
                autoUpdate: false
              })
            })

            const scrapeData = await scrapeResponse.json()

            if (scrapeData.success && scrapeData.analysis) {
              return {
                ...product,
                seoul_price: scrapeData.analysis.avgKoreanPrice,
                us_price: scrapeData.analysis.avgUSPrice,
                savings_percentage: scrapeData.analysis.savingsPercentage,
                real_scraped_data: scrapeData.prices // Store raw scraped data
              }
            } else {
              // Use existing product data if scraping fails
              return product
            }
          } catch (error) {
            console.warn(`Failed to scrape prices for ${product.name_english}:`, error)
            return product
          }
        })
      )

      setProducts(enhancedProducts)
      setSelectedProduct(enhancedProducts[0])

    } catch (error) {
      console.error('Error loading products with real pricing:', error)

      // Final fallback with basic products
      const fallbackProducts = [
        {
          id: '1', name_english: 'Glow Deep Serum', brand: 'Beauty of Joseon',
          seoul_price: 8.5, us_price: 45, savings_percentage: 82
        },
        {
          id: '2', name_english: 'Snail 96 Mucin Essence', brand: 'COSRX',
          seoul_price: 12, us_price: 89, savings_percentage: 74
        },
        {
          id: '3', name_english: 'First Care Activating Serum', brand: 'Sulwhasoo',
          seoul_price: 28, us_price: 94, savings_percentage: 70
        },
        {
          id: '4', name_english: 'Water Sleeping Mask', brand: 'Laneige',
          seoul_price: 12, us_price: 34, savings_percentage: 65
        }
      ]

      setProducts(fallbackProducts)
      setSelectedProduct(fallbackProducts[0])
    } finally {
      setIsLoadingProducts(false)
    }
  }

  const generateCopy = async () => {
    if (!selectedProduct) return

    setIsGenerating(true)
    setGeneratedCopy('')

    try {
      const response = await fetch('/api/generate-viral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: selectedProduct.name_english,
          brand: selectedProduct.brand,
          platforms: [platform],
          prices: {
            seoul: selectedProduct.seoul_price,
            us: selectedProduct.us_price,
            savings: selectedProduct.savings_percentage
          }
        })
      })

      const data = await response.json()

      if (data.success && data.content[platform]) {
        // Extract the content from AI response
        const content = data.content[platform].content

        // If it's AI-generated, parse and format it
        if (typeof content === 'string') {
          // Extract the most relevant part based on platform
          let formattedContent = ''

          if (platform === 'tiktok') {
            // Extract hook and main content
            const hookMatch = content.match(/hook[:\s]+(.+?)(?:\n|$)/i)
            const scriptMatch = content.match(/script[:\s]+([\s\S]+?)(?:hashtag|$)/i)
            const hashtagMatch = content.match(/hashtag[s:\s]+([\s\S]+?)$/i)

            formattedContent = hookMatch ? hookMatch[1] + '\n\n' : ''
            if (scriptMatch) formattedContent += scriptMatch[1].trim() + '\n\n'
            if (hashtagMatch) formattedContent += hashtagMatch[1].trim()
          } else {
            // For other platforms, use the full content
            formattedContent = content
          }

          setGeneratedCopy(formattedContent || content)
        } else if (content && typeof content === 'object') {
          // Handle structured content
          if (platform === 'tiktok' && content.hook) {
            setGeneratedCopy(`${content.hook}\n\n${content.script || ''}\n\n${content.hashtags || ''}`)
          } else if (platform === 'instagram' && Array.isArray(content.carousel)) {
            setGeneratedCopy(content.caption || content.carousel.join('\n\n'))
          } else if (platform === 'twitter' && Array.isArray(content.tweets)) {
            setGeneratedCopy(content.tweets[0] || '')
          } else {
            setGeneratedCopy(JSON.stringify(content, null, 2))
          }
        }
      } else {
        // Fallback to template with real scraped prices if AI fails
        setGeneratedCopy(`STOP paying US prices for K-beauty! 🛑

${selectedProduct.brand} ${selectedProduct.name_english}:
❌ US Retail: $${selectedProduct.us_price}
✅ Seoul Sister: $${selectedProduct.seoul_price}

Save ${selectedProduct.savings_percentage}% with Seoul Sister 💅

#KBeauty #SeoulPrices #SkincareAddict`)
      }
    } catch (error) {
      console.error('Error generating copy:', error)
      // Fallback content with real prices
      setGeneratedCopy(`Just discovered ${selectedProduct.brand} ${selectedProduct.name_english} is ${selectedProduct.savings_percentage}% cheaper in Seoul!

Seoul Sister gets you the real Seoul price. No cap.

#KBeauty #SeoulSister #BeautyScam`)
    } finally {
      setIsGenerating(false)
    }
  }

  const copyToClipboard = () => {
    navigator.clipboard.writeText(generatedCopy)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleProductChange = (productId: string) => {
    const product = products.find(p => p.id === productId)
    if (product) {
      setSelectedProduct(product)
    }
  }

  return (
    <main className="min-h-screen bg-black text-white">
      <nav className="navbar-luxury">
        <div className="luxury-container flex justify-between items-center">
          <Link href="/" className="text-2xl font-light tracking-widest">
            Seoul Sister
          </Link>
          <Link href="/" className="text-sm hover:text-yellow-500 transition-colors">
            Back to Home
          </Link>
        </div>
      </nav>

      <div className="pt-32 pb-20">
        <div className="luxury-container max-w-4xl">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-light mb-4">Viral Copy Generator</h1>
            <p className="text-gray-400">Generate platform-optimized content for your Seoul Sister savings</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12">
            {/* Controls */}
            <div className="space-y-8">
              <div>
                <label className="block text-sm font-medium mb-4 text-yellow-500">
                  SELECT PLATFORM
                </label>
                <div className="grid grid-cols-2 gap-4">
                  {['tiktok', 'instagram', 'twitter', 'pinterest'].map((p) => (
                    <button
                      key={p}
                      onClick={() => setPlatform(p)}
                      className={`py-3 px-4 border transition-all ${
                        platform === p
                          ? 'bg-yellow-500 text-black border-yellow-500'
                          : 'border-gray-700 hover:border-yellow-500'
                      }`}
                    >
                      {p.charAt(0).toUpperCase() + p.slice(1)}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-4 text-yellow-500">
                  SELECT PRODUCT
                </label>
                <select
                  value={selectedProduct?.id || ''}
                  onChange={(e) => handleProductChange(e.target.value)}
                  className="w-full bg-black border border-gray-700 px-4 py-3 focus:border-yellow-500 focus:outline-none"
                  disabled={isLoadingProducts}
                >
                  {products.map((product) => (
                    <option key={product.id} value={product.id}>
                      {product.brand} - {product.name_english} (${product.seoul_price} → ${product.us_price})
                    </option>
                  ))}
                </select>
                {isLoadingProducts && (
                  <p className="text-sm text-gray-400 mt-2">Loading products with real-time pricing...</p>
                )}
              </div>

              <button
                onClick={generateCopy}
                disabled={isGenerating || isLoadingProducts || !selectedProduct}
                className="w-full bg-yellow-500 text-black py-4 font-medium hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoadingProducts ? 'LOADING PRODUCTS...' : isGenerating ? 'GENERATING WITH AI...' : 'GENERATE VIRAL COPY'}
              </button>
            </div>

            {/* Generated Copy */}
            <div className="space-y-6">
              <div>
                <label className="block text-sm font-medium mb-4 text-yellow-500">
                  GENERATED COPY
                </label>
                <div className="bg-gray-900 border border-gray-700 p-6 min-h-[300px]">
                  {isGenerating ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="animate-pulse text-gray-400">Creating viral content with Claude AI...</div>
                    </div>
                  ) : generatedCopy ? (
                    <pre className="whitespace-pre-wrap text-sm font-mono">{generatedCopy}</pre>
                  ) : (
                    <p className="text-gray-500 italic">
                      Click "Generate Viral Copy" to create AI-powered content
                    </p>
                  )}
                </div>
              </div>

              {generatedCopy && (
                <button
                  onClick={copyToClipboard}
                  className="w-full border border-yellow-500 text-yellow-500 py-3 hover:bg-yellow-500 hover:text-black transition-all"
                >
                  {copied ? '✓ COPIED!' : 'COPY TO CLIPBOARD'}
                </button>
              )}

              <div className="border-t border-gray-800 pt-6">
                <h3 className="text-sm font-medium mb-3 text-yellow-500">PRO TIPS</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>• Post between 6-10am or 7-11pm for best engagement</li>
                  <li>• Add trending audio to boost visibility</li>
                  <li>• Show the price comparison visually in your video</li>
                  <li>• Use Claude AI for unique, authentic content every time</li>
                </ul>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}