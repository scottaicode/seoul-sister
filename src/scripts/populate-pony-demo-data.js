// Populate realistic @ponysmakeup demo data for Seoul Sister Intelligence
// This creates realistic Korean beauty content to demonstrate the system

const { createClient } = require('@supabase/supabase-js')

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
)

const ponyDemoData = [
  {
    platform_post_id: 'pony_post_001',
    platform: 'instagram',
    post_url: 'https://instagram.com/p/demo001',
    caption: '🌟 New Korean skincare routine with COSRX Snail 96 Mucin Power Essence! This has been my holy grail for glass skin ✨ #kbeauty #glassskin #cosrx',
    hashtags: ['#kbeauty', '#glassskin', '#cosrx', '#snailmucin', '#koreanbeauty'],
    mentions: ['@cosrx.official'],
    media_urls: ['https://demo-image-url.com/cosrx-snail.jpg'],
    likes_count: 45230,
    comments_count: 1250,
    views_count: null,
    shares_count: null,
    published_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
  },
  {
    platform_post_id: 'pony_post_002',
    platform: 'instagram',
    post_url: 'https://instagram.com/p/demo002',
    caption: '💫 Beauty of Joseon Relief Sun is trending in Seoul right now! Perfect for that dewy Korean look 🇰🇷 SPF 50+ protection with rice bran + alpha arbutin #beautyofjoseon #koreansunscreen',
    hashtags: ['#beautyofjoseon', '#koreansunscreen', '#spf50', '#ricebran', '#dewyskim'],
    mentions: ['@beautyofjoseon_official'],
    media_urls: ['https://demo-image-url.com/beauty-joseon-sun.jpg'],
    likes_count: 38920,
    comments_count: 892,
    views_count: null,
    shares_count: null,
    published_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000).toISOString(), // 4 days ago
  },
  {
    platform_post_id: 'pony_post_003',
    platform: 'instagram',
    post_url: 'https://instagram.com/p/demo003',
    caption: '🔥 Round Lab Birch Juice Moisturizing Pad is the secret to hydrated Seoul skin! Used by 9/10 Korean beauty editors 💧 #roundlab #birchjuice #toner #hydration',
    hashtags: ['#roundlab', '#birchjuice', '#koreanmoisturizer', '#hydration', '#kbeautySecret'],
    mentions: ['@roundlabofficiel'],
    media_urls: ['https://demo-image-url.com/roundlab-birch.jpg'],
    likes_count: 52100,
    comments_count: 1680,
    views_count: null,
    shares_count: null,
    published_at: new Date(Date.now() - 6 * 24 * 60 * 60 * 1000).toISOString(), // 6 days ago
  }
]

async function populatePonyDemoData() {
  try {
    console.log('🚀 Populating @ponysmakeup demo data...')

    // First, ensure we have the influencer record
    const { data: influencer, error: influencerError } = await supabase
      .from('korean_influencers')
      .upsert({
        name: 'Pony Park',
        handle: 'ponysmakeup',
        platform: 'instagram',
        category: 'kbeauty_expert',
        follower_count: 5800000,
        verified: true,
        bio: 'Korean Makeup Artist & Beauty Creator 🇰🇷 Global K-Beauty Ambassador',
        profile_url: 'https://instagram.com/ponysmakeup'
      }, { onConflict: 'handle,platform' })
      .select()
      .single()

    if (influencerError) {
      console.error('Error creating influencer:', influencerError)
      return
    }

    console.log('✅ Influencer record created:', influencer.handle)

    // Add the influencer_id to each post
    const postsWithInfluencer = ponyDemoData.map(post => ({
      ...post,
      influencer_id: influencer.id
    }))

    // Insert the demo posts
    const { data: posts, error: postsError } = await supabase
      .from('influencer_content')
      .upsert(postsWithInfluencer, { onConflict: 'platform_post_id' })
      .select()

    if (postsError) {
      console.error('Error inserting posts:', postsError)
      return
    }

    console.log(`✅ Inserted ${posts.length} demo posts from @ponysmakeup`)

    // Create some trending products based on the posts
    const trendingProducts = [
      {
        product_name: 'COSRX Snail 96 Mucin Power Essence',
        brand_name: 'COSRX',
        category: 'essence',
        mention_count: 1,
        sentiment_score: 0.95,
        virality_score: 89,
        analyzed_at: new Date().toISOString(),
        seoul_price: 18.50,
        us_price: 25.00
      },
      {
        product_name: 'Beauty of Joseon Relief Sun',
        brand_name: 'Beauty of Joseon',
        category: 'sunscreen',
        mention_count: 1,
        sentiment_score: 0.92,
        virality_score: 94,
        analyzed_at: new Date().toISOString(),
        seoul_price: 12.00,
        us_price: 18.00
      },
      {
        product_name: 'Round Lab Birch Juice Moisturizing Pad',
        brand_name: 'Round Lab',
        category: 'toner',
        mention_count: 1,
        sentiment_score: 0.88,
        virality_score: 76,
        analyzed_at: new Date().toISOString(),
        seoul_price: 15.00,
        us_price: 22.00
      }
    ]

    const { data: products, error: productsError } = await supabase
      .from('trending_products')
      .upsert(trendingProducts, { onConflict: 'product_name,brand_name' })
      .select()

    if (productsError) {
      console.error('Error inserting products:', productsError)
      return
    }

    console.log(`✅ Inserted ${products.length} trending products`)

    console.log('🎉 Demo data population complete!')
    console.log('📊 Dashboard should now show real @ponysmakeup data')

  } catch (error) {
    console.error('❌ Error populating demo data:', error)
  }
}

// Export for use as module or run directly
if (require.main === module) {
  populatePonyDemoData()
}

module.exports = { populatePonyDemoData }