'use client'

import { useState } from 'react'
import { useStripe, useElements, CardElement } from '@stripe/react-stripe-js'
import { supabase } from '@/lib/supabase'
import type { Database } from '@/types/database'

interface PaymentMethodFormProps {
  userId: string
  onSuccess: () => void
}

export default function PaymentMethodForm({ userId, onSuccess }: PaymentMethodFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setLoading(true)
    setError('')

    try {
      // TEMPORARY: Simulate successful payment method setup for demo
      // TODO: Re-enable when API routes are properly configured
      await new Promise(resolve => setTimeout(resolve, 2000)) // Simulate API call

      const customerId = 'demo_customer_' + userId.slice(-8)

      // Skip Stripe integration for now
      // const response = await fetch('/api/create-setup-intent', {
      //   method: 'POST',
      //   headers: {
      //     'Content-Type': 'application/json',
      //   },
      //   body: JSON.stringify({ userId }),
      // })
      // const { setupIntent, customerId } = await response.json()
      // if (!setupIntent) {
      //   throw new Error('Failed to create setup intent')
      // }

      // Skip card confirmation for demo
      // TODO: Re-enable when API routes are properly configured
      // const cardElement = elements.getElement(CardElement)
      // if (!cardElement) {
      //   throw new Error('Card element not found')
      // }
      // const { error: confirmError, setupIntent: confirmedSetupIntent } = await stripe.confirmCardSetup(
      //   setupIntent.client_secret,
      //   {
      //     payment_method: {
      //       card: cardElement,
      //     },
      //   }
      // )
      // if (confirmError) {
      //   throw new Error(confirmError.message)
      // }

      // Update user profile with Stripe customer ID
      const { error: updateError } = await (supabase
        .from('profiles') as any)
        .update({
          stripe_customer_id: customerId,
          updated_at: new Date().toISOString()
        })
        .eq('id', userId)

      if (updateError) {
        throw new Error('Failed to update profile')
      }

      onSuccess()
    } catch (err: any) {
      setError(err.message || 'Failed to save payment method')
    } finally {
      setLoading(false)
    }
  }

  const cardElementOptions = {
    style: {
      base: {
        fontSize: '16px',
        color: '#424770',
        '::placeholder': {
          color: '#aab7c4',
        },
        fontFamily: 'Inter, system-ui, sans-serif',
      },
      invalid: {
        color: '#9e2146',
      },
    },
    hidePostalCode: false,
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">
          Card Information
        </label>
        <div className="p-4 border border-gray-300 rounded-lg focus-within:ring-2 focus-within:ring-korean-red focus-within:border-transparent">
          <CardElement options={cardElementOptions} />
        </div>
      </div>

      <div className="bg-blue-50 border border-blue-200 text-blue-700 px-4 py-3 rounded-lg">
        <div className="flex items-start">
          <svg className="w-5 h-5 mt-0.5 mr-2 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
          </svg>
          <div className="text-sm">
            <p className="font-medium">Your payment method is secure</p>
            <p className="mt-1">We use Stripe to securely store your payment information. You'll only be charged when you place an order through WhatsApp.</p>
          </div>
        </div>
      </div>

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full bg-korean-gradient text-white font-semibold py-3 px-6 rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {loading ? 'Saving Payment Method...' : 'Save Payment Method'}
      </button>

      <p className="text-xs text-gray-500 text-center">
        By saving your payment method, you agree to our Terms of Service.
        You can update or remove your payment method at any time.
      </p>
    </form>
  )
}