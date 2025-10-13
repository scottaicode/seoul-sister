'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getStripe } from '@/lib/stripe'
import { Elements } from '@stripe/react-stripe-js'
import PaymentMethodForm from '@/components/PaymentMethodForm'
import Link from 'next/link'

export default function SignupPage() {
  const [step, setStep] = useState(1)
  const [formData, setFormData] = useState({
    email: '',
    firstName: '',
    lastName: '',
    phone: '',
    instagramHandle: '',
    referralCode: ''
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [userId, setUserId] = useState<string | null>(null)

  const stripePromise = getStripe()

  const handleAccountCreation = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      // Sign up with Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: generateTemporaryPassword(), // We'll use magic links later
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            phone: formData.phone,
            instagram_handle: formData.instagramHandle,
            referred_by: formData.referralCode || null
          }
        }
      })

      if (signUpError) throw signUpError

      if (data.user) {
        setUserId(data.user.id)
        setStep(2)
      }
    } catch (err: any) {
      setError(err.message || 'Failed to create account')
    } finally {
      setLoading(false)
    }
  }

  const handlePaymentMethodSaved = () => {
    setStep(3)
  }

  const generateTemporaryPassword = () => {
    return Math.random().toString(36).slice(-8) + Math.random().toString(36).slice(-8)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value
    }))
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-black via-luxury-charcoal to-black py-12 px-4">
      <div className="max-w-md mx-auto">
        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center mb-6">
            <Link
              href="/"
              className="flex items-center text-gray-300 hover:text-luxury-gold transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
              Back to Home
            </Link>
          </div>
          <div className="text-center">
            <Link href="/" className="text-2xl font-bold text-white tracking-wide">
              Seoul Sister
            </Link>
            <h1 className="text-2xl font-bold text-white mt-4 tracking-wide">
              Premium Membership
            </h1>
            <p className="text-gray-300 mt-2 font-light">
              $20/month • 7-day FREE trial • Cancel anytime
            </p>
          </div>
        </div>

        {/* Progress Indicator */}
        <div className="flex items-center justify-center mb-8">
          <div className="flex items-center space-x-4">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step >= 1 ? 'bg-luxury-gold text-black' : 'bg-luxury-charcoal text-gray-400'
            }`}>
              1
            </div>
            <div className={`w-16 h-1 ${step >= 2 ? 'bg-luxury-gold' : 'bg-luxury-charcoal'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step >= 2 ? 'bg-luxury-gold text-black' : 'bg-luxury-charcoal text-gray-400'
            }`}>
              2
            </div>
            <div className={`w-16 h-1 ${step >= 3 ? 'bg-luxury-gold' : 'bg-luxury-charcoal'}`}></div>
            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold ${
              step >= 3 ? 'bg-luxury-gold text-black' : 'bg-luxury-charcoal text-gray-400'
            }`}>
              3
            </div>
          </div>
        </div>

        {/* Step 1: Account Information */}
        {step === 1 && (
          <div className="bg-luxury-charcoal/20 rounded-xl p-8 border border-luxury-gold/20 backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-2 text-white tracking-wide">Start Your Free Trial</h2>
            <p className="text-gray-400 mb-6 text-sm">
              7 days free, then $20/month. Full access to AI features, personalized recommendations, and Seoul wholesale pricing.
            </p>

            {error && (
              <div className="bg-red-900/20 border border-red-700 text-red-400 px-4 py-3 rounded-lg mb-6">
                {error}
              </div>
            )}

            <form onSubmit={handleAccountCreation} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    First Name *
                  </label>
                  <input
                    type="text"
                    name="firstName"
                    value={formData.firstName}
                    onChange={handleInputChange}
                    required
                    className="w-full p-3 bg-luxury-charcoal/30 border border-luxury-gold/30 rounded-lg focus:ring-2 focus:ring-luxury-gold focus:border-luxury-gold text-white placeholder-gray-400"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-300 mb-1">
                    Last Name *
                  </label>
                  <input
                    type="text"
                    name="lastName"
                    value={formData.lastName}
                    onChange={handleInputChange}
                    required
                    className="w-full p-3 bg-luxury-charcoal/30 border border-luxury-gold/30 rounded-lg focus:ring-2 focus:ring-luxury-gold focus:border-luxury-gold text-white placeholder-gray-400"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Email Address *
                </label>
                <input
                  type="email"
                  name="email"
                  value={formData.email}
                  onChange={handleInputChange}
                  required
                  className="w-full p-3 bg-luxury-charcoal/30 border border-luxury-gold/30 rounded-lg focus:ring-2 focus:ring-luxury-gold focus:border-luxury-gold text-white placeholder-gray-400"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  name="phone"
                  value={formData.phone}
                  onChange={handleInputChange}
                  required
                  className="w-full p-3 bg-luxury-charcoal/30 border border-luxury-gold/30 rounded-lg focus:ring-2 focus:ring-luxury-gold focus:border-luxury-gold text-white placeholder-gray-400"
                  placeholder="+1 (555) 123-4567"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Instagram Handle
                </label>
                <input
                  type="text"
                  name="instagramHandle"
                  value={formData.instagramHandle}
                  onChange={handleInputChange}
                  className="w-full p-3 bg-luxury-charcoal/30 border border-luxury-gold/30 rounded-lg focus:ring-2 focus:ring-luxury-gold focus:border-luxury-gold text-white placeholder-gray-400"
                  placeholder="@yourusername"
                />
                <p className="text-xs text-gray-400 mt-1">
                  Required for viral sharing after your first order
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1">
                  Referral Code (Optional)
                </label>
                <input
                  type="text"
                  name="referralCode"
                  value={formData.referralCode}
                  onChange={handleInputChange}
                  className="w-full p-3 bg-luxury-charcoal/30 border border-luxury-gold/30 rounded-lg focus:ring-2 focus:ring-luxury-gold focus:border-luxury-gold text-white placeholder-gray-400"
                  placeholder="Enter referral code"
                />
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full bg-luxury-gold text-black font-semibold py-3 px-6 rounded-lg hover:bg-luxury-gold/90 transition-all disabled:opacity-50 shadow-lg tracking-wide"
              >
                {loading ? 'Creating Account...' : 'Start Free Trial'}
              </button>
            </form>

            <p className="text-xs text-gray-400 text-center mt-6">
              By continuing, you agree to our Terms of Service and Privacy Policy.
              Free for 7 days, then $20/month. Cancel anytime during trial.
            </p>
          </div>
        )}

        {/* Step 2: Payment Method */}
        {step === 2 && userId && (
          <div className="bg-luxury-charcoal/20 rounded-xl p-8 border border-luxury-gold/20 backdrop-blur-sm">
            <h2 className="text-xl font-semibold mb-6 text-white tracking-wide">Setup Payment Method</h2>
            <p className="text-gray-300 mb-6 font-light">
              Securely save your payment method for your subscription.
              Your 7-day free trial starts now. You'll be charged $20/month after the trial ends.
            </p>

            <Elements stripe={stripePromise}>
              <PaymentMethodForm
                userId={userId}
                onSuccess={handlePaymentMethodSaved}
              />
            </Elements>
          </div>
        )}

        {/* Step 3: Success */}
        {step === 3 && (
          <div className="bg-luxury-charcoal/20 rounded-xl border border-luxury-gold/20 backdrop-blur-sm p-8 text-center">
            <div className="w-16 h-16 bg-luxury-gold/20 border border-luxury-gold/30 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-luxury-gold" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
            </div>

            <h2 className="text-2xl font-semibold mb-4 text-white tracking-wide">
              Welcome to Seoul Sister!
            </h2>

            <p className="text-gray-300 mb-8 font-light">
              Your premium membership is active! Enjoy your 7-day free trial with full access to AI skin analysis, personalized recommendations, and Seoul wholesale pricing.
            </p>

            <div className="bg-luxury-gold/10 border border-luxury-gold/30 text-luxury-gold p-6 rounded-lg mb-8">
              <h3 className="font-semibold mb-2">Your Premium Membership Includes:</h3>
              <ol className="text-left space-y-2 text-sm">
                <li>1. ✨ AI-powered skin analysis and personalized recommendations</li>
                <li>2. 📱 WhatsApp ordering with Seoul wholesale pricing (+1 555-SEOUL-1)</li>
                <li>3. 🎯 Ingredient compatibility analysis and allergen detection</li>
                <li>4. 🔄 Continuous updates on trending Korean beauty products</li>
              </ol>
            </div>

            <div className="space-y-4">
              <a
                href="https://wa.me/15557365641"
                target="_blank"
                rel="noopener noreferrer"
                className="block w-full bg-green-500 hover:bg-green-600 text-white font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Start Ordering on WhatsApp
              </a>

              <Link
                href="/products"
                className="block w-full bg-luxury-charcoal/30 hover:bg-luxury-charcoal/50 border border-luxury-gold/30 text-gray-300 font-semibold py-3 px-6 rounded-lg transition-colors"
              >
                Browse Product Catalog
              </Link>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}