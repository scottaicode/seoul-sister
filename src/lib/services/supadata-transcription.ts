interface SupadataTranscriptSegment {
  text: string
  start?: number
  end?: number
  timestamp?: string
}

interface SupadataResponse {
  transcript: SupadataTranscriptSegment[]
  language?: string
  duration?: number
  success: boolean
  error?: string
}

interface TranscriptionRequest {
  videoUrl: string
  contentId: string
  platform: 'instagram' | 'tiktok' | 'youtube'
  influencerHandle: string
}

export class SupadataTranscriptionService {
  private apiKey: string
  private baseUrl = 'https://api.supadata.ai/v1'

  constructor() {
    const apiKey = process.env.SUPADATA_API_KEY
    if (!apiKey) {
      console.warn('⚠️ SUPADATA_API_KEY environment variable not found')
      throw new Error('SUPADATA_API_KEY environment variable is required')
    }
    this.apiKey = apiKey
    console.log('✅ Supadata service initialized with API key')
  }

  async transcribeInstagramReel(instagramUrl: string): Promise<SupadataResponse> {
    try {
      console.log(`🎬 Starting Supadata transcription for Instagram URL: ${instagramUrl}`)

      const response = await fetch(`${this.baseUrl}/transcript?url=${encodeURIComponent(instagramUrl)}`, {
        method: 'GET',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`Supadata API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log(`✅ Supadata transcription completed for ${instagramUrl}`)

      return {
        transcript: data.transcript || [],
        language: data.language || 'ko',
        duration: data.duration,
        success: true
      }

    } catch (error) {
      console.error(`❌ Supadata transcription failed for ${instagramUrl}:`, error)
      return {
        transcript: [],
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  async transcribeVideoUrl(videoUrl: string): Promise<SupadataResponse> {
    try {
      console.log(`🎬 Starting Supadata transcription for video URL: ${videoUrl}`)

      const response = await fetch(`${this.baseUrl}/video-transcript`, {
        method: 'POST',
        headers: {
          'x-api-key': this.apiKey,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          url: videoUrl,
          language: 'auto' // Auto-detect Korean
        })
      })

      if (!response.ok) {
        throw new Error(`Supadata video API error: ${response.status} ${response.statusText}`)
      }

      const data = await response.json()
      console.log(`✅ Supadata video transcription completed for ${videoUrl}`)

      return {
        transcript: data.transcript || [],
        language: data.language || 'ko',
        duration: data.duration,
        success: true
      }

    } catch (error) {
      console.error(`❌ Supadata video transcription failed for ${videoUrl}:`, error)
      return {
        transcript: [],
        success: false,
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  formatTranscriptText(segments: SupadataTranscriptSegment[]): string {
    if (!segments || segments.length === 0) {
      return ''
    }

    return segments
      .map(segment => {
        const timestamp = segment.timestamp ||
                         (segment.start ? `${Math.floor(segment.start)}s` : '')
        const timestampPrefix = timestamp ? `[${timestamp}] ` : ''
        return `${timestampPrefix}${segment.text}`
      })
      .join('\n')
  }

  async processKoreanBeautyVideo(request: TranscriptionRequest): Promise<{
    success: boolean
    transcriptText: string
    language: string
    confidence: number
    segments: SupadataTranscriptSegment[]
    beautyKeywords: string[]
    error?: string
  }> {
    try {
      // Choose appropriate transcription method based on platform
      let result: SupadataResponse

      if (request.platform === 'instagram' && request.videoUrl.includes('instagram.com')) {
        result = await this.transcribeInstagramReel(request.videoUrl)
      } else {
        result = await this.transcribeVideoUrl(request.videoUrl)
      }

      if (!result.success) {
        return {
          success: false,
          transcriptText: '',
          language: 'unknown',
          confidence: 0,
          segments: [],
          beautyKeywords: [],
          error: result.error
        }
      }

      const transcriptText = this.formatTranscriptText(result.transcript)
      const beautyKeywords = this.extractKoreanBeautyKeywords(transcriptText)

      // Calculate confidence based on Korean beauty term density
      const confidence = this.calculateBeautyContentConfidence(transcriptText, beautyKeywords)

      console.log(`🎯 Processed Korean beauty video: ${beautyKeywords.length} beauty terms detected`)

      return {
        success: true,
        transcriptText,
        language: result.language || 'ko',
        confidence,
        segments: result.transcript,
        beautyKeywords,
      }

    } catch (error) {
      console.error(`❌ Korean beauty video processing failed:`, error)
      return {
        success: false,
        transcriptText: '',
        language: 'unknown',
        confidence: 0,
        segments: [],
        beautyKeywords: [],
        error: error instanceof Error ? error.message : String(error)
      }
    }
  }

  private extractKoreanBeautyKeywords(text: string): string[] {
    const koreanBeautyTerms = [
      // Korean beauty terms
      '뷰티', '화장품', '스킨케어', '메이크업', '마스크', '에센스', '크림', '세럼',
      '클렌징', '물광', '글래스스킨', '쿠션', 'BB크림', 'CC크림', '파운데이션',
      '컨실러', '아이섀도', '마스카라', '립스틱', '립글로스', '블러셔', '하이라이터',
      '선크림', '토너', '미스트', '앰플', '수분크림', '영양크림', '아이크림',

      // Brand keywords that commonly appear
      'K뷰티', 'K-뷰티', '한국뷰티', '뷰티루틴', '스킨케어루틴', '메이크업루틴',

      // English terms commonly used in Korean beauty content
      'skincare', 'makeup', 'kbeauty', 'routine', 'glow', 'dewy', 'glass skin',
      'cushion', 'essence', 'serum', 'mask', 'cleansing', 'hydrating'
    ]

    const foundTerms: string[] = []
    const textLower = text.toLowerCase()

    koreanBeautyTerms.forEach(term => {
      if (textLower.includes(term.toLowerCase())) {
        foundTerms.push(term)
      }
    })

    return [...new Set(foundTerms)] // Remove duplicates
  }

  private calculateBeautyContentConfidence(text: string, beautyKeywords: string[]): number {
    if (!text || text.length < 10) return 0.1

    const wordCount = text.split(/\s+/).length
    const beautyTermDensity = beautyKeywords.length / Math.max(wordCount, 1)

    // Base confidence from beauty term density
    let confidence = Math.min(0.9, beautyTermDensity * 10)

    // Bonus for Korean language content
    const hasKorean = /[가-힣]/.test(text)
    if (hasKorean) confidence += 0.1

    // Bonus for specific beauty actions mentioned
    const actionTerms = ['사용법', '발라', '뿌려', '발라줘', 'apply', 'use', 'try']
    const hasActions = actionTerms.some(term => text.toLowerCase().includes(term))
    if (hasActions) confidence += 0.05

    return Math.min(1.0, Math.max(0.1, confidence))
  }
}

export const supadataService = new SupadataTranscriptionService()