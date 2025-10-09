'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'

interface Product {
  id: string
  name_english: string
  brand: string
  seoul_price: number
  us_price: number
  savings_percentage: number
  image_url: string
}

const featuredProducts: Product[] = [
  {
    id: '1',
    name_english: 'Yun Jo Essence',
    brand: 'Sulwhasoo',
    seoul_price: 28.00,
    us_price: 94.00,
    savings_percentage: 70.21,
    image_url: 'https://images.unsplash.com/photo-1617897094665-d019c0ac14f5?w=400&h=400&fit=crop'
  },
  {
    id: '2',
    name_english: 'Aqua Serum',
    brand: 'Laneige',
    seoul_price: 22.00,
    us_price: 56.00,
    savings_percentage: 60.71,
    image_url: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=400&h=400&fit=crop'
  },
  {
    id: '3',
    name_english: 'Centella Asiatica Toner',
    brand: 'COSRX',
    seoul_price: 13.00,
    us_price: 32.00,
    savings_percentage: 59.38,
    image_url: 'https://images.unsplash.com/photo-1570194065650-d99fb4bedf0a?w=400&h=400&fit=crop'
  }
]

export default function HomePage() {
  const [currentProductIndex, setCurrentProductIndex] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentProductIndex((prev) => (prev + 1) % featuredProducts.length)
    }, 4000)
    return () => clearInterval(interval)
  }, [])

  const currentProduct = featuredProducts[currentProductIndex]
  const savings = currentProduct.us_price - currentProduct.seoul_price

  return (
    <main className="min-h-screen bg-white">
      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center justify-center px-4 py-20">
        <div className="absolute inset-0 korean-gradient opacity-5"></div>

        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {/* Main Headline */}
          <h1 className="text-4xl md:text-6xl lg:text-7xl font-bold font-display mb-8 leading-tight">
            <span className="text-gray-900">Stop Getting</span><br />
            <span className="text-gradient">SCAMMED</span><br />
            <span className="text-gray-900">by Beauty Brands</span>
          </h1>

          {/* Subheadline */}
          <p className="text-lg md:text-xl text-gray-600 mb-12 max-w-2xl mx-auto leading-relaxed">
            Get the <strong>exact same products</strong> sold in Seoul at <strong>real Seoul prices</strong>,
            not the 40-70% markup you pay in the US.
          </p>

          {/* Dynamic Price Comparison */}
          <div className="savings-highlight rounded-2xl p-8 mb-12 max-w-md mx-auto bg-white shadow-xl">
            <div className="flex items-center justify-between mb-4">
              <Image
                src={currentProduct.image_url}
                alt={currentProduct.name_english}
                width={80}
                height={80}
                className="rounded-lg object-cover"
              />
              <div className="text-right">
                <h3 className="font-semibold text-gray-900">{currentProduct.brand}</h3>
                <p className="text-sm text-gray-600">{currentProduct.name_english}</p>
              </div>
            </div>

            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">US Price:</span>
                <span className="text-lg font-semibold line-through text-gray-400">
                  ${currentProduct.us_price.toFixed(2)}
                </span>
              </div>

              <div className="flex justify-between items-center">
                <span className="text-gray-600">Seoul Price + $25:</span>
                <span className="text-lg font-semibold text-korean-blue">
                  ${(currentProduct.seoul_price + 25).toFixed(2)}
                </span>
              </div>

              <div className="border-t pt-3 flex justify-between items-center">
                <span className="font-semibold text-gray-900">You Save:</span>
                <span className="text-2xl font-bold text-korean-red">
                  ${savings.toFixed(2)}
                </span>
              </div>

              <div className="text-center">
                <span className="inline-block bg-korean-gradient text-white px-4 py-2 rounded-full text-sm font-semibold">
                  {currentProduct.savings_percentage.toFixed(0)}% LESS than US retail
                </span>
              </div>
            </div>
          </div>

          {/* CTA Button */}
          <div className="space-y-4">
            <Link href="/signup" className="inline-block">
              <button className="bg-korean-gradient hover:opacity-90 transition-opacity text-white font-bold py-4 px-8 rounded-xl text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
                I'm Ready to Expose the Scam
              </button>
            </Link>

            <p className="text-sm text-gray-500">
              Join 10,000+ customers saving thousands on authentic K-beauty
            </p>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 animate-bounce-subtle">
          <div className="w-6 h-10 border-2 border-gray-300 rounded-full flex justify-center">
            <div className="w-1 h-3 bg-gray-300 rounded-full mt-2 animate-pulse"></div>
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-16 text-gray-900">
            How Seoul Sister Works
          </h2>

          <div className="grid md:grid-cols-3 gap-8">
            <div className="text-center p-6">
              <div className="w-16 h-16 bg-korean-gradient rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white font-bold text-xl">1</span>
              </div>
              <h3 className="text-xl font-semibold mb-4 text-gray-900">Sign Up & Save Payment</h3>
              <p className="text-gray-600">
                Create your account and securely save your payment method. No charges until you order.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-korean-gradient rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white font-bold text-xl">2</span>
              </div>
              <h3 className="text-xl font-semibold mb-4 text-gray-900">WhatsApp Your Order</h3>
              <p className="text-gray-600">
                Send us a screenshot or description of what you want. Our AI identifies products instantly.
              </p>
            </div>

            <div className="text-center p-6">
              <div className="w-16 h-16 bg-korean-gradient rounded-full flex items-center justify-center mx-auto mb-6">
                <span className="text-white font-bold text-xl">3</span>
              </div>
              <h3 className="text-xl font-semibold mb-4 text-gray-900">Get It at Seoul Prices</h3>
              <p className="text-gray-600">
                We source directly from Seoul and ship to you. Pay Seoul price + $25 service fee.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Product Showcase */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-4">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-4 text-gray-900">
            Popular Products
          </h2>
          <p className="text-center text-gray-600 mb-16">
            See how much you could be saving on your favorite K-beauty products
          </p>

          <div className="grid md:grid-cols-3 gap-8">
            {featuredProducts.map((product) => (
              <div key={product.id} className="bg-white rounded-xl shadow-lg p-6 hover:shadow-xl transition-shadow">
                <Image
                  src={product.image_url}
                  alt={product.name_english}
                  width={200}
                  height={200}
                  className="w-full h-48 object-cover rounded-lg mb-4"
                />

                <h3 className="font-semibold text-lg mb-2 text-gray-900">{product.brand}</h3>
                <p className="text-gray-600 mb-4">{product.name_english}</p>

                <div className="space-y-2">
                  <div className="flex justify-between">
                    <span className="text-gray-600">US Price:</span>
                    <span className="line-through text-gray-400">${product.us_price.toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Seoul + Service:</span>
                    <span className="font-semibold text-korean-blue">${(product.seoul_price + 25).toFixed(2)}</span>
                  </div>
                  <div className="flex justify-between font-bold text-korean-red">
                    <span>You Save:</span>
                    <span>${(product.us_price - product.seoul_price - 25).toFixed(2)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Social Proof */}
      <section className="py-20 bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <h2 className="text-3xl md:text-4xl font-bold mb-16 text-gray-900">
            Customer Success Stories
          </h2>

          <div className="grid md:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-xl shadow-lg">
              <p className="text-gray-600 mb-6 italic">
                "I was paying $94 for Sulwhasoo essence at Sephora. Seoul Sister got me the exact same product for $53 total. I've saved over $800 in just 3 months!"
              </p>
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <p className="font-semibold text-gray-900">Sarah M.</p>
                  <p className="text-sm text-gray-600">Saved $847 in 3 months</p>
                </div>
              </div>
            </div>

            <div className="bg-white p-8 rounded-xl shadow-lg">
              <p className="text-gray-600 mb-6 italic">
                "The WhatsApp ordering is so convenient. I just send a screenshot and they handle everything. Getting authentic Korean products at real prices feels like a superpower."
              </p>
              <div className="flex items-center justify-center">
                <div className="text-center">
                  <p className="font-semibold text-gray-900">Jessica L.</p>
                  <p className="text-sm text-gray-600">Saved $623 in 2 months</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="py-20 korean-gradient">
        <div className="max-w-4xl mx-auto px-4 text-center text-white">
          <h2 className="text-3xl md:text-4xl font-bold mb-6">
            Ready to Stop Overpaying?
          </h2>
          <p className="text-xl mb-8 opacity-90">
            Join thousands of customers who are getting authentic K-beauty at fair prices
          </p>

          <Link href="/signup">
            <button className="bg-white text-korean-red font-bold py-4 px-8 rounded-xl text-lg shadow-lg hover:shadow-xl transform hover:scale-105 transition-all duration-200">
              Start Saving Today
            </button>
          </Link>
        </div>
      </section>
    </main>
  )
}