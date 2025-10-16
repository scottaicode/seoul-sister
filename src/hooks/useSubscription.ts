import { useState, useEffect } from 'react'
import { useAuth } from '@/contexts/AuthContext'

interface SubscriptionStatus {
  subscription_status: string
  has_active_subscription: boolean
  is_in_trial: boolean
  trial_days_remaining: number
  current_period_end: number | null
  cancel_at_period_end: boolean
  can_access_premium: boolean
  profile_id?: string
  subscription_id?: string
}

interface BillingInfo {
  billing_info: any
  payment_methods: any[]
  invoices: any[]
}

export function useSubscription() {
  const { user } = useAuth()
  const [subscriptionStatus, setSubscriptionStatus] = useState<SubscriptionStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Check subscription status
  const checkStatus = async (phoneNumber?: string) => {
    try {
      setLoading(true)
      setError(null)

      const params = new URLSearchParams()
      if (user?.id) {
        params.append('userId', user.id)
      } else if (phoneNumber) {
        params.append('phoneNumber', phoneNumber)
      } else {
        throw new Error('User ID or phone number required')
      }

      const response = await fetch(`/api/subscription/status?${params}`)
      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to check subscription status')
      }

      setSubscriptionStatus(data)
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error checking subscription status:', err)
      return null
    } finally {
      setLoading(false)
    }
  }

  // Create new subscription
  const createSubscription = async (email?: string, name?: string, phoneNumber?: string) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/subscription/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create_subscription',
          userId: user?.id,
          phoneNumber,
          email: email || user?.email,
          name
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create subscription')
      }

      // Refresh status after creation
      await checkStatus(phoneNumber)
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error creating subscription:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Cancel subscription
  const cancelSubscription = async (phoneNumber?: string) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/subscription/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel_subscription',
          userId: user?.id,
          phoneNumber
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to cancel subscription')
      }

      // Refresh status after cancellation
      await checkStatus(phoneNumber)
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error canceling subscription:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Reactivate subscription
  const reactivateSubscription = async (phoneNumber?: string) => {
    try {
      setLoading(true)
      setError(null)

      const response = await fetch('/api/subscription/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reactivate_subscription',
          userId: user?.id,
          phoneNumber
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to reactivate subscription')
      }

      // Refresh status after reactivation
      await checkStatus(phoneNumber)
      return data
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      console.error('Error reactivating subscription:', err)
      throw err
    } finally {
      setLoading(false)
    }
  }

  // Get billing information
  const getBillingInfo = async (phoneNumber?: string): Promise<BillingInfo | null> => {
    try {
      const response = await fetch('/api/subscription/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'get_billing_info',
          userId: user?.id,
          phoneNumber
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get billing info')
      }

      return data
    } catch (err) {
      console.error('Error getting billing info:', err)
      return null
    }
  }

  // Quick premium access check (for protecting content)
  const checkPremiumAccess = async (phoneNumber?: string): Promise<boolean> => {
    try {
      const response = await fetch('/api/subscription/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'check_premium_access',
          userId: user?.id,
          phoneNumber
        })
      })

      const data = await response.json()
      return data.can_access_premium || false
    } catch (err) {
      console.error('Error checking premium access:', err)
      return false
    }
  }

  // Auto-check status on mount if user is available
  useEffect(() => {
    if (user?.id) {
      checkStatus()
    }
  }, [user?.id])

  // Helper functions for common checks
  const hasActiveSubscription = subscriptionStatus?.has_active_subscription || false
  const isInTrial = subscriptionStatus?.is_in_trial || false
  const canAccessPremium = subscriptionStatus?.can_access_premium || false
  const trialDaysRemaining = subscriptionStatus?.trial_days_remaining || 0
  const subscriptionEndsAt = subscriptionStatus?.current_period_end ?
    new Date(subscriptionStatus.current_period_end) : null

  return {
    // Status
    subscriptionStatus,
    loading,
    error,

    // Helper flags
    hasActiveSubscription,
    isInTrial,
    canAccessPremium,
    trialDaysRemaining,
    subscriptionEndsAt,

    // Actions
    checkStatus,
    createSubscription,
    cancelSubscription,
    reactivateSubscription,
    getBillingInfo,
    checkPremiumAccess,

    // Utils
    refreshStatus: () => checkStatus(),
    clearError: () => setError(null)
  }
}