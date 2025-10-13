'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import ViralScreenshotGenerator from '../components/ViralScreenshotGenerator'
import ViralCopyGenerator from '../components/ViralCopyGenerator'
import AuthHeader from '../components/AuthHeader'
import { useProducts } from '@/hooks/useProducts'

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

const staticProducts: Product[] = [
  {
    id: '1',
    name_english: 'First Care Activating Serum',
    brand: 'Sulwhasoo',
    seoul_price: 28.00,
    us_price: 94.00,
    savings_percentage: 70,
    image_url: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600&h=600&fit=crop',
    category: 'Serum'
  },
  {
    id: '2',
    name_english: 'Glow Deep Serum',
    brand: 'Beauty of Joseon',
    seoul_price: 8.00,
    us_price: 45.00,
    savings_percentage: 82,
    image_url: 'https://images.unsplash.com/photo-1556228720-195a672e8a03?w=600&h=600&fit=crop',
    category: 'Serum'
  },
  {
    id: '3',
    name_english: 'Snail 96 Mucin Essence',
    brand: 'COSRX',
    seoul_price: 23.00,
    us_price: 89.00,
    savings_percentage: 74,
    image_url: 'https://images.unsplash.com/photo-1571781926291-c477ebfd024b?w=600&h=600&fit=crop',
    category: 'Essence'
  },
  {
    id: '4',
    name_english: 'Water Sleeping Mask',
    brand: 'Laneige',
    seoul_price: 12.00,
    us_price: 34.00,
    savings_percentage: 65,
    image_url: 'https://images.unsplash.com/photo-1570172619644-dfd03ed5d881?w=600&h=600&fit=crop',
    category: 'Mask'
  }
]

export default function HomePage() {
  const [currentProductIndex, setCurrentProductIndex] = useState(0)
  const [isScrolled, setIsScrolled] = useState(false)
  const [showViralTools, setShowViralTools] = useState(false)
  const { products, loading } = useProducts(true)

  // Use products from database
  const featuredProducts = products

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
      {/* Authentication Header */}
      <AuthHeader />

      {/* Hero Section - Refined Minimalism */}
      <section className="hero-section relative flex items-center justify-center">
        <div className="luxury-container text-center z-10 relative">
          <div className="animate-reveal">
            <p style={{
              fontSize: '11px',
              letterSpacing: '0.2em',
              textTransform: 'uppercase',
              color: '#d4a574',
              fontFamily: 'Inter, sans-serif',
              fontWeight: '400',
              marginBottom: '3rem',
              opacity: '0.9'
            }}>
              EXCLUSIVE ACCESS TO SEOUL'S BEAUTY SECRETS
            </p>

            <h1 style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: 'clamp(3.5rem, 8vw, 7rem)',
              fontWeight: '200',
              letterSpacing: '0.02em',
              lineHeight: '1',
              marginBottom: '2rem',
              color: '#ffffff'
            }}>
              Seoul Sister
            </h1>

            <div style={{
              width: '40px',
              height: '1px',
              background: '#d4a574',
              margin: '3rem auto',
              opacity: '0.6'
            }}></div>

            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '20px',
              fontWeight: '300',
              lineHeight: '1.6',
              marginBottom: '0.5rem',
              color: '#ffffff',
              opacity: '0.9'
            }}>
              The same luxury K-beauty Seoul insiders trust,
            </p>
            <p style={{
              fontFamily: 'Inter, sans-serif',
              fontSize: '20px',
              fontWeight: '300',
              lineHeight: '1.6',
              marginBottom: '4rem',
              color: '#ffffff',
              opacity: '0.9'
            }}>
              without the <span style={{ color: '#d4a574' }}>300% markup</span>
            </p>

            {/* Single Premium Membership CTA */}
            <div className="text-center max-w-2xl mx-auto">
              <Link href="/signup">
                <button style={{
                  background: '#d4a574',
                  color: '#000000',
                  border: 'none',
                  padding: '20px 60px',
                  fontSize: '14px',
                  fontFamily: 'Inter, sans-serif',
                  fontWeight: '600',
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  cursor: 'pointer',
                  transition: 'all 0.3s ease',
                  borderRadius: '4px',
                  boxShadow: '0 8px 32px rgba(212, 165, 116, 0.3)'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#b8956a'
                  e.currentTarget.style.transform = 'translateY(-2px)'
                  e.currentTarget.style.boxShadow = '0 12px 48px rgba(212, 165, 116, 0.4)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#d4a574'
                  e.currentTarget.style.transform = 'translateY(0px)'
                  e.currentTarget.style.boxShadow = '0 8px 32px rgba(212, 165, 116, 0.3)'
                }}>
                  JOIN SEOUL SISTER
                </button>
              </Link>

              <div style={{
                marginTop: '24px',
                textAlign: 'center'
              }}>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '18px',
                  color: '#d4a574',
                  marginBottom: '8px',
                  fontWeight: '500'
                }}>
                  $20/month • 7-day FREE trial
                </p>
                <p style={{
                  fontFamily: 'Inter, sans-serif',
                  fontSize: '14px',
                  color: '#888888',
                  lineHeight: '1.6',
                  fontWeight: '300',
                  maxWidth: '480px',
                  margin: '0 auto'
                }}>
                  Advanced skin intelligence • Personalized recommendations • Wholesale Seoul pricing • WhatsApp ordering • Cancel anytime
                </p>
              </div>
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
                <div className="image-luxury mb-8 h-64 bg-luxury-black-soft relative">
                  <Image
                    src={product.image_url || '/images/placeholder.svg'}
                    alt={product.image_url ? `${product.brand} ${product.name_english}` : `${product.brand} ${product.name_english} - Image not available`}
                    width={400}
                    height={400}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      // Fallback to placeholder if image fails to load
                      e.currentTarget.src = '/images/placeholder.svg'
                    }}
                  />
                  {!product.image_url && (
                    <div className="absolute bottom-2 left-2 right-2">
                      <div className="bg-black bg-opacity-75 text-yellow-500 text-xs px-2 py-1 text-center rounded">
                        Verified Seoul pricing • Authentic product information
                      </div>
                    </div>
                  )}
                </div>

                <p className="text-caption mb-2">{product.brand.toUpperCase()}</p>
                <h3 className="text-lg mb-6 font-light">{product.name_english}</h3>

                <div className="space-y-2 mb-8">
                  <p className="price-original text-sm">
                    US RETAIL ${product.us_price}
                  </p>
                  <p className="price-seoul text-2xl">
                    ${product.seoul_price.toFixed(2)}
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

          <div className="grid md:grid-cols-2 gap-2 md:gap-2 max-w-5xl mx-auto">
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
                className="calculator-input w-full px-6 py-4 text-3xl font-light border text-center bg-white text-black focus:outline-none"
                style={{borderColor: '#D4A574'}}
                onChange={(e) => {
                  const usPrice = parseFloat(e.target.value) || 94;
                  const seoulPrice = Math.round(usPrice * 0.3);
                  const savings = usPrice - seoulPrice - 25;

                  const resultDiv = document.getElementById('calc-result');
                  if (resultDiv) {
                    // Add animation class before updating
                    resultDiv.style.opacity = '0.5';
                    resultDiv.style.transform = 'scale(0.98)';

                    setTimeout(() => {
                      resultDiv.innerHTML = `
                        <div class="text-center space-y-8 py-8">
                          <div class="grid grid-cols-2 gap-8">
                            <div class="calculator-price-item">
                              <p class="text-sm mb-2 font-medium tracking-widest text-gray-500">US RETAIL</p>
                              <p class="calculator-price text-3xl font-light line-through text-gray-400">$${usPrice}</p>
                            </div>
                            <div class="calculator-price-item">
                              <p class="text-sm mb-2 font-medium tracking-widest text-luxury-gold">SEOUL SISTER</p>
                              <p class="calculator-price text-3xl font-light text-luxury-gold">$${seoulPrice + 25}</p>
                            </div>
                          </div>
                          <div class="pt-8 border-t border-luxury-gold">
                            <p class="text-sm mb-4 font-semibold tracking-widest text-luxury-gold">YOUR SAVINGS</p>
                            <p class="calculator-savings text-6xl font-medium text-luxury-gold">$${savings > 0 ? savings : 0}</p>
                            <div class="savings-percentage mt-2">
                              <span class="badge-insider">${Math.round(((savings / usPrice) * 100))}% SAVED</span>
                            </div>
                          </div>
                        </div>
                      `;

                      // Restore and animate
                      resultDiv.style.opacity = '1';
                      resultDiv.style.transform = 'scale(1)';
                      resultDiv.style.transition = 'all 0.4s cubic-bezier(0.165, 0.84, 0.44, 1)';
                    }, 150);
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
              <p className="stats-number text-4xl md:text-5xl font-light text-luxury-gold mb-4">15K+</p>
              <p className="text-caption">SEOUL SISTERS</p>
            </div>
            <div>
              <p className="stats-number text-4xl md:text-5xl font-light text-luxury-gold mb-4">$2.8M</p>
              <p className="text-caption">SAVED COLLECTIVELY</p>
            </div>
            <div>
              <p className="stats-number text-4xl md:text-5xl font-light text-luxury-gold mb-4">73%</p>
              <p className="text-caption">AVERAGE SAVINGS</p>
            </div>
            <div>
              <p className="stats-number text-4xl md:text-5xl font-light text-luxury-gold mb-4">4.9</p>
              <p className="text-caption">RATING</p>
            </div>
          </div>
        </div>
      </section>

      {/* AI Features Section */}
      <section className="section-dark py-32 border-t border-luxury-charcoal">
        <div className="luxury-container">
          <div className="text-center mb-20">
            <p className="text-caption mb-4 text-luxury-gold">ADVANCED SKIN SCIENCE</p>
            <h2 className="heading-section text-4xl md:text-6xl mb-8 font-light">
              Personalized Intelligence
            </h2>
            <div className="gold-line mx-auto mb-8"></div>
            <p className="text-xl font-light mb-12 max-w-3xl mx-auto text-gray-300">
              Get personalized Korean skincare recommendations based on your unique skin analysis.
              Our advanced skin intelligence matches you with products that work for your specific skin type and concerns.
            </p>
          </div>

          <div className="grid md:grid-cols-3 gap-8 mb-16">
            <div className="bg-luxury-charcoal/30 p-8 rounded-lg border border-luxury-charcoal">
              <div className="text-4xl mb-4">🔬</div>
              <h3 className="text-xl font-semibold mb-4 text-luxury-gold">Advanced Skin Analysis</h3>
              <p className="text-gray-300 mb-6">
                Upload your photo for advanced digital skin analysis. Get detailed insights about your skin type, concerns, and perfect product matches.
              </p>
              <Link href="/skin-analysis" className="inline-block">
                <button className="btn-luxury text-sm">START ANALYSIS</button>
              </Link>
            </div>

            <div className="bg-luxury-charcoal/30 p-8 rounded-lg border border-luxury-charcoal">
              <div className="text-4xl mb-4">👤</div>
              <h3 className="text-xl font-semibold mb-4 text-luxury-gold">Personal Profile</h3>
              <p className="text-gray-300 mb-6">
                Create your detailed skin profile with concerns, preferences, and goals. Get increasingly accurate recommendations over time.
              </p>
              <Link href="/skin-profile" className="inline-block">
                <button className="btn-luxury text-sm">CREATE PROFILE</button>
              </Link>
            </div>

            <div className="bg-luxury-charcoal/30 p-8 rounded-lg border border-luxury-charcoal">
              <div className="text-4xl mb-4">✨</div>
              <h3 className="text-xl font-semibold mb-4 text-luxury-gold">Smart Dashboard</h3>
              <p className="text-gray-300 mb-6">
                Access your personalized beauty hub with smart recommendations, ingredient analysis, and curated product matches.
              </p>
              <Link href="/personalized-dashboard" className="inline-block">
                <button className="btn-luxury text-sm">VIEW DASHBOARD</button>
              </Link>
            </div>
          </div>

          <div className="text-center">
            <p className="text-gray-400 text-sm">
              Advanced Skin Science • Personalized for Your Unique Skin
            </p>
          </div>
        </div>
      </section>

      {/* FAQ Section - Minimal */}
      <section className="section-light py-32">
        <div className="luxury-container">
          <div className="text-center mb-20">
            <p className="text-caption mb-4 text-luxury-charcoal">FREQUENTLY ASKED</p>
            <h2 className="heading-section text-5xl md:text-6xl mb-8 text-luxury-black">
              Questions
            </h2>
            <div className="gold-line mx-auto"></div>
          </div>

          <div className="max-w-4xl mx-auto space-y-2">
            <div className="faq-item bg-white border border-gray-200 transition-all duration-300 hover:border-luxury-gold">
              <button className="w-full text-left p-8 focus:outline-none">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-light text-luxury-black">How do I know products are authentic?</h3>
                  <span className="text-luxury-gold text-2xl">+</span>
                </div>
              </button>
              <div className="px-8 pb-8">
                <p className="text-luxury-charcoal leading-relaxed">
                  Every product comes with authenticity certificates directly from Korean manufacturers.
                  We maintain exclusive partnerships with Seoul's most trusted beauty suppliers in Myeongdong,
                  ensuring 100% authentic products that meet Korean regulatory standards.
                </p>
              </div>
            </div>

            <div className="faq-item bg-white border border-gray-200 transition-all duration-300 hover:border-luxury-gold">
              <button className="w-full text-left p-8 focus:outline-none">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-light text-luxury-black">What's included in the $20/month membership?</h3>
                  <span className="text-luxury-gold text-2xl">+</span>
                </div>
              </button>
              <div className="px-8 pb-8">
                <p className="text-luxury-charcoal leading-relaxed">
                  Your premium membership includes advanced skin analysis, personalized K-beauty recommendations,
                  ingredient compatibility checking, access to Seoul wholesale pricing, WhatsApp ordering service,
                  and continuous updates on trending Korean beauty products.
                </p>
              </div>
            </div>

            <div className="faq-item bg-white border border-gray-200 transition-all duration-300 hover:border-luxury-gold">
              <button className="w-full text-left p-8 focus:outline-none">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-light text-luxury-black">How long does delivery take?</h3>
                  <span className="text-luxury-gold text-2xl">+</span>
                </div>
              </button>
              <div className="px-8 pb-8">
                <p className="text-luxury-charcoal leading-relaxed">
                  Orders are sourced and shipped from Seoul within 3-5 business days.
                  International delivery typically takes 7-14 days with full tracking.
                  Rush delivery options available for time-sensitive orders.
                </p>
              </div>
            </div>

            <div className="faq-item bg-white border border-gray-200 transition-all duration-300 hover:border-luxury-gold">
              <button className="w-full text-left p-8 focus:outline-none">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-light text-luxury-black">Can I return or exchange products?</h3>
                  <span className="text-luxury-gold text-2xl">+</span>
                </div>
              </button>
              <div className="px-8 pb-8">
                <p className="text-luxury-charcoal leading-relaxed">
                  We offer a 30-day satisfaction guarantee. If you're not completely satisfied,
                  we'll work with you on exchanges or refunds. However, due to international
                  sourcing, we recommend checking product details carefully before ordering.
                </p>
              </div>
            </div>

            <div className="faq-item bg-white border border-gray-200 transition-all duration-300 hover:border-luxury-gold">
              <button className="w-full text-left p-8 focus:outline-none">
                <div className="flex justify-between items-center">
                  <h3 className="text-lg font-light text-luxury-black">Why are Seoul prices so much lower?</h3>
                  <span className="text-luxury-gold text-2xl">+</span>
                </div>
              </button>
              <div className="px-8 pb-8">
                <p className="text-luxury-charcoal leading-relaxed">
                  Korean beauty brands sell at wholesale prices in their home market.
                  US retailers add 300-500% markup for import, distribution, and retail margins.
                  Seoul Sister eliminates these middlemen, passing authentic Seoul prices to you.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA - Premium Membership */}
      <section className="section-dark py-32 border-t border-luxury-charcoal">
        <div className="luxury-container text-center">
          <h2 className="heading-section text-5xl md:text-7xl mb-8 font-light">
            Join Seoul Sister
          </h2>
          <p className="text-xl font-light mb-8 max-w-2xl mx-auto">
            Premium membership combining AI-powered personalization with authentic Seoul wholesale access.
          </p>

          <div className="mb-8">
            <p className="text-2xl font-light text-luxury-gold mb-2">
              $20/month with 7-day FREE trial
            </p>
            <p className="text-gray-400">
              Cancel anytime • No hidden fees • Full feature access during trial
            </p>
          </div>

          <Link href="/signup">
            <button className="btn-luxury-solid text-base">
              START FREE TRIAL
            </button>
          </Link>

          <p className="text-caption mt-8">
            ADVANCED ANALYSIS • PERSONALIZED RECOMMENDATIONS • SEOUL PRICING
          </p>
        </div>
      </section>

      {/* Footer - Minimal */}
      <footer className="section-dark py-16 border-t border-luxury-charcoal">
        <div className="luxury-container">
          <div className="grid md:grid-cols-4 gap-12">
            <div>
              <h3 className="text-caption mb-6">AI FEATURES</h3>
              <div className="space-y-3">
                <Link href="/skin-analysis" className="link-luxury block text-sm">Skin Analysis</Link>
                <Link href="/personalized-dashboard" className="link-luxury block text-sm">Personal Dashboard</Link>
                <Link href="/skin-profile" className="link-luxury block text-sm">Skin Profile</Link>
                <Link href="/admin/ai-features" className="link-luxury block text-sm opacity-75">Admin Portal</Link>
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

      {/* Floating AI Assistant Button - Luxury Theme */}
      <div className="fixed bottom-6 right-6 z-50">
        <Link
          href="/personalized-dashboard"
          className="flex items-center gap-3 bg-gradient-to-r from-luxury-charcoal to-black border border-luxury-gold/30 text-luxury-gold px-6 py-4 rounded-full shadow-2xl hover:shadow-luxury-gold/20 transition-all duration-300 hover:scale-105 backdrop-blur-sm"
        >
          <div className="text-2xl">✨</div>
          <div className="hidden md:block">
            <div className="font-semibold text-sm tracking-wide">AI BEAUTY ADVISOR</div>
            <div className="text-xs opacity-75 font-light">Personalized Intelligence</div>
          </div>
        </Link>
      </div>
    </main>
  )
}