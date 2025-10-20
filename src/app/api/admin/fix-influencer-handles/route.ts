import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  try {
    if (!supabaseAdmin) {
      return NextResponse.json({ error: 'Database unavailable' }, { status: 500 })
    }

    console.log('🔧 Fixing influencer handles to match Apify configuration...')

    // The correct 12 influencers from Apify (from your screenshot)
    const correctInfluencers = [
      // MEGA TIER (4)
      { oldHandle: 'ponysmakeup', newHandle: 'ponysmakeup', name: 'Pony Park', tier: 'mega', priority: 1 }, // ✅ already correct
      { oldHandle: 'ssin_makeup', newHandle: 'ssin_makeup', name: 'Ssin', tier: 'mega', priority: 2 }, // ✅ already correct
      { oldHandle: 'directorpi', newHandle: 'directorpi', name: 'Director Pi', tier: 'mega', priority: 3 }, // ✅ already correct
      { oldHandle: 'jella_cosmetic', newHandle: 'jella_cosmetic', name: 'Jella Cosmetic', tier: 'mega', priority: 4 }, // ✅ already correct

      // RISING TIER (4)
      { oldHandle: 'liahyoo', newHandle: 'liahyoo', name: 'Lia Yoo', tier: 'rising', priority: 5 }, // ✅ already correct
      { oldHandle: 'gothamista', newHandle: 'gothamista', name: 'Gothamista', tier: 'rising', priority: 6 }, // ✅ already correct
      { oldHandle: 'oliviahye', newHandle: 'glowwithava', name: 'Glow with Ava', tier: 'rising', priority: 7 }, // ❌ needs update
      { oldHandle: 'laneige_kr', newHandle: 'jamesjiunhee', name: 'James Jiun Hee', tier: 'rising', priority: 8 }, // ❌ needs update

      // NICHE TIER (4)
      { oldHandle: 'seoul_skincare', newHandle: 'laneige_kr', name: 'Laneige Korea', tier: 'niche', priority: 9 }, // ❌ needs update
      { oldHandle: 'kbeauty_science', newHandle: 'innisfreeofficial', name: 'Innisfree Official', tier: 'niche', priority: 10 }, // ❌ needs update
      { oldHandle: 'koreanbeauty_amanda', newHandle: 'sulwhasoo_official', name: 'Sulwhasoo Official', tier: 'niche', priority: 11 }, // ❌ needs update
      { oldHandle: 'beautytokyo_seoul', newHandle: 'amorepacific_official', name: 'Amore Pacific Official', tier: 'niche', priority: 12 } // ❌ needs update
    ]

    let updatesCount = 0

    for (const influencer of correctInfluencers) {
      if (influencer.oldHandle !== influencer.newHandle) {
        console.log(`🔄 Updating ${influencer.oldHandle} -> ${influencer.newHandle}`)

        const { error } = await (supabaseAdmin as any)
          .from('korean_influencers')
          .update({
            handle: influencer.newHandle,
            name: influencer.name,
            tier: influencer.tier,
            priority: influencer.priority
          })
          .eq('handle', influencer.oldHandle)
          .eq('platform', 'instagram')

        if (error) {
          console.error(`Failed to update ${influencer.oldHandle}:`, error)
        } else {
          updatesCount++
          console.log(`✅ Updated ${influencer.oldHandle} -> ${influencer.newHandle}`)
        }
      }
    }

    console.log(`✅ Updated ${updatesCount} influencer handles to match Apify configuration`)

    // Check final state
    const { data: finalInfluencers } = await supabaseAdmin
      .from('korean_influencers')
      .select('handle, name, tier, priority')
      .eq('platform', 'instagram')
      .order('priority')

    return NextResponse.json({
      success: true,
      message: `Updated ${updatesCount} influencer handles to match Apify configuration`,
      apifyInfluencers: correctInfluencers.map(i => i.newHandle),
      databaseInfluencers: finalInfluencers?.map((i: any) => i.handle) || [],
      updatedCount: updatesCount,
      totalInfluencers: finalInfluencers?.length || 0
    })

  } catch (error) {
    console.error('❌ Error fixing influencer handles:', error)
    return NextResponse.json({
      error: 'Failed to fix influencer handles',
      details: error instanceof Error ? error.message : String(error)
    }, { status: 500 })
  }
}

export async function GET() {
  return NextResponse.json({
    message: 'Seoul Sister Influencer Handle Fixer',
    description: 'Updates database influencer handles to match the actual 12 accounts being scraped by Apify',
    purpose: 'Fix the mismatch between Apify scraping configuration and database records',
    apifyAccounts: [
      'ponysmakeup', 'ssin_makeup', 'directorpi', 'jella_cosmetic',
      'liahyoo', 'gothamista', 'glowwithava', 'jamesjiunhee',
      'laneige_kr', 'innisfreeofficial', 'sulwhasoo_official', 'amorepacific_official'
    ],
    usage: 'POST /api/admin/fix-influencer-handles'
  })
}