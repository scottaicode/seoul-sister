'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Star,
  Shield,
  Package,
  Heart,
  Share2,
  Camera,
  Plus,
} from 'lucide-react'
import IngredientList from '@/components/products/IngredientList'
import PriceComparison from '@/components/products/PriceComparison'
import ReviewCard from '@/components/community/ReviewCard'
import ReviewForm, { type ReviewFormData } from '@/components/community/ReviewForm'
import ReviewFilters from '@/components/community/ReviewFilters'
import LoadingSpinner from '@/components/ui/LoadingSpinner'
import type { Product, Review } from '@/types/database'

const categoryLabels: Record<string, string> = {
  cleanser: 'Cleanser',
  toner: 'Toner',
  essence: 'Essence',
  serum: 'Serum',
  ampoule: 'Ampoule',
  moisturizer: 'Moisturizer',
  sunscreen: 'Sunscreen',
  mask: 'Mask',
  eye_care: 'Eye Care',
  lip_care: 'Lip Care',
  exfoliator: 'Exfoliator',
  oil: 'Oil',
  mist: 'Mist',
  spot_treatment: 'Spot Treatment',
}

interface ReviewSummary {
  count: number
  avg_rating: number
  holy_grail_count: number
  broke_me_out_count: number
}

interface ProductDetailData {
  product: Product
  ingredients: Array<{
    position: number
    concentration_pct: number | null
    ingredient: {
      id: string
      name_inci: string
      name_en: string | null
      name_ko: string | null
      function: string
      description: string
      safety_rating: number
      comedogenic_rating: number
      is_fragrance: boolean
      is_active: boolean
      common_concerns: string[]
    }
  }>
  review_summary: ReviewSummary | null
}

export default function ProductDetailPage() {
  const params = useParams()
  const router = useRouter()
  const id = params.id as string

  const [data, setData] = useState<ProductDetailData | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'ingredients' | 'prices' | 'reviews'>('ingredients')
  const [reviews, setReviews] = useState<Review[]>([])
  const [reviewsLoading, setReviewsLoading] = useState(false)
  const [showReviewForm, setShowReviewForm] = useState(false)
  const [reviewFilters, setReviewFilters] = useState<Record<string, string | number | undefined>>({})
  const [reviewsPage, setReviewsPage] = useState(1)
  const [reviewsTotalPages, setReviewsTotalPages] = useState(1)

  useEffect(() => {
    async function fetchProduct() {
      try {
        const res = await fetch(`/api/products/${id}`)
        if (!res.ok) throw new Error('Product not found')
        const json = await res.json()
        setData(json)
      } catch {
        router.push('/products')
      } finally {
        setLoading(false)
      }
    }
    if (id) fetchProduct()
  }, [id, router])

  // Fetch reviews when reviews tab is active
  useEffect(() => {
    if (activeTab !== 'reviews' || !id) return
    async function fetchReviews() {
      setReviewsLoading(true)
      try {
        const params = new URLSearchParams()
        params.set('product_id', id)
        params.set('page', String(reviewsPage))
        params.set('limit', '10')
        for (const [key, val] of Object.entries(reviewFilters)) {
          if (val !== undefined) params.set(key, String(val))
        }
        const res = await fetch(`/api/reviews?${params.toString()}`)
        const json = await res.json()
        setReviews(json.reviews ?? [])
        setReviewsTotalPages(json.total_pages ?? 1)
      } catch {
        setReviews([])
      } finally {
        setReviewsLoading(false)
      }
    }
    fetchReviews()
  }, [activeTab, id, reviewsPage, reviewFilters])

  async function handleSubmitReview(formData: ReviewFormData) {
    const res = await fetch('/api/reviews', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formData),
    })
    if (!res.ok) throw new Error('Failed to submit review')
    setShowReviewForm(false)
    // Refetch reviews
    setReviewsPage(1)
    setReviewFilters({ ...reviewFilters })
  }

  async function handleVote(reviewId: string, isHelpful: boolean) {
    const res = await fetch(`/api/reviews/${reviewId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_helpful: isHelpful }),
    })
    if (!res.ok) throw new Error('Vote failed')
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LoadingSpinner size="lg" />
      </div>
    )
  }

  if (!data) return null

  const { product, ingredients, review_summary } = data

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
      {/* Back nav */}
      <button
        onClick={() => router.back()}
        className="flex items-center gap-1.5 text-sm text-seoul-soft hover:text-seoul-charcoal transition-colors duration-200"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      {/* Product header */}
      <div className="glass-card-strong p-5 flex flex-col sm:flex-row gap-4">
        {/* Product image */}
        <div className="flex-shrink-0 w-24 h-24 sm:w-28 sm:h-28 rounded-2xl bg-seoul-pearl flex items-center justify-center overflow-hidden mx-auto sm:mx-0">
          {product.image_url ? (
            <img
              src={product.image_url}
              alt={product.name_en}
              className="w-full h-full object-cover rounded-2xl"
            />
          ) : (
            <Package className="w-10 h-10 text-rose-gold/50" strokeWidth={1.25} />
          )}
        </div>

        {/* Product info */}
        <div className="flex-1 flex flex-col gap-2 text-center sm:text-left">
          <div>
            <span className="badge-blue text-[10px] mb-1 inline-block">
              {categoryLabels[product.category] ?? product.category}
            </span>
            <h1 className="font-display font-bold text-xl text-seoul-charcoal leading-tight">
              {product.name_en}
            </h1>
            {product.name_ko && (
              <p className="text-sm text-seoul-soft mt-0.5">{product.name_ko}</p>
            )}
            <p className="text-sm text-seoul-soft">{product.brand_en}</p>
          </div>

          <div className="flex items-center gap-3 justify-center sm:justify-start flex-wrap">
            {product.rating_avg && (
              <span className="flex items-center gap-1 text-sm">
                <Star className="w-4 h-4 fill-rose-gold text-rose-gold" />
                <span className="font-semibold text-seoul-charcoal">
                  {Number(product.rating_avg).toFixed(1)}
                </span>
                {product.review_count > 0 && (
                  <span className="text-seoul-soft text-xs">
                    ({product.review_count} reviews)
                  </span>
                )}
              </span>
            )}
            {product.is_verified && (
              <span className="flex items-center gap-1 text-xs text-green-600">
                <Shield className="w-3.5 h-3.5" />
                Verified
              </span>
            )}
          </div>

          <div className="flex items-center gap-3 justify-center sm:justify-start">
            {product.price_usd && (
              <span className="font-display font-bold text-2xl text-seoul-charcoal">
                ${Number(product.price_usd).toFixed(2)}
              </span>
            )}
            {product.volume_display && (
              <span className="text-sm text-seoul-soft">{product.volume_display}</span>
            )}
            {product.price_krw && (
              <span className="text-xs text-seoul-soft">
                ({product.price_krw.toLocaleString()})
              </span>
            )}
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2 justify-center sm:justify-start mt-1">
            <button className="flex items-center gap-1.5 glass-button text-xs px-3 py-2">
              <Heart className="w-3.5 h-3.5" /> Wishlist
            </button>
            <Link
              href="/scan"
              className="flex items-center gap-1.5 glass-button text-xs px-3 py-2"
            >
              <Camera className="w-3.5 h-3.5" /> Scan Label
            </Link>
            <button className="flex items-center gap-1.5 glass-button text-xs px-3 py-2">
              <Share2 className="w-3.5 h-3.5" /> Share
            </button>
          </div>
        </div>
      </div>

      {/* Description */}
      {product.description_en && (
        <div className="glass-card p-4">
          <p className="text-sm text-seoul-charcoal leading-relaxed">{product.description_en}</p>
        </div>
      )}

      {/* Review summary badges */}
      {review_summary && (
        <div className="flex items-center gap-2 flex-wrap">
          <span className="badge-pink text-xs">
            {review_summary.holy_grail_count} Holy Grail
          </span>
          {review_summary.broke_me_out_count > 0 && (
            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 text-red-700">
              {review_summary.broke_me_out_count} Broke Me Out
            </span>
          )}
        </div>
      )}

      {/* Tab navigation */}
      <div className="flex gap-1 bg-seoul-pearl rounded-xl p-1">
        {(['ingredients', 'prices', 'reviews'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all duration-200 ${
              activeTab === tab
                ? 'bg-white shadow-glass text-seoul-charcoal'
                : 'text-seoul-soft hover:text-seoul-charcoal'
            }`}
          >
            {tab === 'ingredients' ? `Ingredients (${ingredients.length})` :
             tab === 'prices' ? 'Prices' :
             `Reviews${review_summary ? ` (${review_summary.count})` : ''}`}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {activeTab === 'ingredients' && (
        <IngredientList ingredients={ingredients} />
      )}

      {activeTab === 'prices' && (
        <PriceComparison productId={product.id} />
      )}

      {activeTab === 'reviews' && (
        <div className="space-y-3">
          {/* Write review button / form */}
          {showReviewForm ? (
            <ReviewForm
              productId={product.id}
              productName={product.name_en}
              onSubmit={handleSubmitReview}
              onCancel={() => setShowReviewForm(false)}
            />
          ) : (
            <button
              onClick={() => setShowReviewForm(true)}
              className="glass-button-primary text-sm w-full py-3 flex items-center justify-center gap-2"
            >
              <Plus className="w-4 h-4" />
              Write a Review (+10 pts)
            </button>
          )}

          {/* Skin-type filter for reviews */}
          <div className="glass-card p-3">
            <ReviewFilters
              filters={reviewFilters}
              onChange={(f) => {
                setReviewFilters(f)
                setReviewsPage(1)
              }}
            />
          </div>

          {/* Reviews list */}
          {reviewsLoading ? (
            <div className="flex items-center justify-center py-8">
              <LoadingSpinner size="md" />
            </div>
          ) : reviews.length === 0 ? (
            <div className="glass-card p-6 text-center">
              <p className="text-sm text-seoul-soft">No reviews yet. Be the first!</p>
            </div>
          ) : (
            <>
              {reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onVote={handleVote}
                />
              ))}

              {reviewsTotalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  <button
                    onClick={() => setReviewsPage(Math.max(1, reviewsPage - 1))}
                    disabled={reviewsPage === 1}
                    className="glass-button text-xs px-3 py-1.5 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <span className="text-xs text-seoul-soft">
                    {reviewsPage} / {reviewsTotalPages}
                  </span>
                  <button
                    onClick={() => setReviewsPage(Math.min(reviewsTotalPages, reviewsPage + 1))}
                    disabled={reviewsPage === reviewsTotalPages}
                    className="glass-button text-xs px-3 py-1.5 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Bottom spacer */}
      <div className="h-4" />
    </div>
  )
}
