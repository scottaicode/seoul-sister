'use client'

import { useState } from 'react'
import { Star, Sparkles, AlertTriangle, ThumbsUp, ThumbsDown, Clock, X } from 'lucide-react'

interface ReviewFormProps {
  productId: string
  productName: string
  onSubmit: (review: ReviewFormData) => Promise<void>
  onCancel: () => void
}

export interface ReviewFormData {
  product_id: string
  rating: number
  title: string
  body: string
  reaction?: 'holy_grail' | 'good' | 'okay' | 'bad' | 'broke_me_out'
  would_repurchase?: boolean
  usage_duration?: string
}

const reactions = [
  { value: 'holy_grail', label: 'Holy Grail', icon: Sparkles, color: 'border-rose-gold bg-seoul-blush text-rose-dark' },
  { value: 'good', label: 'Good', icon: ThumbsUp, color: 'border-green-400 bg-green-50 text-green-700' },
  { value: 'okay', label: 'Okay', icon: Clock, color: 'border-gray-300 bg-gray-50 text-gray-600' },
  { value: 'bad', label: 'Bad', icon: ThumbsDown, color: 'border-orange-400 bg-orange-50 text-orange-700' },
  { value: 'broke_me_out', label: 'Broke Me Out', icon: AlertTriangle, color: 'border-red-400 bg-red-50 text-red-700' },
] as const

const usageDurations = [
  'Less than 1 week',
  '1-4 weeks',
  '1-3 months',
  '3-6 months',
  '6+ months',
]

export default function ReviewForm({ productId, productName, onSubmit, onCancel }: ReviewFormProps) {
  const [rating, setRating] = useState(0)
  const [hoverRating, setHoverRating] = useState(0)
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [reaction, setReaction] = useState<ReviewFormData['reaction']>()
  const [wouldRepurchase, setWouldRepurchase] = useState<boolean | undefined>()
  const [usageDuration, setUsageDuration] = useState<string>()
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (rating === 0) {
      setError('Please select a rating')
      return
    }
    if (title.trim().length < 3) {
      setError('Title must be at least 3 characters')
      return
    }
    if (body.trim().length < 10) {
      setError('Review must be at least 10 characters')
      return
    }

    setSubmitting(true)
    try {
      await onSubmit({
        product_id: productId,
        rating,
        title: title.trim(),
        body: body.trim(),
        reaction,
        would_repurchase: wouldRepurchase,
        usage_duration: usageDuration,
      })
    } catch {
      setError('Failed to submit review. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="glass-card-strong p-5 space-y-5">
      <div className="flex items-center justify-between">
        <h3 className="font-display font-semibold text-lg text-seoul-charcoal">
          Review {productName}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-1.5 rounded-lg hover:bg-seoul-pearl transition-colors"
        >
          <X className="w-4 h-4 text-seoul-soft" />
        </button>
      </div>

      {/* Star rating */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-seoul-charcoal">Rating *</label>
        <div className="flex items-center gap-1">
          {Array.from({ length: 5 }).map((_, i) => (
            <button
              key={i}
              type="button"
              onMouseEnter={() => setHoverRating(i + 1)}
              onMouseLeave={() => setHoverRating(0)}
              onClick={() => setRating(i + 1)}
              className="p-0.5 transition-transform hover:scale-110"
            >
              <Star
                className={`w-7 h-7 transition-colors ${
                  i < (hoverRating || rating)
                    ? 'fill-rose-gold text-rose-gold'
                    : 'text-gray-200'
                }`}
              />
            </button>
          ))}
          {rating > 0 && (
            <span className="ml-2 text-sm text-seoul-soft">{rating}/5</span>
          )}
        </div>
      </div>

      {/* Reaction */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-seoul-charcoal">How was your experience?</label>
        <div className="flex flex-wrap gap-2">
          {reactions.map(({ value, label, icon: Icon, color }) => (
            <button
              key={value}
              type="button"
              onClick={() => setReaction(reaction === value ? undefined : value)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium border transition-all duration-200 ${
                reaction === value
                  ? color
                  : 'border-white/50 bg-white/50 text-seoul-soft hover:bg-seoul-pearl'
              }`}
            >
              <Icon className="w-3 h-3" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* Title */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-seoul-charcoal">Title *</label>
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Summarize your experience..."
          maxLength={200}
          className="glass-input text-sm"
        />
      </div>

      {/* Body */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-seoul-charcoal">Your review *</label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="What did you like or dislike? How did it work with your skin type? Any tips for others?"
          rows={4}
          maxLength={5000}
          className="glass-input text-sm resize-none"
        />
        <p className="text-[10px] text-seoul-soft text-right">{body.length}/5000</p>
      </div>

      {/* Usage duration */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-seoul-charcoal">How long have you used this?</label>
        <div className="flex flex-wrap gap-1.5">
          {usageDurations.map((d) => (
            <button
              key={d}
              type="button"
              onClick={() => setUsageDuration(usageDuration === d ? undefined : d)}
              className={`px-2.5 py-1 rounded-full text-xs transition-all duration-200 ${
                usageDuration === d
                  ? 'bg-glass-100 text-glass-700 border border-glass-300'
                  : 'bg-white/50 text-seoul-soft border border-white/50 hover:bg-seoul-pearl'
              }`}
            >
              {d}
            </button>
          ))}
        </div>
      </div>

      {/* Would repurchase */}
      <div className="space-y-1.5">
        <label className="text-sm font-medium text-seoul-charcoal">Would you repurchase?</label>
        <div className="flex gap-2">
          {[
            { value: true, label: 'Yes' },
            { value: false, label: 'No' },
          ].map(({ value, label }) => (
            <button
              key={label}
              type="button"
              onClick={() => setWouldRepurchase(wouldRepurchase === value ? undefined : value)}
              className={`px-4 py-1.5 rounded-full text-xs font-medium transition-all duration-200 ${
                wouldRepurchase === value
                  ? value
                    ? 'bg-green-100 text-green-700 border border-green-300'
                    : 'bg-red-100 text-red-700 border border-red-300'
                  : 'bg-white/50 text-seoul-soft border border-white/50 hover:bg-seoul-pearl'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <p className="text-sm text-red-600 bg-red-50 p-3 rounded-xl">{error}</p>
      )}

      {/* Submit */}
      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="glass-button text-sm px-5 py-2.5"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={submitting}
          className="glass-button-primary text-sm px-5 py-2.5 flex-1 disabled:opacity-50"
        >
          {submitting ? 'Submitting...' : 'Submit Review (+10 pts)'}
        </button>
      </div>
    </form>
  )
}
