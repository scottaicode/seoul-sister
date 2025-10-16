'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'

export default function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)
  const [preferences, setPreferences] = useState({
    necessary: true,
    analytics: false,
    marketing: false
  })
  const [showPreferences, setShowPreferences] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem('seoul-sister-cookie-consent')
    if (!consent) {
      setShowBanner(true)
    }
  }, [])

  const acceptAll = () => {
    const consent = {
      necessary: true,
      analytics: true,
      marketing: true,
      timestamp: Date.now()
    }
    localStorage.setItem('seoul-sister-cookie-consent', JSON.stringify(consent))
    setShowBanner(false)

    // Initialize analytics if accepted
    if (consent.analytics && typeof window !== 'undefined') {
      // Google Analytics or other analytics initialization would go here
      console.log('Analytics consent granted')
    }
  }

  const acceptSelected = () => {
    const consent = {
      ...preferences,
      timestamp: Date.now()
    }
    localStorage.setItem('seoul-sister-cookie-consent', JSON.stringify(consent))
    setShowBanner(false)
    setShowPreferences(false)

    // Initialize analytics if accepted
    if (consent.analytics && typeof window !== 'undefined') {
      console.log('Analytics consent granted')
    }
  }

  const rejectAll = () => {
    const consent = {
      necessary: true,
      analytics: false,
      marketing: false,
      timestamp: Date.now()
    }
    localStorage.setItem('seoul-sister-cookie-consent', JSON.stringify(consent))
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4">
      <div className="max-w-6xl mx-auto">
        <div className="bg-luxury-charcoal/95 backdrop-blur-sm border border-luxury-gold/30 rounded-xl p-6 shadow-2xl">
          {!showPreferences ? (
            // Main banner
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
              <div className="flex-1">
                <h3 className="text-lg font-semibold text-white mb-2 tracking-wide">
                  🍪 We Value Your Privacy
                </h3>
                <p className="text-gray-300 font-light text-sm leading-relaxed">
                  Seoul Sister uses cookies and similar technologies to provide personalized beauty recommendations,
                  analyze usage patterns, and improve your experience. Some cookies are essential for our AI skin analysis
                  and subscription features to work properly.
                </p>
                <div className="mt-3 text-xs text-gray-400">
                  <Link href="/privacy" className="text-luxury-gold hover:text-luxury-gold/80 underline">
                    Privacy Policy
                  </Link>
                  {' • '}
                  <Link href="/terms" className="text-luxury-gold hover:text-luxury-gold/80 underline">
                    Terms of Service
                  </Link>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 shrink-0">
                <button
                  onClick={() => setShowPreferences(true)}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white border border-gray-500 hover:border-gray-400 rounded-lg transition-colors"
                >
                  Manage Preferences
                </button>
                <button
                  onClick={rejectAll}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white bg-luxury-charcoal/50 hover:bg-luxury-charcoal/70 rounded-lg transition-colors"
                >
                  Reject All
                </button>
                <button
                  onClick={acceptAll}
                  className="px-6 py-2 text-sm font-medium text-black bg-luxury-gold hover:bg-luxury-gold/90 rounded-lg transition-colors"
                >
                  Accept All
                </button>
              </div>
            </div>
          ) : (
            // Preferences panel
            <div>
              <h3 className="text-lg font-semibold text-white mb-4 tracking-wide">
                Cookie Preferences
              </h3>

              <div className="space-y-4 mb-6">
                {/* Necessary Cookies */}
                <div className="flex items-start justify-between p-3 bg-luxury-charcoal/30 rounded-lg">
                  <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                      <h4 className="font-medium text-white">Essential Cookies</h4>
                      <span className="text-xs bg-green-600/20 text-green-300 px-2 py-1 rounded">Required</span>
                    </div>
                    <p className="text-sm text-gray-300 font-light">
                      Necessary for core functionality including account authentication, subscription management,
                      and AI skin analysis features.
                    </p>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={true}
                      disabled
                      className="w-4 h-4 text-luxury-gold bg-gray-700 border-gray-600 rounded"
                    />
                  </div>
                </div>

                {/* Analytics Cookies */}
                <div className="flex items-start justify-between p-3 bg-luxury-charcoal/30 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-white mb-2">Analytics Cookies</h4>
                    <p className="text-sm text-gray-300 font-light">
                      Help us understand how you use our platform to improve features and user experience.
                      Data is anonymized and aggregated.
                    </p>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={preferences.analytics}
                      onChange={(e) => setPreferences(prev => ({ ...prev, analytics: e.target.checked }))}
                      className="w-4 h-4 text-luxury-gold bg-gray-700 border-gray-600 rounded focus:ring-luxury-gold/50"
                    />
                  </div>
                </div>

                {/* Marketing Cookies */}
                <div className="flex items-start justify-between p-3 bg-luxury-charcoal/30 rounded-lg">
                  <div className="flex-1">
                    <h4 className="font-medium text-white mb-2">Marketing Cookies</h4>
                    <p className="text-sm text-gray-300 font-light">
                      Used to deliver personalized content and measure the effectiveness of our marketing campaigns.
                      Helps us show you relevant Korean beauty products.
                    </p>
                  </div>
                  <div className="ml-4">
                    <input
                      type="checkbox"
                      checked={preferences.marketing}
                      onChange={(e) => setPreferences(prev => ({ ...prev, marketing: e.target.checked }))}
                      className="w-4 h-4 text-luxury-gold bg-gray-700 border-gray-600 rounded focus:ring-luxury-gold/50"
                    />
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row gap-3 justify-end">
                <button
                  onClick={() => setShowPreferences(false)}
                  className="px-4 py-2 text-sm font-medium text-gray-300 hover:text-white border border-gray-500 hover:border-gray-400 rounded-lg transition-colors"
                >
                  Back
                </button>
                <button
                  onClick={acceptSelected}
                  className="px-6 py-2 text-sm font-medium text-black bg-luxury-gold hover:bg-luxury-gold/90 rounded-lg transition-colors"
                >
                  Save Preferences
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}