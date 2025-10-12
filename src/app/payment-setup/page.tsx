'use client'

import { useState, useEffect, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { loadStripe } from '@stripe/stripe-js'
import {
  Elements,
  CardElement,
  useStripe,
  useElements
} from '@stripe/react-stripe-js'

const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!)

function PaymentSetupForm({ phoneNumber }: { phoneNumber: string }) {
  const stripe = useStripe()
  const elements = useElements()
  const [isLoading, setIsLoading] = useState(false)
  const [setupIntent, setSetupIntent] = useState<any>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  useEffect(() => {
    // Create setup intent when component mounts
    createSetupIntent()
  }, [])

  const createSetupIntent = async () => {
    try {
      const response = await fetch('/api/payment-setup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber })
      })

      const data = await response.json()
      if (data.success) {
        setSetupIntent(data.setup_intent)
      } else {
        setError(data.error)
      }
    } catch (err) {
      setError('Failed to initialize payment setup')
    }
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!stripe || !elements || !setupIntent) {
      return
    }

    setIsLoading(true)
    setError(null)

    const cardElement = elements.getElement(CardElement)
    if (!cardElement) {
      setError('Card element not found')
      setIsLoading(false)
      return
    }

    const { error, setupIntent: confirmedSetupIntent } = await stripe.confirmCardSetup(
      setupIntent.client_secret,
      {
        payment_method: {
          card: cardElement,
        }
      }
    )

    if (error) {
      setError(error.message || 'Payment setup failed')
    } else if (confirmedSetupIntent?.status === 'succeeded') {
      setSuccess(true)
    }

    setIsLoading(false)
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <div className="text-6xl mb-4">🎉</div>
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Payment Method Added!
          </h1>
          <p className="text-gray-600 mb-6">
            Your payment method has been securely saved. You can now order instantly through WhatsApp!
          </p>
          <div className="bg-pink-50 rounded-lg p-4 mb-6">
            <p className="text-sm text-pink-800">
              <strong>Next steps:</strong><br />
              Return to WhatsApp and reply <strong>"ORDER"</strong> to any product to place your first order at Seoul prices! 🇰🇷
            </p>
          </div>
          <p className="text-xs text-gray-500">
            Your card information is encrypted and secure with Stripe.
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold text-gray-800 mb-2">
            💳 Add Payment Method
          </h1>
          <p className="text-gray-600">
            Securely save your card for instant Seoul Sister orders
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="border rounded-lg p-4">
            <CardElement
              options={{
                style: {
                  base: {
                    fontSize: '16px',
                    color: '#424770',
                    '::placeholder': {
                      color: '#aab7c4',
                    },
                  },
                },
              }}
            />
          </div>

          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded">
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={!stripe || isLoading}
            className="w-full bg-pink-600 hover:bg-pink-700 disabled:bg-gray-400 text-white font-medium py-3 px-4 rounded-lg transition-colors"
          >
            {isLoading ? 'Saving...' : 'Save Payment Method'}
          </button>

          <div className="text-center">
            <div className="flex items-center justify-center space-x-2 text-sm text-gray-500">
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M5 9V7a5 5 0 0110 0v2a2 2 0 012 2v5a2 2 0 01-2 2H5a2 2 0 01-2-2v-5a2 2 0 012-2zm8-2v2H7V7a3 3 0 016 0z" clipRule="evenodd" />
              </svg>
              <span>Secured by Stripe</span>
            </div>
          </div>
        </form>

        <div className="mt-6 bg-blue-50 rounded-lg p-4">
          <h3 className="font-medium text-blue-900 mb-2">Why save your card?</h3>
          <ul className="text-sm text-blue-800 space-y-1">
            <li>🚀 Instant ordering through WhatsApp</li>
            <li>💰 Automatic Seoul pricing</li>
            <li>🔒 Secure, encrypted storage</li>
            <li>📱 No typing required for future orders</li>
          </ul>
        </div>
      </div>
    </div>
  )
}

function PaymentSetupContent() {
  const searchParams = useSearchParams()
  const phoneNumber = searchParams.get('phone')

  if (!phoneNumber) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
          <h1 className="text-2xl font-bold text-gray-800 mb-4">
            Invalid Link
          </h1>
          <p className="text-gray-600">
            This payment setup link is invalid. Please request a new link through WhatsApp.
          </p>
        </div>
      </div>
    )
  }

  return (
    <Elements stripe={stripePromise}>
      <PaymentSetupForm phoneNumber={phoneNumber} />
    </Elements>
  )
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-pink-50 to-purple-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl shadow-lg p-8 max-w-md w-full text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-pink-600 mx-auto mb-4"></div>
        <p className="text-gray-600">Loading payment setup...</p>
      </div>
    </div>
  )
}

export default function PaymentSetupPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <PaymentSetupContent />
    </Suspense>
  )
}