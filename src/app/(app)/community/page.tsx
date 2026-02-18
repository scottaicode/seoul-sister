'use client'

import { useState, useEffect, useCallback } from 'react'
import { Users, ChevronDown, ChevronUp, Loader2 } from 'lucide-react'
import ReviewCard from '@/components/community/ReviewCard'
import ReviewFilters from '@/components/community/ReviewFilters'
import PointsBadge from '@/components/community/PointsBadge'
import EmptyState from '@/components/ui/EmptyState'
import type { LucideIcon } from 'lucide-react'
import type { Review } from '@/types/database'

type ReviewWithProduct = Review & {
  product?: {
    id: string
    name_en: string
    brand_en: string
    image_url: string | null
    category: string
  }
}

interface Filters {
  skin_type?: string
  fitzpatrick_scale?: number
  age_range?: string
  reaction?: string
  sort_by?: string
}

export default function CommunityPage() {
  const [reviews, setReviews] = useState<ReviewWithProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [total, setTotal] = useState(0)
  const [filters, setFilters] = useState<Filters>({})
  const [filtersOpen, setFiltersOpen] = useState(false)
  const [userPoints, setUserPoints] = useState(0)

  const fetchReviews = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('page', String(page))
      params.set('limit', '20')
      if (filters.skin_type) params.set('skin_type', filters.skin_type)
      if (filters.fitzpatrick_scale) params.set('fitzpatrick_scale', String(filters.fitzpatrick_scale))
      if (filters.age_range) params.set('age_range', filters.age_range)
      if (filters.reaction) params.set('reaction', filters.reaction)
      if (filters.sort_by) params.set('sort_by', filters.sort_by)

      const res = await fetch(`/api/reviews?${params.toString()}`)
      const data = await res.json()

      setReviews(data.reviews ?? [])
      setTotalPages(data.total_pages ?? 1)
      setTotal(data.total ?? 0)
    } catch {
      setReviews([])
    } finally {
      setLoading(false)
    }
  }, [page, filters])

  useEffect(() => {
    fetchReviews()
  }, [fetchReviews])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [filters])

  async function handleVote(reviewId: string, isHelpful: boolean) {
    const res = await fetch(`/api/reviews/${reviewId}/vote`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ is_helpful: isHelpful }),
    })
    if (!res.ok) throw new Error('Vote failed')
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6 space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col gap-1">
        <h1 className="font-display font-semibold text-2xl text-white section-heading">
          Community
        </h1>
        <p className="text-white/40 text-sm">
          Reviews filtered by skin type, Fitzpatrick scale, and concern. Find people like you.
        </p>
      </div>

      {/* Points badge */}
      {userPoints > 0 && <PointsBadge points={userPoints} />}

      {/* Stats bar */}
      <div className="flex items-center gap-4 text-sm">
        <span className="text-white/40">
          <span className="font-semibold text-white">{total}</span> reviews
        </span>
      </div>

      {/* Filters toggle */}
      <button
        onClick={() => setFiltersOpen(!filtersOpen)}
        className="glass-card p-3 w-full flex items-center justify-between text-sm"
      >
        <span className="font-medium text-white flex items-center gap-2">
          Filter by skin type, age, Fitzpatrick scale
          {Object.values(filters).filter(Boolean).length > 0 && (
            <span className="bg-gold/10 text-gold-light border border-gold/20 rounded-full text-[10px] px-2 py-0.5">
              {Object.values(filters).filter(Boolean).length} active
            </span>
          )}
        </span>
        {filtersOpen ? (
          <ChevronUp className="w-4 h-4 text-white/40" />
        ) : (
          <ChevronDown className="w-4 h-4 text-white/40" />
        )}
      </button>

      {filtersOpen && (
        <div className="glass-card p-4">
          <ReviewFilters filters={filters} onChange={setFilters} />
        </div>
      )}

      {/* Reviews list */}
      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-6 h-6 animate-spin text-gold" />
        </div>
      ) : reviews.length === 0 ? (
        <EmptyState
          icon={Users as LucideIcon}
          title="No Reviews Yet"
          description={
            Object.values(filters).filter(Boolean).length > 0
              ? 'No reviews match your filters. Try adjusting your criteria.'
              : 'Be the first to share your K-beauty experience. Write a review on any product page!'
          }
          actionLabel="Browse Products"
          actionHref="/products"
        />
      ) : (
        <div className="space-y-3">
          {reviews.map((review) => (
            <ReviewCard
              key={review.id}
              review={review}
              showProduct
              onVote={handleVote}
            />
          ))}

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-2 pt-4">
              <button
                onClick={() => setPage(Math.max(1, page - 1))}
                disabled={page === 1}
                className="glass-button text-xs px-3 py-2 disabled:opacity-40"
              >
                Previous
              </button>
              <span className="text-xs text-white/40">
                Page {page} of {totalPages}
              </span>
              <button
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                disabled={page === totalPages}
                className="glass-button text-xs px-3 py-2 disabled:opacity-40"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}

      {/* Bottom spacer for mobile nav */}
      <div className="h-16 md:h-0" />
    </div>
  )
}
