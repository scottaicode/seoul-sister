import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// POST /api/community/reviews/vote - Vote on review helpfulness
export async function POST(request: NextRequest) {
  try {
    const { review_id, user_id, vote_type } = await request.json()

    if (!review_id || !user_id || !vote_type) {
      return NextResponse.json(
        { error: 'Review ID, user ID, and vote type are required' },
        { status: 400 }
      )
    }

    // Check if user already voted on this review
    const { data: existingVote } = await supabase
      .from('review_votes')
      .select('id, vote_type')
      .eq('review_id', review_id)
      .eq('user_id', user_id)
      .single()

    if (existingVote) {
      if (existingVote.vote_type === vote_type) {
        // Remove vote if clicking same vote type
        await supabase
          .from('review_votes')
          .delete()
          .eq('id', existingVote.id)
      } else {
        // Update vote type if different
        await supabase
          .from('review_votes')
          .update({ vote_type })
          .eq('id', existingVote.id)
      }
    } else {
      // Create new vote
      await supabase
        .from('review_votes')
        .insert([{
          review_id,
          user_id,
          vote_type
        }])
    }

    // Update review vote counts
    await updateReviewVoteCounts(review_id)

    return NextResponse.json({
      message: 'Vote recorded successfully'
    })

  } catch (error) {
    console.error('Error recording vote:', error)
    return NextResponse.json(
      { error: 'Failed to record vote' },
      { status: 500 }
    )
  }
}

// Helper function to update review vote counts
async function updateReviewVoteCounts(reviewId: string): Promise<void> {
  try {
    // Get vote counts
    const { data: votes } = await supabase
      .from('review_votes')
      .select('vote_type')
      .eq('review_id', reviewId)

    if (!votes) return

    const helpfulVotes = votes.filter(vote => vote.vote_type === 'helpful').length
    const totalVotes = votes.length

    // Update review with new counts
    await supabase
      .from('product_reviews')
      .update({
        helpful_votes: helpfulVotes,
        total_votes: totalVotes
      })
      .eq('id', reviewId)

  } catch (error) {
    console.error('Error updating vote counts:', error)
  }
}

// First, we need to create the review_votes table if it doesn't exist
// This would typically be in a migration file
export async function createReviewVotesTable() {
  const { error } = await supabase.rpc('create_review_votes_table')
  if (error) {
    console.error('Error creating review_votes table:', error)
  }
}