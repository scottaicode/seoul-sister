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
    <main className="min-h-screen bg-white">
      {/* ULTIMATE Premium Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 py-20 overflow-hidden hero-luxury-bg">
        {/* Multi-layer Luxury Background */}
        <div className="absolute inset-0 bg-gradient-to-br from-seoul-rose via-seoul-pearl to-white opacity-80"></div>
        <div className="absolute inset-0">
          <div className="absolute top-0 left-0 w-96 h-96 bg-gradient-to-br from-seoul-gold to-transparent opacity-20 rounded-full filter blur-3xl animate-float"></div>
          <div className="absolute bottom-0 right-0 w-96 h-96 bg-gradient-to-br from-seoul-pink to-transparent opacity-20 rounded-full filter blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-to-br from-seoul-gold-light to-transparent opacity-10 rounded-full filter blur-3xl"></div>
        </div>

        <div className="relative z-10 max-w-5xl mx-auto text-center">
          {/* Animated Crown Icon */}
          <div className="flex justify-center mb-8">
            <span className="text-7xl md:text-8xl animate-float">👑</span>
          </div>

          {/* MASSIVE Gold Brand Name with Ultimate Shimmer */}
          <h1 className="font-luxury text-7xl md:text-9xl mb-10 text-gold-gradient luxury-text-shadow animate-shimmer">
            Seoul Sister
          </h1>

          {/* Premium Hook with Better Contrast */}
          <h2 className="text-3xl md:text-5xl font-medium text-luxury-black mb-6 tracking-tight">
            POV: You discover what Seoul girls <span className="text-seoul-gold font-bold">actually</span> pay
          </h2>

          {/* Luxury Tagline with Animation */}
          <p className="text-2xl md:text-3xl text-gold-gradient font-bold mb-14 animate-pulse-gold">
            Luxury K-beauty at Seoul insider prices
          </p>

          {/* Premium Description */}
          <p className="text-xl text-gray-700 mb-16 max-w-3xl mx-auto leading-relaxed font-medium">
            You're about to access the same luxury K-beauty that Seoul insiders get,
            without the <span className="text-korean-red font-bold">300% US markup</span>.
            This is premium quality at Seoul reality prices—<span className="italic">no compromises, bestie.</span>
          </p>

          {/* ULTIMATE CTA Buttons with Maximum Impact */}
          <div className="flex flex-col sm:flex-row gap-6 justify-center items-center mb-16">
            <Link href="/signup">
              <button className="cta-luxury py-6 px-12 rounded-full text-xl font-bold shadow-2xl transform hover:scale-110 transition-all duration-300">
                <span className="relative z-10">Access Seoul Insider Prices</span>
              </button>
            </Link>

            <button
              onClick={() => setShowViralGenerator(true)}
              className="cta-gold py-6 px-12 rounded-full text-xl animate-pulse-gold"
            >
              Calculate VIP Savings 💰
            </button>
          </div>

          {/* Trust Indicators with Gold Accent */}
          <div className="flex justify-center gap-8 text-base font-semibold">
            <span className="text-gray-700">✓ <span className="text-seoul-gold">15K+</span> Seoul Sisters</span>
            <span className="text-gray-700">✓ <span className="text-seoul-gold">$2.8M</span> Saved</span>
            <span className="text-gray-700">✓ <span className="text-seoul-gold">100%</span> Authentic</span>
          </div>
        </div>

        {/* Premium Scroll Indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce">
          <div className="w-10 h-14 border-3 border-seoul-gold rounded-full flex justify-center gold-glow">
            <div className="w-2 h-4 bg-seoul-gold rounded-full mt-2"></div>
          </div>
        </div>
      </section>

      {/* DRAMATIC Luxury Markup Exposed Section */}
      <section className="py-24 bg-gradient-to-br from-white via-seoul-pearl to-seoul-rose-deep">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-20">
            <div className="inline-block mb-6">
              <span className="exposed-badge text-lg">
                🔥 EXPOSED 🔥
              </span>
            </div>
            <h2 className="text-5xl md:text-6xl font-luxury mb-8 text-luxury-black">
              <span className="text-gold-gradient">LUXURY MARKUP</span> REVEALED
            </h2>
            <p className="text-xl text-gray-700 max-w-2xl mx-auto font-medium">
              Enter any US beauty price to discover what Seoul Sisters actually pay.
              <span className="block mt-2 text-korean-red font-bold">No 300% markups. No finessing. Just truth.</span>
            </p>
          </div>

          {/* Interactive Price Calculator with DRAMA */}
          <div className="max-w-2xl mx-auto">
            <div className="premium-card-bg rounded-3xl p-12 luxury-shadow transform hover:scale-105 transition-all duration-300">
              <div className="mb-10">
                <label className="block text-base font-bold text-gray-800 mb-4">
                  Enter US Retail Price (e.g., $94)
                </label>
                <input
                  type="number"
                  placeholder="$94"
                  className="w-full px-8 py-5 text-3xl font-bold border-3 border-seoul-gold rounded-2xl focus:border-seoul-gold-dark focus:outline-none transition-all duration-300 text-center bg-white shadow-inner"
                  onChange={(e) => {
                    const usPrice = parseFloat(e.target.value) || 94;
                    const seoulPrice = Math.round(usPrice * 0.3);
                    const savings = usPrice - seoulPrice - 25;
                    const savingsPercent = ((savings / usPrice) * 100).toFixed(0);

                    const resultDiv = document.getElementById('price-result');
                    if (resultDiv) {
                      resultDiv.innerHTML = `
                        <div class="text-center space-y-6 animate-shimmer">
                          <div class="exposed-badge mx-auto text-xl">💸 MARKUP EXPOSED 💸</div>
                          <div class="grid grid-cols-2 gap-8">
                            <div class="bg-white/50 rounded-xl p-6">
                              <p class="text-sm font-bold text-gray-600 mb-2">US RETAIL</p>
                              <p class="text-4xl font-bold text-gray-400 line-through">$${usPrice}</p>
                            </div>
                            <div class="bg-gradient-to-br from-seoul-gold-light to-white rounded-xl p-6 border-2 border-seoul-gold">
                              <p class="text-sm font-bold text-gray-700 mb-2">SEOUL + $25</p>
                              <p class="text-4xl font-bold text-seoul-gold-dark">$${seoulPrice + 25}</p>
                            </div>
                          </div>
                          <div class="pt-6 border-t-3 border-seoul-gold">
                            <p class="text-xl font-bold text-gray-700 mb-2">YOU SAVE</p>
                            <p class="text-6xl font-bold text-gold-gradient luxury-text-shadow">${savings > 0 ? '$' + savings : '$0'}</p>
                            <p class="text-2xl font-bold text-korean-red mt-2">${savingsPercent}% LESS</p>
                          </div>
                        </div>
                      `;
                    }
                  }}
                />
              </div>

              <div id="price-result" className="min-h-[300px] flex items-center justify-center">
                <div className="text-center text-gray-500 text-lg">
                  Enter a price to expose the shocking markup...
                </div>
              </div>

              <button className="w-full mt-8 cta-luxury py-5 rounded-2xl text-xl font-bold">
                EXPOSE THE MARKUP NOW
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* PREMIUM VIP Collection Showcase */}
      <section className="py-24 bg-gradient-to-br from-white to-seoul-pearl">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-luxury mb-8">
              Seoul Sisters' <span className="text-gold-gradient animate-shimmer">VIP Collection</span>
            </h2>
            <p className="text-xl text-gray-700 max-w-2xl mx-auto font-medium">
              The same luxury K-beauty you're overpaying for, but at
              <span className="text-seoul-gold font-bold"> Seoul reality prices</span>
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredProducts.map((product) => (
              <div
                key={product.id}
                className="relative premium-card-bg rounded-3xl p-8 luxury-shadow hover:gold-glow transition-all duration-300 transform hover:-translate-y-3 hover:scale-105"
                onMouseEnter={() => setHoveredProduct(product.id)}
                onMouseLeave={() => setHoveredProduct(null)}
              >
                {/* DRAMATIC Exposed Badge */}
                {product.savings_percentage > 70 && (
                  <div className="absolute -top-4 -right-4 z-10">
                    <span className="exposed-badge">
                      {product.savings_percentage.toFixed(0)}% EXPOSED
                    </span>
                  </div>
                )}

                <div className="relative mb-6">
                  <Image
                    src={product.image_url}
                    alt={product.name_english}
                    width={200}
                    height={200}
                    className="w-full h-52 object-cover rounded-2xl shadow-lg"
                  />

                  {/* Luxury Category Badge */}
                  <span className="absolute top-3 left-3 bg-seoul-gold text-seoul-black px-4 py-2 rounded-full text-xs font-bold uppercase shadow-lg">
                    {product.category}
                  </span>
                </div>

                <h3 className="font-bold text-xl mb-2 text-luxury-black">{product.brand}</h3>
                <p className="text-gray-600 text-base mb-6">{product.name_english}</p>

                {/* Dramatic Price Display */}
                <div className="space-y-4">
                  <div className="flex justify-between items-center p-3 bg-gray-50 rounded-xl">
                    <span className="text-sm font-bold text-gray-500">US RETAIL</span>
                    <span className="text-2xl font-bold line-through text-gray-400">
                      ${product.us_price}
                    </span>
                  </div>

                  <div className="flex justify-between items-center p-3 bg-gradient-to-r from-seoul-gold-light to-white rounded-xl border-2 border-seoul-gold">
                    <span className="text-sm font-bold text-gray-700">SEOUL PRICE</span>
                    <span className="text-3xl font-bold text-seoul-gold-dark">
                      ${product.seoul_price + 25}
                    </span>
                  </div>
                </div>

                {/* Hover State - Dramatic Savings */}
                {hoveredProduct === product.id && (
                  <div className="mt-6 pt-6 border-t-2 border-seoul-gold text-center animate-shimmer">
                    <p className="text-3xl font-bold text-gold-gradient luxury-text-shadow">
                      SAVE ${(product.us_price - product.seoul_price - 25).toFixed(0)}
                    </p>
                    <p className="text-sm font-bold text-korean-red mt-2">
                      THAT'S {product.savings_percentage.toFixed(0)}% OFF!
                    </p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How Seoul Sisters Access VIP Pricing - LUXURY VERSION */}
      <section className="py-24 bg-gradient-to-br from-seoul-pearl via-white to-seoul-rose">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-luxury mb-8">
              How Seoul Sisters Access <span className="text-gold-gradient animate-shimmer">VIP Pricing</span> 👑
            </h2>
            <p className="text-xl text-gray-700 max-w-2xl mx-auto font-medium">
              From Seoul's exclusive suppliers to your door - <span className="italic">the luxury insider route</span>
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            <div className="text-center p-10 premium-card-bg rounded-3xl luxury-shadow transform hover:scale-105 transition-all duration-300">
              <div className="w-24 h-24 bg-gold-gradient rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse-gold">
                <span className="text-4xl">🛍️</span>
              </div>
              <h3 className="text-2xl font-bold mb-6 text-luxury-black">1. Curated Selection</h3>
              <p className="text-gray-700 text-lg leading-relaxed">
                We partner with Seoul's most exclusive wholesale suppliers in
                <span className="font-bold"> Myeongdong & Hongdae</span>,
                ensuring authentic luxury at wholesale prices.
              </p>
            </div>

            <div className="text-center p-10 premium-card-bg rounded-3xl luxury-shadow transform hover:scale-105 transition-all duration-300">
              <div className="w-24 h-24 bg-gold-gradient rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse-gold">
                <span className="text-4xl">✈️</span>
              </div>
              <h3 className="text-2xl font-bold mb-6 text-luxury-black">2. Direct Sourcing</h3>
              <p className="text-gray-700 text-lg leading-relaxed">
                Products sourced directly from Korea with
                <span className="font-bold"> authenticity certificates</span>.
                No middlemen. No markups. Just Seoul prices.
              </p>
            </div>

            <div className="text-center p-10 premium-card-bg rounded-3xl luxury-shadow transform hover:scale-105 transition-all duration-300">
              <div className="w-24 h-24 bg-gold-gradient rounded-full flex items-center justify-center mx-auto mb-8 animate-pulse-gold">
                <span className="text-4xl">📦</span>
              </div>
              <h3 className="text-2xl font-bold mb-6 text-luxury-black">3. Premium Delivery</h3>
              <p className="text-gray-700 text-lg leading-relaxed">
                Luxury packaging with tracking. Your authentic K-beauty arrives in
                <span className="font-bold"> perfect condition</span>,
                ready to transform your routine.
              </p>
            </div>
          </div>

          {/* Authenticity Guarantee - LUXURY */}
          <div className="mt-20 text-center p-12 bg-gradient-to-r from-seoul-gold-light via-white to-seoul-gold-light rounded-3xl luxury-shadow">
            <h3 className="text-3xl font-bold mb-6 text-luxury-black">
              ✨ Authenticity Guaranteed ✨
            </h3>
            <p className="text-xl text-gray-700 max-w-2xl mx-auto leading-relaxed">
              Every product comes with <span className="font-bold text-seoul-gold-dark">authenticity verification</span> and
              direct wholesale receipts. If you're not completely satisfied with the quality and savings,
              <span className="italic"> we'll make it right.</span>
            </p>
          </div>
        </div>
      </section>

      {/* Seoul Sisters Share Their Wins - DRAMATIC */}
      <section className="py-24 bg-gradient-to-br from-white to-seoul-pearl">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-luxury mb-8">
              Seoul Sisters Share Their <span className="text-gold-gradient animate-shimmer">Wins</span> 💋
            </h2>
            <p className="text-xl text-gray-700 font-medium">
              Real Seoul Sisters, real savings, <span className="italic text-seoul-gold-dark">real luxury vibes</span>
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-10">
            {/* Testimonial 1 */}
            <div className="premium-card-bg rounded-3xl p-10 luxury-shadow transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center mb-8">
                <div className="w-20 h-20 bg-gold-gradient rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-xl">
                  SK
                </div>
                <div className="ml-5">
                  <p className="font-bold text-xl text-luxury-black">Sarah K.</p>
                  <p className="text-gray-600">Los Angeles, CA</p>
                </div>
              </div>
              <p className="text-gray-700 mb-8 italic text-lg leading-relaxed">
                "I've been buying Korean skincare for years, but Seoul Sister opened my eyes to how much
                I was overpaying. The quality is identical to what I got at Sephora, but at a fraction of the cost."
              </p>
              <div className="bg-gradient-to-r from-seoul-gold-light to-white rounded-2xl p-6 text-center border-2 border-seoul-gold">
                <p className="text-sm font-bold text-gray-600">Monthly savings:</p>
                <p className="text-4xl font-bold text-gold-gradient">$240</p>
              </div>
            </div>

            {/* Testimonial 2 */}
            <div className="premium-card-bg rounded-3xl p-10 luxury-shadow transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center mb-8">
                <div className="w-20 h-20 bg-gold-gradient rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-xl">
                  ER
                </div>
                <div className="ml-5">
                  <p className="font-bold text-xl text-luxury-black">Emma R.</p>
                  <p className="text-gray-600">New York, NY</p>
                </div>
              </div>
              <p className="text-gray-700 mb-8 italic text-lg leading-relaxed">
                "As someone who creates beauty content, authenticity matters. Seoul Sister sources directly
                from Korea, and my followers have noticed the difference in my skin since switching."
              </p>
              <div className="bg-gradient-to-r from-seoul-gold-light to-white rounded-2xl p-6 text-center border-2 border-seoul-gold">
                <p className="text-sm font-bold text-gray-600">First order saved:</p>
                <p className="text-4xl font-bold text-gold-gradient">$180</p>
              </div>
            </div>

            {/* Testimonial 3 */}
            <div className="premium-card-bg rounded-3xl p-10 luxury-shadow transform hover:scale-105 transition-all duration-300">
              <div className="flex items-center mb-8">
                <div className="w-20 h-20 bg-gold-gradient rounded-full flex items-center justify-center text-white font-bold text-2xl shadow-xl">
                  JM
                </div>
                <div className="ml-5">
                  <p className="font-bold text-xl text-luxury-black">Jessica M.</p>
                  <p className="text-gray-600">Austin, TX</p>
                </div>
              </div>
              <p className="text-gray-700 mb-8 italic text-lg leading-relaxed">
                "I was skeptical at first, but the products arrive exactly as described. The packaging is authentic,
                and the prices make premium skincare accessible for someone on a budget."
              </p>
              <div className="bg-gradient-to-r from-seoul-gold-light to-white rounded-2xl p-6 text-center border-2 border-seoul-gold">
                <p className="text-sm font-bold text-gray-600">Annual savings:</p>
                <p className="text-4xl font-bold text-gold-gradient">$1,200</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Viral Tools Section - DRAMATIC */}
      <section className="py-24 bg-gradient-to-br from-seoul-rose via-white to-seoul-pearl">
        <div className="max-w-6xl mx-auto px-4">
          {/* Viral Screenshot Generator */}
          <div className="mb-24">
            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-6xl font-luxury mb-8">
                Create Your <span className="text-gold-gradient animate-shimmer">Viral Story</span>
              </h2>
              <p className="text-xl text-gray-700 max-w-2xl mx-auto font-medium">
                Generate a luxury Instagram Story to show your Seoul Sister savings.
                <span className="block mt-2 text-seoul-gold-dark font-bold">Help expose the beauty industry markup with style! 👑</span>
              </p>
            </div>

            {showViralGenerator && (
              <div className="max-w-4xl mx-auto mb-10 animate-shimmer">
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
                className="cta-gold py-5 px-10 rounded-full text-xl"
              >
                {showViralGenerator ? 'Hide Generator' : 'Create My Viral Story ✨'}
              </button>
            </div>
          </div>

          {/* Viral Copy Generator */}
          <div>
            <div className="text-center mb-16">
              <h2 className="text-5xl md:text-6xl font-luxury mb-8">
                Generate <span className="text-gold-gradient animate-shimmer">Viral Copy</span>
              </h2>
              <p className="text-xl text-gray-700 max-w-2xl mx-auto font-medium">
                Get platform-specific content to share your Seoul Sister savings.
                <span className="block mt-2 text-seoul-gold-dark font-bold">Perfect for TikTok, Instagram, and more! 🔥</span>
              </p>
            </div>

            {showCopyGenerator && (
              <div className="max-w-4xl mx-auto mb-10 animate-shimmer">
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
                className="cta-luxury py-5 px-10 rounded-full text-xl"
              >
                {showCopyGenerator ? 'Hide Copy Generator' : 'Generate Viral Copy 🚀'}
              </button>
            </div>
          </div>
        </div>
      </section>

      {/* The Seoul Sister Difference - ULTIMATE */}
      <section className="py-24 bg-gradient-to-br from-white via-seoul-pearl to-seoul-rose">
        <div className="max-w-6xl mx-auto px-4">
          <div className="text-center mb-20">
            <h2 className="text-5xl md:text-6xl font-luxury mb-8">
              The <span className="text-gold-gradient animate-shimmer">Seoul Sister</span> Difference
            </h2>
            <p className="text-xl text-gray-700 max-w-2xl mx-auto font-medium">
              VIP access, authentic luxury, trusted by 15K+ Seoul Sisters who
              <span className="text-korean-red font-bold"> refuse industry markups</span>
            </p>
          </div>

          <div className="grid md:grid-cols-4 gap-10 text-center">
            <div className="premium-card-bg rounded-2xl p-8 luxury-shadow transform hover:scale-110 transition-all duration-300">
              <p className="text-6xl font-bold text-gold-gradient mb-4 animate-shimmer">15K+</p>
              <p className="text-gray-700 font-semibold text-lg">Seoul Sisters</p>
            </div>
            <div className="premium-card-bg rounded-2xl p-8 luxury-shadow transform hover:scale-110 transition-all duration-300">
              <p className="text-6xl font-bold text-gold-gradient mb-4 animate-shimmer">$2.8M</p>
              <p className="text-gray-700 font-semibold text-lg">Money Not Wasted</p>
            </div>
            <div className="premium-card-bg rounded-2xl p-8 luxury-shadow transform hover:scale-110 transition-all duration-300">
              <p className="text-6xl font-bold text-gold-gradient mb-4 animate-shimmer">73%</p>
              <p className="text-gray-700 font-semibold text-lg">Markup Exposed</p>
            </div>
            <div className="premium-card-bg rounded-2xl p-8 luxury-shadow transform hover:scale-110 transition-all duration-300">
              <p className="text-6xl font-bold text-gold-gradient mb-4 animate-shimmer">4.9★</p>
              <p className="text-gray-700 font-semibold text-lg">VIP Experience</p>
            </div>
          </div>
        </div>
      </section>

      {/* ULTIMATE Final Premium CTA */}
      <section className="py-32 bg-seoul-black text-white relative overflow-hidden">
        {/* Animated Gold Particles */}
        <div className="absolute inset-0">
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-seoul-gold opacity-10 rounded-full filter blur-3xl animate-float"></div>
          <div className="absolute bottom-0 left-0 w-[500px] h-[500px] bg-seoul-gold-dark opacity-10 rounded-full filter blur-3xl animate-float" style={{ animationDelay: '2s' }}></div>
          <div className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-seoul-gold opacity-5 rounded-full filter blur-3xl animate-pulse"></div>
        </div>

        <div className="relative z-10 max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-5xl md:text-7xl font-luxury mb-10">
            Ready to Join the <span className="text-gold-gradient animate-shimmer">Seoul Sisters</span>?
          </h2>
          <p className="text-2xl mb-14 opacity-90 max-w-2xl mx-auto leading-relaxed">
            Join 15K+ Seoul Sisters who refuse industry markup manipulation.
            Get your exclusive VIP access with a personalized Seoul consultation.
          </p>

          <Link href="/signup">
            <button className="cta-gold py-6 px-14 rounded-full text-2xl transform hover:scale-110 transition-all duration-300 animate-pulse-gold">
              <span className="flex items-center gap-3">
                VIP Seoul Access <span className="text-3xl">👑</span>
              </span>
            </button>
          </Link>

          <p className="mt-10 text-lg opacity-80">
            Free VIP consultation • No commitment • Seoul Sister exclusive access
          </p>
        </div>
      </section>
    </main>
  )
}