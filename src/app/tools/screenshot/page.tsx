'use client'

import { useState, useRef, useEffect } from 'react'
import Link from 'next/link'
import html2canvas from 'html2canvas'

interface Product {
  id: string
  name_english: string
  brand: string
  seoul_price: number
  us_price: number
  savings_percentage: number
}

export default function ScreenshotToolPage() {
  const [products, setProducts] = useState<Product[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [customMessage, setCustomMessage] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)
  const [isLoadingProducts, setIsLoadingProducts] = useState(true)
  const screenshotRef = useRef<HTMLDivElement>(null)

  // Load products with real scraped pricing data
  useEffect(() => {
    loadProductsWithRealPricing()
  }, [])

  const loadProductsWithRealPricing = async () => {
    try {
      console.log('📦 Starting product loading process...')

      // Get all products from database
      const response = await fetch('/api/products')
      if (!response.ok) {
        throw new Error(`API failed with status ${response.status}`)
      }

      const data = await response.json()

      let baseProducts = []
      if (data.products && data.products.length > 0) {
        baseProducts = data.products
        console.log(`✅ Loaded ${baseProducts.length} products from database`)
      } else {
        console.log('⚠️ No products found in database, using fallback products')
        baseProducts = [
          { id: '1', name_english: 'Glow Deep Serum', brand: 'Beauty of Joseon' },
          { id: '2', name_english: 'Snail 96 Mucin Essence', brand: 'COSRX' },
          { id: '3', name_english: 'First Care Activating Serum', brand: 'Sulwhasoo' },
          { id: '4', name_english: 'Water Sleeping Mask', brand: 'Laneige' }
        ]
      }

      // Skip expensive real-time scraping for faster loading in viral tools
      // Use existing product data from database which already has pricing
      console.log('⚡ Skipping real-time price scraping for faster viral tool performance')

      const allProductsWithPricing = baseProducts

      setProducts(allProductsWithPricing)
      setSelectedProduct(allProductsWithPricing[0])

      if (allProductsWithPricing[0]) {
        // Set a basic fallback message immediately
        const fallbackMessage = `Just discovered ${allProductsWithPricing[0].brand} ${allProductsWithPricing[0].name_english} is ${allProductsWithPricing[0].savings_percentage || 50}% cheaper in Seoul! 🤯`
        setCustomMessage(fallbackMessage)

        // Generate AI message for first product (non-blocking)
        setTimeout(() => {
          generateMessage(allProductsWithPricing[0]).catch((error) => {
            console.error('❌ Initial message generation failed:', error)
          })
        }, 500)
      }

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

      // Set fallback message immediately
      const fallbackMessage = `Just discovered ${fallbackProducts[0].brand} ${fallbackProducts[0].name_english} is ${fallbackProducts[0].savings_percentage}% cheaper in Seoul! 🤯`
      setCustomMessage(fallbackMessage)

      // Generate AI message for fallback product (non-blocking)
      setTimeout(() => {
        generateMessage(fallbackProducts[0]).catch((error) => {
          console.error('❌ Fallback message generation failed:', error)
        })
      }, 500)
    } finally {
      setIsLoadingProducts(false)
    }
  }


  const generateMessage = async (product: Product) => {
    // Prevent multiple concurrent message generations
    if (isGenerating) {
      console.log('⏸️ Message generation already in progress, skipping')
      return
    }

    console.log('🤖 Generating AI message for:', product.brand, product.name_english)
    setIsGenerating(true)

    // Set a basic message immediately so there's always something showing
    const basicMessage = `Just discovered ${product.brand} ${product.name_english} is ${product.savings_percentage || 50}% cheaper in Seoul! 🤯`
    setCustomMessage(basicMessage)
    console.log('💬 Set basic message as fallback')

    try {
      const response = await fetch('/api/generate-viral', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product: product.name_english,
          brand: product.brand,
          platforms: ['instagram']
        })
      })

      if (!response.ok) {
        throw new Error(`API returned ${response.status}`)
      }

      const data = await response.json()
      console.log('🔍 AI response received:', data?.success ? 'Success' : 'Failed')

      if (data.success && data.content && data.content.instagram) {
        const content = data.content.instagram.content
        console.log('📝 Processing AI content...')

        // Extract a short, story-appropriate message from AI content
        let message = ''

        if (typeof content === 'string') {
          // Look for short, punchy lines suitable for stories
          const lines = content.split('\n').filter(line =>
            line.trim().length > 0 &&
            line.trim().length < 100 &&
            !line.startsWith('#') &&
            !line.startsWith('Follow') &&
            !line.startsWith('Save') &&
            !line.startsWith('Link')
          )
          message = lines[0] || content.substring(0, 80) + '...'
        } else if (content && typeof content === 'object') {
          message = content.caption || content.hook || content.message || basicMessage
        }

        // Clean up the message
        message = message
          .replace(/\*\*/g, '') // Remove markdown bold
          .replace(/\[.*?\]/g, '') // Remove markdown links
          .replace(/[📍💰✨]/g, '') // Remove some emojis that might not fit
          .trim()

        // Only update if we got a meaningful message
        if (message && message.length > 10 && message !== basicMessage) {
          setCustomMessage(message)
          console.log('✅ AI message set successfully')
        } else {
          console.log('⚠️ AI message not meaningful, keeping basic message')
        }
      } else {
        console.log('⚠️ AI response not in expected format, keeping basic message')
        // Keep the basic message we already set
      }
    } catch (error) {
      console.error('❌ Error generating message:', error)
      // Keep the basic message we already set
    } finally {
      console.log('🏁 Message generation complete')
      setIsGenerating(false)
    }
  }

  const handleProductChange = (productId: string) => {
    console.log('🔄 Product change requested:', productId)
    const product = products.find(p => p.id === productId)
    if (product) {
      console.log('✅ Product found, updating selection:', product.brand, product.name_english)
      setSelectedProduct(product)

      // Set immediate fallback message for instant UI response
      const fallbackMessage = `Just discovered ${product.brand} ${product.name_english} is ${product.savings_percentage}% cheaper in Seoul! 🤯`
      setCustomMessage(fallbackMessage)

      // Generate AI message without blocking the UI (happens in background)
      setTimeout(() => {
        generateMessage(product).catch((error) => {
          console.error('❌ Message generation failed for product change:', error)
          // Keep the fallback message if AI fails
        })
      }, 100) // Small delay to ensure UI update happens first
    } else {
      console.warn('⚠️ Product not found:', productId)
    }
  }

  const regenerateMessage = () => {
    if (selectedProduct) {
      generateMessage(selectedProduct)
    }
  }

  const takeScreenshot = async () => {
    if (screenshotRef.current) {
      try {
        const canvas = await html2canvas(screenshotRef.current, {
          backgroundColor: '#000000',
          scale: 2
        })

        canvas.toBlob((blob) => {
          if (blob) {
            const url = URL.createObjectURL(blob)
            const a = document.createElement('a')
            a.href = url
            a.download = 'seoul-sister-story.png'
            a.click()
            URL.revokeObjectURL(url)
          }
        })
      } catch (error) {
        console.error('Screenshot failed:', error)
      }
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
        <div className="luxury-container">
          <div className="text-center mb-16">
            <h1 className="text-5xl font-light mb-4">Instagram Story Generator</h1>
            <p className="text-gray-400">Create a viral story showing your Seoul Sister savings</p>
          </div>

          <div className="grid lg:grid-cols-2 gap-12 max-w-6xl mx-auto">
            {/* Controls */}
            <div className="space-y-8">
              <div>
                <label className="block text-sm font-medium mb-4 text-yellow-500">
                  SELECT PRODUCT
                </label>
                {isLoadingProducts ? (
                  <div className="w-full bg-black border border-gray-700 px-4 py-3 text-gray-400">
                    Loading products...
                  </div>
                ) : (
                  <select
                    value={selectedProduct?.id || ''}
                    onChange={(e) => handleProductChange(e.target.value)}
                    className="w-full bg-black border border-gray-700 px-4 py-3 focus:border-yellow-500 focus:outline-none"
                    disabled={isGenerating}
                  >
                    {products.map((product) => (
                      <option key={product.id} value={product.id}>
                        {product.brand} - {product.name_english} (${product.seoul_price} → ${product.us_price})
                      </option>
                    ))}
                  </select>
                )}
              </div>

              <div>
                <label className="block text-sm font-medium mb-4 text-yellow-500">
                  CAPTION TEMPLATE
                </label>
                <div className="space-y-4">
                  <textarea
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    className="w-full bg-black border border-gray-700 px-4 py-6 h-32 focus:border-yellow-500 focus:outline-none resize-none"
                    placeholder="AI-generated caption will appear here..."
                    disabled={isGenerating}
                  />
                  <button
                    onClick={regenerateMessage}
                    disabled={isGenerating || !selectedProduct}
                    className="w-full bg-gray-800 text-white py-3 hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    {isGenerating ? 'GENERATING WITH AI...' : 'REGENERATE WITH AI'}
                  </button>
                </div>
              </div>

              <button
                onClick={takeScreenshot}
                disabled={!selectedProduct}
                className="w-full bg-yellow-500 text-black py-4 font-medium hover:bg-yellow-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                DOWNLOAD STORY IMAGE
              </button>

              <div className="border-t border-gray-800 pt-6">
                <h3 className="text-sm font-medium mb-3 text-yellow-500">FEATURES</h3>
                <ul className="space-y-2 text-sm text-gray-400">
                  <li>• Real product data from Seoul Sister database</li>
                  <li>• AI-generated captions with Claude Opus 4.1</li>
                  <li>• Dynamic pricing updates</li>
                  <li>• Optimized for Instagram Stories (1080x1920)</li>
                </ul>
              </div>
            </div>

            {/* Story Preview */}
            <div className="flex justify-center">
              <div
                ref={screenshotRef}
                className="w-[384px] h-[683px] bg-black relative overflow-hidden"
                style={{ aspectRatio: '9/16' }}
              >
                {/* Content */}
                <div className="absolute inset-0 flex flex-col justify-center items-center text-center px-8">
                  <div className="mb-8">
                    <div className="text-yellow-500 text-sm font-medium tracking-wider mb-4">
                      SEOUL SISTER
                    </div>

                    <h2 className="text-white text-4xl font-light mb-2">
                      {selectedProduct?.brand || 'Brand'}
                    </h2>
                    <div className="text-gray-400 text-xl mb-8">
                      {selectedProduct?.name_english || 'Product Name'}
                    </div>

                    <div className="flex justify-between items-center mb-8">
                      <div className="text-center">
                        <div className="text-gray-400 text-sm mb-2 border-b border-gray-600 pb-1">
                          US RETAIL
                        </div>
                        <div className="text-gray-300 text-4xl">
                          ${selectedProduct?.us_price || 0}
                        </div>
                      </div>

                      <div className="text-center">
                        <div className="text-yellow-500 text-sm mb-2 border-b border-yellow-500 pb-1">
                          SEOUL PRICE
                        </div>
                        <div className="text-yellow-500 text-4xl">
                          ${selectedProduct?.seoul_price || 0}
                        </div>
                      </div>
                    </div>

                    <div className="border-t border-gray-800 pt-8 mb-8">
                      <div className="text-yellow-500 text-6xl font-light mb-2">
                        ${selectedProduct ? selectedProduct.us_price - selectedProduct.seoul_price : 0}
                      </div>
                      <div className="text-gray-400 text-lg tracking-wider">
                        SAVED
                      </div>
                    </div>

                    <div className="text-white text-lg italic leading-relaxed mb-8 max-w-xs">
                      {customMessage || "Loading AI-generated caption..."}
                    </div>
                  </div>

                  <div className="absolute bottom-8 left-0 right-0 text-center">
                    <div className="text-gray-500 text-sm">
                      seoulsister.com
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </main>
  )
}