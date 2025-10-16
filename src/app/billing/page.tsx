'use client'

import { useState } from 'react'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import AuthHeader from '@/components/AuthHeader'
import { useAuth } from '@/contexts/AuthContext'
import PaymentMethodManager from '@/components/billing/PaymentMethodManager'
import SubscriptionManager from '@/components/billing/SubscriptionManager'
import { useSubscription } from '@/hooks/useSubscription'

export default function BillingPage() {
  const { user } = useAuth()
  const { subscriptionStatus, getBillingInfo } = useSubscription()
  const [activeTab, setActiveTab] = useState<'subscription' | 'payment' | 'invoices'>('subscription')
  const [invoices, setInvoices] = useState<any[]>([])
  const [loadingInvoices, setLoadingInvoices] = useState(false)

  const loadInvoices = async () => {
    setLoadingInvoices(true)
    try {
      const billingInfo = await getBillingInfo()
      if (billingInfo) {
        setInvoices(billingInfo.invoices || [])
      }
    } catch (error) {
      console.error('Error loading invoices:', error)
    } finally {
      setLoadingInvoices(false)
    }
  }

  const tabs = [
    { id: 'subscription', label: '📋 Subscription', description: 'Manage your premium membership' },
    { id: 'payment', label: '💳 Payment Methods', description: 'Manage saved cards' },
    { id: 'invoices', label: '📄 Billing History', description: 'View past invoices' }
  ]

  const formatAmount = (amount: number, currency: string) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase()
    }).format(amount / 100)
  }

  const formatDate = (timestamp: number) => {
    return new Date(timestamp * 1000).toLocaleDateString()
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-luxury-charcoal to-black">
      {/* Authentication Header */}
      <AuthHeader />

      <div className="container mx-auto px-4 pt-24 pb-8">
        {/* Back button */}
        <div className="mb-6">
          <Link
            href="/personalized-dashboard"
            className="inline-flex items-center gap-2 px-4 py-2 text-gray-300 hover:text-luxury-gold transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="font-medium">Back to Dashboard</span>
          </Link>
        </div>

        {/* Header */}
        <div className="text-center mb-8">
          <div className="mb-6">
            <p className="text-caption mb-4 text-gray-400 tracking-widest">PREMIUM MEMBERSHIP</p>
          </div>
          <h1 className="text-4xl font-light text-white mb-4 tracking-wide">
            💳 Billing & Subscription
          </h1>
          <p className="text-lg font-light text-gray-300 max-w-3xl mx-auto">
            Manage your Seoul Sister Premium membership, payment methods, and billing information
          </p>
        </div>

        {/* Quick Status Card */}
        {subscriptionStatus && (
          <div className="mb-8 bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-lg font-semibold text-white tracking-wide">
                  Premium Membership Status
                </h3>
                <p className="text-gray-300 font-light">
                  {subscriptionStatus.has_active_subscription ? 'Active' : 'Inactive'} •{' '}
                  {subscriptionStatus.is_in_trial ? `${subscriptionStatus.trial_days_remaining} trial days left` : '$20/month'}
                </p>
              </div>
              <div className="text-right">
                <div className={`text-2xl font-bold ${subscriptionStatus.has_active_subscription ? 'text-green-400' : 'text-red-400'}`}>
                  {subscriptionStatus.has_active_subscription ? '✅' : '❌'}
                </div>
                <p className="text-xs text-gray-400 font-light capitalize">
                  {subscriptionStatus.subscription_status}
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any)
                if (tab.id === 'invoices' && invoices.length === 0) {
                  loadInvoices()
                }
              }}
              className={`px-6 py-3 rounded-xl transition-all ${
                activeTab === tab.id
                  ? 'bg-luxury-gold text-black shadow-lg font-medium'
                  : 'bg-luxury-charcoal/30 text-gray-300 hover:bg-luxury-charcoal/50 border border-luxury-gold/20 hover:border-luxury-gold/40'
              }`}
            >
              <div className="font-semibold tracking-wide">{tab.label}</div>
              <div className="text-xs opacity-75 font-light">{tab.description}</div>
            </button>
          ))}
        </div>

        {/* Tab Content */}
        <div className="max-w-4xl mx-auto">
          {activeTab === 'subscription' && (
            <SubscriptionManager />
          )}

          {activeTab === 'payment' && (
            <PaymentMethodManager />
          )}

          {activeTab === 'invoices' && (
            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white tracking-wide">
                  Billing History
                </h3>
                <button
                  onClick={loadInvoices}
                  disabled={loadingInvoices}
                  className="px-4 py-2 bg-luxury-gold hover:bg-luxury-gold/90 text-black rounded-lg font-medium transition-all tracking-wide text-sm disabled:opacity-50"
                >
                  {loadingInvoices ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {loadingInvoices ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luxury-gold"></div>
                </div>
              ) : invoices.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">📄</div>
                  <h4 className="text-lg font-medium text-white mb-2 tracking-wide">
                    No Invoices Yet
                  </h4>
                  <p className="text-gray-300 font-light">
                    Your billing history will appear here after your first payment
                  </p>
                </div>
              ) : (
                <div className="space-y-3">
                  {invoices.map((invoice) => (
                    <div
                      key={invoice.id}
                      className="flex items-center justify-between p-4 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg"
                    >
                      <div className="flex items-center space-x-4">
                        <div className="text-2xl">
                          {invoice.status === 'paid' ? '✅' : '⏳'}
                        </div>
                        <div>
                          <div className="text-white font-medium">
                            {formatAmount(invoice.amount_paid, invoice.currency)}
                          </div>
                          <div className="text-gray-400 text-sm font-light">
                            {formatDate(invoice.created)} •{' '}
                            <span className="capitalize">{invoice.status}</span>
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center space-x-2">
                        {invoice.hosted_invoice_url && (
                          <a
                            href={invoice.hosted_invoice_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-3 py-1 bg-luxury-gold/20 border border-luxury-gold/30 text-luxury-gold rounded text-sm font-medium hover:bg-luxury-gold/30 transition-colors"
                          >
                            View Invoice
                          </a>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Help Section */}
        <div className="mt-8 max-w-4xl mx-auto">
          <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm">
            <div className="text-center">
              <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
                Need Help with Billing?
              </h3>
              <p className="text-gray-300 font-light mb-6">
                Our Seoul Sister team is here to assist with any subscription or billing questions
              </p>
              <div className="flex flex-wrap justify-center gap-4">
                <button
                  onClick={() => window.open('https://wa.me/1234567890?text=Hi! I need help with my Seoul Sister billing.', '_blank')}
                  className="px-6 py-3 bg-green-600 hover:bg-green-700 text-white rounded-lg font-medium transition-all tracking-wide"
                >
                  💬 WhatsApp Support
                </button>
                <button
                  onClick={() => window.location.href = 'mailto:support@seoulsister.com?subject=Billing Support'}
                  className="px-6 py-3 bg-luxury-charcoal/50 hover:bg-luxury-charcoal/70 text-gray-300 border border-luxury-gold/30 rounded-lg font-medium transition-all tracking-wide"
                >
                  📧 Email Support
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}