'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ViralScreenshotGenerator from '../components/ViralScreenshotGenerator'
import ViralCopyGenerator from '../components/ViralCopyGenerator'

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
    savings_percentage: 70,
    image_url: 'https://images.unsplash.com/photo-1620916566398-39f1143ab7be?w=600&h=600&fit=crop',
    category: 'Serum'
  },
  {
    id: '2',
    name_english: 'Glow Deep Serum',
    brand: 'Beauty of Joseon',
    seoul_price: 8.00,
    us_price: 45.00,
    savings_percentage: 82,
    image_url: 'https://images.unsplash.com/photo-1598440947619-2c35fc9aa908?w=600&h=600&fit=crop',
    category: 'Serum'
  },
  {
    id: '3',
    name_english: 'Snail 96 Mucin Essence',
    brand: 'COSRX',
    seoul_price: 23.00,
    us_price: 89.00,
    savings_percentage: 74,
    image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=600&fit=crop',
    category: 'Essence'
  },
  {
    id: '4',
    name_english: 'Water Sleeping Mask',
    brand: 'Laneige',
    seoul_price: 12.00,
    us_price: 34.00,
    savings_percentage: 65,
    image_url: 'https://images.unsplash.com/photo-1621648394224-3e9b043a8e0b?w=600&h=600&fit=crop',
    category: 'Mask'
  }
]

export default function HomePage() {
  const [currentProductIndex, setCurrentProductIndex] = useState(0)
  const [isScrolled, setIsScrolled] = useState(false)
  const [showViralTools, setShowViralTools] = useState(false)

  useEffect(() => {
    const handleScroll = () => {
      setIsScrolled(window.scrollY > 100)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  useEffect(() => {
    const interval = setInterval(() => {
      setCurrentProductIndex((prev) => (prev + 1) % featuredProducts.length)
    }, 5000)
    return () => clearInterval(interval)
  }, [])

  const currentProduct = featuredProducts[currentProductIndex]

  return (
    <main className="min-h-screen bg-black text-white">
      {/* Luxury Navigation Bar */}
      <nav className={`nav-luxury transition-all duration-500 ${isScrolled ? 'py-4' : 'py-8'}`}>
        <div className="luxury-container flex justify-between items-center">
          <div className="text-2xl heading-hero text-luxury-gold tracking-wider">
            Seoul Sister
          </div>

          <div className="flex items-center gap-12">
            <Link href="/collection" className="link-luxury text-sm tracking-widest">
              COLLECTION
            </Link>
            <Link href="/about" className="link-luxury text-sm tracking-widest">
              ABOUT
            </Link>
            <Link href="/insider" className="link-luxury text-sm tracking-widest">
              INSIDER ACCESS
            </Link>
            <Link href="/signup">
              <button className="btn-luxury text-xs">
                Join
              </button>
            </Link>
          </div>
        </div>
      </nav>

      {/* Hero Section - Refined Minimalism */}
      <section className="hero-section flex items-center justify-center relative">
        <div className="luxury-container text-center z-10">
          <div className="animate-reveal">
            <p className="text-caption mb-8 text-luxury-gold">
              EXCLUSIVE ACCESS TO SEOUL'S BEAUTY SECRETS
            </p>

            <h1 className="heading-hero text-6xl md:text-8xl lg:text-9xl mb-8 font-thin">
              Seoul Sister
            </h1>

            <div className="gold-line mx-auto mb-12"></div>

            <p className="text-xl md:text-2xl font-light mb-4 max-w-3xl mx-auto leading-relaxed">
              The same luxury K-beauty Seoul insiders trust,
            </p>
            <p className="text-xl md:text-2xl font-light mb-16 max-w-3xl mx-auto leading-relaxed">
              without the <span className="text-luxury-gold">300% markup</span>
            </p>

            <div className="flex gap-6 justify-center">
              <Link href="/signup">
                <button className="btn-luxury-solid">
                  INSIDER ACCESS
                </button>
              </Link>
              <button className="btn-luxury">
                DISCOVER MORE
              </button>
            </div>
          </div>

          <div className="scroll-indicator">
            <div className="scroll-line"></div>
          </div>
        </div>
      </section>

      {/* Product Showcase - Grid Layout */}
      <section className="section-dark py-32">
        <div className="luxury-container">
          <div className="text-center mb-20">
            <p className="text-caption mb-4">CURATED COLLECTION</p>
            <h2 className="heading-section text-5xl md:text-6xl mb-8">
              Insider Pricing Revealed
            </h2>
            <div className="gold-line mx-auto"></div>
          </div>

          <div className="product-grid">
            {featuredProducts.map((product) => (
              <div key={product.id} className="product-card text-center group">
                <div className="image-luxury mb-8 h-64 bg-luxury-black-soft">
                  <Image
                    src={product.image_url}
                    alt={product.name_english}
                    width={400}
                    height={400}
                    className="w-full h-full object-cover"
                  />
                </div>

                <p className="text-caption mb-2">{product.brand.toUpperCase()}</p>
                <h3 className="text-lg mb-6 font-light">{product.name_english}</h3>

                <div className="space-y-2 mb-8">
                  <p className="price-original text-sm">
                    US RETAIL ${product.us_price}
                  </p>
                  <p className="price-seoul text-2xl">
                    ${product.seoul_price + 25}
                  </p>
                </div>

                <span className="badge-insider">
                  {product.savings_percentage}% INSIDER SAVINGS
                </span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* The Process - Clean Steps */}
      <section className="section-light py-32">
        <div className="luxury-container">
          <div className="text-center mb-20">
            <p className="text-caption mb-4 text-luxury-charcoal">THE PROCESS</p>
            <h2 className="heading-section text-5xl md:text-6xl mb-8 text-luxury-black">
              From Seoul to Your Door
            </h2>
            <div className="gold-line mx-auto"></div>
          </div>

          <div className="grid md:grid-cols-3 gap-16 max-w-5xl mx-auto">
            <div className="text-center">
              <div className="text-4xl mb-8 text-luxury-gold">01</div>
              <h3 className="text-xl mb-4 font-light text-luxury-black">Direct Sourcing</h3>
              <p className="text-sm text-luxury-charcoal font-light leading-relaxed">
                Partnering with Seoul's most exclusive wholesale suppliers in Myeongdong,
                ensuring authenticity and quality.
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-8 text-luxury-gold">02</div>
              <h3 className="text-xl mb-4 font-light text-luxury-black">Authentication</h3>
              <p className="text-sm text-luxury-charcoal font-light leading-relaxed">
                Every product verified with authenticity certificates directly
                from Korean manufacturers.
              </p>
            </div>

            <div className="text-center">
              <div className="text-4xl mb-8 text-luxury-gold">03</div>
              <h3 className="text-xl mb-4 font-light text-luxury-black">Premium Delivery</h3>
              <p className="text-sm text-luxury-charcoal font-light leading-relaxed">
                Luxury packaging with tracking, ensuring your K-beauty arrives
                in perfect condition.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials - Refined */}
      <section className="section-dark py-32">
        <div className="luxury-container">
          <div className="text-center mb-20">
            <p className="text-caption mb-4">TESTIMONIALS</p>
            <h2 className="heading-section text-5xl md:text-6xl mb-8">
              Seoul Sisters Speak
            </h2>
            <div className="gold-line mx-auto"></div>
          </div>

          <div className="grid md:grid-cols-2 gap-2 max-w-5xl mx-auto">
            <div className="testimonial-luxury">
              <p className="testimonial-quote mb-8">
                "The quality is identical to what I purchased at Sephora,
                but at a fraction of the cost. Seoul Sister opened my eyes
                to the reality of beauty industry markups."
              </p>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-light">Sarah K.</p>
                  <p className="text-caption">LOS ANGELES</p>
                </div>
                <div className="text-right">
                  <p className="text-caption">MONTHLY SAVINGS</p>
                  <p className="text-2xl text-luxury-gold font-light">$240</p>
                </div>
              </div>
            </div>

            <div className="testimonial-luxury">
              <p className="testimonial-quote mb-8">
                "As a beauty content creator, authenticity matters.
                Seoul Sister sources directly from Korea, and the
                difference in my skin has been remarkable."
              </p>
              <div className="flex justify-between items-center">
                <div>
                  <p className="font-light">Emma R.</p>
                  <p className="text-caption">NEW YORK</p>
                </div>
                <div className="text-right">
                  <p className="text-caption">FIRST ORDER SAVED</p>
                  <p className="text-2xl text-luxury-gold font-light">$180</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Calculator Section - Minimalist */}
      <section className="section-light py-32">
        <div className="luxury-container">
          <div className="text-center mb-20">
            <p className="text-sm mb-4 font-medium tracking-widest" style={{color: '#D4A574'}}>CALCULATE</p>
            <h2 className="heading-section text-5xl md:text-6xl mb-8 text-luxury-black">
              Discover Your Savings
            </h2>
            <div className="gold-line mx-auto"></div>
          </div>

          <div className="max-w-2xl mx-auto">
            <div className="bg-white border p-12" style={{borderColor: '#D4A574'}}>
              <label className="block text-sm mb-4 font-medium tracking-widest" style={{color: '#D4A574'}}>
                ENTER US RETAIL PRICE
              </label>
              <input
                type="number"
                placeholder="94"
                defaultValue="94"
                className="w-full px-6 py-4 text-3xl font-light border text-center bg-white text-black focus:outline-none transition-colors"
                style={{borderColor: '#D4A574'}}
                onChange={(e) => {
                  const usPrice = parseFloat(e.target.value) || 94;
                  const seoulPrice = Math.round(usPrice * 0.3);
                  const savings = usPrice - seoulPrice - 25;

                  const resultDiv = document.getElementById('calc-result');
                  if (resultDiv) {
                    resultDiv.innerHTML = `
                      <div class="text-center space-y-8 py-8">
                        <div class="grid grid-cols-2 gap-8">
                          <div>
                            <p class="text-sm mb-2 font-medium tracking-widest" style="color: #888888">US RETAIL</p>
                            <p class="text-3xl font-light line-through text-gray-400">$${usPrice}</p>
                          </div>
                          <div>
                            <p class="text-sm mb-2 font-medium tracking-widest" style="color: #D4A574">SEOUL SISTER</p>
                            <p class="text-3xl font-light" style="color: #D4A574">$${seoulPrice + 25}</p>
                          </div>
                        </div>
                        <div class="pt-8 border-t" style="border-color: #D4A574">
                          <p class="text-sm mb-4 font-semibold tracking-widest" style="color: #D4A574">YOUR SAVINGS</p>
                          <p class="text-6xl" style="color: #D4A574; font-weight: 500">$${savings > 0 ? savings : 0}</p>
                        </div>
                      </div>
                    `;
                  }
                }}
              />
              <div id="calc-result" className="min-h-[200px] mt-8">
                <div className="text-center space-y-8 py-8">
                  <div className="grid grid-cols-2 gap-8">
                    <div>
                      <p className="text-sm mb-2 font-medium tracking-widest text-gray-500">US RETAIL</p>
                      <p className="text-3xl font-light line-through text-gray-400">$94</p>
                    </div>
                    <div>
                      <p className="text-sm mb-2 font-medium tracking-widest text-luxury-gold">SEOUL SISTER</p>
                      <p className="text-3xl font-light text-luxury-gold">$53</p>
                    </div>
                  </div>
                  <div className="pt-8 border-t border-luxury-gold">
                    <p className="text-sm mb-4 font-semibold tracking-widest text-luxury-gold">YOUR SAVINGS</p>
                    <p className="text-6xl font-medium text-luxury-gold">$41</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Viral Tools Section - Refined */}
      <section className="viral-tools-section py-32">
        <div className="luxury-container">
          <div className="text-center mb-20">
            <p className="text-caption mb-4">SHARE YOUR STORY</p>
            <h2 className="heading-section text-5xl md:text-6xl mb-8">
              Create Your Viral Moment
            </h2>
            <div className="gold-line mx-auto"></div>
          </div>

          <div className="grid md:grid-cols-2 gap-8 max-w-4xl mx-auto">
            <div className="viral-tool-card text-center">
              <h3 className="text-xl mb-4 font-light">Instagram Story Generator</h3>
              <p className="text-sm text-gray-400 mb-8">
                Create a luxury story showcasing your Seoul Sister savings
              </p>
              <Link href="/tools/screenshot">
                <button className="btn-luxury text-xs w-full">
                  CREATE STORY
                </button>
              </Link>
            </div>

            <div className="viral-tool-card text-center">
              <h3 className="text-xl mb-4 font-light">Viral Copy Generator</h3>
              <p className="text-sm text-gray-400 mb-8">
                Generate platform-specific content for TikTok, Instagram, and more
              </p>
              <Link href="/tools/copy">
                <button className="btn-luxury text-xs w-full">
                  GENERATE COPY
                </button>
              </Link>
            </div>
          </div>

          <div className="text-center mt-12">
            <p className="text-sm text-gray-500">
              Join 15K+ Seoul Sisters exposing beauty industry markups with style
            </p>
          </div>
        </div>
      </section>

      {/* Stats Section - Clean Numbers */}
      <section className="section-dark py-32">
        <div className="luxury-container">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-16 text-center">
            <div>
              <p className="text-4xl md:text-5xl font-light text-luxury-gold mb-4">15K+</p>
              <p className="text-caption">SEOUL SISTERS</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-light text-luxury-gold mb-4">$2.8M</p>
              <p className="text-caption">SAVED COLLECTIVELY</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-light text-luxury-gold mb-4">73%</p>
              <p className="text-caption">AVERAGE SAVINGS</p>
            </div>
            <div>
              <p className="text-4xl md:text-5xl font-light text-luxury-gold mb-4">4.9</p>
              <p className="text-caption">RATING</p>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA - Powerful Simplicity */}
      <section className="section-dark py-32 border-t border-luxury-charcoal">
        <div className="luxury-container text-center">
          <h2 className="heading-section text-5xl md:text-7xl mb-8 font-light">
            Join Seoul Sister
          </h2>
          <p className="text-xl font-light mb-12 max-w-2xl mx-auto">
            Exclusive access to authentic Korean beauty at insider prices.
            No markup. No compromise.
          </p>

          <Link href="/signup">
            <button className="btn-luxury-solid text-base">
              REQUEST INSIDER ACCESS
            </button>
          </Link>

          <p className="text-caption mt-8">
            LIMITED AVAILABILITY · INVITATION ONLY
          </p>
        </div>
      </section>

      {/* Footer - Minimal */}
      <footer className="section-dark py-16 border-t border-luxury-charcoal">
        <div className="luxury-container">
          <div className="grid md:grid-cols-4 gap-12">
            <div>
              <h3 className="text-caption mb-6">COLLECTION</h3>
              <div className="space-y-3">
                <Link href="/skincare" className="link-luxury block text-sm">Skincare</Link>
                <Link href="/makeup" className="link-luxury block text-sm">Makeup</Link>
                <Link href="/masks" className="link-luxury block text-sm">Masks</Link>
              </div>
            </div>

            <div>
              <h3 className="text-caption mb-6">ABOUT</h3>
              <div className="space-y-3">
                <Link href="/story" className="link-luxury block text-sm">Our Story</Link>
                <Link href="/authenticity" className="link-luxury block text-sm">Authenticity</Link>
                <Link href="/process" className="link-luxury block text-sm">Process</Link>
              </div>
            </div>

            <div>
              <h3 className="text-caption mb-6">SUPPORT</h3>
              <div className="space-y-3">
                <Link href="/contact" className="link-luxury block text-sm">Contact</Link>
                <Link href="/faq" className="link-luxury block text-sm">FAQ</Link>
                <Link href="/shipping" className="link-luxury block text-sm">Shipping</Link>
              </div>
            </div>

            <div>
              <h3 className="text-caption mb-6">INSIDER ACCESS</h3>
              <p className="text-sm text-gray-400 mb-6">
                Join 15K+ Seoul Sisters accessing authentic K-beauty at insider prices.
              </p>
              <Link href="/signup">
                <button className="btn-luxury text-xs w-full">
                  JOIN NOW
                </button>
              </Link>
            </div>
          </div>

          <div className="text-center mt-20 pt-8 border-t border-luxury-charcoal">
            <p className="text-caption">
              © 2025 SEOUL SISTER · AUTHENTIC KOREAN BEAUTY · INSIDER ACCESS ONLY
            </p>
          </div>
        </div>
      </footer>
    </main>
  )
}