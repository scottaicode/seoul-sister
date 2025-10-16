'use client'

import { useState, useEffect } from 'react'
import { loadStripe } from '@stripe/stripe-js'
import { Elements, CardElement, useStripe, useElements } from '@stripe/react-stripe-js'
import { useSubscription } from '@/hooks/useSubscription'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

interface PaymentMethod {
  id: string
  type: string
  card?: {
    brand: string
    last4: string
    exp_month: number
    exp_year: number
  }
}

interface PaymentMethodFormProps {
  onSuccess: () => void
  onError: (error: string) => void
  phoneNumber?: string
}

function PaymentMethodForm({ onSuccess, onError, phoneNumber }: PaymentMethodFormProps) {
  const stripe = useStripe()
  const elements = useElements()
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements) {
      return
    }

    setLoading(true)

    try {
      const cardElement = elements.getElement(CardElement)
      if (!cardElement) {
        throw new Error('Card element not found')
      }

      // Create payment method
      const { error, paymentMethod } = await stripe.createPaymentMethod({
        type: 'card',
        card: cardElement,
      })

      if (error) {
        throw new Error(error.message)
      }

      // Update payment method via API
      const response = await fetch('/api/subscription/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_payment_method',
          paymentMethodId: paymentMethod.id,
          phoneNumber
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update payment method')
      }

      onSuccess()
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      onError(errorMessage)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="p-4 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg">
        <CardElement
          options={{
            style: {
              base: {
                fontSize: '16px',
                color: '#ffffff',
                '::placeholder': {
                  color: '#9ca3af',
                },
                iconColor: '#D4A574',
              },
              invalid: {
                color: '#ef4444',
                iconColor: '#ef4444',
              },
            },
          }}
        />
      </div>

      <button
        type="submit"
        disabled={!stripe || loading}
        className="w-full py-3 px-4 bg-luxury-gold hover:bg-luxury-gold/90 text-black rounded-lg font-medium transition-all tracking-wide disabled:opacity-50"
      >
        {loading ? 'Adding Card...' : 'Add Payment Method'}
      </button>
    </form>
  )
}

interface PaymentMethodManagerProps {
  phoneNumber?: string
}

export default function PaymentMethodManager({ phoneNumber }: PaymentMethodManagerProps) {
  const { getBillingInfo } = useSubscription()
  const [paymentMethods, setPaymentMethods] = useState<PaymentMethod[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showAddForm, setShowAddForm] = useState(false)
  const [success, setSuccess] = useState<string | null>(null)

  const loadPaymentMethods = async () => {
    try {
      setLoading(true)
      const billingInfo = await getBillingInfo(phoneNumber)

      if (billingInfo) {
        setPaymentMethods(billingInfo.payment_methods || [])
      }
    } catch (err) {
      setError('Failed to load payment methods')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadPaymentMethods()
  }, [phoneNumber])

  const handleAddSuccess = () => {
    setShowAddForm(false)
    setSuccess('Payment method added successfully!')
    loadPaymentMethods()

    // Clear success message after 3 seconds
    setTimeout(() => setSuccess(null), 3000)
  }

  const handleAddError = (errorMessage: string) => {
    setError(errorMessage)
    setTimeout(() => setError(null), 5000)
  }

  const removePaymentMethod = async (paymentMethodId: string) => {
    try {
      const response = await fetch('/api/subscription/manage', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'remove_payment_method',
          paymentMethodId,
          phoneNumber
        })
      })

      if (response.ok) {
        setSuccess('Payment method removed successfully!')
        loadPaymentMethods()
        setTimeout(() => setSuccess(null), 3000)
      } else {
        throw new Error('Failed to remove payment method')
      }
    } catch (err) {
      setError('Failed to remove payment method')
      setTimeout(() => setError(null), 5000)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luxury-gold"></div>
      </div>
    )
  }

  return (
    <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-semibold text-white tracking-wide">
          Payment Methods
        </h3>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="px-4 py-2 bg-luxury-gold hover:bg-luxury-gold/90 text-black rounded-lg font-medium transition-all tracking-wide text-sm"
        >
          {showAddForm ? 'Cancel' : 'Add Card'}
        </button>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-500/10 border border-red-400/30 rounded-lg">
          <p className="text-red-300 text-sm">{error}</p>
        </div>
      )}

      {success && (
        <div className="mb-4 p-3 bg-green-500/10 border border-green-400/30 rounded-lg">
          <p className="text-green-300 text-sm">{success}</p>
        </div>
      )}

      {showAddForm && (
        <div className="mb-6 p-4 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg">
          <h4 className="text-lg font-medium text-white mb-4 tracking-wide">
            Add New Payment Method
          </h4>
          <Elements stripe={stripePromise}>
            <PaymentMethodForm
              onSuccess={handleAddSuccess}
              onError={handleAddError}
              phoneNumber={phoneNumber}
            />
          </Elements>
        </div>
      )}

      <div className="space-y-3">
        {paymentMethods.length === 0 ? (
          <div className="text-center py-8">
            <div className="text-4xl mb-4">💳</div>
            <h4 className="text-lg font-medium text-white mb-2 tracking-wide">
              No Payment Methods
            </h4>
            <p className="text-gray-300 font-light mb-4">
              Add a payment method to manage your Seoul Sister Premium subscription
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-2 bg-luxury-gold hover:bg-luxury-gold/90 text-black rounded-lg font-medium transition-all tracking-wide"
            >
              Add Your First Card
            </button>
          </div>
        ) : (
          paymentMethods.map((method) => (
            <div
              key={method.id}
              className="flex items-center justify-between p-4 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg"
            >
              <div className="flex items-center space-x-4">
                <div className="text-2xl">
                  {method.card?.brand === 'visa' && '💳'}
                  {method.card?.brand === 'mastercard' && '💳'}
                  {method.card?.brand === 'amex' && '💳'}
                  {!method.card?.brand && '💳'}
                </div>
                <div>
                  <div className="text-white font-medium">
                    {method.card?.brand?.toUpperCase()} •••• {method.card?.last4}
                  </div>
                  <div className="text-gray-400 text-sm font-light">
                    Expires {method.card?.exp_month}/{method.card?.exp_year}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <span className="px-2 py-1 bg-luxury-gold/20 border border-luxury-gold/30 text-luxury-gold rounded text-xs font-medium">
                  Default
                </span>
                <button
                  onClick={() => removePaymentMethod(method.id)}
                  className="px-3 py-1 text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
                >
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="mt-6 p-4 bg-blue-500/10 border border-blue-400/30 rounded-lg">
        <div className="flex items-start space-x-3">
          <div className="text-blue-400 mt-1">ℹ️</div>
          <div>
            <h4 className="font-medium text-blue-300 mb-1 tracking-wide">
              Secure Payment Processing
            </h4>
            <p className="text-blue-200 text-sm font-light">
              Your payment information is encrypted and processed securely by Stripe.
              Seoul Sister never stores your card details directly.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}