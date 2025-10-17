interface SupaDataConfig {
  apiKey: string
  baseUrl?: string
}

interface TranscriptionRequest {
  videoUrl: string
  language?: 'ko' | 'en' | 'auto'
  outputFormat?: 'text' | 'srt' | 'vtt'
  includeTimestamps?: boolean
  speakerIdentification?: boolean
}

interface TranscriptionResult {
  success: boolean
  transcriptionId?: string
  text?: string
  language?: string
  confidence?: number
  processingTime?: number
  error?: string
  timestamps?: Array<{
    start: number
    end: number
    text: string
    speaker?: string
  }>
}

interface BatchTranscriptionResult {
  totalRequests: number
  successful: number
  failed: number
  results: Array<{
    videoUrl: string
    transcription: TranscriptionResult
  }>
}

export class SupaDataTranscriptionService {
  private apiKey: string
  private baseUrl: string

  constructor(config: SupaDataConfig) {
    this.apiKey = config.apiKey
    this.baseUrl = config.baseUrl || 'https://api.supadata.ai/v1'
  }

  /**
   * Transcribe a single video URL using SupaData API
   */
  async transcribeVideo(request: TranscriptionRequest): Promise<TranscriptionResult> {
    try {
      console.log(`🎬 Starting transcription for: ${request.videoUrl}`)

      // Use the correct SupaData API endpoint from documentation
      const response = await fetch(`${this.baseUrl}/video`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey, // Use x-api-key header as shown in docs
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: request.videoUrl, // Use 'url' field as per SupaData API
          language: request.language || 'auto',
          format: request.outputFormat || 'text',
          timestamps: request.includeTimestamps || false,
          speakers: request.speakerIdentification || false,
          // Korean beauty specific optimizations
          domain: 'beauty',
          custom_vocabulary: KOREAN_BEAUTY_VOCABULARY
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(`SupaData API error: ${response.status} - ${errorData.message || response.statusText}`)
      }

      const data = await response.json()

      // Check if transcription is processing asynchronously
      if (data.status === 'processing') {
        return await this.pollTranscriptionStatus(data.transcription_id)
      }

      console.log(`✅ Transcription completed for: ${request.videoUrl}`)

      return {
        success: true,
        transcriptionId: data.transcription_id,
        text: data.text,
        language: data.detected_language,
        confidence: data.confidence_score,
        processingTime: data.processing_time_ms,
        timestamps: data.timestamps || undefined
      }

    } catch (error) {
      console.error(`❌ Transcription failed for ${request.videoUrl}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  /**
   * Poll for transcription status if processing asynchronously
   */
  private async pollTranscriptionStatus(transcriptionId: string): Promise<TranscriptionResult> {
    const maxAttempts = 30 // 5 minutes with 10-second intervals
    let attempts = 0

    while (attempts < maxAttempts) {
      try {
        // Use correct SupaData API endpoint for getting transcript result
        const response = await fetch(`${this.baseUrl}/transcript/${transcriptionId}`, {
          headers: {
            'x-api-key': this.apiKey
          }
        })

        if (!response.ok) {
          throw new Error(`Status check failed: ${response.status}`)
        }

        const data = await response.json()

        if (data.status === 'completed') {
          return {
            success: true,
            transcriptionId: data.transcription_id,
            text: data.text,
            language: data.detected_language,
            confidence: data.confidence_score,
            processingTime: data.processing_time_ms,
            timestamps: data.timestamps || undefined
          }
        }

        if (data.status === 'failed') {
          return {
            success: false,
            error: data.error_message || 'Transcription failed'
          }
        }

        // Still processing, wait and retry
        await new Promise(resolve => setTimeout(resolve, 10000)) // 10 seconds
        attempts++

      } catch (error) {
        console.error(`Error polling transcription status:`, error)
        attempts++
        await new Promise(resolve => setTimeout(resolve, 10000))
      }
    }

    return {
      success: false,
      error: 'Transcription timeout after 5 minutes'
    }
  }

  /**
   * Transcribe multiple videos in batch
   */
  async transcribeVideoBatch(
    videoUrls: string[],
    options: Omit<TranscriptionRequest, 'videoUrl'> = {}
  ): Promise<BatchTranscriptionResult> {
    console.log(`🎬 Starting batch transcription: ${videoUrls.length} videos`)

    const results: Array<{
      videoUrl: string
      transcription: TranscriptionResult
    }> = []

    let successful = 0
    let failed = 0

    // Process videos in batches to avoid overwhelming the API
    const batchSize = 5
    for (let i = 0; i < videoUrls.length; i += batchSize) {
      const batch = videoUrls.slice(i, i + batchSize)

      const batchPromises = batch.map(async (videoUrl) => {
        const transcription = await this.transcribeVideo({
          videoUrl,
          ...options
        })

        if (transcription.success) {
          successful++
        } else {
          failed++
        }

        return {
          videoUrl,
          transcription
        }
      })

      const batchResults = await Promise.all(batchPromises)
      results.push(...batchResults)

      // Add delay between batches to respect rate limits
      if (i + batchSize < videoUrls.length) {
        console.log(`⏳ Waiting 10 seconds before next batch...`)
        await new Promise(resolve => setTimeout(resolve, 10000))
      }
    }

    console.log(`🎯 Batch transcription completed: ${successful} successful, ${failed} failed`)

    return {
      totalRequests: videoUrls.length,
      successful,
      failed,
      results
    }
  }

  /**
   * Extract Korean beauty keywords from transcription text
   */
  async extractBeautyKeywords(transcriptionText: string): Promise<{
    products: string[]
    ingredients: string[]
    brands: string[]
    techniques: string[]
    sentiment: 'positive' | 'negative' | 'neutral'
    confidence: number
  }> {
    try {
      // Use SupaData's text analysis capabilities
      const response = await fetch(`${this.baseUrl}/transcript`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          text: transcriptionText,
          analysis: ['entities', 'sentiment'],
          domain: 'beauty',
          language: 'auto'
        })
      })

      if (!response.ok) {
        throw new Error(`Keyword extraction failed: ${response.status}`)
      }

      const data = await response.json()

      return {
        products: data.categories.products || [],
        ingredients: data.categories.ingredients || [],
        brands: data.categories.brands || [],
        techniques: data.categories.techniques || [],
        sentiment: data.sentiment?.label || 'neutral',
        confidence: data.confidence_score || 0
      }

    } catch (error) {
      console.error('❌ Keyword extraction failed:', error)
      return {
        products: [],
        ingredients: [],
        brands: [],
        techniques: [],
        sentiment: 'neutral',
        confidence: 0
      }
    }
  }

  /**
   * Detect trending topics in a batch of transcriptions using batch analysis
   */
  async detectTrendingTopics(transcriptions: string[]): Promise<{
    trending: Array<{
      topic: string
      frequency: number
      sentiment: number
      category: 'product' | 'ingredient' | 'brand' | 'technique'
    }>
    summary: {
      totalTranscriptions: number
      topCategories: string[]
      overallSentiment: number
    }
  }> {
    try {
      // Use SupaData's batch processing capability
      const response = await fetch(`${this.baseUrl}/transcript/batch`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          texts: transcriptions,
          analysis: ['entities', 'sentiment', 'trending'],
          domain: 'beauty',
          batch_processing: true
        })
      })

      if (!response.ok) {
        throw new Error(`Trend analysis failed: ${response.status}`)
      }

      const data = await response.json()

      return {
        trending: data.trending_topics || [],
        summary: {
          totalTranscriptions: transcriptions.length,
          topCategories: data.top_categories || [],
          overallSentiment: data.overall_sentiment || 0
        }
      }

    } catch (error) {
      console.error('❌ Trend detection failed:', error)
      return {
        trending: [],
        summary: {
          totalTranscriptions: transcriptions.length,
          topCategories: [],
          overallSentiment: 0
        }
      }
    }
  }

  /**
   * Get transcription quality metrics
   */
  async getTranscriptionMetrics(transcriptionId: string): Promise<{
    wordCount: number
    averageConfidence: number
    languageDistribution: { [language: string]: number }
    qualityScore: number
  }> {
    try {
      // Use SupaData's transcript result endpoint to get detailed metrics
      const response = await fetch(`${this.baseUrl}/transcript/${transcriptionId}`, {
        headers: {
          'x-api-key': this.apiKey
        }
      })

      if (!response.ok) {
        throw new Error(`Metrics retrieval failed: ${response.status}`)
      }

      return await response.json()

    } catch (error) {
      console.error('❌ Failed to get transcription metrics:', error)
      return {
        wordCount: 0,
        averageConfidence: 0,
        languageDistribution: {},
        qualityScore: 0
      }
    }
  }
}

// Factory function for easy instantiation
export function createSupaDataService(): SupaDataTranscriptionService {
  const apiKey = process.env.SUPADATA_API_KEY

  if (!apiKey) {
    throw new Error('SUPADATA_API_KEY environment variable is required')
  }

  return new SupaDataTranscriptionService({ apiKey })
}

// Helper function to extract video URLs from influencer content
export function extractVideoUrls(content: any[]): string[] {
  return content
    .filter(post => post.mediaUrls && post.mediaUrls.length > 0)
    .flatMap(post => post.mediaUrls)
    .filter(url => {
      // Filter for video URLs only
      return url.includes('.mp4') ||
             url.includes('video') ||
             url.includes('tiktok') ||
             url.includes('/reel/') ||
             url.includes('/tv/')
    })
}

// Predefined Korean beauty vocabulary for better transcription accuracy
export const KOREAN_BEAUTY_VOCABULARY = [
  // Korean terms
  '스킨케어', '화장품', '뷰티', '토너', '세럼', '크림', '클렌저',
  '에센스', '마스크팩', '선크림', '미스트', '아이크림', '립밤',
  '파운데이션', '컨실러', '쿠션', '틴트', '마스카라', '아이섀도',

  // English K-beauty terms
  'K-beauty', 'Korean beauty', 'skincare', 'serum', 'essence',
  'moisturizer', 'cleanser', 'sunscreen', 'toner', 'ampoule',
  'sheet mask', 'sleeping mask', 'cushion compact', 'BB cream',
  'CC cream', 'glass skin', 'double cleanse', 'layering',

  // Popular ingredients
  'hyaluronic acid', 'niacinamide', 'vitamin C', 'retinol',
  'centella asiatica', 'snail mucin', 'ginseng', 'green tea',
  'ceramides', 'peptides', 'AHA', 'BHA', 'salicylic acid',

  // Korean brands (common in transcriptions)
  'Innisfree', 'Etude House', 'The Face Shop', 'Missha',
  'Laneige', 'Sulwhasoo', 'Amorepacific', 'Cosrx', 'Klairs',
  'Purito', 'Beauty of Joseon', 'Benton', 'Some By Mi'
]