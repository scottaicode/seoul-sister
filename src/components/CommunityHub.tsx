'use client'

import { useState, useEffect } from 'react'
import { useUserProfile } from '@/hooks/useUserProfile'
import type { Product } from '@/hooks/useProducts'

interface ProductReview {
  id: string
  user_id: string
  product_id: string
  rating: number
  title: string
  review_text: string
  reviewer_skin_type: string
  reviewer_age_range: string
  reviewer_concerns: string[]
  usage_duration: string
  effectiveness_rating: number
  would_repurchase: boolean
  would_recommend: boolean
  noticed_improvements: string[]
  experienced_issues: string[]
  created_at: string
  helpful_votes: number
  total_votes: number
  reviewer_name?: string
}

interface CommunityDiscussion {
  id: string
  title: string
  content: string
  discussion_type: string
  category: string
  tags: string[]
  views_count: number
  replies_count: number
  created_at: string
  user_name?: string
}

interface CommunityHubProps {
  userEmail?: string
  products: Product[]
}

export default function CommunityHub({ userEmail, products }: CommunityHubProps) {
  const { profile } = useUserProfile(userEmail)
  const [activeTab, setActiveTab] = useState<'reviews' | 'discussions' | 'write_review'>('reviews')
  const [reviews, setReviews] = useState<ProductReview[]>([])
  const [discussions, setDiscussions] = useState<CommunityDiscussion[]>([])
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(false)
  const [newReview, setNewReview] = useState({
    product_id: '',
    rating: 5,
    title: '',
    review_text: '',
    usage_duration: '1 month',
    effectiveness_rating: 5,
    would_repurchase: true,
    would_recommend: true,
    noticed_improvements: [] as string[],
    experienced_issues: [] as string[]
  })

  useEffect(() => {
    fetchReviews()
    fetchDiscussions()
  }, [])

  const fetchReviews = async () => {
    try {
      const response = await fetch('/api/community/reviews')
      const data = await response.json()
      setReviews(data.reviews || [])
    } catch (error) {
      console.error('Error fetching reviews:', error)
    }
  }

  const fetchDiscussions = async () => {
    try {
      const response = await fetch('/api/community/discussions')
      const data = await response.json()
      setDiscussions(data.discussions || [])
    } catch (error) {
      console.error('Error fetching discussions:', error)
    }
  }

  const submitReview = async () => {
    if (!profile?.id || !newReview.product_id) return

    setLoading(true)
    try {
      const response = await fetch('/api/community/reviews', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          user_id: profile.id,
          ...newReview,
          reviewer_skin_type: profile.skin_type,
          reviewer_age_range: profile.estimated_age_range || '25-35',
          reviewer_concerns: profile.skin_concerns || []
        })
      })

      if (response.ok) {
        alert('Review submitted successfully!')
        setNewReview({
          product_id: '',
          rating: 5,
          title: '',
          review_text: '',
          usage_duration: '1 month',
          effectiveness_rating: 5,
          would_repurchase: true,
          would_recommend: true,
          noticed_improvements: [],
          experienced_issues: []
        })
        setActiveTab('reviews')
        fetchReviews()
      } else {
        throw new Error('Failed to submit review')
      }
    } catch (error) {
      console.error('Error submitting review:', error)
      alert('Failed to submit review. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const voteHelpful = async (reviewId: string) => {
    if (!profile?.id) return

    try {
      await fetch('/api/community/reviews/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          review_id: reviewId,
          user_id: profile.id,
          vote_type: 'helpful'
        })
      })
      fetchReviews() // Refresh to show updated votes
    } catch (error) {
      console.error('Error voting:', error)
    }
  }

  const renderStars = (rating: number, size: 'sm' | 'md' = 'md') => {
    const sizeClass = size === 'sm' ? 'text-sm' : 'text-lg'
    return (
      <div className={`flex ${sizeClass}`}>
        {[1, 2, 3, 4, 5].map(star => (
          <span
            key={star}
            className={star <= rating ? 'text-yellow-400' : 'text-gray-300'}
          >
            ★
          </span>
        ))}
      </div>
    )
  }

  const improvementOptions = [
    'Hydration', 'Brightness', 'Texture', 'Pore size', 'Acne reduction',
    'Fine lines', 'Dark spots', 'Redness', 'Overall glow', 'Firmness'
  ]

  const issueOptions = [
    'Irritation', 'Breakouts', 'Dryness', 'Greasiness', 'No visible results',
    'Strong fragrance', 'Difficult application', 'Expensive', 'Packaging issues'
  ]

  const tabs = [
    { id: 'reviews', label: '⭐ Reviews', desc: 'Real user experiences' },
    { id: 'discussions', label: '💬 Discussions', desc: 'Community conversations' },
    { id: 'write_review', label: '✍️ Write Review', desc: 'Share your experience' }
  ]

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="text-center mb-8">
        <h1 className="text-3xl font-bold text-gray-800 mb-2">
          🌸 Community Hub
        </h1>
        <p className="text-gray-600">
          Share experiences, read reviews, and connect with fellow K-beauty enthusiasts
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="flex flex-wrap gap-4 mb-8">
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id as any)}
            className={`flex-1 min-w-48 p-4 rounded-xl border transition-all ${
              activeTab === tab.id
                ? 'bg-gradient-to-r from-pink-500 to-purple-600 text-white border-transparent shadow-lg'
                : 'bg-white text-gray-700 border-gray-200 hover:border-pink-300 hover:shadow-md'
            }`}
          >
            <div className="text-lg font-medium mb-1">{tab.label}</div>
            <div className={`text-sm ${activeTab === tab.id ? 'text-pink-100' : 'text-gray-500'}`}>
              {tab.desc}
            </div>
          </button>
        ))}
      </div>

      {/* Reviews Tab */}
      {activeTab === 'reviews' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">Latest Product Reviews</h3>

            {reviews.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">⭐</div>
                <p>No reviews yet. Be the first to share your experience!</p>
              </div>
            ) : (
              <div className="space-y-6">
                {reviews.map(review => {
                  const product = products.find(p => p.id === review.product_id)
                  return (
                    <div key={review.id} className="border border-gray-100 rounded-lg p-6">
                      {/* Review Header */}
                      <div className="flex justify-between items-start mb-4">
                        <div>
                          <h4 className="font-semibold text-gray-800">{review.title}</h4>
                          <div className="flex items-center gap-2 mt-1">
                            {renderStars(review.rating, 'sm')}
                            <span className="text-sm text-gray-500">
                              {review.rating}/5 • {review.usage_duration}
                            </span>
                          </div>
                        </div>
                        <div className="text-right text-sm text-gray-500">
                          {new Date(review.created_at).toLocaleDateString()}
                        </div>
                      </div>

                      {/* Product Info */}
                      {product && (
                        <div className="bg-gray-50 p-3 rounded-lg mb-4">
                          <div className="font-medium text-gray-800">{product.name_english}</div>
                          <div className="text-sm text-gray-600">{product.brand} • {product.category}</div>
                        </div>
                      )}

                      {/* Reviewer Profile */}
                      <div className="flex flex-wrap gap-2 mb-4">
                        <span className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                          {review.reviewer_skin_type} skin
                        </span>
                        <span className="bg-purple-100 text-purple-800 px-2 py-1 rounded text-xs">
                          {review.reviewer_age_range}
                        </span>
                        {review.reviewer_concerns.map(concern => (
                          <span key={concern} className="bg-pink-100 text-pink-800 px-2 py-1 rounded text-xs">
                            {concern}
                          </span>
                        ))}
                      </div>

                      {/* Review Content */}
                      <p className="text-gray-700 mb-4">{review.review_text}</p>

                      {/* Effectiveness & Recommendations */}
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                        <div className="text-center">
                          <div className="text-sm text-gray-500">Effectiveness</div>
                          {renderStars(review.effectiveness_rating, 'sm')}
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-gray-500">Would Repurchase</div>
                          <div className={`text-sm font-medium ${review.would_repurchase ? 'text-green-600' : 'text-red-600'}`}>
                            {review.would_repurchase ? '✓ Yes' : '✗ No'}
                          </div>
                        </div>
                        <div className="text-center">
                          <div className="text-sm text-gray-500">Would Recommend</div>
                          <div className={`text-sm font-medium ${review.would_recommend ? 'text-green-600' : 'text-red-600'}`}>
                            {review.would_recommend ? '✓ Yes' : '✗ No'}
                          </div>
                        </div>
                      </div>

                      {/* Improvements & Issues */}
                      {(review.noticed_improvements.length > 0 || review.experienced_issues.length > 0) && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                          {review.noticed_improvements.length > 0 && (
                            <div>
                              <div className="text-sm font-medium text-green-700 mb-2">✓ Improvements Noticed:</div>
                              <div className="flex flex-wrap gap-1">
                                {review.noticed_improvements.map(improvement => (
                                  <span key={improvement} className="bg-green-100 text-green-800 px-2 py-1 rounded text-xs">
                                    {improvement}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}

                          {review.experienced_issues.length > 0 && (
                            <div>
                              <div className="text-sm font-medium text-red-700 mb-2">⚠ Issues Experienced:</div>
                              <div className="flex flex-wrap gap-1">
                                {review.experienced_issues.map(issue => (
                                  <span key={issue} className="bg-red-100 text-red-800 px-2 py-1 rounded text-xs">
                                    {issue}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Helpful Votes */}
                      <div className="flex justify-between items-center pt-4 border-t border-gray-100">
                        <button
                          onClick={() => voteHelpful(review.id)}
                          disabled={!profile}
                          className="text-sm text-gray-600 hover:text-pink-600 transition-colors disabled:opacity-50"
                        >
                          👍 Helpful ({review.helpful_votes})
                        </button>
                        <div className="text-xs text-gray-500">
                          {review.helpful_votes} of {review.total_votes} found helpful
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Discussions Tab */}
      {activeTab === 'discussions' && (
        <div className="space-y-6">
          <div className="bg-white rounded-xl border border-gray-200 p-6">
            <h3 className="text-xl font-semibold text-gray-800 mb-6">Community Discussions</h3>

            {discussions.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <div className="text-4xl mb-4">💬</div>
                <p>No discussions yet. Start a conversation!</p>
              </div>
            ) : (
              <div className="space-y-4">
                {discussions.map(discussion => (
                  <div key={discussion.id} className="border border-gray-100 rounded-lg p-4 hover:shadow-md transition-shadow">
                    <div className="flex justify-between items-start mb-2">
                      <h4 className="font-medium text-gray-800 hover:text-pink-600 cursor-pointer">
                        {discussion.title}
                      </h4>
                      <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded">
                        {discussion.discussion_type}
                      </span>
                    </div>

                    <p className="text-gray-600 text-sm mb-3 line-clamp-2">{discussion.content}</p>

                    <div className="flex justify-between items-center text-xs text-gray-500">
                      <div className="flex gap-4">
                        <span>👀 {discussion.views_count} views</span>
                        <span>💬 {discussion.replies_count} replies</span>
                      </div>
                      <span>{new Date(discussion.created_at).toLocaleDateString()}</span>
                    </div>

                    {discussion.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {discussion.tags.map(tag => (
                          <span key={tag} className="bg-blue-100 text-blue-800 px-2 py-1 rounded text-xs">
                            #{tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Write Review Tab */}
      {activeTab === 'write_review' && (
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <h3 className="text-xl font-semibold text-gray-800 mb-6">Write a Product Review</h3>

          {!profile ? (
            <div className="text-center py-12 text-gray-500">
              <div className="text-4xl mb-4">👤</div>
              <p>Please create a profile to write reviews</p>
            </div>
          ) : (
            <div className="space-y-6">
              {/* Product Selection */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Select Product</label>
                <select
                  value={newReview.product_id}
                  onChange={(e) => setNewReview(prev => ({ ...prev, product_id: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                >
                  <option value="">Choose a product...</option>
                  {products.map(product => (
                    <option key={product.id} value={product.id}>
                      {product.name_english} by {product.brand}
                    </option>
                  ))}
                </select>
              </div>

              {/* Rating & Title */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Overall Rating</label>
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map(star => (
                      <button
                        key={star}
                        onClick={() => setNewReview(prev => ({ ...prev, rating: star }))}
                        className={`text-2xl ${star <= newReview.rating ? 'text-yellow-400' : 'text-gray-300'}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Usage Duration</label>
                  <select
                    value={newReview.usage_duration}
                    onChange={(e) => setNewReview(prev => ({ ...prev, usage_duration: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  >
                    <option value="1 week">1 week</option>
                    <option value="2 weeks">2 weeks</option>
                    <option value="1 month">1 month</option>
                    <option value="2 months">2 months</option>
                    <option value="3+ months">3+ months</option>
                  </select>
                </div>
              </div>

              {/* Review Title */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Review Title</label>
                <input
                  type="text"
                  value={newReview.title}
                  onChange={(e) => setNewReview(prev => ({ ...prev, title: e.target.value }))}
                  placeholder="Summarize your experience in a few words..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                />
              </div>

              {/* Review Text */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Your Review</label>
                <textarea
                  value={newReview.review_text}
                  onChange={(e) => setNewReview(prev => ({ ...prev, review_text: e.target.value }))}
                  placeholder="Share your detailed experience with this product..."
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-pink-500"
                  rows={6}
                />
              </div>

              {/* Effectiveness Rating */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Effectiveness Rating</label>
                <div className="flex gap-1">
                  {[1, 2, 3, 4, 5].map(star => (
                    <button
                      key={star}
                      onClick={() => setNewReview(prev => ({ ...prev, effectiveness_rating: star }))}
                      className={`text-xl ${star <= newReview.effectiveness_rating ? 'text-yellow-400' : 'text-gray-300'}`}
                    >
                      ★
                    </button>
                  ))}
                </div>
              </div>

              {/* Improvements Noticed */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Improvements Noticed</label>
                <div className="flex flex-wrap gap-2">
                  {improvementOptions.map(improvement => (
                    <button
                      key={improvement}
                      onClick={() => {
                        setNewReview(prev => ({
                          ...prev,
                          noticed_improvements: prev.noticed_improvements.includes(improvement)
                            ? prev.noticed_improvements.filter(i => i !== improvement)
                            : [...prev.noticed_improvements, improvement]
                        }))
                      }}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        newReview.noticed_improvements.includes(improvement)
                          ? 'bg-green-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {improvement}
                    </button>
                  ))}
                </div>
              </div>

              {/* Issues Experienced */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Issues Experienced (if any)</label>
                <div className="flex flex-wrap gap-2">
                  {issueOptions.map(issue => (
                    <button
                      key={issue}
                      onClick={() => {
                        setNewReview(prev => ({
                          ...prev,
                          experienced_issues: prev.experienced_issues.includes(issue)
                            ? prev.experienced_issues.filter(i => i !== issue)
                            : [...prev.experienced_issues, issue]
                        }))
                      }}
                      className={`px-3 py-1 rounded-full text-sm transition-colors ${
                        newReview.experienced_issues.includes(issue)
                          ? 'bg-red-500 text-white'
                          : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {issue}
                    </button>
                  ))}
                </div>
              </div>

              {/* Recommendations */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Would you repurchase?</label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setNewReview(prev => ({ ...prev, would_repurchase: true }))}
                      className={`px-4 py-2 rounded-lg ${newReview.would_repurchase ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setNewReview(prev => ({ ...prev, would_repurchase: false }))}
                      className={`px-4 py-2 rounded-lg ${!newReview.would_repurchase ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      No
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Would you recommend?</label>
                  <div className="flex gap-4">
                    <button
                      onClick={() => setNewReview(prev => ({ ...prev, would_recommend: true }))}
                      className={`px-4 py-2 rounded-lg ${newReview.would_recommend ? 'bg-green-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      Yes
                    </button>
                    <button
                      onClick={() => setNewReview(prev => ({ ...prev, would_recommend: false }))}
                      className={`px-4 py-2 rounded-lg ${!newReview.would_recommend ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-700'}`}
                    >
                      No
                    </button>
                  </div>
                </div>
              </div>

              {/* Submit Button */}
              <div className="flex justify-end">
                <button
                  onClick={submitReview}
                  disabled={loading || !newReview.product_id || !newReview.title || !newReview.review_text}
                  className="bg-gradient-to-r from-pink-500 to-purple-600 text-white px-8 py-3 rounded-lg hover:shadow-lg transition-all disabled:opacity-50"
                >
                  {loading ? 'Submitting...' : 'Submit Review'}
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}