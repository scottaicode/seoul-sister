import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    console.log('🔄 Applying database migration: add content_type column')

    // Step 1: Add content_type column
    const { error: alterError } = await (supabaseAdmin as any).rpc('exec_sql', {
      query: `ALTER TABLE influencer_content ADD COLUMN IF NOT EXISTS content_type TEXT CHECK (content_type IN ('image', 'video', 'carousel')) DEFAULT 'image';`
    })

    if (alterError) {
      console.error('ALTER TABLE failed:', alterError)
      // Try direct approach
      console.log('Trying direct schema update...')

      // Use a simpler approach - just add the column without the check constraint first
      const { error: simpleAlterError } = await (supabaseAdmin as any).rpc('exec_sql', {
        query: `ALTER TABLE influencer_content ADD COLUMN IF NOT EXISTS content_type TEXT DEFAULT 'image';`
      })

      if (simpleAlterError) {
        return NextResponse.json({
          error: 'Failed to add content_type column',
          details: simpleAlterError.message
        }, { status: 500 })
      }
    }

    console.log('✅ Migration completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Database migration completed successfully',
      migration: 'add_content_type_column'
    })

  } catch (error) {
    console.error('❌ Migration error:', error)
    return NextResponse.json({
      error: 'Migration failed',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}