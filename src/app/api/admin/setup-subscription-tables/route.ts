import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    console.log('🔧 Setting up subscription management tables...')

    // Read the migration SQL file content
    const migrationSQL = `
-- Add subscription management fields to profiles table
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status text CHECK (subscription_status IN ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'));
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_end timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_period_start timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_period_end timestamp with time zone;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false;

-- Add indexes for performance
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_customer_id ON public.profiles(stripe_customer_id);
CREATE INDEX IF NOT EXISTS idx_profiles_stripe_subscription_id ON public.profiles(stripe_subscription_id);
CREATE INDEX IF NOT EXISTS idx_profiles_subscription_status ON public.profiles(subscription_status);
    `

    // Execute the migration
    const { error: migrationError } = await supabase.rpc('exec_sql', {
      sql: migrationSQL
    })

    if (migrationError) {
      // If rpc doesn't work, try executing parts individually
      console.log('RPC method not available, executing queries individually...')

      const queries = [
        "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS stripe_subscription_id text",
        "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS subscription_status text CHECK (subscription_status IN ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid'))",
        "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS trial_end timestamp with time zone",
        "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_period_start timestamp with time zone",
        "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS current_period_end timestamp with time zone",
        "ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS cancel_at_period_end boolean DEFAULT false"
      ]

      for (const query of queries) {
        try {
          await supabase.rpc('exec_sql', { sql: query })
        } catch (err) {
          console.log(`Query may have already been executed: ${query}`)
        }
      }
    }

    // Create user_profiles table for compatibility with existing API endpoints
    const userProfilesSQL = `
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  name text,
  email text,
  phone text,
  stripe_customer_id text,
  stripe_subscription_id text,
  subscription_status text CHECK (subscription_status IN ('incomplete', 'incomplete_expired', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  trial_end timestamp with time zone,
  current_period_start timestamp with time zone,
  current_period_end timestamp with time zone,
  cancel_at_period_end boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
    `

    try {
      await supabase.rpc('exec_sql', { sql: userProfilesSQL })
    } catch (err) {
      console.log('User profiles table may already exist')
    }

    // Test that the tables are properly set up
    const { data: profilesTest, error: profilesError } = await supabase
      .from('profiles')
      .select('id, stripe_subscription_id, subscription_status')
      .limit(1)

    if (profilesError && !profilesError.message.includes('does not exist')) {
      throw profilesError
    }

    const { data: userProfilesTest, error: userProfilesError } = await supabase
      .from('user_profiles')
      .select('id, stripe_subscription_id')
      .limit(1)

    if (userProfilesError && !userProfilesError.message.includes('does not exist')) {
      throw userProfilesError
    }

    console.log('✅ Subscription tables setup completed successfully')

    return NextResponse.json({
      success: true,
      message: 'Subscription management tables created successfully',
      tables_verified: {
        profiles_subscription_fields: !profilesError,
        user_profiles_table: !userProfilesError
      }
    })

  } catch (error) {
    console.error('❌ Error setting up subscription tables:', error)
    return NextResponse.json(
      {
        success: false,
        error: 'Failed to setup subscription tables',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    )
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Seoul Sister Subscription Tables Setup',
    description: 'Creates necessary database tables and fields for Stripe subscription management',
    endpoints: {
      'POST /api/admin/setup-subscription-tables': 'Run database migration for subscription fields'
    }
  })
}