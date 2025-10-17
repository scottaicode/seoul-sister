export interface KoreanInfluencer {
  handle: string
  platform: 'instagram' | 'tiktok'
  name: string
  followers: number
  category: string
  tier: 'mega' | 'rising' | 'niche'
  specialty: string[]
  maxPosts: number
  priority: number
  scheduleSlot: 'morning' | 'afternoon' | 'evening'
  lastScraped?: string
}

// 12 Korean Beauty Influencer Strategy - Optimized for Seoul Sister Intelligence
export const KOREAN_BEAUTY_INFLUENCERS: KoreanInfluencer[] = [
  // TIER 1: MEGA-INFLUENCERS (4 people) - Trend Setters
  {
    handle: 'ponysmakeup',
    platform: 'instagram',
    name: 'Pony Park',
    followers: 5800000,
    category: 'makeup_artist',
    tier: 'mega',
    specialty: ['makeup', 'korean_beauty', 'global_trends', 'product_reviews'],
    maxPosts: 30,
    priority: 1,
    scheduleSlot: 'morning'
  },
  {
    handle: 'ssin_makeup',
    platform: 'instagram',
    name: 'Ssin',
    followers: 3200000,
    category: 'beauty_creator',
    tier: 'mega',
    specialty: ['tutorials', 'product_reviews', 'daily_makeup', 'skincare'],
    maxPosts: 25,
    priority: 2,
    scheduleSlot: 'morning'
  },
  {
    handle: 'directorpi',
    platform: 'instagram',
    name: 'Director Pi',
    followers: 2800000,
    category: 'skincare_expert',
    tier: 'mega',
    specialty: ['skincare', 'ingredients', 'routines', 'education'],
    maxPosts: 25,
    priority: 3,
    scheduleSlot: 'morning'
  },
  {
    handle: 'jella_cosmetic',
    platform: 'instagram',
    name: 'Jella Cosmetic',
    followers: 2100000,
    category: 'brand_founder',
    tier: 'mega',
    specialty: ['product_launches', 'brand_insights', 'formulations', 'trends'],
    maxPosts: 20,
    priority: 4,
    scheduleSlot: 'morning'
  },

  // TIER 2: RISING STARS (4 people) - High Engagement, Emerging Trends
  {
    handle: 'liahyoo',
    platform: 'instagram',
    name: 'Lia Yoo',
    followers: 800000,
    category: 'skincare_educator',
    tier: 'rising',
    specialty: ['skincare_science', 'routines', 'ingredient_analysis', 'education'],
    maxPosts: 20,
    priority: 5,
    scheduleSlot: 'afternoon'
  },
  {
    handle: 'gothamista',
    platform: 'instagram',
    name: 'Gothamista',
    followers: 650000,
    category: 'korean_american_bridge',
    tier: 'rising',
    specialty: ['korean_skincare', 'us_market', 'crossover_trends', 'reviews'],
    maxPosts: 20,
    priority: 6,
    scheduleSlot: 'afternoon'
  },
  {
    handle: 'laneige_kr',
    platform: 'instagram',
    name: 'Laneige Korea',
    followers: 1200000,
    category: 'official_brand',
    tier: 'rising',
    specialty: ['new_products', 'campaigns', 'brand_trends', 'launches'],
    maxPosts: 15,
    priority: 7,
    scheduleSlot: 'afternoon'
  },
  {
    handle: 'oliviahye',
    platform: 'instagram',
    name: 'Olivia Hye',
    followers: 450000,
    category: 'gen_z_creator',
    tier: 'rising',
    specialty: ['viral_trends', 'gen_z_beauty', 'challenges', 'youthful_skin'],
    maxPosts: 20,
    priority: 8,
    scheduleSlot: 'afternoon'
  },

  // TIER 3: NICHE EXPERTS (4 people) - Early Signal Detection
  {
    handle: 'koreanbeauty_amanda',
    platform: 'instagram',
    name: 'Amanda Korean Beauty',
    followers: 320000,
    category: 'ingredient_specialist',
    tier: 'niche',
    specialty: ['ingredient_analysis', 'formulation', 'science', 'safety'],
    maxPosts: 15,
    priority: 9,
    scheduleSlot: 'evening'
  },
  {
    handle: 'seoul_skincare',
    platform: 'instagram',
    name: 'Seoul Skincare Insider',
    followers: 180000,
    category: 'local_insider',
    tier: 'niche',
    specialty: ['seoul_trends', 'local_brands', 'insider_info', 'street_beauty'],
    maxPosts: 15,
    priority: 10,
    scheduleSlot: 'evening'
  },
  {
    handle: 'kbeauty_science',
    platform: 'instagram',
    name: 'K-Beauty Science',
    followers: 150000,
    category: 'science_educator',
    tier: 'niche',
    specialty: ['chemistry', 'formulations', 'research', 'clinical_studies'],
    maxPosts: 10,
    priority: 11,
    scheduleSlot: 'evening'
  },
  {
    handle: 'beautytokyo_seoul',
    platform: 'instagram',
    name: 'Beauty Tokyo Seoul',
    followers: 280000,
    category: 'crossover_trends',
    tier: 'niche',
    specialty: ['japan_korea', 'crossover_trends', 'cultural_beauty', 'innovations'],
    maxPosts: 15,
    priority: 12,
    scheduleSlot: 'evening'
  }
]

// TikTok Cross-Validation Influencers (Subset for trend validation)
export const TIKTOK_VALIDATION_INFLUENCERS: KoreanInfluencer[] = [
  {
    handle: 'ponysmakeup',
    platform: 'tiktok',
    name: 'Pony Park TikTok',
    followers: 2100000,
    category: 'makeup_artist',
    tier: 'mega',
    specialty: ['viral_makeup', 'trends', 'challenges'],
    maxPosts: 25,
    priority: 1,
    scheduleSlot: 'morning'
  },
  {
    handle: 'ssinnim7',
    platform: 'tiktok',
    name: 'Ssin TikTok',
    followers: 1800000,
    category: 'beauty_creator',
    tier: 'mega',
    specialty: ['tutorials', 'viral_trends', 'quick_tips'],
    maxPosts: 20,
    priority: 2,
    scheduleSlot: 'morning'
  },
  {
    handle: 'jellacosmetic',
    platform: 'tiktok',
    name: 'Jella TikTok',
    followers: 890000,
    category: 'brand_founder',
    tier: 'rising',
    specialty: ['behind_scenes', 'product_development', 'viral_products'],
    maxPosts: 15,
    priority: 3,
    scheduleSlot: 'afternoon'
  },
  {
    handle: 'kbeauty_viral',
    platform: 'tiktok',
    name: 'K-Beauty Viral',
    followers: 650000,
    category: 'trend_tracker',
    tier: 'rising',
    specialty: ['viral_trends', 'challenges', 'product_testing'],
    maxPosts: 20,
    priority: 4,
    scheduleSlot: 'afternoon'
  }
]

// Helper functions for influencer management
export function getInfluencersByTier(tier: 'mega' | 'rising' | 'niche'): KoreanInfluencer[] {
  return KOREAN_BEAUTY_INFLUENCERS.filter(influencer => influencer.tier === tier)
}

export function getInfluencersBySchedule(slot: 'morning' | 'afternoon' | 'evening'): KoreanInfluencer[] {
  return KOREAN_BEAUTY_INFLUENCERS.filter(influencer => influencer.scheduleSlot === slot)
}

export function getAllMonitoredInfluencers(): KoreanInfluencer[] {
  return [...KOREAN_BEAUTY_INFLUENCERS, ...TIKTOK_VALIDATION_INFLUENCERS]
}

export function getInfluencerByHandle(handle: string, platform: 'instagram' | 'tiktok'): KoreanInfluencer | undefined {
  const allInfluencers = getAllMonitoredInfluencers()
  return allInfluencers.find(inf => inf.handle === handle && inf.platform === platform)
}

// Monitoring schedule configuration
export const MONITORING_SCHEDULE = {
  morning: {
    time: '06:00',
    timezone: 'Asia/Seoul',
    influencers: getInfluencersBySchedule('morning'),
    priority: 'high'
  },
  afternoon: {
    time: '14:00',
    timezone: 'Asia/Seoul',
    influencers: getInfluencersBySchedule('afternoon'),
    priority: 'medium'
  },
  evening: {
    time: '22:00',
    timezone: 'Asia/Seoul',
    influencers: getInfluencersBySchedule('evening'),
    priority: 'low'
  }
}