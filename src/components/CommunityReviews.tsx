'use client'

import { useState, useEffect } from 'react'
import { Star, ThumbsUp, Shield, Eye, EyeOff, Award, Sparkles, TrendingUp, Heart } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'

// Privacy-first review system
interface Review {
  id: string
  productId: string
  rating: number
  title: string
  content: string
  pros: string[]
  cons: string[]
  skinType?: string // Optional, privacy-conscious
  ageRange?: string // Broad ranges only
  verified: boolean
  helpful: number
  anonymous: boolean
  authorId?: string // Hidden if anonymous
  authorName: string // Display name or "Anonymous Beauty Lover"
  authorBadge?: 'verified' | 'expert' | 'top_reviewer'
  date: string
  edited?: boolean
  images?: never // No user photos for privacy
}

// Aggregated insights without personal data
interface ProductInsights {
  averageRating: number
  totalReviews: number
  ratingDistribution: number[]
  commonPros: { text: string; count: number }[]
  commonCons: { text: string; count: number }[]
  bestFor: string[]
  notRecommendedFor: string[]
}

interface CommunityReviewsProps {
  productId?: string
  userId?: string
  onReviewSubmit?: (review: Partial<Review>) => void
}

// Demo data that respects privacy
const DEMO_REVIEWS: Review[] = [
  {
    id: '1',
    productId: 'product-1',
    rating: 5,
    title: 'Holy grail product!',
    content: 'This serum transformed my skin in just 2 weeks. The texture is lightweight and absorbs quickly.',
    pros: ['Lightweight texture', 'Fast absorption', 'Visible results'],
    cons: ['Price point'],
    skinType: 'Combination',
    verified: true,
    helpful: 245,
    anonymous: false,
    authorName: 'Sarah K.',
    authorBadge: 'verified',
    date: '2 days ago'
  },
  {
    id: '2',
    productId: 'product-1',
    rating: 4,
    title: 'Good but not perfect',
    content: 'Works well for my skin concerns but takes time to see results. Be patient!',
    pros: ['Gentle formula', 'No irritation', 'Nice packaging'],
    cons: ['Slow results', 'Strong fragrance'],
    verified: true,
    helpful: 89,
    anonymous: true,
    authorName: 'Anonymous Beauty Lover',
    date: '1 week ago'
  }
]

export default function CommunityReviews({
  productId,
  userId,
  onReviewSubmit
}: CommunityReviewsProps) {
  const [reviews, setReviews] = useState<Review[]>(DEMO_REVIEWS)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [anonymousMode, setAnonymousMode] = useState(true) // Default to anonymous
  const [sortBy, setSortBy] = useState<'helpful' | 'recent' | 'rating'>('helpful')
  const [filterVerified, setFilterVerified] = useState(false)

  // Review form state
  const [newReview, setNewReview] = useState<Partial<Review>>({
    rating: 0,
    title: '',
    content: '',
    pros: [],
    cons: [],
    anonymous: true
  })

  // Calculate insights
  const insights: ProductInsights = {
    averageRating: reviews.reduce((acc, r) => acc + r.rating, 0) / reviews.length || 0,
    totalReviews: reviews.length,
    ratingDistribution: [0, 0, 0, 0, 0].map((_, i) =>
      reviews.filter(r => r.rating === i + 1).length
    ),
    commonPros: [
      { text: 'Lightweight texture', count: 156 },
      { text: 'Fast absorption', count: 142 },
      { text: 'Visible results', count: 98 }
    ],
    commonCons: [
      { text: 'Price point', count: 45 },
      { text: 'Strong fragrance', count: 23 }
    ],
    bestFor: ['Combination skin', 'First signs of aging', 'Dullness'],
    notRecommendedFor: ['Very sensitive skin', 'Active breakouts']
  }

  // Sort reviews
  const sortedReviews = [...reviews].sort((a, b) => {
    switch (sortBy) {
      case 'helpful':
        return b.helpful - a.helpful
      case 'recent':
        return new Date(b.date).getTime() - new Date(a.date).getTime()
      case 'rating':
        return b.rating - a.rating
      default:
        return 0
    }
  })

  const filteredReviews = filterVerified
    ? sortedReviews.filter(r => r.verified)
    : sortedReviews

  // Handle review submission
  const handleSubmitReview = () => {
    const review: Review = {
      id: Date.now().toString(),
      productId: productId || 'product-1',
      rating: newReview.rating || 0,
      title: newReview.title || '',
      content: newReview.content || '',
      pros: newReview.pros || [],
      cons: newReview.cons || [],
      verified: false, // Will be verified after purchase
      helpful: 0,
      anonymous: anonymousMode,
      authorName: anonymousMode ? 'Anonymous Beauty Lover' : 'You',
      date: 'Just now'
    }

    setReviews([review, ...reviews])
    setShowReviewForm(false)
    if (onReviewSubmit) onReviewSubmit(review)

    // Reset form
    setNewReview({
      rating: 0,
      title: '',
      content: '',
      pros: [],
      cons: [],
      anonymous: true
    })

    // Haptic feedback
    if (window.navigator.vibrate) {
      window.navigator.vibrate(200)
    }
  }

  const markHelpful = (reviewId: string) => {
    setReviews(reviews.map(r =>
      r.id === reviewId ? { ...r, helpful: r.helpful + 1 } : r
    ))

    // Haptic feedback
    if (window.navigator.vibrate) {
      window.navigator.vibrate(50)
    }
  }

  return (
    <div className="community-reviews">
      {/* Privacy Notice */}
      <div className="privacy-notice">
        <Shield className="w-5 h-5 text-gold" />
        <p className="text-sm">
          Your privacy matters. Reviews can be posted anonymously. No photos required.
        </p>
      </div>

      {/* Product Insights */}
      <div className="product-insights">
        <h2 className="text-2xl font-light mb-6">Community Intelligence</h2>

        <div className="insights-grid">
          {/* Overall Rating */}
          <div className="insight-card">
            <div className="rating-display">
              <span className="rating-number">{insights.averageRating.toFixed(1)}</span>
              <div className="stars">
                {[1, 2, 3, 4, 5].map(star => (
                  <Star
                    key={star}
                    className={`w-5 h-5 ${star <= Math.round(insights.averageRating) ? 'text-gold fill-gold' : 'text-gray-600'}`}
                  />
                ))}
              </div>
              <span className="review-count">{insights.totalReviews} reviews</span>
            </div>

            {/* Rating Distribution */}
            <div className="rating-bars">
              {[5, 4, 3, 2, 1].map(rating => (
                <div key={rating} className="rating-bar">
                  <span className="rating-label">{rating}</span>
                  <div className="bar-container">
                    <div
                      className="bar-fill"
                      style={{
                        width: `${(insights.ratingDistribution[rating - 1] / insights.totalReviews) * 100}%`
                      }}
                    />
                  </div>
                  <span className="rating-count">
                    {insights.ratingDistribution[rating - 1]}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Common Feedback */}
          <div className="insight-card">
            <h3 className="insight-title">What People Love</h3>
            <div className="tags">
              {insights.commonPros.map((pro, i) => (
                <motion.span
                  key={i}
                  className="tag tag-pro"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  <ThumbsUp className="w-3 h-3" />
                  {pro.text}
                  <span className="tag-count">{pro.count}</span>
                </motion.span>
              ))}
            </div>

            <h3 className="insight-title mt-4">Considerations</h3>
            <div className="tags">
              {insights.commonCons.map((con, i) => (
                <motion.span
                  key={i}
                  className="tag tag-con"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ delay: i * 0.1 }}
                >
                  {con.text}
                  <span className="tag-count">{con.count}</span>
                </motion.span>
              ))}
            </div>
          </div>

          {/* Best For */}
          <div className="insight-card">
            <h3 className="insight-title">Best For</h3>
            <div className="best-for-list">
              {insights.bestFor.map((item, i) => (
                <div key={i} className="best-for-item">
                  <Sparkles className="w-4 h-4 text-gold" />
                  <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Review Controls */}
      <div className="review-controls">
        <button
          onClick={() => setShowReviewForm(!showReviewForm)}
          className="btn-luxury-primary"
        >
          Write a Review
        </button>

        <div className="filter-controls">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="sort-select"
          >
            <option value="helpful">Most Helpful</option>
            <option value="recent">Most Recent</option>
            <option value="rating">Highest Rated</option>
          </select>

          <label className="filter-verified">
            <input
              type="checkbox"
              checked={filterVerified}
              onChange={(e) => setFilterVerified(e.target.checked)}
            />
            <Shield className="w-4 h-4" />
            Verified Only
          </label>
        </div>
      </div>

      {/* Review Form */}
      <AnimatePresence>
        {showReviewForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="review-form"
          >
            <h3 className="form-title">Share Your Experience</h3>

            {/* Privacy Toggle */}
            <div className="privacy-toggle">
              <label className="toggle-label">
                <span>Post as</span>
                <button
                  type="button"
                  onClick={() => setAnonymousMode(!anonymousMode)}
                  className="toggle-button"
                >
                  {anonymousMode ? (
                    <>
                      <EyeOff className="w-4 h-4" />
                      Anonymous
                    </>
                  ) : (
                    <>
                      <Eye className="w-4 h-4" />
                      {userId || 'Public'}
                    </>
                  )}
                </button>
              </label>
              <p className="privacy-hint">
                {anonymousMode
                  ? 'Your identity will be completely hidden'
                  : 'Only your first name and last initial will show'}
              </p>
            </div>

            {/* Rating */}
            <div className="form-group">
              <label>Rating</label>
              <div className="star-rating">
                {[1, 2, 3, 4, 5].map(star => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => setNewReview({ ...newReview, rating: star })}
                    className="star-button"
                  >
                    <Star
                      className={`w-6 h-6 ${star <= (newReview.rating || 0) ? 'text-gold fill-gold' : 'text-gray-600'}`}
                    />
                  </button>
                ))}
              </div>
            </div>

            {/* Title */}
            <div className="form-group">
              <input
                type="text"
                placeholder="Review title (optional)"
                value={newReview.title}
                onChange={(e) => setNewReview({ ...newReview, title: e.target.value })}
                className="input-luxury"
                maxLength={100}
              />
            </div>

            {/* Content */}
            <div className="form-group">
              <textarea
                placeholder="Share your experience..."
                value={newReview.content}
                onChange={(e) => setNewReview({ ...newReview, content: e.target.value })}
                className="input-luxury"
                rows={4}
                maxLength={500}
              />
              <span className="char-count">
                {newReview.content?.length || 0}/500
              </span>
            </div>

            {/* Submit */}
            <div className="form-actions">
              <button
                onClick={() => setShowReviewForm(false)}
                className="btn-luxury-ghost"
              >
                Cancel
              </button>
              <button
                onClick={handleSubmitReview}
                className="btn-luxury-primary"
                disabled={!newReview.rating || !newReview.content}
              >
                Submit Review
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reviews List */}
      <div className="reviews-list">
        {filteredReviews.map((review, index) => (
          <motion.div
            key={review.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            className="review-card"
          >
            <div className="review-header">
              <div className="reviewer-info">
                <div className="reviewer-avatar">
                  {review.anonymous ? (
                    <EyeOff className="w-5 h-5" />
                  ) : (
                    <span>{review.authorName[0]}</span>
                  )}
                </div>
                <div>
                  <div className="reviewer-name">
                    {review.authorName}
                    {review.authorBadge && (
                      <span className={`badge badge-${review.authorBadge}`}>
                        {review.authorBadge === 'verified' && <Shield className="w-3 h-3" />}
                        {review.authorBadge === 'expert' && <Award className="w-3 h-3" />}
                        {review.authorBadge === 'top_reviewer' && <TrendingUp className="w-3 h-3" />}
                      </span>
                    )}
                  </div>
                  <div className="review-meta">
                    <div className="stars-small">
                      {[1, 2, 3, 4, 5].map(star => (
                        <Star
                          key={star}
                          className={`w-3 h-3 ${star <= review.rating ? 'text-gold fill-gold' : 'text-gray-600'}`}
                        />
                      ))}
                    </div>
                    <span className="review-date">{review.date}</span>
                    {review.edited && <span className="edited-badge">Edited</span>}
                  </div>
                </div>
              </div>

              {review.verified && (
                <div className="verified-badge">
                  <Shield className="w-4 h-4" />
                  Verified Purchase
                </div>
              )}
            </div>

            <div className="review-content">
              {review.title && <h4 className="review-title">{review.title}</h4>}
              <p className="review-text">{review.content}</p>

              {(review.pros.length > 0 || review.cons.length > 0) && (
                <div className="pros-cons">
                  {review.pros.length > 0 && (
                    <div className="pros">
                      <span className="label">Pros:</span>
                      {review.pros.map((pro, i) => (
                        <span key={i} className="item">{pro}</span>
                      ))}
                    </div>
                  )}
                  {review.cons.length > 0 && (
                    <div className="cons">
                      <span className="label">Cons:</span>
                      {review.cons.map((con, i) => (
                        <span key={i} className="item">{con}</span>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {review.skinType && (
                <div className="review-tags">
                  <span className="skin-type-tag">{review.skinType}</span>
                </div>
              )}
            </div>

            <div className="review-footer">
              <button
                onClick={() => markHelpful(review.id)}
                className="helpful-button"
              >
                <ThumbsUp className="w-4 h-4" />
                Helpful ({review.helpful})
              </button>
            </div>
          </motion.div>
        ))}
      </div>

      <style jsx>{`
        .community-reviews {
          max-width: 1200px;
          margin: 0 auto;
          padding: 2rem;
        }

        .privacy-notice {
          display: flex;
          align-items: center;
          gap: 1rem;
          padding: 1rem;
          background: rgba(212, 175, 55, 0.1);
          border: 1px solid rgba(212, 175, 55, 0.3);
          border-radius: 8px;
          margin-bottom: 2rem;
        }

        .product-insights {
          margin-bottom: 3rem;
        }

        .insights-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 2rem;
        }

        .insight-card {
          background: #1E1E1E;
          padding: 1.5rem;
          border-radius: 8px;
          border: 1px solid rgba(212, 175, 55, 0.1);
        }

        .rating-display {
          text-align: center;
          margin-bottom: 1.5rem;
        }

        .rating-number {
          font-size: 3rem;
          color: #D4AF37;
          display: block;
          font-weight: 300;
        }

        .stars {
          display: flex;
          justify-content: center;
          gap: 0.25rem;
          margin: 0.5rem 0;
        }

        .review-count {
          color: #FAFAFA;
          opacity: 0.7;
        }

        .rating-bars {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .rating-bar {
          display: flex;
          align-items: center;
          gap: 0.5rem;
        }

        .rating-label {
          width: 20px;
          color: #D4AF37;
        }

        .bar-container {
          flex: 1;
          height: 8px;
          background: rgba(212, 175, 55, 0.1);
          border-radius: 4px;
          overflow: hidden;
        }

        .bar-fill {
          height: 100%;
          background: linear-gradient(90deg, #D4AF37, #F7E7CE);
          transition: width 0.3s;
        }

        .rating-count {
          width: 30px;
          color: #FAFAFA;
          opacity: 0.5;
          font-size: 0.875rem;
        }

        .insight-title {
          color: #D4AF37;
          font-size: 1.125rem;
          margin-bottom: 1rem;
        }

        .tags {
          display: flex;
          flex-wrap: wrap;
          gap: 0.5rem;
        }

        .tag {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.75rem;
          background: rgba(212, 175, 55, 0.1);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 20px;
          color: #FAFAFA;
          font-size: 0.875rem;
        }

        .tag-count {
          opacity: 0.5;
          margin-left: 0.25rem;
        }

        .tag-pro {
          background: rgba(16, 185, 129, 0.1);
          border-color: rgba(16, 185, 129, 0.2);
        }

        .tag-con {
          background: rgba(245, 158, 11, 0.1);
          border-color: rgba(245, 158, 11, 0.2);
        }

        .best-for-list {
          display: flex;
          flex-direction: column;
          gap: 0.75rem;
        }

        .best-for-item {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #FAFAFA;
        }

        .review-controls {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 2rem;
        }

        .filter-controls {
          display: flex;
          gap: 1rem;
          align-items: center;
        }

        .sort-select {
          padding: 0.5rem 1rem;
          background: #1E1E1E;
          border: 1px solid rgba(212, 175, 55, 0.2);
          color: #FAFAFA;
          border-radius: 4px;
        }

        .filter-verified {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #FAFAFA;
          cursor: pointer;
        }

        .review-form {
          background: #1E1E1E;
          padding: 2rem;
          border-radius: 8px;
          border: 1px solid rgba(212, 175, 55, 0.2);
          margin-bottom: 2rem;
        }

        .form-title {
          font-size: 1.5rem;
          color: #D4AF37;
          margin-bottom: 1.5rem;
        }

        .privacy-toggle {
          margin-bottom: 1.5rem;
          padding: 1rem;
          background: rgba(212, 175, 55, 0.05);
          border-radius: 4px;
        }

        .toggle-label {
          display: flex;
          align-items: center;
          gap: 1rem;
          color: #FAFAFA;
        }

        .toggle-button {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: #0A0A0A;
          border: 1px solid #D4AF37;
          color: #D4AF37;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .toggle-button:hover {
          background: rgba(212, 175, 55, 0.1);
        }

        .privacy-hint {
          font-size: 0.75rem;
          color: #FAFAFA;
          opacity: 0.6;
          margin-top: 0.5rem;
        }

        .form-group {
          margin-bottom: 1.5rem;
        }

        .star-rating {
          display: flex;
          gap: 0.5rem;
        }

        .star-button {
          background: none;
          border: none;
          cursor: pointer;
          transition: transform 0.2s;
        }

        .star-button:hover {
          transform: scale(1.1);
        }

        .char-count {
          display: block;
          text-align: right;
          color: #FAFAFA;
          opacity: 0.5;
          font-size: 0.875rem;
          margin-top: 0.5rem;
        }

        .form-actions {
          display: flex;
          gap: 1rem;
          justify-content: flex-end;
        }

        .reviews-list {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }

        .review-card {
          background: #1E1E1E;
          padding: 1.5rem;
          border-radius: 8px;
          border: 1px solid rgba(212, 175, 55, 0.1);
        }

        .review-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 1rem;
        }

        .reviewer-info {
          display: flex;
          gap: 1rem;
        }

        .reviewer-avatar {
          width: 40px;
          height: 40px;
          border-radius: 50%;
          background: rgba(212, 175, 55, 0.2);
          display: flex;
          align-items: center;
          justify-content: center;
          color: #D4AF37;
        }

        .reviewer-name {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          color: #FAFAFA;
          font-weight: 500;
        }

        .badge {
          display: inline-flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.125rem 0.5rem;
          border-radius: 12px;
          font-size: 0.75rem;
        }

        .badge-verified {
          background: rgba(59, 130, 246, 0.1);
          color: #3B82F6;
        }

        .badge-expert {
          background: rgba(139, 92, 246, 0.1);
          color: #8B5CF6;
        }

        .badge-top_reviewer {
          background: rgba(212, 175, 55, 0.1);
          color: #D4AF37;
        }

        .review-meta {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          margin-top: 0.25rem;
        }

        .stars-small {
          display: flex;
          gap: 2px;
        }

        .review-date {
          color: #FAFAFA;
          opacity: 0.5;
          font-size: 0.875rem;
        }

        .edited-badge {
          color: #FAFAFA;
          opacity: 0.3;
          font-size: 0.75rem;
        }

        .verified-badge {
          display: flex;
          align-items: center;
          gap: 0.25rem;
          padding: 0.25rem 0.75rem;
          background: rgba(16, 185, 129, 0.1);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 20px;
          color: #10B981;
          font-size: 0.875rem;
        }

        .review-title {
          font-size: 1.125rem;
          color: #FAFAFA;
          margin-bottom: 0.5rem;
        }

        .review-text {
          color: #FAFAFA;
          opacity: 0.9;
          line-height: 1.6;
        }

        .pros-cons {
          display: flex;
          gap: 2rem;
          margin-top: 1rem;
        }

        .pros, .cons {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          flex-wrap: wrap;
        }

        .pros .label {
          color: #10B981;
          font-weight: 500;
        }

        .cons .label {
          color: #F59E0B;
          font-weight: 500;
        }

        .pros .item, .cons .item {
          padding: 0.125rem 0.5rem;
          background: rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          font-size: 0.875rem;
          color: #FAFAFA;
        }

        .review-tags {
          display: flex;
          gap: 0.5rem;
          margin-top: 1rem;
        }

        .skin-type-tag {
          padding: 0.25rem 0.75rem;
          background: rgba(212, 175, 55, 0.1);
          border: 1px solid rgba(212, 175, 55, 0.2);
          border-radius: 12px;
          color: #D4AF37;
          font-size: 0.875rem;
        }

        .review-footer {
          margin-top: 1rem;
          padding-top: 1rem;
          border-top: 1px solid rgba(212, 175, 55, 0.1);
        }

        .helpful-button {
          display: inline-flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.5rem 1rem;
          background: transparent;
          border: 1px solid rgba(212, 175, 55, 0.2);
          color: #FAFAFA;
          border-radius: 20px;
          cursor: pointer;
          transition: all 0.3s;
        }

        .helpful-button:hover {
          border-color: #D4AF37;
          background: rgba(212, 175, 55, 0.1);
          color: #D4AF37;
        }

        @media (max-width: 768px) {
          .community-reviews {
            padding: 1rem;
          }

          .insights-grid {
            grid-template-columns: 1fr;
          }

          .review-controls {
            flex-direction: column;
            gap: 1rem;
            align-items: stretch;
          }

          .filter-controls {
            justify-content: space-between;
          }

          .pros-cons {
            flex-direction: column;
            gap: 1rem;
          }
        }
      `}</style>
    </div>
  )
}