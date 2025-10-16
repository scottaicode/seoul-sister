'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Search, MessageCircle, Mail, Phone } from 'lucide-react'
import AuthHeader from '@/components/AuthHeader'
import { useAuth } from '@/contexts/AuthContext'

interface FAQ {
  id: string
  question: string
  answer: string
  category: string
  is_featured: boolean
}

interface SupportTicket {
  id: string
  ticket_number: string
  subject: string
  status: string
  created_at: string
}

export default function SupportPage() {
  const { user } = useAuth()
  const [activeTab, setActiveTab] = useState<'faq' | 'contact' | 'tickets'>('faq')
  const [faqs, setFaqs] = useState<FAQ[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedFaq, setExpandedFaq] = useState<string | null>(null)
  const [tickets, setTickets] = useState<SupportTicket[]>([])
  const [loading, setLoading] = useState(false)

  // Contact form state
  const [contactForm, setContactForm] = useState({
    name: '',
    email: '',
    phoneNumber: '',
    subject: '',
    message: '',
    category: 'general',
    priority: 'medium'
  })
  const [submitting, setSubmitting] = useState(false)
  const [submitSuccess, setSubmitSuccess] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)

  useEffect(() => {
    loadFAQs()
    if (user) {
      setContactForm(prev => ({
        ...prev,
        email: user.email || '',
        name: user.user_metadata?.full_name || ''
      }))
    }
  }, [user])

  const loadFAQs = async () => {
    try {
      const response = await fetch('/api/support/faq')
      const data = await response.json()
      if (data.faqs) {
        setFaqs(data.faqs)
      }
    } catch (error) {
      console.error('Error loading FAQs:', error)
    }
  }

  const loadTickets = async () => {
    if (!user?.id && !contactForm.phoneNumber) return

    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (user?.id) params.append('userId', user.id)
      if (contactForm.phoneNumber) params.append('phoneNumber', contactForm.phoneNumber)

      const response = await fetch(`/api/support/tickets?${params}`)
      const data = await response.json()
      if (data.tickets) {
        setTickets(data.tickets)
      }
    } catch (error) {
      console.error('Error loading tickets:', error)
    } finally {
      setLoading(false)
    }
  }

  const submitContactForm = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!contactForm.subject || !contactForm.message) {
      setSubmitError('Subject and message are required')
      return
    }

    setSubmitting(true)
    setSubmitError(null)

    try {
      const response = await fetch('/api/support/tickets', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user?.id,
          ...contactForm
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to submit support request')
      }

      setSubmitSuccess(true)
      setContactForm({
        name: user?.user_metadata?.full_name || '',
        email: user?.email || '',
        phoneNumber: '',
        subject: '',
        message: '',
        category: 'general',
        priority: 'medium'
      })

      // Switch to tickets tab to show the new ticket
      setActiveTab('tickets')
      loadTickets()

    } catch (error) {
      setSubmitError(error instanceof Error ? error.message : 'Failed to submit support request')
    } finally {
      setSubmitting(false)
    }
  }

  const filteredFaqs = faqs.filter(faq =>
    faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
    faq.answer.toLowerCase().includes(searchQuery.toLowerCase())
  )

  const featuredFaqs = filteredFaqs.filter(faq => faq.is_featured)
  const otherFaqs = filteredFaqs.filter(faq => !faq.is_featured)

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'open': return 'text-blue-400'
      case 'in_progress': return 'text-yellow-400'
      case 'resolved': return 'text-green-400'
      case 'closed': return 'text-gray-400'
      default: return 'text-gray-400'
    }
  }

  const tabs = [
    { id: 'faq', label: '❓ FAQ', description: 'Frequently asked questions' },
    { id: 'contact', label: '📝 Contact Us', description: 'Get personalized help' },
    { id: 'tickets', label: '🎫 My Tickets', description: 'View your support requests' }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-black via-luxury-charcoal to-black">
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
            <p className="text-caption mb-4 text-gray-400 tracking-widest">HELP CENTER</p>
          </div>
          <h1 className="text-4xl font-light text-white mb-4 tracking-wide">
            💬 Support Center
          </h1>
          <p className="text-lg font-light text-gray-300 max-w-3xl mx-auto">
            Get help with your Seoul Sister Premium membership, billing, and Korean beauty questions
          </p>
        </div>

        {/* Quick Contact Options */}
        <div className="mb-8 grid grid-cols-1 md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          <button
            onClick={() => window.open('https://wa.me/1234567890?text=Hi! I need help with my Seoul Sister account.', '_blank')}
            className="p-4 bg-green-600/20 border border-green-500/30 rounded-xl hover:bg-green-600/30 transition-all text-center"
          >
            <MessageCircle className="mx-auto mb-2 text-green-400" size={24} />
            <div className="text-green-300 font-medium">WhatsApp Support</div>
            <div className="text-green-200 text-sm">Instant responses</div>
          </button>

          <button
            onClick={() => window.location.href = 'mailto:support@seoulsister.com'}
            className="p-4 bg-blue-600/20 border border-blue-500/30 rounded-xl hover:bg-blue-600/30 transition-all text-center"
          >
            <Mail className="mx-auto mb-2 text-blue-400" size={24} />
            <div className="text-blue-300 font-medium">Email Support</div>
            <div className="text-blue-200 text-sm">24-hour response</div>
          </button>

          <button
            onClick={() => setActiveTab('contact')}
            className="p-4 bg-luxury-gold/20 border border-luxury-gold/30 rounded-xl hover:bg-luxury-gold/30 transition-all text-center"
          >
            <Phone className="mx-auto mb-2 text-luxury-gold" size={24} />
            <div className="text-luxury-gold font-medium">Submit Ticket</div>
            <div className="text-luxury-gold/80 text-sm">Detailed support</div>
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => {
                setActiveTab(tab.id as any)
                if (tab.id === 'tickets') {
                  loadTickets()
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
          {activeTab === 'faq' && (
            <div>
              {/* Search */}
              <div className="mb-6 relative">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <Search className="h-5 w-5 text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="Search frequently asked questions..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full pl-10 pr-4 py-3 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-luxury-gold/40"
                />
              </div>

              {/* Featured FAQs */}
              {featuredFaqs.length > 0 && (
                <div className="mb-8">
                  <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
                    ⭐ Popular Questions
                  </h3>
                  <div className="space-y-3">
                    {featuredFaqs.map((faq) => (
                      <div
                        key={faq.id}
                        className="bg-luxury-charcoal/20 border border-luxury-gold/20 rounded-xl backdrop-blur-sm"
                      >
                        <button
                          onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                          className="w-full p-4 text-left hover:bg-luxury-charcoal/30 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-white tracking-wide">
                              {faq.question}
                            </h4>
                            <span className="text-luxury-gold text-xl">
                              {expandedFaq === faq.id ? '−' : '+'}
                            </span>
                          </div>
                        </button>
                        {expandedFaq === faq.id && (
                          <div className="px-4 pb-4">
                            <p className="text-gray-300 font-light leading-relaxed">
                              {faq.answer}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Other FAQs */}
              {otherFaqs.length > 0 && (
                <div>
                  <h3 className="text-xl font-semibold text-white mb-4 tracking-wide">
                    📚 All Questions
                  </h3>
                  <div className="space-y-3">
                    {otherFaqs.map((faq) => (
                      <div
                        key={faq.id}
                        className="bg-luxury-charcoal/20 border border-luxury-gold/20 rounded-xl backdrop-blur-sm"
                      >
                        <button
                          onClick={() => setExpandedFaq(expandedFaq === faq.id ? null : faq.id)}
                          className="w-full p-4 text-left hover:bg-luxury-charcoal/30 transition-colors"
                        >
                          <div className="flex items-center justify-between">
                            <h4 className="font-medium text-white tracking-wide">
                              {faq.question}
                            </h4>
                            <span className="text-luxury-gold text-xl">
                              {expandedFaq === faq.id ? '−' : '+'}
                            </span>
                          </div>
                        </button>
                        {expandedFaq === faq.id && (
                          <div className="px-4 pb-4">
                            <p className="text-gray-300 font-light leading-relaxed">
                              {faq.answer}
                            </p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {filteredFaqs.length === 0 && (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🔍</div>
                  <h3 className="text-xl font-semibold text-white mb-2 tracking-wide">
                    No FAQs Found
                  </h3>
                  <p className="text-gray-300 font-light">
                    Try a different search term or contact us directly
                  </p>
                </div>
              )}
            </div>
          )}

          {activeTab === 'contact' && (
            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm">
              <h3 className="text-xl font-semibold text-white mb-6 tracking-wide">
                📝 Contact Support
              </h3>

              {submitSuccess && (
                <div className="mb-6 p-4 bg-green-500/10 border border-green-400/30 rounded-lg">
                  <p className="text-green-300 font-medium">
                    ✅ Support ticket submitted successfully!
                  </p>
                  <p className="text-green-200 text-sm font-light mt-1">
                    We'll respond within 24 hours. Check the "My Tickets" tab to track your request.
                  </p>
                </div>
              )}

              {submitError && (
                <div className="mb-6 p-4 bg-red-500/10 border border-red-400/30 rounded-lg">
                  <p className="text-red-300">{submitError}</p>
                </div>
              )}

              <form onSubmit={submitContactForm} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 font-light mb-2">Name</label>
                    <input
                      type="text"
                      value={contactForm.name}
                      onChange={(e) => setContactForm(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full px-4 py-3 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-luxury-gold/40"
                      placeholder="Your name"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-gray-300 font-light mb-2">Email</label>
                    <input
                      type="email"
                      value={contactForm.email}
                      onChange={(e) => setContactForm(prev => ({ ...prev, email: e.target.value }))}
                      className="w-full px-4 py-3 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-luxury-gold/40"
                      placeholder="your.email@example.com"
                      required
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-gray-300 font-light mb-2">Category</label>
                    <select
                      value={contactForm.category}
                      onChange={(e) => setContactForm(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full px-4 py-3 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg text-white focus:outline-none focus:border-luxury-gold/40"
                    >
                      <option value="general">General Question</option>
                      <option value="billing">Billing & Subscription</option>
                      <option value="technical">Technical Issue</option>
                      <option value="product">Product Question</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-gray-300 font-light mb-2">Priority</label>
                    <select
                      value={contactForm.priority}
                      onChange={(e) => setContactForm(prev => ({ ...prev, priority: e.target.value }))}
                      className="w-full px-4 py-3 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg text-white focus:outline-none focus:border-luxury-gold/40"
                    >
                      <option value="low">Low</option>
                      <option value="medium">Medium</option>
                      <option value="high">High</option>
                      <option value="urgent">Urgent</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-gray-300 font-light mb-2">Subject</label>
                  <input
                    type="text"
                    value={contactForm.subject}
                    onChange={(e) => setContactForm(prev => ({ ...prev, subject: e.target.value }))}
                    className="w-full px-4 py-3 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-luxury-gold/40"
                    placeholder="Brief description of your issue"
                    required
                  />
                </div>

                <div>
                  <label className="block text-gray-300 font-light mb-2">Message</label>
                  <textarea
                    value={contactForm.message}
                    onChange={(e) => setContactForm(prev => ({ ...prev, message: e.target.value }))}
                    rows={5}
                    className="w-full px-4 py-3 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-luxury-gold/40 resize-none"
                    placeholder="Please describe your issue in detail..."
                    required
                  />
                </div>

                <button
                  type="submit"
                  disabled={submitting}
                  className="w-full py-3 px-6 bg-luxury-gold hover:bg-luxury-gold/90 text-black rounded-lg font-medium transition-all tracking-wide disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : 'Submit Support Request'}
                </button>
              </form>
            </div>
          )}

          {activeTab === 'tickets' && (
            <div className="bg-luxury-charcoal/20 rounded-xl p-6 border border-luxury-gold/20 backdrop-blur-sm">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl font-semibold text-white tracking-wide">
                  🎫 Your Support Tickets
                </h3>
                <button
                  onClick={loadTickets}
                  disabled={loading}
                  className="px-4 py-2 bg-luxury-gold hover:bg-luxury-gold/90 text-black rounded-lg font-medium transition-all tracking-wide text-sm disabled:opacity-50"
                >
                  {loading ? 'Loading...' : 'Refresh'}
                </button>
              </div>

              {loading ? (
                <div className="flex items-center justify-center p-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-luxury-gold"></div>
                </div>
              ) : tickets.length === 0 ? (
                <div className="text-center py-8">
                  <div className="text-4xl mb-4">🎫</div>
                  <h4 className="text-lg font-medium text-white mb-2 tracking-wide">
                    No Support Tickets
                  </h4>
                  <p className="text-gray-300 font-light mb-4">
                    You haven't submitted any support requests yet
                  </p>
                  <button
                    onClick={() => setActiveTab('contact')}
                    className="px-6 py-2 bg-luxury-gold hover:bg-luxury-gold/90 text-black rounded-lg font-medium transition-all tracking-wide"
                  >
                    Submit Your First Ticket
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {tickets.map((ticket) => (
                    <div
                      key={ticket.id}
                      className="p-4 bg-luxury-charcoal/30 border border-luxury-gold/20 rounded-lg"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center space-x-3">
                          <span className="font-mono text-sm text-luxury-gold">
                            {ticket.ticket_number}
                          </span>
                          <span className={`px-2 py-1 rounded text-xs font-medium capitalize ${getStatusColor(ticket.status)}`}>
                            {ticket.status}
                          </span>
                        </div>
                        <span className="text-gray-400 text-sm font-light">
                          {new Date(ticket.created_at).toLocaleDateString()}
                        </span>
                      </div>
                      <h4 className="text-white font-medium">
                        {ticket.subject}
                      </h4>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}