import { NextResponse } from 'next/server'
import { getServiceClient } from '@/lib/supabase'
import {
  extractPatternsFromReview,
  extractPatternsFromConversation,
  storeLearningPatterns,
} from '@/lib/learning/patterns'

// POST /api/cron/aggregate-learning
// Daily: Aggregate new reviews + conversations into learning patterns
// Secured with CRON_SECRET header
export async function POST(request: Request) {
  try {
    // Verify cron secret
    const cronSecret = request.headers.get('x-cron-secret')
    if (cronSecret !== process.env.CRON_SECRET) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const db = getServiceClient()
    let reviewsProcessed = 0
    let conversationsProcessed = 0
    let patternsStored = 0

    // 1. Process unprocessed reviews
    const { data: reviews } = await db
      .from('ss_reviews')
      .select('id, product_id, rating, body, skin_type, skin_concerns, reaction, usage_duration')
      .eq('learning_contributed', false)
      .order('created_at', { ascending: true })
      .limit(50)

    for (const review of reviews || []) {
      try {
        const patterns = await extractPatternsFromReview({
          id: review.id,
          product_id: review.product_id,
          rating: review.rating,
          body: review.body,
          skin_type: review.skin_type,
          skin_concerns: review.skin_concerns || [],
          reaction: review.reaction,
          usage_duration: review.usage_duration,
        })

        const stored = await storeLearningPatterns(patterns, {
          type: 'review',
          id: review.id,
        })

        patternsStored += stored
        reviewsProcessed++
      } catch (error) {
        console.error(`Failed to process review ${review.id}:`, error)
        // Continue with other reviews
      }
    }

    // 2. Process unprocessed conversations (with sufficient messages)
    const { data: conversations } = await db
      .from('ss_yuri_conversations')
      .select('id, specialist_type, user_id')
      .eq('learning_contributed', false)
      .gte('message_count', 4) // Only conversations with real substance
      .order('created_at', { ascending: true })
      .limit(20)

    for (const conv of conversations || []) {
      try {
        // Load messages for this conversation
        const { data: messages } = await db
          .from('ss_yuri_messages')
          .select('role, content')
          .eq('conversation_id', conv.id)
          .order('created_at', { ascending: true })
          .limit(20)

        if (!messages || messages.length < 4) {
          // Mark as processed even if too short
          await db
            .from('ss_yuri_conversations')
            .update({ learning_contributed: true })
            .eq('id', conv.id)
          continue
        }

        // Get user's skin profile for context
        const { data: profile } = await db
          .from('ss_user_profiles')
          .select('skin_type, skin_concerns')
          .eq('user_id', conv.user_id)
          .single()

        const patterns = await extractPatternsFromConversation({
          id: conv.id,
          specialist_type: conv.specialist_type,
          messages: messages.map((m) => ({ role: m.role, content: m.content })),
          user_skin_type:
            (profile as Record<string, unknown>)?.skin_type as string | null,
          user_concerns:
            ((profile as Record<string, unknown>)?.skin_concerns as string[]) ||
            [],
        })

        const stored = await storeLearningPatterns(patterns, {
          type: 'conversation',
          id: conv.id,
        })

        patternsStored += stored
        conversationsProcessed++
      } catch (error) {
        console.error(`Failed to process conversation ${conv.id}:`, error)
      }
    }

    return NextResponse.json({
      success: true,
      reviews_processed: reviewsProcessed,
      conversations_processed: conversationsProcessed,
      patterns_stored: patternsStored,
      processed_at: new Date().toISOString(),
    })
  } catch (error) {
    console.error('Aggregate learning error:', error)
    return NextResponse.json(
      { error: 'Failed to aggregate learning data' },
      { status: 500 }
    )
  }
}
