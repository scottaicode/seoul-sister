'use client'

import { useState } from 'react'
import { Star, ThumbsUp, ThumbsDown, Sparkles, AlertTriangle, Clock, RefreshCw } from 'lucide-react'
import type { Review } from '@/types/database'

interface ReviewCardProps {
  review: Review & {
    product?: {
      id: string
      name_en: string
      brand_en: string
      image_url: string | null
      category: string
    }
  }
  showProduct?: boolean
  onVote?: (reviewId: string, isHelpful: boolean) => void
}

const reactionLabels: Record<string, { label: string; color: string; icon: typeof Sparkles }> = {
  holy_grail: { label: 'Holy Grail', color: 'bg-gold/10 text-gold', icon: Sparkles },
  good: { label: 'Good', color: 'bg-green-100 text-green-700', icon: ThumbsUp },
  okay: { label: 'Okay', color: 'bg-gray-100 text-gray-600', icon: Clock },
  bad: { label: 'Bad', color: 'bg-orange-100 text-orange-700', icon: ThumbsDown },
  broke_me_out: { label: 'Broke Me Out', color: 'bg-red-100 text-red-700', icon: AlertTriangle },
}

const skinTypeLabels: Record<string, string> = {
  oily: 'Oily',
  dry: 'Dry',
  combination: 'Combo',
  normal: 'Normal',
  sensitive: 'Sensitive',
}

export default function ReviewCard({ review, showProduct = false, onVote }: ReviewCardProps) {
  const [helpfulState, setHelpfulState] = useState<boolean | null>(null)

  const reaction = review.reaction ? reactionLabels[review.reaction] : null
  const ReactionIcon = reaction?.icon ?? Sparkles

  function handleVote(isHelpful: boolean) {
    if (helpfulState === isHelpful) {
      setHelpfulState(null)
    } else {
      setHelpfulState(isHelpful)
    }
    onVote?.(review.id, isHelpful)
  }

  const timeAgo = getTimeAgo(review.created_at)

  return (
    <div className="glass-card p-4 space-y-3">
      {/* Product info (for community feed) */}
      {showProduct && review.product && (
        <div className="flex items-center gap-2 pb-2 border-b border-white/10">
          <div className="w-8 h-8 rounded-lg bg-white/5 flex items-center justify-center overflow-hidden flex-shrink-0">
            {review.product.image_url ? (
              <img
                src={review.product.image_url}
                alt={review.product.name_en}
                className="w-full h-full object-cover"
              />
            ) : (
              <Sparkles className="w-3.5 h-3.5 text-gold/50" />
            )}
          </div>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-white truncate">
              {review.product.name_en}
            </p>
            <p className="text-[10px] text-white/40">{review.product.brand_en}</p>
          </div>
        </div>
      )}

      {/* Rating + reaction + title */}
      <div className="space-y-1.5">
        <div className="flex items-center gap-2 flex-wrap">
          {/* Stars */}
          <div className="flex items-center gap-0.5">
            {Array.from({ length: 5 }).map((_, i) => (
              <Star
                key={i}
                className={`w-3.5 h-3.5 ${
                  i < review.rating
                    ? 'fill-gold text-gold'
                    : 'text-gray-200'
                }`}
              />
            ))}
          </div>

          {/* Reaction badge */}
          {reaction && (
            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium ${reaction.color}`}>
              <ReactionIcon className="w-2.5 h-2.5" />
              {reaction.label}
            </span>
          )}

          {review.would_repurchase && (
            <span className="inline-flex items-center gap-0.5 text-[10px] text-green-600">
              <RefreshCw className="w-2.5 h-2.5" />
              Would repurchase
            </span>
          )}
        </div>

        {review.title && (
          <h3 className="font-display font-semibold text-sm text-white">
            {review.title}
          </h3>
        )}
      </div>

      {/* Review body */}
      <p className="text-sm text-white/60 leading-relaxed">{review.body}</p>

      {/* Reviewer profile badges */}
      <div className="flex items-center gap-1.5 flex-wrap">
        {review.skin_type && (
          <span className="badge-blue text-[10px]">
            {skinTypeLabels[review.skin_type] ?? review.skin_type}
          </span>
        )}
        {review.fitzpatrick_scale && (
          <span className="badge-blue text-[10px]">
            Fitzpatrick {review.fitzpatrick_scale}
          </span>
        )}
        {review.age_range && (
          <span className="badge-blue text-[10px]">{review.age_range}</span>
        )}
        {review.usage_duration && (
          <span className="inline-flex items-center gap-0.5 text-[10px] text-white/40">
            <Clock className="w-2.5 h-2.5" />
            Used {review.usage_duration}
          </span>
        )}
      </div>

      {/* Skin concerns */}
      {review.skin_concerns && review.skin_concerns.length > 0 && (
        <div className="flex items-center gap-1 flex-wrap">
          <span className="text-[10px] text-white/40">Concerns:</span>
          {review.skin_concerns.map((c) => (
            <span key={c} className="bg-gold/10 text-gold-light border border-gold/20 rounded-full text-[10px] px-2 py-0.5">{c}</span>
          ))}
        </div>
      )}

      {/* Footer: time + helpful */}
      <div className="flex items-center justify-between pt-2 border-t border-white/10">
        <span className="text-[10px] text-white/40">{timeAgo}</span>

        <div className="flex items-center gap-3">
          <span className="text-[10px] text-white/40">
            {review.helpful_count > 0 && `${review.helpful_count} found helpful`}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => handleVote(true)}
              className={`p-1.5 rounded-lg transition-all duration-200 ${
                helpfulState === true
                  ? 'bg-green-100 text-green-600'
                  : 'hover:bg-white/5 text-white/40'
              }`}
              aria-label="Helpful"
            >
              <ThumbsUp className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => handleVote(false)}
              className={`p-1.5 rounded-lg transition-all duration-200 ${
                helpfulState === false
                  ? 'bg-red-100 text-red-600'
                  : 'hover:bg-white/5 text-white/40'
              }`}
              aria-label="Not helpful"
            >
              <ThumbsDown className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

function getTimeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const minutes = Math.floor(diff / 60000)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  if (days < 30) return `${days}d ago`
  const months = Math.floor(days / 30)
  return `${months}mo ago`
}
