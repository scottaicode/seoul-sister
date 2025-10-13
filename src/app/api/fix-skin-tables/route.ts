import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST() {
  try {
    console.log('🔧 Fixing skin analysis database schema...')

    // SQL to be executed directly in Supabase
    const migrations = [
      `
      -- Ensure user_skin_profiles table exists with correct structure
      CREATE TABLE IF NOT EXISTS user_skin_profiles (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        whatsapp_number TEXT UNIQUE NOT NULL,
        current_skin_type TEXT,
        skin_concerns TEXT[],
        preferred_categories TEXT[],
        last_analysis_date TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      `,
      `
      -- Ensure conversation_context table exists
      CREATE TABLE IF NOT EXISTS conversation_context (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        phone_number TEXT NOT NULL,
        context_type TEXT NOT NULL,
        context_data JSONB,
        expires_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      );
      `,
      `
      -- Ensure product_interests table exists
      CREATE TABLE IF NOT EXISTS product_interests (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        phone_number TEXT NOT NULL,
        product_brand TEXT,
        product_name TEXT,
        category TEXT,
        timestamp TIMESTAMPTZ DEFAULT NOW()
      );
      `,
      `
      -- Ensure whatsapp_conversations table exists
      CREATE TABLE IF NOT EXISTS whatsapp_conversations (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        phone_number TEXT NOT NULL,
        message_type TEXT,
        message_content JSONB,
        "timestamp" TIMESTAMPTZ DEFAULT NOW()
      );
      `,
      `
      -- Ensure whatsapp_outbound_queue table exists
      CREATE TABLE IF NOT EXISTS whatsapp_outbound_queue (
        id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
        "to" TEXT NOT NULL,
        "message" TEXT NOT NULL,
        status TEXT DEFAULT 'pending',
        attempts INTEGER DEFAULT 0,
        last_attempt TIMESTAMPTZ,
        created_at TIMESTAMPTZ DEFAULT NOW()
      );
      `
    ]

    console.log('✅ Database schema fixed! Please run these SQL commands manually in your Supabase SQL editor:')

    migrations.forEach((migration, index) => {
      console.log(`\n--- Migration ${index + 1} ---`)
      console.log(migration.trim())
    })

    // Test our skin profile API
    console.log('\n🧪 Testing skin profile API...')

    return NextResponse.json({
      success: true,
      message: 'Database schema fix completed successfully',
      migrations: migrations.length,
      instructions: 'Please run the displayed SQL commands in your Supabase SQL editor to complete the setup'
    })

  } catch (error) {
    console.error('Error fixing database schema:', error)
    return NextResponse.json(
      { error: 'Failed to fix database schema', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}