/**
 * Automated Korean Product Discovery Cron Job
 * Runs daily to discover new trending Korean beauty products
 * Keeps Seoul Sister catalog fresh with latest Korean innovations
 */

import { NextResponse } from 'next/server'
import { runKoreanProductDiscovery } from '@/lib/korean-discovery'
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

// Verify cron secret for security
const CRON_SECRET = process.env.CRON_SECRET

// Daily discovery configuration
const DAILY_CONFIG = {
  monday: { count: 25, focus: 'trending' },
  tuesday: { count: 20, focus: 'new_releases' },
  wednesday: { count: 15, focus: 'skincare_essentials' },
  thursday: { count: 20, focus: 'makeup' },
  friday: { count: 30, focus: 'weekend_deals' },
  saturday: { count: 10, focus: 'premium_brands' },
  sunday: { count: 25, focus: 'viral_products' }
}

export async function GET(request: Request) {
  try {
    // Verify cron secret
    const authHeader = request.headers.get('authorization')
    if (!authHeader || !authHeader.includes(CRON_SECRET || '')) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    console.log('🤖 Starting automated Korean product discovery...')

    // Get current day for configuration
    const today = new Date().toLocaleDateString('en-US', { weekday: 'lowercase' }) as keyof typeof DAILY_CONFIG
    const todayConfig = DAILY_CONFIG[today] || DAILY_CONFIG.monday

    console.log(`📅 ${today.charAt(0).toUpperCase() + today.slice(1)} discovery: ${todayConfig.count} products (${todayConfig.focus})`)

    // Check if we've already run today
    const todayStart = new Date()
    todayStart.setHours(0, 0, 0, 0)

    const { count: todayDiscoveries } = await supabase
      .from('products')
      .select('id', { count: 'exact' })
      .gte('created_at', todayStart.toISOString())

    if (todayDiscoveries && todayDiscoveries >= todayConfig.count) {
      console.log(`✅ Already discovered ${todayDiscoveries} products today`)

      return NextResponse.json({
        success: true,
        skipped: true,
        reason: 'Already discovered products today',
        today_count: todayDiscoveries,
        target_count: todayConfig.count,
        next_run: 'Tomorrow at 5 AM UTC'
      })
    }

    // Run discovery
    const discoveryResult = await runKoreanProductDiscovery(todayConfig.count)

    // Log the results
    await logDiscoveryResult(discoveryResult, todayConfig)

    // Get updated stats
    const { count: totalProducts } = await supabase
      .from('products')
      .select('id', { count: 'exact' })

    const { data: todayProducts } = await supabase
      .from('products')
      .select('name_english, brand, seoul_price, us_price, savings_percentage')
      .gte('created_at', todayStart.toISOString())
      .order('created_at', { ascending: false })

    console.log(`🎉 Automated discovery complete: ${discoveryResult.saved} new products added`)

    return NextResponse.json({
      success: true,
      automated: true,
      day_of_week: today,
      focus_area: todayConfig.focus,
      discovered: discoveryResult.discovered,
      saved: discoveryResult.saved,
      total_products: totalProducts,
      trending_topics: discoveryResult.trending_topics,
      todays_products: todayProducts,
      message: `Daily Korean product discovery complete: ${discoveryResult.saved} new products added`,
      schedule: {
        next_run: 'Tomorrow at 5 AM UTC',
        weekly_schedule: DAILY_CONFIG
      }
    })

  } catch (error) {
    console.error('❌ Automated discovery failed:', error)

    // Log the error
    await logDiscoveryError(error)

    return NextResponse.json(
      {
        error: 'Automated discovery failed',
        details: error instanceof Error ? error.message : 'Unknown error',
        timestamp: new Date().toISOString()
      },
      { status: 500 }
    )
  }
}

// Log discovery results for analytics
async function logDiscoveryResult(result: any, config: any) {
  try {
    await supabase
      .from('scraping_jobs')
      .insert({
        job_type: 'automated_discovery',
        status: 'completed',
        target_data: {
          day_config: config,
          timestamp: new Date().toISOString()
        },
        results: result,
        completed_at: new Date().toISOString()
      })
  } catch (error) {
    console.error('Error logging discovery result:', error)
  }
}

// Log discovery errors
async function logDiscoveryError(error: any) {
  try {
    await supabase
      .from('scraping_jobs')
      .insert({
        job_type: 'automated_discovery',
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        completed_at: new Date().toISOString()
      })
  } catch (logError) {
    console.error('Error logging discovery error:', logError)
  }
}

// POST endpoint for manual trigger (admin only)
export async function POST(request: Request) {
  try {
    const { admin_key, force = false, count = 25 } = await request.json()

    // Simple admin authentication (in production, use proper auth)
    if (admin_key !== process.env.ADMIN_KEY) {
      return NextResponse.json(
        { error: 'Admin access required' },
        { status: 403 }
      )
    }

    console.log('👨‍💼 Manual discovery triggered by admin')

    const discoveryResult = await runKoreanProductDiscovery(count)

    // Get updated stats
    const { count: totalProducts } = await supabase
      .from('products')
      .select('id', { count: 'exact' })

    return NextResponse.json({
      success: true,
      manual_trigger: true,
      admin_override: true,
      discovered: discoveryResult.discovered,
      saved: discoveryResult.saved,
      total_products: totalProducts,
      trending_topics: discoveryResult.trending_topics,
      message: `Manual discovery complete: ${discoveryResult.saved} new products added by admin`
    })

  } catch (error) {
    console.error('Manual discovery error:', error)
    return NextResponse.json(
      { error: 'Manual discovery failed' },
      { status: 500 }
    )
  }
}