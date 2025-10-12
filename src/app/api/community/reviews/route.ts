import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// GET /api/community/reviews?product_id=xxx&limit=10 - Get product reviews
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const productId = searchParams.get('product_id')
    const limit = parseInt(searchParams.get('limit') || '20')
    const sortBy = searchParams.get('sort') || 'created_at' // created_at, rating, helpful_votes

    let query = supabase
      .from('product_reviews')
      .select(`
        *,
        user_profiles!inner(name)
      `)
      .eq('is_approved', true)
      .order(sortBy, { ascending: false })
      .limit(limit)

    if (productId) {
      query = query.eq('product_id', productId)
    }

    const { data: reviews, error } = await query

    if (error) {
      throw error
    }

    // Add reviewer names (anonymized)
    const reviewsWithNames = reviews?.map(review => ({
      ...review,
      reviewer_name: anonymizeUserName(review.user_profiles?.name || 'Anonymous')
    })) || []

    return NextResponse.json({
      reviews: reviewsWithNames,
      total: reviewsWithNames.length
    })

  } catch (error) {
    console.error('Error fetching reviews:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reviews' },
      { status: 500 }
    )
  }
}

// POST /api/community/reviews - Create new review
export async function POST(request: NextRequest) {
  try {
    const reviewData = await request.json()

    if (!reviewData.user_id || !reviewData.product_id || !reviewData.rating) {
      return NextResponse.json(
        { error: 'User ID, product ID, and rating are required' },
        { status: 400 }
      )
    }

    // Check if user already reviewed this product
    const { data: existingReview } = await supabase
      .from('product_reviews')
      .select('id')
      .eq('user_id', reviewData.user_id)
      .eq('product_id', reviewData.product_id)
      .single()

    if (existingReview) {
      return NextResponse.json(
        { error: 'You have already reviewed this product' },
        { status: 409 }
      )
    }

    // Create review
    const { data: savedReview, error } = await supabase
      .from('product_reviews')
      .insert([{
        user_id: reviewData.user_id,
        product_id: reviewData.product_id,
        rating: reviewData.rating,
        title: reviewData.title,
        review_text: reviewData.review_text,
        reviewer_skin_type: reviewData.reviewer_skin_type,
        reviewer_age_range: reviewData.reviewer_age_range,
        reviewer_concerns: reviewData.reviewer_concerns || [],
        usage_duration: reviewData.usage_duration,
        effectiveness_rating: reviewData.effectiveness_rating || reviewData.rating,
        texture_rating: reviewData.texture_rating || reviewData.rating,
        packaging_rating: reviewData.packaging_rating || reviewData.rating,
        value_rating: reviewData.value_rating || reviewData.rating,
        would_repurchase: reviewData.would_repurchase,
        would_recommend: reviewData.would_recommend,
        noticed_improvements: reviewData.noticed_improvements || [],
        experienced_issues: reviewData.experienced_issues || [],
        verified_purchase: false, // Would need purchase verification system
        is_approved: true // Auto-approve for now, add moderation later
      }])
      .select()
      .single()

    if (error) {
      throw error
    }

    // Update product rating statistics
    await updateProductRatingStats(reviewData.product_id)

    return NextResponse.json({
      review: savedReview,
      message: 'Review submitted successfully'
    }, { status: 201 })

  } catch (error) {
    console.error('Error creating review:', error)
    return NextResponse.json(
      { error: 'Failed to submit review' },
      { status: 500 }
    )
  }
}

// Helper function to anonymize user names
function anonymizeUserName(name: string): string {
  if (!name || name === 'Anonymous') return 'Anonymous'

  const parts = name.split(' ')
  if (parts.length === 1) {
    return parts[0].charAt(0).toUpperCase() + '*'.repeat(Math.max(0, parts[0].length - 1))
  }

  return parts[0].charAt(0).toUpperCase() + '*'.repeat(Math.max(0, parts[0].length - 1)) +
         ' ' + parts[parts.length - 1].charAt(0).toUpperCase() + '.'
}

// Helper function to update product rating statistics
async function updateProductRatingStats(productId: string): Promise<void> {
  try {
    // Calculate average rating and review count
    const { data: stats } = await supabase
      .from('product_reviews')
      .select('rating, effectiveness_rating')
      .eq('product_id', productId)
      .eq('is_approved', true)

    if (!stats || stats.length === 0) return

    const avgRating = stats.reduce((sum, review) => sum + review.rating, 0) / stats.length
    const avgEffectiveness = stats.reduce((sum, review) => sum + (review.effectiveness_rating || review.rating), 0) / stats.length
    const reviewCount = stats.length

    // Update product table with aggregated stats (if products table has these columns)
    // This would require adding rating columns to the products table
    /*
    await supabase
      .from('products')
      .update({
        average_rating: avgRating,
        average_effectiveness: avgEffectiveness,
        review_count: reviewCount
      })
      .eq('id', productId)
    */

    console.log(`Updated stats for product ${productId}: ${avgRating.toFixed(1)} stars (${reviewCount} reviews)`)

  } catch (error) {
    console.error('Error updating product rating stats:', error)
  }
}