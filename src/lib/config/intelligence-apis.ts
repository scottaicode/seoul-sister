/**
 * Seoul Sister Intelligence API Configuration
 * Based on official API documentation for SupaData and Apify
 */

export const INTELLIGENCE_API_CONFIG = {
  // SupaData API Configuration (from official docs)
  supadata: {
    baseUrl: 'https://api.supadata.ai/v1',
    authentication: {
      headerName: 'x-api-key',
      headerValue: process.env.SUPADATA_API_KEY
    },
    endpoints: {
      videoTranscription: '/video',        // POST - Submit video for transcription
      transcriptResult: '/transcript/{id}', // GET - Get transcription result
      transcriptBatch: '/transcript/batch', // POST - Batch text analysis
      videoSearch: '/video/search',        // GET - Search videos
      channelVideos: '/channel/{id}/videos', // GET - Get channel videos
      playlistVideos: '/playlist/{id}/videos' // GET - Get playlist videos
    },
    features: {
      supportedPlatforms: ['youtube', 'instagram', 'tiktok', 'twitter', 'file'],
      languages: ['auto', 'en', 'ko', 'ja', 'zh', 'es', 'fr'],
      outputFormats: ['text', 'srt', 'vtt', 'json'],
      analysis: ['entities', 'sentiment', 'trending', 'summary']
    },
    rateLimit: {
      requestsPerMinute: 60,
      videosPerHour: 100
    }
  },

  // Apify API Configuration (from official docs)
  apify: {
    baseUrl: 'https://api.apify.com/v2',
    authentication: {
      headerName: 'Authorization',
      headerValue: `Bearer ${process.env.APIFY_API_KEY}`
    },
    endpoints: {
      actors: '/acts',                    // GET - List available actors
      runActor: '/acts/{actorId}/runs',   // POST - Run an actor
      getRunInfo: '/acts/{actorId}/runs/{runId}', // GET - Get run information
      getDataset: '/datasets/{datasetId}/items', // GET - Get dataset items
      webhooks: '/webhooks'               // GET/POST - Webhook management
    },
    recommendedActors: {
      // Note: These are placeholder IDs - actual IDs need to be found in Apify Store
      instagramScraper: 'shu8hvrXbJbY3Eb9W', // Instagram Posts Scraper
      tiktokScraper: 'clockworks/free-tiktok-scraper', // TikTok Scraper (may have limitations)
      genericWebScraper: 'apify/web-scraper', // Generic web scraper
      youtubeScraper: 'bernardo/youtube-scraper' // YouTube content scraper
    },
    limitations: {
      tiktok: {
        note: 'TikTok has strict API limitations. Official TikTok API may be required for production use.',
        alternatives: ['Manual content input', 'Public RSS feeds', 'Third-party aggregators']
      },
      instagram: {
        note: 'Works well with public content. Private accounts require special handling.',
        bestPractices: ['Focus on public beauty influencers', 'Use hashtag-based discovery']
      }
    }
  },

  // Claude Opus 4.1 Configuration
  claude: {
    model: 'claude-opus-4-1-20250805', // Seoul Sister's specified model
    apiKey: process.env.ANTHROPIC_API_KEY,
    capabilities: {
      koreanLanguage: true,
      trendAnalysis: true,
      sentimentAnalysis: true,
      culturalContext: true,
      beautyExpertise: true
    },
    prompting: {
      systemPrompt: 'Korean beauty intelligence expert with Seoul market knowledge',
      temperature: 0.3, // Lower for consistent analysis
      maxTokens: 4000,
      specializations: [
        'Korean beauty trend identification',
        'Ingredient analysis and safety',
        'Cultural beauty practice understanding',
        'Market timing predictions',
        'Price arbitrage opportunities'
      ]
    }
  }
}

// API Status Check Functions
export async function checkSupaDataStatus(): Promise<{ connected: boolean, error?: string }> {
  try {
    const response = await fetch(`${INTELLIGENCE_API_CONFIG.supadata.baseUrl}/health`, {
      headers: {
        [INTELLIGENCE_API_CONFIG.supadata.authentication.headerName]:
          INTELLIGENCE_API_CONFIG.supadata.authentication.headerValue || ''
      }
    })
    return { connected: response.ok }
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    }
  }
}

export async function checkApifyStatus(): Promise<{ connected: boolean, error?: string }> {
  try {
    const response = await fetch(`${INTELLIGENCE_API_CONFIG.apify.baseUrl}/acts?limit=1`, {
      headers: {
        [INTELLIGENCE_API_CONFIG.apify.authentication.headerName]:
          INTELLIGENCE_API_CONFIG.apify.authentication.headerValue || ''
      }
    })
    return { connected: response.ok }
  } catch (error) {
    return {
      connected: false,
      error: error instanceof Error ? error.message : 'Connection failed'
    }
  }
}

// Korean Beauty Specific Configuration
export const KOREAN_BEAUTY_MONITORING = {
  targetInfluencers: {
    instagram: [
      { handle: 'ponysmakeup', followers: '6.5M', category: 'makeup', language: 'ko/en' },
      { handle: 'ssin_makeup', followers: '2.8M', category: 'makeup', language: 'ko' },
      { handle: 'directorpi', followers: '1.2M', category: 'skincare', language: 'ko' },
      { handle: 'jella_cosmetic', followers: '980K', category: 'expert', language: 'ko' },
      { handle: 'liahyoo', followers: '750K', category: 'skincare', language: 'en' },
      { handle: 'gothamista', followers: '680K', category: 'skincare', language: 'en' }
    ],
    tiktok: [
      // Note: TikTok monitoring may require alternative approaches
      { handle: 'ponysmakeup', category: 'makeup', note: 'May need manual monitoring' },
      { handle: 'ssinnim7', category: 'makeup', note: 'May need manual monitoring' }
    ]
  },

  monitoringKeywords: {
    korean: ['스킨케어', '화장품', '뷰티', '토너', '세럼', '크림', '클렌저', '선크림'],
    english: ['K-beauty', 'Korean skincare', 'Seoul beauty', 'glass skin', 'double cleanse'],
    hashtags: ['#kbeauty', '#koreanbeauty', '#glassskin', '#koreanroutine', '#seoul', '#뷰티']
  },

  analysisFrequency: {
    instagram: 'every 6 hours',
    tiktok: 'daily manual check + weekly deep dive',
    youtube: 'every 12 hours',
    overall: 'continuous with smart batching'
  }
}

// Environment Variable Validation
export function validateIntelligenceAPIs(): {
  valid: boolean,
  missing: string[],
  configured: string[]
} {
  const required = ['SUPADATA_API_KEY', 'APIFY_API_KEY', 'ANTHROPIC_API_KEY']
  const missing: string[] = []
  const configured: string[] = []

  required.forEach(key => {
    if (process.env[key]) {
      configured.push(key)
    } else {
      missing.push(key)
    }
  })

  return {
    valid: missing.length === 0,
    missing,
    configured
  }
}