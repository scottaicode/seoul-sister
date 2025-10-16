'use client'

import { useState, useEffect } from 'react'
import { useSubscription } from '@/hooks/useSubscription'

interface SubscriptionManagerProps {
  phoneNumber?: string
}

export default function SubscriptionManager({ phoneNumber }: SubscriptionManagerProps) {
  const {
    subscriptionStatus,
    hasActiveSubscription,
    isInTrial,
    trialDaysRemaining,
    subscriptionEndsAt,
    loading,
    error,
    cancelSubscription,
    reactivateSubscription,
    refreshStatus
  } = useSubscription()

  const [actionLoading, setActionLoading] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [actionSuccess, setActionSuccess] = useState<string | null>(null)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)

  useEffect(() => {
    if (phoneNumber) {
      refreshStatus()
    }
  }, [phoneNumber])

  const handleCancel = async () => {
    try {
      setActionLoading(true)
      setActionError(null)

      const result = await cancelSubscription(phoneNumber)
      setActionSuccess(result.message || 'Subscription canceled successfully')
      setShowCancelConfirm(false)

      // Clear success message after 5 seconds
      setTimeout(() => setActionSuccess(null), 5000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to cancel subscription'
      setActionError(errorMessage)
      setTimeout(() => setActionError(null), 5000)
    } finally {
      setActionLoading(false)
    }
  }

  const handleReactivate = async () => {
    try {
      setActionLoading(true)
      setActionError(null)

      const result = await reactivateSubscription(phoneNumber)
      setActionSuccess(result.message || 'Subscription reactivated successfully')

      // Clear success message after 5 seconds
      setTimeout(() => setActionSuccess(null), 5000)
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to reactivate subscription'
      setActionError(errorMessage)
      setTimeout(() => setActionError(null), 5000)
    } finally {
      setActionLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luxury-gold"></div>
      </div>
    )
  }

  if (!hasActiveSubscription && !subscriptionStatus) {
    return (
      <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm text-center">
        <div className="text-4xl mb-4">📋</div>
        <h3 className="text-xl font-semibold text-white mb-2 tracking-wide">
          No Active Subscription
        </h3>
        <p className="text-gray-300 font-light mb-4">
          Start your Seoul Sister Premium membership to access exclusive features
        </p>
        <button
          onClick={() => window.location.href = '/subscription'}
          className="px-6 py-3 bg-luxury-gold hover:bg-luxury-gold/90 text-black rounded-lg font-medium transition-all tracking-wide"
        >
          Start 7-Day Free Trial
        </button>
      </div>
    )
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-400'
      case 'trialing': return 'text-blue-400'
      case 'past_due': return 'text-yellow-400'
      case 'canceled': return 'text-red-400'
      default: return 'text-gray-400'
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return '✅'
      case 'trialing': return '🎁'
      case 'past_due': return '⚠️'
      case 'canceled': return '❌'
      default: return '❓'
    }
  }

  return (
    <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm">
      <h3 className="text-xl font-semibold text-white mb-6 tracking-wide">
        Subscription Management
      </h3>

      {actionError && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-400/30 rounded-lg">
          <p className="text-red-300 text-sm">{actionError}</p>
        </div>
      )}

      {actionSuccess && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-400/30 rounded-lg">
          <p className="text-green-300 text-sm">{actionSuccess}</p>
        </div>
      )}

      {/* Current Status */}
      <div className="mb-6 p-4 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg">
        <div className="flex items-center justify-between mb-4">
          <h4 className="text-lg font-medium text-white tracking-wide">
            Current Status
          </h4>
          <div className="flex items-center space-x-2">
            <span className="text-lg">
              {getStatusIcon(subscriptionStatus?.subscription_status || 'unknown')}
            </span>
            <span className={`font-medium capitalize ${getStatusColor(subscriptionStatus?.subscription_status || 'unknown')}`}>
              {subscriptionStatus?.subscription_status || 'Unknown'}
            </span>
          </div>
        </div>

        <div className="space-y-2 text-sm">
          {isInTrial && (
            <div className="flex justify-between">
              <span className="text-gray-300 font-light">Trial Days Remaining:</span>
              <span className="text-blue-400 font-medium">{trialDaysRemaining} days</span>
            </div>
          )}

          {subscriptionEndsAt && (
            <div className="flex justify-between">
              <span className="text-gray-300 font-light">
                {subscriptionStatus?.cancel_at_period_end ? 'Cancels on:' : 'Renews on:'}
              </span>
              <span className="text-white font-medium">
                {subscriptionEndsAt.toLocaleDateString()}
              </span>
            </div>
          )}

          <div className="flex justify-between">
            <span className="text-gray-300 font-light">Monthly Price:</span>
            <span className="text-luxury-gold font-medium">$20.00</span>
          </div>
        </div>
      </div>

      {/* Premium Features Status */}
      <div className="mb-6 p-4 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg">
        <h4 className="text-lg font-medium text-white mb-4 tracking-wide">
          Premium Features Access
        </h4>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div className="flex items-center space-x-2">
            <span className="text-green-400">✅</span>
            <span className="text-gray-300 font-light">AI Skin Analysis</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-400">✅</span>
            <span className="text-gray-300 font-light">Seoul Wholesale Access</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-400">✅</span>
            <span className="text-gray-300 font-light">WhatsApp Ordering</span>
          </div>
          <div className="flex items-center space-x-2">
            <span className="text-green-400">✅</span>
            <span className="text-gray-300 font-light">Price Intelligence</span>
          </div>
        </div>
      </div>

      {/* Action Buttons */}
      <div className="space-y-4">
        {subscriptionStatus?.cancel_at_period_end ? (
          // Subscription is canceled but still active
          <div className="space-y-4">
            <div className="p-3 bg-yellow-500/10 border border-yellow-400/30 rounded-lg">
              <p className="text-yellow-300 text-sm">
                Your subscription is scheduled to cancel on {subscriptionEndsAt?.toLocaleDateString()}.
                You'll continue to have access until then.
              </p>
            </div>
            <button
              onClick={handleReactivate}
              disabled={actionLoading}
              className="w-full py-3 px-4 bg-luxury-gold hover:bg-luxury-gold/90 text-black rounded-lg font-medium transition-all tracking-wide disabled:opacity-50"
            >
              {actionLoading ? 'Reactivating...' : 'Reactivate Subscription'}
            </button>
          </div>
        ) : hasActiveSubscription ? (
          // Active subscription
          <div className="space-y-4">
            {!showCancelConfirm ? (
              <button
                onClick={() => setShowCancelConfirm(true)}
                className="w-full py-3 px-4 bg-red-600/80 hover:bg-red-600 text-white border border-red-500/30 rounded-lg font-medium transition-all tracking-wide"
              >
                Cancel Subscription
              </button>
            ) : (
              <div className="space-y-3">
                <div className="p-3 bg-red-500/10 border border-red-400/30 rounded-lg">
                  <p className="text-red-300 text-sm mb-2">
                    Are you sure you want to cancel your subscription?
                  </p>
                  <p className="text-gray-300 text-xs font-light">
                    You'll keep access until your current billing period ends on {subscriptionEndsAt?.toLocaleDateString()}.
                  </p>
                </div>
                <div className="flex space-x-3">
                  <button
                    onClick={handleCancel}
                    disabled={actionLoading}
                    className="flex-1 py-2 px-4 bg-red-600 hover:bg-red-700 text-white rounded-lg font-medium transition-all tracking-wide disabled:opacity-50"
                  >
                    {actionLoading ? 'Canceling...' : 'Yes, Cancel'}
                  </button>
                  <button
                    onClick={() => setShowCancelConfirm(false)}
                    disabled={actionLoading}
                    className="flex-1 py-2 px-4 bg-luxury-charcoal/50 hover:bg-luxury-charcoal/70 text-gray-300 border border-luxury-gold/30 rounded-lg font-medium transition-all tracking-wide"
                  >
                    Keep Subscription
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}

        {/* Help Section */}
        <div className="mt-6 p-4 bg-blue-500/10 border border-blue-400/30 rounded-lg">
          <div className="flex items-start space-x-3">
            <div className="text-blue-400 mt-1">💬</div>
            <div>
              <h4 className="font-medium text-blue-300 mb-1 tracking-wide">
                Need Help?
              </h4>
              <p className="text-blue-200 text-sm font-light mb-2">
                Questions about your subscription or billing? We're here to help!
              </p>
              <button
                onClick={() => window.open('https://wa.me/1234567890?text=Hi! I need help with my Seoul Sister subscription.', '_blank')}
                className="text-blue-300 hover:text-blue-200 text-sm font-medium underline"
              >
                Contact Support via WhatsApp
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}