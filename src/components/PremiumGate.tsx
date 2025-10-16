'use client'

import { useEffect, useState } from 'react'
import { useSubscription } from '@/hooks/useSubscription'
import { useAuth } from '@/contexts/AuthContext'

interface PremiumGateProps {
  children: React.ReactNode
  fallback?: React.ReactNode
  phoneNumber?: string
  showUpgradePrompt?: boolean
  featureName?: string
}

export default function PremiumGate({
  children,
  fallback,
  phoneNumber,
  showUpgradePrompt = true,
  featureName = 'this premium feature'
}: PremiumGateProps) {
  const { user } = useAuth()
  const { canAccessPremium, loading, checkPremiumAccess, createSubscription } = useSubscription()
  const [hasAccess, setHasAccess] = useState(false)
  const [checking, setChecking] = useState(true)

  useEffect(() => {
    const verifyAccess = async () => {
      if (user?.id || phoneNumber) {
        const access = await checkPremiumAccess(phoneNumber)
        setHasAccess(access)
      }
      setChecking(false)
    }

    verifyAccess()
  }, [user?.id, phoneNumber, checkPremiumAccess])

  const handleStartTrial = async () => {
    try {
      await createSubscription(user?.email, undefined, phoneNumber)
    } catch (error) {
      console.error('Error starting trial:', error)
    }
  }

  if (checking || loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luxury-gold"></div>
      </div>
    )
  }

  if (hasAccess || canAccessPremium) {
    return <>{children}</>
  }

  if (fallback) {
    return <>{fallback}</>
  }

  if (!showUpgradePrompt) {
    return null
  }

  return (
    <div className="bg-luxury-charcoal/20 rounded-xl p-8 border border-luxury-gold/20 backdrop-blur-sm text-center">
      <div className="mb-6">
        <div className="text-4xl mb-4">🔒</div>
        <h3 className="text-xl font-semibold text-white mb-2 tracking-wide">
          Premium Feature
        </h3>
        <p className="text-gray-300 font-light">
          Unlock {featureName} with Seoul Sister Premium
        </p>
      </div>

      <div className="mb-6 space-y-3">
        <div className="flex items-center justify-center space-x-2 text-luxury-gold">
          <span className="text-sm">✨</span>
          <span className="text-sm font-light">AI-powered skin analysis</span>
        </div>
        <div className="flex items-center justify-center space-x-2 text-luxury-gold">
          <span className="text-sm">🇰🇷</span>
          <span className="text-sm font-light">Authentic Seoul wholesale access</span>
        </div>
        <div className="flex items-center justify-center space-x-2 text-luxury-gold">
          <span className="text-sm">💬</span>
          <span className="text-sm font-light">WhatsApp personal shopping</span>
        </div>
        <div className="flex items-center justify-center space-x-2 text-luxury-gold">
          <span className="text-sm">📊</span>
          <span className="text-sm font-light">Real-time price intelligence</span>
        </div>
      </div>

      <div className="space-y-4">
        <button
          onClick={handleStartTrial}
          className="w-full py-3 px-6 bg-luxury-gold hover:bg-luxury-gold/90 text-black rounded-lg font-medium transition-all tracking-wide"
        >
          Start 7-Day Free Trial
        </button>

        <div className="text-center">
          <p className="text-xs text-gray-400 font-light">
            $20/month after trial • Cancel anytime
          </p>
        </div>
      </div>
    </div>
  )
}