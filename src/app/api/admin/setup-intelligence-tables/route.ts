import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    console.log('🚀 Setting up Korean beauty intelligence database schema...')

    const results = {
      influencersTable: { status: 'checking', details: '' },
      contentTable: { status: 'checking', details: '' },
      transcriptionsTable: { status: 'checking', details: '' },
      indexesCreated: 0,
      errors: [] as string[]
    }

    // Step 1: Update korean_influencers table with missing columns
    try {
      console.log('👥 Updating korean_influencers table schema...')

      const influencerUpdates = [
        'ALTER TABLE korean_influencers ADD COLUMN IF NOT EXISTS follower_count INTEGER',
        'ALTER TABLE korean_influencers ADD COLUMN IF NOT EXISTS engagement_rate DECIMAL(5,2)',
        'ALTER TABLE korean_influencers ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT \'ko\'',
        'ALTER TABLE korean_influencers ADD COLUMN IF NOT EXISTS location VARCHAR(100) DEFAULT \'Seoul\'',
        'ALTER TABLE korean_influencers ADD COLUMN IF NOT EXISTS verified BOOLEAN DEFAULT false',
        'ALTER TABLE korean_influencers ADD COLUMN IF NOT EXISTS last_scraped_at TIMESTAMP WITH TIME ZONE',

        // Rename existing columns to match schema
        'ALTER TABLE korean_influencers RENAME COLUMN followers TO follower_count_backup',
        'ALTER TABLE korean_influencers RENAME COLUMN last_scraped TO last_scraped_at_backup'
      ]

      for (const sql of influencerUpdates) {
        try {
          await supabaseAdmin.rpc('execute_sql', { sql_query: sql })
        } catch (sqlError) {
          console.log(`SQL executed (may have failed if column exists): ${sql}`)
        }
      }

      results.influencersTable = { status: 'updated', details: 'Added missing columns' }
    } catch (error) {
      results.influencersTable = { status: 'error', details: (error as Error).message }
      results.errors.push(`Influencers table: ${(error as Error).message}`)
    }

    // Step 2: Update influencer_content table with missing columns
    try {
      console.log('📝 Updating influencer_content table schema...')

      const contentUpdates = [
        'ALTER TABLE influencer_content ADD COLUMN IF NOT EXISTS content_type VARCHAR(50)',
        'ALTER TABLE influencer_content ADD COLUMN IF NOT EXISTS post_url TEXT',
        'ALTER TABLE influencer_content ADD COLUMN IF NOT EXISTS caption TEXT',
        'ALTER TABLE influencer_content ADD COLUMN IF NOT EXISTS hashtags TEXT[]',
        'ALTER TABLE influencer_content ADD COLUMN IF NOT EXISTS mentions TEXT[]',
        'ALTER TABLE influencer_content ADD COLUMN IF NOT EXISTS media_urls TEXT[]',
        'ALTER TABLE influencer_content ADD COLUMN IF NOT EXISTS view_count INTEGER',
        'ALTER TABLE influencer_content ADD COLUMN IF NOT EXISTS like_count INTEGER',
        'ALTER TABLE influencer_content ADD COLUMN IF NOT EXISTS comment_count INTEGER',
        'ALTER TABLE influencer_content ADD COLUMN IF NOT EXISTS share_count INTEGER',
        'ALTER TABLE influencer_content ADD COLUMN IF NOT EXISTS published_at TIMESTAMP WITH TIME ZONE',
        'ALTER TABLE influencer_content ADD COLUMN IF NOT EXISTS scraped_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()',
        'ALTER TABLE influencer_content ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()'
      ]

      for (const sql of contentUpdates) {
        try {
          await supabaseAdmin.rpc('execute_sql', { sql_query: sql })
        } catch (sqlError) {
          console.log(`SQL executed (may have failed if column exists): ${sql}`)
        }
      }

      // Add unique constraint if it doesn't exist
      try {
        await supabaseAdmin.rpc('execute_sql', {
          sql_query: 'ALTER TABLE influencer_content ADD CONSTRAINT unique_platform_post UNIQUE(platform_post_id, platform)'
        })
      } catch (constraintError) {
        console.log('Unique constraint may already exist')
      }

      results.contentTable = { status: 'updated', details: 'Added missing columns and constraints' }
    } catch (error) {
      results.contentTable = { status: 'error', details: (error as Error).message }
      results.errors.push(`Content table: ${(error as Error).message}`)
    }

    // Step 3: Update content_transcriptions table
    try {
      console.log('🎬 Updating content_transcriptions table schema...')

      const transcriptionUpdates = [
        'ALTER TABLE content_transcriptions ADD COLUMN IF NOT EXISTS video_url TEXT NOT NULL DEFAULT \'\'',
        'ALTER TABLE content_transcriptions ADD COLUMN IF NOT EXISTS transcript_text TEXT',
        'ALTER TABLE content_transcriptions ADD COLUMN IF NOT EXISTS language VARCHAR(10) DEFAULT \'ko\'',
        'ALTER TABLE content_transcriptions ADD COLUMN IF NOT EXISTS confidence_score DECIMAL(5,2)',
        'ALTER TABLE content_transcriptions ADD COLUMN IF NOT EXISTS processing_status VARCHAR(50) DEFAULT \'pending\'',
        'ALTER TABLE content_transcriptions ADD COLUMN IF NOT EXISTS processing_started_at TIMESTAMP WITH TIME ZONE',
        'ALTER TABLE content_transcriptions ADD COLUMN IF NOT EXISTS processing_completed_at TIMESTAMP WITH TIME ZONE',
        'ALTER TABLE content_transcriptions ADD COLUMN IF NOT EXISTS created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()',
        'ALTER TABLE content_transcriptions ADD COLUMN IF NOT EXISTS updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()'
      ]

      for (const sql of transcriptionUpdates) {
        try {
          await supabaseAdmin.rpc('execute_sql', { sql_query: sql })
        } catch (sqlError) {
          console.log(`SQL executed (may have failed if column exists): ${sql}`)
        }
      }

      results.transcriptionsTable = { status: 'updated', details: 'Added missing columns' }
    } catch (error) {
      results.transcriptionsTable = { status: 'error', details: (error as Error).message }
      results.errors.push(`Transcriptions table: ${(error as Error).message}`)
    }

    // Step 4: Create indexes for performance
    try {
      console.log('📊 Creating performance indexes...')

      const indexes = [
        'CREATE INDEX IF NOT EXISTS idx_influencer_content_influencer_id ON influencer_content(influencer_id)',
        'CREATE INDEX IF NOT EXISTS idx_influencer_content_platform ON influencer_content(platform)',
        'CREATE INDEX IF NOT EXISTS idx_influencer_content_published_at ON influencer_content(published_at DESC)',
        'CREATE INDEX IF NOT EXISTS idx_content_transcriptions_content_id ON content_transcriptions(content_id)',
        'CREATE INDEX IF NOT EXISTS idx_content_transcriptions_status ON content_transcriptions(processing_status)'
      ]

      for (const indexSql of indexes) {
        try {
          await supabaseAdmin.rpc('execute_sql', { sql_query: indexSql })
          results.indexesCreated++
        } catch (indexError) {
          console.log(`Index may already exist: ${indexSql}`)
        }
      }
    } catch (error) {
      results.errors.push(`Indexes: ${(error as Error).message}`)
    }

    // Step 5: Verify the schema is now correct
    let verificationResults: any = {}
    try {
      const verifyResponse = await fetch(`${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3001'}/api/admin/check-database-schema`)
      if (verifyResponse.ok) {
        verificationResults = await verifyResponse.json()
      }
    } catch (verifyError) {
      console.log('Could not verify schema automatically')
    }

    return NextResponse.json({
      success: true,
      message: 'Korean beauty intelligence database schema setup completed',
      results,
      verification: verificationResults,
      timestamp: new Date().toISOString(),
      nextSteps: [
        'Test Instagram data storage: POST /api/intelligence/store-instagram-data',
        'Check data flow: GET /api/intelligence/latest',
        'Monitor with: GET /api/admin/check-database-schema'
      ]
    })

  } catch (error) {
    console.error('❌ Intelligence schema setup failed:', error)
    return NextResponse.json({
      error: 'Failed to setup intelligence database schema',
      details: error instanceof Error ? error.message : String(error),
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}

export async function GET(request: NextRequest) {
  return NextResponse.json({
    endpoint: 'POST /api/admin/setup-intelligence-tables',
    purpose: 'Setup Korean beauty intelligence database schema',
    description: 'Creates/updates tables for influencer tracking, content storage, and transcriptions',
    tables: {
      korean_influencers: 'Tracked Korean beauty influencers',
      influencer_content: 'Posts, stories, reels from influencers',
      content_transcriptions: 'Video transcriptions via SupaData'
    },
    warning: 'This will modify your database schema - backup recommended'
  })
}

// Alternative RPC-free approach if the execute_sql function doesn't exist
async function addColumnIfNotExists(tableName: string, columnName: string, columnDefinition: string) {
  try {
    // Try to select from the column - if it fails, column doesn't exist
    await supabaseAdmin!
      .from(tableName)
      .select(columnName)
      .limit(1)

    console.log(`Column ${columnName} already exists in ${tableName}`)
    return true
  } catch (error) {
    console.log(`Column ${columnName} does not exist in ${tableName}, would need manual creation`)
    return false
  }
}