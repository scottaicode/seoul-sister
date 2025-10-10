'use client'

import { useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

export default function WhatsAppAssistantPage() {
  const [phoneNumber, setPhoneNumber] = useState('')
  const [showDemo, setShowDemo] = useState(false)

  const whatsappNumber = process.env.NEXT_PUBLIC_WHATSAPP_NUMBER || '+1234567890'

  const features = [
    {
      icon: '📸',
      title: 'Instant Product ID',
      description: 'Snap any K-beauty product for instant Seoul vs US pricing',
      demo: '/demo/product-id.mp4'
    },
    {
      icon: '💰',
      title: 'Price Comparison',
      description: 'See exactly how much you save (usually 70%+)',
      demo: '/demo/price-compare.mp4'
    },
    {
      icon: '🔄',
      title: 'Smart Reordering',
      description: 'AI predicts when you\'ll run out and reminds you',
      demo: '/demo/reorder.mp4'
    },
    {
      icon: '🧪',
      title: 'Ingredient Analysis',
      description: 'Instant ingredient safety check for your skin type',
      demo: '/demo/ingredients.mp4'
    },
    {
      icon: '✨',
      title: 'Routine Builder',
      description: 'Get a personalized K-beauty routine in seconds',
      demo: '/demo/routine.mp4'
    },
    {
      icon: '📍',
      title: 'Shipping Calculator',
      description: 'Real-time shipping costs to your location',
      demo: '/demo/shipping.mp4'
    }
  ]

  const sampleConversations = [
    {
      user: 'photo of COSRX Snail Essence',
      assistant: '🎯 Found it! COSRX Snail 96 Mucin Essence\n💰 Seoul: $12 | Sephora: $89\nYou save $77 (74%)\nReply ORDER to get it!'
    },
    {
      user: 'price of Laneige lip mask',
      assistant: '💰 Laneige Lip Sleeping Mask:\nSeoul: $8 | US: $24\nSave 67%\nWe have Berry, Grapefruit, and Vanilla!'
    },
    {
      user: 'reorder',
      assistant: '🔄 Your favorites:\n1. Sulwhasoo Serum - $28\n2. Beauty of Joseon - $8.50\nReply 1, 2, or ALL to reorder!'
    },
    {
      user: 'what\'s niacinamide good for?',
      assistant: '🧪 Niacinamide (Vitamin B3):\n✅ Minimizes pores\n✅ Evens skin tone\n✅ Controls oil\nGreat for all skin types!'
    }
  ]

  const handleStartChat = () => {
    const message = encodeURIComponent(
      "Hi! I just discovered Seoul Sister and I'm ready to save 70% on K-beauty! 💅"
    )
    window.open(`https://wa.me/${whatsappNumber.replace(/[^0-9]/g, '')}?text=${message}`, '_blank')
  }

  return (
    <div className="min-h-screen bg-black">
      {/* Hero Section */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-[#D4A574]/10 to-transparent" />

        <div className="max-w-7xl mx-auto px-4 pt-20 pb-16">
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 px-4 py-2 bg-green-500/10 border border-green-500/20 rounded-full mb-6">
              <span className="text-green-400 text-sm font-medium">WhatsApp AI Assistant</span>
              <span className="text-xs text-green-400/60">LIVE NOW</span>
            </div>

            <h1 className="text-5xl md:text-7xl font-light text-white mb-6 tracking-tight">
              Your Personal
              <span className="block text-[#D4A574] mt-2">K-Beauty Genius</span>
            </h1>

            <p className="text-xl text-white/60 max-w-2xl mx-auto mb-8">
              24/7 AI assistant that identifies products, compares prices,
              and builds your perfect routine—all through WhatsApp
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <button
                onClick={handleStartChat}
                className="px-8 py-4 bg-green-500 text-white rounded-full font-medium hover:bg-green-600 transition-all transform hover:scale-105 flex items-center gap-3"
              >
                <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.149-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                Start WhatsApp Chat
              </button>

              <button
                onClick={() => setShowDemo(!showDemo)}
                className="px-8 py-4 border border-[#D4A574] text-[#D4A574] rounded-full font-medium hover:bg-[#D4A574]/10 transition-all"
              >
                Watch Demo
              </button>
            </div>

            {/* Phone Number Input */}
            <div className="mt-8 max-w-md mx-auto">
              <p className="text-white/40 text-sm mb-3">Or save our number:</p>
              <div className="flex items-center gap-3 bg-zinc-900/50 border border-[#D4A574]/20 rounded-full px-4 py-3">
                <span className="text-green-400">📱</span>
                <input
                  type="tel"
                  value={whatsappNumber}
                  readOnly
                  className="flex-1 bg-transparent text-white outline-none"
                />
                <button
                  onClick={() => navigator.clipboard.writeText(whatsappNumber)}
                  className="text-[#D4A574] hover:text-white transition-colors"
                >
                  Copy
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Features Grid */}
      <div className="py-20 border-t border-[#D4A574]/10">
        <div className="max-w-7xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs text-[#D4A574]/60 uppercase tracking-widest mb-4">
              AI-Powered Features
            </p>
            <h2 className="text-4xl font-light text-white">
              Your 24/7 Beauty Assistant
            </h2>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {features.map((feature, index) => (
              <div
                key={index}
                className="bg-zinc-900/50 border border-[#D4A574]/20 rounded-xl p-6 hover:border-[#D4A574]/40 transition-all"
              >
                <div className="text-4xl mb-4">{feature.icon}</div>
                <h3 className="text-xl text-white mb-2">{feature.title}</h3>
                <p className="text-white/60">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Sample Conversations */}
      <div className="py-20 bg-zinc-900/30">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs text-[#D4A574]/60 uppercase tracking-widest mb-4">
              Real Conversations
            </p>
            <h2 className="text-4xl font-light text-white">
              See It In Action
            </h2>
          </div>

          <div className="space-y-6">
            {sampleConversations.map((convo, index) => (
              <div key={index} className="space-y-4">
                {/* User Message */}
                <div className="flex justify-end">
                  <div className="max-w-xs bg-green-500 text-white rounded-2xl rounded-br-none px-4 py-3">
                    <p className="text-sm">{convo.user}</p>
                  </div>
                </div>

                {/* Assistant Response */}
                <div className="flex justify-start">
                  <div className="max-w-sm bg-zinc-800 text-white rounded-2xl rounded-bl-none px-4 py-3">
                    <p className="text-sm whitespace-pre-line">{convo.assistant}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="py-20 border-t border-[#D4A574]/10">
        <div className="max-w-4xl mx-auto px-4">
          <div className="text-center mb-12">
            <p className="text-xs text-[#D4A574]/60 uppercase tracking-widest mb-4">
              Getting Started
            </p>
            <h2 className="text-4xl font-light text-white">
              Three Simple Steps
            </h2>
          </div>

          <div className="space-y-8">
            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-[#D4A574] rounded-full flex items-center justify-center text-black font-bold">
                1
              </div>
              <div>
                <h3 className="text-xl text-white mb-2">Add Our WhatsApp</h3>
                <p className="text-white/60">
                  Click the button above or save {whatsappNumber} to your contacts
                </p>
              </div>
            </div>

            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-[#D4A574] rounded-full flex items-center justify-center text-black font-bold">
                2
              </div>
              <div>
                <h3 className="text-xl text-white mb-2">Send a Photo or Question</h3>
                <p className="text-white/60">
                  Snap any K-beauty product or ask about prices, ingredients, or routines
                </p>
              </div>
            </div>

            <div className="flex items-start gap-6">
              <div className="flex-shrink-0 w-12 h-12 bg-[#D4A574] rounded-full flex items-center justify-center text-black font-bold">
                3
              </div>
              <div>
                <h3 className="text-xl text-white mb-2">Get Instant Seoul Prices</h3>
                <p className="text-white/60">
                  See how much you save and order at 70% off US retail prices
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Benefits */}
      <div className="py-20 bg-gradient-to-b from-transparent to-[#D4A574]/5">
        <div className="max-w-4xl mx-auto px-4">
          <div className="bg-zinc-900/50 border border-[#D4A574]/20 rounded-2xl p-8 md:p-12">
            <div className="text-center mb-8">
              <h2 className="text-3xl font-light text-white mb-4">
                Why Use Our AI Assistant?
              </h2>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              <div className="flex items-start gap-4">
                <span className="text-green-400">✓</span>
                <div>
                  <h4 className="text-white mb-1">Available 24/7</h4>
                  <p className="text-white/60 text-sm">Get instant help anytime, anywhere</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="text-green-400">✓</span>
                <div>
                  <h4 className="text-white mb-1">99.7% Accurate</h4>
                  <p className="text-white/60 text-sm">AI-powered product identification</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="text-green-400">✓</span>
                <div>
                  <h4 className="text-white mb-1">Learns Your Preferences</h4>
                  <p className="text-white/60 text-sm">Gets smarter with every interaction</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="text-green-400">✓</span>
                <div>
                  <h4 className="text-white mb-1">Seoul Direct Prices</h4>
                  <p className="text-white/60 text-sm">Save 70%+ on every product</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="text-green-400">✓</span>
                <div>
                  <h4 className="text-white mb-1">No App Download</h4>
                  <p className="text-white/60 text-sm">Works directly in WhatsApp</p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <span className="text-green-400">✓</span>
                <div>
                  <h4 className="text-white mb-1">Privacy First</h4>
                  <p className="text-white/60 text-sm">Your data stays secure</p>
                </div>
              </div>
            </div>

            <div className="mt-8 text-center">
              <button
                onClick={handleStartChat}
                className="px-8 py-4 bg-[#D4A574] text-black rounded-full font-medium hover:bg-[#D4A574]/80 transition-all inline-flex items-center gap-3"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                  <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.149-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
                </svg>
                Try It Now - It\'s Free!
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Footer CTA */}
      <div className="py-12 border-t border-[#D4A574]/10">
        <div className="max-w-4xl mx-auto px-4 text-center">
          <p className="text-white/60 mb-4">
            Join 10,000+ Seoul Sisters saving 70% on K-beauty
          </p>
          <Link
            href="/"
            className="text-[#D4A574] hover:text-white transition-colors"
          >
            Back to Homepage →
          </Link>
        </div>
      </div>
    </div>
  )
}