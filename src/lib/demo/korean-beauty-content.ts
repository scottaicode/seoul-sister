// Demo Korean beauty content for testing hybrid approach
export interface DemoInfluencerContent {
  platform: 'instagram' | 'tiktok'
  postId: string
  url: string
  caption: string
  hashtags: string[]
  mentions: string[]
  mediaUrls: string[]
  metrics: {
    views?: number
    likes: number
    comments: number
    shares?: number
  }
  publishedAt: string
  authorHandle: string
  transcriptText?: string
}

export const DEMO_KOREAN_BEAUTY_CONTENT: DemoInfluencerContent[] = [
  {
    platform: 'instagram',
    postId: 'demo_pony_001',
    url: 'https://instagram.com/p/demo001',
    caption: '✨ 새로운 글래스스킨 루틴 공유! Beauty of Joseon의 글로우 딥 세럼과 Laneige 워터 슬리핑 마스크로 완벽한 수분 충전 💧 이 조합이 정말 최고예요! #glassskin #kbeauty #skincare #beautyofjoseon #laneige',
    hashtags: ['#glassskin', '#kbeauty', '#skincare', '#beautyofjoseon', '#laneige', '#koreanbeauty'],
    mentions: ['@beautyofjoseon_official', '@laneige_official'],
    mediaUrls: ['https://example.com/pony_reel_001.mp4'],
    metrics: {
      likes: 45600,
      comments: 892,
      views: 230000
    },
    publishedAt: '2024-01-15T14:30:00Z',
    authorHandle: 'ponysmakeup',
    transcriptText: '안녕하세요! 오늘은 제가 요즘 정말 빠져있는 글래스스킨 루틴을 공유해드릴게요. 먼저 Beauty of Joseon 글로우 딥 세럼을 발라주시고요, 이 세럼은 정말 수분감이 좋아서 피부가 촉촉해져요. 그 다음에 Laneige 워터 슬리핑 마스크를 발라주면 아침에 정말 물광피부가 완성돼요!'
  },
  {
    platform: 'tiktok',
    postId: 'demo_ssin_001',
    url: 'https://tiktok.com/@ssinnim7/video/demo001',
    caption: 'COSRX 달팽이 크림 vs Some By Mi 레드 티트리 크림 비교 리뷰! 🐌🌿 어떤 게 더 좋을까요? #cosrx #somebymi #kbeautyreview #skincare',
    hashtags: ['#cosrx', '#somebymi', '#kbeautyreview', '#skincare', '#달팽이크림', '#트러블케어'],
    mentions: ['@cosrx_official', '@somebymi.official'],
    mediaUrls: ['https://example.com/ssin_video_001.mp4'],
    metrics: {
      likes: 28400,
      comments: 567,
      shares: 1200,
      views: 450000
    },
    publishedAt: '2024-01-14T19:45:00Z',
    authorHandle: 'ssinnim7',
    transcriptText: '오늘은 여러분이 정말 많이 궁금해하셨던 COSRX 달팽이 크림과 Some By Mi 레드 티트리 크림을 비교해볼게요. 먼저 COSRX 달팽이 크림은 수분감이 정말 좋고요, 트러블 진정에도 효과가 있어요. Some By Mi는 티트리 성분이 들어있어서 트러블 케어에 더 특화되어 있어요.'
  },
  {
    platform: 'instagram',
    postId: 'demo_director_001',
    url: 'https://instagram.com/p/demo002',
    caption: '🔥 요즘 핫한 Torriden DIVE-IN 로우 모이스처 세럼 솔직 후기! 히알루론산 5종이 들어있어서 수분 폭탄이에요 💦 민감성 피부도 OK! #torriden #divein #hyaluronicacid #sensitiveskin',
    hashtags: ['#torriden', '#divein', '#hyaluronicacid', '#sensitivesin', '#kbeauty', '#serum'],
    mentions: ['@torriden_official'],
    mediaUrls: ['https://example.com/director_reel_001.mp4'],
    metrics: {
      likes: 22100,
      comments: 445,
      views: 180000
    },
    publishedAt: '2024-01-13T16:20:00Z',
    authorHandle: 'directorpi',
    transcriptText: '안녕하세요! 오늘은 요즘 정말 핫한 Torriden DIVE-IN 로우 모이스처 세럼에 대해 이야기해볼게요. 이 세럼은 히알루론산이 5종이나 들어있어서 수분감이 정말 좋아요. 특히 민감성 피부분들도 사용하기 좋은 순한 제품이에요.'
  },
  {
    platform: 'tiktok',
    postId: 'demo_jella_001',
    url: 'https://tiktok.com/@jellacosmetic/video/demo002',
    caption: '겨울철 필수템! Klairs 페이셜 프레시 토너로 각질케어 + 수분충전 동시에! ❄️✨ #klairs #toner #wintercare #exfoliation',
    hashtags: ['#klairs', '#toner', '#wintercare', '#exfoliation', '#kbeauty', '#skincaretips'],
    mentions: ['@klairs.global'],
    mediaUrls: ['https://example.com/jella_video_001.mp4'],
    metrics: {
      likes: 15800,
      comments: 289,
      shares: 650,
      views: 320000
    },
    publishedAt: '2024-01-12T20:15:00Z',
    authorHandle: 'jellacosmetic',
    transcriptText: '겨울철에는 정말 각질과 건조함이 심해지잖아요. 그래서 오늘은 Klairs 페이셜 프레시 토너를 소개해드릴게요. 이 토너는 BHA가 들어있어서 각질케어도 되고, 동시에 수분도 공급해줘서 겨울철에 정말 좋아요.'
  },
  {
    platform: 'instagram',
    postId: 'demo_liahyoo_001',
    url: 'https://instagram.com/p/demo003',
    caption: '🌸 Purito Centella Unscented Serum으로 트러블 진정케어! 센텔라 성분이 10%나 들어있어서 효과 확실해요 🍃 #purito #centella #troublecare #sensitiveskin',
    hashtags: ['#purito', '#centella', '#troublecare', '#sensitiveskin', '#serum', '#kbeauty'],
    mentions: ['@purito_official'],
    mediaUrls: ['https://example.com/lia_reel_001.mp4'],
    metrics: {
      likes: 33200,
      comments: 678,
      views: 275000
    },
    publishedAt: '2024-01-11T13:40:00Z',
    authorHandle: 'liahyoo',
    transcriptText: '트러블이 생기면 정말 스트레스죠. 그럴 때 제가 꼭 사용하는 제품이 Purito Centella Unscented Serum이에요. 센텔라 성분이 무려 10%나 들어있어서 진정 효과가 정말 좋아요. 무향이라서 민감성 피부분들도 안심하고 사용할 수 있어요.'
  }
]

export const DEMO_INFLUENCER_PROFILES = [
  {
    handle: 'ponysmakeup',
    name: 'PONY',
    platform: 'instagram' as const,
    followers: 6200000,
    category: 'Makeup Artist',
    tier: 'mega' as const,
    specialty: ['makeup', 'skincare', 'tutorials'],
    description: 'Global Korean makeup artist and beauty influencer'
  },
  {
    handle: 'ssinnim7',
    name: 'SSIN',
    platform: 'tiktok' as const,
    followers: 890000,
    category: 'Skincare Expert',
    tier: 'rising' as const,
    specialty: ['skincare', 'product reviews', 'ingredients'],
    description: 'Korean skincare specialist and product reviewer'
  },
  {
    handle: 'directorpi',
    name: 'Director Pi',
    platform: 'instagram' as const,
    followers: 2100000,
    category: 'Beauty Content Creator',
    tier: 'mega' as const,
    specialty: ['trends', 'reviews', 'tutorials'],
    description: 'Influential Korean beauty content creator'
  },
  {
    handle: 'jellacosmetic',
    name: 'Jella',
    platform: 'tiktok' as const,
    followers: 450000,
    category: 'Product Discovery',
    tier: 'rising' as const,
    specialty: ['new products', 'seasonal care', 'tips'],
    description: 'Korean beauty product discovery and seasonal care'
  },
  {
    handle: 'liahyoo',
    name: 'Liah Yoo',
    platform: 'instagram' as const,
    followers: 1800000,
    category: 'Skincare Educator',
    tier: 'mega' as const,
    specialty: ['education', 'ingredients', 'routines'],
    description: 'Korean skincare educator and ingredient expert'
  }
]

// Demo trending topics extracted from content
export const DEMO_TRENDING_TOPICS = [
  {
    topic: 'Glass Skin Routine',
    frequency: 3,
    sentiment: 0.9,
    category: 'technique' as const,
    relatedProducts: ['Beauty of Joseon Serum', 'Laneige Water Sleeping Mask']
  },
  {
    topic: 'Centella Asiatica',
    frequency: 2,
    sentiment: 0.85,
    category: 'ingredient' as const,
    relatedProducts: ['Purito Centella Serum', 'Some By Mi Red Tea Tree']
  },
  {
    topic: 'Hyaluronic Acid',
    frequency: 2,
    sentiment: 0.8,
    category: 'ingredient' as const,
    relatedProducts: ['Torriden DIVE-IN Serum']
  },
  {
    topic: 'Winter Skincare',
    frequency: 2,
    sentiment: 0.75,
    category: 'technique' as const,
    relatedProducts: ['Klairs Facial Fresh Toner']
  }
]