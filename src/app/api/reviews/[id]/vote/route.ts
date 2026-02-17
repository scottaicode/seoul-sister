import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { handleApiError, AppError } from '@/lib/utils/error-handler'
import { z } from 'zod'

const voteSchema = z.object({
  is_helpful: z.boolean(),
})

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
)

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: reviewId } = await params

    const authHeader = request.headers.get('authorization')
    if (!authHeader) {
      throw new AppError('Authentication required', 401)
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: authError } = await supabase.auth.getUser(token)
    if (authError || !user) {
      throw new AppError('Invalid authentication', 401)
    }

    const body = await request.json()
    const { is_helpful } = voteSchema.parse(body)

    // Check for existing vote
    const { data: existingVote } = await supabase
      .from('ss_review_helpfulness')
      .select('id, is_helpful')
      .eq('review_id', reviewId)
      .eq('user_id', user.id)
      .single()

    if (existingVote) {
      if (existingVote.is_helpful === is_helpful) {
        // Remove vote if same value (toggle off)
        await supabase
          .from('ss_review_helpfulness')
          .delete()
          .eq('id', existingVote.id)

        return NextResponse.json({ action: 'removed' })
      }
      // Update vote if different value
      await supabase
        .from('ss_review_helpfulness')
        .update({ is_helpful })
        .eq('id', existingVote.id)

      return NextResponse.json({ action: 'updated', is_helpful })
    }

    // Insert new vote
    await supabase.from('ss_review_helpfulness').insert({
      review_id: reviewId,
      user_id: user.id,
      is_helpful,
    })

    // Award points to the reviewer if vote is helpful
    if (is_helpful) {
      const { data: review } = await supabase
        .from('ss_reviews')
        .select('user_id')
        .eq('id', reviewId)
        .single()

      if (review && review.user_id !== user.id) {
        await supabase.from('ss_community_points').insert({
          user_id: review.user_id,
          action: 'review_received_helpful',
          points: 2,
          reference_id: reviewId,
        })
      }

      // Award point to voter for participating
      await supabase.from('ss_community_points').insert({
        user_id: user.id,
        action: 'review_helpful_vote',
        points: 1,
        reference_id: reviewId,
      })
    }

    return NextResponse.json({ action: 'created', is_helpful }, { status: 201 })
  } catch (error) {
    return handleApiError(error)
  }
}
