'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ViralScreenshotGenerator from '../components/ViralScreenshotGenerator'
import ViralCopyGenerator from '../components/ViralCopyGenerator'
import OrderUnlockSystem from '../components/OrderUnlockSystem'

interface Product {
  id: string
  name_english: string
  brand: string
  seoul_price: number
  us_price: number
  savings_percentage: number
  image_url: string
  category: string
}

const featuredProducts: Product[] = [
  {
    id: '1',
    name_english: 'First Care Activating Serum',
    brand: 'Sulwhasoo',
    seoul_price: 28.00,
    us_price: 94.00,
    savings_percentage: 70.21,
    image_url: 'https://images.unsplash.com/photo-1617897094665-d019c0ac14f5?w=400&h=400&fit=crop',
    category: 'Serum'
  },
  {
    id: '2',
    name_english: 'Glow Deep Serum',
    brand: 'Beauty of Joseon',
    seoul_price: 8.00,
    us_price: 45.00,
    savings_percentage: 82.22,
    image_url: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=400&h=400&fit=crop',
    category: 'Serum'
  },
  {
    id: '3',
    name_english: 'Snail 96 Mucin Power Essence',
    brand: 'COSRX',
    seoul_price: 23.00,
    us_price: 89.00,
    savings_percentage: 74.16,
    image_url: 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=400&h=400&fit=crop',
    category: 'Essence'
  },
  {
    id: '4',
    name_english: 'Water Sleeping Mask',
    brand: 'Laneige',
    seoul_price: 12.00,
    us_price: 34.00,
    savings_percentage: 64.71,
    image_url: 'https://images.unsplash.com/photo-1611930022073-b7a4ba5fcccd?w=400&h=400&fit=crop',
    category: 'Mask'
  }
]

export default function HomePage() {
  const [currentProductIndex, setCurrentProductIndex] = useState(0)
  const [showViralGenerator, setShowViralGenerator] = useState(false)
  const [showCopyGenerator, setShowCopyGenerator] = useState(false)
  const [showOrderUnlock, setShowOrderUnlock] = useState(false)
  const [hasFirstOrder, setHasFirstOrder] = useState(false)
  const [hoveredProduct, setHoveredProduct] = useState<string | null>(null)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentProductIndex((prev) => (prev + 1) % featuredProducts.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const currentProduct = featuredProducts[currentProductIndex]
  const savings = currentProduct.us_price - currentProduct.seoul_price

  const handleScreenshotGenerated = (imageDataUrl: string) => {
    const link = document.createElement('a')
    link.download = 'seoul-sister-savings.png'
    link.href = imageDataUrl
    link.click()
    alert('Your viral screenshot is ready! Share it on Instagram Stories to expose the beauty industry markup! 👑✨')
  }

  const handleCopyGenerated = (copies: any[]) => {
    console.log('Generated viral copies:', copies)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'viral_copy_generated', {
        product_name: currentProduct.name_english,
        copies_count: copies.length
      });
    }
  }

  const handleOrderUnlock = (unlockData: any) => {
    console.log('Order unlocked:', unlockData)
    if (typeof window !== 'undefined' && (window as any).gtag) {
      (window as any).gtag('event', 'order_unlocked', {
        unlock_status: unlockData.unlockStatus,
        discount_earned: unlockData.nextOrderDiscount
      });
    }
  }

  useEffect(() => {
    const firstOrderDemo = localStorage.getItem('seoul-sister-first-order');
    if (firstOrderDemo) {
      setHasFirstOrder(true);
    }
  }, [])

  return (
    <main className="min-h-screen bg-seoul-pearl">
      {/* Premium Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 py-20 overflow-hidden">
        {/* Luxury Background Pattern */}
        <div className="absolute inset-0 bg-gradient-to-br from-seoul-cream via-white to-seoul-rose opacity-60"></div>
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-seoul-gold opacity-10 rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-seoul-gold-dark opacity-10 rounded-full filter blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Crown Icon */}
          <div className="flex justify-center mb-6">
            <span className="text-6xl animate-shimmer">👑</span>
          </div>

          {/* Brand Name in Gold */}
          <h1 className="font-luxury text-6xl md:text-8xl mb-8 text-seoul-gold animate-shimmer">
            Seoul Sister
          </h1>

          {/* Luxury Hook */}
          <h2 className="text-2xl md:text-4xl font-medium text-seoul-black mb-4">
            POV: You discover what Seoul girls actually pay
          </h2>

          {/* Premium Tagline */}
          <p className="text-xl md:text-2xl text-gold-gradient font-medium mb-12">
            Luxury K-beauty at Seoul insider prices
          </p>

          {/* Subtle Description */}
          <p className="text-lg text-gray-600 mb-16 max-w-3xl mx-auto leading-relaxed">
            You're about to access the same luxury K-beauty that Seoul insiders get,
            without the 300% US markup. This is premium quality at Seoul reality prices—no compromises, bestie.
          </p>

          {/* Premium CTA Buttons */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <Link href="/signup">
              <button className="group relative bg-seoul-black text-white font-semibold py-5 px-10 rounded-full text-lg shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 overflow-hidden">
                <span className="relative z-10">Access Seoul Insider Prices</span>
                <div className="absolute inset-0 bg-gradient-to-r from-seoul-gold to-seoul-gold-dark transform scale-x-0 group-hover:scale-x-100 transition-transform duration-500 origin-left"></div>
              </button>
            </Link>

            <button
              onClick={() => setShowViralGenerator(true)}
              className="bg-seoul-gold text-seoul-black font-semibold py-5 px-10 rounded-full text-lg luxury-shadow hover:bg-seoul-gold-dark transform hover:scale-105 transition-all duration-300"
            >
              Calculate VIP Savings
            </button>
          </div>

          {/* Trust Indicators */}
          <div className="flex justify-center gap-8 text-sm text-gray-600">
            <span>✓ 15K+ Seoul Sisters</span>
            <span>✓ $2.8M Saved</span>
            <span>✓ 100% Authentic</span>
          </div>
        </div>

        {/* Elegant Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2">
          <div className="w-8 h-12 border-2 border-seoul-gold rounded-full flex justify-center">
            <div className="w-1 h-3 bg-seoul-gold rounded-full mt-2 animate-bounce"></div>
          </div>
        </div>
      </section>

      {/* Luxury Markup Exposed Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <span className="luxury-badge mb-4">EXPOSED</span>
            <h2 className="text-4xl md:text-5xl font-luxury mb-6 text-seoul-black">
              <span className="text-gold-gradient">LUXURY MARKUP</span> EXPOSED
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Enter any US beauty price to discover what Seoul Sisters actually pay.
              No 300% markups. No beauty industry finessing. Just Seoul reality pricing.
            </p>
          </div>

          {/* Interactive Price Calculator */}
          <div className="max-w-2xl mx-auto">
            <div className="bg-gradient-to-br from-seoul-cream to-white rounded-3xl p-10 luxury-shadow">
              <div className="mb-8">
                <label className="block text-sm font-medium text-gray-700 mb-3">
                  Enter US Price (e.g., 94)
                </label>
                <input
                  type="number"
                  placeholder="$94"
                  className="w-full px-6 py-4 text-2xl border-2 border-seoul-gold-light rounded-xl focus:border-seoul-gold focus:outline-none transition-colors"
                  onChange={(e) => {
                    const usPrice = parseFloat(e.target.value) || 94;
                    const seoulPrice = Math.round(usPrice * 0.3);
                    const savings = usPrice - seoulPrice - 25;
                    const savingsPercent = ((savings / usPrice) * 100).toFixed(0);

                    const resultDiv = document.getElementById('price-result');
                    if (resultDiv) {
                      resultDiv.innerHTML = `
                        <div class="text-center space-y-4">
                          <div class="exposed-badge mx-auto">MARKUP EXPOSED</div>
                          <div class="grid grid-cols-2 gap-6">
                            <div>
                              <p class="text-sm text-gray-600 mb-1">US Retail</p>
                              <p class="text-3xl font-bold text-gray-400 line-through">$${usPrice}</p>
                            </div>
                            <div>
                              <p class="text-sm text-gray-600 mb-1">Seoul + Service</p>
                              <p class="text-3xl font-bold text-seoul-gold-dark">$${seoulPrice + 25}</p>
                            </div>
                          </div>
                          <div class="pt-4 border-t-2 border-seoul-gold-light">
                            <p class="text-lg text-gray-600">You Save</p>
                            <p class="text-5xl font-bold text-seoul-gold">${savings > 0 ? '$' + savings : '$0'}</p>
                            <p class="text-lg text-seoul-gold-dark">${savingsPercent}% Less Than US Retail</p>
                          </div>
                        </div>
                      `;
                    }
                  }}
                />
              </div>

              <div id="price-result" className="animate-shimmer">
                <div className="text-center text-gray-400">
                  Enter a price to expose the markup...
                </div>
              </div>

              <button className="w-full mt-8 bg-seoul-black text-white font-semibold py-4 rounded-xl hover:bg-gray-800 transition-colors">
                EXPOSE THE MARKUP
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* VIP Collection Showcase */}
      <section className="py-20 bg-gradient-to-br from-seoul-pearl to-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-luxury mb-6">
              Seoul Sisters' <span className="text-gold-gradient">VIP Collection</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              The same luxury K-beauty brands you see everywhere, but at Seoul reality prices—not US markup madness
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-6">
            {featuredProducts.map((product) => (
              <div
                key={product.id}
                className="bg-white rounded-2xl p-6 luxury-shadow hover:gold-glow transition-all duration-300 transform hover:-translate-y-2"
                onMouseEnter={() => setHoveredProduct(product.id)}
                onMouseLeave={() => setHoveredProduct(null)}
              >
                {/* Exposed Badge */}
                {product.savings_percentage > 70 && (
                  <div className="absolute -top-3 -right-3 z-10">
                    <span className="luxury-badge">EXPOSED {product.savings_percentage.toFixed(0)}%</span>
                  </div>
                )}

                <div className="relative">
                  <Image
                    src={product.image_url}
                    alt={product.name_english}
                    width={200}
                    height={200}
                    className="w-full h-48 object-cover rounded-xl mb-4"
                  />

                  {/* Category Badge */}
                  <span className="absolute top-2 left-2 bg-seoul-gold text-seoul-black px-3 py-1 rounded-full text-xs font-semibold">
                    {product.category}
                  </span>
                </div>

                <h3 className="font-semibold text-lg mb-1 text-seoul-black">{product.brand}</h3>
                <p className="text-gray-600 text-sm mb-4">{product.name_english}</p>

                {/* Price Comparison */}
                <div className="space-y-3">
                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">US RETAIL</span>
                    <span className="text-lg font-semibold line-through text-gray-400">
                      ${product.us_price}
                    </span>
                  </div>

                  <div className="flex justify-between items-center">
                    <span className="text-sm text-gray-500">SEOUL PRICE</span>
                    <span className="text-xl font-bold text-seoul-gold-dark">
                      ${product.seoul_price + 25}
                    </span>
                  </div>
                </div>

                {/* Hover State - Show Savings */}
                {hoveredProduct === product.id && (
                  <div className="mt-4 pt-4 border-t border-seoul-gold-light text-center animate-shimmer">
                    <p className="text-2xl font-bold text-seoul-gold">
                      Save ${(product.us_price - product.seoul_price - 25).toFixed(0)}
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How Seoul Sisters Access VIP Pricing */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-luxury mb-6">
              How Seoul Sisters Access <span className="text-gold-gradient">VIP Pricing</span> 👑
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              From Seoul's exclusive wholesale suppliers to your door - no cap, just three simple steps
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-8 bg-gradient-to-br from-seoul-cream to-white rounded-2xl luxury-shadow">
              <div className="w-20 h-20 bg-gold-gradient rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">🛍️</span>
              </div>
              <h3 className="text-xl font-semibold mb-4 text-seoul-black">1. Curated Selection</h3>
              <p className="text-gray-600">
                We partner with Seoul's most trusted wholesale suppliers, including verified distributors
                in Myeongdong and Hongdae, ensuring authentic products at wholesale prices.
              </p>
            </div>

            <div className="text-center p-8 bg-gradient-to-br from-seoul-cream to-white rounded-2xl luxury-shadow">
              <div className="w-20 h-20 bg-gold-gradient rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">✈️</span>
              </div>
              <h3 className="text-xl font-semibold mb-4 text-seoul-black">2. Direct Sourcing</h3>
              <p className="text-gray-600">
                Products are sourced directly from Korea with full authenticity verification.
                No middlemen, no markup inflation - just honest Seoul wholesale prices.
              </p>
            </div>

            <div className="text-center p-8 bg-gradient-to-br from-seoul-cream to-white rounded-2xl luxury-shadow">
              <div className="w-20 h-20 bg-gold-gradient rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-3xl">📦</span>
              </div>
              <h3 className="text-xl font-semibold mb-4 text-seoul-black">3. Premium Delivery</h3>
              <p className="text-gray-600">
                Carefully packaged and shipped with tracking. Your authentic Korean beauty products
                arrive in perfect condition, ready to transform your routine.
              </p>
            </div>
          </div>

          {/* Authenticity Guarantee */}
          <div className="mt-16 text-center p-10 bg-gradient-to-r from-seoul-gold-light via-seoul-cream to-seoul-gold-light rounded-3xl">
            <h3 className="text-2xl font-semibold mb-4 text-seoul-black">Authenticity Guaranteed</h3>
            <p className="text-gray-700 max-w-2xl mx-auto">
              Every product comes with authenticity verification and direct wholesale supplier receipts.
              If you're not completely satisfied with the quality and savings, we'll make it right.
            </p>
          </div>
        </div>
      </section>

      {/* Seoul Sisters Share Their Wins */}
      <section className="py-20 bg-gradient-to-br from-seoul-pearl to-white">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-luxury mb-6">
              Seoul Sisters Share Their <span className="text-gold-gradient">Wins</span> 💋
            </h2>
            <p className="text-lg text-gray-600">
              Real Seoul Sisters, real savings, real luxury vibes
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8">
            {/* Testimonial 1 */}
            <div className="bg-white rounded-2xl p-8 luxury-shadow">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gold-gradient rounded-full flex items-center justify-center text-white font-bold text-xl">
                  SK
                </div>
                <div className="ml-4">
                  <p className="font-semibold text-seoul-black">Sarah K.</p>
                  <p className="text-sm text-gray-600">Los Angeles, CA</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6 italic">
                "I've been buying Korean skincare for years, but Seoul Sister opened my eyes to how much
                I was overpaying. The quality is identical to what I got at Sephora, but at a fraction of the cost."
              </p>
              <div className="bg-seoul-gold-light rounded-xl p-4 text-center">
                <p className="text-sm text-gray-600">Monthly savings:</p>
                <p className="text-2xl font-bold text-seoul-gold-dark">$240</p>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="bg-white rounded-2xl p-8 luxury-shadow">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gold-gradient rounded-full flex items-center justify-center text-white font-bold text-xl">
                  ER
                </div>
                <div className="ml-4">
                  <p className="font-semibold text-seoul-black">Emma R.</p>
                  <p className="text-sm text-gray-600">New York, NY</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6 italic">
                "As someone who creates beauty content, authenticity matters. Seoul Sister sources directly
                from Korea, and my followers have noticed the difference in my skin since switching."
              </p>
              <div className="bg-seoul-gold-light rounded-xl p-4 text-center">
                <p className="text-sm text-gray-600">First order saved:</p>
                <p className="text-2xl font-bold text-seoul-gold-dark">$180</p>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="bg-white rounded-2xl p-8 luxury-shadow">
              <div className="flex items-center mb-6">
                <div className="w-16 h-16 bg-gold-gradient rounded-full flex items-center justify-center text-white font-bold text-xl">
                  JM
                </div>
                <div className="ml-4">
                  <p className="font-semibold text-seoul-black">Jessica M.</p>
                  <p className="text-sm text-gray-600">Austin, TX</p>
                </div>
              </div>
              <p className="text-gray-700 mb-6 italic">
                "I was skeptical at first, but the products arrive exactly as described. The packaging is authentic,
                and the prices make premium skincare accessible for someone on a budget."
              </p>
              <div className="bg-seoul-gold-light rounded-xl p-4 text-center">
                <p className="text-sm text-gray-600">Annual savings:</p>
                <p className="text-2xl font-bold text-seoul-gold-dark">$1,200</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Viral Tools Section */}
      <section className="py-20 bg-white">
        <div className="max-w-6xl mx-auto px-4">
          {/* Viral Screenshot Generator */}
          <div className="mb-20">
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-luxury mb-6">
                Create Your <span className="text-gold-gradient">Viral Story</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Generate a luxury Instagram Story to show your Seoul Sister savings.
                Help expose the beauty industry markup with style! 👑
              </p>
            </div>

            {showViralGenerator && (
              <div className="max-w-4xl mx-auto mb-8">
                <ViralScreenshotGenerator
                  savingsData={{
                    productName: currentProduct.name_english,
                    usPrice: currentProduct.us_price,
                    seoulPrice: currentProduct.seoul_price + 25,
                    savings: savings - 25,
                    savingsPercent: ((savings - 25) / currentProduct.us_price) * 100,
                    brand: currentProduct.brand
                  }}
                  customerName="Seoul Sister"
                  onScreenshotGenerated={handleScreenshotGenerated}
                />
              </div>
            )}

            <div className="text-center">
              <button
                onClick={() => setShowViralGenerator(!showViralGenerator)}
                className="bg-seoul-gold text-seoul-black font-semibold py-4 px-8 rounded-full text-lg luxury-shadow hover:bg-seoul-gold-dark transform hover:scale-105 transition-all duration-300"
              >
                {showViralGenerator ? 'Hide Generator' : 'Create My Viral Story ✨'}
              </button>
            </div>
          </div>

          {/* Viral Copy Generator */}
          <div>
            <div className="text-center mb-12">
              <h2 className="text-4xl md:text-5xl font-luxury mb-6">
                Generate <span className="text-gold-gradient">Viral Copy</span>
              </h2>
              <p className="text-lg text-gray-600 max-w-2xl mx-auto">
                Get platform-specific content to share your Seoul Sister savings.
                Perfect for TikTok, Instagram, and more! 🔥
              </p>
            </div>

            {showCopyGenerator && (
              <div className="max-w-4xl mx-auto mb-8">
                <ViralCopyGenerator
                  savingsData={{
                    productName: currentProduct.name_english,
                    brand: currentProduct.brand,
                    usPrice: currentProduct.us_price,
                    seoulPrice: currentProduct.seoul_price + 25,
                    savings: savings - 25,
                    savingsPercent: ((savings - 25) / currentProduct.us_price) * 100
                  }}
                  onCopyGenerated={handleCopyGenerated}
                />
              </div>
            )}

            <div className="text-center">
              <button
                onClick={() => setShowCopyGenerator(!showCopyGenerator)}
                className="bg-seoul-black text-white font-semibold py-4 px-8 rounded-full text-lg shadow-xl hover:shadow-2xl transform hover:scale-105 transition-all duration-300"
              >
                {showCopyGenerator ? 'Hide Copy Generator' : 'Generate Viral Copy 🚀'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* The Seoul Sister Difference */}
      <section className="py-20 bg-gradient-to-br from-seoul-cream via-white to-seoul-rose">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-16">
            <h2 className="text-4xl md:text-5xl font-luxury mb-6">
              The <span className="text-gold-gradient">Seoul Sister</span> Difference
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              VIP access, authentic luxury, trusted by 15K+ Seoul Sisters who refuse industry markups
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-8 text-center">
            <div>
              <p className="text-5xl font-bold text-seoul-gold mb-2">15K+</p>
              <p className="text-gray-600">Seoul Sisters</p>
            </div>
            <div>
              <p className="text-5xl font-bold text-seoul-gold mb-2">$2.8M</p>
              <p className="text-gray-600">Money Not Wasted</p>
            </div>
            <div>
              <p className="text-5xl font-bold text-seoul-gold mb-2">73%</p>
              <p className="text-gray-600">Markup Exposed</p>
            </div>
            <div>
              <p className="text-5xl font-bold text-seoul-gold mb-2">4.9★</p>
              <p className="text-gray-600">VIP Experience</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final Premium CTA */}
      <section className="py-32 bg-seoul-black text-white relative overflow-hidden">
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-96 h-96 bg-seoul-gold opacity-10 rounded-full filter blur-3xl"></div>
          <div className="absolute bottom-0 left-0 w-96 h-96 bg-seoul-gold-dark opacity-10 rounded-full filter blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-4xl md:text-5xl font-luxury mb-8">
            Ready to Join the <span className="text-gold-gradient">Seoul Sisters</span>?
          </h2>
          <p className="text-xl mb-12 opacity-90 max-w-2xl mx-auto">
            Join 15K+ Seoul Sisters who refuse industry markup manipulation.
            Get your exclusive VIP access with a personalized Seoul consultation.
          </p>

          <Link href="/signup">
            <button className="group relative bg-seoul-gold text-seoul-black font-bold py-5 px-12 rounded-full text-lg shadow-2xl hover:shadow-3xl transform hover:scale-105 transition-all duration-300 overflow-hidden">
              <span className="relative z-10">VIP Seoul Access 👑</span>
            </button>
          </Link>

          <p className="mt-8 text-sm opacity-70">
            Free VIP consultation • No commitment • Seoul Sister exclusive access
          </p>
        </div>
      </section>
    </main>
  )
}