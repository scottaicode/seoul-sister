/**
 * Database Fix API
 * Adds missing columns to products table for Korean discovery system
 */

import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: Request) {
  try {
    console.log('🔧 Fixing database schema for Korean discovery system...')

    // Add missing columns to products table
    const alterQueries = [
      // Add columns that might be missing for Korean discovery
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS price_history JSONB DEFAULT '[]'::JSONB;`,
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS last_scraped TIMESTAMP WITH TIME ZONE;`,
      `ALTER TABLE products ADD COLUMN IF NOT EXISTS auto_update BOOLEAN DEFAULT FALSE;`,

      // Create trending_topics table if not exists
      `CREATE TABLE IF NOT EXISTS trending_topics (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        topic TEXT NOT NULL,
        platform TEXT,
        relevance_score DECIMAL(3,2),
        engagement_metrics JSONB,
        expires_at TIMESTAMP WITH TIME ZONE,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,

      // Create price_tracking table if not exists
      `CREATE TABLE IF NOT EXISTS price_tracking (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        product_name TEXT NOT NULL,
        brand TEXT NOT NULL,
        us_prices JSONB,
        korean_prices JSONB,
        metadata JSONB,
        scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`,

      // Create scraping_jobs table if not exists
      `CREATE TABLE IF NOT EXISTS scraping_jobs (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        job_type TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        target_data JSONB,
        results JSONB,
        scheduled_for TIMESTAMP WITH TIME ZONE,
        started_at TIMESTAMP WITH TIME ZONE,
        completed_at TIMESTAMP WITH TIME ZONE,
        error_message TEXT,
        created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
      );`
    ]

    const results = []

    for (const query of alterQueries) {
      try {
        const { error } = await supabase.rpc('exec', { sql: query })
        if (error) {
          console.error('Query error:', query, error)
          results.push({ query: query.substring(0, 50) + '...', status: 'error', error: error.message })
        } else {
          console.log('✅ Query successful:', query.substring(0, 50) + '...')
          results.push({ query: query.substring(0, 50) + '...', status: 'success' })
        }
      } catch (queryError) {
        console.error('Query exception:', queryError)
        results.push({ query: query.substring(0, 50) + '...', status: 'exception', error: String(queryError) })
      }
    }

    // Insert sample trending topics
    try {
      const { error: insertError } = await supabase
        .from('trending_topics')
        .upsert([
          {
            topic: 'glass skin',
            platform: 'tiktok',
            relevance_score: 0.95,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            topic: 'snail mucin',
            platform: 'korean_beauty',
            relevance_score: 0.92,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          },
          {
            topic: 'Korean sunscreen',
            platform: 'instagram',
            relevance_score: 0.88,
            expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()
          }
        ], { onConflict: 'topic' })

      if (!insertError) {
        results.push({ query: 'Insert trending topics', status: 'success' })
      }
    } catch (insertError) {
      console.error('Insert error:', insertError)
      results.push({ query: 'Insert trending topics', status: 'error', error: String(insertError) })
    }

    return NextResponse.json({
      success: true,
      message: 'Database schema fixed for Korean discovery system',
      results
    })

  } catch (error) {
    console.error('❌ Database fix failed:', error)
    return NextResponse.json(
      {
        error: 'Failed to fix database schema',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    status: 'Database fix endpoint ready',
    description: 'POST to fix database schema for Korean discovery system',
    fixes: [
      'Add missing columns to products table',
      'Create trending_topics table',
      'Create price_tracking table',
      'Create scraping_jobs table',
      'Insert sample trending topics'
    ]
  })
}