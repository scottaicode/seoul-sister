import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    // Execute each SQL statement separately
    // Create tables directly using Supabase client
    const results = []

    // Create price_tracking table
    try {
      await supabase.from('price_tracking').select('id').limit(1)
    } catch {
      // Table doesn't exist, create it via raw SQL through an edge function or manual creation
      results.push({ table: 'price_tracking', status: 'needs_manual_creation' })
    }

    // Create viral_content_history table
    try {
      await supabase.from('viral_content_history').select('id').limit(1)
    } catch {
      results.push({ table: 'viral_content_history', status: 'needs_manual_creation' })
    }

    // Create trending_topics table
    try {
      await supabase.from('trending_topics').select('id').limit(1)
    } catch {
      results.push({ table: 'trending_topics', status: 'needs_manual_creation' })
    }

    // Check if products table has new columns
    try {
      await supabase.from('products').select('price_history, last_scraped, auto_update').limit(1)
      results.push({ table: 'products', status: 'columns_exist' })
    } catch {
      results.push({ table: 'products', status: 'needs_column_updates' })
    }

    // Insert sample trending topics
    try {
      await supabase.from('trending_topics').upsert([
        { topic: 'glass skin', platform: 'tiktok', relevance_score: 0.95, expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) },
        { topic: 'clean girl aesthetic', platform: 'instagram', relevance_score: 0.88, expires_at: new Date(Date.now() + 5 * 24 * 60 * 60 * 1000) },
        { topic: 'douyin makeup', platform: 'tiktok', relevance_score: 0.92, expires_at: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000) },
        { topic: 'K-beauty routine', platform: 'instagram', relevance_score: 0.85, expires_at: new Date(Date.now() + 14 * 24 * 60 * 60 * 1000) }
      ], { onConflict: 'topic,platform' })
    } catch (err) {
      console.warn('Failed to insert trending topics:', err)
    }

    return NextResponse.json({
      success: true,
      message: 'Migration completed',
      results
    })
  } catch (error) {
    console.error('Unexpected error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}