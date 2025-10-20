import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    console.log('🔄 Updating influencer list with new authentic Korean beauty accounts...')

    // Delete old problematic accounts
    const problematicHandles = ['ssin_makeup', 'jella_cosmetic', 'jamesjiunhee', 'sulwhasoo_official']

    for (const handle of problematicHandles) {
      const { error } = await supabaseAdmin
        .from('korean_influencers')
        .delete()
        .eq('handle', handle)
        .eq('platform', 'instagram')

      if (error) {
        console.warn(`Failed to delete ${handle}:`, error)
      } else {
        console.log(`✅ Deleted problematic account: ${handle}`)
      }
    }

    // Add new authentic influencers
    const newInfluencers = [
      {
        handle: 'risabae_art',
        name: 'Risabae (Lee Sabae)',
        platform: 'instagram',
        tier: 'mega',
        priority: 2,
        follower_count: 1000000,
        description: 'Celebrity K-pop makeup artist, 1M+ followers, Korean language content'
      },
      {
        handle: '3ce_official',
        name: '3CE (3 Concept Eyes)',
        platform: 'instagram',
        tier: 'mega',
        priority: 4,
        follower_count: 2000000,
        description: 'StyleNanda makeup brand, 2M+ followers, Seoul fashion trends'
      },
      {
        handle: 'ireneisgood',
        name: 'Irene Kim',
        platform: 'instagram',
        tier: 'rising',
        priority: 8,
        follower_count: 1800000,
        description: 'Model/influencer, 1.8M+ followers, Seoul fashion and beauty'
      },
      {
        handle: 'etudehouse',
        name: 'Etude House',
        platform: 'instagram',
        tier: 'niche',
        priority: 11,
        follower_count: 500000,
        description: 'Popular youth K-beauty brand, official account'
      }
    ]

    let addedCount = 0
    for (const influencer of newInfluencers) {
      const { error } = await supabaseAdmin
        .from('korean_influencers')
        .upsert(influencer, {
          onConflict: 'handle,platform'
        })

      if (error) {
        console.error(`Failed to add ${influencer.handle}:`, error)
      } else {
        addedCount++
        console.log(`✅ Added authentic account: ${influencer.handle}`)
      }
    }

    // Get final list
    const { data: finalInfluencers } = await supabaseAdmin
      .from('korean_influencers')
      .select('handle, name, tier, priority, follower_count')
      .eq('platform', 'instagram')
      .order('priority')

    console.log('✅ Influencer list updated successfully')

    return NextResponse.json({
      success: true,
      message: 'Updated influencer list with authentic Korean beauty accounts',
      changes: {
        removed: problematicHandles,
        added: newInfluencers.map(i => i.handle),
        totalAdded: addedCount
      },
      finalList: finalInfluencers?.map(i => ({
        handle: i.handle,
        name: i.name,
        tier: i.tier,
        priority: i.priority,
        followers: i.follower_count
      })) || []
    })

  } catch (error) {
    console.error('❌ Error updating influencer list:', error)
    return NextResponse.json({
      error: 'Failed to update influencer list',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Seoul Sister Influencer List Updater',
    description: 'Updates database with authentic Korean beauty influencers',
    newAccounts: [
      'risabae_art - Celebrity K-pop makeup artist',
      '3ce_official - StyleNanda makeup brand',
      'ireneisgood - Model/influencer',
      'etudehouse - Youth K-beauty brand'
    ],
    removedAccounts: [
      'ssin_makeup - Page not available',
      'jella_cosmetic - Page not available',
      'jamesjiunhee - Page not available',
      'sulwhasoo_official - Private account'
    ]
  })
}